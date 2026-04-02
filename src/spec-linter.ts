import { execSync } from "node:child_process";
import { CheckResult } from "./types.js";

function isExecError(
  err: unknown,
): err is { stdout: string; stderr: string; status: number } {
  return typeof err === "object" && err !== null && "stdout" in err;
}

export async function runSpecLinter(
  specFile: string,
): Promise<CheckResult> {
  try {
    const output = execSync(
      `npx --yes @unityinflow/spec-linter check "${specFile}" --format json`,
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
      (r) =>
        `${r.severity === "error" ? "x" : "!"} ${r.message} (${r.ruleId})`,
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
      const message =
        error instanceof Error ? error.message : "unknown error";
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
