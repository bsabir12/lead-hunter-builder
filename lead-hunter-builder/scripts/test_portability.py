#!/usr/bin/env python3
"""Build genuinely different service profiles and optionally test the extracted ZIP. No networking."""
import argparse
import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))
from build import build, validate


def profiles(skill):
    base = json.loads((skill / 'assets/profile.example.json').read_text())
    cold = json.loads((skill / 'assets/profile.cold.example.json').read_text())['prospecting']
    cases = [
        ('clinic-books', 'Bookkeeping for independent clinics', 'cold', 'finance manager', 'jurisdiction', 'Tax jurisdiction', 'Match our supported accounting and tax experience to the buyer'),
        ('factory-maintenance', 'Industrial equipment maintenance', 'mixed', 'maintenance manager', 'equipment', 'Equipment type', 'Match supported machinery to the actual plant'),
        ('security-audit', 'IT security assessments for software businesses', 'demand', 'IT director', 'environment', 'IT environment', 'Match supported infrastructure to the evidenced project'),
    ]
    result = []
    for slug, offer, approach, role, field, label, purpose in cases:
        p = copy.deepcopy(base)
        p['business'].update(name='Fictional ' + slug, offer=offer, buyer='Owner-defined professional buyer', first_offer='A discussion scoped to supported evidence', services=[offer], portfolio=[])
        p['decision_roles'] = [role]
        p['fit'] = [
            {'key': 'fit_buyer', 'label': 'Relevant business', 'evidence': 'The buyer is a business in our defined segment.', 'weight': 1},
            {'key': 'fit_service', 'label': 'Service compatibility', 'evidence': 'Supported company facts or an explicit source request concern ' + offer + '.', 'weight': 2},
        ]
        p['readiness'] = [
            {'key': 'ready_request', 'label': 'Explicit request', 'evidence': 'The original source explicitly requests external help; company suitability alone is insufficient.', 'weight': 2},
            {'key': 'ready_timing', 'label': 'Actual timing', 'evidence': 'A current deadline or project start is stated by the buyer.', 'weight': 1},
        ]
        p['sheet'] = {'optional_fields': [{'key': 'service_' + field, 'label': label, 'purpose': purpose}], 'show_optional_core': ['country']}
        if approach != 'demand':
            p['prospecting'] = copy.deepcopy(cold)
            p['prospecting'].update(approach=approach, suitability='Suitable businesses can be identified from supported structural facts.', limitations=['Fit alone does not establish hiring intent or readiness.'])
        validate(p)
        result.append((slug, p))
    return result


def check(skill, folder):
    # Import from this exact installation; extracted packages must be self-contained.
    spec = importlib.util.spec_from_file_location('portable_builder', skill / 'scripts/build.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for slug, p in profiles(skill):
        out = folder / slug
        module.build(p, out)
        for runner, arg in [('test_engine.mjs', out / 'Code.gs'), ('test_contacts.mjs', out)]:
            run = subprocess.run(['node', str(skill / 'scripts' / runner), str(arg)], capture_output=True, text=True)
            if run.returncode:
                raise RuntimeError(run.stdout + run.stderr)
        if not (out / 'FIELD-GUIDE.md').is_file() or p['sources'] or p['budget']['monthly_usd'] or p['schedule']['days']:
            raise RuntimeError('Novice no-spend project contract failed')
        print('PASS ' + slug + ': generated Apps Script + engine/contact contracts; optional field guide; own accounts and schedules off')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='lh-portability-') as tmp:
        folder = Path(tmp)
        check(SKILL, folder / 'source-builds')
        if args.archive:
            with zipfile.ZipFile(args.archive) as archive:
                expected = 'lead-hunter-builder/'
                for entry in archive.infolist():
                    if not entry.filename.startswith(expected) or '..' in Path(entry.filename).parts or entry.filename.startswith('/'):
                        raise ValueError('Unsafe archive path')
                archive.extractall(folder / 'extracted')
            check(folder / 'extracted/lead-hunter-builder', folder / 'archive-builds')
            print('PASS extracted package is self-contained and uses only its bundled templates, generator and tests')
    print('No external requests, accounts, spending, native Sheets claims or schedules.')


if __name__ == '__main__':
    main()
