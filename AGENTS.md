# AGENTS.md

## Cursor Cloud specific instructions

This is a TypeScript library (not a runnable server/app). There is no HTTP server, database, or Docker setup.

### Quick reference

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Type check | `npm run typecheck` |
| Tests | `npm test` |
| Build | `npm run build` |
| Dev watch | `npm run dev` |

See `CLAUDE.md` for architecture details and `README.md` for usage examples.

### Gotchas

- **Lint script exists but ESLint is not installed.** `npm run lint` will fail with `eslint: not found`. Use `npm run typecheck` as the primary static analysis check. Do not install ESLint unless the owner adds it to `devDependencies`.
- **No `.env` needed for tests.** All 19 test files (365 tests) run with mocked API calls — no real API keys required. The `.env` file is only needed when exercising live LLM calls.
- **Always run both `npm test` and `npm run typecheck` before committing** (per `CLAUDE.md` rules).
- **The `punycode` deprecation warning** from Node 22 is harmless noise from a transitive dependency — ignore it.
- **Build output** goes to `dist/`. The build must succeed before the library can be imported by consuming projects.
