# Hackathon Project Build Standard

## Purpose

This document is a binding operating guide for any AI agent helping to select, build, test, document, deploy, and submit a hackathon project.

The objective is not merely to produce a valid submission. The objective is to produce a working, evidence-backed project that is competitive for the top prize under the published judging rubric.

The agent must treat this document as an execution standard, not optional advice.

---

## 1. Core operating principles

### 1.1 Build for the rubric

Before proposing an idea or writing code, translate every judging criterion into a testable acceptance condition.

For every criterion, record:

- What the judges explicitly requested
- What artifact will prove it
- What live demonstration will show it
- What repository evidence supports it
- What could cause the project to lose points

Do not assume that attractive design, a mainnet transaction, a large test count, or use of many sponsor tools automatically satisfies the rubric.

### 1.2 The sponsor technology must be indispensable

Ask:

> If the sponsor technology were removed, would the central guarantee or capability of the project disappear?

If the answer is no, reject or redesign the idea.

The sponsor technology must solve the hardest and most visible part of the project, not be a decorative API call.

### 1.3 Integration depth matters more than name-dropping

A real integration should participate in the other project's native lifecycle.

Strong integration:

```text
External project creates a real event or state
    -> project-specific adapter interprets it
    -> sponsor technology performs an essential action
    -> external project's state or users receive the result
    -> result is independently verified
```

Weak integration:

```text
Read a public address or generic API
    -> perform an unrelated transfer
    -> call it an integration
```

Prefer official SDKs, contracts, schemas, events, webhooks, plugins, extension points, and upstream contribution paths.

### 1.4 Build the proof before the interface

The implementation order is:

1. Prove the external integration works.
2. Prove the sponsor technology performs the essential action.
3. Produce one real end-to-end result.
4. Implement safety and failure recovery.
5. Create machine-readable evidence.
6. Add tests and reproducibility.
7. Build the public interface.
8. Record the demo and prepare the submission.

Do not spend significant time on branding, animations, landing pages, logos, videos, or copy before the core proof succeeds.

### 1.5 Claims must be falsifiable

The project must make at least one measurable claim that a judge can independently challenge.

Examples:

- Fifty concurrent workers produced one payment.
- Ten process crashes produced zero duplicate transactions.
- Every successful result was independently verified against a public network.
- Every malicious destination change was refused before execution.
- A protocol state changed from an exact before-value to an exact after-value.
- Under an injected network failure, outcome recovery improved from X/100 to Y/100.

Avoid claims such as "secure," "reliable," "production-ready," or "AI-powered" unless the repository contains evidence defining and proving them.

### 1.6 Never fabricate depth

Do not fabricate:

- Users
- Partnerships
- Approvals
- Production traffic
- Mainnet activity
- Protocol adoption
- Security guarantees
- Test results
- Transaction evidence
- Upstream acceptance

An honest limitation is better than a false claim. If a required dependency is unavailable, pivot early.

---

## 2. Mandatory discovery phase

The agent must complete this phase before implementing the project.

### 2.1 Read authoritative sources

Collect and review:

- Official hackathon rules
- Submission requirements
- Judging rubric
- Sponsor documentation
- Sponsor repositories and example integrations
- Live-project SDKs, APIs, contracts, and extension points
- Previous winners, if available
- Current competing submissions, when public

For technical decisions, prefer primary sources: official documentation, source repositories, deployed contracts, specifications, and published APIs.

### 2.2 Produce a rubric matrix

Create `docs/rubric-matrix.md` with this structure:

| Criterion | Weight | Planned proof | Repository artifact | Demo moment | Risk |
|---|---:|---|---|---|---|
| Integration depth | | | | | |
| Sponsor usage | | | | | |
| Reliability | | | | | |
| Usefulness | | | | | |
| Code quality | | | | | |

If the official rubric has no numeric weights, assign internal weights and clearly label them as planning assumptions.

### 2.3 Verify external dependencies

List every dependency the project requires:

- Partner cooperation
- Authorized signer
- API credentials
- Testnet or mainnet funds
- Approved proposal, invoice, grant, order, or position
- Contract permissions
- SDK support
- Required paid plan
- Webhook or write access
- Deployment provider

Classify each dependency:

- `CONFIRMED`: tested and available
- `PROBABLE`: documented but not tested
- `BLOCKED`: unavailable
- `PARTNER_REQUIRED`: depends on another organization or person

No project may be selected when its central demonstration depends on an unconfirmed `PARTNER_REQUIRED` dependency without a time-bounded acquisition plan and a viable pivot.

### 2.4 Apply the idea gate

Score each idea from 0 to 2 on every question:

| Question | 0 | 1 | 2 |
|---|---|---|---|
| Is the other project real and active? | No | Unclear | Confirmed |
| Is the integration native to its lifecycle? | Generic | Partial | Native |
| Is the sponsor indispensable? | Decorative | Helpful | Essential |
| Can meaningful execution be proven cheaply? | No | Test-only | Yes |
| Is there a measurable before/after state? | No | Indirect | Direct |
| Can failure behavior be demonstrated? | No | Simulated only | Live/reproducible |
| Can the project be explained in one sentence? | No | Complex | Yes |
| Are critical dependencies confirmed? | No | Partial | Yes |

Reject ideas scoring below 13/16.

### 2.5 Write the one-sentence claim

Use this format:

> [Live project] decides or produces X; [sponsor technology] performs Y; independent evidence proves Z.

If this sentence is vague, the project is not ready to build.

---

## 3. Pivot rules

The agent must not continue indefinitely with a weakened version of the original idea.

Define hard checkpoints before implementation:

- By 20% of available build time: all critical dependencies confirmed.
- By 35%: first real integration read or event works.
- By 45%: first sponsor-powered execution succeeds.
- By 60%: end-to-end evidence exists.
- By 75%: failure scenarios and tests exist.
- Final 25%: public experience, documentation, demo, submission, and buffer.

If a checkpoint fails:

1. State the missing dependency clearly.
2. Explain how it affects the rubric.
3. Present a repair or pivot.
4. Estimate the remaining competitive ceiling honestly.
5. Do not silently redefine the project and continue claiming the original score potential.

If the core event cannot be obtained—for example, no real approved milestone, invoice, governance proposal, user position, or protocol permission—pivot to a project where the event can be created or observed legitimately.

---

## 4. Required system architecture

Adapt this architecture to the project:

```text
Live external state/event
        |
        v
Typed integration adapter
        |
        v
Deterministic policy engine
        |
        v
Canonical intent/artifact + hash
        |
        v
Simulation or preflight
        |
        v
Durable PREPARED record
        |
        v
Sponsor-powered execution with stable idempotency identity
        |
        v
SUBMITTED / UNCONFIRMED state
        |
        v
Independent result verification
        |
        v
Protocol-specific postcondition
        |
        v
Public machine-readable receipt
        |
        v
Result returned or written back to the integrated project
```

### 4.1 Typed intent

The agent must define a strict schema for every economically or operationally important field.

Reject:

- Unknown fields
- Invalid addresses or identifiers
- Unsupported networks
- Unsupported assets
- Negative or ambiguous amounts
- Floating-point financial values
- Caller-supplied destinations when the destination should come from trusted external state

### 4.2 Canonical artifact

Bind all execution-relevant fields into a canonical representation and digest:

- Source event identity
- Network
- Contract or recipient
- Function and arguments
- Asset
- Amount
- Beneficiary
- Policy version
- Expiration
- Required postcondition

Any change must produce a different digest and require fresh authorization.

### 4.3 Economic idempotency

Derive the idempotency identity from the economic obligation or logical operation, not from:

- Process ID
- Timestamp alone
- Request attempt
- Random UUID generated for every retry
- Agent conversation ID
- Ephemeral run ID

The same obligation after a crash or restart must resolve to the same identity.

### 4.4 Durable state machine

At minimum, distinguish:

```text
DISCOVERED
PREPARED
SIMULATED
AUTHORIZED
SUBMITTED
UNCONFIRMED
VERIFIED
FAILED
BLOCKED
DISPUTED
```

Never collapse `UNCONFIRMED` into `FAILED`. An unknown outcome must trigger reconciliation, not a new payment or write.

### 4.5 Independent verification

Do not rely solely on the sponsor API reporting success.

Verify through an independent source whenever possible:

- Public RPC
- Protocol read method
- Database state owned by the integrated project
- Emitted event with expected arguments
- Balance delta
- Position health or ownership change
- Receipt confirmation depth

A transaction receipt proves that a transaction landed. A protocol-specific postcondition proves that it accomplished the intended result.

### 4.6 Least authority

The executing component should have the minimum authority required:

- Scoped API token
- Allowlisted contracts and functions
- Per-action and daily limits
- Safe/module/delegation permissions
- Expiration
- Revocation path
- No private key exposed to an agent

Enforce important limits at more than one layer when possible: application policy plus onchain authorization.

---

## 5. Mandatory failure model

Create `docs/failure-model.md` before calling the project reliable.

Test the scenarios relevant to the project, including:

- Invalid destination
- Mutated amount
- Wrong network or token
- Revoked or changed upstream authorization
- Duplicate request
- Concurrent workers
- Rate limiting
- Upstream API unavailable
- Simulation revert
- Process crash before submission
- Process crash immediately after submission
- Response lost after broadcast
- Sponsor status disagrees with the chain
- Partial completion of a multi-step operation
- Restart with an unfinished journal entry
- Database write interruption
- RPC disagreement or temporary lag
- Reorganization or insufficient confirmation depth
- Expired authorization
- Stolen low-privilege key

For every scenario, document:

| Scenario | Expected state | Was anything broadcast? | Safe retry behavior | Evidence |
|---|---|---:|---|---|

Failure tests must assert both what happened and what did not happen.

---

## 6. Evidence standard

### 6.1 Evidence is a product feature

Create an `evidence/` directory containing machine-readable artifacts.

Recommended files:

```text
evidence/
  canonical-proof.json
  execution-campaign.json
  refusal-matrix.json
  crash-recovery.json
  independent-verification.json
```

Each successful execution should record:

```json
{
  "sourceEventId": "...",
  "intentHash": "...",
  "policyHash": "...",
  "idempotencyKey": "...",
  "sponsorExecutionId": "...",
  "transactionHash": "...",
  "sponsorStatus": "...",
  "independentStatus": "...",
  "beforeState": {},
  "afterState": {},
  "postconditionPassed": true
}
```

### 6.2 Run a meaningful campaign

Prefer a small number of diverse, meaningful experiments over artificial transaction volume.

A strong campaign might include:

- One real mainnet or production-equivalent execution
- Several complete testnet executions
- Concurrent duplicate attempts
- Crash-and-resume cases
- Refusals before broadcast
- Unknown-outcome reconciliation
- Independent re-verification of every published transaction

Generated evidence must be reproducible. Documentation should be checked against source artifacts in CI where practical.

### 6.3 Preserve negative evidence

Record blocked, failed, disputed, and unconfirmed runs. A repository containing only successful screenshots is weaker than one that demonstrates safe behavior under failure.

---

## 7. Testing and code-quality standard

Tests must cover meaningful risk, not inflate a count.

Recommended layers:

- Schema and canonicalization tests
- Policy and property tests
- Integration adapter tests
- Execution-state tests
- Idempotency and concurrency tests
- Failure-injection tests
- Independent verification tests
- Security and authorization tests
- End-to-end tests
- Live smoke tests isolated from ordinary CI

Required repository commands:

```bash
npm install        # or ecosystem equivalent
npm test
npm run typecheck
npm run build
npm run demo
npm run verify:evidence
```

Use one-command setup where possible. Never require judges to reconstruct undocumented infrastructure.

---

## 8. Repository standard

Recommended layout:

```text
src/
  integrations/
  domain/
  policy/
  execution/
  reconciliation/
  verification/
  receipts/

tests/
  unit/
  integration/
  failure/
  e2e/

evidence/
docs/
  architecture.md
  rubric-matrix.md
  security.md
  failure-model.md
  verified-testing.md
  limitations.md
  demo-runbook.md
  submission-checklist.md
```

The README must answer, near the top:

1. What problem is solved?
2. Which live project is integrated?
3. Why is the sponsor technology indispensable?
4. What real action occurred?
5. Where is the transaction or result?
6. How can the evidence be verified?
7. What failure conditions were tested?
8. What remains unfinished?

Do not bury the proof beneath marketing copy.

---

## 9. Public product and security

The public deployment must let judges experience the project safely.

Provide:

- Public read-only audit data
- Safe simulation or sandbox
- Existing verified proof
- No requirement for judges to obtain privileged credentials
- No public access to a shared funded execution key
- Clear distinction between demo and real evidence
- Helpful error states
- Health endpoint where appropriate

Do not expose:

- Administrator tokens
- API keys
- Private keys
- Internal error details containing secrets
- Unrestricted broadcast endpoints

The interface should support the proof. It should not be the proof.

---

## 10. Competitive review

When submissions are public, inspect them before the deadline.

Create `docs/competitive-review.md` containing:

- Serious competitors
- Their strongest evidence
- Where this project is stronger
- Where it is weaker
- Changes required to remain competitive

Do not score competitors from their landing pages alone. Inspect repositories, evidence, tests, transactions, and limitations.

If the project is no longer likely to reach the target tier, tell the user directly. Do not provide confidence unsupported by comparative evidence.

---

## 11. Time allocation

Recommended allocation:

| Work | Share |
|---|---:|
| Discovery, partner and dependency validation | 15% |
| Core integration and first real execution | 25% |
| Policy, safety and durable state | 20% |
| Failure experiments and evidence | 20% |
| Tests, documentation and reproducibility | 10% |
| UI, demo, submission and buffer | 10% |

If the first real execution has not occurred by the midpoint, stop interface work and reassess the project.

---

## 12. Demo standard

The project must be understandable in one sentence and demonstrable in two to three minutes.

Recommended sequence:

1. State the real problem.
2. Show the live external project or state.
3. Trigger or observe the real integration event.
4. Show the deterministic artifact or policy.
5. Show simulation.
6. Show one refusal or adversarial case.
7. Show the existing successful execution.
8. Show independent verification and the resulting external-project state.
9. End with the sponsor-specific guarantee.

Prepare all tabs and evidence in advance. Never risk additional funds merely to make a recording.

---

## 13. Submission gate

Do not call the project submission-ready until all required items pass.

### Integration

- [ ] Named live project
- [ ] Native SDK/API/contract/event integration
- [ ] Sponsor technology is indispensable
- [ ] Real end-to-end action
- [ ] Result returned to or consumed by the integrated project or its users

### Execution and evidence

- [ ] Execution or result identifier
- [ ] Public transaction/result link
- [ ] Canonical intent/artifact
- [ ] Independent verification
- [ ] Protocol-specific postcondition
- [ ] Machine-readable proof

### Reliability

- [ ] Stable economic idempotency
- [ ] Durable pre-submission journal
- [ ] Unknown-outcome reconciliation
- [ ] Duplicate/concurrency test
- [ ] Crash-before-submit test
- [ ] Crash-after-submit test
- [ ] Upstream-state-change refusal
- [ ] Negative evidence preserved

### Security

- [ ] No secrets in repository or browser
- [ ] Least-privilege credentials
- [ ] Server-derived trusted fields
- [ ] Amount/network/asset limits
- [ ] Safe public judge experience
- [ ] Revocation/recovery path

### Developer experience

- [ ] One-command setup
- [ ] Tests pass
- [ ] Typecheck passes
- [ ] Production build passes
- [ ] CI passes
- [ ] Architecture documented
- [ ] Security documented
- [ ] Limitations documented honestly

### Submission materials

- [ ] Source link
- [ ] Live product link
- [ ] Demo video
- [ ] Transaction/result proof
- [ ] Contact details
- [ ] Every form question answered
- [ ] Separate entries created where tracks require them

Any unchecked mandatory item must be reported explicitly before submission.

---

## 14. Internal scoring model

Use a 100-point internal score even when the official rubric is qualitative.

| Dimension | Points |
|---|---:|
| Native integration depth | 20 |
| Sponsor indispensability and execution | 20 |
| Reliability, recovery and observability | 20 |
| Real usefulness and originality | 20 |
| Developer experience and code quality | 20 |

Scoring rules:

- `0-59`: prototype, not competitive
- `60-74`: valid submission
- `75-84`: strong submission
- `85-91`: possible finalist
- `92-96`: serious prize contender
- `97-100`: exceptional; requires independent evidence, not polish alone

The agent must provide both:

- Absolute rubric score
- Competitive score relative to inspected submissions

Never present an estimated score as a guaranteed judging outcome.

---

## 15. Anti-patterns

Reject or correct these patterns:

- Generic chatbot plus sponsor API
- Standalone dashboard with no native integration
- External project used only as an address book
- Mainnet transfer presented as sufficient integration depth
- Test count used as a substitute for test quality
- Screenshots used as the only evidence
- Random idempotency key per retry
- Treating a timeout as failure and resending
- UI built before first real execution
- Critical dependency left until the final days
- Public demo requiring an administrator credential
- Claims of production readiness without failure experiments
- Post-deadline substantive changes presented as submitted work
- Quietly narrowing the project while keeping the original score claim

---

## 16. Required behavior for the assisting AI agent

The agent must:

1. Be candid about feasibility and competitive ceiling.
2. Identify missing external authority immediately.
3. Recommend a pivot when a core dependency is unavailable.
4. Prioritize working proof over appearance.
5. Inspect official documentation before implementation.
6. Inspect relevant framework documentation before writing version-sensitive code.
7. Preserve user work and secrets.
8. Test in proportion to financial and operational risk.
9. Separate demonstrated facts from planned capabilities.
10. Never claim success from an unverified API response.
11. Never call a project complete while required judging evidence is absent.
12. Reassess the project against the rubric at every major checkpoint.
13. Report when a tactical compromise lowers the likely score.
14. Keep an honest `limitations.md` throughout development.
15. Refuse to fabricate integrations, transactions, users, partnerships, or evidence.

When the user says "no shortcuts," interpret it as requiring every applicable gate in this document—not merely more code or more features.

---

## 17. Copy-paste instruction for a chat agent

Use the following prompt with this document:

```text
You are responsible for helping me build a prize-competitive hackathon project.

Read HACKATHON_WINNING_BUILD_GUIDELINES.md completely and treat it as binding operating instructions for idea selection, architecture, implementation, testing, evidence, deployment, demo preparation, and submission.

Start by reading the official hackathon rules, sponsor documentation, judging rubric, submission requirements, and relevant primary-source repositories. Then produce:

1. A rubric matrix.
2. A dependency and authority audit.
3. Three scored project ideas.
4. A recommended idea with a one-sentence falsifiable claim.
5. Hard pivot checkpoints.
6. An implementation and evidence plan.

Do not begin substantial UI work until the core integration and first real sponsor-powered execution succeed. Do not silently weaken the project if a critical dependency is unavailable. Tell me immediately, explain the effect on the judging ceiling, and recommend a pivot.

Throughout the build, maintain evidence, failure-model, architecture, security, limitations, demo-runbook, and submission-checklist documents. Treat unknown execution outcomes as reconciliation problems, never as permission to retry with a new identity.

The goal is not merely to submit. The goal is to produce a native integration with real execution, independent verification, failure evidence, strong developer experience, and a credible 92+ internal score.
```

---

## Final rule

The project is ready only when a skeptical judge can independently answer all four questions:

1. Did the integration use a real project in a project-specific way?
2. Did the sponsor technology perform the essential action?
3. Can the result and its failure behavior be independently verified?
4. Could another developer reproduce, adopt, and extend it?

If any answer is unclear, the work is not finished.
