# Setup, validation and everyday use

Read this before generating a project or working in a live sheet. Separate code generation, native checks and paid integration validation: they prove different things.

## Set up the owner's project

1. Generate a personalized build using the validated profile. Use a new output folder. The assistant should do this, not ask a beginner to type terminal commands when execution is available.
2. Create a new blank Google Sheet in the user's account. If adapting an existing workbook, work on a copy and verify its schema first. The bundled migration only supports its own layouts.
3. Open **Extensions → Apps Script**. Paste generated `Code.gs`, save, and set the timezone under Project Settings. Generated `appsscript.json` can be used when uploading with approved tools; there is no need to set up a public web deployment.
4. Run `setup` from the editor. The owner reviews Google's access request for this project. Reload the sheet to show the Lead Hunter menu. If an organization blocks Apps Script, report that limit; do not bypass it.
5. `Setup` creates the workbook layout; it never installs recurring discovery or enables a source. Check system status reports connections as booleans, never key values. The starter allows manual mode without any provider account.
6. `Settings → Services & offer` shows business configuration. The user can edit it. Changes to this tab inform future drafts; changing engine scoring criteria requires updating the profile and rebuilding. Do not imply tab edits retrain or change Jev automatically.
7. Manual start: use the generated CSV header and `Settings → Maintenance → Import leads from CSV`. Leave `posted` blank for directory prospects or unsupported dates. Then enter match/readiness based on the agreed criteria; priority recalculates.
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
