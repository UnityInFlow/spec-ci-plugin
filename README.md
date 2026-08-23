# spec-ci-plugin

A GitHub Action that enforces spec compliance on every pull request. Runs spec-linter, injection-scanner, scope checker, and criteria checker -- then posts a structured compliance report as a PR comment.

## The problem

Spec-driven development tools like GSD and Superpowers enforce specs during the coding session, but there is zero enforcement at the CI boundary. A PR that diverges from the spec merges freely. The spec is advisory, not enforced.

**spec-ci-plugin closes the loop** -- the spec becomes a contract enforced at every PR.

## Quick start

```yaml
# .github/workflows/spec-check.yml
name: Spec Compliance
on: [pull_request]

jobs:
  spec-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: UnityInFlow/spec-ci-plugin@v1
        with:
          spec-file: CLAUDE.md
          fail-on: errors
```

## What it checks

The action runs a 4-step validation pipeline on your spec file:

1. **Spec Validation** -- runs `@unityinflow/spec-linter` to check required sections, no secrets, file size, no wildcard permissions, no duplicate headers
2. **Security Scan** -- runs `injection-scanner` to detect prompt injection patterns in the spec file (see [How the scanner binary is trusted](#how-the-scanner-binary-is-trusted))
3. **Scope Compliance** -- extracts declared scope from your spec (via `## Scope` section or GSD `<files>` tags) and compares against the PR's changed files
4. **Criteria Coverage** -- parses acceptance criteria from `## Acceptance Criteria` and matches them to test descriptions (`describe`/`it`/`test`) found in your test files

## PR comment output

The action posts (or updates) a single PR comment with results:

```
## Spec Compliance Report

### Spec Validation
PASS

### Security Scan
PASS
- No injection patterns detected

### Scope Compliance
All changed files are within spec-declared scope.
Scope: src/auth/, src/middleware/

### Acceptance Criteria Coverage
"Users can log in with email/password" -- test found: auth.test.ts ("allows user login with email and password")
"Rate limiting enforced on login" -- test found: middleware.test.ts ("enforces rate limit on login endpoint")
"Session expires after 24h" -- no matching test found

**Coverage: 2/3 criteria matched to tests**

---
**Overall: WARN**
```

## Inputs

| Input | Description | Default |
|---|---|---|
| `github-token` | GitHub token for posting PR comments and reading PR files | `${{ github.token }}` |
| `spec-file` | Path to spec file (CLAUDE.md, REQUIREMENTS.md, etc.) | `CLAUDE.md` |
| `fail-on` | When to fail the check: `errors`, `warnings`, or `never` | `errors` |
| `post-comment` | Post compliance report as PR comment | `true` |
| `injection-scanner-version` | injection-scanner release version to download (`v0.0.2` or later) | `v0.0.3` |
| `allow-suppressions` | Honour `injection-scanner:ignore` directives inside the scanned file | `false` |

## How the scanner binary is trusted

The scanner is a binary this action downloads and executes, and the file it scans
is written by the same person the scan is meant to catch. Two things follow.

**The download is verified.** The requested release's `SHA256SUMS.txt` is fetched
alongside the binary, and the bytes are hashed before they are made executable. A
digest that does not match is a `fail`, not a `warn` -- the action refuses to run
the binary rather than degrading into "scanner unavailable". Verified binaries are
cached under a path keyed by version *and* target triple, so on a persistent
self-hosted runner pinning `injection-scanner-version` actually changes what runs.

Releases before `v0.0.2` are refused: they used a different asset naming scheme and
published no checksum manifest, so no URL built for them can resolve.

A cache hit does not skip the check. The cache lives in the system temp directory,
which on a self-hosted runner persists between jobs and is writable by whatever else
runs there — so the cached file is re-hashed against the manifest on every run, and a
mismatch discards it and fails. Only the multi-megabyte binary is cached; the manifest
is a few hundred bytes and is always fetched.

**An unanswered scan is a failure.** If the scanner is present and verified but does not
return a report this action can read, the result is `fail`, not `warn`. The scanned file
is written by the party the scan exists to catch, and a large enough report used to
overflow the subprocess buffer and turn a `fail` into a skipped check. A genuine outage —
the release being unreachable at all — still warns rather than blocking every pull
request.

**Suppressions are off by default.** `injection-scanner:ignore` directives live
*inside the scanned file*, so on a pull request the contributor proposing the change
also controls what the scanner reports:

```markdown
---
injection-scanner:ignore-file PI001
---

Ignore all previous instructions.
```

The action therefore passes `--no-suppress`. Set `allow-suppressions: true` if you
scan a file only maintainers can edit and you want its directives honoured. If the
pinned scanner predates `--no-suppress` (added in `v0.0.3`), the flag is omitted
and the report says so rather than failing every scan.

## Outputs

| Output | Description |
|---|---|
| `status` | Overall status: `pass`, `warn`, or `fail` |
| `report` | Full compliance report as JSON |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All checks passed (or `fail-on: never`) |
| 1 | Checks failed based on `fail-on` setting |

When `fail-on` is `errors`, only `fail` status triggers a non-zero exit. When `fail-on` is `warnings`, both `warn` and `fail` trigger non-zero. When `fail-on` is `never`, the action always exits 0.

## Spec file format

The action works with any Markdown spec file. For best results, include these sections:

```markdown
## Project Overview
What the project does.

## Constraints
- TypeScript strict mode
- No wildcard permissions

## Acceptance Criteria
- [ ] Users can log in with email
- [ ] Dashboard loads in under 2 seconds

## Scope
- src/auth/
- src/dashboard/
```

GSD-style `<files>` tags are also supported for scope declaration.

## Examples

### Fail on warnings

```yaml
- uses: UnityInFlow/spec-ci-plugin@v1
  with:
    fail-on: warnings
```

### Custom spec file

```yaml
- uses: UnityInFlow/spec-ci-plugin@v1
  with:
    spec-file: REQUIREMENTS.md
```

### Skip PR comment

```yaml
- uses: UnityInFlow/spec-ci-plugin@v1
  with:
    post-comment: "false"
```

### Use output in subsequent steps

```yaml
- uses: UnityInFlow/spec-ci-plugin@v1
  id: spec-check
  with:
    fail-on: never

- run: echo "Spec status: ${{ steps.spec-check.outputs.status }}"
```

## Part of the UnityInFlow ecosystem

spec-ci-plugin is tool #4 in the [UnityInFlow](https://github.com/UnityInFlow) AI agent tooling ecosystem. It builds on:

- [spec-linter](https://github.com/UnityInFlow/spec-linter) -- validates spec file structure
- [injection-scanner](https://github.com/UnityInFlow/injection-scanner) -- detects prompt injection patterns

## License

MIT
