# spec-ci-plugin

## What This Is
A CI/CD plugin that enforces spec compliance at the PR boundary. Runs spec-linter, injection-scanner, scope checking, and acceptance criteria coverage on every pull request. Available as a GitHub Action and Gradle plugin. Tool #04 in the UnityInFlow ecosystem.

## Core Value
The spec becomes a contract enforced at every PR — not just advisory documentation that gets ignored.

## Requirements

### Active
- [ ] **GHA-01**: GitHub Action with `action.yml` and documented inputs
- [ ] **GHA-02**: Runs spec-linter on spec file, reports results
- [ ] **GHA-03**: Runs injection-scanner on spec file, reports results
- [ ] **GHA-04**: Scope checker — compares changed files vs spec-declared scope
- [ ] **GHA-05**: Criteria checker — searches test files for acceptance criteria keywords
- [ ] **GHA-06**: PR comment with structured compliance report
- [ ] **GHA-07**: Configurable `fail-on` input (errors | warnings | never)
- [ ] **GHA-08**: Published to GitHub Actions Marketplace
- [ ] **GRADLE-01**: Kotlin Gradle plugin with `specCheck` task
- [ ] **GRADLE-02**: Published to Gradle Plugin Portal

### Out of Scope
- Auto-fix capabilities — flag only, human decides
- Custom rule plugins — v0.1.0
- Monorepo support (multiple spec files) — v0.1.0

## Context
- Depends on: spec-linter (v0.0.1 shipped), injection-scanner (v0.0.1 shipped), ai-changelog (v0.0.1 shipped)
- Hybrid stack: TypeScript for GitHub Action, Kotlin for Gradle plugin
- Self-hosted CI runners (arc-runner-unityinflow + orangepi)

## Constraints
- TypeScript: strict, ES2022, ESM, tsup, vitest, no `any`
- Kotlin: 2.0+, JVM 21, Gradle Kotlin DSL, JUnit 5, no `var`/`!!`
- No Co-Authored-By in commits

## Key Decisions
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript for GH Action | GitHub Actions runtime is Node.js | — Pending |
| Kotlin for Gradle plugin | Matches ecosystem JVM tools | — Pending |
| Download binaries at runtime | Avoid bundling spec-linter/injection-scanner | — Pending |

---
*Last updated: 2026-04-02*
