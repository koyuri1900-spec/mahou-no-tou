// 実行: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('../game.js');

const spirit = MT.unitDef('spirit');

test('購入価格: 初期価格と約1.25倍の上昇、丸めは切り上げで統一', () => {
  assert.equal(MT.unitPrice(spirit, 0), 15);
  for (let n = 0; n < 50; n++) {
    const ratio = MT.unitPrice(spirit, n + 1) / MT.unitPrice(spirit, n);
    assert.ok(ratio > 1.15 && ratio < 1.35, `n=${n} ratio=${ratio}`);
    assert.equal(MT.unitPrice(spirit, n), Math.ceil(15 * Math.pow(spirit.growth, n)));
  }
  MT.UNITS.forEach((u) => assert.ok(u.growth >= 1.2 && u.growth <= 1.3));
});

test('まとめ買い価格 = 1体ずつの価格の合計', () => {
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += MT.unitPrice(spirit, 5 + i);
  assert.equal(MT.bulkPrice(spirit, 5, 10), sum);
});

test('最大購入数: 予算ちょうど・1少ない・巨大値', () => {
  for (const owned of [0, 3, 40]) {
    for (const k of [1, 2, 7, 25]) {
      const exact = MT.bulkPrice(spirit, owned, k);
      assert.equal(MT.maxAffordable(spirit, owned, exact), k);
      assert.equal(MT.maxAffordable(spirit, owned, exact - 1), k - 1);
    }
  }
  assert.equal(MT.maxAffordable(spirit, 0, 0), 0);
  const big = MT.maxAffordable(spirit, 0, 1e200);
  assert.ok(big > 0 && MT.bulkPrice(spirit, 0, big) <= 1e200);
  assert.ok(MT.bulkPrice(spirit, 0, big + 1) > 1e200);
});

test('魔力不足では購入できず、状態は変化しない', () => {
  const s = MT.newState(0);
  s.magic = 14;
  const r = MT.buyUnit(s, 'spirit', '1');
  assert.equal(r.ok, false);
  assert.equal(s.magic, 14);
  assert.equal(s.units.spirit, 0);
});

test('×1 購入: 所有数・残高・生産量が更新される', () => {
  const s = MT.newState(0);
  s.magic = 100;
  const r = MT.buyUnit(s, 'spirit', '1');
  assert.equal(r.ok, true);
  assert.equal(r.count, 1);
  assert.equal(s.magic, 85);
  assert.equal(s.units.spirit, 1);
  assert.equal(MT.productionPerSec(s), 1);
});

test('×10 購入: 足りれば10体、不足なら買える数だけ', () => {
  const s = MT.newState(0);
  s.magic = MT.bulkPrice(spirit, 0, 10) + 5;
  let r = MT.buyUnit(s, 'spirit', '10');
  assert.equal(r.count, 10);
  assert.equal(s.magic, 5);
  const s2 = MT.newState(0);
  s2.magic = MT.bulkPrice(spirit, 0, 4);
  r = MT.buyUnit(s2, 'spirit', '10');
  assert.equal(r.count, 4);
  assert.equal(s2.magic, 0);
});

test('最大購入: 残高が負にならず、次の1体は買えない', () => {
  const s = MT.newState(0);
  s.magic = 123456;
  const r = MT.buyUnit(s, 'spirit', 'max');
  assert.ok(r.ok && r.count > 0);
  assert.ok(s.magic >= 0);
  assert.ok(s.magic < MT.unitPrice(spirit, s.units.spirit));
  assert.equal(123456 - r.cost, s.magic);
});

test('未解放ユニットは購入できない/条件で順番に解放される', () => {
  const s = MT.newState(0);
  s.magic = 1e9;
  assert.equal(MT.buyUnit(s, 'mage', '1').ok, false);
  const mage = MT.unitDef('mage');
  s.totalEarned = mage.unlockTotal;
  s.units.spirit = mage.unlockPrev;
  MT.updateUnlocks(s);
  assert.equal(s.unitUnlocked.mage, true);
  assert.equal(s.unitUnlocked.golem, false);
  assert.equal(MT.buyUnit(s, 'mage', '1').ok, true);
});

test('生産量の合計と全体強化の累積', () => {
  const s = MT.newState(0);
  s.units.spirit = 10; s.units.mage = 2;
  const base = 10 * 1 + 2 * MT.unitDef('mage').prod;
  assert.equal(MT.productionPerSec(s), base);
  s.magic = 1e12;
  MT.buyUpgrade(s, 'prod'); MT.buyUpgrade(s, 'prod');
  assert.ok(Math.abs(MT.productionPerSec(s) - base * 1.15 * 1.15) < 1e-9);
  // 契約の絆: 所有12体 × 0.2% × Lv1
  MT.buyUpgrade(s, 'bond');
  assert.ok(Math.abs(MT.productionPerSec(s) - base * 1.15 * 1.15 * (1 + 0.002 * 12)) < 1e-9);
});

test('累積型強化: 価格は購入回数に応じて上昇、クリック獲得量が増える', () => {
  const s = MT.newState(0);
  s.magic = 1e9;
  const def = MT.cumDef('click');
  const p0 = MT.cumPrice(def, 0), p1 = MT.cumPrice(def, 1);
  assert.ok(p1 > p0);
  const v0 = MT.clickValue(s);
  const r = MT.buyUpgrade(s, 'click');
  assert.equal(r.cost, p0);
  assert.ok(MT.clickValue(s) > v0);
  assert.equal(s.upgrades.click, 1);
});

test('条件解放型強化: 未解放→購入不可、解放後1回だけ購入可', () => {
  const s = MT.newState(0);
  s.magic = 1e12;
  assert.equal(MT.buySpecial(s, 'spiritBless').reason, 'locked');
  s.units.spirit = 10;
  MT.updateUnlocks(s);
  const before = MT.unitRate(s, 'spirit');
  assert.equal(MT.buySpecial(s, 'spiritBless').ok, true);
  assert.equal(MT.unitRate(s, 'spirit'), before * 3);
  assert.equal(MT.buySpecial(s, 'spiritBless').reason, 'owned');
});

test('結晶共鳴: タップに毎秒生産量の5%が加算', () => {
  const s = MT.newState(0);
  s.units.spirit = 100;
  s.specials.resonance = { unlocked: true, bought: true };
  assert.ok(Math.abs(MT.clickValue(s) - (1 + 100 * 0.05)) < 1e-9);
});

test('時間経過で自動生産、不正な経過時間は無視', () => {
  const s = MT.newState(0);
  s.units.spirit = 5;
  MT.tick(s, 2);
  assert.equal(s.magic, 10);
  MT.tick(s, -100); MT.tick(s, NaN); MT.tick(s, Infinity);
  assert.equal(s.magic, 10);
});

test('オフライン収入: 4時間で上限、逆行や不正値は0', () => {
  const s = MT.newState(0);
  s.units.spirit = 1; // 1/秒
  s.lastSave = 0;
  assert.equal(MT.offlineGain(s, 3600 * 1000).gain, 3600);
  assert.equal(MT.offlineGain(s, 10 * 3600 * 1000).gain, 14400);
  assert.equal(MT.offlineGain(s, -5000).gain, 0);
  s.lastSave = NaN;
  assert.equal(MT.offlineGain(s, 1000).gain, 0);
});

test('オフライン収入は二度加算されない', () => {
  const s = MT.newState(0);
  s.units.spirit = 1;
  s.lastSave = 0;
  MT.applyOffline(s, 100 * 1000);
  assert.equal(s.magic, 100);
  MT.applyOffline(s, 100 * 1000); // 同時刻で再適用
  assert.equal(s.magic, 100);
});

test('数値表示 K/M/B と大きな値・不正値', () => {
  assert.equal(MT.fmt(0), '0');
  assert.equal(MT.fmt(999), '999');
  assert.equal(MT.fmt(1250), '1.25K');
  assert.equal(MT.fmt(12340), '12.3K');
  assert.equal(MT.fmt(12.34e6), '12.3M');
  assert.equal(MT.fmt(9.12e9), '9.12B');
  assert.equal(MT.fmt(999999), '999K');
  assert.equal(MT.fmt(1e15), '1.00Qa');
  assert.match(MT.fmt(1e40), /^1\.00e40$/);
  assert.equal(MT.fmt(NaN), '0');
  assert.equal(MT.fmt(-5), '0');
  assert.equal(MT.fmt(Infinity), MT.fmt(MT.MAX_VALUE));
});

test('巨大値でも NaN/Infinity/負の残高にならない', () => {
  const s = MT.newState(0);
  s.magic = 1e299;
  MT.earn(s, 1e305);
  assert.equal(s.magic, MT.MAX_VALUE);
  s.units.egg = 1e6;
  s.upgrades.prod = 5000;
  MT.tick(s, 1e6);
  assert.ok(Number.isFinite(s.magic) && s.magic <= MT.MAX_VALUE);
  assert.ok(Number.isFinite(MT.productionPerSec(s)));
});
