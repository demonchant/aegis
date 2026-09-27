# Security

- API keys are not accepted by the web app or MCP tools.
- `.env`, local data, video, dependencies, and credentials are excluded from Bob context through `.bobignore`.
- `.gitignore` excludes secrets and local per-review journals.
- File inputs must be relative, cannot include `..`, must exist inside the workspace, and are capped at 512 KiB.
- Claims are anchored to both the complete file hash and exact excerpt hash.
- Public proof contains hashes and claims, not raw repository contents.
- The MCP annotations mark mutating/idempotent behavior so the host can request appropriate approval.
- The public judge mode requires no privileged credential.

## Credential incident response

The Bob key pasted during development must be considered exposed even if authentication failed. Revoke it in Bob Account → API Keys, create a replacement only if Bob Shell automation is needed, and place the replacement in the process environment—not this repository or any prompt.
