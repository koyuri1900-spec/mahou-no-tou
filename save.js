/*
 * 魔力の塔 ― セーブ・復元・データ検証
 * 保存先は localStorage(ブラウザ内)。オンライン同期なし。
 * 価格・生産量など再計算できる値は保存しない(所有数・強化レベルなどの元データのみ保存)。
 */
(function (root) {
  'use strict';
  var MT = root.MT || (typeof require !== 'undefined' ? require('./game.js') : null);

  var SAVE_KEY = 'mahou-no-tou.save';
  var BACKUP_KEY = 'mahou-no-tou.corrupt-backup';
  var SAVE_VERSION = 2; // v2: 演出設定(visualMode)を追加
  var MAX_COUNT = 1e6; // 所有数・強化レベルの上限(これを超える値は不正とみなす)

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function serialize(state, now) {
    var data = {
      version: SAVE_VERSION,
      savedAt: now,
      magic: state.magic,
      totalEarned: state.totalEarned,
      totalClicks: state.totalClicks,
      units: {}, unitUnlocked: {}, upgrades: {}, specials: {},
      buyMode: state.buyMode,
      visualMode: state.visualMode,
      startedAt: state.startedAt
    };
    MT.UNITS.forEach(function (u) { data.units[u.id] = state.units[u.id]; data.unitUnlocked[u.id] = !!state.unitUnlocked[u.id]; });
    MT.CUMULATIVE.forEach(function (c) { data.upgrades[c.id] = state.upgrades[c.id]; });
    MT.SPECIALS.forEach(function (sp) { var st = state.specials[sp.id]; data.specials[sp.id] = { unlocked: !!st.unlocked, bought: !!st.bought }; });
    return JSON.stringify(data);
  }

  // 旧バージョンのデータを現在の形式へ変換(将来の仕様変更用の入口)
  function migrate(data) {
    if (data.version === 1) {
      // v1 → v2: 演出設定がなかったので標準を補う。他の項目はそのまま引き継ぐ
      data.visualMode = 'normal';
      data.version = 2;
    }
    if (data.version === SAVE_VERSION) return data;
    throw new Error('未対応のセーブバージョン: ' + data.version);
  }

  /*
   * 文字列からゲーム状態を復元する。
   * 戻り値: { state, status, issues }
   *   status: 'new'(データなし) / 'ok' / 'repaired'(一部の不正値を初期値に置換) / 'corrupt'(全体が読めず新規開始)
   */
  function deserialize(text, now) {
    var fresh = MT.newState(now);
    if (text === null || text === undefined || text === '') return { state: fresh, status: 'new', issues: [] };
    var data;
    try {
      data = JSON.parse(text);
      if (!isObj(data)) throw new Error('セーブデータがオブジェクトではありません');
      if (!isNum(data.version)) throw new Error('バージョン情報がありません');
      data = migrate(data);
    } catch (e) {
      return { state: fresh, status: 'corrupt', issues: [String(e && e.message || e)] };
    }

    var issues = [];
    var s = fresh;
    function num(v, name, fallback) {
      if (isNum(v) && v >= 0) return Math.min(v, MT.MAX_VALUE);
      issues.push(name + ' が不正(' + JSON.stringify(v) + ')');
      return fallback;
    }
    function count(v, name) {
      if (isNum(v) && v >= 0 && v <= MAX_COUNT && Math.floor(v) === v) return v;
      issues.push(name + ' が不正(' + JSON.stringify(v) + ')');
      return 0;
    }

    s.magic = num(data.magic, 'magic', 0);
    s.totalEarned = num(data.totalEarned, 'totalEarned', s.magic);
    if (s.totalEarned < s.magic) s.totalEarned = s.magic;
    s.totalClicks = Math.floor(num(data.totalClicks === undefined ? 0 : data.totalClicks, 'totalClicks', 0));
    s.startedAt = isNum(data.startedAt) ? data.startedAt : now;

    var units = isObj(data.units) ? data.units : (issues.push('units が不正'), {});
    var unl = isObj(data.unitUnlocked) ? data.unitUnlocked : {};
    MT.UNITS.forEach(function (u) {
      s.units[u.id] = units[u.id] === undefined ? 0 : count(units[u.id], 'units.' + u.id);
      s.unitUnlocked[u.id] = u.unlockTotal === 0 || unl[u.id] === true || s.units[u.id] > 0;
    });

    var ups = isObj(data.upgrades) ? data.upgrades : (issues.push('upgrades が不正'), {});
    MT.CUMULATIVE.forEach(function (c) {
      s.upgrades[c.id] = ups[c.id] === undefined ? 0 : count(ups[c.id], 'upgrades.' + c.id);
    });

    var sps = isObj(data.specials) ? data.specials : (issues.push('specials が不正'), {});
    MT.SPECIALS.forEach(function (sp) {
      var v = sps[sp.id];
      if (v === undefined) return;
      if (!isObj(v) || typeof v.unlocked !== 'boolean' || typeof v.bought !== 'boolean') { issues.push('specials.' + sp.id + ' が不正'); return; }
      // 未解放なのに購入済み、は矛盾 → 購入済みを優先して解放扱い
      s.specials[sp.id] = { unlocked: v.unlocked || v.bought, bought: v.bought };
    });

    s.buyMode = MT.BUY_MODES.indexOf(data.buyMode) >= 0 ? data.buyMode : '1';
    s.visualMode = MT.VISUAL_MODES.indexOf(data.visualMode) >= 0 ? data.visualMode : 'normal';

    // 最終保存時刻: 不正・未来の値はオフライン収入を発生させない(=現在時刻扱い)
    if (isNum(data.savedAt) && data.savedAt > 0 && data.savedAt <= now) s.lastSave = data.savedAt;
    else { if (data.savedAt !== undefined) issues.push('savedAt が不正または未来(' + data.savedAt + ')'); s.lastSave = now; }

    MT.updateUnlocks(s);
    return { state: s, status: issues.length ? 'repaired' : 'ok', issues: issues };
  }

  // ---- ストレージ ------------------------------------------------------------------
  function getStorage() {
    try {
      var ls = root.localStorage;
      if (!ls) return null;
      var k = '__mt_probe__';
      ls.setItem(k, '1'); ls.removeItem(k);
      return ls;
    } catch (e) { return null; }
  }

  /*
   * セーブマネージャ。storage と clock を注入できるのでテスト可能。
   * opts: { storage, now: () => ms, minInterval: ms, logger }
   */
  function createSaver(opts) {
    opts = opts || {};
    var storage = opts.storage !== undefined ? opts.storage : getStorage();
    var now = opts.now || function () { return Date.now(); };
    var minInterval = opts.minInterval !== undefined ? opts.minInterval : 2000;
    var logger = opts.logger || (typeof console !== 'undefined' ? console : { warn: function () {}, error: function () {} });
    var lastWrite = 0;
    var dirty = false;
    var lastError = null;

    function available() { return !!storage; }

    function load() {
      var t = now();
      if (!storage) return { state: MT.newState(t), status: 'unavailable', issues: [] };
      var text = null;
      try { text = storage.getItem(SAVE_KEY); } catch (e) { lastError = e; }
      var r = deserialize(text, t);
      if (r.status === 'corrupt') {
        logger.error('[魔力の塔] セーブデータが破損しているため新規ゲームを開始します:', r.issues);
        try { storage.setItem(BACKUP_KEY, text); } catch (e) { /* 退避に失敗しても続行 */ }
      } else if (r.status === 'repaired') {
        logger.warn('[魔力の塔] セーブデータの一部を修復しました:', r.issues);
      }
      return r;
    }

    // 即時保存。成功したら true
    function saveNow(state) {
      var t = now();
      state.lastSave = t;
      dirty = false;
      lastWrite = t;
      if (!storage) return false;
      try {
        storage.setItem(SAVE_KEY, serialize(state, t));
        lastError = null;
        return true;
      } catch (e) {
        lastError = e;
        logger.error('[魔力の塔] 保存に失敗しました:', e);
        return false;
      }
    }

    // 変更があったことを記録し、間隔が空いていれば保存(過剰な書き込みを防ぐ)
    function markDirty() { dirty = true; }
    function maybeSave(state) {
      if (dirty && now() - lastWrite >= minInterval) return saveNow(state);
      return null;
    }

    function clear() {
      if (!storage) return true;
      try { storage.removeItem(SAVE_KEY); return true; } catch (e) { lastError = e; return false; }
    }

    return {
      available: available, load: load, saveNow: saveNow, markDirty: markDirty, maybeSave: maybeSave, clear: clear,
      isDirty: function () { return dirty; }, lastError: function () { return lastError; }
    };
  }

  // リセット: 確認済みのときだけ呼ぶ。保存データを消して新しい状態を返す
  function resetGame(saver, nowMs) {
    saver.clear();
    var s = MT.newState(nowMs);
    saver.saveNow(s);
    return s;
  }

  var MTSave = {
    SAVE_KEY: SAVE_KEY, BACKUP_KEY: BACKUP_KEY, SAVE_VERSION: SAVE_VERSION,
    serialize: serialize, deserialize: deserialize, createSaver: createSaver, resetGame: resetGame, getStorage: getStorage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MTSave;
  else root.MTSave = MTSave;
})(typeof window !== 'undefined' ? window : this);
