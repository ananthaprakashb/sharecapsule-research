# Product roadmap

## Vision

Build a trustworthy pathway from professional expertise to research, skill growth, public contribution, and independently verifiable impact.

```text
Discover → Research → Learn → Contribute → Verify → Publish
```

## Phase 1 — Functional front-end MVP

Implemented:

- Opportunity radar with match rationale
- Proposal Studio
- Research Studio and evidence ledger
- Skill Lab and applied sprints
- Community project board
- Evidence Vault and export
- Responsive desktop and mobile layouts
- Device-local state for drafts, tasks, and impact points

## Phase 2 — Trusted data platform

- Authentication and user profiles
- PostgreSQL-backed opportunities, projects, evidence, and skills
- Admin curation console
- Source provenance, freshness, and duplicate detection
- Opportunity ingestion adapters for conference, journal, hackathon, and media sources
- Saved searches, deadlines, and notifications
- Evidence file attachments and immutable activity history

## Phase 3 — Citation-backed research intelligence

- Research-question decomposition
- Primary-source retrieval and citation graph
- Claim-to-evidence linking
- Contradiction and counter-evidence search
- Literature-gap analysis with confidence labels
- Method-selection and reproducibility checklist
- Human approval before generated text enters a submission

## Phase 4 — Applied learning and peer review

- Skill graph derived from goals and produced artifacts
- Mentor and reviewer matching
- Rubric-based peer review
- Learning sprints with artifact submission
- Verified feedback history
- Community-created learning paths

## Phase 5 — Verifiable community impact

- Community-defined needs and acceptance criteria
- Contribution receipts with artifact hashes
- Peer and beneficiary verification
- Dispute and moderation workflow
- Impact metrics that distinguish effort, output, outcome, and reach
- Privacy-preserving public contribution profiles

## Proposed architecture

- **Web:** React/Next.js or equivalent TypeScript application
- **API:** TypeScript service with OpenAPI contracts
- **Data:** PostgreSQL with append-only audit events
- **Search:** Hybrid keyword and vector retrieval
- **AI orchestration:** Model gateway with prompt/version logging, citation enforcement, and evaluation
- **Jobs:** Queue-based ingestion, enrichment, deadline, and notification workers
- **Files:** Object storage with malware scanning and retention policy
- **Observability:** Structured logs, traces, model-cost accounting, and quality metrics

## Trust and safety requirements

- Never invent opportunities, citations, achievements, reviewers, or impact.
- Display source, last-verified time, and confidence for every opportunity.
- Treat immigration-related outputs as evidence organization, not eligibility assessment or legal advice.
- Require explicit user approval before external applications or submissions.
- Minimize personal data and make evidence visibility user-controlled.
- Preserve generated-text provenance and meaningful human edits.
