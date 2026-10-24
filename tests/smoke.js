// VALID 起動確認:ローカルサーバーで開き、タイトル→導入→新聞→審査→夜まで進めて画面を撮る
// 使い方: node tests/smoke.js [出力フォルダ]
const path = require("path");
const http = require("http");
const fs = require("fs");
const { chromium } = require(process.env.PW || "playwright");

const root = path.resolve(__dirname, "..");
const out = process.argv[2] || path.join(root, "tests", "shots");
fs.mkdirSync(out, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
const server = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split("?")[0]) === "/" ? "index.html" : decodeURIComponent(q.url.split("?")[0]));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" }); r.end(d); });
}).listen(0);

(async () => {
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => V.game && V.game.scene);
  const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, name + ".png") }); };
  const art = (x, y) => ({ x: x * 2, y: y * 2 });
  const click = async (x, y, opt) => { const p = art(x, y); await page.mouse.click(p.x, p.y, opt); };
  const drag = async (x1, y1, x2, y2) => { const a = art(x1, y1), b = art(x2, y2); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up(); };

  await shot("01-title");
  await click(240, 184); // はじめから
  for (let i = 0; i < 5; i++) await click(240, 135);
  await page.waitForTimeout(8000);
  await click(240, 135);
  await shot("02-news");
  await click(390, 247); // 業務を始める
  await page.waitForTimeout(800);
  await shot("03-briefing");
  await click(310, 194); // 業務開始
  await click(132, 16); // 掲示板をクリックして呼び出す
  await page.waitForTimeout(2200);
  await shot("04-applicant");
  const trayPos = kind => page.evaluate(k => { const d = V.game.scene.items.find(d => d.loc === "tray" && d.kind === k); const [w, h] = V.docs.MINI[k]; return { x: d.tx + w / 2, y: d.ty + h / 2 }; }, kind);
  const id = await trayPos("id");
  await drag(id.x, id.y, 415, 229); // IDカードを判定端末の読み取り台へ置く
  await page.waitForTimeout(600);
  await shot("04b-registry");
  await click(319, 90); // 計器の【採血】
  await page.waitForTimeout(1900);
  await shot("05-sampled");
  await click(447, 260); // 照合
  const g = await page.evaluate(() => V.game.scene.fieldsAt().find(f => f.key === "reg.genome"));
  const sq = await page.evaluate(() => V.game.scene.fieldsAt().find(f => f.key === "seq"));
  if (!g || !sq) errors.push("登録簿の署名か検体の欄が照合に出ない");
  await click(g.x + 10, g.y + 4);
  await page.mouse.move(art(sq.x + 20, sq.y + 4).x, art(sq.x + 20, sq.y + 4).y);
  await shot("06-inspect");
  await click(sq.x + 20, sq.y + 4);
  await click(447, 260);
  // 規則冊子:つかむと開く
  const a1 = art(107, 257), a2 = art(300, 180);
  await page.mouse.move(a1.x, a1.y); await page.mouse.down(); await page.mouse.move(a2.x, a2.y, { steps: 6 });
  await shot("07-rules-held"); await page.mouse.up();
  await shot("07-rules");
  const rb = await page.evaluate(() => ({ x: V.game.scene.rules.x, y: V.game.scene.rules.y }));
  await drag(rb.x + 4, rb.y + 20, 107, 257);
  // 登録簿を端末に重ねて置いても、はじかれずにその場に置かれ、端末は上に見えたまま
  const regNow = await page.evaluate(() => { const d = V.game.scene.items.find(d => d.kind === "reg"); return { x: d.x, y: d.y }; });
  await drag(regNow.x + 10, regNow.y + 30, 330, 200);
  const moved = await page.evaluate(() => { const d = V.game.scene.items.find(d => d.kind === "reg"); return { x: d.x, y: d.y }; });
  console.log("registry dropped at", JSON.stringify(moved));
  if (moved.x !== regNow.x + (330 - (regNow.x + 10)) || moved.y !== regNow.y + (200 - (regNow.y + 30))) errors.push("登録簿が落とした場所からずれた");
  await shot("07c-under-terminal");
  // 机の右下へはみ出すほど置いても、一部は机に残る
  await drag(moved.x + 5, moved.y + 5, 478, 268);
  const edge = await page.evaluate(() => { const d = V.game.scene.items.find(d => d.kind === "reg"); return { x: d.x, y: d.y, w: d.size().w, h: d.size().h }; });
  console.log("registry at edge", JSON.stringify(edge));
  if (480 - edge.x < edge.w * 0.3 || 270 - edge.y < edge.h * 0.3) errors.push("登録簿が机からほとんど消えた");
  await shot("07d-edge");
  await drag(edge.x + 3, edge.y, 140, 130);
  // 規則冊子のページをめくる
  await click(107, 257);
  const rbx = await page.evaluate(() => ({ x: V.game.scene.rules.x, y: V.game.scene.rules.y, w: V.game.scene.rules.w, h: V.game.scene.rules.h }));
  await click(rbx.x + rbx.w - 4, rbx.y + rbx.h / 2);
  const pg = await page.evaluate(() => ({ page: V.game.scene.rules.page, loc: V.game.scene.rules.loc, inspect: V.game.scene.inspect }));
  console.log("rules after flip click", JSON.stringify(pg), JSON.stringify(rbx));
  if (pg.page !== 1) {
    errors.push("規則冊子のページがめくれない");
  }
  await page.waitForTimeout(40);
  await shot("07e-flip");
  await page.waitForTimeout(400);
  await shot("07f-spread2");
  await drag(rbx.x + rbx.w / 2, rbx.y + rbx.h - 2, 107, 257);
  // 判定端末:【判定】を押すとキーがせり上がる
  await click(461, 210);
  await page.waitForTimeout(500);
  await shot("08-keys");
  await click(461, 223); // 適格
  await page.waitForTimeout(400);
  await shot("09-ejected");
  const idDoc2 = await page.evaluate(() => { const d = V.game.scene.items.find(d => d.kind === "id"); return { x: d.x, y: d.y, loc: d.loc, stamp: d.stamp }; });
  console.log("card after verdict", JSON.stringify(idDoc2));
  if (idDoc2.loc !== "desk" || idDoc2.stamp !== "approve") errors.push("判定のあとカードが押し出されない");
  await drag(idDoc2.x + 10, idDoc2.y + 20, 84, 150);
  await page.waitForTimeout(500);
  await shot("09b-walking");
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => ({ stats: V.game.scene.stats, cur: !!V.game.scene.cur }));
  console.log("after first applicant", JSON.stringify(st));
  // 2人目(作業許可証の期限切れ)をわざと適格にして、違反切符を受け取る
  await click(132, 16);
  await page.waitForTimeout(2200);
  const id2 = await trayPos("id");
  await drag(id2.x, id2.y, 415, 229);
  await click(461, 210); await page.waitForTimeout(500); await click(461, 223); await page.waitForTimeout(300);
  const id3 = await page.evaluate(() => { const d = V.game.scene.items.find(d => d.kind === "id"); return { x: d.x, y: d.y }; });
  await drag(id3.x + 10, id3.y + 20, 84, 150);
  await page.waitForTimeout(1600);
  await shot("10-citation");
  // 業務終了ボタンはない。18:00 で締め切られる
  await page.waitForFunction(() => !V.game.scene.cur, null, { timeout: 8000 });
  // 時間を進めて夜へ
  await page.evaluate(() => { V.game.scene.clock = 600; });
  await page.waitForTimeout(2500);
  await shot("11-night");
  console.log("errors", JSON.stringify(errors));
  await browser.close();
  server.close();
})().catch(e => { console.error(e); server.close(); process.exit(1); });
