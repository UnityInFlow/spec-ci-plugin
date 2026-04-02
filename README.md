# spec-ci-plugin

Spec compliance CI/CD plugin for the [UnityInFlow](https://github.com/UnityInFlow) ecosystem. Enforces spec-linter, injection-scanner, scope, and criteria checks on every PR.

## Usage

```yaml
# .github/workflows/spec-check.yml
name: Spec Compliance
on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: UnityInFlow/spec-ci-plugin@v0
        with:
          spec-file: CLAUDE.md
          fail-on: errors
```

## Inputs

| Input | Description | Default |
|---|---|---|
| `github-token` | GitHub token for PR comments | `${{ github.token }}` |
| `spec-file` | Path to spec file | `CLAUDE.md` |
| `fail-on` | When to fail: `errors`, `warnings`, `never` | `errors` |
| `post-comment` | Post compliance report as PR comment | `true` |
| `injection-scanner-version` | injection-scanner version to download | `v0.0.1` |

## What it checks

1. **Spec Validation** -- runs `@unityinflow/spec-linter` on your spec file
2. **Security Scan** -- runs `injection-scanner` for prompt injection patterns
3. **Scope Compliance** -- compares PR changed files against spec-declared scope
4. **Criteria Coverage** -- matches acceptance criteria to test descriptions

## License

MIT
