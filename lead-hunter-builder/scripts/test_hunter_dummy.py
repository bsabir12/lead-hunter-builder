#!/usr/bin/env python3
"""Optional network contract check: documented free dummy API, fictional inputs only."""
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def run():
    cases = [
        ("email-finder", {"domain": "example.com", "full_name": "Example Person"}, ["email", "first_name", "last_name", "verification"]),
        ("domain-search", {"domain": "example.com", "type": "personal", "job_titles": "owner", "limit": 5}, ["domain", "emails"]),
        ("email-verifier", {"email": "example.person@example.com"}, ["email", "status", "accept_all"]),
    ]
    for endpoint, params, fields in cases:
        request = Request("https://api.hunter.io/v2/" + endpoint + "?" + urlencode(params), headers={"X-API-KEY": "test-api-key"})
        with urlopen(request, timeout=30) as response:
            assert response.status == 200, "Unexpected dummy HTTP status"
            data = json.load(response)["data"]
        assert isinstance(data, dict) and all(key in data for key in fields), "Dummy response schema changed: " + endpoint
        if endpoint == "domain-search":
            assert isinstance(data["emails"], list), "Expected a candidate array"
        print("PASS documented dummy API schema: " + endpoint)
    print("No real-person lookups or account credits used. This does not measure contact accuracy or coverage.")


if __name__ == "__main__":
    run()
