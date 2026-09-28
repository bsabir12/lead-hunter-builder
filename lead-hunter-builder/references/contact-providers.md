# Contact providers — checked 28 September 2026

Recheck official pricing, API access and response schemas in the owner's account before a real pilot. Listed allowances and charges are vendor claims, not measured coverage or accuracy. Never ask for a key in chat; the owner enters their own key directly in Apps Script. No shared account is required.

Apollo's zero-credit search cost does not guarantee access on a Free account. A real owner pilot passed authentication and showed available credits, but both search and email enrichment returned HTTP 403 with a Free-plan access restriction. Check the exact account and endpoint; a successful health request proves the key, not enrichment permissions. The sheet shows search failures explicitly instead of treating them as no matches.

| Provider | Documented access and cost | Starter decision |
| --- | --- | --- |
| Hunter | Free API: 50 credits/month. Finder: 1 credit per result, built-in verification included. Dedicated verifier: 0.5 credit. API Domain Search: 1 credit per 1–10 emails returned. | Implemented first adapter; explicit zero-default local credit limit. |
| Prospeo | 100 free monthly credits with limited API; person email enrichment costs 1 credit/result. Exact current paid tier price needs an account check. | Optional later fallback; not implemented. |
| Apollo | People API search uses no credits but does not return email/phone; enrichment consumes credits and endpoint availability depends on account. Relevant free endpoints require work-email registration. | Optional menu integration: own API key, free selected-domain people search, work email up to 1 credit/person, person-phone request up to 9 credits/person with manual polling. Paid cap defaults to 0 until the owner sets it. Personal-email and waterfalls stay disabled; valid DNC flags are withheld. API endpoint access depends on the user’s plan. |
| Snov | Trial excludes API; Starter advertises $39/month and 1,000 credits. | Less suitable for a zero-cost API starter; not implemented. |
| Apify Google search | Free plan rate card: $0.0045/page plus $0.001 start. Optional enrichment and verification are each $0.10/contact on Free; paid plan rates differ substantially. | Use for public search; do not enable email extras by default. |

Official sources: [Hunter API help](https://help.hunter.io/en/articles/1970956-hunter-api), [Hunter prices](https://hunter.io/pricing), [Hunter API reference](https://hunter.io/api-documentation/), [Prospeo free account](https://help.prospeo.io/en/article/how-to-create-an-account-on-prospeo-for-free-5inxir/), [Prospeo plans](https://help.prospeo.io/en/article/plans-and-pricing-overview-cdloq9/), [Prospeo person enrichment](https://prospeo.io/api-docs/enrich-person), [Apollo search](https://docs.apollo.io/reference/people-api-search), [Apollo API pricing](https://docs.apollo.io/docs/api-pricing), [Snov pricing](https://snov.io/pricing), [Apify Google rate card](https://apify.com/apify/google-search-scraper/pricing).

## Implemented Hunter contract

Authentication: `X-API-KEY` header, read from `HUNTER_KEY` Script Property. Fixed HTTPS API origin, redirects disabled; keys never enter query strings. Transport and provider errors expose only a safe status message. No response body or real contact payload is written to Log.

- `GET /v2/domain-search`: domain, `type=personal`, comma-separated `job_titles`, limit=5. Here personal means a named work email, not a private inbox. Reads company domain and `emails[].first_name/last_name/position/linkedin/value/sources/verification`. Local role and domain checks remain necessary.
- `GET /v2/email-finder`: confirmed company domain and full name. Checks returned first/last name and domain before accepting a work email. LinkedIn-only enrichment is deliberately not used as an identity shortcut.
- `GET /v2/email-verifier`: work email only. Retains status; `accept_all`, blocked, disposable or webmail flags override a high score. Records local check time because this endpoint supplies no verification date.

HTTP 202 means pending, 451 means suppression, other non-200 responses stop without automatic retry. Unknown verification stays unknown. Finder/Domain Search can supply dated verification; stale results need a verifier call before publication. A missing profile URL stays blank rather than being generated from a person's name.

The official `test-api-key` serves fixed dummy responses without consuming account credits. It can return a different example person/domain regardless of request inputs; the production identity check must reject that mismatch. `scripts/test_hunter_dummy.py` checks the external schema using fictional inputs only. This is not a real-person accuracy test.

## Choosing a fallback later

Compare additional usable contacts against the incremental credits and plan minimum, on the same target segment. Stop after a fresh verified work email, respect suppression across providers, and record provenance/date per result. Add a second adapter only after its current schema and marginal value are verified; a waterfall is not automatically cheaper. Prospeo's current `/enrich-person` endpoint uses `X-KEY` with `only_verified_email: true`, `enrich_mobile: false` and name/company data; older tutorials can refer to different endpoints.

## Contact order and visible gaps

Reuse existing source contacts and directory phone fields first. Read explicit public phone links (`tel:`) structured organization telephone data, and visibly labeled formatted phone numbers on the official company website next: zero provider credits, subject to Apps Script fetch quotas. Do not scrape arbitrary digits, infer a country code, or attribute a public company number to a person. Empty fields display `[Next]` instructions with the next tool and maximum credits. The engine treats these labels as missing, so they never become scoring evidence or suppress retries. An unreadable site is not proof no phone exists.

Leads separates source handles/links (`contact`), work addresses (`email`) and labeled public/person numbers (`phone`). Source-public emails are not deliverability verified; Contacts keeps the verification and identity states for named people. Paid Apollo phone actions check public pages first, then request a separate explicit approval for the selected people. Hover over public phones for provenance and time checked. Copy valid Apollo phones manually after identity review. Existing company numbers are preserved.

Apify is a collection platform, not a universal email/phone directory. Reuse fields already delivered by a tested actor. Enable a new actor only after its source, permission to access, per-run ceiling and useful-contact yield are verified against direct public lookup and optional enrichment. Never start an actor automatically because a contact field is blank.
