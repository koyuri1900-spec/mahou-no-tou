// VALID — 審査業務(1日分のシフト)
(function () {
  const S = V.S, L = V.L;
  const DAY_MINUTES = 600;          // 08:00〜18:00
  const SEC_PER_MIN = 0.6;          // 実時間 0.6秒 = ゲーム内1分(1日およそ6分)
  const VERB = { approve: "適格", limit: "限定", deny: "不適格", detain: "拘束" };
  const PAPERS = ["id", "ticket", "permit", "med"];
  const FLAW_TEXT = {
    expired: "IDの期限切れ", status: "INVALID の判定", permit: "作業許可証の不備", genome: "検体と署名の不一致",
    height: "予測身長との不一致", ticketName: "搭乗券の名義違い", ticketDate: "搭乗券の日付違い", seal: "旧版の印章",
    heart: "記録のない心拍の乱れ", hair: "毛根のない毛髪", mass: "申告質量との不一致", xray: "衣服の下の不審物"
  };
  const FLAW_RULE = {
    expired: "rule.expiry", status: "rule.status", permit: "rule.staff", genome: "rule.genome", height: "rule.height",
    ticketName: "rule.ticket", ticketDate: "rule.ticket", seal: "rule.seal", heart: "rule.heart", hair: "rule.hair", mass: "rule.mass", xray: "rule.xray"
  };
  const NEW_TOOLS = {
    1: ["規則冊子(机の左下)", "採血キット ― 申請者か受取口へ渡す", "遺伝子解析機 ― 血液の管を入れる", "身長の壁 ― 頭頂の高さで読む", "【照合】― 食い違う2か所を選ぶ"],
    2: ["搭乗券", "心拍モニタ(窓の右上)", "医療記録"],
    3: ["毛髪キットとルーペ", "X線(机のボタン)", "計量台(窓の右下)"]
  };
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  const ruleText = key => (V.RULES.find(r => r.key === key) || {}).text || "";

  // 欠点ごとの具体的な説明(違反切符に書く)
  function detail(A, f) {
    const T = A.ticket, today = V.DATES[A.day];
    switch (f.type) {
      case "expired": return `IDの期限 ${A.expiry} は、本日 ${today} より前だった。`;
      case "status": return A.role === "地上職員" ? "INVALID の地上職員で、作業許可証がなかった。" : `判定 INVALID の${A.role}だった。`;
      case "permit": return A.permit && A.permit.name !== A.latin ? `作業許可証の名義 ${A.permit.name} が ID と違った。` : `作業許可証の期限 ${A.permit.expiry} が切れていた。`;
      case "genome": { let n = 0; for (let i = 0; i < 16; i++) if (A.genome[i] !== A.sample[i]) n++; return `採血検体の塩基が ${n}か所、IDのゲノム署名と違った。`; }
      case "height": return `実測の身長 ${A.actualH}cm が、IDの予測 ${A.predH[0]}-${A.predH[1]}cm の範囲外だった。`;
      case "ticketName": return `搭乗券の名義 ${T.name} が、ID の ${A.latin} と違った。`;
      case "ticketDate": return `搭乗券の日付 ${T.date} が本日 ${today} ではなかった。`;
      case "seal": return `搭乗券の印章が旧版の ${T.seal} だった。`;
      case "heart": return "心拍に乱れがあり、医療記録がなかった。";
      case "hair": return "提出された毛髪に毛根がなかった(切った毛)。";
      case "mass": return `体重 ${A.massActual.toFixed(1)}kg が、申告質量 ${T.mass.toFixed(1)}kg と ${Math.abs(A.massActual - T.mass).toFixed(1)}kg 違った。`;
      case "xray": return "X線で、衣服の下に不審物があった。";
    }
    return FLAW_TEXT[f.type] || "";
  }

  class Shift {
    constructor(game) {
      this.game = game;
      const st = game.state;
      this.day = st.day;
      this.today = V.DATES[this.day];
      this.clock = 0;
      this.started = false;
      this.bg = V.art.background(this.day);
      this.items = [];
      this.cur = null; this.phase = "empty"; this.phaseT = 0;
      this.talk = [];
      this.inspect = false; this.sel = null; this.flashes = [];
      this.drawer = false; this.drawerK = 0;
      this.xray = false;
      this.analyzer = { seq: null, fresh: 0, busy: 0, owner: null };
      this.loupe = { hair: null, owner: null };
      this.timers = [];
      this.drag = null;
      this.flying = [];
      this.mouse = { x: 0, y: 0 };
      this.msg = null;
      this.served = 0;
      this.queueN = 14; this.queueShift = 0;
      this.stats = { processed: 0, correct: 0, citations: 0, earned: 0, detained: 0, mistakes: [] };
      this.flags = {};
      this.ended = false; this.fade = 1;
      this.hintSeen = {};
      this.t = 0;
      const rules = V.docs.make("rules", null);
      rules.loc = "slot"; rules.x = L.bookSlot.x; rules.y = L.bookSlot.y;
      if (this.day >= 2) rules.page = this.day - 1;
      this.rules = rules;
      this.items.push(rules);
      this.startBtn = { x: L.win.x + 40, y: L.win.y + L.win.h - 24, w: 80, h: 16 };
      V.audio.startHall();
    }

    // ---------- 時間 ----------
    update(dt) {
      this.t += dt;
      if (this.fade > 0 && !this.ended) this.fade = Math.max(0, this.fade - dt * 1.5);
      if (this.started && !this.ended) this.clock = Math.min(DAY_MINUTES, this.clock + dt / SEC_PER_MIN);
      this.drawerK += ((this.drawer ? 1 : 0) - this.drawerK) * Math.min(1, dt * 14);
      this.queueShift = Math.max(0, this.queueShift - dt * 12);
      this.timers = this.timers.filter(tm => { tm.t -= dt; if (tm.t <= 0) { tm.fn(); return false; } return true; });
      this.flashes = this.flashes.filter(f => (f.t -= dt) > 0);
      this.flying = this.flying.filter(f => (f.t += dt) < 0.45);
      if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
      this.items.forEach(d => { if (d.slide > 0) d.slide = Math.max(0, d.slide - dt * 3); });
      if (this.analyzer.busy > 0) this.analyzer.busy = Math.max(0, this.analyzer.busy - dt);
      if (this.phase === "entering" && (this.phaseT += dt) > 0.9) { this.phase = "present"; this.phaseT = 0; }
      if (this.phase === "leaving" && (this.phaseT += dt) > 0.9) this.finishApplicant();
      if (this.phase === "detained" && (this.phaseT += dt) > 1.8) this.finishApplicant();
      if (this.started && this.clock >= DAY_MINUTES && !this.cur && !this.ended) this.endShift();
      if (this.ended) { this.fade = Math.min(1, this.fade + dt * 0.8); if (this.fade >= 1 && !this.done) { this.done = true; V.audio.stopHall(); this.game.toNight(this.summary()); } }
      if (V.setCursor) V.setCursor(this.drag ? "grabbing" : this.inspect ? "crosshair" : "default");
    }

    after(t, fn) { this.timers.push({ t, fn }); }
    say(who, text) { this.talk.push({ who, text }); if (this.talk.length > 30) this.talk.shift(); }
    note(text, t = 2.6) { this.msg = { text, t }; }
    clockText() { const m = Math.floor(this.clock); return `${String(8 + Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }

    start() {
      if (this.started) return;
      this.started = true;
      V.audio.sfx.chime();
      this.say("sys", `DAY ${this.day} 業務開始。【呼出】で申請者を呼ぶ。`);
    }

    // ---------- 申請者 ----------
    callNext() {
      if (!this.started) { this.note("先に【業務開始】を押してください。"); return; }
      if (this.cur || this.ended) return;
      if (this.clock >= DAY_MINUTES) { this.note("本日の受付は終了しました。"); return; }
      const scripted = (V.SCRIPTED[this.day] || []).find(s => s.at === this.served && !this.flags["seen_" + s.id]);
      const seed = this.day * 1000 + this.served * 37 + 11;
      let A;
      if (scripted) {
        this.flags["seen_" + scripted.id] = true;
        const spec = Object.assign({}, scripted);
        if (spec.id === "nora") spec.greet = [scripted.greet[0], V.noraLine(this.game.state.flags.kai)];
        A = V.applicant.create(this.day, seed, spec, null);
      } else {
        const r = V.rng(seed * 7 + 3);
        const flaw = r.chance(0.45) ? r.pick(V.applicant.flawPool(this.day)) : null;
        A = V.applicant.create(this.day, seed, null, flaw);
      }
      this.served++;
      this.cur = A; this.phase = "entering"; this.phaseT = 0;
      this.xray = false; this.verdict = null;
      this.analyzer = { seq: null, fresh: 0, busy: 0, owner: null };
      this.loupe = { hair: null, owner: null };
      this.queueN = Math.max(3, this.queueN - 1); this.queueShift = 12;
      V.audio.sfx.click();
      const give = [V.docs.make("id", A)];
      if (A.ticket) give.push(V.docs.make("ticket", A));
      if (A.permit) give.push(V.docs.make("permit", A));
      if (A.med) give.push(V.docs.make("med", A));
      if (A.envelope) give.push(V.docs.make("envelope", A));
      this.after(0.9, () => {
        this.placeInTray(give);
        give.forEach(d => { d.loc = "tray"; this.items.push(d); });
        V.audio.sfx.paper();
        A.greet.forEach(line => this.say("them", line));
      });
    }

    // 申請者から出された物を、受取口の中央に並べる
    placeInTray(list) {
      const M = V.docs.MINI, gap = 4;
      const total = list.reduce((s, d) => s + M[d.kind][0], 0) + gap * (list.length - 1);
      let x = Math.round(L.tray.x + (L.tray.w - total) / 2);
      list.forEach(d => { const [w, h] = M[d.kind]; d.tx = x; d.ty = Math.round(L.tray.y + 3 + (L.tray.h - 3 - h) / 2); d.slide = 1; x += w + gap; });
    }

    requestSample(kind) {
      const A = this.cur;
      if (!A || this.phase !== "present") { this.note("窓口に申請者がいません。"); return; }
      const give = (doc, line) => {
        this.after(1.4, () => {
          if (this.cur !== A) return;
          const others = this.items.filter(d => d.loc === "tray").length;
          const [w, h] = V.docs.MINI[doc.kind];
          doc.tx = Math.round(L.tray.x + L.tray.w / 2 - w / 2 + (others % 2 ? 1 : -1) * (8 + others * 3));
          doc.ty = Math.round(L.tray.y + 3 + (L.tray.h - 3 - h) / 2); doc.slide = 1; doc.loc = "tray";
          this.items.push(doc); this.say("them", line); V.audio.sfx.drop();
        });
      };
      if (kind === "kitBlood") { this.say("you", "採血します。指を。"); V.audio.sfx.lancet(); give(V.docs.make("vial", A), "(指先を差し出した)"); }
      else { this.say("you", "毛髪の検体を。"); give(V.docs.make("hair", A), A.hairSample === "cut" ? "(袋に入った毛髪を出した)" : "(髪を数本抜いて渡した)"); }
    }

    decide(verdict) {
      const A = this.cur;
      if (!A || this.phase !== "present") { this.note("窓口に申請者がいません。"); return; }
      const id = this.items.find(d => d.kind === "id" && d.owner === A);
      if (!id || id.loc !== "desk") { this.note("ID を机の上に置いてから判定してください。"); return; }
      if (id.stamp) { this.note("この ID には、もう印が押されています。"); return; }
      id.stamp = verdict; id.dirty = true; id.front();
      this.verdict = verdict;
      this.drawer = false; this.closeInspect();
      V.audio.sfx.stamp(verdict === "deny");
      this.say("sys", `判定:${VERB[verdict]}。書類を申請者へ手渡して返す。`);
    }

    // 偽装を指摘された申請者が暴れだす → 拘束のボタンが出る
    agitate(A) {
      if (A.agitated) return;
      this.after(1.1, () => {
        if (this.cur !== A || this.phase !== "present" || this.verdict) return;
        A.agitated = true;
        this.say("them", pick(["ふざけるな! 通せ!", "離せ、俺は本物だ!", "(窓口のガラスを叩きはじめた)"]));
        this.say("sys", "申請者が暴れだした。【警備を呼ぶ】で拘束できる。");
        V.audio.sfx.alarm();
      });
    }

    detain() {
      const A = this.cur;
      if (!A || !A.agitated || this.phase !== "present") return;
      this.drawer = false; this.closeInspect();
      this.verdict = "detain";
      this.say("you", "警備、来てくれ。");
      this.say("them", pick(V.LINES.detained));
      V.audio.sfx.alarm();
      this.phase = "detained"; this.phaseT = 0;
    }

    // 書類を申請者へ手渡す
    handBack(d) {
      const A = this.cur;
      if (PAPERS.includes(d.kind) && !this.verdict) {
        this.note("判定の印を押してから返してください。");
        return false;
      }
      d.loc = "given";
      this.flying.push({ d, x: d.x, y: d.y, t: 0 });
      V.audio.sfx.paper();
      if (d.kind === "envelope") this.game.state.flags.envelopeReturned = true;
      this.checkLeave();
      return true;
    }

    checkLeave() {
      const A = this.cur;
      if (!A || this.phase !== "present" || !this.verdict) return;
      const papers = this.items.filter(d => d.owner === A && PAPERS.includes(d.kind));
      if (papers.every(d => d.loc === "given" || d.loc === "tray") && papers.some(d => d.loc === "given")) {
        this.phase = "leaving"; this.phaseT = 0;
        const pool = { approve: V.LINES.approved, limit: V.LINES.limited, deny: V.LINES.denied }[this.verdict];
        this.say("them", pick(pool));
      }
    }

    finishApplicant() {
      const A = this.cur, verdict = this.verdict;
      const env = this.items.find(d => d.kind === "envelope" && d.owner === A);
      if (env && env.loc === "desk") { this.flags.bribe = true; this.game.state.flags.bribe = true; this.say("sys", "封筒を、引き出しにしまった。"); }
      this.items = this.items.filter(d => d.owner !== A);
      if (this.analyzer.owner === A) this.analyzer = { seq: null, fresh: 0, busy: 0, owner: null };
      if (this.loupe.owner === A) this.loupe = { hair: null, owner: null };
      this.evaluate(A, verdict);
      if (A.scripted) this.game.state.flags[A.id] = verdict;
      this.cur = null; this.verdict = null; this.phase = "empty"; this.xray = false;
      this.closeInspect();
      if (this.clock >= DAY_MINUTES) this.say("sys", "18:00。受付終了。");
    }

    evaluate(A, verdict) {
      const t = V.applicant.truth(A);
      this.stats.processed++;
      if (verdict === "detain") this.stats.detained++;
      if (t.ok.includes(verdict)) {
        this.stats.correct++;
        this.stats.earned += V.PAY_CORRECT + (verdict === "detain" ? V.PAY_DETAIN_BONUS : 0);
        return;
      }
      // 何を間違えたかを、具体的に書いた違反切符を受け取る
      const fl = V.applicant.flaws(A);
      let lines = [], rule = "";
      if (verdict === "approve" || verdict === "limit") {
        if (fl.length) { lines = fl.map(f => detail(A, f)); rule = ruleText(FLAW_RULE[fl[0].type]); }
        else if (verdict === "limit") { lines = [`${A.role}は【限定】の対象ではない。正しくは【適格】。`]; rule = ruleText("rule.staff"); }
        else { lines = ["INVALID の地上職員を【適格】で通した。正しくは【限定】。"]; rule = ruleText("rule.staff"); }
      } else {
        if (t.best === "limit") { lines = ["本人の作業許可証を持つ地上職員を止めた。正しくは【限定】。"]; rule = ruleText("rule.staff"); }
        else lines = ["書類・身体・検体に食い違いのない申請者を止めた。"];
      }
      this.stats.citations++;
      const fine = this.stats.citations > V.CITATION_FREE ? V.CITATION_FINE : 0;
      this.stats.earned -= fine;
      this.stats.mistakes.push(lines[0]);
      const c = V.docs.make("citation", null);
      c.cite = { n: this.stats.citations, time: this.clockText(), who: A.latin, verdict: VERB[verdict], lines, rule, fine };
      c.h = Math.max(72, 62 + lines.reduce((s, l) => s + V.Surface.wrap(l, c.w - 8).length * 10, 0) + (rule ? V.Surface.wrap("規則:" + rule, c.w - 8).length * 10 : 0));
      c.loc = "desk"; c.x = 236; c.y = 86; c.slide = 1; c.front();
      this.items.push(c);
      V.audio.sfx.citation();
    }

    endShift() {
      this.ended = true;
      this.drawer = false; this.closeInspect();
      V.audio.sfx.chime();
    }

    summary() { return { stats: this.stats, flags: this.flags }; }

    // ---------- 照合 ----------
    fieldsAt() {
      const out = [], A = this.cur;
      const add = (key, x, y, w, h, label) => out.push({ key, x, y, w, h, label });
      add("today", L.clock.x + 2, L.clock.y + 2, L.clock.w - 4, 10, "本日 " + this.today);
      this.items.filter(d => d.loc === "desk").sort((a, b) => a.z - b.z).forEach(d => {
        d.render(this.day);
        d.fields.forEach(f => { if (!f.key.startsWith("tab.")) out.push({ key: f.key, x: d.x + f.x, y: d.y + f.y, w: f.w, h: f.h, label: f.label, doc: d }); });
      });
      if (A && this.phase === "present") {
        if (this.xray) add("xray", L.win.x + 30, L.win.y + 30, 100, 96, "X線像");
        else { const top = V.cmToY(A.actualH); add("body.height", L.win.x + 44, Math.round(top) - 3, 72, 8, "頭頂の高さ"); }
        if (this.day >= 2) add("heart", L.heart.x, L.heart.y, L.heart.w, L.heart.h, "心拍");
        if (this.day >= 3) add("scale", L.scale.x, L.scale.y, L.scale.w, L.scale.h, "体重 " + A.massActual.toFixed(1) + "kg");
        if (this.analyzer.seq && this.analyzer.owner === A) add("seq", L.analyzer.x + 2, L.analyzer.y + 14, 98, 12, "解析結果 " + this.analyzer.seq);
        if (this.loupe.hair && this.loupe.owner === A) add("hair", L.loupe.x + 2, L.loupe.y + 2, 98, 36, "毛髪の端");
      }
      return out;
    }
    fieldAt(x, y) {
      const fs = this.fieldsAt();
      for (let i = fs.length - 1; i >= 0; i--) if (inRect(x, y, fs[i])) return fs[i];
      return null;
    }
    pickField(f) {
      if (!this.sel) { this.sel = f; V.audio.sfx.click(); return; }
      if (this.sel.key === f.key) { this.sel = null; return; }
      const a = this.sel, b = f; this.sel = null;
      const A = this.cur;
      if (!A || this.phase !== "present") { this.note("照合する相手がいません。"); return; }
      const hit = V.applicant.match(A, a.key, b.key);
      if (hit) {
        this.flashes.push({ r: a, t: 1.6, c: V.RED }, { r: b, t: 1.6, c: V.RED });
        if (A.found.has(hit.type)) { this.note("指摘済みです。"); return; }
        A.found.add(hit.type);
        V.audio.sfx.found();
        this.say("you", `${shortLabel(a)}と${shortLabel(b)}が合わない。`);
        this.say("them", V.applicant.reply(A, hit.type));
        if (hit.act === "detain") this.agitate(A);
      } else {
        this.flashes.push({ r: a, t: 0.7, c: S[6] }, { r: b, t: 0.7, c: S[6] });
        V.audio.sfx.nothing();
        this.note("矛盾は見つからない。", 1.6);
      }
    }
    toggleInspect() { this.inspect = !this.inspect; this.sel = null; V.audio.sfx.click(); this.hintSeen.inspect = true; }
    closeInspect() { this.inspect = false; this.sel = null; }

    // ---------- 入力 ----------
    trayHit(x, y) {
      const M = V.docs.MINI;
      return this.items.filter(d => d.loc === "tray").sort((a, b) => b.z - a.z).find(d => { const [w, h] = M[d.kind]; return inRect(x, y, { x: d.tx - 1, y: d.ty - 1, w: w + 2, h: h + 2 }); });
    }

    onDown(x, y, button) {
      this.mouse = { x, y };
      if (this.ended) return;
      if (inRect(x, y, L.full)) { V.toggleFullscreen && V.toggleFullscreen(); return; }
      if (button === 2) { if (this.started) this.toggleInspect(); return; }
      if (!this.started && inRect(x, y, this.startBtn)) { this.start(); return; }
      // 判定の引き出し
      if (this.started && inRect(x, y, L.drawerTab)) { this.drawer = !this.drawer; V.audio.sfx.drawer(); return; }
      if (this.drawer) {
        const b = this.drawerButtons().find(b => inRect(x, y, b));
        if (b) { this.decide(b.v); return; }
        if (inRect(x, y, this.drawerRect())) return;
      }
      if (this.cur && this.cur.agitated && this.phase === "present" && !this.verdict && inRect(x, y, L.alarm)) { this.detain(); return; }
      if (inRect(x, y, L.inspect)) { if (this.started) this.toggleInspect(); return; }
      if (inRect(x, y, L.call)) { if (!this.cur) this.callNext(); else this.note("まだ申請者が窓口にいます。"); return; }
      if (this.day >= 3 && inRect(x, y, L.xbtn)) { if (this.cur && this.phase === "present") { this.xray = !this.xray; V.audio.sfx.xray(); } return; }
      // 規則冊子のページ
      if (this.rules.loc === "desk" && this.rules.hit(x, y)) {
        const f = this.rules.fields.find(f => f.key.startsWith("tab.") && inRect(x - this.rules.x, y - this.rules.y, f));
        if (f) { this.rules.page = +f.key.slice(4); this.rules.dirty = true; V.audio.sfx.paper(); return; }
      }
      if (this.inspect) {
        const f = this.fieldAt(x, y);
        if (f) this.pickField(f); else this.sel = null;
        return;
      }
      // 道具棚
      if (inRect(x, y, L.kitBlood)) { this.startKit("kitBlood", x, y); return; }
      if (this.day >= 3 && inRect(x, y, L.kitHair)) { this.startKit("kitHair", x, y); return; }
      // 受取口:縮んだ姿の、つかんだ位置がそのまま書類のつかんだ位置になる
      const t = this.trayHit(x, y);
      if (t) {
        const [mw, mh] = V.docs.MINI[t.kind];
        const u = V.clamp((x - t.tx) / mw, 0, 1), v = V.clamp((y - t.ty) / mh, 0, 1);
        t.loc = "hand"; t.front(); t.dirty = true;
        t.x = Math.round(x - u * t.w); t.y = Math.round(y - v * t.h);
        this.drag = { item: t, dx: x - t.x, dy: y - t.y, from: "tray", sx: x, sy: y };
        V.audio.sfx.paper();
        return;
      }
      // 机の上
      const onDesk = this.items.filter(d => (d.loc === "desk" || d.loc === "slot") && d.hit(x, y)).sort((a, b) => b.z - a.z)[0];
      if (onDesk) {
        onDesk.front();
        const from = onDesk.loc, ox = onDesk.x, oy = onDesk.y;
        if (from === "slot") {
          // 閉じた本をつかむと、その場で開いた本が現れる(つかんだ位置は本の上の余白)
          onDesk.loc = "hand"; onDesk.dirty = true;
          onDesk.x = Math.round(x - 24); onDesk.y = Math.round(y - 6);
        } else { onDesk.loc = "hand"; onDesk.dirty = true; }
        this.drag = { item: onDesk, dx: x - onDesk.x, dy: y - onDesk.y, from, ox, oy, sx: x, sy: y };
        V.audio.sfx.paper();
      }
    }
    startKit(kind, x, y) { const it = { kind, w: 22, h: 22, x: L[kind].x, y: L[kind].y, kit: true }; this.drag = { item: it, dx: x - it.x, dy: y - it.y, from: "rack" }; V.audio.sfx.click(); }

    onMove(x, y) {
      this.mouse = { x, y };
      if (this.drag) { this.drag.item.x = Math.round(x - this.drag.dx); this.drag.item.y = Math.round(y - this.drag.dy); }
    }

    onUp(x, y) {
      const dg = this.drag; if (!dg) return;
      this.drag = null;
      const it = dg.item, A = this.cur;
      if (it.kit) {
        if (inRect(x, y, L.tray) || inRect(x, y, L.win)) this.requestSample(it.kind);
        return;
      }
      // 規則冊子をクリックしただけなら、机の空いた場所に開く
      if (it.kind === "rules" && dg.from === "slot" && Math.hypot(x - dg.sx, y - dg.sy) < 3) { it.loc = "desk"; it.x = 268; it.y = 100; it.dirty = true; V.audio.sfx.paper(); return; }
      if (it.kind === "citation" && inRect(x, y, L.citeBox)) { this.items = this.items.filter(d => d !== it); V.audio.sfx.drop(); return; }
      // 申請者へ手渡す
      if (inRect(x, y, L.win) && it.owner && it.owner === A && this.phase === "present") {
        if (this.handBack(it)) return;
        return this.putBack(it, dg);
      }
      // 受取口に置く(離した場所に落ちる)
      if (inRect(x, y, L.tray)) {
        if (it.kind === "rules") { this.toSlot(it); return; }
        if (!it.owner) return this.putBack(it, dg);
        const [w, h] = V.docs.MINI[it.kind];
        it.tx = Math.round(V.clamp(x - w / 2, L.tray.x + 1, L.tray.x + L.tray.w - w - 1));
        it.ty = Math.round(V.clamp(y - h / 2, L.tray.y + 3, L.tray.y + L.tray.h - h - 1));
        it.loc = "tray"; it.dirty = true; V.audio.sfx.drop();
        return;
      }
      if (it.kind === "vial" && inRect(x, y, L.analyzer)) {
        this.items = this.items.filter(d => d !== it);
        this.analyzer = { seq: null, fresh: 0, busy: 1.3, owner: it.owner };
        V.audio.sfx.machine();
        const B = it.owner;
        this.after(1.3, () => { if (this.analyzer.owner === B) { this.analyzer.seq = B.sample; this.analyzer.fresh = B.fresh; } });
        return;
      }
      if (it.kind === "hair" && this.day >= 3 && inRect(x, y, L.loupe)) {
        this.items = this.items.filter(d => d !== it);
        this.loupe = { hair: it.owner.hairSample, owner: it.owner };
        V.audio.sfx.drop();
        return;
      }
      if (it.kind === "rules" && inRect(x, y, L.bookSlot)) { this.toSlot(it); return; }
      // 机の上:離した場所に落とす
      if (x >= L.desk.x && y >= L.desk.y) { this.dropOnDesk(it); V.audio.sfx.drop(); return; }
      this.putBack(it, dg);
    }
    dropOnDesk(it) {
      it.loc = "desk"; it.dirty = true;
      const { w, h } = it.size();
      it.x = V.clamp(it.x, L.desk.x + 1, 480 - w); it.y = V.clamp(it.y, L.desk.y + 1, 270 - h);
    }
    putBack(it, dg) {
      if (dg.from === "tray") { it.loc = "tray"; return; }
      if (it.kind === "rules" && dg.from === "slot") { this.toSlot(it); return; }
      it.x = dg.ox ?? it.x; it.y = dg.oy ?? it.y;
      this.dropOnDesk(it);
    }
    toSlot(it) { it.loc = "slot"; it.x = L.bookSlot.x; it.y = L.bookSlot.y; it.dirty = true; V.audio.sfx.drop(); }

    onKey(k) {
      if (this.ended) return;
      if (!this.started) { if (k === "Enter" || k === " ") this.start(); return; }
      if (k === "f" || k === "F") this.toggleInspect();
      else if (k === " ") { if (!this.cur) this.callNext(); }
      else if (k === "Escape") { this.closeInspect(); this.drawer = false; }
      else if (k === "d" || k === "D") { this.drawer = !this.drawer; V.audio.sfx.drawer(); }
      else if (this.drawer && "123".includes(k)) this.decide(["approve", "deny", "limit"][+k - 1]);
    }

    drawerRect() { const d = L.drawer, off = Math.round((1 - this.drawerK) * (d.h + 2)); return { x: d.x, y: d.y + off, w: d.w, h: d.h }; }
    drawerButtons() {
      const r = this.drawerRect();
      return [
        { v: "approve", x: r.x + 6, y: r.y + 8, w: 58, h: 42 },
        { v: "deny", x: r.x + 70, y: r.y + 8, w: 58, h: 42 },
        { v: "limit", x: r.x + 160, y: r.y + 14, w: 82, h: 36 }
      ];
    }

    // ---------- 手引き ----------
    hint() {
      const A = this.cur, day = this.day;
      if (this.ended) return "";
      if (!this.started) return "新しい規則と道具を確かめたら、窓口の【業務開始】を押してください。";
      if (this.inspect) return this.sel ? "もう一か所を選ぶと照合します。(右クリック/F で照合をやめる)" : "照合モード:食い違っていそうな2か所を順にクリック。(右クリック/F で終わる)";
      if (A && A.agitated && !this.verdict) return "申請者が暴れている。机の【警備を呼ぶ】で拘束できる。";
      if (day === 1 && this.served === 0) return "【呼出】を押して、最初の申請者を呼んでください。(Space キーでも呼べます)";
      if (A && A.tutorial) {
        const id = this.items.find(d => d.kind === "id" && d.owner === A);
        if (this.phase !== "present") return "";
        if (id && id.loc === "tray" && !id.stamp) return "受取口の書類を、机の上へドラッグしてください。";
        if (!this.analyzer.seq && !this.items.some(d => d.kind === "vial") && this.analyzer.busy <= 0) return "道具棚の【採血キット】を、申請者か受取口へドラッグすると採血できます。";
        if (this.items.some(d => d.kind === "vial")) return "血液の管を、右上の解析機へドラッグしてください。";
        if (this.analyzer.seq && !this.hintSeen.inspect) return "【照合】(F キー/右クリック)で、IDのゲノム署名と解析結果を順にクリックして比べます。";
        if (!this.verdict) return "右下の【判定】を開いて判定を選ぶと、IDに印が押されます。";
        return "書類を窓口の申請者へドラッグして、手渡しで返してください。";
      }
      if (day === 1 && this.served === 1 && !A) return "規則冊子は机の左下。つかむと開きます。身長は窓の目盛りで読みます。";
      return "";
    }

    // ---------- 描画 ----------
    draw(g) {
      g.img(this.bg, 0, 0);
      this.drawHall(g);
      this.drawTop(g);
      this.drawWindow(g);
      this.drawTalk(g);
      this.drawTray(g);
      this.drawDeskFixed(g);
      this.items.filter(d => d.loc === "desk" || d.loc === "slot").sort((a, b) => a.z - b.z).forEach(d => this.drawDoc(g, d));
      this.drawFlying(g);
      this.drawAlarm(g);
      this.drawDrawer(g);
      if (this.drag) {
        const it = this.drag.item;
        if (it.kit) this.drawKit(g, it.kind, it.x, it.y, true);
        else this.drawDoc(g, it, true);
        this.drawDropTargets(g, it);
      }
      if (this.inspect) this.drawInspect(g);
      this.flashes.forEach(f => { if (Math.floor(f.t * 8) % 2 === 0) { g.frame(f.r.x - 1, f.r.y - 1, f.r.w + 2, f.r.h + 2, f.c); g.frame(f.r.x - 2, f.r.y - 2, f.r.w + 4, f.r.h + 4, f.c); } });
      const h = this.hint();
      if (h) { g.rect(0, 72, 480, 12, this.inspect ? "rgba(236,239,238,.92)" : "rgba(13,20,23,.86)"); g.text(h, 240, 74, this.inspect ? S[0] : S[8], { align: "center" }); }
      if (this.msg) { const w = V.Surface.measure(this.msg.text) + 16; g.rect(324 - w / 2, 160, w, 14, S[0]); g.frame(324 - w / 2, 160, w, 14, S[5]); g.text(this.msg.text, 324, 163, S[8], { align: "center" }); }
      if (this.fade > 0) g.rect(0, 0, 480, 270, `rgba(13,20,23,${this.fade})`);
      if (this.ended && this.fade > 0.3) g.text("18:00  業務終了", 240, 128, S[8], { align: "center", size: 32 });
    }

    drawTop(g) {
      g.text(`DAY ${this.day}`, 4, 2, S[7]);
      g.text(`ELY-${10 + this.day}`, 52, 2, S[6]);
      g.text(`最終便まで ${30 - this.day}日`, 100, 2, S[6]);
      g.text(`処理 ${this.stats.processed}`, 250, 2, S[6]);
      g.text(`違反 ${this.stats.citations}`, 300, 2, this.stats.citations ? V.RED : S[6]);
      g.text(`₡ ${this.game.state.credits + this.stats.earned}`, 430, 2, S[8], { align: "right" });
      const f = L.full, hov = inRect(this.mouse.x, this.mouse.y, f);
      g.rect(f.x, f.y, f.w, f.h, hov ? S[5] : S[3]); g.text(document.fullscreenElement ? "縮小" : "全画面", f.x + f.w / 2, f.y + 1, S[8], { align: "center" });
    }

    drawHall(g) {
      const n = this.queueN, fr = Math.floor(this.t * 3);
      for (let k = 0; k < n; k++) {
        const x = 176 + k * 20 + Math.round(this.queueShift) + (k % 3) * 2;
        if (x > 470) break;
        V.art.queuePerson(g, x, 58, this.day * 100 + this.served + k, this.queueShift > 0 ? fr + k : 0);
      }
      g.rect(156, 36, 6, 3, this.cur ? S[4] : S[8]);
    }

    drawWindow(g) {
      const A = this.cur, w = L.win;
      const ctx = g.ctx; ctx.save(); ctx.beginPath(); ctx.rect(w.x * 2, w.y * 2, w.w * 2, w.h * 2); ctx.clip();
      if (this.xray && A) g.rect(w.x, w.y, w.w, w.h, S[0]);
      // 目盛りの数字(人物の後ろ)
      for (let cm = 140; cm <= 200; cm += 10) g.text(String(cm), w.x + 10, Math.round(V.cmToY(cm)) - 9, this.xray && A ? S[3] : S[5]);
      if (A) {
        let dx = 0;
        if (this.phase === "entering") dx = Math.round((1 - this.phaseT / 0.9) * 120);
        if (this.phase === "leaving") dx = -Math.round((this.phaseT / 0.9) * 120);
        const top = Math.round(V.cmToY(A.actualH));
        const nervous = this.phase === "present" && A.found.size > 0, angry = !!A.agitated;
        const key = (nervous ? 1 : 0) + (angry ? 2 : 0);
        if (!A._bust || A._bustKey !== key) { A._bust = V.art.bust(A, { sweat: nervous, angry }); A._bustKey = key; }
        const bw = (this.xray ? (A._x || (A._x = V.art.bustX(A, 1.2))) : A._bust).width;
        const shake = angry && this.phase === "present" ? Math.round(Math.sin(this.t * 40) * 1.5) : 0;
        const bx = Math.round(w.x + w.w / 2 - bw / 2) + dx + shake;
        const breath = this.phase === "present" ? Math.round(Math.sin(this.t * (nervous ? 5 : 2.4)) * 0.6 + 0.4) : 0;
        const img = this.xray ? (A._x || (A._x = V.art.bustX(A, 1.2))) : A._bust;
        g.img(img, bx, top - 1 + breath);
        if (this.phase === "detained") {
          const k = Math.min(1, this.phaseT / 0.6);
          [-1, 1].forEach(s => { const gx = w.x + w.w / 2 + s * (110 - k * 62) - 16; g.rect(gx, w.y + 20, 32, 110, S[0]); g.rect(gx + 8, w.y + 8, 16, 16, S[0]); g.rect(gx + 5, w.y + 6, 22, 5, S[1]); });
        }
      } else if (!this.started) {
        this.drawBriefing(g);
      }
      // ガラスの映り込み
      for (let k = 0; k < 34; k++) g.rect(w.x + 124 + k, w.y + 6 + k * 3, 1, 3, "rgba(211,218,220,.08)");
      ctx.restore();
      if (!A && this.started && !this.ended) g.text(this.clock >= DAY_MINUTES ? "受付終了" : "― 窓口 空き ―", w.x + w.w / 2, w.y + 58, S[5], { align: "center" });
      // 心拍と計量台(支給されてから現れる)
      const present = A && this.phase === "present";
      if (this.day >= 2 && this.started) {
        const h = L.heart;
        g.rect(h.x - 1, h.y - 1, h.w + 2, h.h + 2, S[0]); g.rect(h.x, h.y, h.w, h.h, S[0]);
        if (present) {
          const irr = A.heart === "irregular";
          let prev = h.y + 9;
          for (let x = 0; x < h.w - 2; x++) {
            const ph = (x + this.t * 30) % 19, beat = irr ? ((x + Math.floor(this.t * 30)) % 37 < 19 ? 0 : 4) : 0;
            let y = h.y + 9;
            if (Math.abs(ph - (8 + beat)) < 1) y = h.y + 2; else if (Math.abs(ph - (9 + beat)) < 1) y = h.y + 12;
            g.rect(h.x + 1 + x, Math.min(prev, y), 1, Math.abs(prev - y) + 1, S[7]);
            prev = y;
          }
        } else g.text("心拍", h.x + h.w / 2, h.y + 3, S[4], { align: "center" });
      }
      if (this.day >= 3 && this.started) {
        const s = L.scale;
        g.rect(s.x - 1, s.y - 1, s.w + 2, s.h + 2, S[0]); g.rect(s.x, s.y, s.w, s.h, S[0]);
        g.text(present ? A.massActual.toFixed(1) + "kg" : "--.-kg", s.x + s.w - 3, s.y + 3, present ? S[8] : S[4], { align: "right" });
      }
    }

    drawBriefing(g) {
      const w = L.win, d = this.day;
      g.rect(w.x + 6, w.y + 6, w.w - 12, w.h - 12, "rgba(13,20,23,.9)");
      g.text(`DAY ${d} の業務`, w.x + 12, w.y + 10, S[8]);
      let y = w.y + 22;
      const rules = V.RULES.filter(r => r.day === d);
      g.text(`${d === 1 ? "規則" : "新しい規則"}(${rules.length}件・詳しくは規則冊子)`, w.x + 12, y, S[5]); y += 10;
      rules.slice(0, 3).forEach(r => { g.text("・" + shorten(r.text, w.w - 26), w.x + 12, y, S[7]); y += 9; });
      y += 2;
      g.text(d === 1 ? "道具" : "新しい道具", w.x + 12, y, S[5]); y += 10;
      NEW_TOOLS[d].slice(0, 3).forEach(t => { g.text("・" + shorten(t, w.w - 26), w.x + 12, y, S[7]); y += 9; });
      const b = this.startBtn, hov = inRect(this.mouse.x, this.mouse.y, b), blink = Math.floor(this.t * 2) % 2 === 0;
      g.rect(b.x + 1, b.y + 2, b.w, b.h, S[0]);
      g.rect(b.x, b.y + (hov ? 1 : 0), b.w, b.h, hov || blink ? S[8] : S[7]);
      g.text("業務開始", b.x + b.w / 2, b.y + 4 + (hov ? 1 : 0), S[0], { align: "center" });
    }

    drawTalk(g) {
      const b = L.talk, lines = [];
      for (let i = this.talk.length - 1; i >= 0 && lines.length < 3; i--) {
        const m = this.talk[i], col = m.who === "them" ? S[8] : m.who === "you" ? S[6] : S[5];
        const pre = m.who === "you" ? "> " : m.who === "sys" ? "・" : "";
        const ws = V.Surface.wrap(pre + m.text, b.w - 6);
        for (let j = ws.length - 1; j >= 0 && lines.length < 3; j--) lines.unshift({ t: ws[j], c: col });
      }
      lines.forEach((ln, i) => g.text(ln.t, b.x + 3, b.y + 1 + i * 9, ln.c));
    }

    drawTray(g) {
      if (!this.items.some(d => d.loc === "tray")) g.text("受取口", L.tray.x + L.tray.w / 2, L.tray.y + 8, S[3], { align: "center" });
      this.items.filter(d => d.loc === "tray").sort((a, b) => a.z - b.z).forEach(d => V.docs.mini(g, d, d.tx, d.ty - Math.round((d.slide || 0) * 14)));
    }

    // 引きずっている物を落とせる場所を示す
    drawDropTargets(g, it) {
      const A = this.cur, glow = (r, label) => { g.frame(r.x, r.y, r.w, r.h, S[7]); if (label) { const w = V.Surface.measure(label) + 8; g.rect(r.x + r.w / 2 - w / 2, r.y + 2, w, 11, S[7]); g.text(label, r.x + r.w / 2, r.y + 3, S[0], { align: "center" }); } };
      if (it.kit) { if (A && this.phase === "present") { glow(L.win, "申請者に渡す"); glow(L.tray); } return; }
      if (it.owner && it.owner === A && this.phase === "present" && (!PAPERS.includes(it.kind) || this.verdict)) glow(L.win, "手渡して返す");
      if (it.kind === "vial") glow(L.analyzer);
      if (it.kind === "hair" && this.day >= 3) glow(L.loupe);
      if (it.kind === "rules") glow(L.bookSlot);
      if (it.kind === "citation") glow(L.citeBox);
    }

    drawFlying(g) {
      this.flying.forEach(f => {
        const k = f.t / 0.45, tx = L.win.x + L.win.w / 2 - 10, ty = L.win.y + 60;
        const x = f.x + (tx - f.x) * k, y = f.y + (ty - f.y) * k;
        const c = f.d.render(this.day);
        const { w, h } = f.d.size(), s = 1 - k * 0.8;
        g.ctx.save(); g.ctx.globalAlpha = 1 - k * 0.6;
        g.ctx.drawImage(c, Math.round(x * 2), Math.round(y * 2), Math.round(w * 2 * s), Math.round(h * 2 * s));
        g.ctx.restore();
      });
    }

    drawDeskFixed(g) {
      const A = this.cur;
      // 道具棚(支給されている道具だけ)
      this.drawKit(g, "kitBlood", L.kitBlood.x, L.kitBlood.y);
      if (this.day >= 3) this.drawKit(g, "kitHair", L.kitHair.x, L.kitHair.y);
      // デジタル時計
      const c = L.clock;
      g.rect(c.x + 1, c.y + 1, c.w, c.h, S[0]); g.rect(c.x, c.y, c.w, c.h, S[1]); g.frame(c.x, c.y, c.w, c.h, S[3]);
      g.text(this.today, c.x + c.w / 2, c.y + 2, S[6], { align: "center" });
      g.text(this.clockText(), c.x + c.w / 2, c.y + 12, this.clock >= DAY_MINUTES ? V.RED : this.started ? S[8] : S[4], { align: "center", size: 32 });
      // 解析機
      const an = L.analyzer;
      g.rect(an.x + 1, an.y + 1, an.w, an.h, S[0]); g.rect(an.x, an.y, an.w, an.h, S[4]);
      g.text("遺伝子解析機", an.x + 4, an.y + 2, S[1]);
      g.rect(an.x + 2, an.y + 12, an.w - 4, 30, S[0]);
      if (this.analyzer.busy > 0) {
        const k = 1 - this.analyzer.busy / 1.3;
        g.rect(an.x + 6, an.y + 34, Math.round((an.w - 12) * k), 3, S[6]);
        g.text("解析中…", an.x + 6, an.y + 16, S[6]);
      } else if (this.analyzer.seq) {
        for (let i = 0; i < 16; i++) { const b = this.analyzer.seq[i], x = an.x + 3 + i * 6; g.rect(x, an.y + 15, 5, 9, V.BASE[b]); g.text(b, x + 0.5, an.y + 16, S[0]); }
        g.text(`凝固 +${this.analyzer.fresh.toFixed(1)}s`, an.x + 6, an.y + 30, this.analyzer.fresh > 0.3 ? S[8] : S[6]);
      } else g.text("血液の管をここへ", an.x + an.w / 2, an.y + 22, S[5], { align: "center" });
      g.rect(an.x + 8, an.y + 45, 22, 6, S[2]); g.rect(an.x + 10, an.y + 46, 18, 3, S[0]);
      // ルーペ(支給されてから現れる)
      if (this.day >= 3) {
        const l = L.loupe;
        g.rect(l.x + 1, l.y + 1, l.w, l.h, S[0]); g.rect(l.x, l.y, l.w, l.h, S[4]);
        g.rect(l.x + 3, l.y + 3, l.w - 6, l.h - 6, S[0]);
        if (this.loupe.hair) {
          const y = l.y + 20;
          for (let x = l.x + 8; x < l.x + 74; x++) g.rect(x, y + Math.round(Math.sin(x / 7) * 1.5), 1, 2, S[6]);
          if (this.loupe.hair === "root") { g.rect(l.x + 74, y - 3, 8, 8, S[7]); g.rect(l.x + 76, y - 2, 5, 6, S[8]); g.text("毛根", l.x + 86, y - 4, S[6]); }
          else { g.rect(l.x + 74, y - 2, 1, 6, S[6]); g.text("切断面", l.x + 78, y - 4, S[6]); }
        } else g.text("毛髪をここへ(ルーペ)", l.x + l.w / 2, l.y + 15, S[5], { align: "center" });
      }
      // 違反切符入れ(切符が出てから現れる)
      if (this.stats.citations > 0) {
        const cb = L.citeBox;
        g.rect(cb.x, cb.y, cb.w, cb.h, S[1]); g.frame(cb.x, cb.y, cb.w, cb.h, S[3]);
        g.text("切符", cb.x + cb.w / 2, cb.y + 6, S[5], { align: "center" }); g.text("入れ", cb.x + cb.w / 2, cb.y + 16, S[5], { align: "center" });
      }
      // ボタン
      const canCall = this.started && !A && !this.ended && this.clock < DAY_MINUTES;
      button(g, L.call, "呼出", canCall, canCall && Math.floor(this.t * 2) % 2 === 0);
      button(g, L.inspect, "照合 F", this.started, this.inspect);
      if (this.day >= 3) button(g, L.xbtn, "X線", !!(A && this.phase === "present"), this.xray);
      button(g, L.drawerTab, this.drawer ? "判定 ▼" : "判定 ▲", !!A, this.drawer);
    }

    drawAlarm(g) {
      const A = this.cur;
      // 警備を呼ぶ(申請者が暴れたときだけ現れる)
      if (A && A.agitated && this.phase === "present" && !this.verdict) {
        const a = L.alarm, on = Math.floor(this.t * 4) % 2 === 0, hov = inRect(this.mouse.x, this.mouse.y, a);
        g.rect(a.x + 1, a.y + 2, a.w, a.h, S[0]);
        g.rect(a.x, a.y + (hov ? 1 : 0), a.w, a.h, on ? V.RED : V.RED_DARK);
        g.text("警備を呼ぶ", a.x + a.w / 2, a.y + 4 + (hov ? 1 : 0), S[8], { align: "center" });
        g.text("(拘束)", a.x + a.w / 2, a.y + 14 + (hov ? 1 : 0), S[8], { align: "center" });
      }
    }

    drawKit(g, kind, x, y, held) {
      g.rect(x + 1, y + 1, 22, 22, S[0]); g.rect(x, y, 22, 22, held ? S[5] : S[3]);
      if (kind === "kitBlood") { g.rect(x + 9, y + 3, 4, 13, S[7]); g.rect(x + 10, y + 9, 2, 6, V.RED); g.rect(x + 10, y + 16, 2, 4, S[6]); }
      else { g.rect(x + 4, y + 5, 14, 12, S[7]); for (let k = 0; k < 9; k++) g.rect(x + 6 + k, y + 10 + Math.round(Math.sin(k) * 1.5), 1, 1, S[1]); }
    }

    drawDoc(g, d, held) {
      const c = d.render(this.day), { w, h } = d.size();
      const sy = d.slide ? -Math.round(d.slide * 20) : 0;
      if (held) g.rect(d.x + 3, d.y + 3, w, h, "rgba(13,20,23,.45)");
      else g.rect(d.x + 1, d.y + 1 + sy, w, h, "rgba(13,20,23,.6)");
      g.imgSame(c, d.x, d.y + sy);
    }

    drawDrawer(g) {
      if (this.drawerK < 0.02) return;
      const r = this.drawerRect();
      const ctx = g.ctx; ctx.save(); ctx.beginPath(); ctx.rect(r.x * 2, (L.drawer.y - 4) * 2, r.w * 2, (L.drawer.h + 4) * 2); ctx.clip();
      g.rect(r.x, r.y, r.w, r.h, S[1]); g.frame(r.x, r.y, r.w, r.h, S[4]);
      // 適格・不適格と、離れた場所に【限定】
      g.rect(r.x + 142, r.y + 6, 1, r.h - 12, S[3]);
      g.text("地上職員のみ", r.x + 201, r.y + 3, S[5], { align: "center" });
      const style = { approve: ["適格", S[7], S[0]], deny: ["不適格", V.RED, S[8]], limit: ["限定", S[3], S[8]] };
      this.drawerButtons().forEach((b, i) => {
        const [t, c, tc] = style[b.v], hov = inRect(this.mouse.x, this.mouse.y, b), dy = hov ? 1 : 0;
        g.rect(b.x + 1, b.y + 2, b.w, b.h, S[0]);
        g.rect(b.x, b.y + dy, b.w, b.h - 1, c);
        if (b.v === "limit") { for (let k = -b.h; k < b.w; k += 6) for (let j = 0; j < b.h - 1; j++) { const x = k + j; if (x >= 0 && x < b.w && j % 1 === 0 && (x + j) % 6 < 2) g.px(b.x + x, b.y + dy + j, S[4]); } g.frame(b.x, b.y + dy, b.w, b.h - 1, S[6]); }
        g.rect(b.x, b.y + dy, b.w, 3, "rgba(255,255,255,.18)");
        g.text(t, b.x + b.w / 2, b.y + b.h / 2 - 5 + dy, tc, { align: "center" });
        g.text(String(i + 1), b.x + b.w - 4, b.y + b.h - 11 + dy, tc, { align: "right" });
      });
      ctx.restore();
    }

    drawInspect(g) {
      // 照合できる場所だけを残して、ほかを暗くする
      const fs = this.fieldsAt(), ctx = g.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 960, 540);
      fs.forEach(f => ctx.rect((f.x - 1) * 2, (f.y - 1) * 2, (f.w + 2) * 2, (f.h + 2) * 2));
      ctx.fillStyle = "rgba(5,9,11,.62)";
      ctx.fill("evenodd");
      ctx.restore();
      // 照合ボタンは明るいまま
      button(g, L.inspect, "照合 F", true, true);
      const hov = this.fieldAt(this.mouse.x, this.mouse.y);
      fs.forEach(f => corners(g, f, f === hov ? S[8] : S[5]));
      if (this.sel) {
        const r = this.sel;
        g.frame(r.x - 1, r.y - 1, r.w + 2, r.h + 2, S[8]); g.frame(r.x - 2, r.y - 2, r.w + 4, r.h + 4, S[8]);
        // 選んだ欄からカーソルまで線を引く
        const x0 = r.x + r.w / 2, y0 = r.y + r.h / 2, x1 = this.mouse.x, y1 = this.mouse.y, n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
        for (let i = 0; i <= n; i++) if (i % 2 === 0) g.rect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1, S[8]);
      }
      const tip = hov || this.sel;
      if (tip && tip.label) {
        const t = (this.sel && hov && hov.key !== this.sel.key ? shortLabel(this.sel) + " ⇔ " : "") + tip.label;
        const w = Math.min(300, V.Surface.measure(t) + 10), x = V.clamp(this.mouse.x + 8, 2, 478 - w), y = V.clamp(this.mouse.y + 12, 14, 254);
        g.rect(x, y, w, 12, S[8]); g.text(t, x + 5, y + 2, S[0]);
      }
    }
  }

  function corners(g, f, c) {
    const x0 = f.x - 2, y0 = f.y - 2, x1 = f.x + f.w + 1, y1 = f.y + f.h + 1, l = 3;
    g.rect(x0, y0, l, 1, c); g.rect(x0, y0, 1, l, c);
    g.rect(x1 - l + 1, y0, l, 1, c); g.rect(x1, y0, 1, l, c);
    g.rect(x0, y1, l, 1, c); g.rect(x0, y1 - l + 1, 1, l, c);
    g.rect(x1 - l + 1, y1, l, 1, c); g.rect(x1, y1 - l + 1, 1, l, c);
  }
  function button(g, r, label, enabled, lit) {
    g.rect(r.x + 1, r.y + 1, r.w, r.h, S[0]);
    g.rect(r.x, r.y, r.w, r.h, lit ? S[7] : enabled ? S[4] : S[2]);
    g.rect(r.x, r.y, r.w, 1, lit ? S[8] : enabled ? S[5] : S[3]);
    g.text(label, r.x + r.w / 2, r.y + (r.h - 8) / 2, lit ? S[0] : enabled ? S[8] : S[4], { align: "center" });
  }
  function shorten(t, w) { if (V.Surface.measure(t) <= w) return t; let s = t; while (s.length > 1 && V.Surface.measure(s + "…") > w) s = s.slice(0, -1); return s + "…"; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shortLabel(f) { return (f.label || f.key).split(" ")[0]; }

  V.Shift = Shift;
  V.SHIFT_CONST = { DAY_MINUTES, SEC_PER_MIN, VERB, FLAW_TEXT, detail };
})();
