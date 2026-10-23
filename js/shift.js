// VALID — 審査業務(1日分のシフト)
(function () {
  const S = V.S, L = V.L;
  const DAY_MINUTES = 600;          // 08:00〜18:00
  const SEC_PER_MIN = 0.6;          // 実時間 0.6秒 = ゲーム内1分(1日およそ6分)
  const VERB = { approve: "適格", limit: "限定", deny: "不適格", detain: "拘束" };
  const PAPERS = ["id", "ticket", "permit", "med", "hairCard", "xfilm"];
  const MUST_RETURN = ["id", "ticket", "permit", "med"];
  const FLAW_TEXT = {
    expired: "IDの期限切れ", status: "INVALID の判定", permit: "作業許可証の不備", genome: "検体と署名の不一致",
    height: "予測身長との不一致", ticketName: "搭乗券の名義違い", ticketDate: "搭乗券の日付違い", seal: "旧版の印章",
    heart: "記録のない心拍の乱れ", hair: "毛根のない毛髪", hairMissing: "毛髪台紙の未提出", xray: "X線写真の不審物"
  };
  const FLAW_RULE = {
    expired: "rule.expiry", status: "rule.status", permit: "rule.staff", genome: "rule.genome", height: "rule.height",
    ticketName: "rule.ticket", ticketDate: "rule.ticket", seal: "rule.seal", heart: "rule.heart", hair: "rule.hair", hairMissing: "rule.hair", xray: "rule.xray"
  };
  const NEW_TOOLS = {
    1: ["掲示板(上)をクリックして呼び出す", "規則冊子(窓口の下)", "採血キット ― 対象者だけ申請者へ渡す", "遺伝子解析機 ― 血液の管を入れる", "身長の壁・【照合】(右下)"],
    2: ["搭乗券", "心拍モニタ(窓の右下)", "医療記録"],
    3: ["毛髪台紙とルーペ(机の右の収納)", "X線依頼票 ― 写真が書類で届く", "計量台(窓の左下)"]
  };
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  const ruleText = key => (V.RULES.find(r => r.key === key) || {}).text || "";
  const massOff = A => !!(A.ticket && Math.abs(A.massActual - A.ticket.mass) > 0.5);
  const ENTER_T = 1.6, LEAVE_T = 1.4, AWAY_T = 2.6;

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
      case "hair": return "毛髪台紙の毛に毛根がなかった(切った毛)。";
      case "hairMissing": return `採血の対象者(${A.role === "乗員" ? "乗員" : "ID発行 " + A.issued})なのに、毛髪台紙がなかった。`;
      case "xray": return "X線写真に、衣服の下の不審物が写っていた。";
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
      this.talk = []; this.talkT = 0;
      this.inspect = false; this.sel = null; this.flashes = [];
      this.drawer = false; this.drawerK = 0;
      this.analyzer = { seq: null, fresh: 0, busy: 0, owner: null };
      this.timers = [];
      this.drag = null;
      this.flying = [];
      this.walkers = [];
      this.guard = { x: 62, state: "post", t: 0 };
      this.mouse = { x: 0, y: 0 };
      this.msg = null;
      this.served = 0;
      this.queueN = 13; this.queueShift = 0;
      this.stats = { processed: 0, correct: 0, citations: 0, earned: 0, detained: 0, mistakes: [] };
      this.flags = {};
      this.ended = false; this.fade = 1;
      this.hintSeen = {};
      this.t = 0;
      const rules = V.docs.make("rules", null);
      rules.loc = "slot"; rules.x = L.bookSlot.x; rules.y = L.bookSlot.y;
      this.rules = rules;
      this.items.push(rules);
      this.loupe = this.day >= 3 ? { kind: "loupe", w: 30, h: 36, x: L.loupeCase.x + 7, y: L.loupeCase.y - 5, loc: "case" } : null;
      this.startBtn = { x: L.win.x + 40, y: L.win.y + L.win.h - 22, w: 80, h: 16 };
      V.audio.startHall();
    }

    // ---------- 時間 ----------
    update(dt) {
      this.t += dt;
      if (this.fade > 0 && !this.ended) this.fade = Math.max(0, this.fade - dt * 1.5);
      this.walkers.forEach(w => { if (w.delay > 0) { w.delay -= dt; if (w.delay <= 0) w.vx = w.speed; } });
      if (this.started && !this.ended) this.clock = Math.min(DAY_MINUTES, this.clock + dt / SEC_PER_MIN);
      this.drawerK += ((this.drawer ? 1 : 0) - this.drawerK) * Math.min(1, dt * 14);
      this.queueShift = Math.max(0, this.queueShift - dt * 12);
      this.timers = this.timers.filter(tm => { tm.t -= dt; if (tm.t <= 0) { tm.fn(); return false; } return true; });
      this.flashes = this.flashes.filter(f => (f.t -= dt) > 0);
      this.flying = this.flying.filter(f => (f.t += dt) < 0.45);
      this.walkers.forEach(w => { w.x += w.vx * dt; if (w.vx) w.f += dt * 8; });
      this.walkers = this.walkers.filter(w => w.x > -20 && w.x < 500);
      this.updateGuard(dt);
      if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
      if (this.endConfirm > 0) this.endConfirm = Math.max(0, this.endConfirm - dt);
      this.talkT += dt;
      this.items.forEach(d => { if (d.slide > 0) d.slide = Math.max(0, d.slide - dt * 3); });
      if (this.rules.flip && (this.rules.flip.t += dt) > 0.32) this.rules.flip = null;
      if (this.analyzer.busy > 0) this.analyzer.busy = Math.max(0, this.analyzer.busy - dt);
      if (this.phase === "entering" && (this.phaseT += dt) > ENTER_T) { this.phase = "present"; this.phaseT = 0; }
      if (this.phase === "away" && (this.phaseT += dt) > AWAY_T) this.returnFromXray();
      if (this.phase === "leaving" && (this.phaseT += dt) > LEAVE_T) this.finishApplicant();
      if (this.phase === "detained") this.phaseT += dt;
      if (this.started && this.clock >= DAY_MINUTES && !this.cur && !this.ended) this.endShift();
      if (this.started && this.clock >= DAY_MINUTES && !this.closed) this.closeWindow();
      if (this.ended && (this.endT = (this.endT || 0) + dt) > 3.2) { this.fade = Math.min(1, this.fade + dt * 0.8); if (this.fade >= 1 && !this.done) { this.done = true; V.audio.stopHall(); this.game.toNight(this.summary()); } }
      if (V.setCursor) V.setCursor(this.drag ? "grabbing" : this.inspect ? "crosshair" : this.hoverClickable() ? "pointer" : "default");
    }
    hoverClickable() { const m = this.mouse; return (this.canCall() && inRect(m.x, m.y, L.board)) || inRect(m.x, m.y, L.inspect) || inRect(m.x, m.y, L.drawerTab) || inRect(m.x, m.y, L.full); }

    after(t, fn) { this.timers.push({ t, fn }); }
    // 吹き出しに出すのは、あなたの問いかけと申請者の応答だけ(sys は記録のみ)
    say(who, text) { this.talk.push({ who, text }); if (this.talk.length > 30) this.talk.shift(); if (who !== "sys") this.talkT = 0; }
    note(text, t = 2.6) { this.msg = { text, t }; }
    clockText() { const m = Math.floor(this.clock); return `${String(8 + Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
    canCall() { return this.started && !this.cur && !this.ended && !this.closed; }

    start() {
      if (this.started) return;
      this.started = true;
      V.audio.sfx.chime();
      this.say("sys", `DAY ${this.day} 業務開始。上の掲示板をクリックして呼び出す。`);
    }

    // ---------- 申請者 ----------
    callNext() {
      if (!this.started) { this.note("先に【業務開始】を押してください。"); return; }
      if (this.cur || this.ended) return;
      if (this.closed) { this.note("今日の便の搭乗受付は締め切られました。"); return; }
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
      this.cur = A; this.phase = "entering"; this.phaseT = 0; this.verdict = null;
      this.analyzer = { seq: null, fresh: 0, busy: 0, owner: null };
      this.queueN = Math.max(3, this.queueN - 1); this.queueShift = 12;
      V.audio.sfx.click();
      const give = [V.docs.make("id", A)];
      if (A.ticket) give.push(V.docs.make("ticket", A));
      if (A.permit) give.push(V.docs.make("permit", A));
      if (A.med) give.push(V.docs.make("med", A));
      if (A.hairCard) give.push(V.docs.make("hairCard", A));
      if (A.envelope) give.push(V.docs.make("envelope", A));
      this.after(ENTER_T - 0.3, () => {
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
    putOneInTray(doc) {
      const others = this.items.filter(d => d.loc === "tray").length, [w, h] = V.docs.MINI[doc.kind];
      doc.tx = Math.round(V.clamp(L.tray.x + L.tray.w / 2 - w / 2 + (others % 2 ? 1 : -1) * (10 + others * 4), L.tray.x + 2, L.tray.x + L.tray.w - w - 2));
      doc.ty = Math.round(L.tray.y + 3 + (L.tray.h - 3 - h) / 2); doc.slide = 1; doc.loc = "tray";
      this.items.push(doc);
    }

    requestSample(kind) {
      const A = this.cur;
      if (!A || this.phase !== "present") { this.note("窓口に申請者がいません。"); return; }
      if (kind === "kitBlood") {
        if (this.items.some(d => d.kind === "vial" && d.owner === A) || A.sampled) { this.note("この申請者は採血済みです。"); return; }
        this.say("you", "採血します。指を。"); V.audio.sfx.lancet();
        this.after(1.4, () => { if (this.cur !== A) return; this.putOneInTray(V.docs.make("vial", A)); V.audio.sfx.drop(); });
      } else if (kind === "kitXray") {
        if (A.xrayTaken) { this.note("X線写真はもう届いています。"); return; }
        this.say("you", "X線室で撮影を。この票を持って。");
        this.say("them", "わかりました。行ってきます。");
        this.phase = "away"; this.phaseT = 0;
      }
    }
    returnFromXray() {
      const A = this.cur;
      this.phase = "entering"; this.phaseT = 0;
      if (!A) return;
      A.xrayTaken = true;
      this.putOneInTray(V.docs.make("xfilm", A));
      this.say("them", "撮ってきました。");
      V.audio.sfx.paper();
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

    // 遺伝子を聴く:左の耳にIDの署名、右の耳に採血の検体。一致すれば同じ音、食い違えば濁った和音になる
    listen() {
      const an = this.analyzer, A = an.owner;
      if (!an.seq || !A) return;
      an.play = 0;
      V.audio.genome(A.genome, an.seq, i => { if (this.analyzer === an) an.play = i; });
    }

    // 偽装を指摘された申請者が暴れだす → 拘束のボタンが出る
    agitate(A) {
      if (A.agitated || !A.violent) return; // 暴れるのは一部の人だけ。暴れなければ【不適格】で帰す
      this.after(1.1, () => {
        if (this.cur !== A || this.phase !== "present" || this.verdict) return;
        A.agitated = true;
        this.say("them", pick(["ふざけるな! 通せ!", "離せ、本物だと言っているだろう!", "ここを通せ! 今すぐだ!"]));
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
      this.phase = "detained"; this.phaseT = 0; this.grabT = -1;
      // 警備員は持ち場から窓口の前まで駆けつける
      Object.assign(this.guard, { state: "run", t: 0 });
    }

    // 警備員の動き:持ち場 → 駆けつける → 腕を取る → 連れて右へ去る → しばらくして持ち場へ戻る
    updateGuard(dt) {
      const gd = this.guard;
      gd.t += dt;
      if (gd.state === "run") {
        gd.x = Math.min(186, gd.x + 80 * dt);
        if (gd.x >= 186) { gd.state = "grab"; gd.t = 0; V.audio.sfx.drop(); }
      } else if (gd.state === "grab") {
        if (gd.t > 0.7) {
          gd.state = "escort"; gd.t = 0;
          this.grabT = 0;
          this.walkers.push({ x: 172, y: 58, vx: 26, f: 0, seed: this.cur ? this.cur.seed : 1, dir: 1, escorted: true });
        }
      } else if (gd.state === "escort") {
        gd.x += 26 * dt;
        if (this.phase === "detained" && gd.t > 0.9 && this.cur) this.finishApplicant();
        if (gd.x > 500) { gd.state = "away"; gd.t = 0; }
      } else if (gd.state === "away") {
        if (gd.t > 3) { gd.state = "return"; gd.x = 500; }
      } else if (gd.state === "return") {
        gd.x = Math.max(62, gd.x - 42 * dt);
        if (gd.x <= 62) { gd.state = "post"; gd.x = 62; }
      }
    }

    // 書類を申請者へ手渡す
    handBack(d) {
      if (MUST_RETURN.includes(d.kind) && !this.verdict) { this.note("判定の印を押してから返してください。"); return false; }
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
      const papers = this.items.filter(d => d.owner === A && MUST_RETURN.includes(d.kind));
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
      this.evaluate(A, verdict);
      if (A.scripted) this.game.state.flags[A.id] = verdict;
      // 窓口を離れた人は、ホールを通り抜けていく
      const seed = A.seed;
      // 適格・限定は出発口(左)へ、不適格はそのまま右へ帰る。拘束は警備員が連れていく(updateGuard)
      if (verdict === "approve" || verdict === "limit") this.walkers.push({ x: 170, y: 58, vx: -34, f: 0, seed, dir: -1 });
      else if (verdict === "deny") this.walkers.push({ x: 174, y: 60, vx: 30, f: 0, seed, dir: 1 });
      this.cur = null; this.verdict = null; this.phase = "empty";
      this.closeInspect();
      if (this.closed && !this.ended) this.say("sys", "最後の申請者を送り出した。");
    }

    evaluate(A, verdict) {
      const t = V.applicant.truth(A);
      this.stats.processed++;
      if (verdict === "detain") this.stats.detained++;
      let lines = [], rule = "";
      if (!t.ok.includes(verdict)) {
        const fl = V.applicant.flaws(A);
        if (verdict === "approve" || verdict === "limit") {
          if (fl.length) { lines = fl.map(f => detail(A, f)); rule = ruleText(FLAW_RULE[fl[0].type]); }
          else if (verdict === "limit") { lines = [`${A.role}は【限定】の対象ではない。正しくは【適格】。`]; rule = ruleText("rule.staff"); }
          else { lines = ["INVALID の地上職員を【適格】で通した。正しくは【限定】。"]; rule = ruleText("rule.staff"); }
        } else {
          if (t.best === "limit") { lines = ["本人の作業許可証を持つ地上職員を止めた。正しくは【限定】。"]; rule = ruleText("rule.staff"); }
          else lines = ["書類・身体・検体に食い違いのない申請者を止めた。"];
        }
      } else if (verdict === "approve" || verdict === "limit") {
        // 判定は正しくても、手順を飛ばして通したら違反
        if (A.target && !A.sampled) { lines = [`採血の対象者(${A.role === "乗員" ? "乗員" : "ID発行 " + A.issued})を、採血せずに通した。`]; rule = ruleText("rule.sample"); }
        else if (this.day >= 3 && massOff(A) && !A.xrayTaken) { lines = [`体重 ${A.massActual.toFixed(1)}kg が申告 ${A.ticket.mass.toFixed(1)}kg と違うのに、X線を撮らずに通した。`]; rule = ruleText("rule.mass"); }
      }
      if (!lines.length) {
        this.stats.correct++;
        this.stats.earned += V.PAY_CORRECT + (verdict === "detain" ? V.PAY_DETAIN_BONUS : 0);
        return;
      }
      // 何を間違えたかを、具体的に書いた違反切符を受け取る
      this.stats.citations++;
      const fine = this.stats.citations > V.CITATION_FREE ? V.CITATION_FINE : 0;
      this.stats.earned -= fine;
      this.stats.mistakes.push(lines[0]);
      const c = V.docs.make("citation", null);
      c.cite = { n: this.stats.citations, time: this.clockText(), who: A.latin, verdict: VERB[verdict], lines, rule, fine };
      c.h = 46 + lines.reduce((s, l) => s + V.Surface.wrap(l, c.w - 6).length * 9, 0) + (rule ? V.Surface.wrap("規則:" + rule, c.w - 6).length * 9 : 0);
      c.loc = "desk"; c.x = 236; c.y = 92; c.slide = 1; c.front();
      this.items.push(c);
      V.audio.sfx.citation();
    }

    // 業務終了:窓口が空いているときに、確認つきで早めに切り上げる
    pressEnd() {
      if (!this.started || this.ended) return;
      if (this.cur) { this.note("申請者の審査を終えてから、業務を終了してください。"); return; }
      if (this.endConfirm > 0) { this.endConfirm = 0; this.say("sys", `${this.clockText()} 業務を終了した。`); this.endShift(); return; }
      this.endConfirm = 3; V.audio.sfx.click();
      this.note("もう一度押すと、今日の業務を終了します。", 3);
    }

    // 打ち上げウィンドウが閉じる:未審査の人は翌日の便へ振り替えられ、列が解散する
    closeWindow() {
      if (this.closed) return;
      this.closed = true;
      V.audio.sfx.chime();
      this.say("sys", `構内放送:ELY-${10 + this.day} の搭乗受付を締め切りました。未審査の方は明日の ELY-${11 + this.day} に振り替えます。`);
      const n = Math.min(this.queueN, 14);
      for (let k = 0; k < n; k++) {
        const x = 192 + k * 20 + (k % 3) * 2;
        if (x > 470) break;
        // 列の後ろの人から順に、ばらばらに引き返していく
        this.walkers.push({ x, y: 56, vx: 0, f: k, seed: this.day * 100 + this.served + k, dir: 1, delay: 0.3 + (n - k) * 0.12 + Math.random() * 0.4, speed: 26 + Math.random() * 14 });
      }
      this.queueN = 0;
    }

    endShift() {
      this.closeWindow();
      this.ended = true; this.endT = 0;
      this.drawer = false; this.closeInspect();
    }

    summary() { return { stats: this.stats, flags: this.flags }; }

    // ---------- 照合 ----------
    // 書類の欄は、ほかの書類に隠れていない(いちばん上に見えている)ものだけを選べる
    topDocAt(x, y) { return this.items.filter(d => (d.loc === "desk") && d.hit(x, y)).sort((a, b) => b.z - a.z)[0]; }
    fieldsAt() {
      const out = [], A = this.cur;
      const add = (key, x, y, w, h, label, box) => out.push({ key, x, y, w, h, label, box });
      add("today", L.clock.x + 2, L.clock.y + 2, L.clock.w - 4, L.clock.h - 4, "本日 " + this.today, L.clock);
      this.items.filter(d => d.loc === "desk").sort((a, b) => a.z - b.z).forEach(d => {
        d.render(this.day);
        d.fields.forEach(f => {
          if (f.key.startsWith("tab.")) return;
          const sz = d.size(), r = { key: f.key, x: d.x + f.x, y: d.y + f.y, w: f.w, h: f.h, label: f.label, doc: d, box: { x: d.x, y: d.y, w: sz.w, h: sz.h } };
          const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
          if (this.topDocAt(cx, cy) === d && !this.onDevice(cx, cy)) out.push(r);
        });
      });
      if (A && this.phase === "present") {
        const top = V.cmToY(A.actualH);
        add("body.height", L.win.x + 44, Math.round(top) - 3, 72, 8, "頭頂の高さ", L.win);
        if (this.day >= 2) add("heart", L.heart.x, L.heart.y, L.heart.w, L.heart.h, "心拍", L.win);
        if (this.day >= 3) add("scale", L.scale.x, L.scale.y, L.scale.w, L.scale.h, "体重 " + A.massActual.toFixed(1) + "kg", L.win);
        if (this.analyzer.seq && this.analyzer.owner === A) add("seq", L.analyzer.x + 2, L.analyzer.y + 14, 98, 12, "解析結果 " + this.analyzer.seq, L.analyzer);
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
      const keys = [a.key, b.key].sort().join("|");
      if (keys === "scale|ticket.mass" && massOff(A)) {
        this.flashes.push({ r: a, t: 1.2, c: S[8] }, { r: b, t: 1.2, c: S[8] });
        V.audio.sfx.found();
        this.say("you", "体重が申告と合わない。");
        this.say("them", pick(["朝食を食べすぎて。", "量り方がおかしいのでは。"]));
        A.massNoted = true;
        return;
      }
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
      if (inRect(x, y, L.board)) { if (this.cur) this.note("まだ申請者が窓口にいます。"); else this.callNext(); return; }
      // 判定の収納(右側面)
      const tab = this.tabRect();
      if (this.started && inRect(x, y, tab)) { this.drawer = !this.drawer; V.audio.sfx.drawer(); return; }
      if (this.drawer) {
        const b = this.drawerButtons().find(b => inRect(x, y, b));
        if (b) { this.decide(b.v); return; }
        if (inRect(x, y, this.drawerRect())) return;
      }
      if (this.cur && this.cur.agitated && this.phase === "present" && !this.verdict && inRect(x, y, L.alarm)) { this.detain(); return; }
      if (inRect(x, y, L.inspect)) { if (this.started) this.toggleInspect(); return; }
      if (inRect(x, y, L.endBtn)) { this.pressEnd(); return; }
      // 規則冊子のページ送り
      if (this.rules.loc === "desk" && this.topDocAt(x, y) === this.rules) {
        this.rules.render(this.day); // 開いた直後でも、矢印の位置を確かめられるように
        const f = this.rules.fields.find(f => f.key.startsWith("tab.") && inRect(x - this.rules.x, y - this.rules.y, f));
        if (f) { const dir = f.key === "tab.next" ? 1 : -1; this.rules.page += dir; this.rules.dirty = true; this.rules.flip = { dir, t: 0 }; V.audio.sfx.paper(); return; }
      }
      if (this.inspect) {
        const f = this.fieldAt(x, y);
        if (f) this.pickField(f); else this.sel = null;
        return;
      }
      // ルーペ
      if (this.loupe && this.loupe.loc !== "hand" && inRect(x, y, this.loupe)) {
        const lp = this.loupe; lp.from = lp.loc; lp.loc = "hand";
        this.drag = { item: lp, dx: x - lp.x, dy: y - lp.y, from: lp.from, ox: lp.x, oy: lp.y };
        V.audio.sfx.click(); return;
      }
      // 道具棚
      if (inRect(x, y, L.kitBlood)) { this.startKit("kitBlood", x, y); return; }
      if (this.day >= 3 && inRect(x, y, L.kitXray)) { this.startKit("kitXray", x, y); return; }
      if (this.analyzer.seq && inRect(x, y, this.listenBtn())) { this.listen(); return; }
      if (this.onDevice(x, y)) return;
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
      // 机の上と、規則冊子の置き場
      const onDesk = this.items.filter(d => (d.loc === "desk" || d.loc === "slot") && d.hit(x, y)).sort((a, b) => b.z - a.z)[0];
      if (onDesk) {
        onDesk.front();
        const from = onDesk.loc, ox = onDesk.x, oy = onDesk.y;
        onDesk.loc = "hand"; onDesk.dirty = true;
        // 閉じた本をつかむと、その場で開いた本が現れる(つかんだ位置は本の上の余白)
        if (from === "slot") { onDesk.x = Math.round(x - 20); onDesk.y = Math.round(y - 4); }
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
      if (it.kind === "loupe") {
        if (inRect(x, y, L.loupeCase)) { it.loc = "case"; it.x = L.loupeCase.x + 7; it.y = L.loupeCase.y - 5; V.audio.sfx.drop(); return; }
        it.loc = "desk"; it.x = V.clamp(it.x, L.desk.x, 480 - it.w); it.y = V.clamp(it.y, L.desk.y - 10, 270 - it.h); return;
      }
      // 規則冊子をクリックしただけなら、机の空いた場所に開く
      if (it.kind === "rules" && dg.from === "slot" && Math.hypot(x - dg.sx, y - dg.sy) < 3) { it.loc = "desk"; it.x = 196; it.y = 150; it.dirty = true; V.audio.sfx.paper(); return; }
      if (it.kind === "citation" && inRect(x, y, L.citeBox)) { this.items = this.items.filter(d => d !== it); V.audio.sfx.drop(); return; }
      if (it.kind === "rules" && inRect(x, y, L.bookSlot)) { this.toSlot(it); return; }
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
        this.after(1.3, () => { if (this.analyzer.owner === B) { this.analyzer.seq = B.sample; this.analyzer.fresh = B.fresh; B.sampled = true; this.listen(); } });
        return;
      }
      // 机の上:離した場所に落とす
      if (x >= L.desk.x && y >= L.desk.y) { this.dropOnDesk(it); V.audio.sfx.drop(); return; }
      this.putBack(it, dg);
    }
    // 机の右端・下端からはみ出してもよいが、つかめるように 35% は机の上に残す
    dropOnDesk(it) {
      it.loc = "desk"; it.dirty = true;
      const { w, h } = it.size();
      it.x = V.clamp(it.x, L.desk.x + 1, 480 - Math.round(w * 0.35)); it.y = V.clamp(it.y, L.desk.y + 1, 270 - Math.round(h * 0.35));
    }
    // 机に据え付けた装置。常に書類より上に描き、その上のクリックは装置のものとして扱う
    deviceRects() {
      const list = [L.analyzer, L.kitBlood];
      if (this.day >= 3) list.push(L.kitXray);
      if (this.loupe) list.push(L.loupeCase);
      return list;
    }
    listenBtn() { return { x: L.analyzer.x + 58, y: L.analyzer.y + 43, w: 40, h: 11 }; }
    onDevice(x, y) { return this.deviceRects().some(r => inRect(x, y, r)) || inRect(x, y, L.endBtn) || inRect(x, y, L.inspect); }
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

    // 判定の収納:右側面から横に引き出す
    drawerRect() { const d = L.drawer, off = Math.round((1 - this.drawerK) * d.w); return { x: d.x + off, y: d.y, w: d.w, h: d.h }; }
    tabRect() { const r = this.drawerRect(), t = L.drawerTab; return { x: r.x - t.w, y: t.y, w: t.w, h: t.h }; }
    drawerButtons() {
      const r = this.drawerRect();
      return [
        { v: "approve", x: r.x + 6, y: r.y + 6, w: r.w - 12, h: 34 },
        { v: "deny", x: r.x + 6, y: r.y + 44, w: r.w - 12, h: 34 },
        { v: "limit", x: r.x + 10, y: r.y + 102, w: r.w - 20, h: 34 }
      ];
    }

    // ---------- 手引き ----------
    hint() {
      const A = this.cur, day = this.day;
      if (this.ended) return "";
      if (!this.started) return "今日の規則と道具を確かめたら、窓口の【業務開始】を押してください。";
      if (this.inspect) return this.sel ? "もう一か所を選ぶと照合します。(右クリック/F で照合をやめる)" : "照合モード:食い違っていそうな2か所を順にクリック。(右クリック/F で終わる)";
      if (A && A.agitated && !this.verdict) return "申請者が暴れている。机の【警備を呼ぶ】で拘束できる。";
      if (A && A.massNoted && !A.xrayTaken && this.phase === "present") return "体重が申告と違う。道具棚の【X線依頼票】を申請者へ渡して撮らせる。";
      if (day === 1 && this.served === 0) return "上の掲示板をクリックして、最初の申請者を呼んでください。(Space キーでも呼べます)";
      if (A && A.tutorial) {
        const id = this.items.find(d => d.kind === "id" && d.owner === A);
        if (this.phase !== "present") return "";
        if (id && id.loc === "tray" && !id.stamp) return "受取口の書類を、机の上へドラッグしてください。";
        if (!this.analyzer.seq && !this.items.some(d => d.kind === "vial") && this.analyzer.busy <= 0) return "IDの発行が30日以内なので採血の対象。【採血キット】を申請者へドラッグ。";
        if (this.items.some(d => d.kind === "vial")) return "血液の管を、右上の解析機へドラッグしてください。";
        if (this.analyzer.seq && !this.hintSeen.inspect) return "右下の【照合】(F/右クリック)で、IDのゲノム署名と解析結果を順にクリック。";
        if (!this.verdict) return "右端の【判定】を引き出して判定を選ぶと、IDに印が押されます。";
        return "書類を窓の申請者へドラッグして、手渡しで返してください。";
      }
      if (this.canCall() && this.served <= 1 && day === 1) return "規則冊子は窓口の下。つかむとその場で開きます。掲示板で次の人を呼ぶ。";
      return "";
    }

    // ---------- 描画 ----------
    draw(g) {
      g.img(this.bg, 0, 0);
      this.drawHall(g);
      this.drawWindow(g);
      this.drawTray(g);
      this.drawBoothBottom(g);
      this.drawDeskFixed(g);
      this.items.filter(d => d.loc === "desk" || d.loc === "slot").sort((a, b) => a.z - b.z).forEach(d => this.drawDoc(g, d));
      this.drawDevices(g);
      this.drawFlying(g);
      this.drawAlarm(g);
      if (this.loupe && this.loupe.loc !== "hand") this.drawLoupe(g, this.loupe);
      this.drawDrawer(g);
      button(g, L.inspect, "照合  F", this.started, this.inspect);
      button(g, L.endBtn, this.endConfirm > 0 ? "本当に終了?" : "業務終了", this.started && !this.cur && !this.ended, this.endConfirm > 0);
      if (this.drag) {
        const it = this.drag.item;
        if (it.kit) this.drawKit(g, it.kind, it.x, it.y, true);
        else if (it.kind === "loupe") this.drawLoupe(g, it);
        else this.drawDoc(g, it, true);
        this.drawDropTargets(g, it);
      }
      if (this.inspect) this.drawInspect(g);
      this.flashes.forEach(f => { if (Math.floor(f.t * 8) % 2 === 0) { g.frame(f.r.x - 1, f.r.y - 1, f.r.w + 2, f.r.h + 2, f.c); g.frame(f.r.x - 2, f.r.y - 2, f.r.w + 4, f.r.h + 4, f.c); } });
      const h = this.hint();
      if (h) { g.rect(0, 0, 480, 11, this.inspect ? "rgba(236,239,238,.94)" : "rgba(13,20,23,.86)"); g.text(h, 240, 1, this.inspect ? S[0] : S[8], { align: "center" }); }
      const f = L.full, hov = inRect(this.mouse.x, this.mouse.y, f);
      g.rect(f.x, f.y, f.w, f.h, hov ? S[5] : "rgba(42,54,59,.8)");
      [[2, 2, 1], [f.w - 5, 2, 1], [2, f.h - 3, 1], [f.w - 5, f.h - 3, 1]].forEach(([dx, dy]) => { g.rect(f.x + dx, f.y + dy, 3, 1, S[8]); g.rect(f.x + dx + (dx > 4 ? 2 : 0), f.y + dy - (dy > 4 ? 1 : 0), 1, 2, S[8]); });
      if (this.msg) { const w = V.Surface.measure(this.msg.text) + 16; g.rect(324 - w / 2, 160, w, 14, S[0]); g.frame(324 - w / 2, 160, w, 14, S[5]); g.text(this.msg.text, 324, 163, S[8], { align: "center" }); }
      if (this.fade > 0) g.rect(0, 0, 480, 270, `rgba(13,20,23,${this.fade})`);
      if (this.ended && this.fade > 0.3) g.text(`${this.clockText()}  業務終了`, 240, 128, S[8], { align: "center", size: 32 });
    }

    drawHall(g) {
      const A = this.cur, fr = Math.floor(this.t * 3);
      // 行列
      for (let k = 0; k < this.queueN; k++) {
        const x = 192 + k * 20 + Math.round(this.queueShift) + (k % 3) * 2;
        if (x > 470) break;
        V.art.queuePerson(g, x, 56, this.day * 100 + this.served + k, this.queueShift > 0 ? fr + k : 0);
      }
      // 掲示板(クリックで呼び出す)
      const bd = L.board, can = this.canCall(), hov = can && inRect(this.mouse.x, this.mouse.y, bd);
      g.rect(bd.x + 2, bd.y + 2, bd.w - 4, bd.h - 4, hov ? S[2] : S[0]);
      g.text(this.closed ? `ELY-${10 + this.day} 締切` : `第7ゲート  DAY${this.day}`, bd.x + bd.w / 2, bd.y + 1, this.closed ? S[7] : S[5], { align: "center" });
      let msg, col = S[6];
      if (!this.started) msg = "準備中";
      else if (this.closed) { msg = `→ ELY-${11 + this.day}へ振替`; col = Math.floor(this.t * 2) % 2 ? S[8] : S[6]; }
      else if (A) msg = "審査中";
      else { msg = "次の方 ▶"; col = Math.floor(this.t * 2) % 2 ? S[8] : S[6]; }
      g.text(msg, bd.x + bd.w / 2, bd.y + 10, col, { align: "center" });
      if (can) { g.frame(bd.x - 1, bd.y - 1, bd.w + 2, bd.h + 2, Math.floor(this.t * 2) % 2 ? S[8] : S[5]); }
      // 詰所の中のあなた
      const k = L.kiosk;
      V.art.inspector(g, k.x + 34, k.y + 9, this.t, !!A);
      // 窓口の前の計量台(一段高い)
      g.rect(166, 73, 20, 3, S[4]); g.rect(166, 76, 20, 1, S[0]); g.rect(166, 73, 20, 1, S[5]);
      // 窓口に立つ申請者(ホール側):詰所の中のあなたと向き合う
      const escorting = this.guard.state === "grab" || this.guard.state === "escort";
      if (A && !escorting && (this.phase === "present" || this.phase === "entering" || this.phase === "detained" || this.phase === "leaving")) {
        // (ホールの人々は影で描くが、窓口で向き合っている人だけは色で描く)
        let ax = 170, ay = 55, fr = 0, dir = -1;
        if (this.phase === "entering") { const k2 = this.phaseT / ENTER_T; ax = Math.round(190 - Math.min(1, k2 * 1.8) * 20); ay = k2 > 0.65 ? 55 : 58; fr = k2 < 0.56 ? Math.floor(this.t * 8) : 0; }
        if (this.phase === "leaving") { const k2 = this.phaseT / LEAVE_T; dir = this.verdict === "deny" ? 1 : -1; ax = Math.round(170 + dir * Math.max(0, k2 - 0.4) * 16); ay = k2 > 0.4 ? 58 : 55; fr = k2 > 0.4 ? Math.floor(this.t * 8) : 0; }
        V.art.walker(g, ax, ay, A.seed, fr, dir);
        if (A.agitated && this.phase !== "leaving") { g.rect(ax + (Math.sin(this.t * 30) > 0 ? -2 : 8), ay + 6, 2, 3, S[6]); }
      }
      // 警備員
      const gd = this.guard;
      // 持ち場では立ち位置(奥)、動くときは詰所の手前の通路を通る
      if (gd.state !== "away") V.art.guard(g, Math.round(gd.x), gd.state === "post" ? 54 : 60, this.t, gd.state !== "post" || !!(A && A.agitated));
      // 通り抜けていく人々
      this.walkers.forEach(w => V.art.walker(g, Math.round(w.x), w.y, w.seed, Math.floor(w.f), w.dir, true));
      g.text("出発口", 26, 26, S[5], { align: "center" });
    }

    drawWindow(g) {
      const A = this.cur, w = L.win;
      const ctx = g.ctx; ctx.save(); ctx.beginPath(); ctx.rect(w.x * 2, w.y * 2, w.w * 2, w.h * 2); ctx.clip();
      for (let cm = 140; cm <= 200; cm += 10) g.text(String(cm), w.x + 10, Math.round(V.cmToY(cm)) - 9, S[5]);
      if (A && this.phase !== "away") {
        // 正面を向いていないあいだは黒い影。入ってくる → 台に上がる → こちらを向く/背を向ける → 台を降りる → 去る
        let dx = 0, dy = 0, sil = 0, bob = 0;
        const walkBob = () => Math.round(Math.abs(Math.sin(this.t * 9)) * 3);
        if (this.phase === "entering") {
          const t = this.phaseT;
          if (t < 0.9) { dx = Math.round((1 - t / 0.9) * 150); dy = 8; sil = 1; bob = walkBob(); }
          else if (t < 1.1) { dy = Math.round(8 * (1 - (t - 0.9) / 0.2)); sil = 1; }
          else sil = 1 - Math.min(1, (t - 1.1) / 0.5);
        }
        if (this.phase === "leaving") {
          const t = this.phaseT, dir = this.verdict === "deny" ? 1 : -1;
          if (t < 0.4) sil = t / 0.4;
          else if (t < 0.55) { sil = 1; dy = Math.round(8 * (t - 0.4) / 0.15); }
          else { sil = 1; dy = 8; dx = dir * Math.round(((t - 0.55) / 0.85) * 160); bob = walkBob(); }
        }
        if (this.phase === "detained" && this.grabT >= 0) { dx = Math.round(this.guard.t * 130); dy = 8; sil = Math.min(1, this.guard.t * 3); bob = walkBob(); }
        const top = Math.round(V.cmToY(A.actualH));
        const nervous = this.phase === "present" && A.found.size > 0, angry = !!A.agitated;
        const key = (nervous ? 1 : 0) + (angry ? 2 : 0);
        if (!A._bust || A._bustKey !== key) { A._bust = V.art.bust(A, { sweat: nervous, angry }); A._bustKey = key; A._sil = null; }
        if (!A._sil) A._sil = V.art.silhouette(A._bust);
        const shake = angry && this.phase === "present" ? Math.round(Math.sin(this.t * 40) * 1.5) : 0;
        const bx = Math.round(w.x + w.w / 2 - A._bust.width / 2) + dx + shake;
        const breath = this.phase === "present" ? Math.round(Math.sin(this.t * (nervous ? 5 : 2.4)) * 0.6 + 0.4) : 0;
        const by = top - 1 + breath + dy - bob;
        if (sil < 1) g.img(A._bust, bx, by);
        if (sil > 0) { ctx.save(); ctx.globalAlpha = sil; g.img(A._sil, bx, by); ctx.restore(); }
        if (this.phase === "detained" && (this.guard.state === "grab" || this.guard.state === "escort")) {
          // 警備員が右から入り、腕を取る
          const k3 = this.guard.state === "grab" ? Math.min(1, this.guard.t / 0.4) : 1;
          const gx = Math.round(w.x + w.w + 6 - k3 * 64) + (this.guard.state === "escort" ? Math.round(this.guard.t * 130) : 0);
          g.rect(gx, w.y + 34, 40, 100, S[0]); g.rect(gx + 10, w.y + 12, 22, 24, S[0]); g.rect(gx + 6, w.y + 8, 30, 7, S[1]); g.rect(gx + 6, w.y + 14, 30, 2, S[1]);
          g.rect(gx - 18, w.y + 70, 22, 7, S[0]);
        }
      } else if (A && this.phase === "away") {
        // 背を向けて X線室へ向かい、しばらくして戻ってくる
        const t = this.phaseT;
        if (t < 0.9) {
          if (!A._sil) A._sil = V.art.silhouette(A._bust);
          const bx = Math.round(w.x + w.w / 2 - A._sil.width / 2) - Math.round((t / 0.9) * 160), by = Math.round(V.cmToY(A.actualH)) + 7 - Math.round(Math.abs(Math.sin(this.t * 9)) * 3);
          g.img(A._sil, bx, by);
        }
      } else if (!this.started) {
        this.drawBriefing(g);
      }
      for (let k = 0; k < 34; k++) g.rect(w.x + 124 + k, w.y + 6 + k * 3, 1, 3, "rgba(211,218,220,.08)");
      // 吹き出し(最新の発言)
      const spoken = this.talk.filter(m => m.who !== "sys");
      if (this.started && spoken.length && this.talkT < 9) {
        const m = spoken[spoken.length - 1];
        const lines = V.Surface.wrap((m.who === "you" ? "> " : "") + m.text, w.w - 16).slice(0, 3);
        const bh = lines.length * 9 + 4, by = w.y + 3;
        const bg = m.who === "them" ? S[8] : m.who === "you" ? S[1] : "rgba(13,20,23,.85)", fg = m.who === "them" ? S[0] : S[7];
        g.rect(w.x + 4, by, w.w - 8, bh, bg);
        if (m.who === "them") { g.rect(w.x + w.w / 2 - 3, by + bh, 6, 2, bg); g.rect(w.x + w.w / 2 - 1, by + bh + 2, 2, 2, bg); }
        lines.forEach((ln, i) => g.text(ln, w.x + 8, by + 2 + i * 9, fg));
      }
      ctx.restore();
      if (!A && this.started) g.text(this.closed ? "搭乗受付 締切" : "― 窓口 空き ―", w.x + w.w / 2, w.y + 60, S[5], { align: "center" });
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
      if (this.started) {
        const s = L.scale;
        g.rect(s.x - 1, s.y - 1, s.w + 2, s.h + 2, S[0]); g.rect(s.x, s.y, s.w, s.h, S[0]);
        g.text(present ? A.massActual.toFixed(1) + "kg" : "--.-kg", s.x + s.w - 3, s.y + 3, present ? S[8] : S[4], { align: "right" });
      }
    }

    drawBriefing(g) {
      const w = L.win, d = this.day;
      g.rect(w.x + 6, w.y + 6, w.w - 12, w.h - 12, "rgba(13,20,23,.92)");
      g.text(`DAY ${d} の業務`, w.x + 12, w.y + 10, S[8]);
      let y = w.y + 22;
      const rules = V.RULES.filter(r => r.day === d);
      g.text(`${d === 1 ? "規則" : "新しい規則"}(${rules.length}件・規則冊子)`, w.x + 12, y, S[5]); y += 10;
      rules.slice(0, 3).forEach(r => { g.text("・" + shorten(r.text, w.w - 26), w.x + 12, y, S[7]); y += 9; });
      y += 2;
      g.text(d === 1 ? "道具" : "新しい道具", w.x + 12, y, S[5]); y += 10;
      NEW_TOOLS[d].slice(0, 3).forEach(t => { g.text("・" + shorten(t, w.w - 26), w.x + 12, y, S[7]); y += 9; });
      const b = this.startBtn, hov = inRect(this.mouse.x, this.mouse.y, b), blink = Math.floor(this.t * 2) % 2 === 0;
      g.rect(b.x + 1, b.y + 2, b.w, b.h, S[0]);
      g.rect(b.x, b.y + (hov ? 1 : 0), b.w, b.h, hov || blink ? S[8] : S[7]);
      g.text("業務開始", b.x + b.w / 2, b.y + 4 + (hov ? 1 : 0), S[0], { align: "center" });
    }

    drawTray(g) {
      if (!this.items.some(d => d.loc === "tray")) g.text("受取口", L.tray.x + L.tray.w / 2, L.tray.y + 10, S[3], { align: "center" });
      this.items.filter(d => d.loc === "tray").sort((a, b) => a.z - b.z).forEach(d => V.docs.mini(g, d, d.tx, d.ty - Math.round((d.slide || 0) * 14)));
    }

    // 窓口の下:時計・規則冊子の置き場・切符入れ
    drawBoothBottom(g) {
      const c = L.clock;
      g.text(this.clockText(), c.x + 3, c.y + 3, this.clock >= DAY_MINUTES ? V.RED : this.started ? S[8] : S[4], { size: 32 });
      g.text(this.today.slice(0, 4), c.x + c.w - 3, c.y + 2, S[5], { align: "right" });
      g.text(this.today.slice(5), c.x + c.w - 3, c.y + 11, S[7], { align: "right" });
      if (this.rules.loc !== "slot") g.text("規則", L.bookSlot.x + L.bookSlot.w / 2, L.bookSlot.y + 6, S[3], { align: "center" });
      const cb = L.citeBox;
      g.text("切符入れ", cb.x + cb.w / 2, cb.y + 6, this.items.some(d => d.kind === "citation") ? S[6] : S[3], { align: "center" });
    }

    // 引きずっている物を落とせる場所を示す
    drawDropTargets(g, it) {
      const A = this.cur, glow = (r, label) => { g.frame(r.x, r.y, r.w, r.h, S[7]); if (label) { const w = V.Surface.measure(label) + 8; g.rect(r.x + r.w / 2 - w / 2, r.y + r.h - 13, w, 11, S[7]); g.text(label, r.x + r.w / 2, r.y + r.h - 12, S[0], { align: "center" }); } };
      if (it.kit) { if (A && this.phase === "present") glow(L.win, it.kind === "kitXray" ? "X線を撮らせる" : "申請者に渡す"); return; }
      if (it.kind === "loupe") { glow(L.loupeCase); return; }
      if (it.owner && it.owner === A && this.phase === "present" && (!MUST_RETURN.includes(it.kind) || this.verdict)) glow(L.win, "手渡して返す");
      if (it.kind === "vial") glow(L.analyzer);
      if (it.kind === "rules") glow(L.bookSlot);
      if (it.kind === "citation") glow(L.citeBox);
    }

    drawFlying(g) {
      this.flying.forEach(f => {
        const k = f.t / 0.45, tx = L.win.x + L.win.w / 2 - 10, ty = L.win.y + 60;
        const x = f.x + (tx - f.x) * k, y = f.y + (ty - f.y) * k;
        const c = f.d.render(this.day), { w, h } = f.d.size(), s = 1 - k * 0.8;
        g.ctx.save(); g.ctx.globalAlpha = 1 - k * 0.6;
        g.ctx.drawImage(c, Math.round(x * 2), Math.round(y * 2), Math.round(w * 2 * s), Math.round(h * 2 * s));
        g.ctx.restore();
      });
    }

    drawDeskFixed(g) {}

    // 据え付けの装置は、書類より上に描く
    drawDevices(g) {
      const A = this.cur;
      this.drawKit(g, "kitBlood", L.kitBlood.x, L.kitBlood.y);
      if (this.day >= 3) this.drawKit(g, "kitXray", L.kitXray.x, L.kitXray.y);
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
        const pi = this.analyzer.play;
        if (pi >= 0 && pi < 16) g.rect(an.x + 3 + pi * 6, an.y + 25, 5, 2, S[8]);
        const lb = this.listenBtn(), lh = inRect(this.mouse.x, this.mouse.y, lb);
        g.rect(lb.x, lb.y, lb.w, lb.h, lh ? S[6] : S[3]); g.text("♪ 聴く", lb.x + lb.w / 2, lb.y + 1, lh ? S[0] : S[8], { align: "center" });
        g.text(`凝固 +${this.analyzer.fresh.toFixed(1)}s`, an.x + 6, an.y + 30, this.analyzer.fresh > 0.3 ? S[8] : S[6]);
      } else g.text("血液の管をここへ", an.x + an.w / 2, an.y + 22, S[5], { align: "center" });
      g.rect(an.x + 8, an.y + 45, 22, 6, S[2]); g.rect(an.x + 10, an.y + 46, 18, 3, S[0]);
      // ルーペの収納(支給されてから現れる)
      if (this.loupe) {
        const lc = L.loupeCase;
        g.rect(lc.x + 1, lc.y + 1, lc.w, lc.h, S[0]); g.rect(lc.x, lc.y, lc.w, lc.h, S[1]); g.frame(lc.x, lc.y, lc.w, lc.h, S[3]);
        if (this.loupe.loc !== "case") g.text("ルーペ", lc.x + lc.w / 2, lc.y + 9, S[4], { align: "center" });
      }
    }

    drawAlarm(g) {
      const A = this.cur;
      if (!(A && A.agitated && this.phase === "present" && !this.verdict)) return;
      const a = L.alarm, on = Math.floor(this.t * 4) % 2 === 0, hov = inRect(this.mouse.x, this.mouse.y, a);
      g.rect(a.x + 1, a.y + 2, a.w, a.h, S[0]);
      g.rect(a.x, a.y + (hov ? 1 : 0), a.w, a.h, on ? V.RED : V.RED_DARK);
      g.text("警備を呼ぶ", a.x + a.w / 2, a.y + 4 + (hov ? 1 : 0), S[8], { align: "center" });
      g.text("(拘束)", a.x + a.w / 2, a.y + 14 + (hov ? 1 : 0), S[8], { align: "center" });
    }

    drawKit(g, kind, x, y, held) {
      g.rect(x + 1, y + 1, 22, 22, S[0]); g.rect(x, y, 22, 22, held ? S[5] : S[3]);
      if (kind === "kitBlood") { g.rect(x + 9, y + 3, 4, 13, S[7]); g.rect(x + 10, y + 9, 2, 6, V.RED); g.rect(x + 10, y + 16, 2, 4, S[6]); }
      else { g.rect(x + 4, y + 3, 14, 16, S[7]); g.rect(x + 4, y + 3, 14, 4, S[5]); g.text("X", x + 11, y + 8, S[1], { align: "center" }); }
    }

    // ルーペ:レンズの下にあるものを3倍に拡大して見せる
    drawLoupe(g, lp) {
      const cx = lp.x + 15, cy = lp.y + 15, r = 13, ctx = g.ctx;
      if (lp.loc !== "case") {
        const src = r / 3;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx * 2, cy * 2, r * 2, 0, Math.PI * 2); ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(g.canvas, (cx - src) * 2, (cy - src) * 2, src * 4, src * 4, (cx - r) * 2, (cy - r) * 2, r * 4, r * 4);
        ctx.restore();
      }
      ctx.save();
      ctx.lineWidth = 4; ctx.strokeStyle = S[0];
      ctx.beginPath(); ctx.arc(cx * 2, cy * 2, r * 2 + 1, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = S[5];
      ctx.beginPath(); ctx.arc(cx * 2, cy * 2, r * 2 + 1, 0, Math.PI * 2); ctx.stroke();
      if (lp.loc === "case") { ctx.fillStyle = "rgba(163,176,181,.35)"; ctx.fill(); }
      ctx.restore();
      g.rect(cx + 9, cy + 9, 3, 3, S[5]); g.rect(cx + 11, cy + 11, 4, 4, S[1]); g.rect(cx + 13, cy + 13, 4, 6, S[1]);
    }

    drawDoc(g, d, held) {
      const c = d.render(this.day), { w, h } = d.size();
      const sy = d.slide ? -Math.round(d.slide * 20) : 0;
      if (held) g.rect(d.x + 3, d.y + 3, w, h, "rgba(13,20,23,.45)");
      else g.rect(d.x + 1, d.y + 1 + sy, w, h, "rgba(13,20,23,.6)");
      g.imgSame(c, d.x, d.y + sy);
      // ページをめくる動き:片側のページが背に向かって倒れ、反対側に開く
      if (d.kind === "rules" && d.flip && d.loc !== "slot") {
        const k = d.flip.t / 0.32, PW = (d.w - 20) / 2, mid = d.x + d.w / 2, top = d.y + 3, ph = d.h - 6;
        const from = d.flip.dir > 0 ? 1 : -1;
        const half = k < 0.5 ? from : -from, wv = Math.round(PW * Math.abs(1 - k * 2));
        const x = half > 0 ? mid : mid - wv;
        g.rect(x, top, wv, ph, S[8]);
        g.rect(half > 0 ? x + wv - 1 : x, top, 1, ph, S[4]);
        g.rect(x, top + ph - 1, wv, 1, S[5]);
      }
    }

    drawDrawer(g) {
      const r = this.drawerRect(), tb = this.tabRect(), hov = inRect(this.mouse.x, this.mouse.y, tb);
      // つまみ(縦書き)
      g.rect(tb.x, tb.y, tb.w, tb.h, this.drawer ? S[7] : hov ? S[5] : S[4]);
      g.rect(tb.x, tb.y, 1, tb.h, S[0]);
      ["判", "定", this.drawer ? "▶" : "◀"].forEach((ch, i) => g.text(ch, tb.x + tb.w / 2, tb.y + 10 + i * 12, this.drawer ? S[0] : S[8], { align: "center" }));
      if (this.drawerK < 0.02) return;
      const ctx = g.ctx; ctx.save(); ctx.beginPath(); ctx.rect(L.drawer.x * 2, r.y * 2, L.drawer.w * 2, r.h * 2); ctx.clip();
      g.rect(r.x, r.y, r.w, r.h, S[1]); g.frame(r.x, r.y, r.w, r.h, S[4]);
      g.rect(r.x + 6, r.y + 84, r.w - 12, 1, S[3]);
      g.text("地上職員のみ", r.x + r.w / 2, r.y + 89, S[5], { align: "center" });
      const style = { approve: ["適格", S[7], S[0]], deny: ["不適格", V.RED, S[8]], limit: ["限定", S[3], S[8]] };
      this.drawerButtons().forEach((b, i) => {
        const [t, c, tc] = style[b.v], h2 = inRect(this.mouse.x, this.mouse.y, b), dy = h2 ? 1 : 0;
        g.rect(b.x + 1, b.y + 2, b.w, b.h, S[0]);
        g.rect(b.x, b.y + dy, b.w, b.h - 1, c);
        if (b.v === "limit") { for (let j = 0; j < b.h - 1; j++) for (let x = 0; x < b.w; x++) if ((x + j) % 6 < 2) g.px(b.x + x, b.y + dy + j, S[4]); g.frame(b.x, b.y + dy, b.w, b.h - 1, S[6]); }
        g.rect(b.x, b.y + dy, b.w, 3, "rgba(255,255,255,.18)");
        g.text(t, b.x + b.w / 2, b.y + b.h / 2 - 5 + dy, tc, { align: "center" });
        g.text(String(i + 1), b.x + b.w - 4, b.y + b.h - 11 + dy, tc, { align: "right" });
      });
      ctx.restore();
    }

    drawInspect(g) {
      // 照合できる場所だけを明るく残し、ほかを暗くする(暗くする前の絵を写しておき、欄の部分だけ戻す)
      const fs = this.fieldsAt(), ctx = g.ctx;
      if (!this.snap) this.snap = document.createElement("canvas");
      const snap = this.snap;
      if (snap.width !== g.canvas.width) { snap.width = g.canvas.width; snap.height = g.canvas.height; }
      const sctx = snap.getContext("2d");
      sctx.clearRect(0, 0, snap.width, snap.height); sctx.drawImage(g.canvas, 0, 0);
      const restore = (r, pad) => { const x = (r.x - pad) * 2, y = (r.y - pad) * 2, w = (r.w + pad * 2) * 2, h = (r.h + pad * 2) * 2; ctx.drawImage(snap, x, y, w, h, x, y, w, h); };
      g.rect(0, 0, 480, 270, "rgba(5,9,11,.68)");
      // 欄を含む書類や装置は、少しだけ暗くして読めるように残す
      const boxes = [...new Set(fs.map(f => f.box).filter(Boolean))];
      boxes.forEach(b => { restore(b, 0); g.rect(b.x, b.y, b.w, b.h, "rgba(5,9,11,.42)"); });
      fs.forEach(f => restore(f, 1));
      // 照合ボタンは明るいまま
      button(g, L.inspect, "照合  F", true, true);
      const hov = this.fieldAt(this.mouse.x, this.mouse.y);
      fs.forEach(f => corners(g, f, f === hov ? S[8] : S[5]));
      if (this.sel) {
        const r = this.sel;
        g.frame(r.x - 1, r.y - 1, r.w + 2, r.h + 2, S[8]); g.frame(r.x - 2, r.y - 2, r.w + 4, r.h + 4, S[8]);
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
