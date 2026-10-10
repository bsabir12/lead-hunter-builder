# Lead Hunter Builder

A downloadable AI skill that helps you build a lead hunting Google Sheet for your own business. Describe what you sell and who you want to reach. The assistant first assesses whether demand discovery, cold prospecting or a mixed approach fits your business, explains the gaps, then builds and tests the appropriate starter.

You can start with manual imports and a $0 budget. Automated searches are optional. Every installation uses **your own Google and provider accounts**. There are no shared keys, developer accounts, sample customer lists or private business data in this repository.

## Download and start

Download [lead-hunter-builder.zip](lead-hunter-builder.zip?raw=true), then follow [START-HERE](lead-hunter-builder/START-HERE.md) to install in Claude or Codex.

Try:

> Use the lead-hunter-builder skill to build a lead hunting Google Sheet for my business. I sell [offer] to [customer]. I'm new to this—guide me one step at a time. Start with no paid searches.

Installation does not create a sheet or enable automation. The assistant should ask a few questions at a time and help build your first version. It needs skill support and code execution to generate and test files; otherwise it can guide setup without claiming tests were run.

## Features

- Business-specific match and readiness criteria, plus priority out of 100.
- Essential lead fields appear automatically; working columns stay hidden. Choose only useful service details, such as accounting software, equipment or service radius.
- Evidence links, original request text, services/offer and visible progress in Leads.
- Separate demand and cold prospect imports; optional Apify jobs/public-search/Google Maps discovery and typed Jev fit assessments.
- Own-account Hunter work-contact discovery, named-person email finding and mailbox verification, with source links, current-role review and credit caps.
- Scoped selected-cell filling, stable IDs, deduplication and human-edit protection.
- Budget checks, durable background work and optional Google Apps Script schedules.

The starter supports named LinkedIn, Google, Upwork, X and Google Maps result formats. Cold prospects keep buying readiness Unknown; suitability, facts and hypotheses stay separate. Provider availability, pricing and actor schemas must be verified for each installation. Other sources require an explicit adapter and tests. People and websites remain unconfirmed when the evidence is insufficient. No emails or messages are sent automatically.

## Accounts and privacy

Connect only providers you actually need, in your own accounts. Enter keys directly into your own Apps Script project; never paste them into chat, sheet cells or this repository. Script editors may be able to read Script Properties, so restrict access. Dollar budgets cover recorded Apify/Jev usage, and Hunter has a separate explicit credit allowance; optional provider plans and crash-time accounting are separate limits, not a universal billing guarantee.

Only the fictional example profile belongs in this public repo. Personal generated projects can contain business strategy and prospect data; don't commit them just because they contain no API keys.

## Cold prospecting

The assistant qualifies the company before spending on a relevant person’s work contact. A valid mailbox, a confirmed current role and an actual need are separate conclusions. Catch-all, unknown, identity-mismatched and suppressed contacts are not copied as verified leads. Current role review is still required; no provider guarantees a correct buyer or delivery.

[Cold workflow](lead-hunter-builder/references/cold-prospecting.md) · [Provider costs and limits](lead-hunter-builder/references/contact-providers.md). Hunter is the implemented email provider; the compared alternatives are not advertised as working integrations. The first account setup can remain manual and free.

## For contributors

Python 3.9+ (standard library and IANA timezone data) and Node.js 18+ run the offline checks:

```sh
python3 lead-hunter-builder/scripts/test_builder.py
python3 lead-hunter-builder/scripts/build.py --profile lead-hunter-builder/assets/profile.example.json --out .build/example
node lead-hunter-builder/scripts/test_engine.mjs .build/example/Code.gs
node lead-hunter-builder/scripts/test_contacts.mjs .build/example
python3 package.py --check
python3 lead-hunter-builder/scripts/test_portability.py --archive lead-hunter-builder.zip
```

Use a new/empty output folder. Build files offline; no credentials or provider calls are needed. [VALIDATION](VALIDATION.md) describes what was checked and what still needs a user's native/live pilot. [Architecture](lead-hunter-builder/references/architecture.md) explains the reusable core.

MIT licensed. Provider APIs and platforms have their own terms and charges.

### 1.3.1 consistent supplied website checks

Supplied websites use the same bounded independent review as discovered sites at the existing score thresholds. Readable evidence, an exact choice and the original host are required; unavailable checks stay incomplete. Legacy source boundaries keep owner notes out of identity evidence. Status checks distinguish queued work with unknown worker permissions and intentional manual schedules.

### 1.3.0 portable layouts and reliable discovery

Generated sheets have a clean essential view and optional owner-entered service fields. Header mapping preserves values when whole columns move or unrelated fields are added. Saved source text supports resumable identity scanning; partial website/contact checks stay unknown. Manual mode works without connected providers. Source-run selection, durable receipts, fair collection and bounded workers keep optional automation reviewable. See [fields](lead-hunter-builder/references/fields.md) and [validation](VALIDATION.md).

### Contact options

Separate email and phone columns preserve existing source handles. In assisted mode, the worker checks official public pages for published emails, phones and company social links. If connected and supported, Apollo People Search runs at zero credits and remembers plan denial. Partial public checks retry within a three-attempt bound, then request owner review; receipts expire and website changes invalidate them. `[Next]` cells name only the remaining owner action or connected paid tool with its maximum credit cost. Apollo and Hunter use the owner's keys and separate caps (initially 0); paid enrichment is selected-only and confirmed. No outreach is sent.
