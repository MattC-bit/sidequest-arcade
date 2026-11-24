"""Build player and source ZIPs from the checked-in release files (Python 3)."""
import argparse
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'SideQuest/manifest.json').read_text())['version']
parser = argparse.ArgumentParser()
parser.add_argument('destination', type=Path)
out = parser.parse_args().destination.resolve()
out.mkdir(parents=True, exist_ok=True)

def collect(names):
    files = []
    for name in names:
        path = root / name
        files.extend(sorted(p for p in path.rglob('*') if p.is_file()) if path.is_dir() else [path])
    return files

def write_zip(name, files):
    with ZipFile(out / name, 'w') as archive:
        for path in files:
            info = ZipInfo(path.relative_to(root).as_posix(), (2026, 1, 1, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())

player = collect(['START-HERE.html','LICENSE','ASSETS.md','SideQuest'])
write_zip(f'SideQuest-{version}-install.zip', player)
maintainer = collect(['README.md','INSTALL.md','QA.md','RELEASE.md','package.json','build.py','qa','tools'])
write_zip(f'SideQuest-{version}-source.zip', player + maintainer)
