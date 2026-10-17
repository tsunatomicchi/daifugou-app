"""Repackage verified v0.3.2 with display-only CSS/SVG changes.

Game JavaScript is byte-identical after normalizing module namespace, asset
filenames and UI labels; assert this contract on every build.
"""
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).resolve().parent
BASE_URL = 'https://raw.githubusercontent.com/tsunatomicchi/daifugou-app/7f8cb10afd1a1e407abd13b92f2cd8026d06c8b7/downloads/tsunasapo-daifugou-handroute-v0.3.2-plugin.zip'
BASE_SHA = '3f19c035301ef91ec4fe247eb9adaf3b707bee84f23a3f9aaaa850eba89fbdcd'
OLD_ID = 'app_540b2ecfd3774733ac659112dd819c0e'
NEW_ID = 'app_f4204b558fa343a292c37968e9c638f50'
NAME = 'tsunasapo-daifugou-chatview'
VERSION = '0.4.0'
baseline = ROOT / 'baseline-v0.3.2.zip'
if not baseline.exists():
    with urlopen(BASE_URL, timeout=30) as response:
        baseline.write_bytes(response.read())
assert hashlib.sha256(baseline.read_bytes()).hexdigest() == BASE_SHA
with ZipFile(baseline) as archive:
    assert archive.testzip() is None
    original = {entry.filename: archive.read(entry.filename) for entry in archive.infolist() if not entry.is_dir()}
mapping = {}
for name in original:
    renamed = name.replace(OLD_ID, NEW_ID)
    if name.startswith('assets/'):
        p = Path(renamed)
        renamed = str(p.with_name(p.stem + '-ui040' + p.suffix))
    mapping[name] = renamed

def replace_references(text):
    for before, after in sorted(mapping.items(), key=lambda pair: -len(pair[0])):
        text = text.replace(before, after)
        text = text.replace(Path(before).name, Path(after).name)
    return text.replace(OLD_ID, NEW_ID).replace('同期修正版', 'チャット併用版').replace('TSUNASAPO · 0.3.2', 'TSUNASAPO · 0.4.0')

output = {}
faces = 0
for name, raw in original.items():
    data = raw
    if name.endswith(('.js', '.json', '.html', '.css', '.svg')):
        text = replace_references(raw.decode())
        if name.endswith('.svg') and re.search(r'/[a2-9jqk]|/10-', name):
            if 'translate(11.5 30)' in text:
                assert text.count('translate(11.5 30) rotate(0) scale(0.29)') == 2
                text = text.replace('x="11.5" y="20"', 'x="14" y="24"')
                text = text.replace('font-size="18"', 'font-size="24"')
                text = text.replace('translate(11.5 30) rotate(0) scale(0.29)', 'translate(14 41) rotate(0) scale(0.46)')
                faces += 1
        if '/joker-' in name:
            text = text.replace('font-size="10" writing-mode="tb"', 'font-size="14" writing-mode="tb"')
        if name.startswith('assets/CustomOverlay-') and name.endswith('.css'):
            text += '\n' + (ROOT / 'layout.css').read_text()
        if name == 'metadata.json':
            metadata = json.loads(text)
            metadata.update(name=NAME, version=VERSION, versionId=NEW_ID,
                description='つなサポ 大富豪・チャット併用版：安定版v0.3.2の動作を維持。左幅3/5・上高さ4/5の画面、大きい手札とスート。')
            text = json.dumps(metadata, ensure_ascii=False, indent=2) + '\n'
        data = text.encode()
    output[mapping[name]] = data
assert faces == 52
dist = ROOT / 'dist'
if dist.exists():
    shutil.rmtree(dist)
for name, data in output.items():
    path = dist / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
releases = ROOT.parent / 'releases'
releases.mkdir(exist_ok=True)
target = releases / f'{NAME}-v{VERSION}-plugin.zip'
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for name, data in sorted(output.items()):
        archive.writestr(name, data)
with ZipFile(target) as archive:
    assert archive.testzip() is None
    for before, after in mapping.items():
        if before.endswith('.js'):
            assert archive.read(after).decode() == replace_references(original[before].decode())
print(target)
print('PASS: all game JavaScript matches v0.3.2; only namespace, paths and UI labels differ')
