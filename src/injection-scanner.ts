import { execSync, execFileSync } from "node:child_process";
import { existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { CheckResult } from "./types.js";

function isExecError(
  err: unknown,
): err is { stdout: string; stderr: string; status: number } {
  return typeof err === "object" && err !== null && "stdout" in err;
}

function downloadScanner(version: string): string {
  const platform =
    process.platform === "darwin" ? "apple-darwin" : "unknown-linux-musl";
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  const binaryName = "injection-scanner";
  const downloadPath = join("/tmp", binaryName);

  if (existsSync(downloadPath)) return downloadPath;

  const url = `https://github.com/UnityInFlow/injection-scanner/releases/download/${version}/${binaryName}-${arch}-${platform}`;

  execSync(`curl -fsSL -o "${downloadPath}" "${url}"`, { timeout: 30000 });
  chmodSync(downloadPath, 0o755);

  return downloadPath;
}

export async function runInjectionScanner(
  specFile: string,
  version: string,
): Promise<CheckResult> {
  try {
    const binaryPath = downloadScanner(version);
    const output = execFileSync(
      binaryPath,
      ["check", specFile, "--format", "json"],
      {
        encoding: "utf-8",
        timeout: 10000,
      },
    );

    const reports = JSON.parse(output) as Array<{
      matches: Array<{
        severity: string;
        message: string;
        pattern_id: string;
        line: number;
      }>;
      critical_count: number;
      high_count: number;
    }>;

    const report = reports[0];
    if (!report || report.matches.length === 0) {
      return {
        name: "Security Scan",
        status: "pass",
        details: ["No injection patterns detected"],
      };
    }

    const details = report.matches.map(
      (m) => `${m.severity} :${m.line} ${m.message} (${m.pattern_id})`,
    );

    return {
      name: "Security Scan",
      status: report.critical_count > 0 ? "fail" : "warn",
      details,
    };
  } catch (error: unknown) {
    if (isExecError(error) && error.stdout) {
      try {
        const reports = JSON.parse(error.stdout) as Array<{
          matches: Array<{
            severity: string;
            message: string;
            pattern_id: string;
            line: number;
          }>;
          critical_count: number;
        }>;
        const report = reports[0];
        const details =
          report?.matches.map(
            (m) =>
              `${m.severity} :${m.line} ${m.message} (${m.pattern_id})`,
          ) ?? [];

        return {
          name: "Security Scan",
          status: (report?.critical_count ?? 0) > 0 ? "fail" : "warn",
          details,
        };
      } catch {
        // parse failed
      }
    }

    const message =
      error instanceof Error ? error.message : "unknown";

    return {
      name: "Security Scan",
      status: "warn",
      details: [`Could not run injection-scanner: ${message}`],
    };
  }
}
