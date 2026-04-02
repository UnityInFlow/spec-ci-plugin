import * as core from "@actions/core";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { runSpecLinter } from "./spec-linter.js";
import { runInjectionScanner } from "./injection-scanner.js";
import {
  extractDeclaredScope,
  checkScopeCompliance,
} from "./scope-checker.js";
import {
  extractCriteria,
  extractTestDescriptions,
  matchCriteria,
} from "./criteria-checker.js";
import { buildComment } from "./comment-builder.js";
import { postOrUpdateComment, getPrChangedFiles } from "./github.js";
import { ActionInputs, CheckStatus, ComplianceReport } from "./types.js";

function getInputs(): ActionInputs {
  return {
    specFile: core.getInput("spec-file") || "CLAUDE.md",
    failOn: (core.getInput("fail-on") || "errors") as ActionInputs["failOn"],
    postComment: core.getInput("post-comment") !== "false",
    injectionScannerVersion:
      core.getInput("injection-scanner-version") || "v0.0.1",
  };
}

function findTestFiles(dir: string): Map<string, string[]> {
  const testFiles = new Map<string, string[]>();

  function walk(currentDir: string): void {
    for (const entry of readdirSync(currentDir)) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (
        stat.isDirectory() &&
        entry !== "node_modules" &&
        entry !== "dist"
      ) {
        walk(fullPath);
      } else if (entry.match(/\.(test|spec)\.(ts|js|tsx|jsx)$/)) {
        const content = readFileSync(fullPath, "utf-8");
        const descriptions = extractTestDescriptions(content);
        testFiles.set(fullPath, descriptions);
      }
    }
  }

  walk(dir);
  return testFiles;
}

function worstStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  return "pass";
}

async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    const specPath = resolve(inputs.specFile);
    const specContent = readFileSync(specPath, "utf-8");

    core.info(`Checking spec file: ${specPath}`);

    // 1. Run spec-linter
    const specResult = await runSpecLinter(specPath);
    core.info(`Spec validation: ${specResult.status}`);

    // 2. Run injection-scanner
    const scanResult = await runInjectionScanner(
      specPath,
      inputs.injectionScannerVersion,
    );
    core.info(`Security scan: ${scanResult.status}`);

    // 3. Scope check
    const token =
      core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
    const changedFiles = token ? await getPrChangedFiles(token) : [];
    const declaredScope = extractDeclaredScope(specContent);
    const scopeResult = checkScopeCompliance(declaredScope, changedFiles);
    core.info(
      `Scope compliance: ${scopeResult.compliant ? "pass" : "fail"}`,
    );

    // 4. Criteria check
    const criteria = extractCriteria(specContent);
    const testFiles = findTestFiles(".");
    const criteriaMatches = matchCriteria(criteria, testFiles);
    const matchedCount = criteriaMatches.filter((c) => c.matched).length;
    core.info(`Criteria coverage: ${matchedCount}/${criteria.length}`);

    // 5. Build report
    const scopeStatus: CheckStatus =
      declaredScope.length === 0
        ? "warn"
        : scopeResult.compliant
          ? "pass"
          : "fail";

    const report: ComplianceReport = {
      specFile: inputs.specFile,
      checks: [specResult, scanResult],
      scopeResult,
      criteriaMatches,
      overallStatus: worstStatus([
        specResult.status,
        scanResult.status,
        scopeStatus,
      ]),
    };

    // 6. Post comment
    if (inputs.postComment && token) {
      const comment = buildComment(report);
      await postOrUpdateComment(token, comment);
      core.info("PR comment posted/updated");
    }

    // 7. Set exit code
    if (inputs.failOn === "errors" && report.overallStatus === "fail") {
      core.setFailed("Spec compliance check failed with errors");
    } else if (
      inputs.failOn === "warnings" &&
      report.overallStatus !== "pass"
    ) {
      core.setFailed("Spec compliance check failed with warnings");
    }

    core.setOutput("status", report.overallStatus);
    core.setOutput("report", JSON.stringify(report));
  } catch (error: unknown) {
    const err = error as Error;
    core.setFailed(err.message);
  }
}

run();
