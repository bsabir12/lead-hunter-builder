# 1.2.0 — 2026-09-28

Separate Leads email/phone fields, free public-company phone lookup with provenance, and display-only next-tool/credit guidance. Optional selected-only Apollo search, work email and person-phone enrichment with header-only credentials, zero default paid cap, no waterfalls and no automatic sends. Existing source handles, identities, human edits and contact suppression are preserved.

Apollo search errors now stop with an explicit access-error popup, preserving the provider error instead of reporting a successful empty result. Real-account validation distinguishes key authentication, available credits and endpoint permissions; a Free-plan denial is covered by a failing-first handler regression.

# Changelog

## 1.2.0 — automatic free contact research

- Runs bounded official-page email, phone and company-social checks in the existing worker.
- Runs Apollo People Search automatically only at zero credits when the saved key supports it; caches plan denial and per-lead attempts.
- Polls already-paid Apollo phone jobs automatically at zero credits.
- Shows zero-credit work as `[Working]`; `[Next]` names only an owner action or paid provider with its maximum credit cost.
- Keeps paid Hunter/Apollo enrichment selected-only with explicit confirmation and zero default caps in public builds.

## 1.1.0 — 2026-09-28

- Assess business suitability and route demand, cold or mixed prospecting before building.
- Add cold account import, facts/hypothesis storage, fit ranking and bounded Google Maps company discovery.
- Add optional own-account Hunter candidate discovery, exact-name/domain email finding, verification provenance, explicit credit reservations, request caching and suppression.
- Preserve unknown intent, current-role review, fresh mailbox checks and existing human/sent data.
- Extend offline contracts and add a documented free dummy-API check plus native cold-formula fixture for each installation.


## 1.0.0 — 2026-09-28

Initial portable builder: progressive intake, beginner installation guide, configurable evidence/scoring/source design, sanitized Apps Script core, offline generator and tests. Manual mode needs no provider accounts. Paid sources start disabled and schedules remain opt-in.

The public fork removes original account IDs, portfolio links, customer exceptions and business-specific scoring defaults. Reusability checks also repair fresh-sheet grid sizing, author/website review gating, functional URL identities, configurable decision roles, zero-value rules, effective-cap reservations and manual progress guidance.
