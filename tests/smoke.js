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
  await shot("03-shift-empty");
  await click(143, 234); // 呼出
  await page.waitForTimeout(2200);
  await shot("04-applicant");
  // 受取口の ID を机へ
  const tray = await page.evaluate(() => V.game.scene.trayLayout().map(m => ({ kind: m.d.kind, x: m.x + m.w / 2, y: m.y + 6 })));
  const id = tray.find(t => t.kind === "id");
  await drag(id.x, id.y, 260, 120);
  // 採血
  await drag(183, 101, 60, 245);
  await page.waitForTimeout(1800);
  const tray2 = await page.evaluate(() => V.game.scene.trayLayout().map(m => ({ kind: m.d.kind, x: m.x + m.w / 2, y: m.y + 6 })));
  const vial = tray2.find(t => t.kind === "vial");
  await drag(vial.x, vial.y, 420, 110);
  await page.waitForTimeout(1700);
  await shot("05-analyzed");
  // 照合:ID の署名と解析結果
  await page.keyboard.press("f");
  const idDoc = await page.evaluate(() => { const d = V.game.scene.items.find(d => d.kind === "id"); return { x: d.x, y: d.y }; });
  await click(idDoc.x + 50, idDoc.y + 62);
  await page.mouse.move(art(420, 108).x, art(420, 108).y);
  await shot("06-inspect");
  await click(420, 108);
  await page.keyboard.press("f");
  // 規則冊子を開く
  await drag(186, 246, 230, 150);
  await shot("07-rules");
  await drag(240, 155, 186, 246);
  // 判定
  await click(440, 262);
  await page.waitForTimeout(400);
  await shot("08-drawer");
  await click(286, 228); // 適格
  await page.waitForTimeout(300);
  const idDoc2 = await page.evaluate(() => { const d = V.game.scene.items.find(d => d.kind === "id"); return { x: d.x, y: d.y }; });
  await shot("09-stamped");
  await drag(idDoc2.x + 10, idDoc2.y + 30, 50, 245);
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => ({ stats: V.game.scene.stats, cur: !!V.game.scene.cur }));
  console.log("after first applicant", JSON.stringify(st));
  // 時間を進めて夜へ
  await page.evaluate(() => { V.game.scene.clock = 600; });
  await page.waitForTimeout(2500);
  await shot("10-night");
  console.log("errors", JSON.stringify(errors));
  await browser.close();
  server.close();
})().catch(e => { console.error(e); server.close(); process.exit(1); });
