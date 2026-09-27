# Architecture

## Hosted product

```text
browser → authenticated review API → SQLite job
        → GitHub-only isolated checkout → immutable commit
        → read-only IBM Bob Shell → validated JSON findings
        → Aegis Core journal → hash re-read → receipt
        → SQLite result → dashboard / proof API
```

Job states are `QUEUED`, `FETCHING`, `ANALYZING`, `VERIFYING`, `VERIFIED`, `BLOCKED`, and `FAILED`. Nonterminal jobs are returned to `QUEUED` on process startup.

The checkout and Bob analysis use a temporary root with the repository nested at `repository/`. This keeps an untrusted repository-level `.bob` directory from becoming Bob's workspace configuration. Bob hosted sessions have all write, execute, MCP, skill, todo, mode, and subagent groups disabled. The prompt is written to stdin, while every process option is a fixed argument array.

## Shared evidence authority

Both paths use `src/aegis-core.js`:

1. Hosted: `src/review-orchestrator.js` calls Core directly after validating Bob's JSON.
2. Native Bob demonstration: `mcp-server.js` exposes the four Core operations configured by `.bob/mcp.json`.

Core snapshots regular files only, refuses traversal and symlinks, validates line ranges and severity, hashes the whole file and exact excerpt, then re-reads all scoped files. A receipt is `VERIFIED` only if every byte remains current and at least one finding was accepted.

Review identity remains SHA-256 over source identity and sorted path/hash pairs. Hosted source identity includes canonical repository URL plus immutable commit.

## Persistence

`AEGIS_DB_PATH` controls SQLite. `AEGIS_EVIDENCE_DIR` controls Core journals and receipts. On Render both point under the same persistent mount. Atomic temporary-file rename protects receipt writes; SQLite uses WAL mode.
