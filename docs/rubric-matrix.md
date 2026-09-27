# Rubric matrix

The public event page identifies IBM Bob 2.0 as the required development partner. The organizer's judging guide names four dimensions: presentation, business value, application of technology, and originality. No event-specific numeric weights were publicly visible during discovery, so the 25-point weights below are **internal planning assumptions**.

| Criterion | Weight | Planned proof | Repository artifact | Demo moment | Main risk |
|---|---:|---|---|---|---|
| Application of technology | 25 | Bob discovers and calls all four Aegis MCP tools in one real session | `.bob/mcp.json`, `mcp-server.js`, Bob transcript | Bob submits a finding, then Aegis verifies it | No captured Bob run yet |
| Presentation | 25 | Two-minute problem → live review → mutation refusal → proof | `docs/demo-runbook.md`, `proof.html` | Judge watches VERIFIED become BLOCKED after a code change | Video not recorded |
| Business value | 25 | Security leads get auditable evidence instead of transient chat output | README problem framing and receipt schema | Show exact evidence useful in PR/audit review | No external user validation |
| Originality | 25 | Evidence freshness is enforced cryptographically, not asserted by the model | `src/aegis-core.js`, tests | Same prompt cannot bless changed bytes | Similar security reviewers exist |

## Current candid score

- Absolute: **59/100**. The core and evidence mechanism work, but the required real IBM Bob execution, public deployment, and final presentation evidence are missing.
- Competitive: **47/100** relative to the currently visible field. Many submissions already claim deployed, working AI workflows; Aegis becomes competitive only after the Bob-native loop is captured and the mutation refusal is demonstrated cleanly.
- Target after completing the submission checklist: **82–88/100**, not a guaranteed placing.
