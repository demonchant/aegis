# Architecture

## Trust boundaries

1. IBM Bob reads repository context and reasons about a suspected vulnerability.
2. `aegis_prepare_review` snapshots only explicitly named, workspace-relative files.
3. `aegis_record_finding` accepts a structured claim only when the file remains unchanged and the line range exists.
4. `aegis_verify_review` independently re-reads every file and emits `VERIFIED` or `BLOCKED`.
5. `verify:evidence` recomputes hashes without trusting Bob or the MCP response.

Review identity is `SHA-256(version + sourceEventId + sorted path/file-hash pairs)`. The same logical source over the same bytes reuses one journal. Changed bytes create a new identity.

The public `canonical-proof.json` contains no source text or credentials. Per-review journals are local and gitignored. Writes use a temporary file followed by an atomic rename.

## State model

```text
PREPARED ── record findings ──> PREPARED ── verify current bytes ──> VERIFIED
                                            └─ changed/missing/no finding ──> BLOCKED
```

`DISPUTED` is reserved in the stored schema for a future human challenge workflow. It is not claimed as implemented behavior.
