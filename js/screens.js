// VALID — 審査業務以外の画面(タイトル、導入、朝の新聞、夜、終幕)
(function () {
  const S = V.S;
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

  function btn(g, r, label, hover, primary) {
    g.rect(r.x + 1, r.y + 2, r.w, r.h, S[0]);
    g.rect(r.x, r.y + (hover ? 1 : 0), r.w, r.h, primary ? (hover ? S[8] : S[7]) : (hover ? S[5] : S[3]));
    g.text(label, r.x + r.w / 2, r.y + (r.h - 8) / 2 + (hover ? 1 : 0), primary ? S[0] : S[8], { align: "center" });
  }

  // ---------- タイトル ----------
  class Title {
    constructor(game) {
      this.game = game; this.t = 0; this.mouse = { x: 0, y: 0 };
      this.bg = V.art.background(3);
      this.hasSave = !!game.loadSave();
      this.buttons = [{ id: "new", label: "はじめから", x: 190, y: 176, w: 100, h: 16 }];
      if (this.hasSave) this.buttons.push({ id: "cont", label: "つづきから", x: 190, y: 198, w: 100, h: 16 });
      this.buttons.push({ id: "snd", label: "", x: 190, y: this.hasSave ? 220 : 198, w: 100, h: 16 });
    }
    update(dt) { this.t += dt; }
    draw(g) {
      g.rect(0, 0, 480, 270, S[0]);
      g.ctx.save(); g.ctx.globalAlpha = 0.45; g.img(this.bg, 0, -2); g.ctx.restore();
      g.rect(0, 84, 480, 186, S[0]);
      for (let y = 84; y < 100; y++) g.dither(0, y, 480, 1, S[1], 1 - (y - 84) / 16);
      const sweep = (this.t * 40) % 600 - 60;
      for (let k = 0; k < 30; k++) g.rect(Math.round(sweep + k), 13, 1, 71, "rgba(236,239,238,.03)");
      g.text("VALID", 240, 104, S[8], { align: "center", size: 64 });
      g.rect(271, 104, 6, 30, V.GOLD);
      g.text("適格 ― 最後の地上ゲート", 240, 148, S[6], { align: "center" });
      this.buttons.forEach(b => {
        const label = b.id === "snd" ? (V.audio.muted ? "音:オフ" : "音:オン") : b.label;
        btn(g, b, label, inRect(this.mouse.x, this.mouse.y, b), b.id !== "snd");
      });
      g.text("試作版 DAY 0〜3  /  マウスで遊びます", 240, 256, S[4], { align: "center" });
    }
    onMove(x, y) { this.mouse = { x, y }; }
    onDown(x, y) {
      const b = this.buttons.find(b => inRect(x, y, b)); if (!b) return;
      V.audio.ensure(); V.audio.sfx.click();
      if (b.id === "new") this.game.newGame();
      else if (b.id === "cont") this.game.continueGame();
      else { V.audio.setMuted(!V.audio.muted); this.game.saveSettings(); }
    }
    onUp() {}
    onKey(k) { if (k === "Enter") this.onDown(this.buttons[0].x + 1, this.buttons[0].y + 1); }
    enter() { V.audio.music("title"); }
  }

  // ---------- 導入(DAY 0)----------
  const INTRO = [
    "2089年。地表は、人が住める場所ではなくなりつつある。",
    "人類は軌道上の居住環〈エリュシオン〉へ移り住んでいる。\n移住できるのは、遺伝子が「適格」と判定された者だけだ。",
    "赤道の島、ガイア軌道港。\nその第7ゲートは、地上に残された最後の出発ゲート。\n移住がいつまで続くのかは、誰も知らない。",
    "あなたは、このゲートの審査官だ。\n娘のアイリは8歳。心臓の病を抱え、「不適格」と判定されている。",
    "DAY 0 ― 出勤"
  ];
  class Intro {
    constructor(game) { this.game = game; this.i = 0; this.t = 0; this.stage = "text"; this.k = 0; }
    update(dt) { this.t += dt; if (this.stage === "scan") { this.k += dt; if (this.k > 7.5) this.stage = "done"; } }
    draw(g) {
      g.rect(0, 0, 480, 270, S[0]);
      if (this.stage === "text") {
        const a = Math.min(1, this.t * 1.5);
        const txt = INTRO[this.i];
        const size = this.i === INTRO.length - 1 ? 32 : 16;
        const lines = txt.split("\n");
        lines.forEach((ln, j) => g.text(ln, 240, 120 + (j - (lines.length - 1) / 2) * (size === 32 ? 20 : 14), a > 0.5 ? S[8] : S[5], { align: "center", size }));
        g.text("クリックで進む", 240, 246, S[3], { align: "center" });
        return;
      }
      // 自分の採血
      const k = this.k;
      g.text("ゲート職員入口  ―  本人照合", 240, 40, S[6], { align: "center" });
      const seq = "TTAGCCGATCGGATAC";
      g.text("ID署名", 100, 92, S[5]); g.text("採血", 100, 112, S[5]);
      for (let i = 0; i < 16; i++) {
        const x = 150 + i * 12;
        g.rect(x, 90, 10, 12, V.BASE[seq[i]]); g.text(seq[i], x + 3, 92, S[0]);
        if (k > 1 + i * 0.12) { g.rect(x, 110, 10, 12, V.BASE[seq[i]]); g.text(seq[i], x + 3, 112, S[0]); }
        else g.rect(x, 110, 10, 12, S[2]);
      }
      if (k > 3.2) g.text("16 / 16  一致", 240, 138, S[8], { align: "center" });
      if (k > 4.2) g.text("判定:VALID(地上職員)  ― 通ってよし。", 240, 156, S[7], { align: "center" });
      if (k > 5.4) g.text("毎朝、あなたも審査される。", 240, 190, S[5], { align: "center" });
      if (this.stage === "done") g.text("クリックで進む", 240, 246, S[3], { align: "center" });
    }
    onDown() {
      V.audio.ensure();
      if (this.stage === "text") {
        if (this.i < INTRO.length - 1) { this.i++; this.t = 0; V.audio.sfx.click(); }
        else { this.stage = "scan"; this.k = 0; V.audio.sfx.lancet(); setTimeout(() => V.audio.sfx.machine(), 900); setTimeout(() => V.audio.sfx.stamp(false), 4300); }
      } else if (this.stage === "done") this.game.toNews();
      else this.k = Math.max(this.k, 7.5), this.stage = "done";
    }
    onMove() {} onUp() {}
    onKey(k) { if (k === "Enter" || k === " ") this.onDown(); }
    enter() { V.audio.music("title"); }
  }

  // ---------- 朝の新聞 ----------
  class News {
    constructor(game) {
      this.game = game; this.mouse = { x: 0, y: 0 }; this.t = 0;
      this.day = game.state.day; this.n = V.NEWS[this.day];
      this.go = { x: 330, y: 238, w: 120, h: 18 };
    }
    update(dt) { this.t += dt; }
    draw(g) {
      const n = this.n, f = this.game.state.flags;
      g.rect(0, 0, 480, 270, S[1]);
      const x = 24, y = 12, w = 432, h = 248;
      g.rect(x + 3, y + 3, w, h, S[0]); g.rect(x, y, w, h, S[8]);
      g.text("ORBITAL DAILY", x + w / 2, y + 6, S[0], { align: "center", size: 32 });
      g.rect(x + 8, y + 26, w - 16, 1, S[0]); g.rect(x + 8, y + 28, w - 16, 1, S[0]);
      g.text(`${V.DATES[this.day]}  ガイア軌道港 港湾局発行`, x + 10, y + 31, S[3]);
      g.text("第7ゲート版", x + w - 10, y + 31, S[3], { align: "right" });
      g.rect(x + 8, y + 41, w - 16, 1, S[4]);
      const hl = V.Surface.wrap(n.head, 260, 32);
      hl.forEach((ln, i) => g.text(ln, x + 10, y + 48 + i * 18, S[0], { size: 32 }));
      const by = y + 52 + hl.length * 18;
      let body = n.body;
      if (this.day === 2 && f.kai === "detain") body += "\n昨日、第7ゲートでは身長と遺伝子を偽った男が拘束された。";
      g.para(body, x + 10, by, 262, S[1], { lh: 11 });
      // 横の見出し
      const sx = x + 286;
      g.rect(sx - 6, y + 46, 1, 150, S[5]);
      n.side.forEach((s, i) => { g.rect(sx, y + 50 + i * 30, 4, 4, S[2]); g.para(s, sx + 8, y + 48 + i * 30, 130, S[1]); });
      // 論説(人々を煽る記事を書き続ける記者の署名記事)
      if (n.column) {
        const cy = y + 112;
        g.rect(sx, cy, 138, 1, S[0]);
        g.text("論説", sx, cy + 3, S[0]);
        const k = g.para(n.column, sx, cy + 15, 138, S[2], { lh: 11 });
        g.text("― C・ノード", sx + 138, cy + 17 + k * 11, S[4], { align: "right" });
      }
      // 本日の規則
      const ry = y + 150;
      g.rect(x + 8, ry, 270, 1, S[0]);
      g.text("本日から適用される規則", x + 10, ry + 4, S[0]);
      n.rules.forEach((r, i) => g.text("・" + r, x + 14, ry + 16 + i * 10, S[2]));
      g.text("詳しくは机の規則冊子を確認すること。", x + 10, ry + 16 + n.rules.length * 10 + 4, S[4]);
      btn(g, this.go, "業務を始める", inRect(this.mouse.x, this.mouse.y, this.go), true);
    }
    onMove(x, y) { this.mouse = { x, y }; }
    onDown(x, y) { if (inRect(x, y, this.go)) { V.audio.sfx.click(); this.game.toShift(); } }
    onUp() {}
    onKey(k) { if (k === "Enter") this.game.toShift(); }
    enter() { V.audio.stopMusic(); V.audio.sfx.paper(); }
  }

  // ---------- 夜(家計とアイリ)----------
  class Night {
    constructor(game, result) {
      this.game = game; this.result = result; this.mouse = { x: 0, y: 0 }; this.t = 0;
      this.day = game.state.day;
      this.tip = result.flags.tip || 0;
      // 借金はできない。払える分だけ、優先度の高い費用から自動で払う
      this.pay = {}; let left = this.available();
      ["rent", "meds", "food", "power"].forEach(k => { const e = V.EXPENSES.find(e => e.key === k); this.pay[k] = e.cost <= left; if (this.pay[k]) left -= e.cost; });
      this.go = { x: 340, y: 240, w: 110, h: 18 };
    }
    income() { return this.result.stats.earned + this.tip; }
    available() { return Math.max(0, this.game.state.credits + this.income()); }
    total() { return V.EXPENSES.reduce((s, e) => s + (this.pay[e.key] ? e.cost : 0), 0); }
    rows() { return V.EXPENSES.map((e, i) => ({ e, x: 30, y: 128 + i * 14, w: 200, h: 12 })); }
    update(dt) { this.t += dt; }
    draw(g) {
      const st = this.game.state, s = this.result.stats;
      g.rect(0, 0, 480, 270, S[0]);
      g.text(`DAY ${this.day}  夜`, 24, 14, S[6], { size: 32 });
      // 業務の結果
      g.rect(24, 40, 210, 1, S[3]);
      g.text("今日の業務", 26, 46, S[7]);
      const lines = [["処理した人数", s.processed], ["正しい判定", s.correct], ["違反通知", s.citations], ["給与と罰金", (s.earned >= 0 ? "+" : "") + s.earned]];
      if (this.tip) lines.push(["主任から", "+" + this.tip]);
      lines.forEach(([k, v], i) => { g.text(k, 30, 60 + i * 11, S[6]); g.text(String(v), 230, 60 + i * 11, S[8], { align: "right" }); });
      // 家計
      g.text("家計", 26, 114, S[7]);
      g.text(`所持 ₡${st.credits} + 収入 ₡${this.income()}`, 230, 114, S[5], { align: "right" });
      this.rows().forEach(r => {
        const on = this.pay[r.e.key], can = on || this.total() + r.e.cost <= this.available(), hov = inRect(this.mouse.x, this.mouse.y, r) && can;
        g.rect(r.x, r.y + 1, 9, 9, S[0]); g.frame(r.x, r.y + 1, 9, 9, hov ? S[8] : can ? S[5] : S[3]);
        if (on) g.rect(r.x + 2, r.y + 3, 5, 5, S[8]);
        g.text(r.e.label, r.x + 14, r.y + 2, on ? S[7] : can ? S[5] : S[3]);
        g.text(on ? "₡" + r.e.cost : can ? "払わない" : "払えない", 230, r.y + 2, on ? S[7] : can ? S[5] : V.RED, { align: "right" });
      });
      const after = this.available() - this.total();
      g.rect(30, 186, 200, 1, S[3]);
      g.text("残り", 30, 190, S[7]); g.text("₡" + after, 230, 190, S[8], { align: "right" });
      const unpaid = V.EXPENSES.filter(e => !this.pay[e.key]).map(e => e.label);
      if (unpaid.length) g.para("払わない:" + unpaid.join("・") + (this.pay.rent ? "" : `(家賃の滞納 ${(st.rentDue || 0) + 1}日目)`), 30, 202, 200, V.RED);
      // アイリ
      const hx = 262;
      g.rect(hx - 10, 40, 1, 190, S[2]);
      const health = this.previewHealth();
      const word = ["重い", "悪い", "少し悪い", "落ち着いている"][health];
      g.text("アイリ", hx, 46, S[7]);
      g.text("具合:" + word, hx + 40, 46, health <= 1 ? V.RED : S[6]);
      // 手紙
      g.rect(hx, 62, 196, 86, S[7]);
      g.rect(hx, 62, 196, 1, S[8]);
      g.para(V.LETTERS[this.day] || "", hx + 8, 70, 180, S[1], { lh: 12 });
      // ロケットの落書き
      const rx = hx + 160, ry = 112;
      g.rect(rx, ry, 6, 22, S[3]); g.rect(rx + 1, ry - 4, 4, 4, S[3]); g.rect(rx - 3, ry + 16, 3, 6, S[3]); g.rect(rx + 6, ry + 16, 3, 6, S[3]);
      if (this.day >= 2) { g.rect(rx - 20, ry + 18, 5, 9, S[4]); g.rect(rx - 19, ry + 15, 3, 3, S[4]); }
      g.text("— アイリ", hx + 188, 136, S[3], { align: "right" });
      // 知らせ
      V.nightNews(this.day, Object.assign({}, st.flags, this.result.flags)).forEach((t, i) => g.para(t, hx, 160 + i * 22, 196, S[6]));
      btn(g, this.go, this.day >= V.LAST_DAY ? "名簿を見る" : "眠る", inRect(this.mouse.x, this.mouse.y, this.go), true);
    }
    previewHealth() {
      let h = this.game.state.airi;
      if (!this.pay.meds) h -= 1;
      if (!this.pay.food) h -= 1;
      if (this.pay.meds && this.pay.food && this.pay.power) h += 1;
      return V.clamp(h, 0, 3);
    }
    onMove(x, y) { this.mouse = { x, y }; }
    onDown(x, y) {
      const r = this.rows().find(r => inRect(x, y, r));
      if (r) {
        if (this.pay[r.e.key]) this.pay[r.e.key] = false;
        else if (this.total() + r.e.cost <= this.available()) this.pay[r.e.key] = true;
        else { V.audio.sfx.nothing(); return; }
        V.audio.sfx.click(); return;
      }
      if (inRect(x, y, this.go)) {
        V.audio.sfx.click();
        const st = this.game.state;
        st.credits = this.available() - this.total();
        st.rentDue = this.pay.rent ? 0 : (st.rentDue || 0) + 1;
        st.airi = this.previewHealth();
        st.stats.processed += this.result.stats.processed; st.stats.correct += this.result.stats.correct; st.stats.citations += this.result.stats.citations;
        this.game.endNight();
      }
    }
    onUp() {}
    onKey(k) { if (k === "Enter") this.onDown(this.go.x + 1, this.go.y + 1); }
    enter() { V.audio.music("night"); }
  }

  // ---------- 終幕(試作版の終わり)----------
  class Finale {
    constructor(game) { this.game = game; this.t = 0; this.mouse = { x: 0, y: 0 }; this.stage = 0; this.back = { x: 190, y: 240, w: 100, h: 16 }; }
    update(dt) { this.t += dt; }
    draw(g) {
      g.rect(0, 0, 480, 270, S[0]);
      const st = this.game.state;
      if (this.stage === 0) {
        g.text("第12便 乗員名簿", 240, 30, S[8], { align: "center", size: 32 });
        g.text("出発予定 未定", 240, 56, S[5], { align: "center" });
        V.MANIFEST.forEach(([role, name], i) => {
          const y = 80 + i * 18, show = this.t > 0.6 + i * 0.5;
          if (!show) return;
          const hl = name === "ジェイ・ハロウ";
          g.text(role, 170, y, S[5], { align: "right" });
          g.text(name, 186, y, hl ? S[8] : S[6]);
          if (hl && this.t > 4) { g.frame(182, y - 3, 92, 14, S[8]); }
        });
        if (this.t > 4.5) g.text("航法士の欄の名前を、あなたは知っている。", 240, 186, S[6], { align: "center" });
        if (this.t > 5.5) g.text("クリックで進む", 240, 246, S[3], { align: "center" });
      } else {
        g.text("ねえ、わたしも あのロケットに のれる?", 240, 70, S[8], { align: "center" });
        g.text("— アイリ", 330, 90, S[4]);
        g.text("試作版はここまで", 240, 130, S[7], { align: "center", size: 32 });
        g.text(`処理 ${st.stats.processed}人  正しい判定 ${st.stats.correct}  違反 ${st.stats.citations}  所持 ₡${st.credits}`, 240, 166, S[5], { align: "center" });
        g.text("本編では、主任の頼みごとが少しずつ増え、ハロウは毎朝この窓口を通る。", 240, 186, S[4], { align: "center" });
        g.text("そして新聞の記事が、地上と上の溝を深めていく。", 240, 198, S[4], { align: "center" });
        btn(g, this.back, "タイトルへ", inRect(this.mouse.x, this.mouse.y, this.back), true);
      }
    }
    onMove(x, y) { this.mouse = { x, y }; }
    onDown(x, y) {
      if (this.stage === 0) { if (this.t > 5.5) { this.stage = 1; this.t = 0; V.audio.music("night"); } else this.t = 5.5; return; }
      if (inRect(x, y, this.back)) this.game.toTitle();
    }
    onUp() {}
    onKey(k) { if (k === "Enter") this.onDown(this.back.x + 1, this.back.y + 1); }
    enter() { V.audio.stopMusic(); setTimeout(() => V.audio.music("title"), 200); }
  }

  V.screens = { Title, Intro, News, Night, Finale };
})();
