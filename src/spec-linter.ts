import { execFileSync } from "node:child_process";
import { CheckResult } from "./types.js";

/**
 * The spec-linter release this Action runs, pinned.
 *
 * It used to be `npx --yes @unityinflow/spec-linter`, resolved by the npm
 * registry at run time: every pull request executed whatever the latest
 * publish of that package was, on the runner, with the repository checked
 * out. Two steps later the same Action refuses to run a scanner binary whose
 * bytes do not match a published checksum. The linter deserved the same
 * care; a pinned version is the closest npx gets to it, and moving the pin
 * is now a reviewed change to this file rather than a publish nobody here
 * sees.
 */
export const SPEC_LINTER_VERSION = "0.0.1";

function isExecError(
  err: unknown,
): err is { stdout: string; stderr: string; status: number } {
  return typeof err === "object" && err !== null && "stdout" in err;
}

export async function runSpecLinter(specFile: string): Promise<CheckResult> {
  try {
    // execFileSync, not execSync: the path is an argument, not a fragment of
    // shell, so a spec-file input containing a quote or a `$(` is a file that
    // does not exist rather than a command that runs.
    const output = execFileSync(
      "npx",
      [
        "--yes",
        `@unityinflow/spec-linter@${SPEC_LINTER_VERSION}`,
        "check",
        specFile,
        "--format",
        "json",
      ],
      { encoding: "utf-8", timeout: 30000 },
    );

    const reports = JSON.parse(output) as Array<{
      errorCount: number;
      warningCount: number;
      results: Array<{
        severity: string;
        message: string;
        ruleId: string;
      }>;
    }>;

    const report = reports[0];
    if (!report) {
      return { name: "Spec Validation", status: "pass", details: [] };
    }

    const details = report.results.map(
      (r) => `${r.severity === "error" ? "x" : "!"} ${r.message} (${r.ruleId})`,
    );

    if (report.errorCount > 0) {
      return { name: "Spec Validation", status: "fail", details };
    }
    if (report.warningCount > 0) {
      return { name: "Spec Validation", status: "warn", details };
    }
    return { name: "Spec Validation", status: "pass", details };
  } catch (error: unknown) {
    if (!isExecError(error)) {
      const message = error instanceof Error ? error.message : "unknown error";
      return {
        name: "Spec Validation",
        status: "fail",
        details: [`Failed to run spec-linter: ${message}`],
      };
    }

    // Exit code 1 = errors found, 2 = warnings only
    if (error.stdout) {
      try {
        const reports = JSON.parse(error.stdout) as Array<{
          errorCount: number;
          warningCount: number;
          results: Array<{
            severity: string;
            message: string;
            ruleId: string;
          }>;
        }>;
        const report = reports[0];
        const details =
          report?.results.map(
            (r) =>
              `${r.severity === "error" ? "x" : "!"} ${r.message} (${r.ruleId})`,
          ) ?? [];

        return {
          name: "Spec Validation",
          status: (report?.errorCount ?? 0) > 0 ? "fail" : "warn",
          details,
        };
      } catch {
        // JSON parse failed
      }
    }

    return {
      name: "Spec Validation",
      status: "fail",
      details: [
        `Failed to run spec-linter: ${error.stderr ?? "unknown error"}`,
      ],
    };
  }
}
