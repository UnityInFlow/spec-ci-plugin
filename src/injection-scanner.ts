import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CheckResult } from "./types.js";

/**
 * The single source of truth for which injection-scanner release this Action
 * runs. `action.yml` and the README both restate it for documentation; a test
 * pins all three together, because they had silently drifted apart
 * (`action.yml` said v0.0.2, the code said v0.0.1) and the older default built
 * a URL that could not exist.
 *
 * v0.1.0 is the first release whose detection recall is measured and
 * published: 56/60 against a corpus written from the threat model rather than
 * from the scanner's own patterns, up from 10/60 in v0.0.3. Four of the five
 * attack categories were rewritten from lists of literal phrases into
 * matrices, so a paraphrased payload is caught rather than walked past — which
 * is the difference between this Action gating a PR and rubber-stamping it.
 *
 * v0.0.3 stays the floor for `--no-suppress`, which this Action probes for and
 * passes when scanning pull requests, and was the first case-insensitive
 * release; on v0.0.2 a sentence-case payload walked past 25 of the 30 patterns.
 */
export const DEFAULT_SCANNER_VERSION = "v0.1.0";

/**
 * The oldest release this Action can consume.
 *
 * v0.0.1 published `injection-scanner-linux-x86_64` and no checksum manifest;
 * v0.0.2 switched to target triples (`injection-scanner-x86_64-unknown-linux-musl`)
 * and added `SHA256SUMS.txt`. Every URL we build for an older tag 404s, so
 * pinning one is refused loudly rather than degraded into "scanner unavailable".
 */
export const MIN_SCANNER_VERSION = "v0.0.2";

const RELEASE_BASE =
  "https://github.com/UnityInFlow/injection-scanner/releases/download";
const CHECKSUM_MANIFEST = "SHA256SUMS.txt";
const BINARY_NAME = "injection-scanner";
const DOWNLOAD_TIMEOUT_MS = 60_000;

/**
 * Cap on the scanner's JSON output.
 *
 * Node's default for `execFileSync` is 1MB, and exceeding it throws `ENOBUFS`
 * with stdout truncated — which lands in the catch below as an unparseable
 * report. The file being scanned is written by the adversary, so they choose
 * how many findings it contains: ~25 dense lines is enough to pass 1MB and turn
 * a `fail` into a skipped check. Raised far past anything a real report reaches,
 * and a report that still does not parse now fails rather than warns.
 */
const MAX_REPORT_BYTES = 128 * 1024 * 1024;

/**
 * Raised when the scanner cannot be obtained *for a reason that will not fix
 * itself* — a bad pin, or bytes that do not match the published digest. These
 * fail the check. A transient network error is different: it warns.
 */
export class ScannerSetupError extends Error {}

export interface DownloadOptions {
  /** Root of the binary cache. Defaults to the system temp directory. */
  cacheDir?: string;
  /** Injectable `fetch`, for tests. */
  fetchImpl?: typeof fetch;
}

export interface InjectionScannerOptions extends DownloadOptions {
  /**
   * Honour `injection-scanner:ignore` directives found inside the scanned file.
   *
   * Off by default. This Action scans pull requests, so the author of the
   * scanned file is the same person the scan is meant to catch — a contributor
   * can add `injection-scanner:ignore-file PI001` in the same PR that adds the
   * payload and walk straight through the gate.
   */
  allowSuppressions?: boolean;
  /** Use an already-present binary instead of downloading one. */
  binaryPath?: string;
}

interface ScannerFinding {
  severity: string;
  message: string;
  pattern_id: string;
  line: number;
}

interface ScannerReport {
  matches: ScannerFinding[];
  /**
   * Findings the scanner withheld because the scanned file told it to
   * (injection-scanner #55). Absent on releases that predate the field.
   *
   * Same shape as `matches`: `--no-suppress` moves a record between the two
   * arrays unchanged. `message` is still read defensively — the field was
   * thinner in the first cut of #55, and a pinned build may predate the fix.
   */
  suppressed?: Array<
    Partial<ScannerFinding> & {
      severity: string;
      pattern_id: string;
      line: number;
    }
  >;
  critical_count: number;
  high_count?: number;
}

function isExecError(
  err: unknown,
): err is { stdout: string; stderr: string; status: number } {
  return typeof err === "object" && err !== null && "stdout" in err;
}

/**
 * Reject anything that is not a release tag before it reaches a URL or a
 * filesystem path, and anything older than the asset-naming change.
 */
export function assertSupportedVersion(version: string): void {
  const parsed = version.match(
    /^v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/,
  );
  if (!parsed) {
    throw new ScannerSetupError(
      `injection-scanner-version "${version}" is not a release tag (expected vMAJOR.MINOR.PATCH).`,
    );
  }

  const requested = [Number(parsed[1]), Number(parsed[2]), Number(parsed[3])];
  const minimum = MIN_SCANNER_VERSION.replace(/^v/, "").split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    if (requested[i] > minimum[i]) return;
    if (requested[i] < minimum[i]) {
      throw new ScannerSetupError(
        `injection-scanner ${version} is not supported: releases before ` +
          `${MIN_SCANNER_VERSION} used a different asset naming scheme and published ` +
          `no ${CHECKSUM_MANIFEST}. Pin ${MIN_SCANNER_VERSION} or later.`,
      );
    }
  }
}

/** The release asset for a platform/arch pair, using the v0.0.2+ triple names. */
export function assetNameFor(
  platform: string = process.platform,
  arch: string = process.arch,
): string {
  const os = platform === "darwin" ? "apple-darwin" : "unknown-linux-musl";
  const cpu = arch === "arm64" ? "aarch64" : "x86_64";
  return `${BINARY_NAME}-${cpu}-${os}`;
}

/**
 * Where a given version's binary is cached.
 *
 * The version and the target triple are both in the path on purpose. The old
 * path was a bare `/tmp/injection-scanner`, and on a self-hosted runner `/tmp`
 * survives between jobs — so the first binary ever downloaded was executed
 * forever and pinning a version did nothing.
 */
export function cachePathFor(
  version: string,
  asset: string,
  cacheDir: string = tmpdir(),
): string {
  return join(cacheDir, "unityinflow-injection-scanner", version, asset);
}

/** Parse the `sha256sum`-format manifest published with each release. */
export function parseChecksums(manifest: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of manifest.split("\n")) {
    const entry = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(\S+)$/);
    if (entry) sums.set(entry[2], entry[1].toLowerCase());
  }
  return sums;
}

async function fetchAsset(
  fetchImpl: typeof fetch,
  version: string,
  name: string,
): Promise<Buffer> {
  const url = `${RELEASE_BASE}/${version}/${name}`;
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `GET ${url} returned ${response.status} ${response.statusText}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Download the scanner for this platform, verify it against the release's
 * published SHA256, and cache it under a version-keyed path.
 *
 * The bytes are hashed *before* they are made executable, and are only moved
 * into the cache path once they verify — so a failed or tampered download can
 * never be picked up by a later run as a valid cache hit.
 */
export async function downloadScanner(
  version: string,
  options: DownloadOptions = {},
): Promise<string> {
  assertSupportedVersion(version);

  const fetchImpl = options.fetchImpl ?? fetch;
  const asset = assetNameFor();
  const cached = cachePathFor(version, asset, options.cacheDir);

  const manifest = await fetchAsset(fetchImpl, version, CHECKSUM_MANIFEST).then(
    (buf) => buf.toString("utf-8"),
  );
  const expected = parseChecksums(manifest).get(asset);
  if (!expected) {
    throw new ScannerSetupError(
      `${CHECKSUM_MANIFEST} for ${version} does not list ${asset}; refusing to run an unverifiable binary.`,
    );
  }

  // A cache hit is not a reason to skip verification. The cache lives in the
  // system temp directory, which on a self-hosted runner persists between jobs
  // and is writable by anything else running there — the same property that made
  // the unversioned cache path a defect in the first place. Verifying only on
  // download would mean the integrity check holds for the first run of a given
  // version and no other. Re-hashing costs milliseconds; the manifest is a few
  // hundred bytes. Only the multi-megabyte binary is actually cached.
  if (existsSync(cached)) {
    const onDisk = createHash("sha256")
      .update(readFileSync(cached))
      .digest("hex");
    if (onDisk === expected) return cached;
    rmSync(cached, { force: true });
    throw new ScannerSetupError(
      `checksum mismatch for the cached ${asset} at ${version}: ${CHECKSUM_MANIFEST} ` +
        `says ${expected}, the cached file hashes to ${onDisk}. The cache entry has been ` +
        `discarded; refusing to execute it.`,
    );
  }

  const binary = await fetchAsset(fetchImpl, version, asset);
  const actual = createHash("sha256").update(binary).digest("hex");
  if (actual !== expected) {
    throw new ScannerSetupError(
      `checksum mismatch for ${asset} at ${version}: expected ${expected}, got ${actual}. Refusing to execute it.`,
    );
  }

  mkdirSync(dirname(cached), { recursive: true });
  const staging = `${cached}.incoming-${process.pid}`;
  try {
    writeFileSync(staging, binary);
    chmodSync(staging, 0o755);
    renameSync(staging, cached);
  } catch (error) {
    rmSync(staging, { force: true });
    throw error;
  }

  return cached;
}

const noSuppressSupport = new Map<string, boolean>();

/**
 * Whether this binary understands `--no-suppress` (injection-scanner #55).
 *
 * Asked of the binary rather than inferred from the version string, so a repo
 * pinning an older release degrades with a visible note instead of every scan
 * dying on an unrecognised argument.
 */
export function supportsNoSuppress(binaryPath: string): boolean {
  const known = noSuppressSupport.get(binaryPath);
  if (known !== undefined) return known;

  let supported = false;
  try {
    const help = execFileSync(binaryPath, ["check", "--help"], {
      encoding: "utf-8",
      timeout: 10_000,
    });
    supported = help.includes("--no-suppress");
  } catch {
    supported = false;
  }

  noSuppressSupport.set(binaryPath, supported);
  return supported;
}

function describe(finding: ScannerFinding): string {
  return `${finding.severity} :${finding.line} ${finding.message} (${finding.pattern_id})`;
}

function toDetails(report: ScannerReport | undefined): string[] {
  return report?.matches.map(describe) ?? [];
}

/**
 * Report what the scanned file told the scanner to hide.
 *
 * Only reachable when suppressions are honoured, i.e. `allow-suppressions: true`.
 * Without this the consumer prints "No injection patterns detected" for a file
 * that suppressed a CRITICAL finding — which discards precisely the visibility
 * injection-scanner #55 exists to provide.
 */
function suppressedNotes(report: ScannerReport | undefined): string[] {
  const suppressed = report?.suppressed ?? [];
  if (suppressed.length === 0) return [];
  return [
    `${suppressed.length} finding(s) suppressed by directives inside the scanned file:`,
    ...suppressed.map(
      (finding) =>
        `  suppressed ${finding.severity} :${finding.line} ` +
        `${finding.message ?? "withheld by an in-file directive"} (${finding.pattern_id})`,
    ),
  ];
}

export async function runInjectionScanner(
  specFile: string,
  version: string = DEFAULT_SCANNER_VERSION,
  options: InjectionScannerOptions = {},
): Promise<CheckResult> {
  let binaryPath: string;
  try {
    binaryPath =
      options.binaryPath ?? (await downloadScanner(version, options));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown";
    return {
      name: "Security Scan",
      status: error instanceof ScannerSetupError ? "fail" : "warn",
      details: [`Could not run injection-scanner: ${message}`],
    };
  }

  const notes: string[] = [];
  const args = ["check", specFile, "--format", "json"];

  if (!options.allowSuppressions) {
    if (supportsNoSuppress(binaryPath)) {
      args.push("--no-suppress");
    } else {
      notes.push(
        `injection-scanner ${version} has no --no-suppress; in-file suppression ` +
          `directives in ${specFile} were honoured. A contributor can disarm this ` +
          `check from inside the pull request — pin a newer scanner to close that gap.`,
      );
    }
  }

  try {
    const output = execFileSync(binaryPath, args, {
      encoding: "utf-8",
      timeout: 10_000,
      maxBuffer: MAX_REPORT_BYTES,
    });

    const reports = JSON.parse(output) as ScannerReport[];
    const report = reports[0];

    const withheld = suppressedNotes(report);

    if (!report || report.matches.length === 0) {
      return {
        name: "Security Scan",
        status: "pass",
        details:
          withheld.length > 0
            ? [...notes, ...withheld]
            : [...notes, "No injection patterns detected"],
      };
    }

    return {
      name: "Security Scan",
      status: report.critical_count > 0 ? "fail" : "warn",
      details: [...notes, ...toDetails(report), ...withheld],
    };
  } catch (error: unknown) {
    if (isExecError(error) && error.stdout) {
      try {
        const reports = JSON.parse(error.stdout) as ScannerReport[];
        const report = reports[0];

        return {
          name: "Security Scan",
          status: (report?.critical_count ?? 0) > 0 ? "fail" : "warn",
          details: [...notes, ...toDetails(report), ...suppressedNotes(report)],
        };
      } catch {
        // Not JSON on stdout — fall through to the failure below.
      }
    }

    const message = error instanceof Error ? error.message : "unknown";

    // The scanner was verified and present, and still did not produce a report
    // we can read. That is not the same as "the scanner was unavailable": the
    // file under scan is adversary-controlled, so an unanswered scan must not
    // read as a passing one. Acquisition failures are graded above, where a
    // genuine outage still warns rather than blocking every pull request.
    return {
      name: "Security Scan",
      status: "fail",
      details: [
        ...notes,
        `injection-scanner produced no usable report: ${message}. Treating this as a ` +
          `failure — the scanned file is untrusted, so an unanswered scan is not a pass.`,
      ],
    };
  }
}
