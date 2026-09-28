---
name: lead-hunter-builder
description: "Build a personalized lead hunting Google Sheet for a business, freelancer or team. Use when someone wants a lead tracker with discovery, evidence-based fit/readiness scoring, priorities, contact research, budgets and recurring searches, or wants to adapt that workflow to an existing sheet. Interviews beginners, generates a configurable Apps Script starter, and guides setup and validation. Not for merely writing outreach, buying lead lists or sending messages."
---

# Lead Hunter Builder

Turn the user's business and buying signals into a usable lead workflow. The starter carries the durable queues, stable lead IDs, scoped cell filling and progress reporting from Lead Hunter; its business criteria are configurable. It is a starting implementation, not a promise that every business or scraper works unchanged.

## Start with the person

Read [intake.md](references/intake.md). Reuse answers already supplied. In the first response ask at most three short questions: what they sell, who they want to reach, and what a useful opportunity looks like. Accept a website or plain-language answer. Offer examples relevant to their business, not an account-setup questionnaire. Explain unfamiliar terms only when they matter. Continue gathering details in small rounds; summarize inferred choices for correction.

Do not ask for API keys, passwords or billing details in chat. The user enters their own credentials directly in their own Apps Script project. Never put credentials in profiles, code, sheets, screenshots, GitHub or logs. Each installation uses the user's own Google and provider accounts.

## Design around buying evidence

Read [sources.md](references/sources.md) when selecting sources. Separate an explicit request for help, a timing signal, and a directory prospect. A job listing does not prove openness to an agency; an active advertisement does not prove the advertiser needs new creatives. Recommend one or two sources with a small pilot, not every connector available. Check current official provider docs, actor input/output and pricing before recommending or enabling paid automation. Manual CSV import is a useful complete first stage when accounts or budget are missing.

Define a small set of observable, business-specific fit and readiness criteria. Explain each criterion, exclusion and weight. Geography, company size, pay floors and age limits are optional owner choices. Never import the original agency's DTC, Meta, recruiter or company-name rules as universal defaults. Treat unknown evidence as unknown; finite business-role categories can accept new names without accumulating a blacklist.

Use priority = 45% fit + 30% readiness + 25% freshness as a starting point. Freshness halves every seven days; only a supported opportunity posting date earns it. Directory records and undated or future-dated posts get no freshness bonus. Tune to the user's sales cycle. These are ranking scores, not probabilities of closing. Applicants/proposals may adjust priority only if the source reliably supplies them and the owner agrees; the bundled starter does not implement that adjustment.

## Build the reviewable product

Read [architecture.md](references/architecture.md) and [setup-and-testing.md](references/setup-and-testing.md) before building. Record the agreed decisions and open assumptions in `business-profile.json`, following [profile.example.json](assets/profile.example.json). Keep provider prices and model IDs explicit. Never insert keys. Use the bundled generator; run commands yourself if the environment supports execution:

```sh
python3 scripts/build.py --profile /path/to/business-profile.json --out /path/to/lead-hunter-build
python3 scripts/test_builder.py
node scripts/test_engine.mjs /path/to/lead-hunter-build/Code.gs
```

Resolve relative paths against this skill folder. The generator works offline and creates `Code.gs`, `appsscript.json`, an import template and an owner runbook. It does not create a spreadsheet, connect accounts, spend money or install schedules. Default to a new blank sheet. For an existing workbook, first make a copy and inspect its schema; preserve unrelated tabs, human edits and outreach statuses. Do not run layout migrations against an unfamiliar schema.

Adapt unsupported sources as explicit new adapters with sample output and tests, rather than treating a generic JSON row as valid lead evidence. Build custom criteria through configuration; edit shared mechanics only when the user's requirement genuinely needs it. Keep changes and checks with that generated project.

## Connect and prove it

Use a Sheets connector when available, otherwise guide Apps Script setup one step at a time. Do not make the beginner operate a terminal if you can generate the files for them. Check actual tool access before promising direct installation. An assistant without code execution can explain setup, but must not claim it generated or tested runnable files.

Use the testing gates in the setup reference: offline fixtures, native no-spend checks, then a small owner-approved live pilot. Show the proposed sources, counts, estimated charge, provider cap and monthly budget before paid work. Keep schedules off until the pilot is reviewed and the owner explicitly chooses the days, hour and timezone. Apps Script owns the schedule; Apify receives individual requests.

Finish with a short plain-language handover: where to work, how to find/import leads, what progress means, how to fill selected cells, edit budgets/schedules and stop automation. Report tests actually run, unresolved integrations and recurring cost assumptions. Never call it fully tested based solely on offline mocks. No automatic emails, proposals, messages or ad launches; outreach drafting is a separate optional workflow.

## Return visits

Read the saved profile and actual sheet/log state before asking the interview again. Compare source yield and accepted leads first; use replies and meetings only when the owner records them. Suggest measured changes rather than growing an unlimited tag list or widening every search. An existing authorization remains valid within its stated scope; a new source, higher cap or expanded schedule needs the owner's decision.
