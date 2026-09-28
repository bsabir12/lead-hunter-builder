#!/usr/bin/env python3
"""Validate non-secret business configuration and render an offline Apps Script build."""
import argparse
import csv
import io
import json
import math
import re
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT = Path(__file__).resolve().parents[1]
ADAPTERS = {"linkedin_jobs", "google_jobs", "google_intent", "upwork", "upwork_needs", "x", "company_directory"}
DAYS = {"MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"}
SECRET_KEY = re.compile(r"^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|credentials?|client[_-]?secret|x-amz-(?:credential|signature|security-token)|x-goog-(?:credential|signature)|sig|signature)$", re.I)
SECRET_VALUE = re.compile(r"(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|apify_api_[A-Za-z0-9]{12,}|AIza[A-Za-z0-9_-]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|tvly-[A-Za-z0-9_-]{20,}))")


def fail(message):
    raise ValueError(message)


def obj(value, fields, path):
    if not isinstance(value, dict) or set(value) != set(fields):
        fail(f"{path}: expected exactly {', '.join(fields)}")


def text(value, path, empty=False):
    if not isinstance(value, str) or (not empty and not value.strip()) or len(value) > 4000:
        fail(f"{path}: expected {'optional' if empty else 'nonempty'} text, at most 4000 characters")


def number(value, path, positive=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or (positive and value == 0):
        fail(f"{path}: expected a finite {'positive' if positive else 'nonnegative'} number")


def strings(value, path, nonempty=False):
    if not isinstance(value, list) or len(value) > 100 or (nonempty and not value):
        fail(f"{path}: expected {'nonempty ' if nonempty else ''}list, maximum 100 entries")
    for n, item in enumerate(value):
        text(item, f"{path}[{n}]")


def no_secrets(value, path="profile"):
    if isinstance(value, dict):
        for k, v in value.items():
            if not isinstance(k, str) or SECRET_KEY.match(k):
                fail(f"{path}: credential fields are forbidden; enter secrets directly in your own Apps Script project")
            no_secrets(v, f"{path}.{k}")
    elif isinstance(value, list):
        for item in value:
            no_secrets(item, path)
    elif isinstance(value, str):
        if SECRET_VALUE.search(value):
            fail(f"{path}: possible credential material is forbidden")
        for url in re.findall(r"https?://[^\s\"<>]+", value):
            parts = urlsplit(url)
            if parts.username or parts.password or any(SECRET_KEY.match(k) for k, _ in parse_qsl(parts.query)):
                fail(f"{path}: credentials in URLs are forbidden")


def validate(p):
    no_secrets(p)
    required = ["business", "goal", "mode", "fit", "readiness", "priority", "rules", "decision_roles", "budget", "schedule", "providers", "sources"]
    obj(p, required + (["prospecting"] if "prospecting" in p else []), "profile")
    if "prospecting" in p:
        pc = p["prospecting"]
        obj(pc, ["approach", "suitability", "limitations", "cold_min_fit", "cold_priority", "contacts"], "prospecting")
        if pc["approach"] not in ["demand", "cold", "mixed"]:
            fail("Use demand, cold or mixed prospecting")
        text(pc["suitability"], "prospecting.suitability")
        strings(pc["limitations"], "prospecting.limitations")
        number(pc["cold_min_fit"], "prospecting.cold_min_fit")
        if pc["cold_min_fit"] > 100:
            fail("cold_min_fit cannot exceed 100")
        cp = pc["cold_priority"]
        obj(cp, ["fit_weight", "contact_weight", "timing_weight", "half_life_days"], "cold_priority")
        for k, v in cp.items():
            number(v, "cold_priority." + k, positive=k == "half_life_days")
        if abs(sum(cp[k] for k in ["fit_weight", "contact_weight", "timing_weight"]) - 1) > 1e-9:
            fail("Cold priority weights must sum to one")
        ec = pc["contacts"]
        obj(ec, ["provider", "monthly_credits", "max_rows_per_run", "cache_days", "verification_days"], "contacts")
        if ec["provider"] not in ["none", "hunter"]:
            fail("Supported contact providers: none, hunter")
        number(ec["monthly_credits"], "contacts.monthly_credits")
        for k, limit in [("max_rows_per_run", 5), ("cache_days", 90), ("verification_days", 30)]:
            if type(ec[k]) is not int or not 1 <= ec[k] <= limit:
                fail(f"contacts.{k}: expected an integer 1–{limit}")
    obj(p["business"], ["name", "offer", "buyer", "first_offer", "services", "portfolio"], "business")
    for k in ["name", "offer", "buyer", "first_offer"]:
        text(p["business"][k], f"business.{k}")
    strings(p["business"]["services"], "business.services")
    strings(p["business"]["portfolio"], "business.portfolio")
    for url in p["business"]["portfolio"]:
        if urlsplit(url).scheme != "https" or not urlsplit(url).hostname:
            fail("Portfolio links must be public HTTPS URLs")
    if p["goal"] not in ["clients", "jobs", "partnerships"] or p["mode"] not in ["manual", "assisted"]:
        fail("Use a supported goal and manual/assisted mode")
    keys = {"poster", "pitch", "site_matches_post", "identity_clue"}
    for group in ["fit", "readiness"]:
        if not isinstance(p[group], list) or not 1 <= len(p[group]) <= 8:
            fail(f"{group}: supply 1–8 observable criteria")
        for c in p[group]:
            obj(c, ["key", "label", "evidence", "weight"], group)
            text(c["key"], f"{group}.key")
            if not re.fullmatch(r"[a-z][a-z0-9_]{0,39}", c["key"]) or c["key"] in keys:
                fail("Criterion keys must be unique, lowercase, and not reserved")
            keys.add(c["key"])
            text(c["label"], f"{group}.label")
            text(c["evidence"], f"{group}.evidence")
            number(c["weight"], f"{group}.weight", positive=True)
    priority = p["priority"]
    obj(priority, ["match_weight", "readiness_weight", "freshness_weight", "half_life_days"], "priority")
    for k, v in priority.items():
        number(v, f"priority.{k}", positive=k == "half_life_days")
    if abs(sum(priority[k] for k in ["match_weight", "readiness_weight", "freshness_weight"]) - 1) > 1e-9:
        fail("Priority weights must sum to one")
    r = p["rules"]
    obj(r, ["countries", "restricted_words", "spam_words", "max_employees", "min_hourly_usd", "min_fixed_usd", "max_post_age_days"], "rules")
    for k in ["countries", "restricted_words", "spam_words"]:
        strings(r[k], f"rules.{k}")
        if any("," in v for v in r[k]):
            fail("Rule list entries cannot contain commas")
    for k in ["max_employees", "min_hourly_usd", "min_fixed_usd", "max_post_age_days"]:
        number(r[k], f"rules.{k}")
    strings(p["decision_roles"], "decision_roles", nonempty=True)
    obj(p["budget"], ["monthly_usd", "people_monthly_usd"], "budget")
    for k, v in p["budget"].items():
        number(v, f"budget.{k}")
    if p["budget"]["people_monthly_usd"] > p["budget"]["monthly_usd"]:
        fail("People budget is a sublimit and cannot exceed the total")
    sch = p["schedule"]
    obj(sch, ["days", "hour", "timezone"], "schedule")
    strings(sch["days"], "schedule.days")
    if len(set(sch["days"])) != len(sch["days"]) or any(d not in DAYS for d in sch["days"]):
        fail("Schedule days must be unique uppercase weekday names")
    if type(sch["hour"]) is not int or not 0 <= sch["hour"] <= 23:
        fail("Schedule hour must be an integer 0–23")
    text(sch["timezone"], "schedule.timezone")
    try:
        ZoneInfo(sch["timezone"])
    except (ZoneInfoNotFoundError, ValueError):
        fail("Use an IANA timezone, e.g. Europe/London or Asia/Karachi")
    pr = p["providers"]
    obj(pr, ["jev_model", "jev_input_usd_per_million", "google_usd_per_page", "google_usd_per_start", "actor_minimum_caps", "groq_models", "gemini_model", "tavily_monthly_credits", "apify_monthly_credit"], "providers")
    text(pr["jev_model"], "providers.jev_model")
    text(pr["gemini_model"], "providers.gemini_model", empty=True)
    strings(pr["groq_models"], "providers.groq_models")
    for k in ["jev_input_usd_per_million", "google_usd_per_page", "google_usd_per_start", "tavily_monthly_credits", "apify_monthly_credit"]:
        number(pr[k], f"providers.{k}", positive=p["mode"] == "assisted" and k == "jev_input_usd_per_million")
    if not isinstance(pr["actor_minimum_caps"], dict):
        fail("providers.actor_minimum_caps must map actor names to numeric minimums")
    for k, v in pr["actor_minimum_caps"].items():
        text(k, "actor name")
        number(v, "actor minimum", positive=True)
    if not isinstance(p["sources"], list) or len(p["sources"]) > 12:
        fail("Use at most 12 sources; start with one or two")
    seen = set()
    for source in p["sources"]:
        obj(source, ["name", "actor", "max_usd", "input", "note"], "source")
        if source["name"] not in ADAPTERS or source["name"] in seen:
            fail("Unsupported or duplicate source adapter")
        seen.add(source["name"])
        text(source["actor"], "source.actor")
        if not re.fullmatch(r"[A-Za-z0-9_-]+/[A-Za-z0-9_-]+", source["actor"]):
            fail("Actor must be owner/name")
        number(source["max_usd"], "source.max_usd", positive=True)
        if not isinstance(source["input"], dict):
            fail("Source input must be an object matching the actor's documented schema")
        text(source["note"], "source.note")
        if source["name"] == "company_directory":
            inp = source["input"]
            allowed = {"searchStringsArray", "locationQuery", "maxCrawledPlacesPerSearch", "language", "scrapePlaceDetailPage", "scrapeContacts", "maximumLeadsEnrichmentRecords", "verifyLeadsEnrichmentEmails", "maxReviews", "maxImages", "enableCompetitorAnalysis"}
            if (p.get("prospecting", {}).get("approach", "demand") == "demand" or source["actor"] != "compass/crawler-google-places"
                or set(inp) - allowed or not isinstance(inp.get("searchStringsArray"), list) or len(inp["searchStringsArray"]) != 1
                or not isinstance(inp["searchStringsArray"][0], str) or not inp["searchStringsArray"][0].strip()
                or not isinstance(inp.get("locationQuery"), str) or not inp["locationQuery"].strip()
                or type(inp.get("maxCrawledPlacesPerSearch")) is not int or not 1 <= inp["maxCrawledPlacesPerSearch"] <= 50
                or any(inp.get(k) is not False for k in ["scrapePlaceDetailPage", "scrapeContacts", "verifyLeadsEnrichmentEmails", "enableCompetitorAnalysis"])
                or any(type(inp.get(k)) is not int or inp[k] != 0 for k in ["maximumLeadsEnrichmentRecords", "maxReviews", "maxImages"])):
                fail("Company directory needs cold/mixed mode and bounded Maps input with paid extras disabled")
    return p


def render(p):
    validate(p)
    engine = (ROOT / "assets/engine.gs").read_text()
    if engine.count("__BUSINESS_CONFIG__") != 1:
        fail("Engine configuration marker is missing or ambiguous")
    config = json.dumps(p, ensure_ascii=True, allow_nan=False).replace("<", "\\u003c").replace(">", "\\u003e")
    return engine.replace("__BUSINESS_CONFIG__", config) + "\n" + (ROOT / "assets/prospecting.gs").read_text()


def build(p, out):
    code = render(p)
    out = Path(out)
    if out.exists() and any(out.iterdir()):
        fail("Output folder is not empty; choose a new folder to preserve previous work")
    out.mkdir(parents=True, exist_ok=True)
    (out / "Code.gs").write_text(code)
    (out / "business-profile.json").write_text(json.dumps(p, indent=2, ensure_ascii=False) + "\n")
    (out / "appsscript.json").write_text(json.dumps({"timeZone": p["schedule"]["timezone"], "dependencies": {}, "exceptionLogging": "STACKDRIVER", "runtimeVersion": "V8"}, indent=2) + "\n")
    csv_text = io.StringIO()
    csv.writer(csv_text, lineterminator="\n").writerow(["company", "what_they_want", "link", "website", "contact", "posted", "notes"])
    (out / "import-template.csv").write_text(csv_text.getvalue())
    (out / "prospect-import-template.csv").write_text("company,website,facts,facts_url,hypothesis,industry,country,employees,timing_signal,timing_date,timing_url\n")
    (out / ".gitignore").write_text("business-profile.json\n.env*\n.clasp.json\n.clasprc.json\ncredentials*\n*.csv\n!import-template.csv\n")
    pc = p.get("prospecting", {})
    cold_mode = pc.get("approach", "demand") in ["cold", "mixed"]
    import_instruction = ("Use Lead Hunter → Settings → Maintenance → Import cold prospects from CSV with prospect-import-template.csv. Facts and hypotheses stay separate. In mixed mode, use the regular CSV only for actual buying requests." if cold_mode else "Use Lead Hunter → Settings → Maintenance → Import leads from CSV with import-template.csv.")
    scoring_instruction = ("Enter fit against your agreed criteria; cold readiness stays Unknown. Cold priority uses fit, confirmed contactability and supported timing, never collection dates." if cold_mode else "Enter fit and readiness from the agreed criteria. Priority recalculates; unknown dates earn no freshness bonus.")
    contact_guide = ""
    if cold_mode or pc.get("contacts", {}).get("provider", "none") != "none":
        ec = pc["contacts"]
        contact_guide = f"""\n## Cold prospects and work contacts\n\nApproach: {pc['approach']}. Assessment: {pc['suitability']}\n\nLimitations: {'; '.join(pc['limitations']) or 'Review source and contact coverage in your own market.'}\n\nLeads holds daily work; Prospect evidence preserves facts, hypotheses and timing; Contacts preserves candidate identity, exact LinkedIn profile, source URLs and mailbox verification. For automated contact research, choose Hunter and assisted mode in the profile, rebuild, enter HUNTER_KEY through Settings → Connections, and approve a credit cap. No provider is connected by generating these files.\n\nContact credit ceiling: {ec['monthly_credits']:g} Hunter credits/month, separately from the Apify/Jev dollar budget. Zero disables Hunter. Adjust this in the profile and rebuild; never edit the spending ledger to increase a limit. Up to {ec['max_rows_per_run']} selected rows per click; a domain search can return five candidates per company. A five-contact pilot means selecting no more than five PERSON rows for verification, not five companies with every returned employee.\n\n1. Qualify companies, then use Update lead details → Find work contacts for selected leads. Or find someone on a public company/team page and use Add a known decision-maker.\n2. In Contacts, check current company/role against the cited source and profile. Set identity_status to confirmed only when supported.\n3. Select the relevant person rows and run Find / verify selected work emails. Unknown/catch-all mailboxes stay unavailable.\n4. Copy verified contacts to Leads fills empty contact fields for new leads; existing contacts and sent rows are preserved. No email is sent.\n5. Before outreach, recheck that the person, verification date and do_not_contact state still allow contact. Buying intent remains Unknown until evidence arrives.\n\nDo not set verification fields manually to make a result appear valid. Name/company/role edits reset identity review; email edits reset verification. Keep private addresses and sensitive consumer targeting out of this B2B workflow.\n"""
    (out / "OWNER-GUIDE.md").write_text(f"""# {p['business']['name']} — Lead Hunter\n\nMode: {p['mode']}. Sources are initially disabled. No schedules or accounts are connected by this build.\n\n1. Use a new blank Google Sheet, or a verified copy of a compatible workbook.\n2. Open Extensions → Apps Script. Paste Code.gs and save. Set the project timezone to {p['schedule']['timezone']}.\n3. Run setup from the editor; review Google's requested access for your own project. Reload the sheet.\n4. {import_instruction}\n5. In manual mode: {scoring_instruction}\n6. For assisted mode, first verify models, actor schemas and pricing. Enter keys directly in your own project, never in chat or source files. Enable only the pilot source you reviewed.\n7. Use Check system status and Log. Run testEngineeringHardening in Apps Script (and testColdProspectingNative for cold/mixed builds) for no-spend native checks before an approved small pilot.\n8. Install the planned schedule only after reviewing the pilot and approving recurring costs. Edit timers via Settings → Schedule. Stop recurring searches via Maintenance → Stop scheduled searches.\n\nRecorded monthly Apify/Jev limit: ${p['budget']['monthly_usd']:g}; people-search sublimit: ${p['budget']['people_monthly_usd']:g}. These do not guarantee your external provider bill. Optional providers have their own plans and quotas. Zero disables paid work within the corresponding budget.\n\nProgress in Leads distinguishes working, waiting, paused and completed. Selected-cell fill updates the selected supported fields and previewed dependencies, including skipped leads; it does not authorize outreach. Unsupported or unverified data stays blank with an explanation.\n\nSee the installed skill's setup-and-testing reference for validation and recovery steps. This generated project has not been live-tested merely because generation succeeded. No emails or messages are sent by discovery.\n{contact_guide}""")
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        p = json.loads(args.profile.read_text(), parse_constant=lambda _: fail("Nonfinite JSON numbers are forbidden"))
        folder = build(p, args.out)
    except (OSError, ValueError, TypeError) as e:
        parser.exit(2, f"Build failed: {e}\n")
    print(f"Created {folder}. No accounts connected, paid calls made or schedules installed.")


if __name__ == "__main__":
    main()
