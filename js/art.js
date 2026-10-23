// VALID — ドット絵(背景、申請者、行列)
(function () {
  const S = V.S;

  // ---- 画面の配置(ドット座標)----
  V.L = {
    top: { x: 0, y: 0, w: 480, h: 12 },
    hall: { x: 0, y: 12, w: 480, h: 72 },
    booth: { x: 0, y: 84, w: 168, h: 186 },
    win: { x: 6, y: 88, w: 156, h: 100 },
    talk: { x: 6, y: 190, w: 116, h: 36 },
    tray: { x: 6, y: 228, w: 116, h: 38 },
    heart: { x: 124, y: 190, w: 38, h: 16 },
    scale: { x: 124, y: 208, w: 38, h: 14 },
    call: { x: 124, y: 224, w: 38, h: 20 },
    xbtn: { x: 124, y: 246, w: 38, h: 20 },
    desk: { x: 168, y: 84, w: 312, h: 186 },
    kitBlood: { x: 172, y: 90, w: 22, h: 22 },
    kitHair: { x: 172, y: 116, w: 22, h: 22 },
    analyzer: { x: 374, y: 88, w: 102, h: 56 },
    loupe: { x: 374, y: 148, w: 102, h: 40 },
    bookSlot: { x: 172, y: 230, w: 30, h: 36 },
    inspect: { x: 206, y: 254, w: 52, h: 14 },
    drawerTab: { x: 410, y: 256, w: 66, h: 14 },
    drawer: { x: 262, y: 200, w: 214, h: 56 }
  };

  // 身長の壁:120cm が窓の下端、200cm が上端近く
  const CM_PX = 1.175;
  V.cmToY = cm => V.L.win.y + V.L.win.h - (cm - 120) * CM_PX;
  V.CM_PX = CM_PX;

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
    // 身長の目盛り
    for (let cm = 120; cm <= 200; cm += 5) {
      const y = Math.round(V.cmToY(cm));
      const major = cm % 10 === 0;
      g.rect(w.x, y, major ? w.w : 10, 1, major ? S[4] : S[4]);
      if (major) g.rect(w.x, y, 6, 1, S[6]);
    }
    // 会話欄・受取口・横の装置
    g.rect(L.talk.x - 1, L.talk.y - 1, L.talk.w + 2, L.talk.h + 2, S[0]);
    g.rect(L.talk.x, L.talk.y, L.talk.w, L.talk.h, S[2]);
    g.rect(L.tray.x - 1, L.tray.y - 1, L.tray.w + 2, L.tray.h + 2, S[0]);
    g.rect(L.tray.x, L.tray.y, L.tray.w, L.tray.h, S[0]);
    g.dither(L.tray.x, L.tray.y, L.tray.w, L.tray.h, S[2], 0.35);
    g.rect(L.tray.x, L.tray.y, L.tray.w, 2, S[3]);
    [L.heart, L.scale].forEach(b => { g.rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, S[0]); g.rect(b.x, b.y, b.w, b.h, S[0]); });

    // 机(右下)
    const d = L.desk;
    g.rect(d.x, d.y + 1, d.w, d.h, S[2]);
    g.dither(d.x, d.y + 1, d.w, d.h, S[3], 0.07);
    g.rect(d.x, d.y + 1, 1, d.h, S[0]);
    // 道具棚
    g.rect(170, 88, 26, 52, S[1]);
    // 規則冊子の置き場
    g.rect(L.bookSlot.x - 1, L.bookSlot.y - 1, L.bookSlot.w + 2, L.bookSlot.h + 2, S[1]);
    return g.canvas;
  }

  // ---- 申請者の上半身(64×110)----
  const SKIN = [[S[7], S[6]], [S[6], S[5]], [S[5], S[4]], [S[4], S[3]]];
  function bust(A, opt = {}) {
    const g = V.gfx.art(64, 110), lk = A.look;
    const P = (x, y, c, w = 1, h = 1) => g.rect(x, y, w, h, c);
    const [sk, sk2] = SKIN[lk.skin];
    const cx = 32, rx = 8.5 + lk.face * 2, ry = 13.5, cy = 14;
    // 体
    for (let y = 30; y < 110; y++) {
      const t = Math.min(1, (y - 30) / 12), hw = 7 + t * 21 + (y > 42 ? 1 : 0);
      P(Math.round(cx - hw), y, lk.coat, Math.round(hw * 2), 1);
    }
    P(cx - 10, 31, S[0], 1, 30); P(cx + 9, 31, S[0], 1, 30); // 襟の影
    if (A.role === "乗員") { P(cx - 14, 46, V.S[1], 7, 4); P(cx + 8, 46, S[4], 6, 3); }
    if (A.role === "地上職員") { P(cx - 20, 50, S[5], 40, 2); P(cx - 4, 56, S[6], 8, 6); }
    // 首
    P(cx - 4, 25, sk2, 8, 8); P(cx - 4, 25, sk, 6, 6);
    P(cx - 6, 32, sk, 12, 3);
    // 頭
    for (let y = 0; y < 30; y++) for (let x = 0; x < 64; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) P(x, y, dx > 0.55 ? sk2 : sk);
    }
    // 耳
    P(Math.round(cx - rx) - 1, cy - 1, sk2, 2, 5); P(Math.round(cx + rx) - 1, cy - 1, sk2, 2, 5);
    // 髪
    const hc = lk.hair;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 64; x++) {
      const dx = (x + 0.5 - cx) / (rx + 1.2), dy = (y + 0.5 - cy) / (ry + 1.2), inside = dx * dx + dy * dy <= 1;
      const ax = Math.abs(x + 0.5 - cx);
      if (lk.style === 3 && !inside && y >= cy - 4 && y < 40 && ax <= rx + 3 && ax > rx - 1) { P(x, y, hc); continue; }
      if (!inside) continue;
      const top = y < cy - 6 - (lk.style === 4 ? 3 : 0);
      const side = ax > rx - 1.5 && y < cy;
      const fringe = lk.style === 1 && y < cy - 3 && x < cx + 2;
      if (lk.style === 4 && top && ax < rx - 3) continue;
      if (top || (lk.style !== 2 && side) || fringe) {
        if (lk.style === 2 && V.bayer(x, y) > 0.55) continue;
        P(x, y, hc);
      }
    }
    // 顔
    const ey = cy + 1, ex1 = cx - 6, ex2 = cx + 2;
    P(ex1 - 1, ey - 3, S[1], 5, 1); P(ex2, ey - 3, S[1], 5, 1);
    const iris = V.IRIS[lk.eyeP];
    P(ex1, ey, S[8], 1, 1); P(ex1 + 1, ey, iris, 2, 1); P(ex1 + 1, ey + 1, S[0], 2, 1);
    P(ex2 + 1, ey, iris, 2, 1); P(ex2 + 3, ey, S[8], 1, 1); P(ex2 + 1, ey + 1, S[0], 2, 1);
    P(cx, ey + 3, sk2, 1, 4); P(cx - 1, ey + 6, sk2, 3, 1);
    P(cx - 3, ey + 10, opt.mouth || S[3], 6, 1);
    if (lk.beard) for (let y = ey + 8; y < cy + ry; y++) for (let x = cx - 6; x <= cx + 6; x++) if (V.bayer(x, y) < 0.4) P(x, y, lk.hair);
    if (opt.sweat) { P(cx - 7, cy - 4, S[8]); P(cx + 7, cy - 2, S[8]); P(cx + 6, cy + 3, S[8]); }
    return g.canvas;
  }

  // X線像(64×110)
  function bustX(A) {
    const g = V.gfx.art(64, 110), lk = A.look, cx = 32, rx = 8.5 + lk.face * 2, cy = 14;
    const P = (x, y, c, w = 1, h = 1) => g.rect(x, y, w, h, c);
    // 体の輪郭(うっすら)
    for (let y = 30; y < 110; y++) { const t = Math.min(1, (y - 30) / 12), hw = 7 + t * 21; if (y % 2 === 0) P(Math.round(cx - hw), y, S[2], Math.round(hw * 2), 1); }
    // 頭蓋
    for (let y = 0; y < 30; y++) for (let x = 0; x < 64; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / 13.5, d = dx * dx + dy * dy;
      if (d <= 1 && d > 0.7) P(x, y, S[7]);
    }
    P(cx - 6, cy, S[5], 4, 3); P(cx + 2, cy, S[5], 4, 3); P(cx - 4, cy + 9, S[6], 8, 2);
    // 背骨・鎖骨・肋骨
    for (let y = 26; y < 110; y += 3) P(cx - 1, y, S[7], 3, 2);
    P(cx - 18, 36, S[7], 14, 2); P(cx + 4, 36, S[7], 14, 2);
    for (let k = 0; k < 7; k++) { const y = 44 + k * 8, w = 15 - Math.abs(k - 3); P(cx - 2 - w, y, S[6], w, 1); P(cx + 3, y, S[6], w, 1); P(cx - 2 - w, y + 1, S[6], 1, 3); P(cx + 2 + w, y + 1, S[6], 1, 3); }
    // 上腕
    P(cx - 26, 40, S[6], 3, 40); P(cx + 23, 40, S[6], 3, 40);
    // 不審物
    if (A.xray === "pouch") { P(cx - 22, 58, S[8], 10, 14); P(cx - 21, 59, S[7], 8, 12); P(cx - 20, 72, S[8], 2, 6); }
    return g.canvas;
  }

  // ID用の小さな顔写真(24×30)
  function photo(A) {
    const big = bust(A);
    const g = V.gfx.art(24, 30);
    g.rect(0, 0, 24, 30, S[5]);
    g.ctx.drawImage(big, 20, 0, 24, 30, 0, 2, 24, 30);
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
