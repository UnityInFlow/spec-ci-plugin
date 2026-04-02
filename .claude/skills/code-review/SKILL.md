# Code Review Skill — TypeScript + Kotlin Hybrid

## TypeScript Checklist (GitHub Action)
- [ ] Strict TypeScript — no `any`, proper narrowing from `unknown`
- [ ] Named exports only — no `export default`
- [ ] ESM imports with `.js` extensions
- [ ] `const` everywhere
- [ ] `action.yml` inputs match code expectations
- [ ] GitHub API calls use `@octokit/rest` properly
- [ ] Error handling for missing env vars (GITHUB_TOKEN, etc.)

## Kotlin Checklist (Gradle Plugin)
- [ ] No `var` — always `val`
- [ ] No `!!` without justifying comment
- [ ] Kotlin DSL for task configuration
- [ ] KDoc on public classes and functions
- [ ] JUnit 5 tests with Kotest matchers

## Both
- [ ] No secrets in code
- [ ] No debug output left in
- [ ] Functions under 30 lines
- [ ] Edge cases tested (empty spec, missing sections)

## Output Format
Return: summary, blocking issues (must fix), suggestions (nice to have).
Cite each issue as `filepath:line — description`.
