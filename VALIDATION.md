# Validation — 1.0.0

The public builder was checked offline on 28 September 2026. It is a configurable starter, not a claim that every provider or target business has been live-tested.

| Check | Result |
| --- | --- |
| Generator/profile contracts | 25 passed |
| Generated Apps Script contracts | 61 passed |
| Three distinct business configurations | Generator, syntax and all 61 engine contracts passed for each |
| Fresh 26-column sheet mock → full Setup → repeat Setup | Passed; correct headers, offer tab, retained notes/sent status, retained source checkbox and no schedule |
| Skill frontmatter, interface metadata and reference paths | Passed |
| Public file allowlist, sensitive-pattern scan, archive byte parity and checksum | Passed during packaging |

Eighteen regression checks initially failed: seventeen engine cases and one signed-URL profile case. They passed after fixes. Cases cover fresh-sheet sizing, unsupported buying approaches, wrong-site evidence, formula-like values, malformed probabilities, functional URL identity, missing source evidence, effective provider-cap reservations, HR buyer contacts, manual progress and signed URLs. Follow-up composition checks also cover invalid editable caps, review-state lookup suppression, manual contact queues, anonymous identity clues, assistant titles and credential redaction in Log. Other contracts exercise queue storage/recovery, sorts, human edits, selected-cell dependencies, budget pauses and profile validation.

The engine runner uses isolated fixtures and stubs, rejecting unstubbed networking. It arranges its own budget and provider state so a user's real configuration cannot spend or connect accounts during the tests. Configuration-specific offer/criteria binding and JavaScript parsing are checked; these tests do not validate current actor availability, real provider responses or Google's authorization/runtime behavior.

## Skill behavior

Three hypothetical prompts were run with the skill and with a general-assistant baseline: local clinic bookkeeping at zero budget; industrial pumps with a long sales cycle and a factory CSV; freelance web development with existing sent statuses and only a proposed small pilot.

Both sets respected the principal scope/evidence constraints. With the skill, the assistant additionally generated three validated provisional starter projects and used the bundled import contract to identify the existing-sheet migration risk. The baseline produced useful proposed sheet structures. This small author-reviewed evaluation supports cross-business use and preservation of scope; it does not establish higher conversion rates, cost savings or superiority on unseen tasks.

## Before real recurring use

Each installer must perform the native no-spend checks, verify their source schemas/model pricing and review a small owner-approved live pilot. No paid or quota-consuming provider call, real prospect import, outreach or schedule installation was performed for this package. GitHub's hosted [Offline checks run #1](https://github.com/bsabir12/lead-hunter-builder/actions/runs/36411382858) passed on the published commit, running the 25 builder checks, generation, 61 engine checks and archive/privacy verification on Ubuntu.

No original spreadsheet/account IDs, private portfolio links, customer fixtures, API keys or OAuth files are bundled. Known credential patterns and private-link/path patterns were scanned, with an explicit file allowlist. Pattern scanning cannot prove the absence of every possible secret; public files were also inspected for the original app's account references and business-specific exceptions.
