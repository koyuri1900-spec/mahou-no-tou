/*
 * 魔力の塔 ― ゲームロジック(状態・数値計算・購入処理・進行管理)
 * DOMに依存しない純粋なロジック。ブラウザでは window.MT、Node.jsでは module.exports で公開。
 *
 * 数値の扱い:
 *   すべての魔力量は JavaScript の number(倍精度浮動小数点)で保持する。
 *   初期版の想定範囲は 0 〜 MAX_VALUE(1e300)。これを超える値は MAX_VALUE に丸める。
 *   有効桁は約15桁のため、1e15 を超える領域では1の位の誤差は無視される(放置ゲームとして問題なし)。
 *   NaN / Infinity / 負数は sanitize() で必ず安全な値に置き換える。
 */
(function (root) {
  'use strict';

  var MAX_VALUE = 1e300;
  var OFFLINE_CAP_SEC = 14400; // 4時間
  var ONLINE_GAP_SEC = 60;     // これを超える一括経過は「オフライン扱い」(4時間上限)にする

  // ---- ユニット定義 ------------------------------------------------------
  // cost: 初期価格 / prod: 1体あたり毎秒生産 / growth: 購入ごとの価格倍率(約1.25)
  // unlockTotal: 累計獲得魔力がこの値に達すると解放 / unlockPrev: 前段階ユニットの所有数条件
  var UNITS = [
    { id: 'spirit', name: '精霊', desc: '最初に使える魔力のユニット', cost: 15, prod: 1, growth: 1.23, unlockTotal: 0, unlockPrev: 0 },
    { id: 'mage', name: '魔術師', desc: '強力な魔法で魔力を生産する', cost: 300, prod: 8, growth: 1.25, unlockTotal: 200, unlockPrev: 1 },
    { id: 'golem', name: 'ゴーレム', desc: '大量の魔力を安定して生産する', cost: 15000, prod: 100, growth: 1.26, unlockTotal: 12000, unlockPrev: 5 },
    { id: 'egg', name: 'ドラゴンの卵', desc: '孵化すると大きな力を発揮する', cost: 1500000, prod: 1800, growth: 1.28, unlockTotal: 1200000, unlockPrev: 5 }
  ];

  // ---- 累積型強化 ----------------------------------------------------------
  // 価格 = ceil(baseCost × costGrowth^Lv)
  var CUMULATIVE = [
    { id: 'click', name: 'クリック強化', icon: 'click', cost: 25, costGrowth: 1.9,
      desc: function (lv) { return 'タップ獲得量 +1 & ×1.12(現在 ' + fmt(clickBase(lv)) + ')'; } },
    { id: 'prod', name: '全生産量強化', icon: 'prod', cost: 500, costGrowth: 2.6,
      desc: function (lv) { return '全ユニットの生産 ×1.15(現在 ×' + fmtMul(Math.pow(1.15, lv)) + ')'; } },
    { id: 'bond', name: '契約の絆', icon: 'bond', cost: 8000, costGrowth: 3.5,
      desc: function (lv) { return '所有ユニット1体ごとに全生産 +0.2%(現在 +' + fmtPct(0.002 * lv) + '/体)'; } }
  ];

  // ---- 条件解放型強化(1回だけ購入) --------------------------------------
  // cond.type: 'unit'(指定ユニットの所有数)/'total'(累計獲得魔力)/'rate'(毎秒生産量)
  var SPECIALS = [
    { id: 'spiritBless', name: '精霊の祝福', icon: 'spirit', cost: 1500, cond: { type: 'unit', unit: 'spirit', value: 10 },
      effect: { type: 'unitMul', unit: 'spirit', value: 3 }, desc: '精霊の生産量 ×3' },
    { id: 'resonance', name: '結晶共鳴', icon: 'crystal', cost: 60000, cond: { type: 'total', value: 100000 },
      effect: { type: 'clickRate', value: 0.05 }, desc: 'タップ時に毎秒生産量の5%を追加獲得' },
    { id: 'mageTome', name: '魔術師の秘伝書', icon: 'mage', cost: 80000, cond: { type: 'unit', unit: 'mage', value: 10 },
      effect: { type: 'unitMul', unit: 'mage', value: 3 }, desc: '魔術師の生産量 ×3' },
    { id: 'golemCore', name: 'ゴーレムの核', icon: 'golem', cost: 3e6, cond: { type: 'unit', unit: 'golem', value: 10 },
      effect: { type: 'unitMul', unit: 'golem', value: 3 }, desc: 'ゴーレムの生産量 ×3' },
    { id: 'dragonWake', name: '竜の目覚め', icon: 'egg', cost: 3e8, cond: { type: 'unit', unit: 'egg', value: 10 },
      effect: { type: 'unitMul', unit: 'egg', value: 3 }, desc: 'ドラゴンの卵の生産量 ×3' },
    { id: 'towerAwake', name: '塔の覚醒', icon: 'tower', cost: 5e9, cond: { type: 'rate', value: 2e6 },
      effect: { type: 'globalMul', value: 2 }, desc: '全ユニットの生産量 ×2' }
  ];

  var BUY_MODES = ['1', '10', 'max'];
  var VISUAL_MODES = ['normal', 'low', 'off']; // 演出: 標準 / 控えめ / オフ

  // ---- クリスタルの成長段階 ------------------------------------------------------
  // 累計獲得魔力と、ユニットの解放状況(どちらも減らない値)から決まる。魔力を消費しても段階は戻らない。
  // 段階は保存せず毎回この関数で求めるため、保存値と累計値が食い違うことはない。
  var CRYSTAL_STAGES = [
    { stage: 1, name: '微弱な結晶', total: 0, unit: null },
    { stage: 2, name: '魔力の覚醒', total: 2000, unit: null },
    { stage: 3, name: '高密度の魔力結晶', total: 2e6, unit: 'golem' },
    { stage: 4, name: '魔力の極致', total: 2e9, unit: 'egg' }
  ];

  // ---- 数値ユーティリティ ----------------------------------------------------
  function sanitize(v) {
    if (typeof v !== 'number' || v !== v) return 0; // NaN
    if (v < 0) return 0;
    if (v > MAX_VALUE) return MAX_VALUE;
    return v;
  }
  function clampInt(v, max) {
    if (typeof v !== 'number' || !isFinite(v) || v < 0) return 0;
    v = Math.floor(v);
    return v > max ? max : v;
  }

  var SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  // 表示形式: 1,000未満は整数(小さい値は小数1桁)、以降は K/M/B/T…、Dc(1e33)を超えたら指数表記
  function fmt(v) {
    v = sanitize(v);
    if (v < 1000) {
      if (v < 10 && v % 1 !== 0) return (Math.floor(v * 10) / 10).toFixed(1);
      return String(Math.floor(v));
    }
    var tier = Math.floor(Math.log10(v) / 3);
    if (tier >= SUFFIXES.length) {
      var e = Math.floor(Math.log10(v));
      var m = Math.floor(v / Math.pow(10, e) * 100) / 100;
      if (m >= 10) { m = 1; e += 1; }
      return m.toFixed(2) + 'e' + e;
    }
    var scaled = v / Math.pow(1000, tier);
    // 切り捨てで表示(所持額を多く見せない)。浮動小数点の誤差対策で僅かに補正
    var digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    var p = Math.pow(10, digits);
    var shown = Math.floor(scaled * p + 1e-9) / p;
    if (shown >= 1000 && tier + 1 < SUFFIXES.length) { shown = 1; tier += 1; digits = 2; }
    return shown.toFixed(digits) + SUFFIXES[tier];
  }
  function fmtMul(v) { return v >= 1000 ? fmt(v) : (Math.round(v * 100) / 100).toString(); }
  function fmtPct(v) { return (Math.round(v * 1000) / 10) + '%'; }
  function fmtFull(v) { return Math.floor(sanitize(v)).toLocaleString('ja-JP'); }

  // ---- 状態 ------------------------------------------------------------------
  function newState(now) {
    var s = {
      magic: 0,
      totalEarned: 0,
      totalClicks: 0,
      units: {},
      unitUnlocked: {},
      upgrades: {},
      specials: {},
      buyMode: '1',
      visualMode: 'normal',
      lastSave: typeof now === 'number' ? now : Date.now(),
      startedAt: typeof now === 'number' ? now : Date.now()
    };
    UNITS.forEach(function (u) { s.units[u.id] = 0; s.unitUnlocked[u.id] = u.unlockTotal === 0; });
    CUMULATIVE.forEach(function (u) { s.upgrades[u.id] = 0; });
    SPECIALS.forEach(function (sp) { s.specials[sp.id] = { unlocked: false, bought: false }; });
    return s;
  }

  function unitDef(id) { for (var i = 0; i < UNITS.length; i++) if (UNITS[i].id === id) return UNITS[i]; return null; }
  function cumDef(id) { for (var i = 0; i < CUMULATIVE.length; i++) if (CUMULATIVE[i].id === id) return CUMULATIVE[i]; return null; }
  function specialDef(id) { for (var i = 0; i < SPECIALS.length; i++) if (SPECIALS[i].id === id) return SPECIALS[i]; return null; }

  // ---- 価格計算(丸めは常に Math.ceil で統一) ----------------------------------
  function unitPrice(def, owned) { return Math.min(MAX_VALUE, Math.ceil(def.cost * Math.pow(def.growth, owned))); }

  // owned 体所有時点から k 体まとめて買う合計価格(1体ずつの丸め後価格の合計 = 実際の購入と完全一致)
  function bulkPrice(def, owned, k) {
    var sum = 0;
    for (var i = 0; i < k; i++) {
      sum += unitPrice(def, owned + i);
      if (sum >= MAX_VALUE) return MAX_VALUE;
    }
    return sum;
  }

  // 所持魔力 budget で買える最大数(limit 体まで)
  function maxAffordable(def, owned, budget, limit) {
    budget = sanitize(budget);
    if (limit === undefined) limit = 100000;
    var first = unitPrice(def, owned);
    if (budget < first) return 0;
    // 連続近似で見積もり → 丸めを含む実価格で補正
    var r = def.growth;
    var est = Math.floor(Math.log(1 + budget * (r - 1) / (def.cost * Math.pow(r, owned))) / Math.log(r));
    var k = Math.max(0, Math.min(limit, isFinite(est) ? est : limit));
    while (k > 0 && bulkPrice(def, owned, k) > budget) k--;
    while (k < limit && bulkPrice(def, owned, k + 1) <= budget) k++;
    return k;
  }

  function cumPrice(def, lv) { return Math.min(MAX_VALUE, Math.ceil(def.cost * Math.pow(def.costGrowth, lv))); }

  // ---- 生産量・クリック ---------------------------------------------------------
  function clickBase(lv) { return (1 + lv) * Math.pow(1.12, lv); }

  function totalUnits(s) { var n = 0; UNITS.forEach(function (u) { n += s.units[u.id] || 0; }); return n; }

  function globalMultiplier(s) {
    var m = Math.pow(1.15, s.upgrades.prod || 0);
    m *= 1 + 0.002 * (s.upgrades.bond || 0) * totalUnits(s);
    SPECIALS.forEach(function (sp) {
      if (s.specials[sp.id] && s.specials[sp.id].bought && sp.effect.type === 'globalMul') m *= sp.effect.value;
    });
    return m;
  }
  function unitMultiplier(s, id) {
    var m = 1;
    SPECIALS.forEach(function (sp) {
      if (s.specials[sp.id] && s.specials[sp.id].bought && sp.effect.type === 'unitMul' && sp.effect.unit === id) m *= sp.effect.value;
    });
    return m;
  }
  // 1体あたりの毎秒生産(全強化込み)
  function unitRate(s, id) { var d = unitDef(id); return sanitize(d.prod * unitMultiplier(s, id) * globalMultiplier(s)); }
  function unitTotalRate(s, id) { return sanitize(unitRate(s, id) * (s.units[id] || 0)); }
  function productionPerSec(s) {
    var total = 0;
    UNITS.forEach(function (u) { total += unitTotalRate(s, u.id); });
    return sanitize(total);
  }
  function clickValue(s) {
    var v = clickBase(s.upgrades.click || 0);
    SPECIALS.forEach(function (sp) {
      if (s.specials[sp.id] && s.specials[sp.id].bought && sp.effect.type === 'clickRate') v += productionPerSec(s) * sp.effect.value;
    });
    return sanitize(v);
  }

  // ---- 進行 ---------------------------------------------------------------------
  function earn(s, amount) {
    amount = sanitize(amount);
    s.magic = sanitize(s.magic + amount);
    s.totalEarned = sanitize(s.totalEarned + amount);
    return amount;
  }

  function click(s) {
    var v = clickValue(s);
    earn(s, v);
    s.totalClicks = clampInt((s.totalClicks || 0) + 1, Number.MAX_SAFE_INTEGER);
    updateUnlocks(s);
    return v;
  }

  // オンライン中の時間経過。dtSec が負/不正なら何もしない
  function tick(s, dtSec) {
    if (typeof dtSec !== 'number' || !isFinite(dtSec) || dtSec <= 0) return 0;
    var gained = earn(s, productionPerSec(s) * dtSec);
    updateUnlocks(s);
    return gained;
  }

  // オフライン収入: 最終保存時点の毎秒生産量 × min(経過秒数, 14400)
  function offlineGain(s, nowMs) {
    var last = s.lastSave;
    if (typeof last !== 'number' || !isFinite(last) || typeof nowMs !== 'number' || !isFinite(nowMs)) return { seconds: 0, gain: 0 };
    var sec = (nowMs - last) / 1000;
    if (!(sec > 0)) return { seconds: 0, gain: 0 }; // 時間の逆行・同時刻
    sec = Math.min(sec, OFFLINE_CAP_SEC);
    return { seconds: sec, gain: sanitize(productionPerSec(s) * sec) };
  }
  function applyOffline(s, nowMs) {
    var r = offlineGain(s, nowMs);
    if (r.gain > 0) earn(s, r.gain);
    s.lastSave = nowMs; // 同じ期間を二度加算しないよう、加算と同時に基準時刻を進める
    updateUnlocks(s);
    return r;
  }

  function checkCond(s, cond) {
    if (cond.type === 'unit') return (s.units[cond.unit] || 0) >= cond.value;
    if (cond.type === 'total') return s.totalEarned >= cond.value;
    if (cond.type === 'rate') return productionPerSec(s) >= cond.value;
    return false;
  }
  function condProgress(s, cond) {
    var cur = cond.type === 'unit' ? (s.units[cond.unit] || 0) : cond.type === 'total' ? s.totalEarned : productionPerSec(s);
    return Math.max(0, Math.min(1, cur / cond.value));
  }
  function condText(cond) {
    if (cond.type === 'unit') return unitDef(cond.unit).name + 'を' + cond.value + '体所有';
    if (cond.type === 'total') return '累計魔力 ' + fmt(cond.value);
    return '毎秒生産 ' + fmt(cond.value);
  }

  function unitUnlockMet(s, idx) {
    var u = UNITS[idx];
    if (idx === 0) return true;
    return s.totalEarned >= u.unlockTotal && (s.units[UNITS[idx - 1].id] || 0) >= u.unlockPrev;
  }
  function unitUnlockText(idx) {
    var u = UNITS[idx];
    return '累計魔力 ' + fmt(u.unlockTotal) + ' & ' + UNITS[idx - 1].name + ' ' + u.unlockPrev + '体';
  }

  // 解放状態は一度満たせば維持(条件を後で下回っても閉じない)。変化があれば true
  function updateUnlocks(s) {
    var changed = false;
    UNITS.forEach(function (u, i) {
      if (!s.unitUnlocked[u.id] && unitUnlockMet(s, i)) { s.unitUnlocked[u.id] = true; changed = true; }
    });
    SPECIALS.forEach(function (sp) {
      var st = s.specials[sp.id];
      if (!st.unlocked && checkCond(s, sp.cond)) { st.unlocked = true; changed = true; }
    });
    return changed;
  }

  // ---- 購入 ---------------------------------------------------------------------
  function modeLimit(mode) { return mode === '10' ? 10 : mode === 'max' ? 100000 : 1; }

  // 購入プレビュー: { count, cost }。×10 は「最大10体、魔力不足なら買える数だけ」
  function unitPurchasePreview(s, id, mode) {
    var d = unitDef(id);
    var owned = s.units[id] || 0;
    var limit = modeLimit(mode || s.buyMode);
    var k = maxAffordable(d, owned, s.magic, limit);
    if (k === 0) {
      // 1体も買えない場合は「次の目標価格」を表示用に返す
      var showK = mode === '10' ? 10 : 1;
      return { count: 0, cost: bulkPrice(d, owned, showK), targetCount: showK };
    }
    return { count: k, cost: bulkPrice(d, owned, k), targetCount: k };
  }

  function buyUnit(s, id, mode) {
    var d = unitDef(id);
    if (!d || !s.unitUnlocked[id]) return { ok: false, reason: 'locked', count: 0, cost: 0 };
    var p = unitPurchasePreview(s, id, mode);
    if (p.count <= 0 || p.cost > s.magic) return { ok: false, reason: 'funds', count: 0, cost: 0 };
    s.magic = sanitize(s.magic - p.cost);
    s.units[id] = (s.units[id] || 0) + p.count;
    updateUnlocks(s);
    return { ok: true, count: p.count, cost: p.cost, remaining: s.magic, owned: s.units[id] };
  }

  function buyUpgrade(s, id) {
    var d = cumDef(id);
    if (!d) return { ok: false, reason: 'unknown' };
    var price = cumPrice(d, s.upgrades[id] || 0);
    if (price > s.magic) return { ok: false, reason: 'funds' };
    s.magic = sanitize(s.magic - price);
    s.upgrades[id] = (s.upgrades[id] || 0) + 1;
    updateUnlocks(s);
    return { ok: true, cost: price, level: s.upgrades[id] };
  }

  function buySpecial(s, id) {
    var d = specialDef(id);
    if (!d) return { ok: false, reason: 'unknown' };
    var st = s.specials[id];
    if (!st.unlocked) return { ok: false, reason: 'locked' };
    if (st.bought) return { ok: false, reason: 'owned' };
    if (d.cost > s.magic) return { ok: false, reason: 'funds' };
    s.magic = sanitize(s.magic - d.cost);
    st.bought = true;
    updateUnlocks(s);
    return { ok: true, cost: d.cost };
  }

  function setBuyMode(s, mode) { if (BUY_MODES.indexOf(mode) >= 0) s.buyMode = mode; return s.buyMode; }
  function setVisualMode(s, mode) { if (VISUAL_MODES.indexOf(mode) >= 0) s.visualMode = mode; return s.visualMode; }

  function stageMet(s, def) { return s.totalEarned >= def.total && (!def.unit || !!s.unitUnlocked[def.unit]); }
  function crystalStage(s) {
    var st = 1;
    for (var i = 1; i < CRYSTAL_STAGES.length; i++) { if (stageMet(s, CRYSTAL_STAGES[i])) st = i + 1; else break; }
    return st;
  }
  function stageInfo(st) { return CRYSTAL_STAGES[Math.max(1, Math.min(CRYSTAL_STAGES.length, st)) - 1]; }
  // 次の段階への進捗 0〜1(最終段階なら 1)と条件文
  function stageProgress(s) {
    var st = crystalStage(s);
    if (st >= CRYSTAL_STAGES.length) return { stage: st, ratio: 1, text: '最終段階に到達' };
    var next = CRYSTAL_STAGES[st];
    var prevTotal = CRYSTAL_STAGES[st - 1].total;
    // 対数で進捗を測る(後半ほど必要量が桁違いに増えるため)
    var lo = Math.log10(Math.max(1, prevTotal)), hi = Math.log10(next.total), cur = Math.log10(Math.max(1, s.totalEarned));
    var ratio = Math.max(0, Math.min(1, (cur - lo) / (hi - lo)));
    var text = '累計魔力 ' + fmt(next.total);
    if (next.unit) {
      text += ' & ' + unitDef(next.unit).name + '解放';
      if (!s.unitUnlocked[next.unit]) ratio = Math.min(ratio, 0.95);
    }
    return { stage: st, ratio: ratio, text: text };
  }

  var MT = {
    MAX_VALUE: MAX_VALUE, OFFLINE_CAP_SEC: OFFLINE_CAP_SEC, ONLINE_GAP_SEC: ONLINE_GAP_SEC,
    UNITS: UNITS, CUMULATIVE: CUMULATIVE, SPECIALS: SPECIALS, BUY_MODES: BUY_MODES,
    sanitize: sanitize, clampInt: clampInt, fmt: fmt, fmtFull: fmtFull, fmtMul: fmtMul,
    newState: newState, unitDef: unitDef, cumDef: cumDef, specialDef: specialDef,
    unitPrice: unitPrice, bulkPrice: bulkPrice, maxAffordable: maxAffordable, cumPrice: cumPrice,
    clickBase: clickBase, clickValue: clickValue, totalUnits: totalUnits,
    globalMultiplier: globalMultiplier, unitMultiplier: unitMultiplier,
    unitRate: unitRate, unitTotalRate: unitTotalRate, productionPerSec: productionPerSec,
    earn: earn, click: click, tick: tick, offlineGain: offlineGain, applyOffline: applyOffline,
    checkCond: checkCond, condProgress: condProgress, condText: condText,
    unitUnlockMet: unitUnlockMet, unitUnlockText: unitUnlockText, updateUnlocks: updateUnlocks,
    unitPurchasePreview: unitPurchasePreview, buyUnit: buyUnit, buyUpgrade: buyUpgrade, buySpecial: buySpecial,
    setBuyMode: setBuyMode, setVisualMode: setVisualMode, VISUAL_MODES: VISUAL_MODES,
    CRYSTAL_STAGES: CRYSTAL_STAGES, crystalStage: crystalStage, stageInfo: stageInfo, stageProgress: stageProgress
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MT;
  else root.MT = MT;
})(typeof window !== 'undefined' ? window : this);
