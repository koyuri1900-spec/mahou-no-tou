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
    booth: { x: 0, y: 84, w: 168, h: 186 },
    win: { x: 4, y: 86, w: 160, h: 128 },
    heart: { x: 126, y: 198, w: 36, h: 14 },
    scale: { x: 6, y: 198, w: 40, h: 14 },
    tray: { x: 4, y: 216, w: 160, h: 28 },
    clock: { x: 4, y: 247, w: 82, h: 21 },
    bookSlot: { x: 90, y: 247, w: 34, h: 21 },
    citeBox: { x: 128, y: 247, w: 36, h: 21 },
    desk: { x: 168, y: 84, w: 312, h: 186 },
    kitBlood: { x: 172, y: 88, w: 22, h: 22 },
    kitXray: { x: 172, y: 114, w: 22, h: 22 },
    alarm: { x: 250, y: 88, w: 72, h: 26 },
    analyzer: { x: 374, y: 88, w: 102, h: 56 },
    loupeCase: { x: 374, y: 148, w: 44, h: 26 },
    drawerTab: { x: 468, y: 118, w: 12, h: 70 },
    drawer: { x: 394, y: 104, w: 86, h: 144 },
    inspect: { x: 418, y: 252, w: 58, h: 16 },
    endBtn: { x: 172, y: 252, w: 58, h: 16 }
  };

  // 身長の壁:205cm が窓の上端近く、140cm が窓の中ほど。頭頂の高さで身長を読む。
  // 申請者は壁の手前に立つので、絵の大きさは身長の目盛りとは別に、窓いっぱいに描く。
  const CM_PX = 1.1;
  V.cmToY = cm => V.L.win.y + 10 + (205 - cm) * CM_PX;
  V.CM_PX = CM_PX;
  V.BUST_K = 2.2;

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
    g.rect(0, 85, 168, 185, S[1]);
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
    [L.clock, L.bookSlot, L.citeBox].forEach(r => { g.rect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, S[0]); g.rect(r.x, r.y, r.w, r.h, S[2]); });

    // 机(右下)
    const d = L.desk;
    g.rect(d.x, d.y + 1, d.w, d.h, S[2]);
    g.dither(d.x, d.y + 1, d.w, d.h, S[3], 0.07);
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

  // X線像
  function bustX(A, k = V.BUST_K) {
    const { W, H, cx, rx, ry, cy } = geom(A, k);
    const g = V.gfx.art(W, H);
    const P = (x, y, c, w = 1, h = 1) => g.rect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), c);
    for (let y = Math.round(30 * k); y < H; y += 2) { const t = Math.min(1, (y - 30 * k) / (12 * k)), hw = (7 + t * 21) * k; g.rect(Math.round(cx - hw), y, Math.round(hw * 2), 1, S[2]); }
    for (let y = 0; y < 30 * k; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
      if (d <= 1 && d > 0.72) g.rect(x, y, 1, 1, S[7]);
    }
    P(cx - 6 * k, cy, S[5], 4 * k, 3 * k); P(cx + 2 * k, cy, S[5], 4 * k, 3 * k); P(cx - 4 * k, cy + 9 * k, S[6], 8 * k, 2 * k);
    for (let y = 26 * k; y < H; y += 3 * k) P(cx - k, y, S[7], 3 * k, 2 * k);
    P(cx - 18 * k, 36 * k, S[7], 14 * k, 2 * k); P(cx + 4 * k, 36 * k, S[7], 14 * k, 2 * k);
    for (let j = 0; j < 7; j++) { const y = (44 + j * 8) * k, w = (15 - Math.abs(j - 3)) * k; P(cx - 2 * k - w, y, S[6], w, k); P(cx + 3 * k, y, S[6], w, k); }
    P(cx - 26 * k, 40 * k, S[6], 3 * k, 40 * k); P(cx + 23 * k, 40 * k, S[6], 3 * k, 40 * k);
    if (A.xray === "pouch") { P(cx - 21 * k, 37 * k, S[8], 9 * k, 11 * k); P(cx - 20 * k, 38 * k, S[7], 7 * k, 9 * k); P(cx - 17 * k, 48 * k, S[8], 2 * k, 4 * k); }
    return g.canvas;
  }

  // ID用の小さな顔写真(24×30)
  function photo(A) {
    const big = bust(A, {}, 0.75), cx = Math.round(geom(A, 0.75).cx);
    const g = V.gfx.art(20, 26);
    g.rect(0, 0, 20, 26, S[5]);
    g.ctx.drawImage(big, cx - 10, 0, 20, 26, 0, 2, 20, 26);
    return g.canvas;
  }

  // ホールの人物(横向き、8×18)。walk は歩きの段階、facing は -1=左 1=右
  function walker(g, x, y, seed, frame, facing) {
    const r = V.rng(seed), coat = r.pick([S[3], S[4], S[5], S[1], S[6]]), skin = r.pick([S[7], S[6], S[5], S[4]]), hair = r.pick([S[0], S[1], S[5]]);
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
    const r = V.rng(seed), coat = r.pick([S[3], S[4], S[5], S[1], S[6]]), skin = r.pick([S[7], S[6], S[5], S[4]]), hair = r.pick([S[0], S[1], S[5]]);
    g.rect(x - 1, y + 17, 10, 1, S[0]);
    g.rect(x + 1, y + 6, 6, 8, coat);
    g.rect(x + 2, y, 4, 5, skin); g.rect(x + 2, y, 4, 2, hair);
    const step = frame % 2;
    g.rect(x + 2, y + 14, 2, 3 - step, S[1]); g.rect(x + 5, y + 14, 2, 2 + step, S[1]);
    if (r.chance(0.35)) g.rect(x + 7, y + 9, 2, 4, S[4]);
  }

  // 封蝋のような印章(搭乗券、規則冊子で使う)
  function seal(g, x, y, ver) {
    const r = 9;
    for (let a = 0; a < 64; a++) {
      const th = (a / 64) * Math.PI * 2;
      g.px(Math.round(x + Math.cos(th) * r), Math.round(y + Math.sin(th) * r), S[3]);
      if (a % (ver === V.SEAL_CURRENT ? 4 : 5) === 0) g.px(Math.round(x + Math.cos(th) * (r - 2)), Math.round(y + Math.sin(th) * (r - 2)), S[3]);
    }
    g.text(ver, x, y - 4, S[2], { align: "center" });
  }

  V.art = { background, bust, bustX, photo, queuePerson, seal, walker, guard, inspector };
})();
