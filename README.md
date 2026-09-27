# Aegis — verified security reviews powered by IBM Bob

Aegis is a hosted security-review product for public GitHub repositories. An ordinary user creates an account, pastes a repository URL, and receives IBM Bob findings that Aegis has anchored to an immutable commit, exact files and line ranges, full-file SHA-256 hashes, excerpt SHA-256 hashes, and a tamper-evident receipt.

The end user does **not** install Bob, Node.js, an MCP server, or any local tooling. IBM Bob Shell is an internal dependency of the Aegis server.

## A. Normal user workflow

1. Visit the deployed Aegis site and create an account or sign in.
2. Paste a public URL such as `https://github.com/owner/repository`.
3. Optionally provide one branch, 40-character commit SHA, pull-request URL, and/or a comma/newline-separated path scope.
4. Select **Start Security Review**.
5. Follow the persisted job through `QUEUED → FETCHING → ANALYZING → VERIFYING`.
6. A review shows `VERIFIED` only when Aegis Core re-reads all evidence and its cryptographic postcondition passes. Invalid or stale findings are `BLOCKED`; operational failures are `FAILED`.

The dashboard and JSON receipt remain available after logout and process restarts when the configured database and evidence directory use durable storage.

## Architecture

```text
Browser
  → authenticated POST /api/reviews
  → persisted asynchronous review job
  → isolated, bounded GitHub checkout at an immutable commit
  → server-side bob run (read-only tools, JSON output, cost/turn/timeout caps)
  → strict output validation
  → the existing Aegis Core prepareReview / recordFinding / verifyReview
  → SQLite review + durable evidence receipt
  → polling dashboard and proof page
```

Important implementation files:

- `server.js` — authentication, authorization, API routes, safe static serving, and process startup.
- `src/repository-ingestion.js` — GitHub URL/ref validation, non-shell Git invocation, limits, file selection, and cleanup.
- `src/bob-runner.js` — non-interactive IBM Bob Shell adapter and strict JSON contract.
- `src/review-orchestrator.js` — job state machine and Aegis Core bridge.
- `src/review-store.js` — SQLite migration, persistence, ownership-filtered records, and idempotency.
- `src/aegis-core.js` — the original deterministic evidence authority, shared by hosted reviews and MCP.

## Environment

Required for a real Bob-powered review:

| Variable | Purpose |
|---|---|
| `BOB_API_KEY` | Server-only IBM Bob Inference API key. Never sent to the browser or stored in receipts. |

Production persistence:

| Variable | Default | Render value |
|---|---|---|
| `AEGIS_DB_PATH` | `data/aegis.db` | `/var/data/aegis.db` |
| `AEGIS_EVIDENCE_DIR` | `evidence` | `/var/data/evidence` |

Optional controls:

- `BOB_TEAM_ID` — required only for a General key; an Inference key is preferred.
- `BOB_COMMAND=bob`
- `BOB_MAX_COST=0.25`
- `BOB_MAX_TURNS=6`
- `BOB_TIMEOUT_MS=180000`
- `AEGIS_FETCH_TIMEOUT_MS=120000`
- `AEGIS_MAX_REPO_BYTES=104857600`
- `AEGIS_MAX_REPO_FILES=5000`
- `AEGIS_MAX_FILE_BYTES=524288`
- `AEGIS_MAX_REVIEW_FILES=50`

Bob runs only after an authenticated user explicitly creates a review. It is never called by startup, builds, tests, or health checks.

## Local development

Requirements: Node.js 24+, Git, and (only for a genuine AI review) IBM Bob Shell.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run demo
npm.cmd run verify:evidence
npm.cmd start
```

Open `http://localhost:4173`. Tests inject a deterministic fake Bob runner and consume no Bobcoins.

To test one genuine hosted workflow:

```powershell
$env:BOB_API_KEY = "your-inference-key"
$env:AEGIS_DB_PATH = "$PWD/data/aegis.db"
$env:AEGIS_EVIDENCE_DIR = "$PWD/evidence"
bob --version
npm.cmd start
```

Then create an account in the browser, submit a small public repository, wait for the job to finish, open its proof, and independently inspect the JSON receipt. Do not put the key in `.env` if that file could be shared or committed.

IBM documents `bob run --format json`, `--max-cost`, `--max-turns`, `--workspace`, and tool-group restrictions for unattended automation: [non-interactive Bob Shell](https://bob.ibm.com/docs/shell/getting-started/start-bobshell-non-interactive).

## B. Bob/MCP technical integration

Aegis remains a native IBM Bob MCP extension. `.bob/mcp.json` starts `mcp-server.js`, which exposes:

- `aegis_prepare_review`
- `aegis_record_finding`
- `aegis_verify_review`
- `aegis_get_review`

This technical demonstration and the hosted adapter both call the same `src/aegis-core.js`; there is no second evidence engine.

For an interactive native demonstration, open this repository in Bob and ask it to inspect `examples/vulnerable-auth.js`, call the four Aegis MCP tools, and report the review ID and receipt hash.

## C. Judge proof

- `proof.html` without a review query renders `evidence/canonical-proof.json`.
- `proof.html?review=<hosted-review-id>` loads the authenticated hosted receipt.
- `npm run verify:evidence` recomputes the checked-in receipt and current fixture hashes independently.
- `workspace.html?judge=1` is an explicit read-only product preview.

The checked-in canonical proof comes from the deterministic demo fixture. It is not labeled as Bob-generated. A real hosted receipt records Bob's `stats.task_id` when the CLI provides it.

## Render deployment

`render.yaml` is the exact Blueprint:

- Docker runtime using Node 24 and the official Bob Shell Linux installer.
- `2c-4g` because IBM currently documents 4 GB as Bob Shell's minimum memory.
- Frankfurt region.
- 10 GB persistent disk mounted at `/var/data`.
- Health check `/api/health`.
- `BOB_API_KEY` requested as a secret during Blueprint creation.

Deploy from **Render Dashboard → Blueprints → New Blueprint Instance**, select this repository, enter a fresh Inference-scoped `BOB_API_KEY`, and apply. Do not deploy this as a static site: the Node server, Bob Shell, SQLite, and persistent disk are required.

## Security boundaries

- Only HTTPS `github.com/<owner>/<repository>` is accepted; credentials, alternate hosts, ports, query strings, fragments, and malformed paths are rejected.
- Git and Bob are spawned with argument arrays and `shell: false`; user input is never interpolated into a command.
- Repository code is never executed. Bob's edit, execute, MCP, skill, mode, todo, and subagent groups are disabled for hosted analysis.
- Clone duration, output, repository bytes, file count, file size, selected scope, Bob turns, Bobcoins, and Bob duration are capped.
- Symlinks, binaries, common build/vendor directories, secret-like files, source maps, lockfiles, and oversized files are excluded.
- Finding paths, severity, line ranges, file existence, file freshness, and hashes are enforced by Aegis Core.
- Every review read is filtered by the authenticated user ID. Session cookies are HTTP-only, SameSite, and Secure in production.
- Temporary checkouts are removed in a `finally` block.

## Current limitations

- Only public GitHub repositories are supported; private repositories and GitLab are not.
- At most 50 selected source files are sent to Bob/Aegis Core. Large repositories may receive a deliberately partial review, shown by the stored scope metadata.
- Jobs run in one web process. They recover from a restart, but this is not a distributed queue and a persistent-disk service cannot be horizontally scaled safely.
- A review with no accepted finding becomes `BLOCKED`; the current evidence schema proves findings, not an absence-of-findings attestation.
- The hosted Bob path has comprehensive fake-runner tests but has **not yet been end-to-end tested with a valid Bob API key in this workspace**. Do not claim a live Bob-powered deployment until that test and the Render health/review flow both succeed.
- Aegis proves evidence freshness and integrity, not that Bob's security conclusion is semantically correct.

See `docs/hosted-implementation-plan.md`, `docs/security.md`, and `docs/limitations.md` for the audit trail.
