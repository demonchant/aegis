# Dependency and authority audit

| Dependency | Status | Evidence | Next action |
|---|---|---|---|
| IBM Bob Enterprise seat | CONFIRMED | User-provided subscription screen shows the hackathon team and 40 remaining Bobcoins | Sign in through IBMid |
| IBM Bob IDE/Shell on this machine | BLOCKED | `bob` command is not currently installed | Install Bob or use the already downloaded Bob IDE |
| Interactive authentication | PROBABLE | IBM documents browser-based IBMid/SSO | Launch Bob and complete sign-in |
| Non-interactive API key | BLOCKED | The pasted key is exposed and reported invalid | Revoke it; create an Inference-scoped key only if automation is required |
| Aegis MCP integration | CONFIRMED LOCALLY | MCP contract test lists four tools | Run inside Bob and capture the tool calls |
| Public hosting | BLOCKED | No deployment configuration or live URL found | Deploy only after local proof passes |
| Demo video | BLOCKED | Existing video predates this verified integration | Record the new two-minute proof path |

## Hard checkpoints

1. **Now:** revoke the exposed key and sign in interactively.
2. **Before further UI work:** complete one real Bob → MCP → receipt run.
3. **Before recording:** prove file mutation changes VERIFIED to BLOCKED.
4. **Before submission:** deploy, verify the public URL, record video, and fill every form field.

If Bob cannot see the MCP tools after installation and workspace trust are confirmed, stop and fix the integration; do not present the deterministic demo as Bob execution.
