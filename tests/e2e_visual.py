"""視覚演出の E2E テスト(Playwright + Chromium): python3 tests/e2e_visual.py
改修指示書「10. 動作確認」の項目を実際の画面で確認する。
"""
import functools, http.server, json, os, socketserver, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
KEY = 'mahou-no-tou.save'
results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  ({detail})' if detail != '' else ''))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def seed_script(data):
    return f"if(!sessionStorage.getItem('seeded')){{localStorage.setItem('{KEY}', {json.dumps(json.dumps(data))});sessionStorage.setItem('seeded','1')}}"


def save(total, units, unlocked, upgrades=(0, 0, 0), specials=(), vm='normal', magic=0):
    return {"version": 2, "savedAt": int(time.time() * 1000) - 100, "magic": magic, "totalEarned": total,
            "units": dict(zip(['spirit', 'mage', 'golem', 'egg'], units)),
            "unitUnlocked": dict(zip(['spirit', 'mage', 'golem', 'egg'], unlocked)),
            "upgrades": dict(zip(['click', 'prod', 'bond'], upgrades)),
            "specials": {k: {"unlocked": True, "bought": True} for k in specials}, "buyMode": "1", "visualMode": vm}


with socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT)) as httpd:
    port = httpd.server_address[1]
    URL = f'http://127.0.0.1:{port}/index.html'
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch()

        def new_page(vp=None, mobile=True, data=None, clock=None):
            ctx = b.new_context(viewport=vp or {'width': 390, 'height': 844}, is_mobile=mobile, has_touch=mobile)
            ctx.route('https://fonts.googleapis.com/**', lambda r: r.abort())
            page = ctx.new_page()
            page.errors = []
            page.on('pageerror', lambda e: page.errors.append(str(e)))
            if clock:
                page.clock.install(time=clock)
            if data:
                page.add_init_script(seed_script(data))
            page.goto(URL)
            page.wait_for_timeout(300)
            return ctx, page

        dbg = lambda pg: pg.evaluate('window.__mt.vis.debug()')

        # ---- 1〜3: クリック反応・購入で活動が現れる・運搬 -------------------------------
        ctx, page = new_page()
        check('演出が標準モードで動作', dbg(page)['mode'] == 'normal' and dbg(page)['running'])
        check('初期はキャラクターなし', dbg(page)['actorTotal'] == 0)
        before = dbg(page)['particles']
        page.click('#crystal', force=True)
        after = dbg(page)['particles']
        check('1 クリックでクリスタルから粒子が出る', after > before, (before, after))
        page.evaluate('window.__mt.state.magic = 15')
        page.click('[data-unit="spirit"]')
        page.wait_for_timeout(100)
        check('2 精霊を買うと精霊が画面に現れる', dbg(page)['actors'].get('spirit') == 1, dbg(page)['actors'])
        page.evaluate('window.__mt.state.magic = 1e9; window.__mt.state.totalEarned = 1e5')
        page.click('.mode[data-mode="10"]')
        page.click('[data-unit="spirit"]')
        page.wait_for_timeout(700)  # 解放判定と表示計画の更新を待つ
        page.click('[data-unit="mage"]')
        page.wait_for_timeout(700)
        a = dbg(page)['actors']
        check('2 所有数が増えると活動も増え、種類ごとに現れる', a.get('spirit', 0) >= 3 and a.get('mage', 0) >= 1, a)
        d0 = dbg(page)['deliveries']
        page.wait_for_timeout(6000)
        d1 = dbg(page)['deliveries']
        check('3 ユニットが採取→運搬→納入を繰り返す(6秒で納入が発生)', d1 > d0, (d0, d1))
        check('JSエラーなし(運搬)', not page.errors, page.errors)
        ctx.close()

        # ---- 4: 演出と実際の生産量が矛盾しない(固定時計で比較) ---------------------
        T0 = 1_800_000_000_000
        gains = {}
        for vm in ['normal', 'off']:
            data = save(1e5, (40, 10, 0, 0), (True, True, False, False), vm=vm)
            data['savedAt'] = T0
            ctx, page = new_page(data=data, clock=T0)
            page.clock.run_for(1000)
            m0 = page.evaluate('window.__mt.state.magic')
            rate = page.evaluate('MT.productionPerSec(window.__mt.state)')
            page.clock.run_for(20000)
            m1 = page.evaluate('window.__mt.state.magic')
            gains[vm] = (m1 - m0, rate * 20, dbg(page)['deliveries'])
            ctx.close()
        g, expect, deliveries = gains['normal']
        check('4 演出あり: 20秒の増加量 = 生産量×20秒(納入演出で増えない)', abs(g - expect) <= expect * 0.01 + 1, gains['normal'])
        check('4 演出の有無で増加量が同じ', abs(gains['normal'][0] - gains['off'][0]) <= expect * 0.01 + 1, (gains['normal'][0], gains['off'][0]))

        # ---- 5〜6: 成長段階の変化・強化/解放への反応 --------------------------------
        ctx, page = new_page(data=save(1500, (5, 0, 0, 0), (True, False, False, False), magic=100))
        check('5 第1段階で開始', page.inner_text('#stageNum') == '1' and 'cs-1' in page.get_attribute('.stage', 'class'))
        page.evaluate('window.__mt.state.totalEarned = 2500')
        page.wait_for_timeout(400)
        check('5 累計魔力で第2段階に変化', page.inner_text('#stageNum') == '2' and 'crystal_2' in page.get_attribute('#crystalImg', 'src'))
        check('5 段階変化の演出(トースト・発光)', '第2段階' in page.inner_text('#toast') and dbg(page)['effects'] >= 1, page.inner_text('#toast'))
        page.evaluate('window.__mt.state.magic = 0')
        page.wait_for_timeout(300)
        check('5 魔力を使い切っても段階は戻らない', page.inner_text('#stageNum') == '2')
        page.evaluate('window.__mt.state.units.mage = 5; window.__mt.state.totalEarned = 2e4')
        page.wait_for_timeout(400)  # ゴーレムが解放される
        check('6 新ユニット解放で魔法陣の演出', dbg(page)['effects'] >= 1 and page.wait_for_function("document.getElementById('toast').textContent.includes('ゴーレムが解放')", timeout=5000) is not None, (dbg(page)['effects'], page.inner_text('#toast'), page.evaluate('window.__mt.state.unitUnlocked')))
        page.wait_for_timeout(1600)
        e0 = dbg(page)['effects']
        page.evaluate('window.__mt.state.magic = 1e6')
        page.click('.tab[data-tab="upgrades"]')
        page.click('[data-upg="prod"]')
        check('6 強化購入でクリスタル→塔の光の演出', dbg(page)['effects'] > e0, (e0, dbg(page)['effects']))
        lit_before = dbg(page)['plan']['litWindows']
        page.evaluate("Object.assign(window.__mt.state.units, {spirit: 60, mage: 30})")
        page.wait_for_timeout(700)
        check('6 ユニットが増えると塔の窓の明かりが増える', dbg(page)['plan']['litWindows'] > lit_before, (lit_before, dbg(page)['plan']['litWindows']))
        ctx.close()

        # ---- 7: 再読み込みで段階と進行を復元 -------------------------------------------
        ctx, page = new_page(data=save(3e7, (52, 36, 23, 9), (True, True, True, True), (9, 12, 6)))
        s1 = (page.inner_text('#stageNum'), page.evaluate('JSON.stringify(window.__mt.state.units)'))
        page.reload()
        page.wait_for_timeout(300)
        s2 = (page.inner_text('#stageNum'), page.evaluate('JSON.stringify(window.__mt.state.units)'))
        check('7 再読み込み後も第3段階・所有数が復元', s1 == s2 and s1[0] == '3', (s1, s2))
        check('7 再読み込み時は段階上昇の演出を出さない', page.is_hidden('#toast') or '成長' not in page.inner_text('#toast'))
        page.wait_for_timeout(1500)
        check('7 運搬アニメーションが自然に再開', dbg(page)['actorTotal'] > 0 and dbg(page)['running'])
        ctx.close()

        # ---- 8: 大量所有でも描画負荷が過剰にならない -------------------------------------
        ctx, page = new_page(data=save(1e15, (5000, 4000, 3000, 2000), (True,) * 4, (30, 40, 20),
                                       ('spiritBless', 'resonance', 'mageTome', 'golemCore', 'dragonWake', 'towerAwake')))
        page.wait_for_timeout(1000)
        f0 = dbg(page)['frames']
        t0 = time.time()
        page.wait_for_timeout(3000)
        info = dbg(page)
        fps = (info['frames'] - f0) / (time.time() - t0)
        check('8 大量所有でもキャラクター数は上限内(14体以下)', info['actorTotal'] <= 14, info['actors'])
        check('8 粒子数は上限内(160以下)', info['particles'] <= 160, info['particles'])
        check('8 描画は30fps以下に制限', fps <= 32, round(fps, 1))
        cost = page.evaluate("""(() => { const t = performance.now(); for (let i = 0; i < 200; i++) window.__mt.render(); return (performance.now() - t) / 200; })()""")
        check('8 数値表示の更新は1回1ms未満', cost < 1, round(cost, 3))
        # 控えめ・オフ
        page.click('.tab[data-tab="menu"]')
        page.click('.vmode[data-vmode="low"]')
        page.wait_for_timeout(600)
        low = dbg(page)
        check('8 控えめモードでキャラクターが減る', low['actorTotal'] < info['actorTotal'], (low['actorTotal'], info['actorTotal']))
        page.click('.vmode[data-vmode="off"]')
        f_off = dbg(page)['frames']
        page.wait_for_timeout(800)
        check('8 オフで描画ループが止まる', not dbg(page)['running'] and dbg(page)['frames'] == f_off)
        page.reload()
        page.wait_for_timeout(300)
        check('8 演出設定が保存・復元される', page.evaluate('window.__mt.state.visualMode') == 'off' and not dbg(page)['running'])
        page.click('.tab[data-tab="menu"]')
        page.click('.vmode[data-vmode="normal"]')
        page.evaluate("Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); document.dispatchEvent(new Event('visibilitychange'))")
        f_h = dbg(page)['frames']
        page.wait_for_timeout(600)
        check('8 タブ非表示中は描画しない', not dbg(page)['running'] and dbg(page)['frames'] == f_h)
        page.evaluate("Object.defineProperty(document, 'hidden', {configurable: true, get: () => false}); document.dispatchEvent(new Event('visibilitychange'))")
        page.wait_for_timeout(400)
        check('8 タブ復帰で描画再開', dbg(page)['running'])
        check('JSエラーなし(大量所有)', not page.errors, page.errors)
        ctx.close()

        # ---- 9: スマホ・PC ------------------------------------------------------------------
        for name, vp, mobile in [('スマホ320px', {'width': 320, 'height': 640}, True), ('スマホ390px', {'width': 390, 'height': 844}, True),
                                 ('PC1280px', {'width': 1280, 'height': 800}, False)]:
            ctx, page = new_page(vp=vp, mobile=mobile, data=save(5e9, (100, 80, 65, 53), (True,) * 4, (13, 24, 16)))
            page.wait_for_timeout(500)
            sw = page.evaluate('document.documentElement.scrollWidth')
            cv = page.evaluate("(() => { const c = document.getElementById('fx').getBoundingClientRect(), s = document.querySelector('.stage').getBoundingClientRect(); return Math.abs(c.width - s.width) < 1 && Math.abs(c.height - s.height) < 1; })()")
            m0 = page.evaluate('window.__mt.state.totalClicks')
            page.click('#crystal', force=True)
            clicked = page.evaluate('window.__mt.state.totalClicks') == m0 + 1
            # 演出キャンバスがタップを奪わないこと
            pe = page.evaluate("getComputedStyle(document.getElementById('fx')).pointerEvents")
            check(f'9 {name}: 横スクロールなし・演出が表示領域に一致・タップ可能', sw <= vp['width'] and cv and clicked and pe == 'none', (sw, cv, clicked, pe))
            check(f'9 {name}: 第4段階の演出が動作・JSエラーなし', dbg(page)['plan']['stage'] == 4 and dbg(page)['running'] and not page.errors, page.errors)
            ctx.close()
        b.close()
    httpd.shutdown()

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)}/{len(results)} passed')
sys.exit(1 if failed else 0)
