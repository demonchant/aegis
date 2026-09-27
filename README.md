# Aegis — verifiable security reviews for IBM Bob

> IBM Bob reasons over a real repository; Aegis turns each security finding into a file-hash-anchored receipt; an independent verifier proves the evidence has not gone stale.

Aegis solves a specific trust gap in AI code review: a convincing finding can refer to code that has already changed. Aegis is a native MCP extension for IBM Bob 2.0. Bob inspects repository context and calls four Aegis tools to prepare a review, record findings, verify the current bytes, and retrieve the receipt. Aegis refuses out-of-scope paths and blocks verification when any reviewed file changes.

## Proof before pitch

| Question | Current answer |
|---|---|
| Problem | AI review evidence can become stale or lose its connection to exact source bytes. |
| Live integration | IBM Bob 2.0 through `.bob/mcp.json` and the local MCP server. |
| Why Bob is indispensable | Bob performs the repository-wide reasoning and submits the structured security claim; Aegis is the deterministic evidence and policy layer. |
| Real action | The included deterministic campaign prepares, records, verifies, and publishes a receipt for an intentionally vulnerable fixture. |
| Result | `evidence/canonical-proof.json`, rendered at `/proof.html`. |
| Independent verification | `npm run verify:evidence` recomputes the receipt and current file hashes without trusting the MCP response. |
| Failure conditions | Duplicate calls, path traversal, and post-review file mutation are tested. |
| Unfinished | A real Bob session ID and screenshots/video must still be captured; public deployment and submission are not yet complete. |

The checked-in proof is produced by the deterministic Aegis campaign. It is **not represented as a Bob-generated finding** until the documented Bob run is completed and `sponsorExecutionId` is populated.

## Run it

Requirements: Node.js 22.5 or later.

```powershell
npm test
npm run typecheck
npm run build
npm run demo
npm run verify:evidence
npm start
```

Open `http://localhost:4173/proof.html` for the judge-safe proof view or `http://localhost:4173/workspace.html?judge=1` for the read-only product tour.

Public deployments automatically enter read-only Judge Mode. The authenticated SQLite workspace remains a local demonstration feature and is not exposed on the static public site.

## Connect IBM Bob

1. Install IBM Bob IDE or Bob Shell and open this repository as a trusted workspace.
2. Bob discovers the checked-in `.bob/mcp.json` configuration.
3. Ask Bob:

   ```text
   Inspect examples/vulnerable-auth.js for an authorization vulnerability. Use the Aegis MCP tools to prepare the review, record only evidence you can anchor to exact lines, and verify the review. Report the review ID and receipt hash.
   ```

4. Save the Bob session evidence and rerun `npm run verify:evidence`.

Interactive Bob sessions can use IBMid/SSO and do not require an API key. For unattended Bob Shell automation, create an **Inference** key in the Bob portal and set it only in the current PowerShell session:

```powershell
$env:BOB_API_KEY = "your-new-inference-key"
bob run "Inspect examples/vulnerable-auth.js and use all required Aegis MCP tools."
```

Never paste the key into chat, source files, `.bob/mcp.json`, or screenshots. A General key additionally requires `--team-id`; an Inference key is already scoped to a team.

## Architecture

```text
repository bytes → IBM Bob reasoning → Aegis MCP tools → canonical finding
       ↑                                      ↓
       └──── independent hash re-read ← durable review journal
                                              ↓
                               canonical-proof.json → judge view
```

The core has no third-party runtime dependency. Reviews are written atomically. Review identity is derived from the source event plus scoped file hashes, so a retry returns the same review while changed code requires a new one.

## Repository map

- `src/aegis-core.js` — canonicalization, scope enforcement, journal, and verification.
- `mcp-server.js` — Bob-native MCP interface.
- `tests/` — idempotency, stale evidence, traversal refusal, and MCP contract tests.
- `evidence/` — public machine-readable proof; per-run journals are gitignored.
- `docs/` — rubric, architecture, security, failure model, demo, and limitations.
- `proof.html` — public read-only evidence view.

## Authoritative references

- [IBM Bob 2.0 Hackathon](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon)
- [lablab.ai judging guidance](https://lablab.ai/guide/how-to-win-an-ai-hackathon)
- [IBM Bob installation and authentication](https://bob.ibm.com/docs/shell/getting-started/install-and-setup)
- [IBM Bob API key types](https://bob.ibm.com/docs/shell/account/api-keys)
- [IBM Bob security guidance](https://bob.ibm.com/docs/ide/security/bob-security-guidance)

See [docs/limitations.md](docs/limitations.md) before making any production claim.
