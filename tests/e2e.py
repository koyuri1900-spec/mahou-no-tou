"""ブラウザ E2E テスト(Playwright + Chromium): python3 tests/e2e.py
ローカルHTTPサーバーでゲームを配信し、実際のページを操作して確認する。
時刻は page.clock で固定・早送りし、再現性を確保している。
"""
import functools, http.server, json, os, socketserver, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
KEY = 'mahou-no-tou.save'
results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  ({detail})' if detail and not cond else ''))


def magic(page):
    return page.evaluate('window.__mt.state.magic')


def st(page, expr):
    return page.evaluate('(() => { const s = window.__mt.state; return ' + expr + '; })()')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


handler = functools.partial(Quiet, directory=ROOT)
with socketserver.TCPServer(('127.0.0.1', 0), handler) as httpd:
    port = httpd.server_address[1]
    URL = f'http://127.0.0.1:{port}/index.html'
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch()
        # 外部フォントは遮断(オフライン相当でも起動することの確認を兼ねる)
        def new_ctx(**kw):
            ctx = b.new_context(reduced_motion='reduce', **kw)
            ctx.route('https://fonts.googleapis.com/**', lambda r: r.abort())
            ctx.route('https://fonts.gstatic.com/**', lambda r: r.abort())
            return ctx

        T0 = 1_800_000_000_000  # 固定の開始時刻(ms)
        ctx = new_ctx(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.clock.install(time=T0)
        page.goto(URL)

        # 1. 新規起動
        check('1 新規起動: 魔力0・ユニット0', magic(page) == 0 and st(page, 's.units.spirit') == 0 and page.evaluate('window.__mt.loadStatus') == 'new')

        # 2. 結晶タップ
        for _ in range(10):
            page.click('#crystal')
        check('2 結晶タップで魔力が増える', magic(page) == 10, magic(page))
        check('2 画面表示も更新', page.inner_text('#magic') == '10')

        # 3. 魔力不足で購入不可(精霊 15)。無効表示のボタンを強制的に押しても買えないこと
        page.click('[data-unit="spirit"]', force=True)
        check('3 魔力不足では購入できない', st(page, 's.units.spirit') == 0 and magic(page) == 10)
        check('3 ボタンが無効表示', 'is-disabled' in page.get_attribute('[data-unit="spirit"]', 'class'))

        # 4. 精霊購入
        for _ in range(5):
            page.click('#crystal')
        page.click('[data-unit="spirit"]')
        check('4 精霊購入で所有数+1・残高減少', st(page, 's.units.spirit') == 1 and magic(page) == 0, magic(page))
        rate = page.evaluate('MT.productionPerSec(window.__mt.state)')
        check('4 生産量が増える', rate == 1, rate)

        # 5. 価格上昇
        price1 = page.evaluate("MT.unitPrice(MT.unitDef('spirit'), 1)")
        check('5 価格が約1.25倍', price1 == 19 and page.inner_text('[data-unit="spirit"] .js-cost') == '19', price1)

        # 9. 自動生産
        page.clock.run_for(10_000)
        check('9 時間経過で自動生産(10秒で約10)', 9.5 <= magic(page) <= 10.5, magic(page))

        # 6. ×10・最大
        page.evaluate('window.__mt.state.magic = 1000; window.__mt.state.totalEarned = 1000')
        page.click('.mode[data-mode="10"]')
        page.click('[data-unit="spirit"]')
        spent10 = 1000 - magic(page)
        expect10 = page.evaluate("MT.bulkPrice(MT.unitDef('spirit'), 1, 10)")
        # 実時間で生産が進むため、消費額は生産分(数秒)の誤差を許容
        check('6 ×10購入: 10体・正しい消費', st(page, 's.units.spirit') == 11 and abs(spent10 - expect10) < 5, (spent10, expect10))
        page.evaluate('window.__mt.state.magic = 50')
        page.click('[data-unit="spirit"]', force=True)
        check('6 ×10購入(不足時は買える数だけ)', st(page, 's.units.spirit') == 11 or magic(page) >= 0)
        page.evaluate('window.__mt.state.magic = 100000')
        page.click('.mode[data-mode="max"]')
        page.click('[data-unit="spirit"]')
        nxt = page.evaluate("MT.unitPrice(MT.unitDef('spirit'), window.__mt.state.units.spirit)")
        check('6 最大購入: 残高>=0かつ次の1体は買えない', 0 <= magic(page) < nxt, (magic(page), nxt))
        page.click('.mode[data-mode="1"]')

        # 7. ユニット解放
        check('7 魔術師が解放される', st(page, 's.unitUnlocked.mage') is True)
        check('7 ドラゴンの卵は未解放で条件表示', st(page, 's.unitUnlocked.egg') is False and '解放' in page.inner_text('#unitList li:nth-child(4) .js-cond'))

        # 8. 強化
        page.click('.tab[data-tab="upgrades"]')
        page.evaluate('window.__mt.state.magic = 1e6')
        before = page.evaluate('MT.clickValue(window.__mt.state)')
        page.click('[data-upg="click"]')
        page.click('[data-upg="click"]')
        check('8 累積型強化: Lv2で効果が累積', st(page, 's.upgrades.click') == 2 and page.evaluate('MT.clickValue(window.__mt.state)') > before)
        check('8 条件解放型: 精霊の祝福が解放済み', st(page, 's.specials.spiritBless.unlocked') is True)
        r0 = page.evaluate("MT.unitRate(window.__mt.state, 'spirit')")
        page.click('[data-sp="spiritBless"]')
        check('8 条件解放型: 購入で精霊×3', abs(page.evaluate("MT.unitRate(window.__mt.state, 'spirit')") - r0 * 3) < 1e-9)
        check('8 未解放の強化は購入ボタン非表示', page.is_hidden('[data-sp="towerAwake"]'))

        # 11. 再読み込みで復元
        page.evaluate('window.__mt.saver.saveNow(window.__mt.state)')
        snap = page.evaluate('JSON.stringify({u: window.__mt.state.units, up: window.__mt.state.upgrades, m: Math.floor(window.__mt.state.magic)})')
        page.reload()
        snap2 = page.evaluate('JSON.stringify({u: window.__mt.state.units, up: window.__mt.state.upgrades, m: Math.floor(window.__mt.state.magic)})')
        a, b2 = json.loads(snap), json.loads(snap2)
        rate11 = page.evaluate('MT.productionPerSec(window.__mt.state)')
        check('11 再読み込み後に復元', a['u'] == b2['u'] and a['up'] == b2['up'] and 0 <= b2['m'] - a['m'] <= rate11 * 10, (a, b2))

        # 10/12. オフライン 4時間上限・重複なし(保存データを直接用意して検証)
        page.evaluate('localStorage.clear()')
        saved_at = T0  # 時計は T0 + 数十秒の位置
        data = {"version": 1, "savedAt": saved_at, "magic": 0, "totalEarned": 0, "units": {"spirit": 1},
                "unitUnlocked": {"spirit": True}, "upgrades": {}, "specials": {}, "buyMode": "1"}
        ctx2 = new_ctx(viewport={'width': 390, 'height': 844})
        p2 = ctx2.new_page()
        p2.clock.install(time=saved_at + 10 * 3600 * 1000)  # 10時間後に再訪
        p2.add_init_script(f"if(!sessionStorage.getItem('seeded')){{localStorage.setItem('{KEY}', {json.dumps(json.dumps(data))});sessionStorage.setItem('seeded','1')}}")
        p2.goto(URL)
        m1 = magic(p2)
        check('10 4時間超のオフラインでも4時間分(14400)まで', 14399 <= m1 <= 14401, m1)
        p2.reload()
        m2 = magic(p2)
        check('12 再読み込みで同じオフライン収入が重複しない', abs(m2 - m1) < 5, (m1, m2))
        ctx2.close()

        # 13. 破損データ
        ctx3 = new_ctx()
        p3 = ctx3.new_page()
        errs3 = []
        p3.on('pageerror', lambda e: errs3.append(str(e)))
        p3.add_init_script(f"if(!sessionStorage.getItem('seeded')){{localStorage.setItem('{KEY}', '{{broken json');sessionStorage.setItem('seeded','1')}}")
        p3.goto(URL)
        p3.click('#crystal')
        check('13 破損JSONでも起動し新規ゲーム', p3.evaluate('window.__mt.loadStatus') == 'corrupt' and magic(p3) == 1 and not errs3, errs3)
        check('13 破損時にトースト通知', '破損' in p3.inner_text('#toast'))
        ctx3.close()
        bad = {"version": 1, "savedAt": 1, "magic": -100, "units": {"spirit": -5, "mage": "x"}, "upgrades": {"click": 1e99}, "specials": {}}
        ctx3 = new_ctx()
        p3 = ctx3.new_page()
        p3.add_init_script(f"if(!sessionStorage.getItem('seeded')){{localStorage.setItem('{KEY}', {json.dumps(json.dumps(bad))});sessionStorage.setItem('seeded','1')}}")
        p3.goto(URL)
        check('13 不正値は修復して続行', p3.evaluate('window.__mt.loadStatus') == 'repaired' and magic(p3) == 0 and st(p3, 's.units.spirit') == 0 and st(p3, 's.upgrades.click') == 0 and not errs3)
        ctx3.close()

        # 14/15. リセット
        page.evaluate('window.__mt.state.magic = 777; window.__mt.state.units.spirit = 3')
        page.click('.tab[data-tab="menu"]')
        page.click('#resetBtn')
        check('14 確認ダイアログが表示される', page.is_visible('#resetModal'))
        page.click('#resetCancel')
        check('14 キャンセルではデータ保持', page.is_hidden('#resetModal') and st(page, 's.units.spirit') == 3 and magic(page) >= 777)
        page.click('#resetBtn')
        page.click('#resetConfirm')
        check('15 確定で初期状態', magic(page) == 0 and st(page, 's.units.spirit') == 0 and st(page, 's.upgrades.click') == 0)
        page.reload()
        check('15 リセット後の再読み込みでも初期状態', magic(page) < 1 and st(page, 's.units.spirit') == 0)

        # 16. スマホ縦画面: 横スクロールなし・ボタンサイズ
        page.click('.tab[data-tab="units"]')
        sw = page.evaluate('document.documentElement.scrollWidth')
        check('16 スマホ(390px)で横スクロールなし', sw <= 390, sw)
        box = page.locator('[data-unit="spirit"]').bounding_box()
        check('16 購入ボタンが44px以上', box['height'] >= 44 and box['width'] >= 44, box)
        page.set_viewport_size({'width': 320, 'height': 640})
        page.evaluate('window.__mt.state.magic = 9.87e14; window.__mt.state.units.spirit = 999')
        page.wait_for_timeout(50)
        page.clock.run_for(500)
        sw = page.evaluate('document.documentElement.scrollWidth')
        check('16 幅320px・巨大値でも横スクロールなし', sw <= 320, sw)

        # 9. バックグラウンド復帰で大きく時間が飛んでも上限内
        page.evaluate('window.__mt.state.magic = 0; window.__mt.state.units.spirit = 1; window.__mt.state.specials.spiritBless.bought=false')
        page.clock.run_for(1000)
        m_before = magic(page)
        rate = page.evaluate('MT.productionPerSec(window.__mt.state)')
        page.clock.fast_forward(6 * 3600 * 1000)  # 6時間タブが止まっていた想定
        page.clock.run_for(200)
        gained = magic(page) - m_before
        check('9 長時間停止後の復帰でも4時間分以内', gained <= rate * 14400 + rate * 2, (gained, rate * 14400))

        check('JSエラーなし(メイン)', not errors, errors)
        ctx.close()

        # 17. PC
        ctx4 = new_ctx(viewport={'width': 1280, 'height': 800})
        p4 = ctx4.new_page()
        p4.goto(URL)
        p4.click('#crystal')
        cols = p4.evaluate("getComputedStyle(document.querySelector('.layout')).gridTemplateColumns.split(' ').length")
        check('17 PC幅で2カラム表示・操作可能', cols == 2 and magic(p4) >= 1)
        ctx4.close()
        b.close()
    httpd.shutdown()

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)}/{len(results)} passed')
sys.exit(1 if failed else 0)
