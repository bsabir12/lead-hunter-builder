# Lead Hunter Builder

A downloadable AI skill that helps you build a lead hunting Google Sheet for your own business. Describe what you sell and who you want to reach; the assistant guides the questions, proposes sources and scoring, generates the Apps Script, and helps you test it.

You can start with manual imports and a $0 budget. Automated searches are optional. Every installation uses **your own Google and provider accounts**. There are no shared keys, developer accounts, sample customer lists or private business data in this repository.

## Download and start

Download [lead-hunter-builder.zip](lead-hunter-builder.zip?raw=true), then follow [START-HERE](lead-hunter-builder/START-HERE.md) to install in Claude or Codex.

Try:

> Use the lead-hunter-builder skill to build a lead hunting Google Sheet for my business. I sell [offer] to [customer]. I'm new to this—guide me one step at a time. Start with no paid searches.

Installation does not create a sheet or enable automation. The assistant should ask a few questions at a time and help build your first version. It needs skill support and code execution to generate and test files; otherwise it can guide setup without claiming tests were run.

## Features

- Business-specific match and readiness criteria, plus priority out of 100.
- Evidence links, original request text, services/offer and visible progress in Leads.
- Manual CSV import; optional Apify discovery and typed Jev assessments.
- Scoped selected-cell filling, stable IDs, deduplication and human-edit protection.
- Budget checks, durable background work and optional Google Apps Script schedules.

The starter supports named LinkedIn, Google, Upwork and X result formats. Provider availability, pricing and actor schemas must be verified for each installation. Other sources require an explicit adapter and tests. People and websites remain unconfirmed when the evidence is insufficient. No emails or messages are sent automatically.

## Accounts and privacy

Connect only providers you actually need, in your own accounts. Enter keys directly into your own Apps Script project; never paste them into chat, sheet cells or this repository. Script editors may be able to read Script Properties, so restrict access. Budgets cover recorded Apify/Jev usage; optional provider plans and crash-time accounting are separate limits, not a universal billing guarantee.

Only the fictional example profile belongs in this public repo. Personal generated projects can contain business strategy and prospect data; don't commit them just because they contain no API keys.

## For contributors

Python 3.9+ (standard library and IANA timezone data) and Node.js 18+ run the offline checks:

```sh
python3 lead-hunter-builder/scripts/test_builder.py
python3 lead-hunter-builder/scripts/build.py --profile lead-hunter-builder/assets/profile.example.json --out .build/example
node lead-hunter-builder/scripts/test_engine.mjs .build/example/Code.gs
python3 package.py --check
```

Use a new/empty output folder. Build files offline; no credentials or provider calls are needed. [VALIDATION](VALIDATION.md) describes what was checked and what still needs a user's native/live pilot. [Architecture](lead-hunter-builder/references/architecture.md) explains the reusable core.

MIT licensed. Provider APIs and platforms have their own terms and charges.
