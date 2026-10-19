"""ゲーム全体を1つのHTMLファイルにまとめる: python3 tools/build_single.py
出力: dist/mahou-no-tou.html(CSS・JavaScript・画像をすべて埋め込み。外部ファイル不要)
"""
import glob, os, re
from urllib.parse import quote
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'dist')
read = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()

assets = {}
for path in sorted(glob.glob(os.path.join(ROOT, 'assets', '*.svg'))):
    rel = 'assets/' + os.path.basename(path)
    # base64 ではなくURLエンコードで埋め込む(ファイルが小さく、圧縮も効く)
    assets[rel] = 'data:image/svg+xml,' + quote(open(path, encoding='utf-8').read().strip(), safe=' =:/;,.-_')

html = read('index.html')
# HTML内の画像参照を埋め込みデータに置き換える
html = re.sub(r'(src|href)="(assets/[^"]+\.svg)"', lambda m: f'{m.group(1)}="{assets[m.group(2)]}"', html)
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + read('style.css') + '\n</style>')
asset_js = 'window.MT_ASSETS = {' + ','.join(f'"{k}":"{v}"' for k, v in assets.items()) + '};'
scripts = ['game.js', 'save.js', 'visuals.js', 'ui.js']
for i, name in enumerate(scripts):
    tag = f'<script src="{name}"></script>'
    assert tag in html, tag
    body = read(name).replace('</script', '<\\/script')
    if i == 0:
        body = asset_js + '\n' + body
    html = html.replace(tag, '<script>\n' + body + '\n</script>')
assert 'src="assets/' not in html and "href=\"assets/" not in html
os.makedirs(OUT, exist_ok=True)
out = os.path.join(OUT, 'mahou-no-tou.html')
open(out, 'w', encoding='utf-8').write(html)
print('built', out, round(os.path.getsize(out) / 1024), 'KB')
