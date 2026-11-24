"""Build the standalone SideQuest showcase from the extension sources."""
import base64
import json
import re
import sys
from pathlib import Path

def build_showcase(source, output):
    html = (source / 'arcade.html').read_text()
    images = {p.stem.title(): 'data:image/webp;base64,' + base64.b64encode(p.read_bytes()).decode() for p in sorted((source/'art').glob('*.webp'))}
    css = (source/'arcade.css').read_text().replace('art/hero.webp', images['Hero'])
    html = html.replace('<link rel="stylesheet" href="arcade.css">','<style>'+css+'</style>')
    html = html.replace('<script src="engine.js">','<script>window.SQ_ART='+json.dumps(images)+';</script>\n<script src="engine.js">')
    def inline(match):
        js = (source/match.group(1)).read_text().replace('</script',r'<\/script')
        return '<script>\n'+js+'\n</script>'
    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
    output.write_text(html)
if __name__=='__main__':
    base=Path(__file__).resolve().parent
    build_showcase(base/'SideQuest', Path(sys.argv[1]) if len(sys.argv)>1 else base/'SideQuest-Arcade.html')
