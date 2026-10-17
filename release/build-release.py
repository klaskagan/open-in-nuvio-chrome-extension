#!/usr/bin/env python3
"""Build a store ZIP with manifest.json at its root; never edit the personal build."""
import argparse, json, pathlib, re, zipfile
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[1]/'open-in-nuvio')
mode=p.add_mutually_exclusive_group(required=True)
mode.add_argument('--client-id',help='Dedicated release app PUBLIC Client ID only')
mode.add_argument('--draft',action='store_true',help='Unconfigured archive for creating a draft store listing only; do not submit')
p.add_argument('--output',type=pathlib.Path,required=True)
a=p.parse_args()
if a.client_id is not None and not re.fullmatch(r'[A-Za-z0-9_-]{16,128}',a.client_id):p.error('Expected a public Client ID, not JSON, a secret or token bundle.')
manifest=json.loads((a.source/'manifest.json').read_text())
for entry in manifest['content_scripts']:
 for script in entry['js']:
  if not (a.source/script).is_file():p.error('Missing script: '+script)
if a.output.exists():p.error('Output exists; choose a new filename to preserve prior builds.')
a.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.output,'x',zipfile.ZIP_DEFLATED) as archive:
 for file in sorted(a.source.rglob('*')):
  if not file.is_file():continue
  path=file.relative_to(a.source).as_posix()
  if path=='trakt-config.js':archive.writestr(path,'// Public release app ID. No account credentials.\nglobalThis.NuvioTraktConfig=Object.freeze({clientId:'+json.dumps(a.client_id or '')+'});\n')
  else:archive.write(file,path)
with zipfile.ZipFile(a.output) as archive:
 assert 'manifest.json' in archive.namelist() and archive.testzip() is None
if a.draft:print('DRAFT LISTING ONLY: public release OAuth is not configured. Do not submit this archive for publication.')
print('Built '+str(a.output)+' (version '+manifest['version']+'). Test this build under the final store extension ID before uploading.')
