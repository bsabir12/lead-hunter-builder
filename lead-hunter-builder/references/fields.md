# Essential and optional fields

Include these automatically: company, original opportunity/request, source and source URL, official website, fit, readiness, priority, next action, outreach status, reason, missing evidence, email, phone, people, source contact and collection date. Demand readiness uses actual evidence; cold readiness remains Unknown. Contact/website values remain unconfirmed when checks cannot establish them.

The engine retains original normalized source text, source posting date, lookup state, stable ID and confidence in hidden working columns. Collection date never becomes a posting date. These fields support deduplication, continuation and review; hiding them does not remove them.

Ask which extra detail would change qualification or the next action. Offer relevant examples, not a mandatory checklist:

| Service | Possible owner-chosen fields |
| --- | --- |
| Clinic bookkeeping | Accounting system, jurisdiction, number of locations |
| Industrial maintenance | Equipment type, service radius, planned shutdown |
| IT security consulting | Environment, compliance framework, observed project stage |
| Translation | Language pair, document type, evidenced deadline |

Do not turn an example into a universal default, infer a regulatory obligation, or create readiness from a suitable company. The owner may choose none.

Use the optional profile block:

```json
"sheet": {
  "optional_fields": [
    {"key": "service_equipment", "label": "Equipment type", "purpose": "Match our supported equipment to the buyer's actual system"}
  ],
  "show_optional_core": ["country"]
}
```

Service fields have unique `service_` keys and owner-facing purpose notes. They are owner-entered. The bundled imports and AI cell-fill do not invent or automatically populate them. Adding automatic source extraction needs a specified source field, adapter and behavioral tests. `show_optional_core` can expose channel, what_to_say, follow_up_due, last_touch, thread, pay, employees, industry or country if the owner needs them.

A refresh appends newly configured fields and preserves old values and unrelated columns. Removing a field from the profile does not delete the column or its data; hide a retired service field manually. Required headers can move with their whole columns. Missing or duplicated required headers stop writes until repaired. Never alter only the header to simulate moving a column.
