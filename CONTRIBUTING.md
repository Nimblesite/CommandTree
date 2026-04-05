# Contributing to CommandTree

## Prerequisites

- Node.js (LTS)
- VS Code

## Setup

```bash
npm install
```

## CI Gate

Before submitting a pull request, you **must** run:

```bash
make ci
```

This runs formatting, linting, building, testing (with coverage check), and packaging. All steps must pass. Pull requests that fail `make ci` will not be merged.

## Make Targets

| Target | Description |
|--------|-------------|
| `make format` | Format source with Prettier |
| `make lint` | Lint with ESLint |
| `make build` | Compile TypeScript |
| `make test` | Run unit tests, e2e tests with coverage, and coverage threshold check |
| `make package` | Build VSIX package |
| `make ci` | Run all of the above in sequence |

## Coverage

Tests enforce a 90% coverage threshold on lines, functions, branches, and statements. The coverage check runs automatically as part of `make test`.
