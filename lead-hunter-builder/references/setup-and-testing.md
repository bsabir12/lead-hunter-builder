# Setup, validation and everyday use

Read this before generating a project or working in a live sheet. Separate code generation, native checks and paid integration validation: they prove different things.

## Set up the owner's project

1. Generate a personalized build using the validated profile. Use a new output folder. The assistant should do this, not ask a beginner to type terminal commands when execution is available.
2. Create a new blank Google Sheet in the user's account. If adapting an existing workbook, work on a copy and verify its schema first. The bundled migration only supports its own layouts.
3. Open **Extensions → Apps Script**. Paste generated `Code.gs`, save, and set the timezone under Project Settings. Generated `appsscript.json` can be used when uploading with approved tools; there is no need to set up a public web deployment.
4. Run `setup` from the editor. The owner reviews Google's access request for this project. Reload the sheet to show the Lead Hunter menu. If an organization blocks Apps Script, report that limit; do not bypass it.
5. `Setup` creates the workbook layout; it never installs recurring discovery or enables a source. Check system status reports connections as booleans, never key values. The starter allows manual mode without any provider account.
6. `Settings → Services & offer` shows business configuration. The user can edit it. Changes to this tab inform future drafts; changing engine scoring criteria requires updating the profile and rebuilding. Do not imply tab edits retrain or change Jev automatically.
7. Manual start: use the regular import template and **Import leads from CSV** for buying requests; use `prospect-import-template.csv` and **Import cold prospects from CSV** for cold accounts. Enter fit against agreed criteria; keep cold readiness Unknown. Demand readiness needs evidence. Unsupported dates stay blank; priority recalculates.
8. Assisted start: verify official provider documentation and current plans first. The owner enters needed keys through `Settings → Connections` directly, or through Apps Script Project Settings → Script Properties. Keys are private to the user's project, but script editors can read them. Restrict editors. Do not export properties.
9. Show settings, inspect source JSON and cap, and enable only the reviewed pilot source. `Find new leads` previews cost. It starts discovery, followed by collection, normalization, deduplication, scoring and eligible lookup through a background worker. Missing connections or exhausted budgets can pause that pipeline; progress and Log explain why.

## Gate 1: offline tests, no accounts

Run `python3 scripts/test_builder.py` and `node scripts/test_engine.mjs generated/Code.gs`. The Node runner uses stubs that reject unstubbed networking. Cover:

- Distinct business criteria; no DTC/Meta/recruiter defaults.
- Invalid profiles, credential fields, formula-like text, output preservation and JavaScript syntax.
- Priority date and weight behavior; imported dates don't replace source dates.
- Stable identity after sorting, preservation of concurrent human edits and exact selected-cell masks.
- Zero budgets, reservations, retained queues and storage rollback.
- Malformed source records, manual import identities and mentions vs profiles.

These checks prove local contracts, not current provider schemas, permissions or prices.

## Gate 2: native no-spend checks

In the owner's Apps Script project run `testEngineeringHardening` after setup. It creates only disposable fixture tabs and test-prefixed properties, then removes them. It does not request providers or enable a schedule. It checks native property chunk round trips, failed manifest recovery, sorting and human-edit protection.

Also inspect the actual sheet: correct row 1 progress, row 2 headers, metrics together, dates, hidden working fields, sources disabled, budget zero if that was agreed. Rerun Setup on the test copy and verify user edits and source checkboxes are preserved. Record the result and any actual runtime errors.

## Gate 3: small live pilot, owner-approved

Before running, present the proposed source/queries, result limit, actual actor minimum cap, estimated charge, monthly cap, provider credits and what will be written. Ask only for authorization not already given. Use the user's own accounts. No need to connect every optional provider.

Inspect each returned lead: original request and URL, correct buyer, actual source date, safe import, no duplicates, scoring evidence and appropriate channel. Choose one deliberately poor lead and one uncertain lead to verify review/skip behavior. Sort while a pending result is being collected on the test copy. Verify progress reaches a terminal or explained paused state, provider charges appear once, and a missing website/person is not reported as a confirmed fact.

Treat an invalid parser field, API response, permissions error or stale pricing as an unresolved integration. Disable that source and repair/test it. Do not widen searches or install a schedule to compensate for a failed pilot.

## Gate 4: recurring use

After pilot review, the owner chooses days, hour and timezone and authorizes estimated recurring usage. Install with `Settings → Maintenance → Install planned schedule`. Google Apps Script owns the timers; Apify receives individual search requests. Google typically runs within the chosen hour rather than at an exact minute.

`Settings → Schedule` opens the native trigger editor. Keep handler `scheduledRun`, deployment `Head`, and edit each weekly timer as needed. Changing the frequency changes costs; inspect the Log forecast and budget. The built-in monthly forecast is based on the profile's planned frequency, so rebuild/update that plan if you change frequency directly in the editor.

Stop scheduled discovery via `Maintenance → Stop scheduled searches`. This preserves already-approved work. The five-minute worker exists while work is queued and removes itself when queues empty; budget-paused approved work may retain a worker to resume later. Zero budgets pause paid work. To stop everything, also remove the worker trigger deliberately after inspecting pending runs and costs; don't discard queue records blindly.

## Daily workflow and recovery

- Work from `Leads`, filter unsent rows, and sort by priority. Check match, readiness, channel and evidence before outreach. “Message today” is a suggestion, not permission or a claim that the recipient is verified.
- Progress distinguishes queued/working/waiting/paused/completed/errors. Log is the detail. Missing or stale connections and monthly limits are expected reasons for a pause.
- Select supported cells and use **Fill selected cells**. Preview dependencies and cost first. This works for deliberately selected skipped rows. It may report no verified value; blanks aren't solved by guessing.
- Match/readiness/decision/source metadata are different fields. Unsupported imported metadata (e.g. status or a missing date) is not fabricated by selected-cell fill.
- If a person/website is wrong, preserve the prior evidence, correct the fact, and rerun only the needed cells. A changed row invalidates a pending snapshot and should block stale output.
- If an actor start is uncertain, inspect Apify run history and Log to reconcile it. Don't retry blindly: a paid run may already exist. Raw provider payloads can include sensitive details; keep diagnostics sanitized.

The budget ledger covers recorded Apify/Jev charges, not every possible third-party invoice or crash-time charge. Groq, Gemini, Tavily and Serper have their own plans/quotas; optional paid fallback usage isn't centrally billed by this starter. Do not describe a spreadsheet budget as a hard universal bill cap. Use provider-side controls too.

No email sending or reply synchronization is bundled. Writing messages can use a separate available outreach skill with the services/offer and evidence; do not require a missing private skill as a dependency.

Official references: [Apps Script triggers](https://developers.google.com/apps-script/guides/triggers/installable), [quotas](https://developers.google.com/apps-script/guides/services/quotas), [Properties Service](https://developers.google.com/apps-script/guides/properties), [batching guidance](https://developers.google.com/apps-script/guides/support/best-practices). Verify current details when implementing a real installation.


## Cold prospect and work-email checks

1. Run the same offline builder/engine suite for the chosen profile; cold contracts are bundled in that runner. Use fictional domains, never real credentials in fixtures.
2. Optionally run `python3 scripts/test_hunter_dummy.py`. This intentionally makes three requests using Hunter's documented dummy key and example.com inputs. It checks public API transport/schema without a real account or credits; it is not evidence of real coverage.
3. In the owner's test spreadsheet, run `testEngineeringHardening` and `testColdProspectingNative`. The latter creates uniquely named fixture tabs, evaluates native priority including changed/suppressed emails, and removes only its own fixture tabs. It makes no provider calls. Preserve a workbook copy before migrations; existing demand Leads keeps its 29-column schema.
4. Import two fictional cold accounts. Confirm facts/hypotheses stay separate and readiness stays Unknown. Check that a missing own domain blocks email enrichment. Inspect Contacts identity review, candidate source links, verification date and verified_email (system working field). Editing the email must reset verification; changing company/person/role must reset identity review.
5. For a real pilot, explicitly agree the company count, person count, source, provider credits/dollar ceilings and stopping condition. Five companies can yield up to 25 candidates; verify only the five person rows chosen for a five-contact pilot. Do not enable a schedule or send messages during validation.
6. Measure usable contacts after identity and mailbox checks, not simply nonempty emails. Review failures, stale roles, catch-all/unknown addresses and actual account credits before expanding.

The contact budget is a separate explicit Hunter credit allowance in the generated profile, with conservative reservations retained after errors. API discovery caching is distinct from editable candidate rows. Suppression is checked across records and provider suppression is persisted independently; do not clear it to try another provider. If a timer or request stops unexpectedly, inspect statuses and account usage before manual retry. A valid copied address can later become stale: opening the sheet and contact actions reconcile script-copied values, withdrawing those no longer eligible from unsent Leads. The `published_email` working field tracks ownership so human replacements and sent history are preserved. Refresh Contacts before outreach rather than treating the Leads string as permanent verification.
