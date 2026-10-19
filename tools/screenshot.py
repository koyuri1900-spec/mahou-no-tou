"""作業ログ用スクリーンショット: python3 tools/screenshot.py <出力ファイル名の接頭辞> [--progress]
ローカルHTTPサーバーでゲームを開き、スマホ幅(390px)とPC幅(1280px)で撮影する。
--progress を付けると、少し進めた状態(テスト用セーブを注入)で撮影する。
"""
import http.server, os, socketserver, sys, threading, functools, json, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'worklog', 'screenshots')
prefix = sys.argv[1] if len(sys.argv) > 1 else 'shot'
progress = '--progress' in sys.argv

SAMPLE = {
    "version": 1, "savedAt": 0, "magic": 48200, "totalEarned": 260000, "totalClicks": 812,
    "units": {"spirit": 24, "mage": 14, "golem": 4, "egg": 0},
    "unitUnlocked": {"spirit": True, "mage": True, "golem": True, "egg": False},
    "upgrades": {"click": 8, "prod": 5, "bond": 1},
    "specials": {"spiritBless": {"unlocked": True, "bought": True}, "resonance": {"unlocked": True, "bought": False},
                 "mageTome": {"unlocked": True, "bought": False}},
    "buyMode": "1"
}

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
handler.log_message = lambda *a, **k: None
with socketserver.TCPServer(('127.0.0.1', 0), handler) as httpd:
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, vp, mobile in [('mobile', {'width': 390, 'height': 844}, True), ('pc', {'width': 1280, 'height': 800}, False)]:
            ctx = b.new_context(reduced_motion='reduce', viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
            page = ctx.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            if progress:
                data = dict(SAMPLE); data['savedAt'] = int(time.time() * 1000) - 1000
                page.add_init_script(f"try{{localStorage.setItem('mahou-no-tou.save', {json.dumps(json.dumps(data))})}}catch(e){{}}")
            page.goto(f'http://127.0.0.1:{port}/index.html')
            page.wait_for_timeout(600)
            if not progress:
                for _ in range(5):
                    page.click('#crystal')
                page.wait_for_timeout(200)
            path = os.path.join(OUT, f'{prefix}_{name}.png')
            page.screenshot(path=path, full_page=mobile)
            print('saved', path, 'errors:', errors)
            ctx.close()
        b.close()
    httpd.shutdown()
