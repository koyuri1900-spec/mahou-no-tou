/*
 * 魔力の塔 ― 画面表示と操作(DOM)
 * ゲーム計算は game.js、保存は save.js に任せ、ここでは入力と表示だけを扱う。
 * DOMは起動時に一度だけ組み立て、以降は変化した文字列・クラスだけを書き換える。
 */
(function () {
  'use strict';
  var MT = window.MT, MTSave = window.MTSave;
  var fmt = MT.fmt;

  var LOGIC_INTERVAL = 100;   // 計算: 100msごと
  var RENDER_INTERVAL = 150;  // 表示更新: 約7fps(数値の更新には十分)
  var PERIODIC_SAVE = 10000;  // 定期保存: 10秒

  var $ = function (id) { return document.getElementById(id); };

  // ---- 起動 -------------------------------------------------------------------
  var saver = MTSave.createSaver({});
  var loaded = saver.load();
  var state = loaded.state;
  // 新規ゲームで「視差効果を減らす」設定の端末なら、演出は控えめから始める
  if (loaded.status !== 'ok' && loaded.status !== 'repaired' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.visualMode = 'low';
  }
  // セーブ復元後にオフライン収入を一度だけ加算し、直後に保存して基準時刻を進める(重複防止)
  MT.applyOffline(state, Date.now());
  saver.saveNow(state);

  // ---- 表示ヘルパー(変化したときだけ書き換える) ------------------------------
  function setText(el, v) { if (el._t !== v) { el._t = v; el.textContent = v; } }
  function setCls(el, cls, on) { var k = '_c_' + cls; if (el[k] !== on) { el[k] = on; el.classList.toggle(cls, on); } }
  function setHidden(el, h) { if (el._h !== h) { el._h = h; el.hidden = h; } }
  function setWidth(el, ratio) { var w = Math.round(ratio * 1000) / 10 + '%'; if (el._w !== w) { el._w = w; el.style.width = w; } }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

  var el = {
    magic: $('magic'), rate: $('rate'), rate2: $('rate2'), clickValue: $('clickValue'),
    unitList: $('unitList'), cumList: $('cumList'), specialList: $('specialList'), badge: $('upgradeBadge'),
    stTotal: $('stTotal'), stExact: $('stExact'), stClicks: $('stClicks'), stUnits: $('stUnits'), stMul: $('stMul'),
    saveStatus: $('saveStatus'), toast: $('toast'), floaters: $('floaters'), crystal: $('crystal'),
    stage: document.querySelector('.stage'), crystalImg: $('crystalImg'), crystalFlow: $('crystalFlow'),
    stageNum: $('stageNum'), stageName: $('stageName'), stageBar: $('stageBar'), stageNext: $('stageNext')
  };

  // ---- 視覚演出(visuals.js)。表示専用で、魔力の計算には関与しない ----------------------
  var vis = window.MTV ? window.MTV.create({
    stage: el.stage, canvas: $('fx'), crystalImg: el.crystalImg, towerImg: $('towerImg'), pedestal: document.querySelector('.pedestal'),
    getState: function () { return state; }
  }) : null;
  function visCall(name, arg) { if (vis) { try { vis[name](arg); } catch (e) { console.error('[魔力の塔] 演出エラー', e); } } }

  // クリスタルの段階を画面に反映する(画像・大きさ・内部の光)
  var shownStage = 0;
  function applyStage(st, animate) {
    shownStage = st;
    for (var i = 1; i <= 4; i++) el.stage.classList.toggle('cs-' + i, i === st);
    var src = 'assets/crystal_' + st + '.svg';
    el.crystalImg.src = src;
    el.crystalFlow.style.setProperty('--cmask', 'url("' + src + '")');
    setText(el.stageNum, String(st));
    setText(el.stageName, MT.stageInfo(st).name);
    function fit() {
      el.crystalFlow.style.setProperty('--cw', el.crystalImg.offsetWidth + 'px');
      el.crystalFlow.style.setProperty('--ch', el.crystalImg.offsetHeight + 'px');
      visCall('measure');
    }
    if (el.crystalImg.complete) fit();
    el.crystalImg.onload = fit;
    if (animate) {
      el.stage.classList.remove('evolving');
      void el.stage.offsetWidth;
      el.stage.classList.add('evolving');
      setTimeout(function () { el.stage.classList.remove('evolving'); }, 1000);
    }
  }
  var shownUnlocks = {};
  function snapshotUnlocks() { MT.UNITS.forEach(function (u) { shownUnlocks[u.id] = !!state.unitUnlocked[u.id]; }); }
  snapshotUnlocks();

  // ---- 一覧の組み立て -------------------------------------------------------------
  var unitRows = MT.UNITS.map(function (u, idx) {
    var li = h('li', 'card unit');
    li.innerHTML =
      '<img class="card-icon pix" src="assets/' + u.id + '.svg" alt="">' +
      '<div class="card-main">' +
      '  <div class="card-head"><span class="card-name">' + u.name + '</span><span class="owned">所有 <b class="js-owned">0</b></span></div>' +
      '  <div class="card-sub js-sub"></div>' +
      '  <div class="lock js-lock"><span class="lock-ico">🔒</span><span class="js-cond"></span>' +
      '    <div class="bar"><i class="js-bar"></i></div></div>' +
      '</div>' +
      '<button type="button" class="buy js-buy" data-unit="' + u.id + '"><span class="buy-n js-n">×1</span><span class="buy-cost"><img src="assets/crystal.svg" alt="" class="gem">' +
      '<span class="js-cost">0</span></span></button>';
    el.unitList.appendChild(li);
    return {
      def: u, idx: idx, li: li, owned: li.querySelector('.js-owned'), sub: li.querySelector('.js-sub'),
      lock: li.querySelector('.js-lock'), cond: li.querySelector('.js-cond'), bar: li.querySelector('.js-bar'),
      buy: li.querySelector('.js-buy'), n: li.querySelector('.js-n'), cost: li.querySelector('.js-cost')
    };
  });

  var cumRows = MT.CUMULATIVE.map(function (c) {
    var li = h('li', 'card upg');
    li.innerHTML =
      '<img class="card-icon pix small" src="assets/icon_' + c.icon + '.svg" alt="">' +
      '<div class="card-main"><div class="card-head"><span class="card-name">' + c.name + '</span><span class="lv">Lv.<b class="js-lv">0</b></span></div>' +
      '<div class="card-sub js-desc"></div></div>' +
      '<button type="button" class="buy js-buy" data-upg="' + c.id + '"><span class="buy-n">強化</span><span class="buy-cost"><img src="assets/crystal.svg" alt="" class="gem"><span class="js-cost">0</span></span></button>';
    el.cumList.appendChild(li);
    return { def: c, li: li, lv: li.querySelector('.js-lv'), desc: li.querySelector('.js-desc'), buy: li.querySelector('.js-buy'), cost: li.querySelector('.js-cost') };
  });

  var ICONS = { spirit: 'spirit', mage: 'mage', golem: 'golem', egg: 'egg', crystal: 'crystal', tower: 'tower' };
  var specialRows = MT.SPECIALS.map(function (sp) {
    var li = h('li', 'card upg special');
    li.innerHTML =
      '<img class="card-icon pix small" src="assets/' + ICONS[sp.icon] + '.svg" alt="">' +
      '<div class="card-main"><div class="card-head"><span class="card-name">' + sp.name + '</span><span class="tag js-tag"></span></div>' +
      '<div class="card-sub">' + sp.desc + '</div>' +
      '<div class="lock js-lock"><span class="lock-ico">🔒</span><span>' + MT.condText(sp.cond) + ' で解放</span><div class="bar"><i class="js-bar"></i></div></div></div>' +
      '<button type="button" class="buy js-buy" data-sp="' + sp.id + '"><span class="buy-n">購入</span><span class="buy-cost"><img src="assets/crystal.svg" alt="" class="gem">' + fmt(sp.cost) + '</span></button>';
    el.specialList.appendChild(li);
    return { def: sp, li: li, tag: li.querySelector('.js-tag'), lock: li.querySelector('.js-lock'), bar: li.querySelector('.js-bar'), buy: li.querySelector('.js-buy') };
  });

  // ---- 描画 ---------------------------------------------------------------------
  function render() {
    // 成長段階・新ユニット解放の検出(演出のきっかけ。数値には影響しない)
    var st = MT.crystalStage(state);
    if (st !== shownStage) {
      var up = shownStage > 0 && st > shownStage;
      applyStage(st, up);
      if (up) { visCall('onStageUp', st); toast('クリスタルが成長しました:第' + st + '段階「' + MT.stageInfo(st).name + '」', 3200); }
    }
    MT.UNITS.forEach(function (u) {
      if (state.unitUnlocked[u.id] && !shownUnlocks[u.id]) {
        shownUnlocks[u.id] = true;
        visCall('onUnlock', u.id);
        if (u.unlockTotal > 0) toast(u.name + 'が解放されました', 2400);
      }
    });
    var sp = MT.stageProgress(state);
    setWidth(el.stageBar, sp.ratio);
    setText(el.stageNext, sp.ratio >= 1 && st >= 4 ? sp.text : '次: ' + sp.text);

    var rate = MT.productionPerSec(state);
    setText(el.magic, fmt(state.magic));
    setText(el.rate, fmt(rate));
    setText(el.rate2, fmt(rate));
    setText(el.clickValue, fmt(MT.clickValue(state)));

    var modeLabel = state.buyMode === 'max' ? '最大' : '×' + state.buyMode;
    unitRows.forEach(function (r) {
      var id = r.def.id;
      var unlocked = !!state.unitUnlocked[id];
      setCls(r.li, 'is-locked', !unlocked);
      setHidden(r.lock, unlocked);
      setHidden(r.buy, !unlocked);
      setText(r.owned, String(state.units[id]));
      if (!unlocked) {
        setText(r.cond, MT.unitUnlockText(r.idx) + ' で解放');
        var prev = MT.UNITS[r.idx - 1];
        var p = Math.min(state.totalEarned / r.def.unlockTotal, (state.units[prev.id] || 0) / r.def.unlockPrev);
        setWidth(r.bar, Math.max(0, Math.min(1, p)));
        setText(r.sub, '1体 +' + fmt(r.def.prod) + '/秒(基本)');
        return;
      }
      setText(r.sub, '1体 +' + fmt(MT.unitRate(state, id)) + '/秒 ・ 合計 +' + fmt(MT.unitTotalRate(state, id)) + '/秒');
      var pv = MT.unitPurchasePreview(state, id, state.buyMode);
      var can = pv.count > 0;
      setCls(r.buy, 'is-disabled', !can);
      r.buy.setAttribute('aria-disabled', can ? 'false' : 'true');
      setText(r.n, can ? (state.buyMode === '1' ? '×1' : modeLabel + ' (' + pv.count + '体)') : modeLabel);
      setText(r.cost, fmt(pv.cost));
    });

    var buyable = 0;
    cumRows.forEach(function (r) {
      var lv = state.upgrades[r.def.id];
      var price = MT.cumPrice(r.def, lv);
      var can = price <= state.magic;
      if (can) buyable++;
      setText(r.lv, String(lv));
      setText(r.desc, r.def.desc(lv));
      setText(r.cost, fmt(price));
      setCls(r.buy, 'is-disabled', !can);
    });
    specialRows.forEach(function (r) {
      var st = state.specials[r.def.id];
      setCls(r.li, 'is-locked', !st.unlocked);
      setCls(r.li, 'is-bought', st.bought);
      setHidden(r.lock, st.unlocked);
      setHidden(r.buy, !st.unlocked || st.bought);
      setText(r.tag, st.bought ? '購入済み' : st.unlocked ? '解放済み' : '未解放');
      if (!st.unlocked) setWidth(r.bar, MT.condProgress(state, r.def.cond));
      var can = st.unlocked && !st.bought && r.def.cost <= state.magic;
      if (can) buyable++;
      setCls(r.buy, 'is-disabled', !can);
    });
    setHidden(el.badge, buyable === 0);
    setText(el.badge, String(buyable));

    if (activeTab === 'menu') {
      setText(el.stTotal, fmt(state.totalEarned));
      setText(el.stExact, MT.fmtFull(state.magic));
      setText(el.stClicks, MT.fmtFull(state.totalClicks));
      setText(el.stUnits, MT.fmtFull(MT.totalUnits(state)));
      setText(el.stMul, '×' + MT.fmtMul(MT.globalMultiplier(state)));
    }
  }

  function renderVisualModes() {
    document.querySelectorAll('.vmode').forEach(function (b) {
      var on = b.getAttribute('data-vmode') === state.visualMode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    el.stage.classList.toggle('vm-off', state.visualMode === 'off');
  }
  document.querySelectorAll('.vmode').forEach(function (b) {
    b.addEventListener('click', function () {
      MT.setVisualMode(state, b.getAttribute('data-vmode'));
      saver.saveNow(state);
      visCall('setMode', state.visualMode);
      renderVisualModes();
    });
  });

  function renderModes() {
    document.querySelectorAll('.mode').forEach(function (b) {
      var on = b.getAttribute('data-mode') === state.buyMode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  // ---- フィードバック ------------------------------------------------------------
  // トーストは順番に表示する(同時に起きた出来事が上書きで消えないように)
  var toastTimer = null, toastQueue = [];
  function toast(msg, ms) {
    if (toastQueue.length >= 4) toastQueue.shift();
    toastQueue.push([msg, ms || 2200]);
    if (!toastTimer) nextToast();
  }
  function nextToast() {
    var t = toastQueue.shift();
    if (!t) { toastTimer = null; el.toast.hidden = true; return; }
    el.toast.textContent = t[0];
    el.toast.hidden = false;
    toastTimer = setTimeout(nextToast, toastQueue.length ? Math.min(t[1], 1600) : t[1]);
  }

  var floaterPool = 0;
  function floatText(text, x, y) {
    if (floaterPool > 12) return; // 連打時もDOMを増やしすぎない
    floaterPool++;
    var f = h('span', 'floater');
    f.textContent = text;
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    el.floaters.appendChild(f);
    setTimeout(function () { f.remove(); floaterPool--; }, 900);
  }

  function pulse(node) {
    node.classList.remove('pop');
    void node.offsetWidth; // アニメーションを再開させる
    node.classList.add('pop');
  }

  // ---- 入力 ---------------------------------------------------------------------
  // click イベントを使う: スクロール(ドラッグ)ではブラウザが click を発火しないため、誤タップを防げる
  el.crystal.addEventListener('click', function (e) {
    var v = MT.click(state);
    saver.markDirty();
    var rect = el.floaters.getBoundingClientRect();
    var x = (e.clientX || rect.left + rect.width / 2) - rect.left + (Math.random() * 30 - 15);
    var y = (e.clientY || rect.top + rect.height / 2) - rect.top - 10;
    if (!e.clientX && !e.clientY) { x = rect.width / 2; y = rect.height / 3; }
    floatText('+' + fmt(v), x, y);
    pulse(el.crystal);
    visCall('onClick');
    render();
  });

  el.unitList.addEventListener('click', function (e) {
    var b = e.target.closest('[data-unit]');
    if (!b) return;
    var r = MT.buyUnit(state, b.getAttribute('data-unit'), state.buyMode);
    if (r.ok) { saver.markDirty(); saver.saveNow(state); pulse(b); visCall('onPurchase'); }
    else toast(r.reason === 'funds' ? '魔力が足りません' : 'まだ解放されていません', 1200);
    render();
  });
  el.cumList.addEventListener('click', function (e) {
    var b = e.target.closest('[data-upg]');
    if (!b) return;
    var r = MT.buyUpgrade(state, b.getAttribute('data-upg'));
    if (r.ok) { saver.saveNow(state); pulse(b); visCall('onUpgrade'); } else toast('魔力が足りません', 1200);
    render();
  });
  el.specialList.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sp]');
    if (!b) return;
    var r = MT.buySpecial(state, b.getAttribute('data-sp'));
    if (r.ok) { saver.saveNow(state); visCall('onUpgrade'); toast(MT.specialDef(b.getAttribute('data-sp')).name + ' を習得しました'); }
    else if (r.reason === 'funds') toast('魔力が足りません', 1200);
    render();
  });

  document.querySelectorAll('.mode').forEach(function (b) {
    b.addEventListener('click', function () {
      MT.setBuyMode(state, b.getAttribute('data-mode'));
      saver.markDirty();
      renderModes();
      render();
    });
  });

  var activeTab = 'units';
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      activeTab = t.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach(function (x) {
        var on = x === t;
        x.classList.toggle('is-active', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      ['units', 'upgrades', 'menu'].forEach(function (k) { $('panel-' + k).hidden = k !== activeTab; });
      render();
    });
  });

  $('saveBtn').addEventListener('click', function () {
    toast(saver.saveNow(state) ? '保存しました' : '保存できませんでした(このブラウザでは保存領域が使えません)');
    updateSaveStatus();
  });

  // リセット: 確認ダイアログで「リセットする」を押したときだけ実行
  var modal = $('resetModal');
  $('resetBtn').addEventListener('click', function () { modal.hidden = false; $('resetCancel').focus(); });
  $('resetCancel').addEventListener('click', function () { modal.hidden = true; });
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) modal.hidden = true; });
  $('resetConfirm').addEventListener('click', function () {
    state = MTSave.resetGame(saver, Date.now());
    lastTick = Date.now();
    modal.hidden = true;
    snapshotUnlocks();
    applyStage(MT.crystalStage(state), false);
    visCall('setMode', state.visualMode);
    renderVisualModes();
    renderModes();
    render();
    toast('リセットしました。最初から始めます');
  });

  function updateSaveStatus() {
    var msg;
    if (!saver.available()) msg = '⚠ このブラウザでは保存できません(プライベートモード等)。ページを閉じると進行状況は失われます。';
    else if (saver.lastError()) msg = '⚠ 直近の保存に失敗しました。空き容量やブラウザ設定を確認してください。';
    else msg = '自動保存:有効(変化時・10秒ごと・画面を離れるとき)';
    setText(el.saveStatus, msg);
    setCls(el.saveStatus, 'warn', msg.charAt(0) === '⚠');
  }

  // ---- ループ ---------------------------------------------------------------------
  // 実時間(Date.now)の差分で進めるため、タブの一時停止や間引きがあっても時間経過が狂わない。
  // 長い空白(60秒超)はオフライン扱いにして4時間で打ち切る。計算は O(1) で大量ループはしない。
  var lastTick = Date.now();
  var lastPeriodic = Date.now();
  function logicStep() {
    var now = Date.now();
    var dt = (now - lastTick) / 1000;
    lastTick = now;
    if (dt > 0) {
      if (dt > MT.ONLINE_GAP_SEC) dt = Math.min(dt, MT.OFFLINE_CAP_SEC);
      if (MT.tick(state, dt) > 0) saver.markDirty();
    }
    if (now - lastPeriodic >= PERIODIC_SAVE) { lastPeriodic = now; saver.markDirty(); }
    var r = saver.maybeSave(state);
    if (r === false) updateSaveStatus();
  }
  setInterval(logicStep, LOGIC_INTERVAL);
  setInterval(function () { if (!document.hidden) render(); }, RENDER_INTERVAL);

  function flush() { logicStep(); saver.saveNow(state); }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) flush();
    else { logicStep(); render(); }
  });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  // ---- 初期表示 ---------------------------------------------------------------------
  applyStage(MT.crystalStage(state), false); // 復元時は演出なしで現在の段階を表示
  renderModes();
  renderVisualModes();
  visCall('setMode', state.visualMode);
  updateSaveStatus();
  render();
  if (loaded.status === 'corrupt') toast('セーブデータが破損していたため、新しいゲームを開始しました', 4500);
  else if (loaded.status === 'repaired') toast('セーブデータの一部を修復しました', 3500);
  else if (loaded.status === 'unavailable') toast('このブラウザでは保存できません。進行状況はページを閉じると失われます', 5000);

  // テスト・デバッグ用(ゲームの動作には不要)
  window.__mt = { get state() { return state; }, saver: saver, render: render, loadStatus: loaded.status, vis: vis };
})();
