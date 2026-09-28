# Progressive intake

Start with: “What do you sell or do? Who would you like as a customer? What would tell us they might need you now?” A website can answer part of this. Don't require a polished ICP or perfect offer. Research relevant public pages only if access is available; label claims as owner-supplied or publicly supported.

Next gather only what changes the build:

| Decision | Why it matters | If unknown |
| --- | --- | --- |
| Goal: clients, freelance jobs, partnerships, other | Determines signals, criteria and channel | Propose a goal from the first answers |
| Services, first offer, public proof/portfolio | Defines fit and safe later drafts | Leave proof blank; don't invent packages or prices |
| Buyer type, geography, size, decision roles | Defines searches and optional exclusions | Keep broad; confirm before hard filtering |
| What is good work? What should be excluded? | Builds observable criteria | Recommend 3–5 fit criteria, with reasons |
| Signs they can act now | Builds readiness criteria | Recommend 2–4 signals of a workable opportunity |
| Sources/accounts already used | Avoids unnecessary signup and paid work | Start with CSV/manual evidence |
| Monthly budget and pilot ceiling, in USD | Makes permissions and costs concrete | Zero; no paid automation |
| Sales cycle and preferred weekly schedule/timezone | Sets age, freshness and timers | Scheduling off |
| Existing workbook | Determines whether migration is safe | New blank sheet |

Ask at most three questions per round. Explain the next decision, not the whole architecture. “I don't know” is an acceptable answer. Don't ask a user to paste a secret to prove they have an account.

## Profile contract

The full example is `assets/profile.example.json`; the generator validates and rejects unknown fields. Optional restrictions use zero to mean no floor/maximum, except money budgets where zero means paid work disabled.

- `business`: `name`, `offer`, `buyer`, `first_offer`, public `portfolio` URLs and `services` strings. This is business configuration, not secret storage.
- `goal`: `clients`, `jobs` or `partnerships`. For other goals, adapt and test the engine instead of mislabeling them.
- `mode`: `manual` or `assisted`. Manual mode disables provider credential access and paid discovery, even if keys were saved previously. Scores can be entered by the user from the agreed criteria. Assisted mode enables optional providers, still governed by zero-default budgets.
- `fit` and `readiness`: 1–8 criteria each, with unique lowercase `key`, readable `label`, `evidence` describing an observable positive signal, and positive `weight`. Weights need not sum to one; the generator normalizes them. “Not regulated” is a poor criterion; write the actual acceptable operating context.
- `priority`: `match_weight`, `readiness_weight`, `freshness_weight` sum to one; `half_life_days` > 0. Defaults .45/.30/.25 and 7.
- `rules`: `countries`, `restricted_words`, `spam_words`, `max_employees`, `min_hourly_usd`, `min_fixed_usd`, `max_post_age_days`. Empty country list accepts any. No hidden exclusion by unfamiliar company name.
- `decision_roles`: role names useful for this buyer (e.g. owner, operations director, finance manager).
- `budget`: `monthly_usd` includes the starter's recorded Apify/Jev charges; `people_monthly_usd` is an additional sublimit, not extra permission outside the total.
- `schedule`: desired `days` (uppercase weekday names), `hour` (0–23), IANA `timezone`. The generator records the plan but never installs a trigger.
- `providers`: explicit Jev model and input-token price, Google page/start estimate and any actor minimum cap, optional Groq models/Gemini model, Tavily monthly credits cap, Apify monthly credit for informational display. Values are assumptions to verify against the owner's current plans, not a promise of free usage. The example keeps optional fallback models empty.
- `sources`: zero or more supported source definitions: `name`, `actor`, `max_usd`, `input`, `note`. The starter always installs them disabled. Supported adapter names: `linkedin_jobs`, `google_jobs`, `google_intent`, `upwork`, `upwork_needs`, `x`. Each has a specific output contract. Don't rename actors into these names unless the payload matches or you adapt the parser.

Keep the finished profile private if it contains competitive strategy or customer data. A public template should contain fictional examples only. Credentials never belong in this file.
