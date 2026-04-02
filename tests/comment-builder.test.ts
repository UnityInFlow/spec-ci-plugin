import { describe, it, expect } from "vitest";
import { buildComment, getCommentMarker } from "../src/comment-builder.js";
import { ComplianceReport } from "../src/types.js";

describe("buildComment", () => {
  it("includes hidden marker for edit-in-place", () => {
    const report: ComplianceReport = {
      specFile: "CLAUDE.md",
      checks: [],
      criteriaMatches: [],
      overallStatus: "pass",
    };
    const comment = buildComment(report);
    expect(comment).toContain("<!-- spec-ci-plugin-comment -->");
  });

  it("renders check results", () => {
    const report: ComplianceReport = {
      specFile: "CLAUDE.md",
      checks: [
        {
          name: "Spec Validation",
          status: "pass",
          details: [],
        },
        {
          name: "Security Scan",
          status: "warn",
          details: ["Found potential issue"],
        },
      ],
      criteriaMatches: [],
      overallStatus: "warn",
    };
    const comment = buildComment(report);
    expect(comment).toContain("### Spec Validation");
    expect(comment).toContain("### Security Scan");
    expect(comment).toContain("Found potential issue");
  });

  it("renders scope compliance — all in scope", () => {
    const report: ComplianceReport = {
      specFile: "CLAUDE.md",
      checks: [],
      scopeResult: {
        compliant: true,
        declaredScope: ["src/auth/"],
        changedFiles: ["src/auth/login.ts"],
        outOfScope: [],
      },
      criteriaMatches: [],
      overallStatus: "pass",
    };
    const comment = buildComment(report);
    expect(comment).toContain("Scope Compliance");
    expect(comment).toContain("All changed files are within spec-declared scope");
  });

  it("renders scope compliance — out of scope files", () => {
    const report: ComplianceReport = {
      specFile: "CLAUDE.md",
      checks: [],
      scopeResult: {
        compliant: false,
        declaredScope: ["src/auth/"],
        changedFiles: ["src/auth/login.ts", "src/random/file.ts"],
        outOfScope: ["src/random/file.ts"],
      },
      criteriaMatches: [],
      overallStatus: "fail",
    };
    const comment = buildComment(report);
    expect(comment).toContain("Files changed outside declared scope");
    expect(comment).toContain("`src/random/file.ts`");
  });

  it("renders scope compliance — no scope declared", () => {
    const report: ComplianceReport = {
      specFile: "CLAUDE.md",
      checks: [],
      scopeResult: {
        compliant: true,
        declaredScope: [],
        changedFiles: ["src/anything.ts"],
        outOfScope: [],
      },
      criteriaMatches: [],
      overallStatus: "warn",
    };
    const comment = buildComment(report);
    expect(comment).toContain("No scope declared");
  });

  it("renders criteria matches", () => {
    const report: ComplianceReport = {
      specFile: "CLAUDE.md",
      checks: [],
      criteriaMatches: [
        {
          criterion: "Users can log in",
          matched: true,
          testFile: "tests/auth.test.ts",
          testName: "allows user login",
        },
        {
          criterion: "Export data as CSV",
          matched: false,
        },
      ],
      overallStatus: "warn",
    };
    const comment = buildComment(report);
    expect(comment).toContain("Acceptance Criteria Coverage");
    expect(comment).toContain("Users can log in");
    expect(comment).toContain("test found");
    expect(comment).toContain("no matching test found");
    expect(comment).toContain("Coverage: 1/2");
  });

  it("renders overall status", () => {
    const report: ComplianceReport = {
      specFile: "CLAUDE.md",
      checks: [],
      criteriaMatches: [],
      overallStatus: "fail",
    };
    const comment = buildComment(report);
    expect(comment).toContain("**Overall: FAIL**");
  });
});

describe("getCommentMarker", () => {
  it("returns the hidden marker string", () => {
    expect(getCommentMarker()).toBe("<!-- spec-ci-plugin-comment -->");
  });
});
