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
ADAPTERS = {"linkedin_jobs", "google_jobs", "google_intent", "upwork", "upwork_needs", "x"}
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
    obj(p, ["business", "goal", "mode", "fit", "readiness", "priority", "rules", "decision_roles", "budget", "schedule", "providers", "sources"], "profile")
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
    return p


def render(p):
    validate(p)
    engine = (ROOT / "assets/engine.gs").read_text()
    if engine.count("__BUSINESS_CONFIG__") != 1:
        fail("Engine configuration marker is missing or ambiguous")
    config = json.dumps(p, ensure_ascii=True, allow_nan=False).replace("<", "\\u003c").replace(">", "\\u003e")
    return engine.replace("__BUSINESS_CONFIG__", config)


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
    (out / ".gitignore").write_text("business-profile.json\n.env*\n.clasp.json\n.clasprc.json\ncredentials*\n*.csv\n!import-template.csv\n")
    (out / "OWNER-GUIDE.md").write_text(f"""# {p['business']['name']} — Lead Hunter\n\nMode: {p['mode']}. Sources are initially disabled. No schedules or accounts are connected by this build.\n\n1. Use a new blank Google Sheet, or a verified copy of a compatible workbook.\n2. Open Extensions → Apps Script. Paste Code.gs and save. Set the project timezone to {p['schedule']['timezone']}.\n3. Run setup from the editor; review Google's requested access for your own project. Reload the sheet.\n4. Use Lead Hunter → Settings → Maintenance → Import leads from CSV to import your own researched leads. Use import-template.csv's header.\n5. In manual mode enter fit and readiness from the agreed criteria. Priority recalculates; unknown dates earn no freshness bonus.\n6. For assisted mode, first verify models, actor schemas and pricing. Enter keys directly in your own project, never in chat or source files. Enable only the pilot source you reviewed.\n7. Use Check system status and Log. Run testEngineeringHardening in Apps Script for no-spend native checks before an approved small pilot.\n8. Install the planned schedule only after reviewing the pilot and approving recurring costs. Edit timers via Settings → Schedule. Stop recurring searches via Maintenance → Stop scheduled searches.\n\nRecorded monthly Apify/Jev limit: ${p['budget']['monthly_usd']:g}; people-search sublimit: ${p['budget']['people_monthly_usd']:g}. These do not guarantee your external provider bill. Optional providers have their own plans and quotas. Zero disables paid work within the corresponding budget.\n\nProgress in Leads distinguishes working, waiting, paused and completed. Selected-cell fill updates the selected supported fields and previewed dependencies, including skipped leads; it does not authorize outreach. Unsupported or unverified data stays blank with an explanation.\n\nSee the installed skill's setup-and-testing reference for validation and recovery steps. This generated project has not been live-tested merely because generation succeeded. No emails or messages are sent by discovery.\n""")
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
