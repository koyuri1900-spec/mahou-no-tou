"""1ファイル版(dist/mahou-no-tou.html)を file:// で直接開いて動作確認: python3 tests/single_file_check.py"""
import os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
URL = 'file://' + os.path.join(ROOT, 'dist', 'mahou-no-tou.html')
ok = True
def check(name, cond, d=''):
    global ok
    ok &= bool(cond)
    print(('PASS ' if cond else 'FAIL ') + name, d if not cond else '')
with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vp, mobile in [('スマホ', {'width': 390, 'height': 844}, True), ('PC', {'width': 1280, 'height': 800}, False)]:
        ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile)
        ctx.route('https://fonts.googleapis.com/**', lambda r: r.abort())
        page = ctx.new_page()
        errs, local_reqs, broken = [], [], []
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('request', lambda r: local_reqs.append(r.url) if r.url.startswith('file://') and not r.url.endswith('mahou-no-tou.html') else None)
        page.goto(URL)
        page.wait_for_timeout(800)
        broken = page.evaluate("[...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.className)")
        for _ in range(20):
            page.click('#crystal', force=True)
        page.click('[data-unit="spirit"]')
        page.wait_for_timeout(800)
        st = page.evaluate('({m: window.__mt.state.magic, s: window.__mt.state.units.spirit, v: window.__mt.vis.debug()})')
        check(f'{label}: 起動・タップ・購入', st['s'] == 1 and not errs, (st, errs))
        check(f'{label}: 外部ファイルを読み込まない', not local_reqs, local_reqs)
        check(f'{label}: 画像がすべて表示される', not broken, broken)
        check(f'{label}: 演出が動作(精霊が出現)', st['v']['actors'].get('spirit') == 1 and st['v']['running'], st['v'])
        page.reload(); page.wait_for_timeout(300)
        check(f'{label}: 再読み込みで進行が残る', page.evaluate('window.__mt.state.units.spirit') == 1)
        if mobile:
            page.screenshot(path=os.path.join(ROOT, 'worklog', 'screenshots', '04_single_file_mobile.png'), clip={'x': 0, 'y': 0, 'width': 390, 'height': 700})
        ctx.close()
    b.close()
print('ALL PASS' if ok else 'SOME FAILED')
sys.exit(0 if ok else 1)
