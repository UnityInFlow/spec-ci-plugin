# ADR-001: Technology Stack

## Status

Accepted

## Context

spec-ci-plugin needs to run as a GitHub Action and later as a Gradle plugin. The GitHub Action must bundle all dependencies into a single JS file that GitHub Actions can execute.

## Decision

- **Language:** TypeScript (strict, ES2022 target)
- **Bundler:** tsup with CJS output and `noExternal: [/.*/]` to bundle all deps
- **Runtime:** Node.js 20 (matches `action.yml` `using: "node20"`)
- **Test framework:** vitest
- **GitHub API:** @actions/core, @actions/github, @octokit/rest
- **No `"type": "module"`** in package.json -- GitHub Actions require CJS entry point

## Consequences

- All dependencies are bundled into `dist/index.js` -- no need for `node_modules` at runtime
- TypeScript strict mode catches type errors early
- vitest provides fast, ESM-native test execution during development
- The CJS constraint means we cannot use top-level await in the entry point
