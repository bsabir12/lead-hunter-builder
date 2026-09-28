#!/usr/bin/env python3
"""Build/check the allowlisted, credential-free public skill archive."""
import argparse
import hashlib
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SKILL = ROOT / "lead-hunter-builder"
FILES = [
    "SKILL.md", "START-HERE.md", "LICENSE", "agents/openai.yaml",
    "assets/engine.gs", "assets/prospecting.gs", "assets/profile.example.json", "assets/profile.cold.example.json",
    "references/cold-prospecting.md", "references/contact-providers.md", "references/intake.md", "references/sources.md", "references/architecture.md", "references/setup-and-testing.md",
    "scripts/build.py", "scripts/test_builder.py", "scripts/test_engine.mjs", "scripts/cold_contracts.mjs", "scripts/test_hunter_dummy.py",
]
PUBLIC_EXTRA = ["README.md", "LICENSE", "CHANGELOG.md", "VALIDATION.md", ".gitignore", "package.py", ".github/workflows/checks.yml"]
FORBIDDEN = [
    re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|apify_api_[A-Za-z0-9]{12,}|AIza[A-Za-z0-9_-]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|tvly-[A-Za-z0-9_-]{20,})"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"https://docs\.google\.com/spreadsheets/d/[A-Za-z0-9_-]{20,}"),
    re.compile(r"(?:/" + r"Users/|[A-Z]:\\Users\\|\.notion\.site/|\.netlify\.app)", re.I),
    re.compile(r"(?:[?&](?:api[_-]?key|token|access_token|X-Amz-Signature)=[A-Za-z0-9_-]{10,})", re.I),
]


def source_files():
    return [SKILL / f for f in FILES] + [ROOT / f for f in PUBLIC_EXTRA]


def scan():
    for p in source_files():
        if not p.is_file() or p.is_symlink():
            raise ValueError(f"Missing or linked public file: {p.relative_to(ROOT)}")
        content = p.read_text()
        for pattern in FORBIDDEN:
            if pattern.search(content):
                raise ValueError(f"Possible sensitive material in {p.relative_to(ROOT)}; inspect privately")
    if (SKILL / "assets/engine.gs").read_text().count("__BUSINESS_CONFIG__") != 1:
        raise ValueError("Bad engine template marker")


def package(check=False):
    scan()
    target = ROOT / "lead-hunter-builder.zip"
    if not check:
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for f in FILES:
                info = zipfile.ZipInfo("lead-hunter-builder/" + f, (2026, 9, 28, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, (SKILL / f).read_bytes())
    with zipfile.ZipFile(target) as z:
        expected = {"lead-hunter-builder/" + f for f in FILES}
        if set(z.namelist()) != expected or len(z.namelist()) != len(expected):
            raise ValueError("Archive contains unexpected or missing files")
        for f in FILES:
            if z.read("lead-hunter-builder/" + f) != (SKILL / f).read_bytes():
                raise ValueError(f"Archive byte mismatch: {f}")
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    if not check:
        (ROOT / "SHA256SUMS").write_text(digest + "  lead-hunter-builder.zip\n")
    elif (ROOT / "SHA256SUMS").read_text() != digest + "  lead-hunter-builder.zip\n":
        raise ValueError("Checksum mismatch")
    print(f"PASS: {len(FILES)} allowlisted files, byte parity, sensitive-pattern scan and SHA-256. No account data included.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        package(args.check)
    except (OSError, ValueError, zipfile.BadZipFile) as e:
        parser.exit(1, f"Package failed: {e}\n")
