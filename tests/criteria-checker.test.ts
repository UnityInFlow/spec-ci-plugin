import { describe, it, expect } from "vitest";
import {
  extractCriteria,
  extractTestDescriptions,
  matchCriteria,
} from "../src/criteria-checker.js";

describe("extractCriteria", () => {
  it("extracts acceptance criteria from spec", () => {
    const content =
      "## Acceptance Criteria\n- [ ] Users can log in\n- [ ] Dashboard loads fast\n\n## Other";
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
      [
        "tests/auth.test.ts",
        ["allows user login with email and password"],
      ],
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
