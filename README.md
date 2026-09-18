# ShareCapsule Research

ShareCapsule Research is a community-oriented workspace for turning expertise into credible research, applied learning, public contribution, and reusable evidence.

The first product surface is **Impact Commons**. It extends opportunity discovery with research integrity, skill development, peer learning, and community impact verification.

## Current capabilities

- Official-source opportunity discovery with provenance and retrieval timestamps
- Explainable local relevance scoring based on the user's focus areas
- Live scholarly discovery across Crossref and OpenAlex
- Evidence-led proposal and abstract drafting
- Research claim ledger with source strength and gap analysis
- Applied skill sprints that end in reviewable artifacts
- Community contribution projects and impact tracking
- Evidence vault for publications, talks, professional profiles, and expert review
- Browser-local draft and progress persistence
- Exportable evidence summary

## Authentic data sources

| Source | Purpose | Access method |
| --- | --- | --- |
| [Grants.gov](https://grants.gov/api/api-guide) | Posted and forecasted federal funding opportunities | Official public API, normalized by a scheduled repository workflow |
| [Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) | Publisher-deposited scholarly metadata and DOI records | Live public REST API |
| [OpenAlex](https://openalex.org/about) | Research discovery and citation context | Live public REST API |

The product does not silently substitute synthetic records when a source fails. The UI reports the source error and leaves the result set empty or partially complete.

## Data refresh

The scheduled GitHub Actions workflow runs daily and executes:

```bash
npm run sync:data
```

It queries the Grants.gov unauthenticated `search2` endpoint, normalizes the returned records, adds provenance, and updates `dist/data/opportunities.json` only when source data changes.

## Run locally

Requires Node.js 22+ for data synchronization. The front end itself has no build step.

```bash
npm run sync:data
python3 -m http.server 4173 --directory dist
```

Open `http://localhost:4173`.

## Validate

```bash
npm run check
```

## Project structure

```text
dist/
  index.html                  Product workspace
  styles.css                  Responsive visual system
  app.js                      Product interactions
  data-sources.js             Crossref, OpenAlex, and cache adapters
  data/opportunities.json     Normalized official-source cache
scripts/
  sync-authentic-data.mjs     Grants.gov ingestion and normalization
.github/workflows/
  validate.yml
  sync-authentic-data.yml
docs/
  PRODUCT-ROADMAP.md
```

## Product principles

1. Genuine expertise before credential collection.
2. Every external record must expose its source and retrieval time.
3. Claims remain separate from evidence and assumptions.
4. AI structures and challenges work; the human remains the author.
5. Learning must produce a useful, reviewable artifact.
6. Community impact requires beneficiary or peer verification.
7. Immigration evidence organization never replaces legal advice.

## Status

The repository contains a functional source-backed front-end. The next stage adds organizer-specific CFP feeds, OpenReview venue integrations, authentication, persistent user workspaces, collaborative review, and server-side source health monitoring.

## License

A license has not yet been selected. Until one is added, all rights are reserved.
