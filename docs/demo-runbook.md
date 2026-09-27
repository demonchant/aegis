# Two-minute demo runbook

1. **0:00–0:15 — Problem.** “AI review findings can outlive the code they describe. Aegis makes freshness testable.”
2. **0:15–0:35 — Native integration.** Open `.bob/mcp.json`; show the four Aegis tools inside IBM Bob.
3. **0:35–1:00 — Real Bob run.** Ask Bob to inspect `examples/vulnerable-auth.js` and use the Aegis workflow. Show the tool calls and receipt hash.
4. **1:00–1:20 — Independent proof.** Run `npm run verify:evidence`, then open `/proof.html`.
5. **1:20–1:45 — Adversarial case.** Change the vulnerable line without preparing a new review. Re-run verification and show that stale evidence is blocked.
6. **1:45–2:00 — Close.** “Bob supplies repository intelligence; Aegis supplies an independently checkable chain of custody.”

Record only after the real Bob run succeeds. Restore the fixture and regenerate the proof before publishing.
