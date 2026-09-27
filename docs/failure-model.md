# Failure model

| Scenario | Expected state | External action? | Safe retry behavior | Evidence |
|---|---|---:|---|---|
| Duplicate prepare | Existing PREPARED/VERIFIED review | No | Return same review ID | Core test |
| Duplicate finding | One stored finding | No | Return same finding ID | Core test |
| Path traversal | Refused | No | Correct to a workspace-relative path | Core test |
| File changes before finding | Refused | No | Prepare a new review | Core code |
| File changes before verification | BLOCKED | No | Reconcile and prepare a new review | Core test |
| Missing file | BLOCKED | No | Restore or prepare a new scope | Verifier code |
| No finding recorded | BLOCKED | No | Record supported evidence, then verify | Verifier code |
| MCP request malformed | JSON-RPC parse/method error | No | Correct request; do not create a new identity | MCP server |
| Crash during journal write | Old file remains or temp remains | No | Retry same operation and identity | Atomic rename design; crash injection not yet tested |
| Bob unavailable/rate limited | No Aegis execution | No | Resume same prompt/source event | Not yet live-tested |

The system performs no network, payment, deployment, or code-modification action. “External action” is therefore always no in this version.
