import { describe, it, expect } from "vitest";
import {
  extractDeclaredScope,
  checkScopeCompliance,
} from "../src/scope-checker.js";
import { readFileSync } from "node:fs";

describe("extractDeclaredScope", () => {
  it("extracts paths from ## Scope section", () => {
    const content = readFileSync(
      "tests/fixtures/spec-with-scope.md",
      "utf-8",
    );
    const scope = extractDeclaredScope(content);
    expect(scope).toContain("src/auth/");
    expect(scope).toContain("src/dashboard/");
  });

  it("returns empty for spec with no scope section", () => {
    const content = readFileSync(
      "tests/fixtures/spec-no-scope.md",
      "utf-8",
    );
    const scope = extractDeclaredScope(content);
    expect(scope).toHaveLength(0);
  });

  it("extracts from GSD <files> tags", () => {
    const content =
      "Some text\n<files>src/auth/, src/api/</files>\nMore text";
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
