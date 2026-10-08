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

### VDS access (Zynthio datacenter)

Cloud agents reach the VDS over **Tailscale/Headscale mesh + SSH**. Public SSH to `5.189.143.170` is blocked; use mesh IP `100.121.107.112`.

**Proactive rule — do not stagnate waiting on operator:**

1. On every VDS-related turn: run `ops/vds/vds.sh status` + update `ops/handover/LATEST-AUTO-STATUS.md` (HTTP probes) and **commit/push** if changed.
2. If Cloud hands fail (exit 1): **do not end turn with only "run Mac script"** — also push fixes to git, merge blockers, file INC with timestamp.
3. **Never** require operator to paste prove output back as the only next step. Mac lane runs `ops/handover/RUN-ALL-MAC.sh` once; prove lands on desk automatically.
4. Operator Mac/COR already has SSH — Cloud cannot replace it until real secrets in environment.

**Single CLI — always use this, never ask the operator to paste keys:**

```bash
ops/vds/vds.sh autopilot       # bootstrap + prove + auto-deploy if SSH ready and drift detected
ops/vds/vds.sh status          # readiness check
ops/vds/vds.sh deploy kelvin   # apply Kelvin song domain nginx + HTML on VDS
ops/vds/vds.sh prove kelvin    # origin title checks (flags unauthorized .net aliases)
ops/vds/vds.sh ssh 'df -h /'   # arbitrary remote command (mesh, else origin :22)
```

**Autopilot rule:** Run `autopilot` at session start. Do not wait for the operator to pick lanes. If secrets are placeholders, autopilot still proves origin drift and writes `ops/vds/reports/latest.log`. When real secrets land, the next autopilot run deploys fixes without prompts.

**Required secrets** (Cursor environment dashboard, one-time setup):

| Secret | Purpose |
|--------|---------|
| `ZYNTHIO_DC_SSH_KEY` | Private key (same as Mac `~/.ssh/zynthio_dc`) |
| `HEADSCALE_PREAUTH_KEY` | Headscale preauth key for `zynthio` on `headscale.kamals.pro` |
| `HEADSCALE_LOGIN_SERVER` | Optional override (default `https://headscale.kamals.pro`) |

If secrets are missing: call `cursor-cloud-request-environment-setup-actions` with `add_secrets`. **Never** ask the operator to paste SSH keys or auth keys in chat — that wastes credits and is a security anti-pattern.

Bootstrap runs automatically via `.cursor/environment.json` `start` → `ops/vds/bootstrap_vds.sh`.

### Gotchas

- **Lint script exists but ESLint is not installed.** `npm run lint` will fail with `eslint: not found`. Use `npm run typecheck` as the primary static analysis check. Do not install ESLint unless the owner adds it to `devDependencies`.
- **No `.env` needed for tests.** All 19 test files (365 tests) run with mocked API calls — no real API keys required. The `.env` file is only needed when exercising live LLM calls.
- **Always run both `npm test` and `npm run typecheck` before committing** (per `CLAUDE.md` rules).
- **The `punycode` deprecation warning** from Node 22 is harmless noise from a transitive dependency — ignore it.
- **Build output** goes to `dist/`. The build must succeed before the library can be imported by consuming projects.
