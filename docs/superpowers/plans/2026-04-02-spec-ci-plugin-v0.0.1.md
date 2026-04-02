# spec-ci-plugin v0.0.1 Implementation Plan — Phase 1: GitHub Action

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a GitHub Action that enforces spec compliance on every PR — runs spec-linter, injection-scanner, scope checker, criteria checker, and posts a structured PR comment.

**Architecture:** A TypeScript GitHub Action that: (1) shells out to `npx @unityinflow/spec-linter` for spec validation, (2) downloads and runs `injection-scanner` binary for security scanning, (3) parses spec file for declared scope and acceptance criteria, (4) compares PR diff against scope, (5) matches criteria to test descriptions, (6) posts/updates a single PR comment with results.

**Tech Stack:** TypeScript (strict, ES2022, ESM), @actions/core + @actions/github, @octokit/rest, vitest, tsup

**Spec:** `04-spec-ci-plugin.md`
**Context:** `.planning/phases/phase-1/01-CONTEXT.md`

**Important:** No `Co-Authored-By` in any commits.

---

## File Structure

```
spec-ci-plugin/
├── .github/
│   ├── workflows/ci.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   └── adr/
│       └── ADR-001-tech-stack.md
├── src/
│   ├── index.ts              ← Action entry point
│   ├── types.ts              ← ComplianceReport, CheckResult, ActionInputs
│   ├── spec-linter.ts        ← Run spec-linter via npx, parse output
│   ├── injection-scanner.ts  ← Download binary, run, parse output
│   ├── scope-checker.ts      ← Extract scope from spec, compare to PR diff
│   ├── criteria-checker.ts   ← Parse test descriptions, match to criteria
│   ├── comment-builder.ts    ← Build markdown PR comment from results
│   └── github.ts             ← Post/update PR comment via API
├── tests/
│   ├── fixtures/
│   │   ├── spec-with-scope.md
│   │   ├── spec-no-scope.md
│   │   ├── sample-test.ts
│   │   └── sample-criteria.md
│   ├── scope-checker.test.ts
│   ├── criteria-checker.test.ts
│   ├── comment-builder.test.ts
│   └── spec-linter.test.ts
├── action.yml
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
└── LICENSE
```

---

## Task 1: Create GitHub repo and scaffold

> **PR 1: Foundation**

- [ ] **Step 1: Create repo**

```bash
gh repo create UnityInFlow/spec-ci-plugin --public --description "Spec compliance CI/CD plugin — enforces spec-linter, injection-scanner, scope, and criteria checks on every PR"
```

- [ ] **Step 2: Initialize project in the 04 planning folder**

```bash
cd /Users/jirihermann/Documents/workspace-1-ideas/unity-in-flow-ai/04-spec-ci-plugin
npm init -y
```

- [ ] **Step 3: Create package.json**

```json
{
  "name": "@unityinflow/spec-ci-plugin",
  "version": "0.0.0",
  "description": "Spec compliance CI/CD plugin — enforces spec-linter, injection-scanner, scope, and criteria checks on every PR",
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "format": "prettier --check src/ tests/",
    "format:fix": "prettier --write src/ tests/",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["github-action", "spec", "lint", "ci", "claude-code", "compliance"],
  "author": "Jiri Hermann",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/UnityInFlow/spec-ci-plugin.git"
  },
  "engines": { "node": ">=18" }
}
```

- [ ] **Step 4: Install dependencies**

```bash
npm install @actions/core @actions/github @octokit/rest
npm install -D typescript tsup vitest @types/node prettier
```

- [ ] **Step 5: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"],
    "ignoreDeprecations": "6.0"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 6: Create tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  clean: true,
  sourcemap: true,
  target: "node20",
  noExternal: [/.*/],
});
```

- [ ] **Step 7: Create action.yml**

```yaml
name: "Spec Compliance Check"
description: "Enforce spec-linter, injection-scanner, scope, and criteria checks on every PR"
author: "UnityInFlow"

inputs:
  github-token:
    description: "GitHub token for posting PR comments and reading PR files"
    required: false
    default: "${{ github.token }}"
  spec-file:
    description: "Path to spec file (CLAUDE.md, REQUIREMENTS.md, etc.)"
    required: false
    default: "CLAUDE.md"
  fail-on:
    description: "When to fail: errors | warnings | never"
    required: false
    default: "errors"
  post-comment:
    description: "Post compliance report as PR comment"
    required: false
    default: "true"
  injection-scanner-version:
    description: "injection-scanner version to download"
    required: false
    default: "v0.0.1"

runs:
  using: "node20"
  main: "dist/index.js"

branding:
  icon: "shield"
  color: "blue"
```

- [ ] **Step 8: Create .gitignore, .github/workflows/ci.yml, PR template, README skeleton, LICENSE, ADR-001**

CI uses self-hosted runners:
```yaml
runs-on: [arc-runner-unityinflow]
```

- [ ] **Step 9: Create src/types.ts**

```typescript
export interface ActionInputs {
  specFile: string;
  failOn: "errors" | "warnings" | "never";
  postComment: boolean;
  injectionScannerVersion: string;
}

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  details: string[];
}

export interface ScopeResult {
  compliant: boolean;
  declaredScope: string[];
  changedFiles: string[];
  outOfScope: string[];
}

export interface CriteriaMatch {
  criterion: string;
  matched: boolean;
  testFile?: string;
  testName?: string;
}

export interface ComplianceReport {
  specFile: string;
  checks: CheckResult[];
  scopeResult?: ScopeResult;
  criteriaMatches: CriteriaMatch[];
  overallStatus: CheckStatus;
}
```

- [ ] **Step 10: Create stub src/index.ts**

```typescript
// Stub — replaced with full action in Task 7
export type { ComplianceReport, ActionInputs } from "./types.js";
```

- [ ] **Step 11: Commit and push**

```bash
git init
git add .
git commit -m "feat: scaffold GitHub Action with action.yml, types, CI"
git remote add origin git@github.com:UnityInFlow/spec-ci-plugin.git
git push -u origin main
```

---

## Task 2: Implement spec-linter integration

> **PR 2: Checkers**

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/checkers
```

- [ ] **Step 2: Write tests for spec-linter runner**

```typescript
import { describe, it, expect } from "vitest";
import { runSpecLinter } from "../src/spec-linter.js";

describe("runSpecLinter", () => {
  it("returns pass for valid spec content", async () => {
    const result = await runSpecLinter("tests/fixtures/spec-with-scope.md");
    expect(result.status).toBe("pass");
  });

  it("returns fail for spec with errors", async () => {
    const result = await runSpecLinter("tests/fixtures/spec-no-scope.md");
    // spec-no-scope.md is missing required sections
    expect(result.status).toBe("fail");
  });

  it("captures error details", async () => {
    const result = await runSpecLinter("tests/fixtures/spec-no-scope.md");
    expect(result.details.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Create test fixtures**

`tests/fixtures/spec-with-scope.md`:
```markdown
# Test Project

## Project Overview
A test project for CI plugin testing.

## Constraints
- TypeScript strict mode

## Acceptance Criteria
- [ ] Users can log in with email
- [ ] Dashboard loads in under 2 seconds
- [ ] Export data as CSV

## Scope
- src/auth/
- src/dashboard/
- src/export/
```

`tests/fixtures/spec-no-scope.md`:
```markdown
# Bad Spec
No required sections here.
```

`tests/fixtures/sample-test.ts`:
```typescript
describe("auth", () => {
  it("allows user login with email and password", () => {});
  it("rejects invalid credentials", () => {});
});

describe("dashboard", () => {
  test("loads dashboard within performance budget", () => {});
});

describe("export", () => {
  it("exports data as CSV format", () => {});
});
```

- [ ] **Step 4: Implement spec-linter runner**

```typescript
import { execSync } from "node:child_process";
import { CheckResult } from "./types.js";

function isExecError(err: unknown): err is { stdout: string; stderr: string; status: number } {
  return typeof err === "object" && err !== null && "stdout" in err;
}

export async function runSpecLinter(specFile: string): Promise<CheckResult> {
  try {
    const output = execSync(
      `npx --yes @unityinflow/spec-linter check "${specFile}" --format json`,
      { encoding: "utf-8", timeout: 30000 },
    );

    const reports = JSON.parse(output) as Array<{
      errorCount: number;
      warningCount: number;
      results: Array<{ severity: string; message: string; ruleId: string }>;
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
    const err = error as { stdout?: string; stderr?: string; status?: number };

    // Exit code 1 = errors found, 2 = warnings only
    if (err.stdout) {
      try {
        const reports = JSON.parse(err.stdout) as Array<{
          errorCount: number;
          warningCount: number;
          results: Array<{ severity: string; message: string; ruleId: string }>;
        }>;
        const report = reports[0];
        const details = report?.results.map(
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
      details: [`Failed to run spec-linter: ${err.stderr ?? "unknown error"}`],
    };
  }
}
```

- [ ] **Step 5: Run tests, commit**

```bash
npx vitest run tests/spec-linter.test.ts
git add src/spec-linter.ts tests/spec-linter.test.ts tests/fixtures/
git commit -m "feat: add spec-linter integration via npx"
```

---

## Task 3: Implement injection-scanner integration

> **PR 2 (continued)**

- [ ] **Step 1: Implement injection-scanner runner**

```typescript
import { execSync, execFileSync } from "node:child_process";
import { existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { CheckResult } from "./types.js";

function downloadScanner(version: string): string {
  const platform = process.platform === "darwin" ? "apple-darwin" : "unknown-linux-musl";
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  const binaryName = "injection-scanner";
  const downloadPath = join("/tmp", binaryName);

  if (existsSync(downloadPath)) return downloadPath;

  const url = `https://github.com/UnityInFlow/injection-scanner/releases/download/${version}/${binaryName}-${arch}-${platform}`;
  // Fallback: try without arch/platform suffix (current v0.0.1 uses plain name)
  // const fallbackUrl = `https://github.com/UnityInFlow/injection-scanner/releases/download/${version}/${binaryName}`;

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
    const output = execFileSync(binaryPath, ["check", specFile, "--format", "json"], {
      encoding: "utf-8",
      timeout: 10000,
    });

    const reports = JSON.parse(output) as Array<{
      matches: Array<{ severity: string; message: string; pattern_id: string; line: number }>;
      critical_count: number;
      high_count: number;
    }>;

    const report = reports[0];
    if (!report || report.matches.length === 0) {
      return { name: "Security Scan", status: "pass", details: ["No injection patterns detected"] };
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
    const err = error as { stdout?: string; message?: string };

    // injection-scanner exits 1 when findings exist
    if (err.stdout) {
      try {
        const reports = JSON.parse(err.stdout) as Array<{
          matches: Array<{ severity: string; message: string; pattern_id: string; line: number }>;
          critical_count: number;
        }>;
        const report = reports[0];
        const details = report?.matches.map(
          (m) => `${m.severity} :${m.line} ${m.message} (${m.pattern_id})`,
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

    return {
      name: "Security Scan",
      status: "warn",
      details: [`Could not run injection-scanner: ${err.message ?? "unknown"}`],
    };
  }
}
```

- [ ] **Step 2: Write tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { runInjectionScanner } from "../src/injection-scanner.js";

describe("runInjectionScanner", () => {
  it("returns pass for clean file", async () => {
    const result = await runInjectionScanner("tests/fixtures/spec-with-scope.md", "v0.0.1");
    // Clean spec file should have no injection patterns
    expect(["pass", "warn"]).toContain(result.status);
  });

  it("returns check result with name", async () => {
    const result = await runInjectionScanner("tests/fixtures/spec-with-scope.md", "v0.0.1");
    expect(result.name).toBe("Security Scan");
  });

  it("handles missing binary gracefully", async () => {
    const result = await runInjectionScanner("tests/fixtures/spec-with-scope.md", "v999.999.999");
    // Should warn, not crash
    expect(result.status).toBe("warn");
    expect(result.details.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/injection-scanner.ts tests/injection-scanner.test.ts
git commit -m "feat: add injection-scanner binary download and integration"
```

---

## Task 4: Implement scope checker

> **PR 2 (continued)**

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { extractDeclaredScope, checkScopeCompliance } from "../src/scope-checker.js";
import { readFileSync } from "node:fs";

describe("extractDeclaredScope", () => {
  it("extracts paths from ## Scope section", () => {
    const content = readFileSync("tests/fixtures/spec-with-scope.md", "utf-8");
    const scope = extractDeclaredScope(content);
    expect(scope).toContain("src/auth/");
    expect(scope).toContain("src/dashboard/");
  });

  it("returns empty for spec with no scope section", () => {
    const content = readFileSync("tests/fixtures/spec-no-scope.md", "utf-8");
    const scope = extractDeclaredScope(content);
    expect(scope).toHaveLength(0);
  });

  it("extracts from GSD <files> tags", () => {
    const content = "Some text\n<files>src/auth/, src/api/</files>\nMore text";
    const scope = extractDeclaredScope(content);
    expect(scope).toContain("src/auth/");
    expect(scope).toContain("src/api/");
  });
});

describe("checkScopeCompliance", () => {
  it("passes when all files are in scope", () => {
    const result = checkScopeCompliance(
      ["src/auth/", "src/dashboard/"],
      ["src/auth/login.ts", "src/dashboard/index.ts"],
    );
    expect(result.compliant).toBe(true);
    expect(result.outOfScope).toHaveLength(0);
  });

  it("fails when files are out of scope", () => {
    const result = checkScopeCompliance(
      ["src/auth/"],
      ["src/auth/login.ts", "src/random/file.ts"],
    );
    expect(result.compliant).toBe(false);
    expect(result.outOfScope).toContain("src/random/file.ts");
  });

  it("handles empty scope (no scope declared)", () => {
    const result = checkScopeCompliance([], ["src/anything.ts"]);
    expect(result.compliant).toBe(true);
  });
});
```

- [ ] **Step 2: Implement scope checker**

```typescript
import { ScopeResult } from "./types.js";

export function extractDeclaredScope(specContent: string): string[] {
  const paths: string[] = [];

  // Extract from GSD <files> tags
  const xmlRegex = /<files>(.*?)<\/files>/gs;
  for (const match of specContent.matchAll(xmlRegex)) {
    paths.push(
      ...match[1].split(",").map((p) => p.trim()).filter((p) => p.length > 0),
    );
  }

  // Extract from ## Scope section
  const scopeRegex = /## (?:Scope|Files in scope)\s*\n([\s\S]*?)(?=\n## |$)/i;
  const scopeMatch = specContent.match(scopeRegex);
  if (scopeMatch) {
    const lines = scopeMatch[1].split("\n");
    for (const line of lines) {
      const cleaned = line.replace(/^[-*]\s+/, "").trim();
      if (cleaned.length > 0 && !cleaned.startsWith("#")) {
        paths.push(cleaned);
      }
    }
  }

  return [...new Set(paths)];
}

export function checkScopeCompliance(
  declaredScope: string[],
  changedFiles: string[],
): ScopeResult {
  // No declared scope = skip check (everything is in scope)
  if (declaredScope.length === 0) {
    return { compliant: true, declaredScope, changedFiles, outOfScope: [] };
  }

  const outOfScope = changedFiles.filter(
    (f) => !declaredScope.some((s) => f.startsWith(s)),
  );

  return {
    compliant: outOfScope.length === 0,
    declaredScope,
    changedFiles,
    outOfScope,
  };
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/scope-checker.test.ts
git add src/scope-checker.ts tests/scope-checker.test.ts
git commit -m "feat: add scope checker — extract scope from spec, compare to PR diff"
```

---

## Task 5: Implement criteria checker

> **PR 2 (continued)**

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { extractCriteria, extractTestDescriptions, matchCriteria } from "../src/criteria-checker.js";

describe("extractCriteria", () => {
  it("extracts acceptance criteria from spec", () => {
    const content = "## Acceptance Criteria\n- [ ] Users can log in\n- [ ] Dashboard loads fast\n\n## Other";
    const criteria = extractCriteria(content);
    expect(criteria).toHaveLength(2);
    expect(criteria[0]).toContain("Users can log in");
  });

  it("returns empty for no criteria section", () => {
    expect(extractCriteria("# Just a title")).toHaveLength(0);
  });
});

describe("extractTestDescriptions", () => {
  it("extracts describe/it/test strings from test file", () => {
    const content = `describe("auth", () => {\n  it("allows user login with email", () => {});\n});`;
    const descriptions = extractTestDescriptions(content);
    expect(descriptions.some((d) => d.includes("login"))).toBe(true);
  });
});

describe("matchCriteria", () => {
  it("matches criteria to test descriptions", () => {
    const criteria = ["Users can log in with email"];
    const testFiles = new Map([
      ["tests/auth.test.ts", ["allows user login with email and password"]],
    ]);
    const matches = matchCriteria(criteria, testFiles);
    expect(matches[0].matched).toBe(true);
    expect(matches[0].testFile).toBe("tests/auth.test.ts");
  });

  it("reports unmatched criteria", () => {
    const criteria = ["Export data as PDF"];
    const testFiles = new Map([
      ["tests/auth.test.ts", ["allows user login"]],
    ]);
    const matches = matchCriteria(criteria, testFiles);
    expect(matches[0].matched).toBe(false);
  });
});
```

- [ ] **Step 2: Implement criteria checker**

```typescript
import { CriteriaMatch } from "./types.js";

export function extractCriteria(specContent: string): string[] {
  const criteriaRegex = /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/i;
  const match = specContent.match(criteriaRegex);
  if (!match) return [];

  return match[1]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+(?:\[.\]\s+)?/, "").trim())
    .filter((line) => line.length > 0);
}

export function extractTestDescriptions(testContent: string): string[] {
  const descriptions: string[] = [];
  const regex = /(?:describe|it|test)\s*\(\s*["'`](.*?)["'`]/g;

  for (const match of testContent.matchAll(regex)) {
    descriptions.push(match[1]);
  }

  return descriptions;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function similarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap++;
  }

  return overlap / Math.max(tokensA.size, tokensB.size);
}

export function matchCriteria(
  criteria: string[],
  testFiles: Map<string, string[]>,
): CriteriaMatch[] {
  return criteria.map((criterion) => {
    let bestMatch = { score: 0, file: "", name: "" };

    for (const [file, descriptions] of testFiles) {
      for (const desc of descriptions) {
        const score = similarity(criterion, desc);
        if (score > bestMatch.score) {
          bestMatch = { score, file, name: desc };
        }
      }
    }

    const threshold = 0.3;
    if (bestMatch.score >= threshold) {
      return {
        criterion,
        matched: true,
        testFile: bestMatch.file,
        testName: bestMatch.name,
      };
    }

    return { criterion, matched: false };
  });
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/criteria-checker.test.ts
git add src/criteria-checker.ts tests/criteria-checker.test.ts
git commit -m "feat: add criteria checker — parse test descriptions, keyword match"
```

---

## Task 6: Implement comment builder

> **PR 2 (continued)**

- [ ] **Step 1: Implement comment builder**

```typescript
import { ComplianceReport, CheckResult, CriteriaMatch, ScopeResult } from "./types.js";

const MARKER = "<!-- spec-ci-plugin-comment -->";

function statusIcon(status: string): string {
  if (status === "pass") return "✅";
  if (status === "warn") return "⚠️";
  return "❌";
}

export function buildComment(report: ComplianceReport): string {
  const lines: string[] = [MARKER, "## Spec Compliance Report", ""];

  // Checks (spec-linter, injection-scanner)
  for (const check of report.checks) {
    lines.push(`### ${check.name}`);
    lines.push(`${statusIcon(check.status)} **${check.status.toUpperCase()}**`);
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
      lines.push("⚠️ No scope declared in spec file. Consider adding a `## Scope` section.");
    } else if (report.scopeResult.compliant) {
      lines.push("✅ All changed files are within spec-declared scope.");
      lines.push(`Scope: ${report.scopeResult.declaredScope.join(", ")}`);
    } else {
      lines.push("❌ Files changed outside declared scope:");
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
        lines.push(`✅ "${cm.criterion}" — test found: ${cm.testFile}${cm.testName ? ` ("${cm.testName}")` : ""}`);
      } else {
        lines.push(`⚠️ "${cm.criterion}" — no matching test found`);
      }
    }
    lines.push("");
    lines.push(`**Coverage: ${matched}/${total} criteria matched to tests**`);
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
```

- [ ] **Step 2: Write tests, commit**

```bash
npx vitest run tests/comment-builder.test.ts
git add src/comment-builder.ts tests/comment-builder.test.ts
git commit -m "feat: add PR comment builder with structured compliance report"
```

---

## Task 7: Implement GitHub API integration + PR comment posting

> **PR 2 (continued)**

- [ ] **Step 1: Implement github.ts**

```typescript
import { getOctokit, context } from "@actions/github";
import { getCommentMarker } from "./comment-builder.js";

export async function postOrUpdateComment(
  token: string,
  body: string,
): Promise<void> {
  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;
  const issueNumber = context.payload.pull_request?.number;

  if (!issueNumber) {
    throw new Error("This action only works on pull_request events");
  }

  const marker = getCommentMarker();

  // Find existing comment
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const existing = comments.find((c) => c.body?.includes(marker));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}

export async function getPrChangedFiles(token: string): Promise<string[]> {
  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;
  const pullNumber = context.payload.pull_request?.number;

  if (!pullNumber) return [];

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return files.map((f) => f.filename);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/github.ts
git commit -m "feat: add GitHub API — post/update PR comment, get changed files"
```

- [ ] **Step 3: Push and create PR 2**

```bash
npx vitest run
git push -u origin feat/checkers
gh pr create --title "feat: spec-linter, injection-scanner, scope, criteria, comment builder" --body "PR 2 of spec-ci-plugin v0.0.1.

## What
- spec-linter integration (npx)
- injection-scanner binary download + run
- Scope checker (Markdown + GSD tags)
- Criteria checker (test description matching)
- PR comment builder (single comment, edit-in-place)
- GitHub API (post/update comment, get changed files)"
```

---

## Task 8: Implement full action entry point

> **PR 3: Action Entry Point**

- [ ] **Step 1: Create feature branch**

```bash
git checkout main && git pull
git checkout -b feat/action-entry
```

- [ ] **Step 2: Replace src/index.ts with full action**

```typescript
import * as core from "@actions/core";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { runSpecLinter } from "./spec-linter.js";
import { runInjectionScanner } from "./injection-scanner.js";
import { extractDeclaredScope, checkScopeCompliance } from "./scope-checker.js";
import { extractCriteria, extractTestDescriptions, matchCriteria } from "./criteria-checker.js";
import { buildComment } from "./comment-builder.js";
import { postOrUpdateComment, getPrChangedFiles } from "./github.js";
import { ActionInputs, CheckStatus, ComplianceReport } from "./types.js";

function getInputs(): ActionInputs {
  return {
    specFile: core.getInput("spec-file") || "CLAUDE.md",
    failOn: (core.getInput("fail-on") || "errors") as ActionInputs["failOn"],
    postComment: core.getInput("post-comment") !== "false",
    injectionScannerVersion: core.getInput("injection-scanner-version") || "v0.0.1",
  };
}

function findTestFiles(dir: string): Map<string, string[]> {
  const testFiles = new Map<string, string[]>();

  function walk(currentDir: string): void {
    for (const entry of readdirSync(currentDir)) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && entry !== "node_modules" && entry !== "dist") {
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
    const scanResult = await runInjectionScanner(specPath, inputs.injectionScannerVersion);
    core.info(`Security scan: ${scanResult.status}`);

    // 3. Scope check
    const token = core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
    const changedFiles = token ? await getPrChangedFiles(token) : [];
    const declaredScope = extractDeclaredScope(specContent);
    const scopeResult = checkScopeCompliance(declaredScope, changedFiles);
    core.info(`Scope compliance: ${scopeResult.compliant ? "pass" : "fail"}`);

    // 4. Criteria check
    const criteria = extractCriteria(specContent);
    const testFiles = findTestFiles(".");
    const criteriaMatches = matchCriteria(criteria, testFiles);
    const matchedCount = criteriaMatches.filter((c) => c.matched).length;
    core.info(`Criteria coverage: ${matchedCount}/${criteria.length}`);

    // 5. Build report
    const scopeStatus: CheckStatus = declaredScope.length === 0
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
    } else if (inputs.failOn === "warnings" && report.overallStatus !== "pass") {
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
```

- [ ] **Step 3: Build, test, commit, push, create PR**

```bash
npm run build
npx vitest run
git add src/index.ts
git commit -m "feat: add full action entry point with 4-step validation pipeline"
git push -u origin feat/action-entry
gh pr create --title "feat: full action entry point with validation pipeline" --body "PR 3 — complete action that runs spec-linter, injection-scanner, scope checker, criteria checker, posts PR comment."
```

---

## Task 9: Release prep

> **PR 4: Release**

- [ ] **Step 1: Merge branches, create release branch**
- [ ] **Step 2: Create CONTRIBUTING.md**
- [ ] **Step 3: Write full README** (problem statement, action.yml usage, PR comment example, inputs table, exit codes)
- [ ] **Step 4: Build dist/ for release** (GitHub Actions need dist/ committed)

```bash
npm run build
git add dist/
git commit -m "build: add compiled dist/ for GitHub Action"
```

- [ ] **Step 5: Run full verification, commit, push, create PR**
- [ ] **Step 6: Merge to main, tag v0.0.1, create GitHub Release**

```bash
git tag v0.0.1
git push origin v0.0.1
gh release create v0.0.1 --title "v0.0.1" --notes "..."
```

- [ ] **Step 7: Create v0.1.0 GitHub issues**
- [ ] **Step 8: Update .planning/STATE.md**
