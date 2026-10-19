"""成長段階ごとの見た目を撮影する: python3 tools/stage_shots.py <接頭辞> [mobile|pc|both]
段階1〜4に相当するセーブデータを注入し、演出が動いている状態で撮影する。
"""
import functools, http.server, json, os, socketserver, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'worklog', 'screenshots')
prefix = sys.argv[1] if len(sys.argv) > 1 else 'stage'
which = sys.argv[2] if len(sys.argv) > 2 else 'mobile'

def save(total, units, upgrades, specials, unlocked):
    return {"version": 2, "savedAt": 0, "magic": total * 0.05, "totalEarned": total, "totalClicks": 100,
            "units": dict(zip(['spirit', 'mage', 'golem', 'egg'], units)),
            "unitUnlocked": dict(zip(['spirit', 'mage', 'golem', 'egg'], unlocked)),
            "upgrades": dict(zip(['click', 'prod', 'bond'], upgrades)),
            "specials": {k: {"unlocked": True, "bought": True} for k in specials}, "buyMode": "1", "visualMode": "normal"}

STAGES = {
    1: save(60, [2, 0, 0, 0], [1, 0, 0], [], [True, False, False, False]),
    2: save(250000, [24, 14, 4, 0], [8, 5, 1], ['spiritBless'], [True, True, True, False]),
    3: save(3e7, [52, 36, 23, 9], [9, 12, 6], ['spiritBless', 'resonance', 'mageTome', 'golemCore'], [True, True, True, True]),
    4: save(5e9, [100, 80, 65, 53], [13, 24, 16], ['spiritBless', 'resonance', 'mageTome', 'golemCore', 'dragonWake', 'towerAwake'], [True] * 4),
}

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

with socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT)) as httpd:
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch()
        views = []
        if which in ('mobile', 'both'):
            views.append(('mobile', {'width': 390, 'height': 844}, True))
        if which in ('pc', 'both'):
            views.append(('pc', {'width': 1280, 'height': 800}, False))
        for st, data in STAGES.items():
            for name, vp, mobile in views:
                ctx = b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
                ctx.route('https://fonts.googleapis.com/**', lambda r: r.abort())
                page = ctx.new_page()
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                d = dict(data); d['savedAt'] = int(time.time() * 1000) - 500
                page.add_init_script(f"localStorage.setItem('mahou-no-tou.save', {json.dumps(json.dumps(d))})")
                page.goto(f'http://127.0.0.1:{port}/index.html')
                page.wait_for_timeout(2600)
                path = os.path.join(OUT, f'{prefix}_stage{st}_{name}.png')
                if mobile:
                    page.screenshot(path=path, clip={'x': 0, 'y': 0, 'width': 390, 'height': 560})
                else:
                    page.screenshot(path=path)
                dbg = page.evaluate('window.__mt.vis && window.__mt.vis.debug()')
                print('saved', path, 'errors:', errors, 'actors:', dbg and dbg['actors'], 'particles:', dbg and dbg['particles'])
                ctx.close()
        b.close()
    httpd.shutdown()
