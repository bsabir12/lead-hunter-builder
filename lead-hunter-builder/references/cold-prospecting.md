# Assess suitability, then choose the route

Use when a business sells to prospects who may never post requests. This is also the routing reference before promising that this system fits a new business.

Understand the offer, deal size or margin, repeatability, typical buying process, target market and relevant buyer role. Judge whether identifiable companies exist, whether useful public business facts can distinguish them, whether an appropriate professional contact can be reached, and whether the likely research cost is proportionate. Ask only the missing questions that affect the next step.

Recommend **demand**, **cold**, **mixed**, or **limited fit**. Explain what can be automated, what stays uncertain, and the smallest useful test. A local B2B service can often use directories; enterprise products may need named-account research; a broad consumer service or an audience identifiable only through private/sensitive attributes may fit advertising, opt-in acquisition or referrals better. Do not generate a paid scraper merely because it is available.

Cold prospecting establishes potential fit, not a need. No negative readiness score is justified simply because a business has not advertised a problem. Use structural fit criteria (sector, geography, scale, relevant operations), keep readiness `Unknown`, and place a possible problem in a clearly labelled hypothesis. In mixed mode, fit criteria should work for both account facts and buying requests; readiness captures demand evidence only.

## Build and use

Start from `assets/profile.cold.example.json`, replacing its fictional clinic criteria. Keep `mode: manual`, provider `none`, and budgets zero until an owner chooses automation. The optional `prospecting` block keeps older demand profiles compatible:

- `approach`: demand/cold/mixed; `suitability` and `limitations` preserve the assessment.
- `cold_min_fit`: threshold for spending on contact research, 0–100.
- `cold_priority`: fit/contact/timing weights summing to 1, and a timing half-life. Starting point: 70% fit, 20% contactability, 10% evidenced timing, 30 days. These are adjustable ranking weights, not conversion probabilities.
- `contacts`: provider none/hunter, separate explicit monthly credit ceiling, up to five selected rows per run, cache 1–90 days, verification freshness 1–30 days. Zero credits disables this API even if a key is present.

Run the bundled generator. Both the regular import template and `prospect-import-template.csv` are produced. Cold imports require company, own website, observed facts, their public source URL and a separate hypothesis. A timing bonus requires a real observed event, date and source URL; collection time never substitutes. The importer deduplicates company domains. Separate branches share an account in CSV imports; Maps discovery instead preserves place IDs.

`Leads` remains the daily workspace. `Prospect evidence` retains facts, hypotheses and timing. `Contacts` keeps person identity, actual LinkedIn profile, mailbox result, provider evidence and check dates separate. Changing or confirming a person's identity does not change readiness. Priority uses fresh valid work mailboxes only when the person/company relationship is confirmed; a confirmed LinkedIn profile earns a smaller contactability contribution. Unknown timing contributes no bonus.

Manual scoring: enter fit based on the agreed criteria and keep cold readiness Unknown. Assisted scoring: Jev assesses fit from company facts and a matching site; a seller's company website is not rejected simply because it advertises its own services. Unsupported company identity withholds the score. Cold selected-cell contact lookup directs the owner to the structured contact workflow; it does not promote unverified scraped email strings.

## Finding companies and people

Choose one or two account sources appropriate to the market: public business directories, company websites, professional directories, exhibitor/association lists, or a provider database. A database's segment filters do not prove demand. Use only an available source whose input/output you can test.

The starter adds a `company_directory` adapter for `compass/crawler-google-places`. Supply one search term and location, at most 50 places per search, and all contact/review/image/extra enrichment options explicitly off. See [sources.md](sources.md). Other directory/database formats require a tested adapter or conversion into the prospect CSV. Hunter/Apollo company databases are options to evaluate, not implemented discovery adapters in this release.

For contacts, start with the company's team/contact pages or public search for the company and configured buyer roles. Existing public-search tools can help find `/in/` profiles; login-restricted scraping or session-cookie exports are not needed. Articles and someone else's posts are evidence mentions, never personal profiles. If names are absent, the implemented Hunter domain search requests at most five named work contacts filtered by the configured roles. It retains candidate LinkedIn links and sources. Provider candidates remain unconfirmed until the current person/company/role relationship is checked; this avoids mistaking a deliverable old-employee mailbox for the right buyer.

Use **Find work contacts for selected leads** for qualified new rows. In Contacts, inspect the source and LinkedIn link and set `identity_status` to confirmed only when supported. **Add a known decision-maker** allows a person discovered on a current public company page to be supplied without another paid domain search. **Find / verify selected work emails** uses that person's name and company domain, accepting only exact identity/domain matches. **Copy verified contacts to Leads** fills empty contact cells for new leads; it preserves sent rows and existing contacts. No outreach is sent. If a copied address becomes stale, suppressed or loses identity confirmation, opening the sheet or running a contact action removes that script-copied email from unsent Leads. An owner’s replacement value and sent history are preserved; `published_email` records which exact value the script owns.

## Evidence and stopping conditions

Keep three distinct conclusions: suitable company, correct current person, valid work mailbox. The provider's email confidence cannot substitute for any of these. Valid means a provider verified the mailbox at a date, not guaranteed delivery, interest or permission to buy. Unknown, catch-all, disposable, blocked, private consumer mailboxes and identity mismatches are withheld from the verified Leads field.

Use `do_not_contact: yes` for a suppression or opt-out; rejected identities and suppressed records stop further enrichment. HTTP 451 marks suppression and must not trigger a fallback provider. Do not generate permutations and call them found addresses. Do not seek personal/private contact details or sensitive customer attributes. Keep later outreach appropriate to the owner's market and honour recorded objections.

One domain search costs at most one API search credit under Hunter's documented API rate for up to ten results; this implementation requests five. A named-person finder plus optional verifier reserves at most 1.5 credits. Fresh verification is reused. Reservations persist on errors or unknown execution outcomes, so the local total may exceed the provider bill; this is conservative spending control. Interrupted identical requests wait 30 minutes before manual retry. Monthly reservations reset by UTC month. The provider's actual plan, shared-account usage and billing period remain separate; use the lower available allowance when choosing a local cap.

Test fictional cases offline first, then the documented dummy API, then a small approved real sample from the owner's market. Measure qualified accounts, correct current decision-makers, fresh valid work emails, unknown/catch-all rate, actual credits, and **cost per usable contact**. A cheap search returning the wrong people is not economical. No provider is “best” before that segment-specific pilot. Keep schedules off until the owner reviews the pilot.

Reply/follow-up fields in Leads can track outcomes manually. Automated sending, inbox reply sync, deliverability infrastructure and a multi-provider email waterfall remain separate extensions; this release does not claim those are built.
