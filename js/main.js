// VALID — 起動、画面の切り替え、入力、保存
(function () {
  const SAVE_KEY = "valid.save.v1", SET_KEY = "valid.settings.v1";
  const canvas = document.getElementById("screen");
  const surface = new V.Surface(canvas, 2);

  const storage = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  const freshState = () => ({ day: 1, credits: V.START_CREDITS, airi: 3, flags: {}, stats: { processed: 0, correct: 0, citations: 0 } });

  const game = {
    state: freshState(),
    scene: null,
    set(scene) { this.scene = scene; if (scene.enter) scene.enter(); },
    loadSave() { const s = storage.get(SAVE_KEY); return s && s.day ? s : null; },
    save() { storage.set(SAVE_KEY, this.state); },
    saveSettings() { storage.set(SET_KEY, { muted: V.audio.muted }); },
    newGame() { this.state = freshState(); this.set(new V.screens.Intro(this)); },
    continueGame() { const s = this.loadSave(); if (!s) return this.newGame(); this.state = Object.assign(freshState(), s); this.toNews(); },
    toTitle() { V.audio.stopHall(); this.set(new V.screens.Title(this)); },
    toNews() { this.set(new V.screens.News(this)); },
    toShift() { this.set(new V.Shift(this)); },
    toNight(result) { this.set(new V.screens.Night(this, result)); },
    endNight() {
      if (this.state.day >= V.LAST_DAY) { this.state.day = V.LAST_DAY; this.state.finished = true; this.save(); this.set(new V.screens.Finale(this)); return; }
      this.state.day++;
      this.save();
      this.toNews();
    }
  };
  V.game = game;

  // ---- 画面の大きさ:縦横比を保ったまま、ウィンドウ(全画面)いっぱいに広げる ----
  function fit() {
    const k = Math.min(window.innerWidth / 480, window.innerHeight / 270);
    canvas.style.width = Math.floor(480 * k) + "px";
    canvas.style.height = Math.floor(270 * k) + "px";
  }
  window.addEventListener("resize", fit);
  document.addEventListener("fullscreenchange", fit);
  fit();
  V.toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    } catch (e) {}
  };
  V.setCursor = c => { if (canvas.style.cursor !== c) canvas.style.cursor = c; };

  // ---- 入力 ----
  function toArt(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * 480, y: (e.clientY - r.top) / r.height * 270 };
  }
  canvas.addEventListener("mousedown", e => { V.audio.ensure(); const p = toArt(e); game.scene && game.scene.onDown(p.x, p.y, e.button); e.preventDefault(); });
  window.addEventListener("mousemove", e => { const p = toArt(e); game.scene && game.scene.onMove(p.x, p.y); });
  window.addEventListener("mouseup", e => { const p = toArt(e); game.scene && game.scene.onUp(p.x, p.y, e.button); });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  window.addEventListener("keydown", e => {
    if (e.key === "m" || e.key === "M") { V.audio.setMuted(!V.audio.muted); game.saveSettings(); return; }
    if (e.key === "F11") { e.preventDefault(); V.toggleFullscreen(); return; }
    if (game.scene && game.scene.onKey) { game.scene.onKey(e.key); if (e.key === " ") e.preventDefault(); }
  });

  // ---- ループ ----
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (game.scene) { game.scene.update(dt); game.scene.draw(surface); }
    requestAnimationFrame(frame);
  }

  // ---- 起動:フォントを読み込んでから始める ----
  const settings = storage.get(SET_KEY);
  if (settings && settings.muted) V.audio.setMuted(true);
  const ready = document.fonts ? Promise.race([document.fonts.load('16px "DotGothic16"'), new Promise(r => setTimeout(r, 4000))]) : Promise.resolve();
  ready.then(() => {
    V.gfx.clearCache();
    document.getElementById("boot").remove();
    game.set(new V.screens.Title(game));
    requestAnimationFrame(frame);
  });
})();
