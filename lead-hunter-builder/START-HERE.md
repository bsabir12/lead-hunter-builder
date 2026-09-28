# Lead Hunter Builder

Build a lead hunting Google Sheet around your own business, offer and customers. The skill guides a short interview, proposes sources and scoring, creates the Apps Script files, and helps you set up and test the sheet. You don't need to know how to code.

Your Google Sheet, provider accounts, keys and bills belong to you. No shared accounts or keys are included. You can start with manual imports and no paid tools. Installing the skill alone does not create a sheet or start automation.

## Install

**Claude:** download the skill ZIP. In Claude open **Customize → Skills → + → Create skill → Upload a skill**, then upload the ZIP. Your workspace administrator may need to enable skills. [Official installation guide](https://support.claude.com/en/articles/12512180-use-skills-in-claude).

**Codex:** unzip it and put the `lead-hunter-builder` folder inside `~/.agents/skills/` for your user, or `.agents/skills/` inside your project. Restart if it doesn't appear. Invoke it as `$lead-hunter-builder`. Some older installations use `~/.codex/skills/`; use the skill location supported by your installed version. [Official skill guide](https://learn.chatgpt.com/docs/build-skills).

This is a local skill package, not a ChatGPT plugin. Don't assume uploading the ZIP to an ordinary chat installs it. An assistant must support skills and code execution to generate and test the included scripts; if those aren't available, use Codex locally or ask for step-by-step guidance with the files attached.

## First message

> Use the lead-hunter-builder skill to build a lead hunting Google Sheet for my business. I sell [your service/product] to [your ideal customer]. I'm new to this—guide me one step at a time. Start with no paid searches.

You can also share your business website. The assistant should ask a few relevant questions at a time, recommend a practical first version, generate the files, and help you install them in your own Google account.

## What it builds

- One Leads workspace with match, readiness, priority and visible progress.
- Your services and offer, source links and original evidence.
- Manual imports, optional automated discovery and verified contact research.
- Editable budgets and optional Apps Script schedules.
- Selected-cell filling that includes required inputs and preserves unrelated fields.

Not every source is ready-made. New platforms may need an adapter and a small test. Contact information can remain blank when evidence isn't sufficient. The starter does not send emails or messages.

API keys are entered directly in your own Apps Script project. Never paste them into the assistant, a Google Sheet cell or a public GitHub repository. Everyone with edit access to the bound script may be able to read its Script Properties; restrict access accordingly.
