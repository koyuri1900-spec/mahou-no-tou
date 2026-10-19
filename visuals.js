/*
 * 魔力の塔 ― 視覚演出(ユニットの魔力運搬・クリスタルの成長・塔の発展)
 *
 * 原則:
 *   - ここは「見せるだけ」。ゲーム状態は読み取り専用で、魔力の加算は一切行わない
 *     (実際の魔力増加は game.js の tick/click だけが行う。演出の再生回数で魔力は変わらない)
 *   - Canvas 1枚 + requestAnimationFrame 1本で描画する。個別タイマーやDOM生成はしない
 *   - タブ非表示・画面外・演出オフのときは描画ループを止める
 *   - 所有数が多くてもキャラクター数には上限を設け、密度・粒子・光の強さで規模を表す
 *
 * 純粋関数(actorCount / scenePlan)は Node.js からもテストできるよう公開する。
 */
(function (root) {
  'use strict';
  var MT = root.MT || (typeof require !== 'undefined' ? require('./game.js') : null);

  // ---- 表示計画(純粋関数) ------------------------------------------------------------
  var ACTOR_CAP = { spirit: 6, mage: 4, golem: 3, egg: 1 };
  var MAX_PARTICLES = 160;

  // 所有数 → 画面に出すキャラクター数。1体→1、2〜3→2、4〜7→3 … と対数的に増え、上限で止まる
  function actorCount(owned, cap) {
    if (!(owned > 0)) return 0;
    return Math.min(cap, 1 + Math.floor(Math.log2(owned)));
  }

  // 生産量 → 演出の強さ 0〜1(対数。1/秒で約0.04、1M/秒で約0.86)
  function intensityOf(rate) { return rate > 0 ? Math.min(1, Math.log10(1 + rate) / 7) : 0; }

  /*
   * ゲーム状態から「何をどれだけ描くか」を決める。
   * mode: 'normal' | 'low' | 'off'(low はキャラ・粒子を約半分に)
   */
  function scenePlan(s, mode) {
    var low = mode === 'low';
    var stage = MT.crystalStage(s);
    var plan = { stage: stage, actors: {}, intensity: {}, unlocked: {} };
    var totalUnits = 0;
    MT.UNITS.forEach(function (u) {
      var n = s.units[u.id] || 0;
      totalUnits += n;
      var cap = low ? Math.max(1, Math.ceil(ACTOR_CAP[u.id] / 2)) : ACTOR_CAP[u.id];
      plan.actors[u.id] = actorCount(n, cap);
      plan.intensity[u.id] = intensityOf(MT.unitTotalRate(s, u.id));
      plan.unlocked[u.id] = !!s.unitUnlocked[u.id];
    });
    var upgradeLv = 0;
    MT.CUMULATIVE.forEach(function (c) { upgradeLv += s.upgrades[c.id] || 0; });
    var specials = 0;
    MT.SPECIALS.forEach(function (sp) { if (s.specials[sp.id] && s.specials[sp.id].bought) specials++; });

    plan.totalIntensity = intensityOf(MT.productionPerSec(s));
    // 塔: 窓の明かりは所有ユニット数で1つずつ灯る(最大9)。段階が上がると最低数も上がる
    plan.litWindows = Math.min(9, Math.max([0, 1, 3, 6][stage - 1], Math.ceil(totalUnits / 6)));
    // 塔の発光: 強化の合計レベルと条件強化の数で強くなる
    plan.towerGlow = Math.min(1, upgradeLv / 40 + specials / 12);
    // 浮遊結晶: 第3段階から。ゴーレム・卵の解放で増える
    var fc = [0, 0, 2, 4][stage - 1] + (plan.unlocked.golem && stage >= 3 ? 1 : 0) + (plan.unlocked.egg && stage >= 3 ? 1 : 0);
    plan.floatCrystals = low ? Math.ceil(fc / 2) : fc;
    // 周囲を漂う魔力の粒
    var amb = [3, 10, 22, 34][stage - 1];
    plan.ambient = low ? Math.ceil(amb / 2) : amb;
    plan.orbitShards = stage >= 3 ? (stage === 3 ? 3 : 5) : 0; // クリスタル周囲の小結晶
    plan.leyLine = stage >= 3;   // クリスタル→塔の魔力の通路
    plan.towerCircle = stage >= 4; // 塔頂の魔法陣
    plan.groundCircle = stage >= 4; // クリスタル下の魔法陣
    plan.eggAwake = (s.units.egg || 0) >= 10 || (s.specials.dragonWake && s.specials.dragonWake.bought);
    return plan;
  }

  var MTV = { ACTOR_CAP: ACTOR_CAP, MAX_PARTICLES: MAX_PARTICLES, actorCount: actorCount, intensityOf: intensityOf, scenePlan: scenePlan };

  if (typeof module !== 'undefined' && module.exports) { module.exports = MTV; return; }
  root.MTV = MTV;

  // =====================================================================================
  // 以下はブラウザ専用(Canvas 描画)
  // =====================================================================================

  // 塔スプライト(40×56グリッド)上の位置
  var TOWER_W = 40, TOWER_H = 56;
  var WINDOWS = [[19, 38], [18, 30], [21, 30], [7, 40], [32, 40], [7, 30], [32, 30], [18, 22], [21, 22]]; // 灯る順
  var ROOF_TIPS = [[7.5, 15.5], [32.5, 15.5], [19.5, 4]];
  var DOOR = [20, 50];
  var TOP_WINDOW = [19.5, 23];
  var MID_WINDOW = [19.5, 31];

  var COLORS = {
    spirit: ['#e6f6ff', '#9fdcff', '#5bb8f5'],
    mage: ['#f1e6ff', '#c86bff', '#7a4fd6'],
    golem: ['#e9f9ff', '#9ff0ff', '#4fb8d6'],
    egg: ['#fff3c9', '#ffb347', '#e2453b'],
    crystal: ['#f1ecff', '#b9a8ff', '#6a52e6'],
    gold: ['#fff7d6', '#ffe08a', '#ffcf3a']
  };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function create(opts) {
    var stageEl = opts.stage, canvas = opts.canvas, getState = opts.getState;
    var crystalImgEl = opts.crystalImg, towerImgEl = opts.towerImg, pedestalEl = opts.pedestal;
    var ctx = canvas.getContext('2d');
    var mode = 'normal';
    var plan = null;
    var W = 0, H = 0, dpr = 1;
    var A = {}; // 画面上の基準点
    var actors = [];
    var particles = [];
    var effects = []; // 光線・魔法陣などの一時演出(固定長で上限あり)
    var running = false, rafId = 0, lastFrame = 0, lastPlan = 0, time = 0;
    var visible = true, inView = true;
    var stats = { frames: 0, deliveries: 0, spawned: 0 };
    var crystalFlash = 0, towerFlash = 0;

    for (var i = 0; i < MAX_PARTICLES; i++) particles.push({ on: false });

    var IMG = {};
    ['spirit', 'mage', 'golem', 'egg', 'crystal'].forEach(function (k) {
      var im = new Image();
      var path = 'assets/' + k + '.svg';
      im.src = (window.MT_ASSETS && window.MT_ASSETS[path]) || path;
      IMG[k] = im;
    });
    function imgReady(im) { return im && im.complete && im.naturalWidth > 0; }

    // ---- 寸法と基準点 ---------------------------------------------------------------
    function rel(el) {
      var r = el.getBoundingClientRect(), s = stageEl.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
    }
    function towerPt(gx, gy) { return { x: A.tower.x + (gx / TOWER_W) * A.tower.w, y: A.tower.y + (gy / TOWER_H) * A.tower.h }; }
    function measure() {
      var r = stageEl.getBoundingClientRect();
      W = r.width; H = r.height;
      dpr = Math.min(mode === 'low' ? 1 : 2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      var c = rel(crystalImgEl);
      A.crystal = { x: c.x + c.w / 2, y: c.y + c.h * 0.48, r: Math.max(c.w, c.h) / 2 };
      A.tower = rel(towerImgEl);
      A.door = towerPt(DOOR[0], DOOR[1]);
      A.topWin = towerPt(TOP_WINDOW[0], TOP_WINDOW[1]);
      A.midWin = towerPt(MID_WINDOW[0], MID_WINDOW[1]);
      var pd = pedestalEl ? rel(pedestalEl) : { x: A.crystal.x - 85, y: A.crystal.y + c.h * 0.6, w: 170, h: 26 };
      A.pedestal = pd;
      A.ground = Math.min(H - 8, pd.y + pd.h * 0.5);
      A.scale = Math.max(1, Math.min(1.5, H / 420)); // PCの大きな画面ではキャラも少し大きく
      // 採取地点: 魔術師は左の浮島付近の「魔力の泉」、ゴーレムは左下の「結晶の採掘場」
      A.ley = { x: Math.max(30, W * 0.14), y: Math.min(A.ground - 30, H * 0.55) };
      A.quarry = { x: Math.max(22, W * 0.07), y: A.ground };
      // 卵は台座と塔の扉の間に置く
      var pr = pd.x + pd.w;
      A.eggSpot = { x: A.door.x > pr + 20 ? (pr + A.door.x) / 2 : pr + 12, y: A.ground };
    }

    // ---- 粒子(プール) ---------------------------------------------------------------
    function spawn(x, y, vx, vy, life, color, size, gravity, target) {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (p.on) continue;
        p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life;
        p.color = color; p.size = size || 2; p.g = gravity || 0; p.target = target || null;
        stats.spawned++;
        return p;
      }
      return null; // 上限に達したら出さない
    }
    function burst(x, y, n, palette, speed, life) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, v = rand(0.3, 1) * (speed || 60);
        spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.4, 1) * (life || 0.7), palette[i % palette.length], i % 3 === 0 ? 3 : 2, 30);
      }
    }
    function addEffect(e) { if (effects.length < 12) effects.push(e); }

    // ---- キャラクター ---------------------------------------------------------------
    function makeActor(type, idx, fresh) {
      var a = { type: type, idx: idx, phase: 'gather', t: 0, dur: 1, x: 0, y: 0, carry: 0, seed: Math.random(), from: null, to: null, appear: fresh ? 1 : 0 };
      startGather(a, true);
      if (fresh) burst(a.x, a.y, 10, COLORS[type], 50, 0.6);
      return a;
    }
    function gatherSpot(a) {
      if (a.type === 'spirit') {
        // 空に漂う魔力を集める(クリスタルの周囲・上空のランダムな点)
        var ang = rand(-Math.PI * 0.95, -Math.PI * 0.05);
        var rad = A.crystal.r * rand(1.3, 2.2);
        return { x: A.crystal.x + Math.cos(ang) * rad, y: Math.max(12, A.crystal.y + Math.sin(ang) * rad * 0.8) };
      }
      if (a.type === 'mage') return { x: A.ley.x + (a.idx - 1.5) * 14 + rand(-4, 4), y: A.ley.y + rand(-3, 3) };
      if (a.type === 'golem') return { x: A.quarry.x + a.idx * 10, y: A.ground - 12 };
      return { x: A.eggSpot.x, y: A.ground - 14 };
    }
    function deliverSpot(a) {
      // 精霊はクリスタルへ、魔術師は塔の窓へ、ゴーレムは塔の扉へ運ぶ
      if (a.type === 'spirit') return { x: A.crystal.x + rand(-6, 6), y: A.crystal.y + rand(-10, 10) };
      if (a.type === 'mage') return a.idx % 2 ? { x: A.midWin.x, y: A.midWin.y } : { x: A.topWin.x, y: A.topWin.y };
      return { x: A.door.x, y: A.ground - 12 };
    }
    // 生産量が多いほど作業が速く(=活動が密に)なる
    function busy(a) { return 1 + ((plan && plan.intensity[a.type]) || 0) * 0.8; }
    function startGather(a, initial) {
      var p = gatherSpot(a);
      if (initial) { a.x = p.x; a.y = p.y; }
      a.phase = 'gather'; a.t = 0; a.carry = 0;
      var base = a.type === 'spirit' ? 1.1 : a.type === 'mage' ? 1.8 : a.type === 'golem' ? 1.4 : 9e9;
      a.dur = base * rand(0.7, 1.4) / busy(a);
      if (initial) a.t = rand(0, a.dur); // 開始時期をずらして一斉に動かないようにする
    }
    function startMove(a, to, phase, speed) {
      a.from = { x: a.x, y: a.y }; a.to = to; a.phase = phase; a.t = 0;
      var d = Math.hypot(to.x - a.x, to.y - a.y);
      a.dur = Math.max(0.5, d / speed) * rand(0.85, 1.15);
    }
    var SPEED = { spirit: 95, mage: 60, golem: 32 };

    function updateActor(a, dt) {
      a.t += dt;
      if (a.appear > 0) a.appear = Math.max(0, a.appear - dt * 1.5);
      if (a.type === 'egg') return updateEgg(a, dt);
      var k = Math.min(1, a.t / a.dur);
      if (a.phase === 'gather') {
        // 採取中: 周囲から粒子が吸い寄せられる
        a.carry = k;
        if (Math.random() < dt * (a.type === 'mage' ? 9 : 5) * busy(a)) {
          var ang = Math.random() * Math.PI * 2, r = a.type === 'golem' ? 16 : 20;
          spawn(a.x + Math.cos(ang) * r, a.y - 6 + Math.sin(ang) * r, 0, 0, 0.5, COLORS[a.type][1], 2, 0, a);
        }
        if (k >= 1) startMove(a, deliverSpot(a), 'carry', SPEED[a.type] * busy(a));
      } else if (a.phase === 'carry' || a.phase === 'return') {
        var e = ease(k);
        var arc = a.type === 'golem' ? 0 : (a.type === 'spirit' ? 26 : 18);
        a.x = lerp(a.from.x, a.to.x, e);
        a.y = lerp(a.from.y, a.to.y, e) - Math.sin(Math.PI * e) * arc;
        if (a.phase === 'carry' && a.type === 'spirit' && Math.random() < dt * 10) {
          spawn(a.x, a.y + 2, rand(-8, 8), rand(4, 12), 0.45, COLORS.spirit[1], 2); // 魔力の尾
        }
        if (k >= 1) {
          if (a.phase === 'carry') deliver(a); else startGather(a, false);
        }
      }
    }
    function deliver(a) {
      stats.deliveries++;
      var pal = COLORS[a.type];
      var amt = 4 + Math.round(((plan && plan.intensity[a.type]) || 0) * 8);
      burst(a.x, a.y, amt, pal, 40, 0.5);
      addEffect({ kind: 'ring', x: a.x, y: a.y, t: 0, dur: 0.45, r0: 2, r1: 16, color: pal[1] });
      if (a.type === 'spirit') crystalFlash = Math.min(1, crystalFlash + 0.35); // クリスタルが光を吸収
      else towerFlash = Math.min(1, towerFlash + 0.4);
      a.carry = 0;
      startMove(a, gatherSpot(a), 'return', SPEED[a.type] * 1.2 * busy(a));
    }
    function updateEgg(a, dt) {
      // 卵は動かず、周囲の魔力を吸収する。強さに応じて吸収粒子が増え、覚醒すると揺れる
      var inten = (plan && plan.intensity.egg) || 0;
      if (Math.random() < dt * (3 + inten * 10)) {
        var ang = Math.random() * Math.PI * 2, r = rand(28, 46);
        spawn(a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.6, 0, 0, 0.7, Math.random() < 0.5 ? COLORS.egg[1] : COLORS.crystal[1], 2, 0, a);
      }
      a.wobble = 0;
      if (plan && plan.eggAwake) {
        var cyc = (time + a.seed * 5) % 4;
        if (cyc < 0.5) a.wobble = Math.sin(cyc * 40) * 2.5 * (1 - cyc / 0.5);
      }
    }

    function syncActors(fresh) {
      ['spirit', 'mage', 'golem', 'egg'].forEach(function (type) {
        var want = plan.actors[type];
        var have = actors.filter(function (a) { return a.type === type; });
        for (var i = have.length; i < want; i++) actors.push(makeActor(type, i, fresh));
        if (have.length > want) {
          var drop = have.slice(want);
          actors = actors.filter(function (a) { return drop.indexOf(a) < 0; });
        }
      });
    }

    // ---- 更新 -------------------------------------------------------------------------
    function update(dt) {
      time += dt;
      crystalFlash = Math.max(0, crystalFlash - dt * 1.6);
      towerFlash = Math.max(0, towerFlash - dt * 1.4);
      for (var i = 0; i < actors.length; i++) updateActor(actors[i], dt);
      // 漂う魔力の粒(段階に応じた数を保つ)
      var amb = 0;
      for (i = 0; i < particles.length; i++) if (particles[i].on && particles[i].ambient) amb++;
      if (amb < plan.ambient && Math.random() < dt * 6) {
        var p = spawn(A.crystal.x + rand(-1, 1) * A.crystal.r * 1.6, A.crystal.y + A.crystal.r * rand(0.2, 1), rand(-4, 4), rand(-14, -6), rand(2, 3.5),
          Math.random() < 0.5 ? COLORS.crystal[1] : COLORS.spirit[1], Math.random() < 0.3 ? 3 : 2);
        if (p) p.ambient = true;
      }
      // 魔力の通路: クリスタルから塔へ流れる光
      if (plan.leyLine && Math.random() < dt * (2 + plan.totalIntensity * 5)) {
        var lp = spawn(A.crystal.x, A.ground - 4, 0, 0, 1.4, COLORS.crystal[0], 2);
        if (lp) { lp.path = { x0: A.crystal.x, y0: A.ground - 4, x1: A.door.x, y1: A.ground - 4 }; lp.ambient = false; }
      }
      for (i = 0; i < particles.length; i++) {
        var q = particles[i];
        if (!q.on) continue;
        q.life -= dt;
        if (q.life <= 0) { q.on = false; q.ambient = false; q.path = null; q.target = null; continue; }
        if (q.path) {
          var tt = 1 - q.life / q.max;
          q.x = lerp(q.path.x0, q.path.x1, tt); q.y = q.path.y0 + Math.sin(tt * Math.PI * 3) * 2;
        } else if (q.target) {
          // 吸い寄せ(採取中のユニットへ)
          q.x += (q.target.x - q.x) * Math.min(1, dt * 6);
          q.y += (q.target.y - 8 - q.y) * Math.min(1, dt * 6);
        } else {
          q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        }
      }
      for (i = effects.length - 1; i >= 0; i--) { effects[i].t += dt; if (effects[i].t >= effects[i].dur) effects.splice(i, 1); }
    }

    // ---- 描画 -------------------------------------------------------------------------
    function px(x) { return Math.round(x); }
    function glow(x, y, r, color, alpha) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      // 終端は同じ色の透明にする(黒の透明だと縁が灰色に濁る)
      g.addColorStop(1, color.replace(/,\s*1\)$/, ',0)'));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }
    function ellipseRing(x, y, rx, ry, color, alpha, width, dash, rot) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = rot || 0; }
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    function miniCrystal(x, y, h, alpha) {
      if (!imgReady(IMG.crystal)) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(IMG.crystal, px(x - h * 0.34), px(y - h / 2), Math.round(h * 0.68), Math.round(h));
      ctx.globalAlpha = 1;
    }

    function drawTower() {
      // 窓の明かり(所有ユニット数で灯る)
      var cell = A.tower.w / TOWER_W;
      var flick = 0.75 + 0.25 * Math.sin(time * 3);
      for (var i = 0; i < plan.litWindows && i < WINDOWS.length; i++) {
        var w = towerPt(WINDOWS[i][0] + 1, WINDOWS[i][1] + 1);
        glow(w.x, w.y, cell * 3.2, 'rgba(255,224,138,1)', (0.35 + plan.towerGlow * 0.35) * flick + towerFlash * 0.4);
      }
      // 屋根の先端: 段階3以上で魔力が灯る
      if (plan.stage >= 3) {
        for (i = 0; i < ROOF_TIPS.length; i++) {
          var t = towerPt(ROOF_TIPS[i][0], ROOF_TIPS[i][1]);
          glow(t.x, t.y, cell * (plan.stage >= 4 ? 5 : 3.5), 'rgba(185,168,255,1)', 0.55 + 0.25 * Math.sin(time * 2 + i));
        }
      }
      // 塔頂の魔法陣
      if (plan.towerCircle) {
        var top = towerPt(19.5, 9);
        ellipseRing(top.x, top.y, cell * 11, cell * 3, '#c86bff', 0.55, 1.5, [4, 3], -time * 12);
        ellipseRing(top.x, top.y, cell * 8, cell * 2.2, '#9ff0ff', 0.45, 1, [2, 4], time * 16);
      }
      // 浮遊結晶(塔の周囲を上下にゆれる)
      for (i = 0; i < plan.floatCrystals; i++) {
        var fx = A.tower.x + A.tower.w * [0.02, 0.98, -0.12, 1.05, 0.25, 0.75][i % 6];
        var fy = A.tower.y + A.tower.h * [0.32, 0.36, 0.5, 0.55, 0.12, 0.14][i % 6] + Math.sin(time * 1.4 + i) * 4;
        glow(fx, fy, 12, 'rgba(185,168,255,1)', 0.5);
        miniCrystal(fx, fy, 14, 0.95);
      }
      if (towerFlash > 0) glow(A.door.x, A.door.y - 10, A.tower.w * 0.35, 'rgba(255,240,200,1)', towerFlash * 0.45);
    }

    function drawCrystalAura() {
      var c = A.crystal;
      var base = [0.18, 0.3, 0.42, 0.55][plan.stage - 1];
      glow(c.x, c.y, c.r * (1.2 + plan.stage * 0.12), 'rgba(150,120,255,1)', base + crystalFlash * 0.35 + 0.05 * Math.sin(time * 2));
      if (plan.groundCircle) {
        // 足元の魔法陣(段階4)
        var gy = A.ground - 6;
        ellipseRing(c.x, gy, c.r * 1.25, c.r * 0.32, '#c86bff', 0.6, 2, [6, 4], time * 20);
        ellipseRing(c.x, gy, c.r * 0.95, c.r * 0.24, '#9ff0ff', 0.5, 1.5, [3, 5], -time * 26);
        for (var i = 0; i < 8; i++) {
          var a = time * 0.6 + i * Math.PI / 4;
          ctx.fillStyle = '#e6dcff';
          ctx.globalAlpha = 0.7;
          ctx.fillRect(px(c.x + Math.cos(a) * c.r * 1.1) - 1, px(gy + Math.sin(a) * c.r * 0.28) - 1, 3, 3);
          ctx.globalAlpha = 1;
        }
      }
      // 周囲を回る小結晶(段階3以上)
      for (var j = 0; j < plan.orbitShards; j++) {
        var ang = time * 0.8 + j * (Math.PI * 2 / plan.orbitShards);
        var ox = c.x + Math.cos(ang) * c.r * 1.25, oy = c.y + Math.sin(ang) * c.r * 0.45;
        var behind = Math.sin(ang) < 0;
        miniCrystal(ox, oy, behind ? 9 : 12, behind ? 0.55 : 0.95);
      }
    }

    function drawActor(a) {
      var im = IMG[a.type];
      var size = Math.round((a.type === 'golem' ? 30 : a.type === 'egg' ? 28 : a.type === 'mage' ? 26 : 22) * (A.scale || 1));
      var bob = a.type === 'spirit' ? Math.sin(time * 6 + a.seed * 9) * 2 : a.type === 'mage' ? Math.sin(time * 3 + a.seed * 9) * 1.5 :
        a.type === 'golem' && a.phase !== 'gather' ? Math.abs(Math.sin(time * 7 + a.seed)) * -2 : 0;
      var x = a.x + (a.wobble || 0), y = a.y + bob;
      var pal = COLORS[a.type];
      if (a.type === 'egg') {
        var inten = (plan && plan.intensity.egg) || 0;
        glow(x, y - 4, 26 + inten * 14, plan.eggAwake ? 'rgba(255,179,71,1)' : 'rgba(226,69,59,1)', 0.25 + inten * 0.3 + 0.1 * Math.sin(time * 2.5));
      }
      // 採取中の詠唱・作業表現
      if (a.phase === 'gather' && a.type === 'mage') {
        ellipseRing(x, y + size * 0.42, 12, 4, pal[1], 0.4 + 0.4 * a.carry, 1.5, [3, 2], time * 20);
      }
      if (a.phase === 'gather' && a.type === 'golem') {
        // 採掘場の結晶
        miniCrystal(A.quarry.x + 4, A.ground - 8, 16, 0.9);
      }
      if (imgReady(im)) {
        var alpha = 1 - a.appear * 0.6;
        ctx.globalAlpha = alpha;
        var flip = a.to && a.to.x < a.x - 1 && (a.phase === 'carry' || a.phase === 'return');
        if (flip) {
          ctx.save();
          ctx.translate(px(x), 0); ctx.scale(-1, 1);
          ctx.drawImage(im, -size / 2, px(y - size / 2), size, size);
          ctx.restore();
        } else {
          ctx.drawImage(im, px(x - size / 2), px(y - size / 2), size, size);
        }
        ctx.globalAlpha = 1;
      }
      // 運んでいる魔力
      if (a.phase === 'carry' || (a.phase === 'gather' && a.carry > 0.3 && a.type !== 'egg')) {
        var amt = a.phase === 'carry' ? 1 : a.carry;
        if (a.type === 'spirit') {
          glow(x, y - size * 0.55, 7 * amt, 'rgba(159,220,255,1)', 0.9);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(px(x) - 1, px(y - size * 0.55) - 1, 3, 3);
        } else if (a.type === 'mage') {
          var oy = y - size * 0.7;
          glow(x + 6, oy, 10 * amt, 'rgba(200,107,255,1)', 0.9);
          ctx.fillStyle = '#f1e6ff'; ctx.fillRect(px(x + 6) - 2, px(oy) - 2, 4, 4);
        } else if (a.type === 'golem' && a.phase === 'carry') {
          glow(x, y - size * 0.6, 12, 'rgba(159,240,255,1)', 0.7);
          miniCrystal(x, y - size * 0.62, 16, 1);
        }
      }
    }

    function drawParticles() {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (!p.on) continue;
        var a = Math.min(1, p.life / p.max * 1.6);
        ctx.globalAlpha = p.ambient ? a * 0.8 : a;
        ctx.fillStyle = p.color;
        ctx.fillRect(px(p.x), px(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    function drawEffects() {
      for (var i = 0; i < effects.length; i++) {
        var e = effects[i], k = e.t / e.dur;
        if (e.kind === 'ring') {
          ellipseRing(e.x, e.y, lerp(e.r0, e.r1, k), lerp(e.r0, e.r1, k) * (e.flat || 1), e.color, 1 - k, e.width || 2, e.dash, time * 30);
        } else if (e.kind === 'beam') {
          // クリスタル → 塔 へ走る光
          var hx = lerp(e.x0, e.x1, ease(Math.min(1, k * 1.4))), hy = lerp(e.y0, e.y1, ease(Math.min(1, k * 1.4)));
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.lineTo(hx, hy); ctx.stroke();
          ctx.restore();
          glow(hx, hy, 14, 'rgba(255,240,200,1)', 1 - k);
        } else if (e.kind === 'circle') {
          // 魔法陣(ユニット解放・段階上昇)
          var rr = e.r * (0.6 + 0.4 * ease(Math.min(1, k * 2)));
          var al = k < 0.7 ? 1 : (1 - k) / 0.3;
          ellipseRing(e.x, e.y, rr, rr * e.flat, e.color, al * 0.9, 2, [6, 4], time * 40);
          ellipseRing(e.x, e.y, rr * 0.72, rr * 0.72 * e.flat, e.color2, al * 0.8, 1.5, [2, 3], -time * 50);
          for (var j = 0; j < 6; j++) {
            var an = j * Math.PI / 3 + time;
            ctx.globalAlpha = al; ctx.fillStyle = e.color2;
            ctx.fillRect(px(e.x + Math.cos(an) * rr) - 2, px(e.y + Math.sin(an) * rr * e.flat) - 2, 4, 4);
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      drawTower();
      drawCrystalAura();
      // 奥(上)にいるものから描く
      var list = actors.slice().sort(function (a, b) { return a.y - b.y; });
      for (var i = 0; i < list.length; i++) drawActor(list[i]);
      drawParticles();
      drawEffects();
    }

    // ---- ループ制御 -----------------------------------------------------------------
    var FRAME_MS = { normal: 1000 / 30, low: 1000 / 20 };
    function frame(now) {
      rafId = 0;
      if (!shouldRun()) { running = false; return; }
      rafId = requestAnimationFrame(frame);
      if (now - lastFrame < FRAME_MS[mode] - 1) return;
      var dt = Math.min(0.1, (now - lastFrame) / 1000 || 0); // 復帰直後でも一度に大きく進めない
      lastFrame = now;
      if (now - lastPlan > 500) { lastPlan = now; refreshPlan(false); }
      update(dt);
      draw();
      stats.frames++;
    }
    function shouldRun() { return mode !== 'off' && visible && inView; }
    function start() {
      if (running || !shouldRun()) return;
      running = true;
      lastFrame = performance.now();
      rafId = requestAnimationFrame(frame);
    }
    function stop() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; running = false; }

    function refreshPlan(fresh) {
      plan = scenePlan(getState(), mode);
      syncActors(fresh);
    }

    // 演出オフ: 動きのない1枚だけを描く(窓の明かり・浮遊結晶など成長の結果は見える)
    function drawStatic() {
      refreshPlan(false);
      particles.forEach(function (p) { p.on = false; });
      effects.length = 0;
      actors.forEach(function (a) { a.appear = 0; });
      draw();
    }

    function setMode(m) {
      mode = m;
      measure();
      refreshPlan(false);
      if (mode === 'off') { stop(); drawStatic(); } else start();
    }

    // ---- 外部からの通知(ゲームの出来事に反応) ----------------------------------------
    function active() { return mode !== 'off' && running; }
    function onClick() {
      crystalFlash = Math.min(1, crystalFlash + 0.5);
      if (active()) burst(A.crystal.x, A.crystal.y, mode === 'low' ? 4 : 8, COLORS.crystal, 90, 0.6);
    }
    function onPurchase() { refreshPlan(true); }
    function onUpgrade() {
      refreshPlan(false);
      if (!active()) return;
      addEffect({ kind: 'beam', x0: A.crystal.x, y0: A.crystal.y, x1: A.topWin.x, y1: A.topWin.y, t: 0, dur: 0.8, color: '#e6dcff' });
      towerFlash = 1;
    }
    function onUnlock() {
      refreshPlan(false);
      if (!active()) return;
      addEffect({ kind: 'circle', x: A.crystal.x, y: A.ground - 6, r: A.crystal.r * 1.4, flat: 0.3, t: 0, dur: 1.4, color: '#c86bff', color2: '#9ff0ff' });
    }
    function onStageUp(stage) {
      measure();
      refreshPlan(false);
      if (!active()) return;
      addEffect({ kind: 'circle', x: A.crystal.x, y: A.crystal.y, r: A.crystal.r * 1.6, flat: 1, t: 0, dur: 1.6, color: '#ffe08a', color2: '#b9a8ff' });
      addEffect({ kind: 'ring', x: A.crystal.x, y: A.crystal.y, t: 0, dur: 0.9, r0: 10, r1: A.crystal.r * 2.4, color: '#ffffff', width: 3 });
      burst(A.crystal.x, A.crystal.y, mode === 'low' ? 14 : 30, COLORS.crystal.concat(COLORS.gold), 130, 1.1);
      crystalFlash = 1; towerFlash = 1;
    }

    // ---- 初期化 -----------------------------------------------------------------------
    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      if (visible) start(); else stop();
    });
    if (typeof IntersectionObserver !== 'undefined') {
      new IntersectionObserver(function (es) {
        inView = es[0].isIntersecting;
        if (inView) start(); else stop();
      }).observe(stageEl);
    }
    var resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        measure();
        actors = []; // 位置を測り直したので、運搬サイクルを初期位置から再開
        refreshPlan(false);
        if (mode === 'off') drawStatic();
      }, 120);
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(onResize).observe(stageEl);
    else window.addEventListener('resize', onResize);
    // 画像の読み込み後に寸法を確定させる
    [crystalImgEl, towerImgEl].forEach(function (im) { if (!im.complete) im.addEventListener('load', onResize); });

    measure();
    refreshPlan(false);

    return {
      setMode: setMode, start: start, stop: stop, measure: measure,
      onClick: onClick, onPurchase: onPurchase, onUpgrade: onUpgrade, onUnlock: onUnlock, onStageUp: onStageUp,
      debug: function () {
        var counts = {};
        actors.forEach(function (a) { counts[a.type] = (counts[a.type] || 0) + 1; });
        var live = 0; particles.forEach(function (p) { if (p.on) live++; });
        return { mode: mode, running: running, plan: plan, actors: counts, actorTotal: actors.length, particles: live,
          effects: effects.length, frames: stats.frames, deliveries: stats.deliveries };
      }
    };
  }

  MTV.create = create;
})(typeof window !== 'undefined' ? window : this);
