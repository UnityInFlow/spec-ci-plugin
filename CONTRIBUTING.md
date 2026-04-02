# Contributing to spec-ci-plugin

Thanks for your interest in contributing! This guide covers how to get started.

## Prerequisites

- Node.js >= 18
- npm

## Setup

```bash
git clone https://github.com/UnityInFlow/spec-ci-plugin.git
cd spec-ci-plugin
npm install
```

## Development workflow

```bash
npm run lint          # Type check (tsc --noEmit)
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run build         # Produce dist/index.js (CJS bundle)
npm run format        # Check formatting
npm run format:fix    # Fix formatting
```

## Making changes

1. Fork the repo and create a feature branch from `main`
2. Make your changes in `src/`
3. Add or update tests in `tests/`
4. Run `npm run lint && npm test && npm run build` to verify
5. Commit with a descriptive message following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add new checker for X`
   - `fix: handle empty spec file in scope checker`
   - `test: add edge cases for criteria matcher`
   - `docs: update README with new input`
6. Open a PR against `main`

## Project structure

```
src/
  index.ts              Action entry point (4-step pipeline)
  types.ts              Shared interfaces
  spec-linter.ts        Run spec-linter via npx
  injection-scanner.ts  Download + run injection-scanner binary
  scope-checker.ts      Extract scope from spec, compare to PR diff
  criteria-checker.ts   Parse test descriptions, match to criteria
  comment-builder.ts    Build markdown PR comment
  github.ts             Post/update PR comment via GitHub API
tests/
  fixtures/             Test fixture files
  *.test.ts             Test files (one per module)
```

## Code style

- TypeScript strict mode -- no `any` types
- `const` everywhere, named exports
- Early returns over nested `if` blocks
- Tests use vitest (`describe`, `it`, `expect`)

## Releasing

Only maintainers can release. The process:

1. Bump version in `package.json`
2. Run `npm run build` and commit `dist/`
3. Tag with `git tag vX.Y.Z`
4. Push tag and create GitHub Release

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
