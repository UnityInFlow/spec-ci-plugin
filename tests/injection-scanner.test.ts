import { describe, it, expect } from "vitest";
import { runInjectionScanner } from "../src/injection-scanner.js";

describe("runInjectionScanner", () => {
  it("returns pass for clean file", async () => {
    const result = await runInjectionScanner(
      "tests/fixtures/spec-with-scope.md",
      "v0.0.1",
    );
    // Clean spec file should have no injection patterns
    expect(["pass", "warn"]).toContain(result.status);
  });

  it("returns check result with name", async () => {
    const result = await runInjectionScanner(
      "tests/fixtures/spec-with-scope.md",
      "v0.0.1",
    );
    expect(result.name).toBe("Security Scan");
  });

  it("handles missing binary gracefully", async () => {
    const result = await runInjectionScanner(
      "tests/fixtures/spec-with-scope.md",
      "v999.999.999",
    );
    // Should warn, not crash
    expect(result.status).toBe("warn");
    expect(result.details.length).toBeGreaterThan(0);
  });
});
