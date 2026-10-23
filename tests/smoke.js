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
  await click(84, 200); // 業務開始
  await click(132, 16); // 掲示板をクリックして呼び出す
  await page.waitForTimeout(2200);
  await shot("04-applicant");
  const trayPos = kind => page.evaluate(k => { const d = V.game.scene.items.find(d => d.loc === "tray" && d.kind === k); const [w, h] = V.docs.MINI[k]; return { x: d.tx + w / 2, y: d.ty + h / 2 }; }, kind);
  const id = await trayPos("id");
  await drag(id.x, id.y, 290, 150);
  await drag(183, 99, 84, 150); // 採血キットを申請者へ
  await page.waitForTimeout(1800);
  const vial = await trayPos("vial");
  await drag(vial.x, vial.y, 420, 110);
  await page.waitForTimeout(1700);
  await shot("05-analyzed");
  await click(447, 260); // 照合
  const g = await page.evaluate(() => V.game.scene.fieldsAt().find(f => f.key === "id.genome"));
  await click(g.x + 10, g.y + 4);
  await page.mouse.move(art(420, 108).x, art(420, 108).y);
  await shot("06-inspect");
  await click(420, 108);
  await click(447, 260);
  // 規則冊子:つかむと開く
  const a1 = art(107, 257), a2 = art(300, 180);
  await page.mouse.move(a1.x, a1.y); await page.mouse.down(); await page.mouse.move(a2.x, a2.y, { steps: 6 });
  await shot("07-rules-held"); await page.mouse.up();
  await shot("07-rules");
  const rb = await page.evaluate(() => ({ x: V.game.scene.rules.x, y: V.game.scene.rules.y }));
  await drag(rb.x + 20, rb.y + 4, 107, 257);
  // 判定(右側面の収納)
  await click(474, 150);
  await page.waitForTimeout(400);
  await shot("08-drawer");
  await click(437, 127); // 適格
  await page.waitForTimeout(300);
  await shot("09-stamped");
  const idDoc2 = await page.evaluate(() => { const d = V.game.scene.items.find(d => d.kind === "id"); return { x: d.x, y: d.y }; });
  await drag(idDoc2.x + 10, idDoc2.y + 30, 84, 150);
  await page.waitForTimeout(500);
  await shot("09b-walking");
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => ({ stats: V.game.scene.stats, cur: !!V.game.scene.cur }));
  console.log("after first applicant", JSON.stringify(st));
  // 2人目(作業許可証の期限切れ)をわざと適格にして、違反切符を受け取る
  await click(132, 16);
  await page.waitForTimeout(2200);
  const id2 = await trayPos("id");
  await drag(id2.x, id2.y, 290, 150);
  await click(474, 150); await page.waitForTimeout(400); await click(437, 127); await page.waitForTimeout(300);
  const id3 = await page.evaluate(() => { const d = V.game.scene.items.find(d => d.kind === "id"); return { x: d.x, y: d.y }; });
  await drag(id3.x + 10, id3.y + 30, 84, 150);
  await page.waitForTimeout(1600);
  await shot("10-citation");
  // 時間を進めて夜へ
  await page.evaluate(() => { V.game.scene.clock = 600; });
  await page.waitForTimeout(2500);
  await shot("11-night");
  console.log("errors", JSON.stringify(errors));
  await browser.close();
  server.close();
})().catch(e => { console.error(e); server.close(); process.exit(1); });
