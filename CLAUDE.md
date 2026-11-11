# spec-ci-plugin — Spec Compliance CI/CD Plugin

## Project Overview

**Tool 04** in the [UnityInFlow](https://github.com/UnityInFlow) ecosystem.

CI/CD plugin that enforces spec compliance at the PR boundary. Runs spec-linter, injection-scanner, scope checking, and acceptance criteria coverage on every pull request. Available as a GitHub Action and Gradle plugin.

**Phase:** 2 | **Stack:** TypeScript + Kotlin | **Distribution:** GitHub Actions Marketplace + Gradle Plugin Portal

## Status

Ready to build — all dependencies shipped: spec-linter (v0.0.1), ai-changelog (v0.0.1), injection-scanner (v0.0.1).

## Reference Documents

- `04-spec-ci-plugin.md` — Feature spec, GitHub Action usage, Gradle plugin usage, validation pipeline, implementation todos (Weeks 7-10)
- `claude-code-harness-engineering-guide-v2.md` — Harness engineering patterns and best practices

Read these before making architectural or scope decisions.

## Tooling

| Tool | Status | Usage |
|---|---|---|
| **GSD** | Installed (global) | `/gsd:new-project` to scaffold when ready. `/gsd:plan-phase` and `/gsd:execute-phase` for structured development. |
| **RTK** | Active (v0.34.2) | Automatic via hooks. Compresses tsc, git, npm output. ~80% token savings. |
| **Superpowers** | Active (v5.0.5) | Auto-triggers brainstorming, TDD, planning, code review, debugging skills. |

## Constraints

### TypeScript — GitHub Action (inherited from ecosystem CLAUDE.md)
- Node.js >=18, ESM modules (`"type": "module"` in package.json)
- Build with `tsup`, test with `vitest`
- Strict TypeScript: `"strict": true` in tsconfig.json
- Target `ES2022`
- Prefer named exports over default exports
- No `any` types — use `unknown` and narrow properly
- File naming: `kebab-case.ts`
- `const` everywhere, `interface` over `type` for object shapes

### Kotlin — Gradle Plugin (inherited from ecosystem CLAUDE.md)
- Kotlin 2.0+, JVM target 21
- Gradle (Kotlin DSL only — never Groovy)
- Test with JUnit 5 + Kotest matchers
- No `var`, no `!!` without comment
- `ktlint` before every commit
- Group: `dev.unityinflow`

### General
- Test coverage >80% on core logic before release
- No secrets committed — all credentials via environment variables

## Acceptance Criteria — v0.0.1

- [ ] GitHub Action: `action.yml` with all inputs documented
- [ ] Runs spec-linter on spec file and reports results
- [ ] Runs injection-scanner on spec file and reports results
- [ ] Scope checker: compares changed files vs spec-declared scope
- [ ] Criteria checker: searches test files for acceptance criteria keywords
- [ ] PR comment with structured compliance report
- [ ] Configurable `fail-on` input: errors | warnings | never
- [ ] Gradle plugin: `specCheck` task with same validation logic
- [ ] Published to GitHub Actions Marketplace
- [ ] Published to Gradle Plugin Portal

## Development Workflow

When ready to build:

1. `/gsd:new-project` — describe spec-ci-plugin, feed existing spec
2. `/gsd:discuss-phase 1` — lock in decisions for Weeks 7-8 (GitHub Action: spec-linter + injection-scanner integration, scope checker, criteria checker, PR comments)
3. `/gsd:plan-phase 1` — atomic task plans with file paths
4. `/gsd:execute-phase 1` — parallel execution with fresh context windows
5. `/gsd:discuss-phase 2` — lock in decisions for Weeks 9-10 (Gradle plugin, marketplace publishing)
6. `/gsd:plan-phase 2` — atomic task plans
7. `/gsd:execute-phase 2` — build and ship

Superpowers skills (TDD, code review, debugging) activate automatically during execution.

## Key Dependencies (for reference, not installed yet)

- `@octokit/rest` — GitHub API (PR comments, diff)
- `spec-linter` — structural validation (Tool 01)
- `injection-scanner` — security scanning (Tool 03)
- `ai-changelog` — changelog generation on merge (Tool 02)

---

## CI / Runners

This repo is public. The org runner group does not allow public repositories
(`allows_public_repositories: false`), so CI runs on GitHub-hosted runners (free for public repos):

```yaml
runs-on: ubuntu-24.04
```

Use the fixed image label, not `ubuntu-latest`. The org requires every `uses:` to be pinned to a full
commit SHA with a `# vX.Y.Z` comment, and only allow-listed actions run. The former self-hosted labels
`arc-runner-unityinflow` and `orangepi` have no runner any more; do not use them.

---

## Do Not

- Do not start implementation until spec-linter, ai-changelog, and injection-scanner are shipped (DONE)
- Do not use `any` in TypeScript
- Do not use `var` or `!!` in Kotlin without a comment
- Do not commit secrets or API keys
- Do not skip writing tests
- Do not inline the reference docs into this file — read them by path
