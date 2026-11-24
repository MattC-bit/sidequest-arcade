"""Build the double-click installation guide from the public README (Pandoc 2+)."""
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parents[1]
content = subprocess.check_output(['pandoc', '-f', 'gfm', '-t', 'html5', str(root / 'README.md')], text=True)
# Players opening this offline file already have the download.
import re
content = re.sub(r'Click the green\s*<strong>Code</strong> button on this page,\s*then <strong>Download\s+ZIP</strong>\.', 'Find the downloaded ZIP on your computer.', content)
lead = '<nav aria-label="Contents"><a href="#install-on-a-computer">Install</a><a href="#make-the-game-window-yours">Window controls</a><a href="#what-sidequest-can-see">Privacy</a><a href="#frequently-asked-questions">FAQ</a></nav>'
style = """
:root{color-scheme:dark;font:17px/1.65 system-ui,sans-serif;color:#f0edf5;background:#15121d}
*{box-sizing:border-box}body{max-width:53rem;margin:0 auto;padding:2rem clamp(1rem,5vw,4rem) 4rem}
nav{display:flex;flex-wrap:wrap;gap:1.2rem;border-bottom:1px solid #494052;padding:.5rem 0 1rem}
h1{font-size:clamp(3.2rem,9vw,6.4rem);line-height:.95;letter-spacing:-.075em;margin:2.2rem 0 1rem}
h2{font-size:1.85rem;line-height:1.2;letter-spacing:-.04em;border-top:1px solid #494052;padding-top:1.4rem;margin-top:2rem}
h3{font-size:1.35rem;line-height:1.2}a{color:#c7f583}a:focus-visible{outline:3px solid #d2a7ff}img{width:100%;border-radius:12px}
code{font: .92em ui-monospace,monospace;color:#d6f7af}li{padding:.25rem 0}ol{padding-left:1.5rem}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #494052;text-align:left;padding:.65rem;vertical-align:top}th{color:#c7f583}td:first-child{width:30%}
"""
page = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SideQuest · Install and play</title><style>{style}</style></head><body>{lead}<main>{content}</main></body></html>'
(root / 'START-HERE.html').write_text(page, encoding='utf-8')
