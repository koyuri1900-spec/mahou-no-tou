// 簡易バランスシミュレーション: node tools/simulate.js [時間(分)] [タップ/秒]
// 貪欲法のボットが「回収時間が最短の購入」を繰り返し、主要イベントの到達時刻を表示する。
const MT = require('../game.js');
const minutes = Number(process.argv[2] || 240);
const cps = Number(process.argv[3] || 4);
// 最初の10分だけ積極的にタップし、以降は放置寄り(1/4の頻度)とみなす
const s = MT.newState(0);
const events = [];
const seen = new Set();
function mark(key, t, extra) { if (!seen.has(key)) { seen.add(key); events.push([t, key, extra || '']); } }
const fmtT = (t) => { const m = Math.floor(t / 60), sec = Math.floor(t % 60); return `${String(m).padStart(3)}分${String(sec).padStart(2, '0')}秒`; };

function candidates() {
  const list = [];
  const rate = MT.productionPerSec(s);
  MT.UNITS.forEach((u) => {
    if (!s.unitUnlocked[u.id]) return;
    const price = MT.unitPrice(u, s.units[u.id]);
    const before = rate;
    s.units[u.id]++; const after = MT.productionPerSec(s); s.units[u.id]--;
    list.push({ kind: 'unit', id: u.id, price, gain: after - before });
  });
  MT.CUMULATIVE.forEach((c) => {
    const price = MT.cumPrice(c, s.upgrades[c.id]);
    if (c.id === 'click') { list.push({ kind: 'cum', id: c.id, price, gain: (MT.clickBase(s.upgrades.click + 1) - MT.clickBase(s.upgrades.click)) * curCps }); return; }
    s.upgrades[c.id]++; const after = MT.productionPerSec(s); s.upgrades[c.id]--;
    list.push({ kind: 'cum', id: c.id, price, gain: after - rate });
  });
  MT.SPECIALS.forEach((sp) => {
    const st = s.specials[sp.id];
    if (!st.unlocked || st.bought) return;
    st.bought = true; const after = MT.productionPerSec(s); st.bought = false;
    let gain = after - rate;
    if (sp.effect.type === 'clickRate') gain = rate * sp.effect.value * curCps;
    list.push({ kind: 'sp', id: sp.id, price: sp.cost, gain });
  });
  return list;
}
let curCps = cps;
const dt = 0.5;
const checkpoints = [1, 3, 5, 10, 20, 30, 60, 120, 180, 240, 360, 480, 720, 1440].filter((m) => m <= minutes);
for (let t = 0; t <= minutes * 60; t += dt) {
  curCps = t < 600 ? cps : cps / 4;
  for (let i = 0; i < curCps * dt; i++) MT.click(s);
  MT.tick(s, dt);
  // 回収時間(価格/増分 + 待ち時間)が最小のものを、買えるなら買う
  for (let guard = 0; guard < 50; guard++) {
    const income = MT.productionPerSec(s) + MT.clickValue(s) * curCps;
    const c = candidates().filter((x) => x.gain > 0)
      .map((x) => ({ ...x, score: x.price / x.gain + Math.max(0, x.price - s.magic) / income }))
      .sort((a, b) => a.score - b.score)[0];
    if (!c || c.price > s.magic) break;
    if (c.kind === 'unit') { MT.buyUnit(s, c.id, '1'); mark('初購入:' + c.id, t); }
    else if (c.kind === 'cum') { MT.buyUpgrade(s, c.id); mark('初強化:' + c.id, t); }
    else { MT.buySpecial(s, c.id); mark('条件強化:' + c.id, t); }
  }
  MT.UNITS.forEach((u) => { if (s.unitUnlocked[u.id]) mark('解放:' + u.id, t); });
  mark('結晶 第' + MT.crystalStage(s) + '段階', t);
  MT.SPECIALS.forEach((sp) => { if (s.specials[sp.id].unlocked) mark('条件達成:' + sp.id, t); });
  if (checkpoints.length && t >= checkpoints[0] * 60) {
    const m = checkpoints.shift();
    events.push([t, `--- ${m}分時点`, `生産 ${MT.fmt(MT.productionPerSec(s))}/秒  タップ ${MT.fmt(MT.clickValue(s))}  所有 ${MT.UNITS.map((u) => s.units[u.id]).join('/')}  強化 ${MT.CUMULATIVE.map((c) => s.upgrades[c.id]).join('/')}`]);
  }
}
events.sort((a, b) => a[0] - b[0]).forEach(([t, k, e]) => console.log(fmtT(t), k, e));
