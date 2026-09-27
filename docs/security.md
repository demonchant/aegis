# Security model

## Hostile input controls

- SSRF: only HTTPS URLs whose hostname is exactly `github.com` and whose path is exactly owner/repository are accepted.
- Command injection: Git and Bob use `spawn` with `shell: false`; refs are syntax-validated and are never shell fragments.
- Path traversal: scope and finding paths reject absolute paths and `..`; Core checks resolved and real paths.
- Symlinks: repository selection and Core anchoring reject symbolic links.
- Resource exhaustion: fetch and Bob timeouts, process-output caps, repository byte/file caps, file size caps, a 50-file review cap, request limits, Bobcoin limits, and turn limits.
- Repository execution: no dependency install, test, hook, submodule, Git LFS smudge, or submitted code execution. Git hooks and file/ext transports are disabled.
- Model output: one bounded JSON schema is required. Unknown fields, unsafe files, unsupported severity, and invalid lines are rejected before verification.
- Authorization: every review list/detail/status/receipt query includes authenticated user ownership. Cross-origin mutation attempts are refused.
- Secrets: `BOB_API_KEY` is read only from the server process and the Bob child receives a small allowlist of environment variables. Raw Bob output is not persisted or returned.
- Cleanup: temporary checkouts are deleted after success, block, timeout, or failure.

## Operational constraints

Use an IBM Bob Inference key where possible. Never put it in source, frontend configuration, screenshots, receipts, or user-submitted data. Rotate any key that may have appeared in chat or logs.

Render must use a paid service with a persistent disk. The static Vercel export is presentation-only and cannot provide the authenticated Bob product.
