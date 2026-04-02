# Tool 04: `spec-ci-plugin`
## Spec Compliance CI/CD Plugin — Deep Dive

> **Phase:** 2 · **Effort:** 3/10 · **Impact:** 8/10 · **Stack:** TypeScript + Kotlin  
> **Repo name:** `spec-ci-plugin` · **Distribution:** GitHub Actions Marketplace + Gradle Plugin Portal  
> **Build in:** Weeks 7–10

---

## 1. Problem Statement

GSD and Superpowers enforce spec-driven development during the coding session. But there is zero enforcement at the pipeline boundary. A PR that diverges from the spec merges freely. The spec is advisory, not enforced.

This is the "linting without CI" problem — the same as having ESLint but no pre-commit hooks. The spec-ci-plugin closes the loop: the spec becomes a contract enforced at every PR.

---

## 2. Feature Specification

### GitHub Action Usage

```yaml
# .github/workflows/spec-check.yml
name: Spec Compliance
on: [pull_request]

jobs:
  spec-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/spec-ci-plugin@v1
        with:
          spec-file: CLAUDE.md        # or GSD REQUIREMENTS.md
          fail-on: errors             # errors | warnings | never
          post-comment: true          # post PR comment with results
          generate-changelog: true    # call ai-changelog on merge
```

### PR Comment Output

```
## Spec Compliance Report

### Spec Validation
✅ Required sections: present
✅ No secrets detected  
⚠️  Acceptance criteria count: 2 (recommend ≥3)

### Security Scan
✅ No injection patterns detected in spec file

### Scope Compliance
✅ All changed files are within spec-declared scope
  Spec declared: src/auth/, src/middleware/
  Files changed: src/auth/login.ts, src/middleware/rate-limit.ts

### Acceptance Criteria Coverage
✅ "Users can log in with email/password" — test found: auth.test.ts:42
✅ "Rate limiting enforced on login" — test found: middleware.test.ts:18
⚠️  "Session expires after 24h" — no test found for this criterion

---
**Overall: PASS WITH WARNINGS**
spec-linter: 1 warning · injection-scanner: clean · scope: compliant · criteria: 2/3 covered
```

### Gradle Plugin Usage

```kotlin
// build.gradle.kts
plugins {
    id("com.your-org.spec-ci") version "1.0.0"
}

specCi {
    specFile = file("CLAUDE.md")
    failOn = FailOn.ERRORS
}

// Run locally: ./gradlew specCheck
```

---

## 3. Technical Architecture

### Validation Pipeline

```
Input: PR diff + spec file
         ↓
Step 1: spec-linter        → structural validation
         ↓
Step 2: injection-scanner  → security scan of spec file
         ↓
Step 3: scope-checker      → compare changed files vs spec-declared scope
         ↓
Step 4: criteria-checker   → find tests matching each acceptance criterion
         ↓
Step 5: comment-builder    → assemble PR comment
         ↓
Step 6: ai-changelog       → if merging to main, generate changelog entry
         ↓
Output: pass/fail + PR comment
```

### Scope Checker Implementation

```typescript
// Parse spec file for declared file scopes
// GSD PLAN.md has <files> tags: <files>src/auth/, src/middleware/auth.ts</files>
// CLAUDE.md has "Files in scope:" sections

function extractDeclaredScope(specContent: string): string[] {
  // Extract from GSD XML tags
  const xmlMatches = specContent.matchAll(/<files>(.*?)<\/files>/gs);
  // Extract from Markdown "scope" sections
  const mdMatches = specContent.matchAll(/## (?:Files in scope|Scope)\n([\s\S]*?)(?=\n##|$)/g);
  return [...xmlMatches, ...mdMatches].flatMap(parsePaths);
}

function checkScopeCompliance(
  declaredScope: string[],
  changedFiles: string[]
): ScopeResult {
  const outOfScope = changedFiles.filter(
    f => !declaredScope.some(s => f.startsWith(s))
  );
  return { compliant: outOfScope.length === 0, outOfScope };
}
```

---

## 4. Implementation Todos

### Week 7–8: GitHub Action

- [ ] `action.yml` with all inputs documented
- [ ] Install and run `spec-linter` (download binary from releases)
- [ ] Install and run `injection-scanner` (download binary from releases)
- [ ] Parse spec file for declared file scope
- [ ] Get PR diff from GitHub API (`@octokit/rest`)
- [ ] Compare changed files vs declared scope
- [ ] Parse acceptance criteria from spec
- [ ] Search test files for criteria keywords
- [ ] Assemble PR comment using template
- [ ] Post comment via GitHub API
- [ ] Set exit code based on `fail-on` input

### Week 9–10: Gradle Plugin + Marketplace

- [ ] Kotlin Gradle plugin with `specCheck` task
- [ ] Reuse same TypeScript logic via subprocess or port to Kotlin
- [ ] Publish to Gradle Plugin Portal
- [ ] Submit to GitHub Actions Marketplace
- [ ] Write "Show HN: I built a spec compliance CI plugin for Claude Code"
- [ ] Post to GSD Discord with demo GIF

---

## 5. Success Metrics

| Metric | Week 10 Target | Month 4 Target |
|---|---|---|
| GitHub Action installs | 20 | 200 |
| GitHub stars | 100 | 400 |
| Gradle plugin downloads | 10 | 100 |
| CI runs per day | 5 | 50 |

---

*Part of the AI Agent Tooling Ecosystem · See 00-MASTER-ANALYSIS.md for full context*
