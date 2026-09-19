# Peer-review opportunity sources

## Why this is a separate feed

OpenReview exposes public scholarly records and reviews, but a paper in OpenReview is not an invitation to become a reviewer. The platform therefore keeps research discovery and reviewer recruitment separate:

- `dist/data/openreview.json` supports scholarly discovery;
- `dist/data/peer-review-opportunities.json` contains only official reviewer calls, pools, and application pathways.

## Admission rules

A peer-review opportunity is published only when it has:

1. an official publisher, society, accreditor, journal, or government-program page;
2. an HTTPS application or expression-of-interest route;
3. explicit reviewer recruitment language;
4. eligibility and expected-commitment guidance;
5. a deadline or a clear rolling status;
6. an expiry timestamp for time-limited calls.

The scheduled sync verifies configured phrases on each official page. If a page is temporarily unavailable, the last verified record can be preserved until its explicit expiry. A record is removed when it expires or when maintainers confirm that the program has closed.

## Initial registry

| Program | Route | Typical fit |
|---|---|---|
| Journal of Open Source Software | Public reviewer pool | Research-software and open-source practitioners |
| ACM journals | Contact the relevant editor-in-chief | Computing researchers and domain experts |
| IEEE Access | Associate Editor application | Senior researchers with substantial publishing experience |
| HRSA | Reviewer Recruitment Module | Healthcare and community-health experts |
| NIH CSR | Early Career Reviewer program | Eligible early-career scientists at U.S. institutions |
| DOE BER | Reviewer volunteer form | Biological, environmental, climate, energy, and data experts |
| Higher Learning Commission | Time-limited peer reviewer call | Higher-education and accreditation professionals |

Profile similarity is never presented as eligibility. Each card exposes the official eligibility statement and links directly to the issuing organization.
