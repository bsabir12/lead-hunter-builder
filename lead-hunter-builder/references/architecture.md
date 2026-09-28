# Core mechanics and extension boundaries

The starter is a configurable fork of the developed Lead Hunter Apps Script. Business interpretation is separate from shared reliability mechanics. It runs in a spreadsheet-bound project owned by the person using it. No backend, original spreadsheet ID, developer credentials or shared billing account is included.

## Workbook

`Leads` is the daily workspace: progress in row 1, headers in row 2, data from row 3. Fit, readiness and priority are adjacent. `added` is when the system first collected a lead, formatted `2 Sep, 26`; it is not the posting date. Source date remains in a hidden working column. `Services & offer` holds owner-approved services and proof. `Log` records runs, actual reported charges, approvals and errors. `Proposals` holds optional proposed changes. `Sources` and `Rules` are editable settings, hidden by default. No separate dashboard is necessary.

Core columns: company, request, source, next step, fit, readiness, priority, reason, missing evidence, channel, message idea, outreach status, contact, people, source URL, website, added date. Hidden fields retain original source description, lookup state, follow-up metadata, posted date, pay, employees, industry, country, confidence and stable ID. Don't remove stable IDs to make the sheet look simpler.

## Keep these invariants

1. **Identity before position.** Deduplicate and queue by stable source ID. Re-find the current row before committing a delayed result. Sorting never changes lead identity. Check the complete snapshot of user/source fields before writing; preserve edits made while calls run.
2. **Source facts before inference.** Retain the original post. Classifiers see it and supported site evidence, not their own previous conclusions. A site's self-description is evidence of what it claims, not verified revenue or capability.
3. **Typed judgments, deterministic scores.** Jev estimates narrow criterion probabilities from evidence; code combines configured weights into 0–100 indices. Missing or malformed replies cause review/error, not invented successful scores. Manual mode allows the owner to enter scores.
4. **Exact-cell requests.** The selected fields define the write mask, including skipped/sent leads when explicitly requested. Preview any dependencies (e.g. priority requires missing fit/readiness). Preserve unrelated actions, statuses, notes and contact fields. Unsupported metadata is reported; it isn't fabricated. Bound row count and retries.
5. **Durability before side effects.** Persist approvals and continuation before inserting scored intake. Store large approval snapshots in UTF-8-safe chunks and commit their manifest last. Record actor-start intent before requesting a paid run; uncertain starts require reconciliation, not a blind retry.
6. **Budget at admission and execution.** Count actual recorded spend, outstanding run reservations and queued work. Zero stays zero. Lowered budgets pause retained work; they don't lose approvals or loop indefinitely. Budget estimates aren't a provider-side billing guarantee, and optional providers can have separate charges/quotas. Check their account controls.
7. **Honest progress.** Waiting for a provider, queued, working, paused, completed and failed are different. A timeout means incomplete work; it cannot become “none confirmed.” Worker retries are bounded and stop when queues are empty.
8. **Contacts need evidence.** Preserve role and source sentences. Do not lower confidence to fill a blank. LinkedIn `/in/` profiles can support a DM channel; an article or somebody else's post is a mention, not a profile. Remove known tracking parameters but retain functional URL parameters.
9. **Untrusted text stays text.** Escape formula-like imported values. Generated formula cells are deliberate. API exceptions must not log raw requests, credentials or URLs containing authentication tokens.
10. **Schedules are opt-in.** The profile is a schedule plan. Installation shows costs and asks the owner. Google Apps Script timers own recurrence; the existing worker only continues already-approved work. Turning off scheduled discovery leaves in-flight collection intact.

## Generic scoring

The profile supplies observable positive fit and readiness criteria, each with an evidence description and weight. Unsupported or incomplete typed answers are rejected. The finite `poster` judgment distinguishes a buyer, intermediary, seller and unclear source. It informs review; it doesn't automatically exclude agencies or recruiters. A strong score alone isn't permission to contact anyone.

Priority uses configured weights and a half-life. Only nonfuture supported opportunity dates count as freshness. Imported directory prospects should leave `posted` blank. `added` never substitutes for `posted`. Missing scores show `Not scored`; explicit skipped/unscored leads show zero so they don't rise to the top.

## Extending the starter

Keep adapters, business criteria and provider billing assumptions explicit. The starter only implements its named source parsers; other sources need code and tests. Goal-specific proposal competition, CRM integration, reply sync, message generation and visual ad analysis are extensions, not already implemented features. They can be useful later when real outreach data justifies them.

Do not copy a person-specific parent-company exception into a public build. If a future lead belongs to a parent business, obtain and retain evidence of the relationship, then evaluate the person against that evidence without bypassing the acceptance threshold.


## Cold account/contact module

`assets/prospecting.gs` is appended by the generator. It adds the cold/mixed route without changing the 29-column Leads schema; existing demand profiles remain valid. Additional structured tabs are created only for configured cold/contact use. `Prospect evidence` links by lead ID, and `Contacts` by lead ID plus contact ID. Mailbox validity, current-employment confirmation and buying readiness stay separate. Cold readiness is Unknown, even when fit and a verified contact are available.

Hunter requests reserve conservative credits durably under the script lock before network calls; a short persistent request lease stops overlapping duplicate requests and uncertain retries. Failed calls retain their reservation. Sorting and edits are checked by contact ID/snapshot before contact writes. Real-person/provider coverage is not established by the offline tests or dummy API. Current-domain work mailboxes only; no message sending or inbox access.
