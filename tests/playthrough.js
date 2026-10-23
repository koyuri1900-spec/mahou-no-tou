// VALID 通しプレイ:3日間を自動で進め、各日の画面を撮る。最後に終幕まで到達することを確かめる。
// 使い方: node tests/playthrough.js [出力フォルダ]
const path = require("path");
const http = require("http");
const fs = require("fs");
const { chromium } = require(process.env.PW || "playwright");

const root = path.resolve(__dirname, "..");
const out = process.argv[2] || path.join(root, "tests", "shots");
fs.mkdirSync(out, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  const p = path.join(root, u === "/" ? "index.html" : u);
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" }); r.end(d); });
}).listen(0);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`http://localhost:${server.address().port}/`);
  await page.waitForFunction(() => V.game && V.game.scene);
  const shot = async name => { await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, name + ".png") }); };

  // 現在の申請者を「正しく」処理する(書類を並べ、検体を取り、欠点を指摘し、正しい判定を下す)
  const setup = () => page.evaluate(() => {
    const s = V.game.scene, A = s.cur;
    const pos = { id: [200, 92], ticket: [200, 166], permit: [300, 166], med: [290, 96], envelope: [300, 214] };
    s.items.filter(d => d.owner === A && pos[d.kind]).forEach(d => { d.loc = "desk"; [d.x, d.y] = pos[d.kind]; d.dirty = true; });
    s.analyzer = { seq: A.sample, fresh: A.fresh, busy: 0, owner: A };
    if (s.day >= 3) s.loupe = { hair: A.hairSample, owner: A };
    return { name: A.name, best: V.applicant.truth(A).best, flaws: V.applicant.flaws(A).map(f => f.type) };
  });
  const finish = () => page.evaluate(() => {
    const s = V.game.scene, A = s.cur, t = V.applicant.truth(A);
    V.applicant.flaws(A).forEach(f => A.found.add(f.type));
    s.decide(t.best);
    if (t.best !== "detain") {
      s.items.filter(d => d.owner === A && ["id", "ticket", "permit", "med"].includes(d.kind)).forEach(d => d.loc = "tray");
      s.checkLeave();
    }
    return t.best;
  });
  const waitEmpty = () => page.waitForFunction(() => !V.game.scene.cur, null, { timeout: 8000 });
  const call = async () => { await page.evaluate(() => V.game.scene.callNext()); await page.waitForFunction(() => V.game.scene.phase === "present" && V.game.scene.items.some(d => d.kind === "id"), null, { timeout: 5000 }); };

  // タイトル → 導入を飛ばして新聞へ
  await page.evaluate(() => { V.game.state = { day: 1, credits: 40, airi: 3, flags: {}, stats: { processed: 0, correct: 0, citations: 0 } }; V.game.toNews(); });
  const log = [];
  for (const day of [1, 2, 3]) {
    await shot(`d${day}-0-news`);
    await page.evaluate(() => V.game.toShift());
    await page.waitForTimeout(700);
    const n = day === 3 ? 6 : 7;
    for (let i = 0; i < n; i++) {
      await call();
      const info = await setup();
      if (day === 2 && info.name.includes("プラム")) {
        await page.evaluate(() => { V.game.scene.rules.loc = "desk"; V.game.scene.rules.x = 316; V.game.scene.rules.y = 114; V.game.scene.rules.page = 1; V.game.scene.rules.dirty = true; });
        await shot("d2-plum");
        await page.evaluate(() => { const s = V.game.scene; s.rules.loc = "slot"; s.rules.x = 172; s.rules.y = 230; s.rules.dirty = true; });
      }
      if (day === 3 && info.name.includes("アデイェミ")) {
        await page.evaluate(() => { V.game.scene.xray = true; });
        await shot("d3-sol-xray");
        await page.evaluate(() => { V.game.scene.xray = false; });
      }
      if (day === 1 && info.name.includes("ヴェルナー")) {
        await page.evaluate(() => { const s = V.game.scene; s.inspect = true; s.flashes.push({ r: { x: 214, y: 150, w: 98, h: 11 }, t: 5, c: V.RED }, { r: { x: 378, y: 102, w: 98, h: 14 }, t: 5, c: V.RED }); s.say("you", "ゲノム署名と解析結果が合わない。"); s.say("them", "…機械がおかしいんだ。もう一度採ってくれ。"); });
        await shot("d1-kai-inspect");
        await page.evaluate(() => { V.game.scene.inspect = false; });
      }
      const v = await finish();
      log.push(`DAY${day} ${info.name} 欠点[${info.flaws.join(",")}] → ${v}`);
      if (day === 2 && info.name.includes("マロ")) await shot("d2-broker-leaving");
      await waitEmpty();
    }
    await page.evaluate(() => { V.game.scene.clock = 600; });
    await page.waitForFunction(() => V.game.scene.constructor.name === "Night", null, { timeout: 10000 });
    await shot(`d${day}-9-night`);
    const st = await page.evaluate(() => ({ stats: V.game.scene.result.stats, credits: V.game.state.credits }));
    log.push(`DAY${day} 夜 ${JSON.stringify(st)}`);
    await page.evaluate(() => { const n = V.game.scene; n.onDown(n.go.x + 1, n.go.y + 1); });
  }
  await page.waitForTimeout(6500);
  await shot("z-finale");
  const scene = await page.evaluate(() => V.game.scene.constructor.name);
  const flags = await page.evaluate(() => V.game.state.flags);
  console.log(log.join("\n"));
  console.log("final scene", scene, "flags", JSON.stringify(flags));
  console.log("errors", JSON.stringify(errors));
  await browser.close(); server.close();
  if (errors.length || scene !== "Finale") process.exit(1);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
