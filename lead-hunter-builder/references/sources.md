# Choosing sources

Prefer a source where the target buyer already reveals the relevant need. Search both the service name and the buyer's problem wording. Keep the first pilot narrow enough to inspect every returned lead. A source that produces lots of rows but few supported buying signals is not successful.

| Source type | Appropriate evidence | Limit |
| --- | --- | --- |
| Owner-supplied CSV | Existing researched opportunities and contacts | Import doesn't verify claims; retain links and original description |
| Public job/RFP page | Need, scope, possible timing, actual posted date | A full-time hire doesn't establish openness to outsourcing |
| Freelancer marketplace | Project brief, budget, proposal channel | Buyer may be anonymous; avoid identity guessing and off-platform contact assumptions |
| Public social request | Direct request for recommendations/help | Distinguish buyer from self-promotion; respect platform rules |
| Business directory/company list | Buyer identity, location, possibly size | A prospect list doesn't establish urgency or a dated opportunity |
| Ads/news/funding/expansion | A potential timing signal | Does not itself establish a request for your service |

The bundled adapters are inherited starting contracts, not endorsements of current actor availability. Confirm the actor owner's current documentation, input schema, dataset fields, billing units and minimum run cap. For example, a Google actor may refuse a cap lower than its minimum even though a short query set is estimated to cost less. Explain both numbers; don't label the estimate a hard billing guarantee.

Typical parser fields to check before enabling:

- LinkedIn jobs: `id`, `companyName`, `title`, `descriptionText`, `link`, `postedAt`; company/contact fields optional.
- Upwork: `jobId`, `title`, `description`, `url`, `publishTime`; budget/client fields optional. `source=upwork_needs` uses the same parser.
- X: `postId`, `postText`, `postUrl`, `timestamp`; author optional.
- Google: top-level result pages with `organicResults`/supported result arrays, each result containing URL, title and snippet. Search-result dates can be ambiguous: inspect actual posting pages before using a critical date.

A changed schema should fail the pilot, not silently produce `undefined` IDs. If a new source is needed, request or obtain one sanitized dataset sample, write an explicit normalizer and its tests, and update source estimates. Custom directories and tenders usually need this work. Do not promise them as turnkey integrations.

Look up current official provider and platform documentation when configuring a real installation. Relevant entry points: [Apps Script](https://developers.google.com/apps-script), [Apify](https://docs.apify.com/), [TypeSafe](https://docs.typesafe.ai/), [Tavily](https://docs.tavily.com/), [Groq](https://console.groq.com/docs/overview), [Gemini](https://ai.google.dev/gemini-api/docs). Use the user's own subscribed plans; don't rely on the original author's accounts or test quotas.

No scraping of private accounts or bypass of access controls. The skill gathers public or owner-authorized business evidence; it does not authorize bulk messaging or extraction of private personal data.
