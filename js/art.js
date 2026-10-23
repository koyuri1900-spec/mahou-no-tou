// VALID — ドット絵(背景、申請者、行列)
(function () {
  const S = V.S;

  // ---- 画面の配置(ドット座標)----
  V.L = {
    top: { x: 0, y: 0, w: 480, h: 12 },
    full: { x: 438, y: 1, w: 40, h: 10 },
    hall: { x: 0, y: 12, w: 480, h: 72 },
    booth: { x: 0, y: 84, w: 168, h: 186 },
    win: { x: 4, y: 86, w: 160, h: 128 },
    heart: { x: 126, y: 88, w: 36, h: 14 },
    scale: { x: 126, y: 198, w: 36, h: 14 },
    talk: { x: 4, y: 216, w: 160, h: 28 },
    tray: { x: 4, y: 246, w: 160, h: 22 },
    desk: { x: 168, y: 84, w: 312, h: 186 },
    kitBlood: { x: 172, y: 90, w: 22, h: 22 },
    kitHair: { x: 172, y: 116, w: 22, h: 22 },
    clock: { x: 200, y: 88, w: 66, h: 30 },
    alarm: { x: 272, y: 88, w: 72, h: 26 },
    analyzer: { x: 374, y: 88, w: 102, h: 56 },
    loupe: { x: 374, y: 148, w: 102, h: 40 },
    citeBox: { x: 172, y: 196, w: 30, h: 30 },
    bookSlot: { x: 172, y: 230, w: 30, h: 36 },
    call: { x: 206, y: 234, w: 50, h: 15 },
    inspect: { x: 206, y: 252, w: 50, h: 15 },
    xbtn: { x: 260, y: 234, w: 40, h: 15 },
    drawerTab: { x: 410, y: 256, w: 66, h: 14 },
    drawer: { x: 226, y: 196, w: 250, h: 58 }
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
    // 上の案内板
    g.rect(0, 0, 480, 12, S[1]); g.rect(0, 12, 480, 1, S[0]);
    // ホールの壁
    g.rect(0, 13, 480, 71, S[2]);
    g.dither(0, 13, 480, 10, S[1], 0.5);
    // 大窓と発射台
    g.rect(196, 18, 278, 50, S[0]);
    g.rect(198, 20, 274, 46, S[4]);
    for (let y = 20; y < 66; y++) g.dither(198, y, 274, 1, S[5], 1 - (y - 20) / 40);
    g.dither(198, 56, 274, 10, S[3], 0.5);
    for (let x = 198; x < 472; x += 46) g.rect(x, 20, 2, 46, S[0]);
    g.rect(198, 42, 274, 1, S[0]);
    // 発射塔と組み立て中のロケット
    const tx = 398;
    g.rect(tx, 24, 3, 42, S[1]); g.rect(tx + 10, 24, 3, 42, S[1]);
    for (let y = 26; y < 66; y += 5) { g.rect(tx, y, 13, 1, S[1]); g.px(tx + 4 + (y % 2), y + 2, S[1]); }
    g.rect(tx - 12, 22, 34, 2, S[1]); g.rect(tx - 12, 22, 1, 10, S[1]);
    const stages = Math.min(3, day);
    const rh = [16, 26, 36][stages - 1];
    g.rect(tx + 16, 66 - rh, 9, rh, S[1]);
    g.rect(tx + 14, 56, 2, 10, S[1]); g.rect(tx + 25, 56, 2, 10, S[1]);
    if (stages >= 3) { g.rect(tx + 17, 66 - rh - 3, 7, 3, S[1]); g.rect(tx + 19, 66 - rh - 5, 3, 2, S[1]); }
    g.rect(196, 66, 278, 2, S[0]);
    // 柱
    [40, 112].forEach(x => { g.rect(x, 13, 9, 63, S[1]); g.rect(x + 7, 13, 2, 63, S[3]); });
    // 床
    g.rect(0, 76, 480, 8, S[1]);
    for (let x = 0; x < 480; x += 20) g.rect(x, 76, 1, 8, S[2]);
    g.rect(0, 76, 480, 1, S[3]);
    // ベルトの仕切り
    for (let x = 64; x < 470; x += 40) { g.rect(x, 66, 2, 10, S[4]); g.rect(x - 1, 65, 4, 2, S[5]); }
    for (let x = 64; x < 430; x += 40) g.rect(x + 2, 68, 38, 1, S[3]);
    // ゲートの扉
    g.rect(150, 40, 18, 36, S[0]); g.rect(152, 42, 14, 34, S[3]); g.rect(158, 42, 2, 34, S[2]);
    g.rect(0, 84, 480, 1, S[0]);

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
    // 会話欄・受取口
    g.rect(L.talk.x - 1, L.talk.y - 1, L.talk.w + 2, L.talk.h + 2, S[0]);
    g.rect(L.talk.x, L.talk.y, L.talk.w, L.talk.h, S[2]);
    g.rect(L.tray.x - 1, L.tray.y - 1, L.tray.w + 2, L.tray.h + 2, S[0]);
    g.rect(L.tray.x, L.tray.y, L.tray.w, L.tray.h, S[0]);
    g.dither(L.tray.x, L.tray.y, L.tray.w, L.tray.h, S[2], 0.35);
    g.rect(L.tray.x, L.tray.y, L.tray.w, 2, S[3]);

    // 机(右下)
    const d = L.desk;
    g.rect(d.x, d.y + 1, d.w, d.h, S[2]);
    g.dither(d.x, d.y + 1, d.w, d.h, S[3], 0.07);
    g.rect(d.x, d.y + 1, 1, d.h, S[0]);
    // 規則冊子の置き場
    g.rect(L.bookSlot.x - 1, L.bookSlot.y - 1, L.bookSlot.w + 2, L.bookSlot.h + 2, S[1]);
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
    const big = bust(A, {}, 0.9), cx = Math.round(geom(A, 0.9).cx);
    const g = V.gfx.art(24, 30);
    g.rect(0, 0, 24, 30, S[5]);
    g.ctx.drawImage(big, cx - 12, 0, 24, 30, 0, 2, 24, 30);
    return g.canvas;
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

  V.art = { background, bust, bustX, photo, queuePerson, seal };
})();
