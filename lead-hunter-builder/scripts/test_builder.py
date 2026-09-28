#!/usr/bin/env python3
"""Offline contract tests; no accounts or networking."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from build import ROOT, build, render, validate


class BuilderTests(unittest.TestCase):
    def setUp(self):
        self.p = json.loads((ROOT / "assets/profile.example.json").read_text())

    def rejects(self, mutate):
        mutate(self.p)
        with self.assertRaises(ValueError):
            validate(self.p)

    def test_fictional_profile_and_escaped_code(self):
        self.p["business"]["name"] = 'A "quoted" name\nwith ${literal} and </script>'
        code = render(self.p)
        self.assertNotIn("__BUSINESS_CONFIG__", code)
        self.assertIn("\\u003c/script\\u003e", code)
        self.assertIn('\\nwith ${literal}', code)

    def test_distinct_businesses(self):
        for name, offer, role in [
            ("Example Books", "Bookkeeping for clinics", "finance manager"),
            ("Example Pumps", "Pumps for factories", "maintenance manager"),
            ("Example Web", "Websites for nonprofits", "executive director"),
        ]:
            p = copy.deepcopy(self.p)
            p["business"].update(name=name, offer=offer, buyer="Owner-defined target", first_offer="A scoped conversation")
            p["decision_roles"] = [role]
            p["fit"][0]["evidence"] = f"The request is from a buyer seeking {offer}."
            self.assertIn(offer, render(p))

    def test_secret_field(self):
        self.rejects(lambda p: p["business"].update(api_key="not-a-real-secret"))

    def test_nested_source_secret(self):
        self.rejects(lambda p: p["sources"].append({"name": "x", "actor": "example/actor", "max_usd": .1, "input": {"authorization": "fixture"}, "note": "Sample"}))

    def test_secret_url(self):
        self.rejects(lambda p: p["business"]["portfolio"].append("https://example.com/?token=fixture"))

    def test_secret_url_basic_auth(self):
        self.rejects(lambda p: p["business"].update(offer="See https://user:password@example.com/"))

    def test_private_key(self):
        self.rejects(lambda p: p["business"].update(offer="-" * 5 + "BEGIN PRIVATE KEY" + "-" * 5 + " fixture"))

    def test_signed_urls(self):
        self.rejects(lambda p: p["business"]["portfolio"].append("https://example.com/?X-Amz-Credential=fixture&X-Amz-Signature=fixture"))

    def test_invalid_unknown_field(self):
        self.rejects(lambda p: p.update(outreach_auto_send=True))

    def test_duplicate_criterion(self):
        self.rejects(lambda p: p["readiness"][0].update(key=p["fit"][0]["key"]))

    def test_reserved_criterion(self):
        self.rejects(lambda p: p["fit"][0].update(key="poster"))

    def test_empty_criteria(self):
        self.rejects(lambda p: p.update(fit=[]))

    def test_negative_budget(self):
        self.rejects(lambda p: p["budget"].update(monthly_usd=-1))

    def test_boolean_budget(self):
        self.rejects(lambda p: p["budget"].update(monthly_usd=True))

    def test_nonfinite_number(self):
        self.rejects(lambda p: p["priority"].update(half_life_days=float("nan")))

    def test_wrong_total_weights(self):
        self.rejects(lambda p: p["priority"].update(match_weight=.9))

    def test_zero_half_life(self):
        self.rejects(lambda p: p["priority"].update(half_life_days=0))

    def test_people_sublimit(self):
        self.rejects(lambda p: p["budget"].update(people_monthly_usd=1))

    def test_bad_timezone(self):
        self.rejects(lambda p: p["schedule"].update(timezone="Unknown/Zone"))

    def test_bad_hour(self):
        self.rejects(lambda p: p["schedule"].update(hour=24))

    def test_duplicate_day(self):
        self.rejects(lambda p: p["schedule"].update(days=["MONDAY", "MONDAY"]))

    def test_unknown_adapter(self):
        self.rejects(lambda p: p["sources"].append({"name": "unknown", "actor": "example/actor", "max_usd": .1, "input": {}, "note": "Sample"}))

    def test_assisted_price_required(self):
        self.rejects(lambda p: (p.update(mode="assisted"), p["providers"].update(jev_input_usd_per_million=0)))

    def test_zero_defaults_preserved(self):
        p = validate(self.p)
        self.assertEqual(p["budget"]["monthly_usd"], 0)
        self.assertEqual(p["sources"], [])
        self.assertEqual(p["schedule"]["days"], [])
        self.assertEqual(p["rules"]["min_hourly_usd"], 0)

    def test_files_and_no_overwrite(self):
        with tempfile.TemporaryDirectory(prefix="lh-build-test-") as tmp:
            out = Path(tmp) / "output"
            build(self.p, out)
            manifest = json.loads((out / "appsscript.json").read_text())
            self.assertEqual(manifest["runtimeVersion"], "V8")
            self.assertEqual(manifest["timeZone"], "Etc/UTC")
            self.assertEqual((out / "import-template.csv").read_text(), "company,what_they_want,link,website,contact,posted,notes\n")
            before = (out / "Code.gs").read_bytes()
            with self.assertRaises(ValueError):
                build(self.p, out)
            self.assertEqual(before, (out / "Code.gs").read_bytes())

    def cold(self):
        self.p = json.loads((ROOT / "assets/profile.cold.example.json").read_text())
        return self.p["prospecting"]

    def test_cold_profile_keeps_own_accounts_off(self):
        c = self.cold()
        validate(self.p)
        self.assertEqual(c["contacts"]["provider"], "none")
        self.assertEqual(c["contacts"]["monthly_credits"], 0)
        self.assertIn("function finderResult_", render(self.p))

    def test_cold_priority_weights(self):
        self.cold()["cold_priority"]["fit_weight"] = .9
        with self.assertRaisesRegex(ValueError, "sum to one"):
            validate(self.p)

    def test_contact_budget_zero_and_negative(self):
        self.cold()["contacts"]["monthly_credits"] = -1
        with self.assertRaises(ValueError):
            validate(self.p)

    def test_contact_attempt_batch_bounded(self):
        self.cold()["contacts"]["max_rows_per_run"] = 100
        with self.assertRaises(ValueError):
            validate(self.p)

    def test_contact_verification_staleness_bounded(self):
        self.cold()["contacts"]["verification_days"] = 365
        with self.assertRaises(ValueError):
            validate(self.p)

    def test_unimplemented_contact_provider_rejected(self):
        self.cold()["contacts"]["provider"] = "apollo"
        with self.assertRaises(ValueError):
            validate(self.p)

    def test_cold_no_secret_api_key(self):
        self.cold()["contacts"]["api_key"] = "fictional"
        with self.assertRaises(ValueError):
            validate(self.p)

    def test_maps_bounded_and_extra_enrichment_rejected(self):
        self.cold()
        inp = {"searchStringsArray": ["clinic"], "locationQuery": "Example city", "maxCrawledPlacesPerSearch": 10,
               "scrapePlaceDetailPage": False, "scrapeContacts": False, "maximumLeadsEnrichmentRecords": 0,
               "verifyLeadsEnrichmentEmails": False, "maxReviews": 0, "maxImages": 0, "enableCompetitorAnalysis": False}
        self.p["sources"] = [{"name": "company_directory", "actor": "compass/crawler-google-places", "input": inp, "max_usd": .05, "note": "Fictional disabled pilot"}]
        validate(self.p)
        inp["scrapeContacts"] = True
        with self.assertRaises(ValueError):
            validate(self.p)

    def test_cold_generator_outputs_separate_facts_import(self):
        self.cold()
        with tempfile.TemporaryDirectory(prefix="lh-cold-test-") as tmp:
            out = Path(tmp) / "build"
            build(self.p, out)
            self.assertIn("facts,facts_url,hypothesis", (out / "prospect-import-template.csv").read_text())
            self.assertNotIn("posted", (out / "prospect-import-template.csv").read_text())


if __name__ == "__main__":
    unittest.main(verbosity=2)
