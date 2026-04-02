import { ComplianceReport } from "./types.js";

const MARKER = "<!-- spec-ci-plugin-comment -->";

function statusIcon(status: string): string {
  if (status === "pass") return "\u2705";
  if (status === "warn") return "\u26a0\ufe0f";
  return "\u274c";
}

export function buildComment(report: ComplianceReport): string {
  const lines: string[] = [MARKER, "## Spec Compliance Report", ""];

  // Checks (spec-linter, injection-scanner)
  for (const check of report.checks) {
    lines.push(`### ${check.name}`);
    lines.push(
      `${statusIcon(check.status)} **${check.status.toUpperCase()}**`,
    );
    if (check.details.length > 0) {
      for (const detail of check.details) {
        lines.push(`- ${detail}`);
      }
    }
    lines.push("");
  }

  // Scope
  if (report.scopeResult) {
    lines.push("### Scope Compliance");
    if (report.scopeResult.declaredScope.length === 0) {
      lines.push(
        "\u26a0\ufe0f No scope declared in spec file. Consider adding a `## Scope` section.",
      );
    } else if (report.scopeResult.compliant) {
      lines.push(
        "\u2705 All changed files are within spec-declared scope.",
      );
      lines.push(
        `Scope: ${report.scopeResult.declaredScope.join(", ")}`,
      );
    } else {
      lines.push("\u274c Files changed outside declared scope:");
      for (const f of report.scopeResult.outOfScope) {
        lines.push(`- \`${f}\``);
      }
    }
    lines.push("");
  }

  // Criteria
  if (report.criteriaMatches.length > 0) {
    lines.push("### Acceptance Criteria Coverage");
    const matched = report.criteriaMatches.filter((c) => c.matched).length;
    const total = report.criteriaMatches.length;

    for (const cm of report.criteriaMatches) {
      if (cm.matched) {
        lines.push(
          `\u2705 "${cm.criterion}" \u2014 test found: ${cm.testFile}${cm.testName ? ` ("${cm.testName}")` : ""}`,
        );
      } else {
        lines.push(
          `\u26a0\ufe0f "${cm.criterion}" \u2014 no matching test found`,
        );
      }
    }
    lines.push("");
    lines.push(
      `**Coverage: ${matched}/${total} criteria matched to tests**`,
    );
    lines.push("");
  }

  // Overall
  lines.push("---");
  lines.push(`**Overall: ${report.overallStatus.toUpperCase()}**`);

  return lines.join("\n");
}

export function getCommentMarker(): string {
  return MARKER;
}
