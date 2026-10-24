// VALID — 審査業務(1日分のシフト)
(function () {
  const S = V.S, L = V.L;
  const DAY_MINUTES = 600;          // 08:00〜18:00
  const SEC_PER_MIN = 0.6;          // 実時間 0.6秒 = ゲーム内1分(1日およそ6分)
  const VERB = { approve: "適格", limit: "限定", deny: "不適格", detain: "拘束" };
  const C = V.LCD;
  const PHYSICAL = ["id"];   // 物として受け渡すのは、IDカードだけ
  const MUST_RETURN = ["id"];
  const PANEL_POS = { reg: [130, 124], ticket: [222, 124], permit: [222, 164], med: [222, 166], xfilm: [292, 124] };
  const LINKED = ["reg", "ticket"];   // IDカードに紐づくデータ:カードを端末に置くと出て、抜くと消える
  const BRIEF = { x: 8, y: 92, w: 354, h: 118 };
  const FLAW_TEXT = {
    expired: "IDの期限切れ", status: "INVALID の判定", permit: "作業許可証の不備", genome: "検体と署名の不一致",
    height: "予測身長との不一致", ticketName: "搭乗券の名義違い", ticketDate: "搭乗券の日付違い", seal: "旧版の印章",
    heart: "記録のない心拍の乱れ", xray: "X線に写った偽装の器具", implant: "記録のない心臓の機器",
    faceReg: "登録簿の顔と本人の不一致", cardForged: "カードの印字の偽造"
  };
  const FLAW_RULE = {
    expired: "rule.expiry", status: "rule.status", permit: "rule.staff", genome: "rule.genome", height: "rule.height",
    ticketName: "rule.ticket", ticketDate: "rule.ticket", seal: "rule.seal", heart: "rule.heart", xray: "rule.xray", implant: "rule.xray",
    faceReg: "rule.face", cardForged: "rule.card"
  };
  const NEW_TOOLS = {
    1: ["掲示板(上)をクリックして呼び出す", "判定端末 ― IDカードを置くと登録簿と搭乗券が出る", "計器 ― 身長と遺伝子(【採血】)、記録", "規則冊子(窓口の下)・【照合】(右下)"],
    2: ["搭乗券 ― IDカードに紐づいて出る。医療記録はデータで届く", "心拍(計器の身体の欄)", "IDカードの印字と登録簿の照合"],
    3: ["体重(計器)", "【X線】(計器)― カーテンを閉めて撮影し、全身の写真がデータで届く"]
  };
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  const ruleText = key => (V.RULES.find(r => r.key === key) || {}).text || "";
  const massOff = A => !!(A.ticket && Math.abs(A.massActual - A.ticket.mass) > 0.5);
  const ENTER_T = 1.6, LEAVE_T = 1.4, AWAY_T = 3.4;
  // X線:カーテンが閉まる → 撮影中の灯 → 光の帯が上から下へ走る → カーテンが開く
  const XR = { close: 0.6, scan0: 0.9, scan1: 2.3, open: 2.8 };

  // 欠点ごとの具体的な説明(違反切符に書く)
  function detail(A, f) {
    const T = A.ticket, today = V.DATES[A.day];
    switch (f.type) {
      case "expired": return `登録簿のIDの期限 ${A.expiry} は、本日 ${today} より前だった。`;
      case "status": return A.role === "地上職員" ? "INVALID の地上職員で、作業許可証がなかった。" : `判定 INVALID の${A.role}だった。`;
      case "permit": return A.permit && A.permit.name !== A.regLatin ? `作業許可証の名義 ${A.permit.name} が登録簿と違った。` : `作業許可証の期限 ${A.permit.expiry} が切れていた。`;
      case "genome": { let n = 0; for (let i = 0; i < 16; i++) if (A.genome[i] !== A.sample[i]) n++; return `採血検体の塩基が ${n}か所、登録簿のゲノム署名と違った。`; }
      case "height": return `実測の身長 ${A.actualH}cm が、登録簿の予測 ${A.predH[0]}-${A.predH[1]}cm の範囲外だった。`;
      case "ticketName": return `搭乗券の名義 ${T.name} が、登録簿の ${A.regLatin} と違った。`;
      case "faceReg": return A.regLook && A.regLook.eyeP !== A.look.eyeP && A.faceVariant === "eye" ? `登録簿の瞳の色(${V.applicant.eyeWord(A.regLook.eyeP)})が、窓口の本人と違った。他人のIDだった。` : "登録簿の顔写真が、窓口の本人と違った。他人のIDだった。";
      case "cardForged": return A.regLatin !== A.latin ? `カードの印字 ${V.applicant.cardName(A)} と顔写真が、登録簿(${A.regLatin})と違った。偽造カードだった。` : "カードの顔写真が、登録簿の顔写真と違った。偽造カードだった。";
      case "ticketDate": return `搭乗券の日付 ${T.date} が本日 ${today} ではなかった。`;
      case "seal": return `搭乗券の印章が旧版の ${T.seal} だった。`;
      case "heart": return "心拍に乱れがあり、医療記録がなかった。";
      case "implant": return "X線に心臓の機器が写っていたのに、医療記録がなかった。";
      case "xray": return A.xray === "bolts" ? "X線に、すねの骨の延長ボルトが写っていた(身長の偽装)。" : "X線に、前腕の血液パッドと指先への管が写っていた(他人の血で採血をごまかす偽装)。";
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
      this.term = { card: null, keys: false, keysK: 0 };   // 判定端末
      this.gene = { seq: null, fresh: 0, busy: 0, owner: null, play: -1 };  // 計器の遺伝子の欄
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
      this.startBtn = { x: BRIEF.x + BRIEF.w - 92, y: BRIEF.y + BRIEF.h - 24, w: 80, h: 16 };
      V.audio.startHall();
    }

    // ---------- 時間 ----------
    update(dt) {
      this.t += dt;
      if (this.fade > 0 && !this.ended) this.fade = Math.max(0, this.fade - dt * 1.5);
      this.walkers.forEach(w => { if (w.delay > 0) { w.delay -= dt; if (w.delay <= 0) w.vx = w.speed; } });
      if (this.started && !this.ended) this.clock = Math.min(DAY_MINUTES, this.clock + dt / SEC_PER_MIN);
      this.term.keysK += ((this.term.keys ? 1 : 0) - this.term.keysK) * Math.min(1, dt * 10);
      this.queueShift = Math.max(0, this.queueShift - dt * 12);
      this.timers = this.timers.filter(tm => { tm.t -= dt; if (tm.t <= 0) { tm.fn(); return false; } return true; });
      this.flashes = this.flashes.filter(f => (f.t -= dt) > 0);
      this.flying = this.flying.filter(f => (f.t += dt) < 0.45);
      this.walkers.forEach(w => { w.x += w.vx * dt; if (w.vx) w.f += dt * 8; });
      this.walkers = this.walkers.filter(w => w.x > -20 && w.x < 500);
      this.updateGuard(dt);
      if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
      this.talkT += dt;
      if (this.bossT > 0) this.bossT -= dt;
      this.items.forEach(d => { if (d.slide > 0) d.slide = Math.max(0, d.slide - dt * 3); });
      if (this.rules.flip && (this.rules.flip.t += dt) > 0.32) this.rules.flip = null;
      if (this.gene.busy > 0) this.gene.busy = Math.max(0, this.gene.busy - dt);
      if (this.phase === "entering" && (this.phaseT += dt) > ENTER_T) { this.phase = "present"; this.phaseT = 0; }
      if (this.phase === "away" && (this.phaseT += dt) > AWAY_T) this.returnFromXray();
      if (this.phase === "leaving" && (this.phaseT += dt) > LEAVE_T) this.finishApplicant();
      if (this.phase === "detained") this.phaseT += dt;
      if (this.started && this.clock >= DAY_MINUTES && !this.cur && !this.ended) this.endShift();
      if (this.started && this.clock >= DAY_MINUTES && !this.closed) this.closeWindow();
      if (this.ended && (this.endT = (this.endT || 0) + dt) > 3.2) { this.fade = Math.min(1, this.fade + dt * 0.8); if (this.fade >= 1 && !this.done) { this.done = true; V.audio.stopHall(); this.game.toNight(this.summary()); } }
      if (V.setCursor) V.setCursor(this.drag ? "grabbing" : this.inspect ? "crosshair" : this.hoverClickable() ? "pointer" : "default");
    }
    hoverClickable() {
      const m = this.mouse, btns = [L.inspect, L.full, this.judgeBtn(), ...this.gaugeBtns().map(b => b.r)];
      if (this.term.keysK > 0.9) btns.push(...this.keyRects());
      return (this.canCall() && inRect(m.x, m.y, L.board)) || btns.some(r => inRect(m.x, m.y, r));
    }

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
      const B = V.BOSS[this.day];
      if (B && B.start) this.bossLines(B.start, 0.8);
    }

    // 主任(上司)が、窓口の後ろから話しかける
    bossLines(lines, delay = 0) {
      lines.forEach((t, i) => this.after(delay + i * 3.2, () => { this.say("boss", t); this.bossT = 4; }));
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
        // ハロウの前回の入構は、2日目のあなたの判定が記録に残っている
        if (spec.id === "hallow2" && this.game.state.flags.hallow) spec.rec = { visits: 1, last: V.DATES[2], verdict: VERB[this.game.state.flags.hallow] };
        A = V.applicant.create(this.day, seed, spec, null);
      } else {
        const r = V.rng(seed * 7 + 3);
        const flaw = r.chance(0.45) ? r.pick(V.applicant.flawPool(this.day)) : null;
        A = V.applicant.create(this.day, seed, null, flaw);
      }
      this.served++;
      this.cur = A; this.phase = "entering"; this.phaseT = 0; this.verdict = null;
      this.gene = { seq: null, fresh: 0, busy: 0, owner: null, play: -1 };
      this.queueN = Math.max(3, this.queueN - 1); this.queueShift = 12;
      V.audio.sfx.click();
      // 受取口に出されるのは物(IDカード、毛髪台紙、封筒)。搭乗券などはデータで机に届く
      const give = [V.docs.make("id", A)];
      const data = ["permit", "med"].filter(k => A[k]);
      this.after(ENTER_T - 0.3, () => {
        this.placeInTray(give);
        give.forEach(d => { d.loc = "tray"; this.items.push(d); });
        data.forEach(k => this.showPanel(k, A));
        V.audio.sfx.paper();
        A.greet.forEach(line => this.say("them", line));
        // 主任の頼みごと:申請者のあいさつのあと、主任が後ろから小声で頼む
        const B = V.BOSS[this.day];
        if (A.favor && B && B.ask) this.bossLines(B.ask, 3.4);
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

    // データ板を机に出す(上から静かに現れる)
    showPanel(kind, A) {
      const d = V.docs.make(kind, A), [x, y] = PANEL_POS[kind];
      d.loc = "desk"; d.x = x; d.y = y; d.slide = 0.6; d.front();
      this.items.push(d);
      return d;
    }

    // 採血:窓口の採血器に指を当ててもらい、計器の遺伝子の欄に検体の塩基が出る
    requestSample(kind) {
      const A = this.cur;
      if (!A || this.phase !== "present") { this.note("窓口に申請者がいません。"); return; }
      if (kind === "blood") {
        if (A.sampled || this.gene.busy > 0) { this.note("この申請者は採血済みです。"); return; }
        this.say("you", "採血します。窓口の採血器に指を。"); V.audio.sfx.lancet();
        this.gene = { seq: null, fresh: 0, busy: 1.4, owner: A, play: -1 };
        this.after(1.4, () => {
          if (this.cur !== A) return;
          Object.assign(this.gene, { seq: A.sample, fresh: A.fresh }); A.sampled = true;
          V.audio.sfx.machine();
          if (this.term.card && this.term.card.owner === A) this.listen();
        });
      } else if (kind === "xray") {
        if (A.xrayTaken) { this.note("X線写真はもう届いています。"); return; }
        // 声をかけるかどうかは、そのときどき(黙ってカーテンを引くこともある)
        const ask = pick(V.LINES.xrayAsk);
        if (ask) this.say("you", ask);
        this.phase = "away"; this.phaseT = 0;
        V.audio.sfx.drawer();
        this.after(XR.scan0, () => V.audio.sfx.xray());
        this.after(XR.open, () => V.audio.sfx.drawer());
      }
    }
    returnFromXray() {
      const A = this.cur;
      this.phase = "present"; this.phaseT = 0;
      if (!A) return;
      A.xrayTaken = true;
      this.showPanel("xfilm", A);
      const done = A.replies.xrayDone !== undefined ? A.replies.xrayDone : pick(V.LINES.xrayDone);
      if (done) this.say("them", done);
      V.audio.sfx.machine();
    }

    decide(verdict) {
      const A = this.cur;
      if (!A || this.phase !== "present") { this.note("窓口に申請者がいません。"); return; }
      const id = this.term.card;
      if (!id || id.owner !== A) { this.note("IDカードを判定端末に置いてから判定してください。"); return; }
      if (id.stamp) { this.note("このIDには、もう判定が書き込まれています。"); return; }
      id.stamp = verdict; id.dirty = true;
      this.verdict = verdict;
      this.term.keys = false; this.closeInspect();
      V.audio.sfx.stamp(verdict === "deny");
      // カードが端末から押し出され、チップのランプが灯る
      this.term.card = null; this.hideLinked(A);
      id.loc = "desk"; id.x = L.terminal.x - id.w - 6; id.y = L.terminal.y + 6; id.slide = 0.5; id.front();
      this.say("sys", `判定:${VERB[verdict]}。IDカードを申請者へ返す。`);
    }

    // 端末の【判定】:照合を終えてから押すと、光るキーが収納からせり上がる
    pressJudge() {
      const A = this.cur;
      if (!this.started) return;
      if (!A || this.phase !== "present") { this.note("窓口に申請者がいません。"); return; }
      if (this.verdict) { this.note("判定は済んでいます。IDカードを返してください。"); return; }
      if (!this.term.card || this.term.card.owner !== A) { this.note("IDカードを判定端末に置いてください。"); return; }
      this.term.keys = !this.term.keys; this.closeInspect();
      V.audio.sfx.drawer();
    }

    // IDカードを端末の読み取り台に置く。登録簿と搭乗券(カードに紐づくデータ)が机に出る
    insertCard(d) {
      const A = this.cur;
      if (this.term.card && this.term.card !== d) { this.note("端末には別のカードが置かれています。"); return false; }
      d.loc = "term"; d.dirty = true; this.term.card = d;
      V.audio.sfx.drop();
      if (d.owner === A && !d.stamp) {
        const first = !A.regRead;
        A.regRead = true;
        this.after(0.3, () => {
          if (this.cur !== A || this.term.card !== d) return;
          LINKED.forEach(k => {
            if (k === "ticket" && !A.ticket) return;
            const p = this.items.find(x => x.kind === k && x.owner === A);
            if (p) { p.loc = "desk"; p.slide = 0.6; p.front(); } else this.showPanel(k, A);
          });
          V.audio.sfx.machine();
          if (first && this.gene.seq && this.gene.owner === A) this.listen();
        });
      }
      return true;
    }
    // カードを抜くと、紐づいたデータは机から消える(置いた位置は覚えておく)
    hideLinked(A) {
      this.items.forEach(p => { if (p.owner === A && LINKED.includes(p.kind) && p.loc === "desk") p.loc = "hidden"; });
      if (this.sel && this.sel.doc && this.sel.doc.loc === "hidden") this.sel = null;
    }
    pullCard(x, y) {
      const d = this.term.card; if (!d) return;
      const c = this.cardRect();
      this.term.card = null; this.term.keys = false; this.hideLinked(d.owner);
      d.loc = "hand"; d.front(); d.dirty = true;
      d.x = c.x; d.y = c.y;
      this.drag = { item: d, dx: x - d.x, dy: y - d.y, from: "term" };
      V.audio.sfx.paper();
    }

    // 遺伝子を聴く:左の耳にIDの署名、右の耳に採血の検体。一致すれば同じ音、食い違えば濁った和音になる
    listen() {
      const gn = this.gene, A = gn.owner;
      if (!gn.seq || !A) return;
      if (!this.term.card || this.term.card.owner !== A) { this.note("IDカードを端末に置くと、登録簿の署名と聴き比べられます。"); return; }
      gn.play = 0;
      V.audio.genome(A.genome, gn.seq, i => { if (this.gene === gn) gn.play = i; });
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
      this.term.keys = false; this.closeInspect();
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
      if (MUST_RETURN.includes(d.kind) && !this.verdict) { this.note("判定端末で判定してから返してください。"); return false; }
      d.loc = "given";
      this.flying.push({ d, x: d.x, y: d.y, t: 0 });
      V.audio.sfx.paper();
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
      this.items = this.items.filter(d => d.owner !== A);
      if (this.term.card && this.term.card.owner === A) this.term.card = null;
      this.term.keys = false;
      if (this.gene.owner === A) this.gene = { seq: null, fresh: 0, busy: 0, owner: null, play: -1 };
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
      // 主任の頼みごと:頼みを聞いて通せば、切符は主任が処理し、終業後にチップをくれる
      const B = V.BOSS[this.day];
      if (A.favor && B) {
        if (verdict === "approve") {
          this.flags.tip = (this.flags.tip || 0) + V.BOSS.tip;
          this.after(1.2, () => { this.say("boss", B.yes); this.bossT = 4; });
          return;
        }
        if (B.no) this.after(1.2, () => { this.say("boss", B.no); this.bossT = 4; });
      }
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
      c.h = 31 + lines.reduce((s, l) => s + V.Surface.wrap(l, c.w - 4, 12).length * 7, 0) + (rule ? V.Surface.wrap("規則:" + rule, c.w - 4, 12).length * 7 : 0);
      // 印字機から、机の上端へ押し出される
      c.loc = "desk"; c.x = 170; c.y = L.gauge.y + L.gauge.h + 2; c.slide = 1; c.front();
      this.items.push(c);
      V.audio.sfx.citation();
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
      this.term.keys = false; this.closeInspect();
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
      // 読み取り台に置いたカードの表も見比べられる
      const tc = this.term.card;
      if (tc) {
        tc.render(this.day);
        const c = this.cardRect();
        tc.fields.forEach(f => out.push({ key: f.key, x: c.x + f.x, y: c.y + f.y, w: f.w, h: f.h, label: f.label, box: c }));
      }
      if (A && this.phase === "present") {
        const b = L.gBody, gn = L.gGene, rc = L.gRec;
        add("body.height", b.x + 2, b.y + 7, 50, 9, `身長 ${A.actualH}cm`, b);
        if (this.day >= 3) add("scale", b.x + 2, b.y + 16, 50, 9, "体重 " + A.massActual.toFixed(1) + "kg", b);
        if (this.day >= 2) add("heart", b.x + 54, b.y + 7, b.w - 56, 18, "心拍", b);
        add("face", ...Object.values(this.faceRect()), "窓口の本人の顔", L.win);
        const tag = this.heightTag();
        add("body.height", tag.x, tag.y, tag.w, tag.h, `頭頂の高さ ${A.actualH}cm`, L.win);
        const linked = !!(tc && tc.owner === A);
        if (linked) add("reg.genome", gn.x + 2, gn.y + 8, gn.w - 4, 10, "登録簿の署名 " + A.genome, gn);
        if (this.gene.seq && this.gene.owner === A) add("seq", gn.x + 2, gn.y + 19, gn.w - 4, 10, "採血の検体 " + this.gene.seq, gn);
        if (linked) add("rec", rc.x + 2, rc.y + 7, rc.w - 4, 25, "入構の記録", rc);
      }
      return out;
    }
    fieldAt(x, y) {
      // 重なっているときは、いちばん小さい欄を選ぶ
      let best = null;
      this.fieldsAt().forEach(f => { if (inRect(x, y, f) && (!best || f.w * f.h <= best.w * best.h)) best = f; });
      return best;
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
    toggleInspect() { this.inspect = !this.inspect; this.sel = null; this.term.keys = false; V.audio.sfx.click(); this.hintSeen.inspect = true; }
    // 身長の壁に出る数値の札
    heightTag() {
      const top = Math.round(V.cmToY(this.cur.actualH)) - 1, tw = V.Surface.measure(this.cur.actualH + "cm") + 6;
      return { x: L.win.x + 2, y: top - 5, w: tw, h: 10 };
    }
    // 窓口に立つ本人の顔のあたり
    faceRect() {
      const A = this.cur, k = V.BUST_K, gm = V.art.geom(A, k), top = Math.round(V.cmToY(A.actualH)) - 1;
      const bx = Math.round(L.win.x + L.win.w / 2 - gm.W / 2);
      return { x: Math.round(bx + gm.cx - gm.rx - 3), y: top, w: Math.round(gm.rx * 2 + 6), h: Math.round(gm.cy + gm.ry + 2) };
    }
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
      if (this.cur && this.cur.agitated && this.phase === "present" && !this.verdict && inRect(x, y, L.alarm)) { this.detain(); return; }
      if (inRect(x, y, L.inspect)) { if (this.started) this.toggleInspect(); return; }
      // 判定端末:せり上がったキー、【判定】、置かれたカード
      if (this.term.keysK > 0.9) { const k = this.keyRects().find(r => inRect(x, y, r)); if (k) { this.decide(k.v); return; } }
      if (inRect(x, y, this.judgeBtn())) { this.pressJudge(); return; }
      if (this.term.card && !this.inspect && inRect(x, y, this.cardRect())) { this.pullCard(x, y); return; }
      // 計器のボタン
      const gb = this.gaugeBtns().find(b => inRect(x, y, b.r));
      if (gb) { if (gb.on) gb.fn(); return; }
      // 規則冊子のページ送り
      if (this.rules.loc === "desk" && this.topDocAt(x, y) === this.rules) {
        this.rules.render(this.day); // 開いた直後でも、矢印の位置を確かめられるように
        const f = this.rules.fields.find(f => f.key.startsWith("tab.") && inRect(x - this.rules.x, y - this.rules.y, f));
        if (f) {
          const to = f.key.startsWith("tab.go.") ? Math.floor(+f.key.slice(7) / 2) : this.rules.page + (f.key === "tab.next" ? 1 : -1);
          if (to !== this.rules.page) { const dir = to > this.rules.page ? 1 : -1; this.rules.page = to; this.rules.dirty = true; this.rules.flip = { dir, t: 0 }; V.audio.sfx.paper(); }
          return;
        }
      }
      if (this.inspect) {
        const f = this.fieldAt(x, y);
        if (f) this.pickField(f); else this.sel = null;
        return;
      }
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

    onMove(x, y) {
      this.mouse = { x, y };
      if (this.drag) { this.drag.item.x = Math.round(x - this.drag.dx); this.drag.item.y = Math.round(y - this.drag.dy); }
    }

    onUp(x, y) {
      const dg = this.drag; if (!dg) return;
      this.drag = null;
      const it = dg.item, A = this.cur;
      // 規則冊子をクリックしただけなら、机の空いた場所に開く
      if (it.kind === "rules" && dg.from === "slot" && Math.hypot(x - dg.sx, y - dg.sy) < 3) { it.loc = "desk"; it.x = 140; it.y = 126; it.dirty = true; V.audio.sfx.paper(); return; }
      if (it.kind === "citation" && inRect(x, y, L.citeBox)) { this.items = this.items.filter(d => d !== it); V.audio.sfx.drop(); return; }
      if (it.kind === "rules" && inRect(x, y, L.bookSlot)) { this.toSlot(it); return; }
      // IDカードを判定端末に置く
      if (it.kind === "id" && inRect(x, y, L.terminal) && !it.stamp) { if (this.insertCard(it)) return; return this.putBack(it, dg); }
      // 申請者へ手渡す(物だけ。データ板は机に残る)
      if (inRect(x, y, L.win) && it.owner && it.owner === A && this.phase === "present" && PHYSICAL.includes(it.kind)) {
        if (this.handBack(it)) return;
        return this.putBack(it, dg);
      }
      // 受取口に置く(離した場所に落ちる)
      if (inRect(x, y, L.tray)) {
        if (it.kind === "rules") { this.toSlot(it); return; }
        if (!it.owner || !PHYSICAL.includes(it.kind)) return this.putBack(it, dg);
        const [w, h] = V.docs.MINI[it.kind];
        it.tx = Math.round(V.clamp(x - w / 2, L.tray.x + 1, L.tray.x + L.tray.w - w - 1));
        it.ty = Math.round(V.clamp(y - h / 2, L.tray.y + 3, L.tray.y + L.tray.h - h - 1));
        it.loc = "tray"; it.dirty = true; V.audio.sfx.drop();
        return;
      }
      // 机の上:離した場所に落とす
      if (x >= L.desk.x && y >= L.desk.y) { this.dropOnDesk(it); V.audio.sfx.drop(); return; }
      this.putBack(it, dg);
    }
    // 机の右端・下端からはみ出してもよいが、つかめるように 35% は机の上に残す。計器の帯の下には潜らせない
    dropOnDesk(it) {
      it.loc = "desk"; it.dirty = true;
      const { w, h } = it.size();
      it.x = V.clamp(it.x, L.desk.x + 1, 480 - Math.round(w * 0.35)); it.y = V.clamp(it.y, L.gauge.y + L.gauge.h + 1, 270 - Math.round(h * 0.35));
    }
    // 机に据え付けた装置。常に書類より上に描き、その上のクリックは装置のものとして扱う
    deviceRects() {
      const list = [L.gauge, L.terminal];
      if (this.alarmShown()) list.push(L.alarm);
      return list;
    }
    alarmShown() { const A = this.cur; return !!(A && A.agitated && this.phase === "present" && !this.verdict); }
    onDevice(x, y) { return this.deviceRects().some(r => inRect(x, y, r)) || inRect(x, y, L.inspect) || inRect(x, y, L.citeBox); }
    putBack(it, dg) {
      if (dg.from === "tray") { it.loc = "tray"; return; }
      if (dg.from === "term") { this.insertCard(it); return; }
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
      else if (k === "Escape") { this.closeInspect(); this.term.keys = false; }
      else if (k === "d" || k === "D") this.pressJudge();
      else if (this.term.keys && "123".includes(k)) this.decide(["approve", "deny", "limit"][+k - 1]);
    }

    // ---------- 判定端末と計器の部品 ----------
    // 読み取り台(左)に寝かせたカードと、右の細い列:【判定】と、その下の収納からせり上がるキー
    cardRect() { const t = L.terminal; return { x: t.x + 3, y: t.y + 10, w: 56, h: 32 }; }
    judgeBtn() { const t = L.terminal; return { x: t.x + 63, y: t.y + 2, w: t.w - 65, h: 10 }; }
    keyRects() {
      const t = L.terminal, k = this.term.keysK, x = t.x + 64, w = t.w - 67, rise = (h, y) => ({ y: Math.round(y + (1 - k) * h), h });
      return [
        { v: "approve", x, w, ...rise(9, t.y + 15) },
        { v: "deny", x, w, ...rise(9, t.y + 25) },
        { v: "limit", x, w, ...rise(7, t.y + 37) }
      ];
    }
    gaugeBtns() {
      const A = this.cur, ok = !!(A && this.phase === "present"), gn = L.gGene, b = L.gBody, out = [];
      const linked = !!(ok && this.term.card && this.term.card.owner === A);
      out.push({ id: "blood", label: "採血", r: { x: gn.x + 70, y: gn.y + 1, w: 30, h: 7 }, on: ok && !A.sampled && this.gene.busy <= 0, fn: () => this.requestSample("blood") });
      out.push({ id: "listen", label: "♪ 聴く", r: { x: gn.x + 103, y: gn.y + 1, w: 34, h: 7 }, on: ok && !!this.gene.seq && linked, fn: () => this.listen() });
      if (this.day >= 3) out.push({ id: "xray", label: "X線", r: { x: b.x + 30, y: b.y + 1, w: 22, h: 7 }, on: ok && !!A.ticket && !A.xrayTaken, fn: () => this.requestSample("xray") });
      return out;
    }

    // ---------- 手引き ----------
    hint() {
      const A = this.cur, day = this.day;
      if (this.ended) return "";
      if (!this.started) return "今日の規則と道具を確かめたら、【業務開始】を押してください。";
      if (this.inspect) return this.sel ? "もう一か所を選ぶと照合します。(右クリック/F で照合をやめる)" : "照合モード:食い違っていそうな2か所を順にクリック。(右クリック/F で終わる)";
      if (A && A.agitated && !this.verdict) return "申請者が暴れている。机の【警備を呼ぶ】で拘束できる。";
      if (A && A.massNoted && !A.xrayTaken && this.phase === "present") return "体重が申告と違う。計器の【X線】を押して撮らせる。";
      if (day === 1 && this.served === 0) return "上の掲示板をクリックして、最初の申請者を呼んでください。(Space キーでも呼べます)";
      if (A && A.tutorial) {
        const id = this.items.find(d => d.kind === "id" && d.owner === A);
        if (this.phase !== "present") return "";
        if (!A.regRead) return "受取口のIDカードを、右下の判定端末の読み取り台へドラッグして置いてください。";
        if (!this.gene.seq && this.gene.busy <= 0) return "IDの発行が30日以内なので採血の対象。上の計器の【採血】を押す。";
        if (this.gene.seq && !this.hintSeen.inspect) return "右下の【照合】(F/右クリック)で、登録簿の顔と本人、署名と検体などを見比べる。";
        if (!this.verdict) return this.term.keys ? "せり上がったキーで判定を選ぶ。" : "照合を終えたら、端末の【判定】(D)を押す。";
        if (id && id.loc !== "given") return "押し出されたIDカードを、窓の申請者へドラッグして返してください。";
        return "";
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
      this.drawGauges(g);
      this.drawTerminal(g);
      this.drawFlying(g);
      this.drawAlarm(g);
      button(g, L.inspect, "照合  F", this.started, this.inspect);
      if (!this.started) this.drawBriefing(g);
      if (this.drag) {
        const it = this.drag.item;
        this.drawDoc(g, it, true);
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
      // 主任が話しているあいだは、詰所の奥に立っている
      if (this.bossT > 0) V.art.walker(g, k.x + 14, k.y + 6, 4242, 0, 1, true);
      // 窓口の前の計量台(一段高い)
      g.rect(166, 73, 20, 3, S[4]); g.rect(166, 76, 20, 1, S[0]); g.rect(166, 73, 20, 1, S[5]);
      // 窓口に立つ申請者(ホール側):詰所の中のあなたと向き合う
      const escorting = this.guard.state === "grab" || this.guard.state === "escort";
      if (A && !escorting && (this.phase === "present" || this.phase === "entering" || this.phase === "detained" || this.phase === "leaving" || this.phase === "away")) {
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
      if (A) {
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
      }
      if (A && this.phase === "away") this.drawXrayCurtain(g, A);
      for (let k = 0; k < 34; k++) g.rect(w.x + 124 + k, w.y + 6 + k * 3, 1, 3, "rgba(211,218,220,.08)");
      // 吹き出し(最新の発言)
      const spoken = this.talk.filter(m => m.who !== "sys");
      if (this.started && spoken.length && this.talkT < 9) {
        const m = spoken[spoken.length - 1];
        const boss = m.who === "boss";
        const lines = V.Surface.wrap((m.who === "you" ? "> " : boss ? "主任「" : "") + m.text + (boss ? "」" : ""), w.w - 16).slice(0, 4);
        const bh = lines.length * 9 + 4, by = boss ? w.y + w.h - bh - 4 : w.y + 3;
        const bg = m.who === "them" ? S[8] : m.who === "you" ? S[1] : boss ? S[3] : "rgba(13,20,23,.85)", fg = m.who === "them" ? S[0] : boss ? S[8] : S[7];
        g.rect(w.x + 4, by, w.w - 8, bh, bg);
        if (m.who === "them") { g.rect(w.x + w.w / 2 - 3, by + bh, 6, 2, bg); g.rect(w.x + w.w / 2 - 1, by + bh + 2, 2, 2, bg); }
        lines.forEach((ln, i) => g.text(ln, w.x + 8, by + 2 + i * 9, fg));
      }
      ctx.restore();
      if (!A && this.started) g.text(this.closed ? "搭乗受付 締切" : "― 窓口 空き ―", w.x + w.w / 2, w.y + 60, S[5], { align: "center" });
      // 身長の壁は、頭頂の高さを自動で読み取って、その高さに数値を出す
      if (A && this.phase === "present") {
        const top = Math.round(V.cmToY(A.actualH)) - 1, fr = this.faceRect(), txt = A.actualH + "cm";
        for (let x = w.x + 30; x < fr.x - 1; x += 3) g.rect(x, top, 2, 1, S[7]);
        const tw = V.Surface.measure(txt) + 6;
        g.rect(w.x + 2, top - 5, tw, 10, S[0]); g.frame(w.x + 2, top - 5, tw, 10, S[6]);
        g.text(txt, w.x + 5, top - 4, S[8]);
      }
    }

    // X線の撮影:窓のカーテンが左から閉まり、撮影中の灯がともる。光の帯が上から下へ走り、
    // 布ごしに骨の影が一瞬だけ透ける。撮り終えるとカーテンが開く
    drawXrayCurtain(g, A) {
      const w = L.win, t = this.phaseT;
      const k = t < XR.close ? t / XR.close : t < XR.open ? 1 : Math.max(0, 1 - (t - XR.open) / (AWAY_T - XR.open));
      const ease = 1 - Math.pow(1 - k, 2), cw = Math.round(w.w * ease);
      if (cw <= 0) return;
      // 布(ひだの陰影)
      // 右端から引き出す。ひだは右端に固定され、閉じるほど広がる
      const x0 = w.x + w.w - cw;
      for (let x = 0; x < cw; x++) {
        const f = Math.sin((x + (1 - ease) * 40) / 4.2);
        g.rect(w.x + w.w - 1 - x, w.y + 4, 1, w.h - 4, f > 0.55 ? S[4] : f < -0.55 ? S[2] : S[3]);
      }
      g.rect(x0, w.y + 4, 1, w.h - 4, S[1]);
      g.rect(x0, w.y + w.h - 6, 3, 6, S[2]);
      // レールと吊り輪
      g.rect(w.x, w.y, w.w, 3, S[1]); g.rect(w.x, w.y + 2, w.w, 1, S[5]);
      for (let x = 2; x < cw; x += Math.max(6, Math.round(cw / 14))) g.rect(w.x + w.w - 2 - x, w.y + 1, 2, 4, S[6]);
      if (k < 1) return;
      // 撮影中の灯
      const on = t >= XR.close + 0.15 && t < XR.open, lx = w.x + w.w / 2 - 22, ly = w.y + w.h - 18;
      g.rect(lx, ly, 44, 11, S[0]); g.frame(lx, ly, 44, 11, on ? S[7] : S[3]);
      if (on) g.rect(lx - 2, ly - 2, 48, 15, "rgba(236,239,238,.10)");
      g.text("撮影中", lx + 22, ly + 1.5, on ? S[8] : S[3], { align: "center" });
      // 光の帯と、布ごしに透ける骨
      if (t >= XR.scan0 && t < XR.scan1) {
        const p = (t - XR.scan0) / (XR.scan1 - XR.scan0), top = w.y + 22, bot = w.y + w.h, y = Math.round(top + (bot - top) * p);
        // 窓の上半身と頭の大きさがそろう倍率で、全身のX線像を重ねる
        const k = V.BUST_K;
        if (!A._xray) A._xray = V.art.xrayBody(A, 210 * k);
        const img = A._xray, bx = Math.round(w.x + w.w / 2 - img.width / 2), by = Math.round(V.cmToY(A.actualH)) - 1 - Math.round(0.6 * k);
        const band = 14, ctx = g.ctx;
        ctx.save(); ctx.beginPath(); ctx.rect(w.x * 2, (y - band) * 2, w.w * 2, band * 2); ctx.clip();
        ctx.globalAlpha = 0.35; g.img(img, bx, by); ctx.restore();
        g.rect(w.x, y - band, w.w, band, "rgba(236,239,238,.06)");
        g.rect(w.x, y - 1, w.w, 2, "rgba(236,239,238,.55)");
      }
    }

    // 朝の業務説明:窓口と机にまたがる板。【業務開始】を押すまで時計は止まっている
    drawBriefing(g) {
      const B = BRIEF, d = this.day, x = B.x + 8;
      g.rect(B.x, B.y, B.w, B.h, "rgba(13,20,23,.94)"); g.frame(B.x, B.y, B.w, B.h, S[4]);
      g.text(`DAY ${d} の業務`, x, B.y + 5, S[8]);
      let y = B.y + 18;
      const rules = V.RULES.filter(r => r.day === d);
      g.text(`${d === 1 ? "規則" : "新しい規則"}(${rules.length}件・規則冊子)`, x, y, S[5]); y += 10;
      rules.slice(0, 5).forEach(r => { g.text("・" + shorten(r.text, B.w - 20), x, y, S[7]); y += 9; });
      if (rules.length > 5) { g.text(`ほか${rules.length - 5}件`, x + 8, y, S[5]); y += 9; }
      y += 3;
      g.text(d === 1 ? "道具" : "新しい道具", x, y, S[5]); y += 10;
      NEW_TOOLS[d].forEach(t => { g.text("・" + shorten(t, B.w - 110), x, y, S[7]); y += 9; });
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
      // 切符入れ(机の左下の差し込み口)
      const cb = L.citeBox;
      g.rect(cb.x, cb.y, cb.w, cb.h, S[1]); g.frame(cb.x, cb.y, cb.w, cb.h, S[3]); g.rect(cb.x + 4, cb.y + 3, cb.w - 8, 2, S[0]);
      g.text("切符入れ", cb.x + cb.w / 2, cb.y + 7, this.items.some(d => d.kind === "citation") ? S[7] : S[4], { align: "center", size: 12 });
    }

    // 引きずっている物を落とせる場所を示す
    drawDropTargets(g, it) {
      const A = this.cur, glow = (r, label) => { g.frame(r.x, r.y, r.w, r.h, S[7]); if (label) { const w = V.Surface.measure(label) + 8; g.rect(r.x + r.w / 2 - w / 2, r.y + r.h - 13, w, 11, S[7]); g.text(label, r.x + r.w / 2, r.y + r.h - 12, S[0], { align: "center" }); } };
      if (it.owner && it.owner === A && this.phase === "present" && PHYSICAL.includes(it.kind) && (!MUST_RETURN.includes(it.kind) || this.verdict)) glow(L.win, "手渡して返す");
      if (it.kind === "id" && !it.stamp) glow(L.terminal, "置く");
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

    // 計器の帯:身体・遺伝子・記録。据え付けなので、書類より上に描く
    drawGauges(g) {
      const A = this.cur, present = !!(A && this.phase === "present"), day = this.day;
      const linked = !!(present && this.term.card && this.term.card.owner === A);
      const sec = (r, title) => {
        g.rect(r.x, r.y, r.w, r.h, C.panel); g.frame(r.x, r.y, r.w, r.h, C.line);
        g.rect(r.x + 1, r.y + 1, r.w - 2, 1, C.glow);
        g.text(title, r.x + 3, r.y + 1, C.dim, { size: 12 });
      };
      const bases = (seq, x, y) => { for (let i = 0; i < 16; i++) { const b = seq[i], bx = x + i * 6; g.rect(bx, y, 5, 9, V.BASE[b]); g.text(b, bx + 0.5, y + 1, S[0]); } };
      // 身体:左に数値、右に心拍
      const b = L.gBody;
      sec(b, "身体");
      g.text("身長", b.x + 3, b.y + 8, C.dim); g.text(present ? A.actualH + "cm" : "---", b.x + 21, b.y + 8, present ? C.hi : C.dim);
      if (day >= 3) { g.text("体重", b.x + 3, b.y + 17, C.dim); g.text(present ? A.massActual.toFixed(1) + "kg" : "---", b.x + 21, b.y + 17, present ? C.hi : C.dim); }
      if (day >= 2) {
        const hx = b.x + 56, hw = b.w - 59, hy = b.y + 17;
        g.text("心拍", hx + hw, b.y + 1, C.dim, { size: 12, align: "right" });
        if (present) {
          const irr = A.heart === "irregular";
          let prev = hy;
          for (let x = 0; x < hw; x++) {
            const ph = (x + this.t * 30) % 19, beat = irr ? ((x + Math.floor(this.t * 30)) % 37 < 19 ? 0 : 4) : 0;
            let y = hy;
            if (Math.abs(ph - (8 + beat)) < 1) y = hy - 7; else if (Math.abs(ph - (9 + beat)) < 1) y = hy + 5;
            g.rect(hx + x, Math.min(prev, y), 1, Math.abs(prev - y) + 1, C.text);
            prev = y;
          }
        } else g.rect(hx, hy, hw, 1, C.line);
      }
      // 遺伝子:上の行が登録簿の署名(カードを置いているあいだだけ)、下の行が採血した検体
      const gn = L.gGene;
      sec(gn, "遺伝子");
      g.text("登録", gn.x + 3, gn.y + 9, C.dim); g.text("検体", gn.x + 3, gn.y + 20, C.dim);
      const bx = gn.x + 26;
      if (linked) bases(A.genome, bx, gn.y + 8);
      else g.text("― カード未読 ―", bx + 48, gn.y + 9, C.line, { align: "center" });
      const gs = this.gene;
      if (gs.busy > 0) { const k = 1 - gs.busy / 1.4; g.rect(bx, gn.y + 23, Math.round(95 * k), 3, C.text); }
      else if (gs.seq && present) {
        bases(gs.seq, bx, gn.y + 19);
        if (gs.play >= 0 && gs.play < 16) g.rect(bx + gs.play * 6, gn.y + 29, 5, 2, C.hi);
        if (gs.fresh > 0) g.text(`凝固+${gs.fresh.toFixed(1)}s`, gn.x + gn.w - 3, gn.y + 25, C.text, { align: "right", size: 12 });
      } else g.text("― 未採血 ―", bx + 48, gn.y + 20, C.line, { align: "center" });
      // 記録:カードを置いているあいだ、入構の履歴が出る
      const rc = L.gRec;
      sec(rc, "記録");
      if (linked) {
        const r = A.rec;
        if (!r.visits) g.text("初めての入構", rc.x + 3, rc.y + 9, C.hi);
        else {
          g.text("前回 " + r.last.slice(5) + " " + (r.verdict || (A.status === "INVALID" ? "限定" : "適格")), rc.x + 3, rc.y + 8, C.hi);
          g.text(`入構 ${r.visits}回`, rc.x + 3, rc.y + 17, C.text);
        }
      } else g.text("―", rc.x + rc.w / 2, rc.y + 13, C.line, { align: "center" });
      // ボタン
      this.gaugeBtns().forEach(bt => {
        const r = bt.r, hov = bt.on && inRect(this.mouse.x, this.mouse.y, r);
        g.rect(r.x, r.y, r.w, r.h, hov ? C.text : bt.on ? C.line : C.panel);
        g.frame(r.x, r.y, r.w, r.h, bt.on ? C.text : C.line);
        g.text(bt.label, r.x + r.w / 2, r.y, hov ? S[0] : bt.on ? C.hi : C.line, { align: "center", size: 12 });
      });
    }

    // 判定端末:左の読み取り台にIDカードを寝かせて置く。右の【判定】を押すと、細いキーが収納からせり上がる
    drawTerminal(g) {
      const t = L.terminal, A = this.cur, card = this.term.card;
      g.rect(t.x + 1, t.y + 2, t.w, t.h, S[0]);
      g.rect(t.x, t.y, t.w, t.h, S[2]); g.frame(t.x, t.y, t.w, t.h, S[4]);
      const c = this.cardRect();
      g.rect(c.x - 1, c.y - 1, c.w + 2, c.h + 2, C.base); g.frame(c.x - 1, c.y - 1, c.w + 2, c.h + 2, C.line);
      g.text("判定端末", t.x + 3, t.y + 1, S[5], { size: 12 });
      if (card) {
        const img = card.render(this.day);
        g.imgSame(img, c.x, c.y);
        if (!this.inspect && inRect(this.mouse.x, this.mouse.y, c)) g.frame(c.x - 1, c.y - 1, c.w + 2, c.h + 2, C.hi);
      } else g.text("IDカードを置く", c.x + c.w / 2, c.y + 13, C.dim, { align: "center", size: 12 });
      // 【判定】ボタン
      const jb = this.judgeBtn(), can = !!(card && A && card.owner === A && this.phase === "present" && !this.verdict), hov = can && inRect(this.mouse.x, this.mouse.y, jb);
      g.rect(jb.x, jb.y + 1, jb.w, jb.h, S[0]);
      g.rect(jb.x, jb.y + (hov ? 1 : 0), jb.w, jb.h, this.term.keys ? S[7] : can ? S[5] : S[3]);
      g.text("判定", jb.x + jb.w / 2, jb.y + 2 + (hov ? 1 : 0), this.term.keys || can ? S[0] : S[4], { align: "center", size: 12 });
      // キーの収納:ふだんは閉じている
      const bay = { x: jb.x, y: t.y + 14, w: jb.w, h: t.h - 16 };
      g.rect(bay.x, bay.y, bay.w, bay.h, S[0]);
      const k = this.term.keysK;
      if (k < 0.05) { for (let y = bay.y + 3; y < bay.y + bay.h; y += 4) g.rect(bay.x + 2, y, bay.w - 4, 1, S[1]); return; }
      const ctx = g.ctx; ctx.save(); ctx.beginPath(); ctx.rect(bay.x * 2, bay.y * 2, bay.w * 2, bay.h * 2); ctx.clip();
      g.rect(bay.x, t.y + 35, bay.w, 1, S[3]);
      const style = { approve: ["適格", S[8], S[0]], deny: ["不適格", V.RED, S[8]], limit: ["限定", S[5], S[0]] };
      this.keyRects().forEach(r => {
        const [label, col, tc] = style[r.v], hv = k > 0.9 && inRect(this.mouse.x, this.mouse.y, r);
        g.rect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, r.v === "deny" ? "rgba(209,67,47,.25)" : "rgba(236,239,238,.16)");
        g.rect(r.x, r.y + (hv ? 1 : 0), r.w, r.h - 1, col);
        g.rect(r.x, r.y + (hv ? 1 : 0), r.w, 1, "rgba(255,255,255,.25)");
        g.text(label, r.x + r.w / 2, r.y + Math.round(r.h / 2) - 3 + (hv ? 1 : 0), tc, { align: "center", size: 12 });
      });
      ctx.restore();
    }

    drawAlarm(g) {
      if (!this.alarmShown()) return;
      const a = L.alarm, on = Math.floor(this.t * 4) % 2 === 0, hov = inRect(this.mouse.x, this.mouse.y, a);
      g.rect(a.x + 1, a.y + 2, a.w, a.h, S[0]);
      g.rect(a.x, a.y + (hov ? 1 : 0), a.w, a.h, on ? V.RED : V.RED_DARK);
      g.text("警備を呼ぶ(拘束)", a.x + a.w / 2, a.y + 7 + (hov ? 1 : 0), S[8], { align: "center", size: 12 });
    }

    drawDoc(g, d, held) {
      const c = d.render(this.day), { w, h } = d.size();
      const sy = d.slide ? -Math.round(d.slide * 20) : 0;
      if (d.lcd) {
        // データ板は影を落とさず、淡く光る
        const a = d.slide ? 1 - d.slide : 1;
        g.ctx.save(); g.ctx.globalAlpha = a;
        g.rect(d.x - 1, d.y - 1 + sy, w + 2, h + 2, C.glow);
        g.imgSame(c, d.x, d.y + sy);
        g.ctx.restore();
        return;
      }
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

    drawInspect(g) {
      // 照合できる場所だけを明るく残し、ほかを暗くする(暗くする前の絵を写しておき、欄の部分だけ戻す)
      const fs = this.fieldsAt(), ctx = g.ctx;
      if (!this.snap) this.snap = document.createElement("canvas");
      const snap = this.snap;
      if (snap.width !== g.canvas.width) { snap.width = g.canvas.width; snap.height = g.canvas.height; }
      const sctx = snap.getContext("2d");
      sctx.clearRect(0, 0, snap.width, snap.height); sctx.drawImage(g.canvas, 0, 0);
      const restore = (r, pad) => { const x = (r.x - pad) * 2, y = (r.y - pad) * 2, w = (r.w + pad * 2) * 2, h = (r.h + pad * 2) * 2; ctx.drawImage(snap, x, y, w, h, x, y, w, h); };
      g.rect(0, 0, 480, 270, "rgba(5,9,11,.74)");
      // 欄を含む書類や装置は、暗めに残して位置がわかるようにする
      const boxes = [...new Set(fs.map(f => f.box).filter(Boolean))];
      boxes.forEach(b => { restore(b, 0); g.rect(b.x, b.y, b.w, b.h, "rgba(5,9,11,.55)"); });
      // 欄そのものは元の明るさで戻す。枠は描かず、左に小さな印だけ付ける(行が詰まっていても重ならない)
      fs.forEach(f => restore(f, 0));
      // 照合ボタンは明るいまま
      button(g, L.inspect, "照合  F", true, true);
      const hov = this.fieldAt(this.mouse.x, this.mouse.y);
      fs.forEach(f => { if (f !== hov && !(this.sel && this.sel.key === f.key && this.sel.x === f.x)) g.rect(f.x - 2, f.y + Math.floor(f.h / 2) - 1, 1, 2, S[6]); });
      const lit = (r, strong) => { g.rect(r.x, r.y, r.w, r.h, strong ? "rgba(236,239,238,.22)" : "rgba(236,239,238,.14)"); g.frame(r.x - 1, r.y - 1, r.w + 2, r.h + 2, S[8]); };
      if (hov) { if (hov.box) g.frame(hov.box.x - 1, hov.box.y - 1, hov.box.w + 2, hov.box.h + 2, S[4]); lit(hov); }
      if (this.sel) {
        const r = this.sel;
        lit(r, true); g.frame(r.x - 2, r.y - 2, r.w + 4, r.h + 4, S[6]);
        const x0 = r.x + r.w / 2, y0 = r.y + r.h / 2, x1 = this.mouse.x, y1 = this.mouse.y, n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
        for (let i = 0; i <= n; i++) if (i % 2 === 0) g.rect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1, S[8]);
      }
      const tip = hov || this.sel;
      if (tip && tip.label) {
        const t = (this.sel && hov && hov.key !== this.sel.key ? shortLabel(this.sel) + " ⇔ " : "") + tip.label;
        const w = Math.min(300, V.Surface.measure(t, 12) + 8), x = V.clamp(this.mouse.x + 8, 2, 478 - w), y = V.clamp(this.mouse.y + 10, 14, 258);
        g.rect(x, y, w, 9, S[8]); g.text(t, x + 4, y + 1.5, S[0], { size: 12 });
      }
    }
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
