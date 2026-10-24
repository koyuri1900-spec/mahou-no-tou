// VALID — ドット絵(背景、申請者、行列)
(function () {
  const S = V.S;

  // ---- 画面の配置(ドット座標)----
  V.L = {
    hint: { x: 0, y: 0, w: 480, h: 11 },
    full: { x: 458, y: 13, w: 18, h: 11 },
    hall: { x: 0, y: 0, w: 480, h: 84 },
    board: { x: 96, y: 13, w: 72, h: 20 },
    kiosk: { x: 96, y: 36, w: 72, h: 44 },
    // 窓口(左)は狭く、机(右)を広く
    booth: { x: 0, y: 84, w: 126, h: 186 },
    win: { x: 4, y: 86, w: 118, h: 128 },
    tray: { x: 4, y: 216, w: 118, h: 28 },
    clock: { x: 4, y: 247, w: 80, h: 21 },
    bookSlot: { x: 88, y: 247, w: 34, h: 21 },
    desk: { x: 126, y: 84, w: 354, h: 186 },
    // 机の上端に据え付けた計器の帯(身体・遺伝子・記録)
    gauge: { x: 128, y: 86, w: 350, h: 34 },
    gBody: { x: 128, y: 86, w: 104, h: 34 },
    gGene: { x: 234, y: 86, w: 140, h: 34 },
    gRec: { x: 376, y: 86, w: 102, h: 34 },
    alarm: { x: 282, y: 124, w: 80, h: 18 },
    // 判定端末:カードを寝かせて置く読み取り台と、右の細いキーの列
    terminal: { x: 384, y: 204, w: 94, h: 46 },
    citeBox: { x: 130, y: 250, w: 44, h: 18 },
    inspect: { x: 418, y: 252, w: 58, h: 16 }
  };

  // 身長の壁:205cm が窓の上端近く、140cm が窓の中ほど。頭頂の高さで身長を読む。
  // 申請者は壁の手前に立つので、絵の大きさは身長の目盛りとは別に、窓いっぱいに描く。
  const CM_PX = 1.1;
  V.cmToY = cm => V.L.win.y + 10 + (205 - cm) * CM_PX;
  V.CM_PX = CM_PX;
  V.BUST_K = 1.75;

  // ---- 背景(1日ごとに作り直す。ロケットの組み上がりが変わる)----
  function background(day) {
    const g = V.gfx.art(480, 270), L = V.L;
    // ホールの壁
    g.rect(0, 0, 480, 84, S[2]);
    g.dither(0, 0, 480, 12, S[1], 0.5);
    // 大窓と発射台
    g.rect(196, 14, 278, 50, S[0]);
    g.rect(198, 16, 274, 46, S[4]);
    for (let y = 16; y < 62; y++) g.dither(198, y, 274, 1, S[5], 1 - (y - 16) / 40);
    g.dither(198, 52, 274, 10, S[3], 0.5);
    for (let x = 198; x < 472; x += 46) g.rect(x, 16, 2, 46, S[0]);
    g.rect(198, 38, 274, 1, S[0]);
    const tx = 398;
    g.rect(tx, 20, 3, 42, S[1]); g.rect(tx + 10, 20, 3, 42, S[1]);
    for (let y = 22; y < 62; y += 5) { g.rect(tx, y, 13, 1, S[1]); g.px(tx + 4 + (y % 2), y + 2, S[1]); }
    g.rect(tx - 12, 18, 34, 2, S[1]); g.rect(tx - 12, 18, 1, 10, S[1]);
    const stages = Math.min(3, day), rh = [16, 26, 36][stages - 1];
    g.rect(tx + 16, 62 - rh, 9, rh, S[1]);
    g.rect(tx + 14, 52, 2, 10, S[1]); g.rect(tx + 25, 52, 2, 10, S[1]);
    if (stages >= 3) { g.rect(tx + 17, 62 - rh - 3, 7, 3, S[1]); g.rect(tx + 19, 62 - rh - 5, 3, 2, S[1]); }
    g.rect(196, 62, 278, 2, S[0]);
    // 床
    g.rect(0, 76, 480, 8, S[1]);
    for (let x = 0; x < 480; x += 20) g.rect(x, 76, 1, 8, S[2]);
    g.rect(0, 76, 480, 1, S[3]);
    // 行列の仕切り
    for (let x = 184; x < 470; x += 40) { g.rect(x, 64, 2, 12, S[4]); g.rect(x - 1, 63, 4, 2, S[5]); }
    for (let x = 184; x < 430; x += 40) g.rect(x + 2, 66, 38, 1, S[3]);
    // 出発口(左端)
    g.rect(6, 22, 40, 54, S[0]); g.rect(9, 25, 34, 51, S[1]);
    g.rect(9, 25, 34, 6, S[3]);
    g.dither(9, 31, 34, 45, S[0], 0.35);
    // 改札の柵
    g.rect(48, 60, 3, 16, S[4]); g.rect(48, 60, 30, 2, S[4]);
    // 詰所(あなたの窓口)
    const k = L.kiosk;
    g.rect(k.x, k.y, k.w, k.h, S[1]); g.frame(k.x, k.y, k.w, k.h, S[0]);
    g.rect(k.x + 6, k.y + 6, k.w - 12, 24, S[0]);
    g.rect(k.x + 7, k.y + 7, k.w - 14, 22, S[3]);
    g.dither(k.x + 7, k.y + 7, k.w - 14, 22, S[4], 0.2);
    g.rect(k.x + 4, k.y + 32, k.w - 8, 3, S[4]);
    g.rect(k.x + k.w - 6, k.y + 10, 6, 26, S[3]);
    // 掲示板の枠
    const bd = L.board;
    g.rect(bd.x, bd.y, bd.w, bd.h, S[0]); g.frame(bd.x, bd.y, bd.w, bd.h, S[4]);
    g.rect(bd.x + 34, bd.y + bd.h, 4, k.y - bd.y - bd.h, S[1]);

    // 窓口(左下)
    g.rect(0, 85, L.booth.w, 185, S[1]);
    const w = L.win;
    g.rect(w.x - 2, w.y - 2, w.w + 4, w.h + 4, S[0]);
    g.rect(w.x, w.y, w.w, w.h, S[3]);
    g.dither(w.x, w.y, w.w, w.h, S[2], 0.18);
    // 身長の目盛り(140〜205cm)
    for (let cm = 140; cm <= 205; cm += 5) {
      const y = Math.round(V.cmToY(cm)), major = cm % 10 === 0;
      g.rect(w.x, y, w.w, 1, major ? S[4] : S[2]);
      g.rect(w.x, y, major ? 8 : 4, 1, S[6]);
    }
    // 壁の下の腰板
    const base = Math.round(V.cmToY(135));
    g.rect(w.x, base, w.w, w.y + w.h - base, S[2]);
    g.dither(w.x, base, w.w, w.y + w.h - base, S[1], 0.25);
    // 受取口(窓口の入口)と、その下の時計・規則冊子・切符入れ
    g.rect(L.tray.x - 1, L.tray.y - 1, L.tray.w + 2, L.tray.h + 2, S[0]);
    g.rect(L.tray.x, L.tray.y, L.tray.w, L.tray.h, S[0]);
    g.dither(L.tray.x, L.tray.y, L.tray.w, L.tray.h, S[2], 0.35);
    g.rect(L.tray.x, L.tray.y, L.tray.w, 2, S[3]);
    [L.clock, L.bookSlot].forEach(r => { g.rect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, S[0]); g.rect(r.x, r.y, r.w, r.h, S[2]); });

    // 机(右下)
    // 机(右下):机の面そのものが液晶。淡い格子が光っている
    const d = L.desk, C = V.LCD;
    g.rect(d.x, d.y + 1, d.w, d.h, C.base);
    for (let x = d.x + 6; x < d.x + d.w; x += 12) g.rect(x, d.y + 1, 1, d.h, "rgba(159,195,201,.035)");
    for (let y = d.y + 7; y < d.y + d.h; y += 12) g.rect(d.x, y, d.w, 1, "rgba(159,195,201,.035)");
    g.rect(d.x, d.y + 1, d.w, 1, C.line);
    g.rect(d.x, d.y + 1, 1, d.h, S[0]);
    return g.canvas;
  }

  // ---- 申請者の上半身 ----
  // k は大きさの倍率。窓口では V.BUST_K、ID写真では 0.9。
  const SKIN = [[S[7], S[6]], [S[6], S[5]], [S[5], S[4]], [S[4], S[3]]];
  function geom(A, k) {
    const lk = A.look, W = Math.round(64 * k), H = Math.round(110 * k);
    return { W, H, cx: W / 2, rx: (8.5 + lk.face * 2) * k, ry: 13.5 * k, cy: 14 * k };
  }
  function bust(A, opt = {}, k = V.BUST_K) {
    const { W, H, cx, rx, ry, cy } = geom(A, k);
    const g = V.gfx.art(W, H), lk = A.look;
    const P = (x, y, c, w = 1, h = 1) => g.rect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), c);
    const [sk, sk2] = SKIN[lk.skin];
    // 体
    for (let y = Math.round(30 * k); y < H; y++) {
      const t = Math.min(1, (y - 30 * k) / (12 * k)), hw = (7 + t * 21) * k;
      g.rect(Math.round(cx - hw), y, Math.round(hw * 2), 1, lk.coat);
      if (y > 44 * k) { g.rect(Math.round(cx - hw), y, Math.round(2 * k), 1, S[2]); }
    }
    P(cx - 10 * k, 31 * k, S[1], k * 0.6, 30 * k); P(cx + 9.4 * k, 31 * k, S[1], k * 0.6, 30 * k);
    if (A.role === "乗員") { P(cx - 15 * k, 46 * k, S[1], 7 * k, 4 * k); P(cx + 8 * k, 46 * k, S[4], 6 * k, 3 * k); }
    if (A.role === "地上職員") { P(cx - 20 * k, 50 * k, S[5], 40 * k, 2 * k); P(cx - 4 * k, 56 * k, S[6], 8 * k, 6 * k); }
    // 首
    P(cx - 4 * k, 25 * k, sk2, 8 * k, 8 * k); P(cx - 4 * k, 25 * k, sk, 6 * k, 6 * k);
    P(cx - 6 * k, 32 * k, sk, 12 * k, 3 * k);
    // 頭
    for (let y = 0; y < 30 * k; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) g.rect(x, y, 1, 1, dx > 0.55 ? sk2 : sk);
    }
    // 耳
    P(cx - rx - k, cy - k, sk2, 2 * k, 5 * k); P(cx + rx - k, cy - k, sk2, 2 * k, 5 * k);
    // 髪
    const hc = lk.hair;
    for (let y = 0; y < 40 * k; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / (rx + 1.2 * k), dy = (y + 0.5 - cy) / (ry + 1.2 * k), inside = dx * dx + dy * dy <= 1;
      const ax = Math.abs(x + 0.5 - cx);
      if (lk.style === 3 && !inside && y >= cy - 4 * k && y < 40 * k && ax <= rx + 3 * k && ax > rx - k) { g.rect(x, y, 1, 1, hc); continue; }
      if (!inside) continue;
      const top = y < cy - (6 + (lk.style === 4 ? 3 : 0)) * k;
      const side = ax > rx - 1.5 * k && y < cy;
      const fringe = lk.style === 1 && y < cy - 3 * k && x < cx + 2 * k;
      if (lk.style === 4 && top && ax < rx - 3 * k) continue;
      if (top || (lk.style !== 2 && side) || fringe) {
        if (lk.style === 2 && V.bayer(x, y) > 0.55) continue;
        g.rect(x, y, 1, 1, hc);
      }
    }
    // 顔
    const ey = cy + k, ex1 = cx - 6.5 * k, ex2 = cx + 1.5 * k, ew = 5 * k;
    P(ex1 - 0.5 * k, ey - 3 * k, S[1], ew + k, Math.max(1, 0.7 * k)); P(ex2, ey - 3 * k, S[1], ew + k, Math.max(1, 0.7 * k));
    const iris = V.IRIS[lk.eyeP];
    [ex1, ex2].forEach(ex => {
      P(ex, ey, S[8], ew, 1.4 * k);
      P(ex + 1.5 * k, ey, iris, 2 * k, 1.4 * k);
      if (k >= 1.5) { P(ex + 2.2 * k, ey + 0.3 * k, S[0], 0.7 * k, 0.8 * k); P(ex + 1.6 * k, ey, S[8], 1, 1); }
      P(ex, ey + 1.4 * k, sk2, ew, 1);
    });
    P(cx, ey + 3 * k, sk2, Math.max(1, 0.6 * k), 4 * k); P(cx - k, ey + 6.5 * k, sk2, 3 * k, Math.max(1, 0.6 * k));
    P(cx - 3 * k, ey + 10 * k, opt.mouth || S[3], 6 * k, Math.max(1, 0.7 * k));
    if (k >= 1.5) P(cx - 2 * k, ey + 10.7 * k, sk2, 4 * k, 1);
    if (lk.beard) for (let y = Math.round(ey + 8 * k); y < cy + ry; y++) for (let x = Math.round(cx - 6 * k); x <= cx + 6 * k; x++) if (V.bayer(x, y) < 0.4) g.rect(x, y, 1, 1, lk.hair);
    if (opt.sweat) { P(cx - 7 * k, cy - 4 * k, S[8], k, k); P(cx + 7 * k, cy - 2 * k, S[8], k, k); P(cx + 6 * k, cy + 3 * k, S[8], k, 1.5 * k); }
    if (opt.angry) { P(ex1 + k, ey - 2 * k, S[0], 3 * k, Math.max(1, 0.7 * k)); P(ex2 + k, ey - 2 * k, S[0], 3 * k, Math.max(1, 0.7 * k)); P(cx - 3 * k, ey + 9.5 * k, S[0], 6 * k, 1.4 * k); }
    return g.canvas;
  }

  // ---- X線写真(全身)----
  // 高さ H の全身像。比率は身長100単位(u)で決める。骨は灰、体内の金属は真っ白に写る。
  // A.xray:pad=前腕の血液パッドと指先への管 / bolts=すねの延長ボルト / device=胸の心臓の機器 / plate=前腕の手術の金属板(無害)
  function xrayBody(A, H) {
    H = Math.round(H);
    const W = Math.round(H * 0.5), u = H / 100, cx = W / 2;
    const g = V.gfx.art(W, H);
    const big = H > 160;
    // 線分からの距離が r 以内の画素を塗る(dith<1 なら網点で薄く)
    function cap(x0, y0, x1, y1, r, col, dith = 1) {
      const minX = Math.floor(Math.min(x0, x1) - r), maxX = Math.ceil(Math.max(x0, x1) + r);
      const minY = Math.floor(Math.min(y0, y1) - r), maxY = Math.ceil(Math.max(y0, y1) + r);
      const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const t = V.clamp(((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / L2, 0, 1);
        const ex = x + 0.5 - (x0 + dx * t), ey = y + 0.5 - (y0 + dy * t);
        if (ex * ex + ey * ey <= r * r && (dith >= 1 || V.bayer(x, y) < dith)) g.rect(x, y, 1, 1, col);
      }
    }
    function oval(x0, y0, rx, ry, col, ring, dith = 1) {
      for (let y = Math.floor(y0 - ry); y <= y0 + ry; y++) for (let x = Math.floor(x0 - rx); x <= x0 + rx; x++) {
        const d = ((x + 0.5 - x0) / rx) ** 2 + ((y + 0.5 - y0) / ry) ** 2;
        if (d <= 1 && (!ring || d >= ring) && (dith >= 1 || V.bayer(x, y) < dith)) g.rect(x, y, 1, 1, col);
      }
    }
    // 骨:外側(皮質)を明るく、内側を少し暗く。大きく描くときだけ二層にする
    const bone = (x0, y0, x1, y1, r) => { cap(x0 * u + cx, y0 * u, x1 * u + cx, y1 * u, Math.max(0.6, r * u), S[6]); if (big && r * u > 1.6) cap(x0 * u + cx, y0 * u, x1 * u + cx, y1 * u, r * u - 1.2, S[5]); };
    const metal = (x0, y0, x1, y1, r) => cap(x0 * u + cx, y0 * u, x1 * u + cx, y1 * u, Math.max(0.6, r * u), S[8]);
    const sides = fn => { fn(1); fn(-1); };
    g.rect(0, 0, W, H, S[0]);
    // 軟部組織(体の輪郭):薄い網点
    oval(cx, 7.5 * u, 6.4 * u, 7.6 * u, S[2], 0, 0.7);
    cap(cx, 14 * u, cx, 18 * u, 3 * u, S[2], 0.7);
    for (let y = 18; y < 58; y++) { const t = (y - 18) / 40, hw = (y < 24 ? 8 + (y - 18) * 0.7 : 12.2 - t * 3.5) * u; cap(cx - hw, y * u, cx + hw, y * u, 0.6 * u, S[2], 0.75); }
    sides(s => { cap(cx + s * 11.5 * u, 20 * u, cx + s * 13 * u, 50 * u, 2.4 * u, S[2], 0.7); cap(cx + s * 13 * u, 50 * u, cx + s * 13.8 * u, 57 * u, 1.6 * u, S[2], 0.7); });
    sides(s => { cap(cx + s * 5 * u, 57 * u, cx + s * 4.2 * u, 78 * u, 3.6 * u, S[2], 0.7); cap(cx + s * 4.2 * u, 78 * u, cx + s * 4 * u, 96 * u, 2.4 * u, S[2], 0.7); cap(cx + s * 4 * u, 97 * u, cx + s * 5.5 * u, 99 * u, 1.4 * u, S[2], 0.7); });
    // 頭蓋骨
    oval(cx, 7 * u, 5.2 * u, 6.4 * u, S[3], 0, 0.55);
    oval(cx, 7 * u, 5.2 * u, 6.4 * u, S[6], 0.72);
    sides(s => oval(cx + s * 2.1 * u, 7.6 * u, 1.4 * u, 1.2 * u, S[1]));
    oval(cx, 9.6 * u, 0.6 * u, 1 * u, S[1]);
    for (let x = -2.4; x <= 2.4; x += big ? 0.8 : 1.2) cap(cx + x * u, 11.5 * u, cx + x * u, 12.3 * u, Math.max(0.4, 0.3 * u), S[7]);
    for (let k = 0; k <= 16; k++) { const a = Math.PI * (k / 16); cap(cx - Math.cos(a) * 4.4 * u, 10 * u + Math.sin(a) * 4 * u, cx - Math.cos(a + Math.PI / 16) * 4.4 * u, 10 * u + Math.sin(a + Math.PI / 16) * 4 * u, Math.max(0.5, 0.6 * u), S[6]); }
    // 背骨(椎骨を1つずつ)
    for (let y = 14.5; y < 55; y += 1.9) { const w = y < 19 ? 1 : y < 40 ? 1.3 : 1.7; cap(cx - w * u, y * u, cx + w * u, y * u, Math.max(0.5, 0.65 * u), S[6]); }
    // 鎖骨・肩甲骨・胸骨
    sides(s => { bone(s * 1.2, 19.2, s * 10.5, 18.2, 0.55); bone(s * 7, 20.5, s * 9.5, 27, 0.9); });
    bone(0, 20.2, 0, 31, 0.6);
    // 肋骨:背骨から外へ、弧を描いて下がる
    const nr = big ? 10 : 7, gap = big ? 1.9 : 2.6;
    for (let i = 0; i < nr; i++) {
      const j = i * 10 / nr, y0 = 20.5 + i * gap, w = 6.5 + Math.min(j, 5) * 0.75 - Math.max(0, j - 6) * 0.9;
      sides(s => { let px = 0, py = y0; for (let k = 1; k <= 10; k++) { const t = k / 10, x = w * Math.sin(t * 1.7) / Math.sin(1.7), y = y0 + 3.2 * t * t; bone(s * (1.4 + px), py, s * (1.4 + x), y, big ? 0.42 : 0.3); px = x; py = y; } });
    }
    // 骨盤と仙骨
    sides(s => { oval(cx + s * 5.2 * u, 53 * u, 4.2 * u, 3.6 * u, S[6], 0.6); bone(s * 2.4, 56.5, s * 4.8, 58.5, 0.7); oval(cx + s * 4.6 * u, 57.6 * u, 1.3 * u, 1.3 * u, S[5]); });
    oval(cx, 54.5 * u, 1.8 * u, 2.6 * u, S[5], 0, 0.8);
    sides(s => bone(s * 4.2, 58.8, s * 0.6, 60.2, 0.55));
    // 腕:上腕骨、前腕の2本、手の骨
    sides(s => {
      oval(cx + s * 11.3 * u, 19.6 * u, 1.4 * u, 1.4 * u, S[6]);
      bone(s * 11.4, 20, s * 12.4, 35.5, 0.95);
      bone(s * 12.2, 36.5, s * 12.8, 49.5, 0.55); bone(s * 13.3, 36.5, s * 14, 49.5, 0.55);
      for (let f = 0; f < 4; f++) bone(s * (12.6 + f * 0.55), 50.5, s * (12.5 + f * 0.75), 56.5 + (f === 1 || f === 2 ? 0.8 : 0), 0.28);
      bone(s * 12.4, 50.5, s * 11.2, 54, 0.3);
    });
    // 脚:大腿骨、膝のお皿、すねの2本、足
    sides(s => {
      oval(cx + s * 4.6 * u, 57.6 * u, 1.1 * u, 1.1 * u, S[7]);
      bone(s * 5, 58.5, s * 4.3, 77, 1.15);
      oval(cx + s * 4.2 * u, 78.2 * u, 1.1 * u, 0.9 * u, S[6]);
      bone(s * 4, 79.5, s * 3.9, 95.5, 0.85); bone(s * 5.3, 80, s * 5.4, 95, 0.4);
      bone(s * 3.8, 96.5, s * 6.2, 98.6, 0.6);
    });
    // 体内の物
    const kind = A.xray;
    if (kind === "pad") { // 前腕の内側に血液の袋、細い管が人差し指の先へ
      metal(12.2, 40, 12.2, 45, 0.9); cap((12.2 * u) + cx, 45 * u, (12.6 * u) + cx, 57.2 * u, Math.max(0.4, 0.22 * u), S[8]);
      oval(cx + 12.6 * u, 57.3 * u, Math.max(1, 0.6 * u), Math.max(1, 0.6 * u), S[8]);
    } else if (kind === "bolts") { // すねの骨に沿った金属の棒と、ねじの頭
      sides(s => { metal(s * 4.6, 80.5, s * 4.6, 93.5, 0.3); [81.5, 87, 92.5].forEach(y => metal(s * 3.2, y, s * 6, y, 0.25)); });
    } else if (kind === "device") { // 左胸の機器と、心臓へのびる導線
      metal(-6.2, 21.5, -3.6, 23.4, 0.9);
      let px = -4, py = 23; for (let k = 1; k <= 8; k++) { const t = k / 8, x = -4 + 4.6 * t, y = 23 + 7 * t + Math.sin(t * 3) * 0.8; cap(px * u + cx, py * u, x * u + cx, y * u, Math.max(0.4, 0.18 * u), S[8]); px = x; py = y; }
    } else if (kind === "plate") { // 前腕の骨折を留めた金属板(医療の跡。偽装ではない)
      metal(-12.9, 40, -13.3, 46, 0.25); [41, 43, 45].forEach(y => oval(cx - 13.1 * u, y * u, Math.max(0.8, 0.35 * u), Math.max(0.8, 0.35 * u), S[8]));
    }
    return g.canvas;
  }

  // look を渡すと、その見た目で撮った写真になる(登録簿やカードの写真)
  // w×h の枠に、倍率 k で撮る
  function photo(A, look, w = 20, h = 26, k = 0.75) {
    const B = look ? Object.assign({}, A, { look }) : A;
    const big = bust(B, {}, k), cx = Math.round(geom(B, k).cx);
    const g = V.gfx.art(w, h);
    g.rect(0, 0, w, h, S[5]);
    g.ctx.drawImage(big, cx - Math.floor(w / 2), 0, w, h, 0, Math.round(h * 0.08), w, h);
    return g.canvas;
  }

  // 正面以外を向いている人は黒い影で描く
  function silhouette(src) {
    const c = V.gfx.makeCanvas(src.width, src.height), x = c.getContext("2d");
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = S[0]; x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ホールの人物(横向き、8×18)。walk は歩きの段階、facing は -1=左 1=右、sil で影
  function walker(g, x, y, seed, frame, facing, sil) {
    const r = V.rng(seed);
    let coat = r.pick([S[3], S[4], S[5], S[1], S[6]]), skin = r.pick([S[7], S[6], S[5], S[4]]), hair = r.pick([S[0], S[1], S[5]]);
    if (sil) { coat = S[1]; skin = S[1]; hair = S[0]; }
    g.rect(x - 1, y + 17, 10, 1, S[0]);
    g.rect(x + 1, y + 6, 6, 8, coat);
    g.rect(x + 2, y, 4, 5, skin); g.rect(x + 2, y, 4, 2, hair);
    g.rect(facing < 0 ? x + 2 : x + 5, y + 2, 1, 1, S[0]);
    const st = frame % 4;
    g.rect(x + 2 + (st === 1 ? -1 : st === 3 ? 1 : 0), y + 14, 2, 3, S[1]);
    g.rect(x + 5 + (st === 1 ? 1 : st === 3 ? -1 : 0), y + 14, 2, 3, S[1]);
  }

  // 警備員(10×22)。alert で身構える
  function guard(g, x, y, t, alert) {
    const sway = alert ? 0 : Math.round(Math.sin(t * 1.2) * 0.5);
    g.rect(x - 1, y + 21, 12, 1, S[0]);
    g.rect(x + 1, y + 7 + sway, 8, 10, S[0]);
    g.rect(x + 2, y + 1 + sway, 6, 6, S[5]);
    g.rect(x + 1, y + sway, 8, 3, S[0]); g.rect(x, y + 2 + sway, 10, 1, S[0]);
    g.rect(x + 2, y + 17, 2, 4, S[0]); g.rect(x + 6, y + 17, 2, 4, S[0]);
    g.rect(x + 3, y + 9 + sway, 4, 1, S[4]);
    if (alert) { g.rect(x + 9, y + 8, 3, 2, S[0]); g.rect(x + 11, y + 6, 1, 6, S[4]); }
  }

  // 詰所の中に座るあなた(後ろ斜めから)
  // 窓口の外に向いて(右向き)座る。右の小窓の先に申請者が立つ
  function inspector(g, x, y, t, busy) {
    const look = busy ? Math.round(Math.sin(t * 0.7) * 0.6) : 0;
    // 卓上の灯り(背中側)
    g.rect(x - 10, y + 6, 1, 10, S[0]); g.rect(x - 14, y + 5, 8, 2, S[0]);
    g.dither(x - 18, y + 7, 14, 9, S[6], 0.15);
    // 椅子と体
    g.rect(x - 2, y + 6, 3, 13, S[0]);
    g.rect(x, y + 9, 13, 9, S[0]);
    g.rect(x + 2 + look, y + 1, 9, 9, S[1]);
    g.rect(x + 2 + look, y + 1, 9, 3, S[0]);
    g.rect(x + 9 + look, y + 4, 2, 2, S[4]);
    // 前に伸ばした腕と机
    g.rect(x + 11, y + 12, 9, 2, S[0]);
    g.rect(x + 8, y + 15, 16, 2, S[3]);
  }

  // 行列の人(8×18)
  function queuePerson(g, x, y, seed, frame) {
    const r = V.rng(seed); r(); r(); r();
    const coat = S[1], skin = S[1], hair = S[0]; // 列の人々は影

    g.rect(x - 1, y + 17, 10, 1, S[0]);
    g.rect(x + 1, y + 6, 6, 8, coat);
    g.rect(x + 2, y, 4, 5, skin); g.rect(x + 2, y, 4, 2, hair);
    const step = frame % 2;
    g.rect(x + 2, y + 14, 2, 3 - step, S[1]); g.rect(x + 5, y + 14, 2, 2 + step, S[1]);
    if (r.chance(0.35)) g.rect(x + 7, y + 9, 2, 4, S[4]);
  }

  // 封蝋のような印章(搭乗券、規則冊子で使う)
  // col を渡すと、その色で描く(液晶の上では光る線で)
  function seal(g, x, y, ver, col, r = 9) {
    const c = col || S[3];
    for (let a = 0; a < 64; a++) {
      const th = (a / 64) * Math.PI * 2;
      g.px(Math.round(x + Math.cos(th) * r), Math.round(y + Math.sin(th) * r), c);
      if (a % (ver === V.SEAL_CURRENT ? 4 : 5) === 0) g.px(Math.round(x + Math.cos(th) * (r - 2)), Math.round(y + Math.sin(th) * (r - 2)), c);
    }
    g.text(ver, x, y - (r < 9 ? 3 : 4), col || S[2], { align: "center", size: r < 9 ? 12 : 16 });
  }

  V.art = { background, bust, xrayBody, photo, geom, queuePerson, seal, walker, guard, inspector, silhouette };
})();
