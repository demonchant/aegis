# Limitations

- The genuine hosted IBM Bob execution has not yet been run in this workspace with a valid Inference key. Tests use a deterministic fake and consume no Bobcoins.
- Public GitHub repositories are the only supported source. Private access tokens, GitLab, Bitbucket, forks requiring credentials, and GitHub Enterprise are unsupported.
- The first 50 eligible files are reviewed, with security-relevant paths prioritized. This is not complete coverage for large repositories.
- No accepted findings produces `BLOCKED`, not a verified clean bill of health.
- The in-process queue is persistent and restart-recoverable but not distributed. It is intentionally single-worker for SQLite/disk safety.
- Local account authentication does not include email verification, password reset, MFA, organization roles, or administrative tooling.
- Aegis validates evidence freshness and integrity. It cannot prove that an AI claim is semantically correct.
- Git partial-clone packs can consume resources before the post-fetch size check; wall-clock/output caps limit but cannot perfectly preempt remote transfer size.
- Bob Shell installation uses IBM's current official installer at Docker build time rather than a checksum-pinned binary.
- A public Render deployment and complete real Bob review must succeed before the hosted workflow can be described as live.
