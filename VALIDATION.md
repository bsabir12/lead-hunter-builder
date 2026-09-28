# Validation — 1.1.0

Checked on 28 September 2026. This is a configurable starter with tested local contracts; native Google Sheets behavior and real contact accuracy still require each installer’s pilot.

| Check | Result |
| --- | --- |
| Profile/generator contracts | 34 passed |
| Generated Apps Script contracts | 115 passed |
| Cold and demand profile generation | Passed |
| External Hunter dummy API | All three endpoint schema checks passed; six dummy requests across research and reproducible checks; no real account credits |
| Public package | Explicit 19-file allowlist, sensitive-pattern scan, archive byte parity and SHA-256 |

The 149 offline contracts cover business configuration, source parsing, queues and spending reservations, sorting and human edits, selected-cell dependencies, unknown cold intent, identity/domain agreement, exact-mailbox verification, verification expiry, suppression, caching, request interruption and publication. The engine runner rejects unstubbed networking. Provider calls in these contracts use fictional fixtures.

Review reproduced and repaired gaps at workflow boundaries: stale discovery snapshots poisoning a cache; verification attached to a changed mailbox; suppression arriving between finder and verifier; copied contact revocation; rescore losing an available email route; and branch cache copying publication ownership. The last branch case was observed failing before its fix. Tests include owner replacement and sent-history preservation. These checks do not prove the absence of all race conditions in Sheets.

## Skill behavior

Three hypothetical businesses were evaluated against the previous skill and updated skill: clinic bookkeeping without posted demand; industrial equipment with a long buying cycle; and a consumer audience for which public B2B prospecting is a poor fit. Two updated business profiles generated successfully and each passed the then-current 34 generator and 108 engine contracts, plus 17 targeted role/offer checks. Final code adds seven handler regressions to the engine suite.

The updated workflow explicitly assesses suitability, separates facts from hypotheses, keeps cold readiness Unknown and guides professional-contact research. The previous version provided useful manual imports but lacked the cold/contact implementation. Both recognized the unsuitable consumer case. This small author-reviewed evaluation supports the design change; it does not establish superior conversion, coverage or cost per contact.

## What remains unverified

No owner email-finding account was available. No real-person enrichment, paid source run, outreach, account creation or recurring schedule was performed. Hunter’s documented dummy key returns fixed examples: it proves transport/schema compatibility, not current-employment accuracy, mailbox delivery or market coverage.

Run `testEngineeringHardening` and `testColdProspectingNative` in an owner-controlled test spreadsheet before live use. Native cold-priority formula evaluation has not been executed for this release. Then review a small approved real sample with the owner’s own account, measuring correct current decision-makers, usable work emails and actual credits per usable contact. Keep schedules disabled until that review.

## Distribution and privacy

The archive contains only allowlisted skill code, fictional profiles, documentation and tests. Original spreadsheet/account IDs, customer fixtures, private portfolio links, API keys and OAuth files are excluded. Known credential/private-link patterns and archive parity are checked; pattern scanning is not proof that every possible secret could be detected. The public source was also reviewed for original-account references.

The original live Lead Hunter script is outside this package and was not modified. [GitHub Actions](https://github.com/bsabir12/lead-hunter-builder/actions) runs the offline generator, engine and archive checks for every published commit. Native/live pilots remain separate from CI.

## 1.2.0 contact update — 28 September 2026

34 builder tests, 115 generated-engine contracts and 19 contact/guidance checks passed offline. The private deployment also passed 399 core/reliability, 32 Hunter, 22 Apollo, 26 progress, 12 layout and legacy migration checks. Native migration fixtures passed; a repeated live layout migration preserved all 383 lead IDs and original non-empty fields. Thirty existing public/source email addresses were copied to their dedicated column. Public artifacts contain no private workbook data or account keys.

The owner’s Hunter account status succeeded with 50 credits remaining. The saved Apollo key did not pass authentication; paid Apollo behavior is covered by response fixtures, not a successful live enrichment claim. No real-person paid enrichment or phone reveal was run. Public users must validate their own keys, endpoint permissions, quotas and selected-row pilot; those entitlements are not transferred with this package.
