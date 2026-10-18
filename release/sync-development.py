#!/usr/bin/env python3
"""Update an already-loaded unpacked development folder without moving it."""
import argparse
import json
import pathlib
import shutil

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--destination', required=True, type=pathlib.Path,
                    help='Existing unpacked development folder already loaded in Chrome')
args = parser.parse_args()
source = pathlib.Path(__file__).resolve().parents[1] / 'open-in-nuvio'
target = args.destination.expanduser().resolve()
if source.resolve() == target:
    parser.error('Source is already the loaded folder; no synchronization is needed.')
if source.resolve() in target.parents or target in source.resolve().parents:
    parser.error('Source and destination must be separate, non-nested directories.')
manifest_path = target / 'manifest.json'
if not manifest_path.is_file():
    parser.error('Select an existing loaded development folder containing manifest.json.')
current = json.loads(manifest_path.read_text())
updated = json.loads((source / 'manifest.json').read_text())
if current.get('manifest_version') != 3 or current.get('background', {}).get('service_worker') != 'background.js':
    parser.error('Destination does not look like this extension.')
if current.get('key'):
    parser.error('Destination has a fixed public key; use the ordinary development installation, not a release-ID test copy.')
# Keep personal app configuration; account tokens/settings live in Chrome storage.
for file in source.rglob('*'):
    if not file.is_file():
        continue
    relative = file.relative_to(source)
    if relative.as_posix() in ('manifest.json', 'trakt-config.js'):
        continue
    destination = target / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(file, destination)
manifest_path.write_text(json.dumps(updated, indent=2) + '\n')
print(f'Updated development folder in place: {target}')
print(f'Version: {updated["version"]}. Personal app configuration preserved; no files deleted.')
print('Reload this extension in chrome://extensions, then refresh supported website tabs.')
