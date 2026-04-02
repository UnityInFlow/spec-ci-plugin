# PR Artifacts Skill — TypeScript + Kotlin Hybrid

Produce ALL of the following before opening a PR for review.

## 1. GitHub Issue
- Verify the PR is linked to a GH issue
- Set the issue reference in the PR body: "Closes #N"

## 2. ADR (Architecture Decision Record)
Required when the PR introduces or changes:
- GitHub Action inputs/outputs contract
- Gradle plugin DSL or task configuration
- Integration approach with spec-linter/injection-scanner/ai-changelog
- PR comment format or template

Not required for: bug fixes, test additions, documentation.

File as `docs/adr/NNNN-short-title.md`.

## 3. Documentation Update
- `README.md` — if new inputs, outputs, or behavior
- `action.yml` — keep inputs documented
- Inline JSDoc (TypeScript) or KDoc (Kotlin) on public APIs

## 4. Tests
TypeScript (GitHub Action):
- [ ] `npm test` passes
- [ ] `npm run lint` passes (tsc --noEmit)
- [ ] `npm run format` passes (prettier)

Kotlin (Gradle Plugin):
- [ ] `./gradlew test` passes
- [ ] `./gradlew ktlintCheck` passes

## 5. Verification Report
- [ ] No `any` types (TypeScript), no `!!` (Kotlin)
- [ ] No secrets or tokens in code
- [ ] ADR written (or: not required because ...)
- [ ] Issue: Closes #N
- [ ] Smoke test described
