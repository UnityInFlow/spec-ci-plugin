# Phase 1 Context: GitHub Action

**Phase:** 1
**Date:** 2026-04-02
**Status:** Ready for planning

## Decisions

### GHA-02/03: Tool integration — hybrid approach
spec-linter via `npx @unityinflow/spec-linter` (shell out, works today). injection-scanner via binary download from GitHub Releases at runtime. Each tool used the natural way for its stack. No programmatic API changes needed.

### GHA-04: Scope checker — warn on missing scope
If the spec file has no declared scope section, emit a warning: "No scope declared in spec file. Consider adding a '## Scope' section." Non-blocking. Does not fail the check.

### GHA-05: Criteria checker — keyword + test descriptions
Parse test files for `describe("...")`/`it("...")`/`test("...")` blocks. Extract test names. Keyword-match acceptance criteria against those test descriptions. Falls back to file-existence check if no test descriptions match.

### GHA-06: PR comment — single comment, updated on each push
Find existing bot comment and edit it. No new comment per push. Clean PR timeline. Uses a hidden marker comment to identify the bot's comment for updates.

### GHA-08: Marketplace — direct repo reference first
Ship as `uses: UnityInFlow/spec-ci-plugin@v1` in Phase 1. Add GitHub Actions Marketplace listing in Phase 2 alongside Gradle plugin. No delay for marketplace approval.

## Deferred Ideas

- GitHub Actions Marketplace listing — Phase 2
- Programmatic API for spec-linter (import instead of shell out) — depends on spec-linter issue #12
- LLM-powered criteria matching — v0.1.0
- Custom check plugins — v0.1.0

## Downstream Notes

- **Planner:** Two tool integrations: npx for spec-linter, binary download for injection-scanner
- **Planner:** Scope checker is non-blocking when scope section is missing
- **Planner:** Criteria checker parses test description strings, not just file existence
- **Planner:** PR comment uses edit-in-place pattern with hidden marker
- **Planner:** No marketplace publishing in Phase 1

---
*Created: 2026-04-02 after discuss-phase 1*
