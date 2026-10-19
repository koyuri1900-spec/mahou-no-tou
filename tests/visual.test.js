// 成長段階・演出計画・セーブ移行の単体テスト
const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('../game.js');
const MTSave = require('../save.js');
const MTV = require('../visuals.js');

function st(total, unlocked = {}) {
  const s = MT.newState(0);
  s.totalEarned = total;
  Object.assign(s.unitUnlocked, unlocked);
  return s;
}

test('成長段階: 累計魔力と解放状況で4段階に変化する', () => {
  assert.equal(MT.crystalStage(st(0)), 1);
  assert.equal(MT.crystalStage(st(1999)), 1);
  assert.equal(MT.crystalStage(st(2000)), 2);
  assert.equal(MT.crystalStage(st(5e6)), 2, 'ゴーレム未解放なら第3段階にならない');
  assert.equal(MT.crystalStage(st(5e6, { golem: true })), 3);
  assert.equal(MT.crystalStage(st(5e9, { golem: true })), 3, '卵未解放なら第4段階にならない');
  assert.equal(MT.crystalStage(st(5e9, { golem: true, egg: true })), 4);
  assert.equal(MT.crystalStage(st(1e300, { golem: true, egg: true })), 4);
});

test('成長段階: 後半ほど必要量が増える(倍率が段階ごとに大きくなる)', () => {
  const t = MT.CRYSTAL_STAGES.map((x) => x.total);
  assert.ok(t[2] / t[1] < t[3] / t[2] || t[3] / t[2] >= 1000);
  assert.ok(t[1] <= 5000, '最初の変化は早い');
});

test('成長段階: 魔力を使っても段階は戻らない', () => {
  const s = st(3e6, { golem: true });
  s.magic = 3e6;
  assert.equal(MT.crystalStage(s), 3);
  s.units.golem = 0; // ゴーレムを持っていなくても、解放済みなら維持
  MT.buyUpgrade(s, 'click'); MT.buyUpgrade(s, 'prod');
  s.magic = 0;
  assert.equal(MT.crystalStage(s), 3);
});

test('段階の進捗: 0〜1の範囲、最終段階は1', () => {
  for (const total of [0, 10, 1999, 2000, 1e5, 1.9e6, 3e6]) {
    const p = MT.stageProgress(st(total));
    assert.ok(p.ratio >= 0 && p.ratio <= 1, `${total}: ${p.ratio}`);
  }
  assert.ok(MT.stageProgress(st(1000)).ratio > MT.stageProgress(st(100)).ratio);
  assert.equal(MT.stageProgress(st(1e10, { golem: true, egg: true })).ratio, 1);
  assert.ok(MT.stageProgress(st(5e6)).ratio < 1, '解放条件が未達なら満タンにしない');
});

test('セーブ移行: v1のデータは v2 に変換され、進行状況を引き継ぐ', () => {
  const v1 = JSON.stringify({ version: 1, savedAt: 100, magic: 500, totalEarned: 3e6, units: { spirit: 20, golem: 2 },
    unitUnlocked: { mage: true, golem: true }, upgrades: { click: 3 }, specials: {}, buyMode: '10' });
  const r = MTSave.deserialize(v1, 1000);
  assert.equal(r.status, 'ok');
  assert.equal(r.state.visualMode, 'normal');
  assert.equal(r.state.units.spirit, 20);
  assert.equal(r.state.buyMode, '10');
  assert.equal(MT.crystalStage(r.state), 3, '段階は保存せず累計値から復元');
  const again = JSON.parse(MTSave.serialize(r.state, 2000));
  assert.equal(again.version, 2);
  assert.equal(again.visualMode, 'normal');
});

test('演出設定の保存・不正値', () => {
  const s = MT.newState(0);
  MT.setVisualMode(s, 'low');
  assert.equal(MTSave.deserialize(MTSave.serialize(s, 10), 20).state.visualMode, 'low');
  MT.setVisualMode(s, 'crazy');
  assert.equal(s.visualMode, 'low');
  const bad = MTSave.deserialize(JSON.stringify({ version: 2, savedAt: 1, magic: 0, units: {}, upgrades: {}, specials: {}, visualMode: 7 }), 5);
  assert.equal(bad.state.visualMode, 'normal');
});

test('表示キャラクター数: 所有数に応じて増え、上限で止まる', () => {
  assert.equal(MTV.actorCount(0, 6), 0);
  assert.equal(MTV.actorCount(1, 6), 1);
  assert.equal(MTV.actorCount(3, 6), 2);
  assert.equal(MTV.actorCount(4, 6), 3);
  assert.equal(MTV.actorCount(1e6, 6), 6);
  assert.equal(MTV.actorCount(NaN, 6), 0);
});

test('演出計画: 大量所有でも上限内・控えめは少ない', () => {
  const s = st(1e12, { mage: true, golem: true, egg: true });
  s.units = { spirit: 1e6, mage: 1e6, golem: 1e6, egg: 1e6 };
  const n = MTV.scenePlan(s, 'normal');
  const l = MTV.scenePlan(s, 'low');
  const sum = (p) => Object.values(p.actors).reduce((a, b) => a + b, 0);
  assert.ok(sum(n) <= 14);
  assert.ok(sum(l) < sum(n));
  assert.ok(l.ambient < n.ambient);
  assert.equal(n.litWindows, 9);
  for (const v of Object.values(n.intensity)) assert.ok(v >= 0 && v <= 1);
});

test('演出計画: ユニット購入で活動が現れ、成長で塔が発展する', () => {
  const s = MT.newState(0);
  let p = MTV.scenePlan(s, 'normal');
  assert.equal(p.actors.spirit, 0);
  s.magic = 100;
  MT.buyUnit(s, 'spirit', '1');
  p = MTV.scenePlan(s, 'normal');
  assert.equal(p.actors.spirit, 1);
  const early = p;
  const late = MTV.scenePlan(Object.assign(st(5e9, { golem: true, egg: true }), { units: { spirit: 50, mage: 30, golem: 20, egg: 10 } }), 'normal');
  assert.ok(late.litWindows > early.litWindows);
  assert.ok(late.floatCrystals > early.floatCrystals);
  assert.ok(late.ambient > early.ambient);
  assert.equal(early.towerCircle, false);
  assert.equal(late.towerCircle, true);
  assert.equal(late.eggAwake, true);
});

test('演出計画は状態を書き換えない(魔力の二重加算が起きない)', () => {
  const s = st(3e6, { golem: true });
  s.units.spirit = 30; s.units.golem = 4; s.magic = 12345;
  const before = JSON.stringify(s);
  for (let i = 0; i < 100; i++) MTV.scenePlan(s, i % 2 ? 'low' : 'normal');
  assert.equal(JSON.stringify(s), before);
});
