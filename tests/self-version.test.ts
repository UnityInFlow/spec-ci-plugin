import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SPEC_LINTER_VERSION } from "../src/spec-linter.js";

/**
 * The linter is the one dependency this Action fetches and executes at run
 * time without a checksum, so the pin is load-bearing and the README must
 * tell the truth about it.
 */
describe("the pinned spec-linter version", () => {
  const readme = readFileSync("README.md", "utf-8");

  it("is an exact release, not a range or a tag", () => {
    expect(SPEC_LINTER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("is the version the README says is run", () => {
    expect(readme).toContain(`@unityinflow/spec-linter@${SPEC_LINTER_VERSION}`);
  });
});

/**
 * The Action's own version, as distinct from the scanner version it downloads.
 *
 * Those two had a test pinning them together; this one had nothing. The README
 * told users to pin `@v0.0.1` in five places — a tag from 2026-04-02, months
 * before the Marketplace release, before checksum verification of the
 * downloaded binary and before `--no-suppress`. Meanwhile the published major
 * was `v1` and `package.json` still said `0.0.1`. Three different answers to
 * "what version is this", none of them agreeing.
 */
describe("the Action's own version", () => {
  const readme = readFileSync("README.md", "utf-8");
  const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

  it("README pins the moving major tag, never an immutable point release", () => {
    const pins = [...readme.matchAll(/UnityInFlow\/spec-ci-plugin@(\S+)/g)].map(
      (m) => m[1].replace(/[`'")]+$/, ""),
    );

    expect(pins.length).toBeGreaterThan(0);

    // `@v1` moves forward as releases are cut; `@vX.Y.Z` freezes a consumer on
    // whatever that commit contained, which is how the docs came to recommend a
    // build with no checksum verification.
    const frozen = pins.filter((p) => !/^v\d+$/.test(p));
    expect(
      frozen,
      `README recommends ${frozen.join(", ")}. Copy-paste examples must use the moving major tag ` +
        `(@v1) so a reader does not pin a release that predates the current one.`,
    ).toEqual([]);
  });

  it("package.json's major matches the major the README tells people to use", () => {
    const readmeMajor = readme.match(/UnityInFlow\/spec-ci-plugin@v(\d+)/)?.[1];
    const pkgMajor = String(pkg.version).split(".")[0];

    expect(readmeMajor).toBeDefined();
    expect(
      pkgMajor,
      `package.json is ${pkg.version} but the README points at v${readmeMajor}. ` +
        `The manifest version is what a release is cut from; letting it drift from the ` +
        `published major is how this repo ended up shipping v1.0.0 from a 0.0.1 manifest.`,
    ).toBe(readmeMajor);
  });
});
