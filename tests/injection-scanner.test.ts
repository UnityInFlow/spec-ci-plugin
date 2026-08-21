import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  DEFAULT_SCANNER_VERSION,
  MIN_SCANNER_VERSION,
  assetNameFor,
  assertSupportedVersion,
  cachePathFor,
  downloadScanner,
  parseChecksums,
  runInjectionScanner,
} from "../src/injection-scanner.js";

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "spec-ci-test-"));
}

/**
 * A stand-in for the real scanner binary. `emitsNoSuppressInHelp` models the
 * pre-#55 releases, whose `check --help` has no `--no-suppress` line.
 */
function fakeScanner(
  dir: string,
  opts: {
    emitsNoSuppressInHelp?: boolean;
    stdout?: string;
    exitCode?: number;
  } = {},
): { path: string; argsFile: string } {
  const argsFile = join(dir, "args.txt");
  const helpLine = opts.emitsNoSuppressInHelp
    ? "      --no-suppress  Ignore all in-file suppression directives"
    : "      --strict-patterns  Fail on invalid patterns";
  const stdout =
    opts.stdout ??
    JSON.stringify([
      {
        file: "spec.md",
        matches: [],
        critical_count: 0,
        high_count: 0,
      },
    ]);
  const path = join(dir, "fake-scanner");
  writeFileSync(
    path,
    [
      "#!/bin/sh",
      'if [ "$2" = "--help" ]; then',
      '  echo "Usage: injection-scanner check <PATH>"',
      `  echo '${helpLine}'`,
      "  exit 0",
      "fi",
      `printf '%s\\n' "$*" > "${argsFile}"`,
      `cat <<'JSONEOF'`,
      stdout,
      "JSONEOF",
      `exit ${opts.exitCode ?? 0}`,
    ].join("\n"),
    { mode: 0o755 },
  );
  return { path, argsFile };
}

describe("version defaults (#43 defect 3)", () => {
  it("action.yml declares the same default the code uses", () => {
    const actionYml = readFileSync("action.yml", "utf-8");
    const match = actionYml.match(
      /injection-scanner-version:[\s\S]*?default:\s*"([^"]+)"/,
    );
    expect(match?.[1]).toBe(DEFAULT_SCANNER_VERSION);
  });

  it("README documents the same default", () => {
    const readme = readFileSync("README.md", "utf-8");
    const match = readme.match(
      /\|\s*`injection-scanner-version`\s*\|[^|]*\|\s*`([^`]+)`\s*\|/,
    );
    expect(match?.[1]).toBe(DEFAULT_SCANNER_VERSION);
  });

  it("rejects versions older than the asset-naming change instead of building a 404 URL", () => {
    expect(() => assertSupportedVersion("v0.0.1")).toThrow(/v0\.0\.1/);
    expect(() => assertSupportedVersion("v0.0.1")).toThrow(
      new RegExp(MIN_SCANNER_VERSION.replace(/\./g, "\\.")),
    );
  });

  it("rejects a version that is not a release tag", () => {
    expect(() => assertSupportedVersion("main")).toThrow();
    expect(() => assertSupportedVersion("$(id)")).toThrow();
  });

  it("accepts the current default and anything newer", () => {
    expect(() => assertSupportedVersion(DEFAULT_SCANNER_VERSION)).not.toThrow();
    expect(() => assertSupportedVersion("v0.1.0")).not.toThrow();
    expect(() => assertSupportedVersion("v1.2.3-rc.1")).not.toThrow();
  });
});

describe("cache path (#43 defect 2)", () => {
  it("keys the cached binary by version and target triple", () => {
    const a = cachePathFor("v0.0.2", assetNameFor("linux", "x64"), "/cache");
    const b = cachePathFor("v0.0.3", assetNameFor("linux", "x64"), "/cache");
    expect(a).not.toBe(b);
    expect(a).toContain("v0.0.2");
    expect(b).toContain("v0.0.3");
  });

  it("keys separately per target triple", () => {
    const linux = cachePathFor(
      "v0.0.2",
      assetNameFor("linux", "x64"),
      "/cache",
    );
    const mac = cachePathFor(
      "v0.0.2",
      assetNameFor("darwin", "arm64"),
      "/cache",
    );
    expect(linux).not.toBe(mac);
  });

  it("maps platform and arch to the published asset names", () => {
    expect(assetNameFor("linux", "x64")).toBe(
      "injection-scanner-x86_64-unknown-linux-musl",
    );
    expect(assetNameFor("linux", "arm64")).toBe(
      "injection-scanner-aarch64-unknown-linux-musl",
    );
    expect(assetNameFor("darwin", "arm64")).toBe(
      "injection-scanner-aarch64-apple-darwin",
    );
  });
});

describe("checksum verification (#43 defect 1)", () => {
  it("parses the sha256sum-format manifest the release publishes", () => {
    const sums = parseChecksums(
      [
        "1146a5730dec6608ae618a7eda9e2afeb91c54a809a2a247af22fef26215044e  injection-scanner-aarch64-apple-darwin",
        "5ede5bb01abaee100eee87b2f51bcf55d82cc9dd36547294a645fed3c5e6ed7f  injection-scanner-x86_64-unknown-linux-musl",
        "",
      ].join("\n"),
    );
    expect(sums.get("injection-scanner-x86_64-unknown-linux-musl")).toBe(
      "5ede5bb01abaee100eee87b2f51bcf55d82cc9dd36547294a645fed3c5e6ed7f",
    );
    expect(sums.size).toBe(2);
  });

  it("writes the binary to the cache when the digest matches", async () => {
    const dir = scratch();
    const body = "#!/bin/sh\nexit 0\n";
    const asset = assetNameFor();
    const digest = createHash("sha256").update(body).digest("hex");

    const path = await downloadScanner("v0.0.2", {
      cacheDir: dir,
      fetchImpl: fakeFetch({
        [asset]: body,
        "SHA256SUMS.txt": `${digest}  ${asset}\n`,
      }),
    });

    expect(path).toContain("v0.0.2");
    expect(readFileSync(path, "utf-8")).toBe(body);
  });

  it("refuses to install a binary whose digest does not match", async () => {
    const dir = scratch();
    const asset = assetNameFor();
    const wrong = "0".repeat(64);

    await expect(
      downloadScanner("v0.0.2", {
        cacheDir: dir,
        fetchImpl: fakeFetch({
          [asset]: "tampered",
          "SHA256SUMS.txt": `${wrong}  ${asset}\n`,
        }),
      }),
    ).rejects.toThrow(/checksum/i);
  });

  it("refuses to install when the manifest does not list this asset", async () => {
    const dir = scratch();
    await expect(
      downloadScanner("v0.0.2", {
        cacheDir: dir,
        fetchImpl: fakeFetch({
          [assetNameFor()]: "whatever",
          "SHA256SUMS.txt": "deadbeef  some-other-asset\n",
        }),
      }),
    ).rejects.toThrow(/SHA256SUMS/);
  });

  it("reports a tampered download as a failure, not a warning", async () => {
    const dir = scratch();
    const asset = assetNameFor();
    const result = await runInjectionScanner(
      "tests/fixtures/spec-with-scope.md",
      "v0.0.2",
      {
        cacheDir: dir,
        fetchImpl: fakeFetch({
          [asset]: "tampered",
          "SHA256SUMS.txt": `${"0".repeat(64)}  ${asset}\n`,
        }),
      },
    );
    expect(result.status).toBe("fail");
    expect(result.details.join(" ")).toMatch(/checksum/i);
  });

  it("reports an unreachable release as a warning, not a silent pass", async () => {
    const result = await runInjectionScanner(
      "tests/fixtures/spec-with-scope.md",
      "v0.0.2",
      {
        cacheDir: scratch(),
        fetchImpl: async () => {
          throw new Error("getaddrinfo ENOTFOUND github.com");
        },
      },
    );
    expect(result.status).toBe("warn");
    expect(result.details.length).toBeGreaterThan(0);
  });
});

describe("suppression trust boundary (#56)", () => {
  let dir: string;
  beforeEach(() => {
    dir = scratch();
  });

  it("passes --no-suppress by default", async () => {
    const { path, argsFile } = fakeScanner(dir, {
      emitsNoSuppressInHelp: true,
    });
    await runInjectionScanner("spec.md", DEFAULT_SCANNER_VERSION, {
      binaryPath: path,
    });
    expect(readFileSync(argsFile, "utf-8")).toContain("--no-suppress");
  });

  it("omits --no-suppress when the caller opts into suppressions", async () => {
    const { path, argsFile } = fakeScanner(dir, {
      emitsNoSuppressInHelp: true,
    });
    await runInjectionScanner("spec.md", DEFAULT_SCANNER_VERSION, {
      binaryPath: path,
      allowSuppressions: true,
    });
    expect(readFileSync(argsFile, "utf-8")).not.toContain("--no-suppress");
  });

  it("does not pass --no-suppress to a scanner that predates the flag", async () => {
    const { path, argsFile } = fakeScanner(dir, {
      emitsNoSuppressInHelp: false,
    });
    const result = await runInjectionScanner(
      "spec.md",
      DEFAULT_SCANNER_VERSION,
      {
        binaryPath: path,
      },
    );
    expect(readFileSync(argsFile, "utf-8")).not.toContain("--no-suppress");
    expect(result.details.join(" ")).toMatch(/suppression/i);
  });
});

describe("report handling", () => {
  it("passes a clean scan through", async () => {
    const dir = scratch();
    const { path } = fakeScanner(dir, { emitsNoSuppressInHelp: true });
    const result = await runInjectionScanner(
      "spec.md",
      DEFAULT_SCANNER_VERSION,
      {
        binaryPath: path,
      },
    );
    expect(result.name).toBe("Security Scan");
    expect(result.status).toBe("pass");
  });

  it("fails on a critical finding and warns on a non-critical one", async () => {
    const critical = fakeScanner(mkdirTemp("crit"), {
      emitsNoSuppressInHelp: true,
      exitCode: 1,
      stdout: JSON.stringify([
        {
          file: "spec.md",
          matches: [
            {
              severity: "CRITICAL",
              message: "Role override",
              pattern_id: "PI001",
              line: 4,
            },
          ],
          critical_count: 1,
          high_count: 0,
        },
      ]),
    });
    const failResult = await runInjectionScanner(
      "spec.md",
      DEFAULT_SCANNER_VERSION,
      {
        binaryPath: critical.path,
      },
    );
    expect(failResult.status).toBe("fail");
    expect(failResult.details.join(" ")).toContain("PI001");

    const medium = fakeScanner(mkdirTemp("med"), {
      emitsNoSuppressInHelp: true,
      exitCode: 1,
      stdout: JSON.stringify([
        {
          file: "spec.md",
          matches: [
            {
              severity: "MEDIUM",
              message: "Suspicious",
              pattern_id: "PI020",
              line: 9,
            },
          ],
          critical_count: 0,
          high_count: 0,
        },
      ]),
    });
    const warnResult = await runInjectionScanner(
      "spec.md",
      DEFAULT_SCANNER_VERSION,
      {
        binaryPath: medium.path,
      },
    );
    expect(warnResult.status).toBe("warn");
  });
});

describe("cached binaries are re-verified, not trusted", () => {
  it("refuses a cache entry that does not match the published manifest", async () => {
    const dir = scratch();
    const asset = assetNameFor();
    const cached = cachePathFor("v0.0.2", asset, dir);
    mkdirSync(dirname(cached), { recursive: true });
    writeFileSync(cached, "#!/bin/sh\nexit 0\n", { mode: 0o755 });

    const genuine = "#!/bin/sh\necho genuine\n";
    const digest = createHash("sha256").update(genuine).digest("hex");
    const result = await runInjectionScanner("spec.md", "v0.0.2", {
      cacheDir: dir,
      fetchImpl: fakeFetch({
        [asset]: genuine,
        "SHA256SUMS.txt": `${digest}  ${asset}\n`,
      }),
    });

    expect(result.status).toBe("fail");
    expect(result.details.join(" ")).toMatch(/checksum/i);
    expect(existsSync(cached)).toBe(false);
  });

  it("reuses a verified cache entry without re-downloading the binary", async () => {
    const dir = scratch();
    const asset = assetNameFor();
    const body = "#!/bin/sh\nexit 0\n";
    const digest = createHash("sha256").update(body).digest("hex");
    const manifest = `${digest}  ${asset}\n`;

    const first = countingFetch({ [asset]: body, "SHA256SUMS.txt": manifest });
    await downloadScanner("v0.0.2", { cacheDir: dir, fetchImpl: first.impl });
    expect(first.requested).toContain(asset);

    const second = countingFetch({ [asset]: body, "SHA256SUMS.txt": manifest });
    const path = await downloadScanner("v0.0.2", {
      cacheDir: dir,
      fetchImpl: second.impl,
    });
    expect(path).toBe(cachePathFor("v0.0.2", asset, dir));
    expect(second.requested).toEqual(["SHA256SUMS.txt"]);
  });
});

describe("an unanswered scan is a failure, not a warning", () => {
  it("fails when the scanner produces output it cannot parse", async () => {
    const dir = scratch();
    const { path } = fakeScanner(dir, {
      emitsNoSuppressInHelp: true,
      stdout: "not json at all",
      exitCode: 1,
    });
    const result = await runInjectionScanner(
      "spec.md",
      DEFAULT_SCANNER_VERSION,
      {
        binaryPath: path,
      },
    );
    expect(result.status).toBe("fail");
  });

  it("parses a report far larger than Node's default pipe buffer", async () => {
    const dir = scratch();
    const matches = Array.from({ length: 20_000 }, (_, line) => ({
      severity: "CRITICAL",
      message: "Attempts to override agent instructions",
      pattern_id: "PI001",
      line,
    }));
    const { path } = fakeScanner(dir, {
      emitsNoSuppressInHelp: true,
      exitCode: 1,
      stdout: JSON.stringify([
        {
          file: "spec.md",
          matches,
          critical_count: matches.length,
          high_count: 0,
        },
      ]),
    });
    const result = await runInjectionScanner(
      "spec.md",
      DEFAULT_SCANNER_VERSION,
      {
        binaryPath: path,
      },
    );
    expect(result.status).toBe("fail");
    expect(result.details.length).toBeGreaterThan(19_000);
  });
});

describe("suppressed findings stay visible in the report", () => {
  it("does not claim a clean scan when findings were suppressed in-file", async () => {
    const dir = scratch();
    const { path } = fakeScanner(dir, {
      emitsNoSuppressInHelp: true,
      stdout: JSON.stringify([
        {
          file: "spec.md",
          matches: [],
          // The real shape injection-scanner #55 emits: thinner than a
          // reported match, with no `message`, `pattern_name` or `remediation`.
          suppressed: [
            {
              pattern_id: "PI001",
              severity: "CRITICAL",
              file: "spec.md",
              line: 6,
            },
          ],
          critical_count: 0,
          high_count: 0,
        },
      ]),
    });
    const result = await runInjectionScanner(
      "spec.md",
      DEFAULT_SCANNER_VERSION,
      {
        binaryPath: path,
        allowSuppressions: true,
      },
    );
    const text = result.details.join(" ");
    expect(text).not.toMatch(/No injection patterns detected/);
    expect(text).toMatch(/suppress/i);
    expect(text).toContain("PI001");
    expect(text).not.toContain("undefined");
  });
});

function mkdirTemp(name: string): string {
  const dir = join(scratch(), name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Records which asset basenames a run actually requested. */
function countingFetch(assets: Record<string, string>): {
  impl: typeof fetch;
  requested: string[];
} {
  const requested: string[] = [];
  const inner = fakeFetch(assets);
  const impl = (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    requested.push(url.split("/").pop() ?? "");
    return inner(input as string, init);
  }) as unknown as typeof fetch;
  return { impl, requested };
}

/** Minimal `fetch` stand-in serving a fixed set of release assets by basename. */
function fakeFetch(assets: Record<string, string>): typeof fetch {
  return (async (input: string | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const name = url.split("/").pop() ?? "";
    const body = assets[name];
    if (body === undefined) {
      return { ok: false, status: 404, statusText: "Not Found" } as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => body,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    } as Response;
  }) as unknown as typeof fetch;
}
