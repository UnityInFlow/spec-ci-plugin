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
