const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('../game.js');
const MTSave = require('../save.js');

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m
  };
}
const silent = { warn() {}, error() {} };

test('保存→復元で状態が一致する', () => {
  const s = MT.newState(1000);
  s.magic = 12345.5; s.totalEarned = 99999; s.units.spirit = 12; s.units.mage = 3;
  s.unitUnlocked.mage = true; s.upgrades.click = 4; s.buyMode = 'max';
  s.specials.spiritBless = { unlocked: true, bought: true };
  const text = MTSave.serialize(s, 5000);
  const r = MTSave.deserialize(text, 6000);
  assert.equal(r.status, 'ok');
  assert.equal(r.state.magic, 12345.5);
  assert.equal(r.state.units.spirit, 12);
  assert.equal(r.state.units.mage, 3);
  assert.equal(r.state.upgrades.click, 4);
  assert.equal(r.state.buyMode, 'max');
  assert.deepEqual(r.state.specials.spiritBless, { unlocked: true, bought: true });
  assert.equal(r.state.lastSave, 5000);
});

test('価格・生産量は保存しない(再計算)', () => {
  const data = JSON.parse(MTSave.serialize(MT.newState(0), 0));
  assert.equal(data.version, MTSave.SAVE_VERSION);
  assert.equal(data.price, undefined);
  assert.equal(data.productionPerSec, undefined);
});

test('セーブなし → 新規ゲーム', () => {
  const r = MTSave.deserialize(null, 0);
  assert.equal(r.status, 'new');
  assert.equal(r.state.magic, 0);
});

test('JSON破損 → 新規ゲームに安全移行(バックアップを退避)', () => {
  const st = memStorage();
  st.setItem(MTSave.SAVE_KEY, '{"version":1, "magic": 10');
  const saver = MTSave.createSaver({ storage: st, now: () => 1000, logger: silent });
  const r = saver.load();
  assert.equal(r.status, 'corrupt');
  assert.equal(r.state.magic, 0);
  assert.equal(st.getItem(MTSave.BACKUP_KEY), '{"version":1, "magic": 10');
});

test('型の不一致・負の所有数・不正な強化値は初期値に置換される', () => {
  const bad = JSON.stringify({
    version: 1, savedAt: 100, magic: -50, totalEarned: 'abc',
    units: { spirit: -3, mage: 2.5, golem: 4 }, unitUnlocked: {},
    upgrades: { click: 'x', prod: 1e12, bond: 2 },
    specials: { spiritBless: 'yes', resonance: { unlocked: false, bought: true } },
    buyMode: 'all'
  });
  const r = MTSave.deserialize(bad, 1000);
  assert.equal(r.status, 'repaired');
  assert.equal(r.state.magic, 0);
  assert.equal(r.state.units.spirit, 0);
  assert.equal(r.state.units.mage, 0);
  assert.equal(r.state.units.golem, 4);
  assert.equal(r.state.unitUnlocked.golem, true);
  assert.equal(r.state.upgrades.click, 0);
  assert.equal(r.state.upgrades.prod, 0);
  assert.equal(r.state.upgrades.bond, 2);
  assert.deepEqual(r.state.specials.spiritBless, { unlocked: false, bought: false });
  assert.deepEqual(r.state.specials.resonance, { unlocked: true, bought: true });
  assert.equal(r.state.buyMode, '1');
  assert.ok(Number.isFinite(MT.productionPerSec(r.state)));
});

test('NaN/Infinity 相当や非オブジェクトでも停止しない', () => {
  for (const t of ['null', '[]', '"str"', '42', '{}', '{"version":"1"}', '{"version":99}']) {
    const r = MTSave.deserialize(t, 0);
    assert.equal(r.status, 'corrupt', t);
    assert.equal(r.state.magic, 0);
  }
  const r = MTSave.deserialize('{"version":1,"magic":1e999}', 0); // JSON上 Infinity
  assert.equal(r.state.magic, 0);
});

test('未来の保存時刻 → オフライン収入なし', () => {
  const s = MT.newState(0); s.units.spirit = 10;
  const r = MTSave.deserialize(MTSave.serialize(s, 99999999), 1000);
  assert.equal(r.state.lastSave, 1000);
  assert.equal(MT.applyOffline(r.state, 1000).gain, 0);
});

test('再読み込みを繰り返してもオフライン収入が重複しない', () => {
  let clock = 1000;
  const st = memStorage();
  const saver = MTSave.createSaver({ storage: st, now: () => clock, logger: silent });
  const s = MT.newState(0); s.units.spirit = 1;
  saver.saveNow(s);
  clock += 5 * 3600 * 1000; // 5時間後に再訪
  let r = saver.load();
  MT.applyOffline(r.state, clock); saver.saveNow(r.state);
  assert.equal(r.state.magic, 14400); // 4時間分が上限
  // すぐに再読み込み
  r = saver.load();
  MT.applyOffline(r.state, clock); saver.saveNow(r.state);
  assert.equal(r.state.magic, 14400);
});

test('保存は間隔を空けて行われる(過剰な書き込み防止)', () => {
  let clock = 10000;
  let writes = 0;
  const st = memStorage();
  const orig = st.setItem; st.setItem = (k, v) => { writes++; orig(k, v); };
  const saver = MTSave.createSaver({ storage: st, now: () => clock, minInterval: 2000, logger: silent });
  const s = MT.newState(0);
  saver.markDirty(); saver.maybeSave(s);
  saver.markDirty(); saver.maybeSave(s);
  clock += 500; saver.markDirty(); saver.maybeSave(s);
  assert.equal(writes, 1);
  clock += 2000; saver.maybeSave(s);
  assert.equal(writes, 2);
  saver.maybeSave(s); // dirty でなければ書かない
  assert.equal(writes, 2);
});

test('保存領域が使えない/書き込み失敗でも例外を投げない', () => {
  const none = MTSave.createSaver({ storage: null, logger: silent });
  assert.equal(none.available(), false);
  assert.equal(none.load().status, 'unavailable');
  assert.equal(none.saveNow(MT.newState(0)), false);
  const failing = MTSave.createSaver({ storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() {} }, logger: silent });
  assert.doesNotThrow(() => failing.load());
  assert.equal(failing.saveNow(MT.newState(0)), false);
  assert.ok(failing.lastError());
});

test('リセット: 保存データを消して初期状態で再開', () => {
  const st = memStorage();
  const saver = MTSave.createSaver({ storage: st, now: () => 5000, logger: silent });
  const s = MT.newState(0); s.magic = 999; s.units.spirit = 7;
  saver.saveNow(s);
  const fresh = MTSave.resetGame(saver, 5000);
  assert.equal(fresh.magic, 0);
  assert.equal(fresh.units.spirit, 0);
  const r = saver.load();
  assert.equal(r.state.magic, 0);
  assert.equal(r.state.units.spirit, 0);
});
