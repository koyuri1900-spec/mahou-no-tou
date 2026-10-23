// VALID — 審査業務(1日分のシフト)
(function () {
  const S = V.S, L = V.L;
  const DAY_MINUTES = 600;          // 08:00〜18:00
  const SEC_PER_MIN = 0.6;          // 実時間 0.6秒 = ゲーム内1分(1日およそ6分)
  const VERB = { approve: "適格", limit: "限定", deny: "不適格", detain: "拘束" };
  const FLAW_TEXT = {
    expired: "IDの期限切れ", status: "INVALID の判定", permit: "作業許可証の不備", genome: "検体と署名の不一致",
    height: "予測身長との不一致", ticketName: "搭乗券の名義違い", ticketDate: "搭乗券の日付違い", seal: "旧版の印章",
    heart: "記録のない心拍の乱れ", hair: "毛根のない毛髪", mass: "申告質量との不一致", xray: "衣服の下の不審物"
  };
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

  class Shift {
    constructor(game) {
      this.game = game;
      const st = game.state;
      this.day = st.day;
      this.today = V.DATES[this.day];
      this.clock = 0;
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
      this.mouse = { x: 0, y: 0 };
      this.msg = null; this.slip = null;
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
      this.say("sys", `DAY ${this.day}  業務開始。【呼出】で最初の申請者を呼ぶ。`);
      V.audio.startHall();
      V.audio.sfx.chime();
    }

    // ---------- 時間 ----------
    update(dt) {
      this.t += dt;
      if (this.fade > 0 && !this.ended) this.fade = Math.max(0, this.fade - dt * 1.5);
      if (!this.ended) this.clock = Math.min(DAY_MINUTES, this.clock + dt / SEC_PER_MIN);
      this.drawerK += ((this.drawer ? 1 : 0) - this.drawerK) * Math.min(1, dt * 14);
      this.queueShift = Math.max(0, this.queueShift - dt * 12);
      this.timers = this.timers.filter(tm => { tm.t -= dt; if (tm.t <= 0) { tm.fn(); return false; } return true; });
      this.flashes = this.flashes.filter(f => (f.t -= dt) > 0);
      if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
      if (this.analyzer.busy > 0) { this.analyzer.busy -= dt; if (this.analyzer.busy <= 0) this.analyzer.busy = 0; }
      if (this.phase === "entering" && (this.phaseT += dt) > 0.9) { this.phase = "present"; this.phaseT = 0; }
      if (this.phase === "leaving" && (this.phaseT += dt) > 0.9) this.finishApplicant();
      if (this.phase === "detained" && (this.phaseT += dt) > 1.6) this.finishApplicant();
      if (this.clock >= DAY_MINUTES && !this.cur && !this.ended) this.endShift();
      if (this.ended) { this.fade = Math.min(1, this.fade + dt * 0.8); if (this.fade >= 1 && !this.done) { this.done = true; V.audio.stopHall(); this.game.toNight(this.summary()); } }
    }

    after(t, fn) { this.timers.push({ t, fn }); }
    say(who, text) { this.talk.push({ who, text }); if (this.talk.length > 30) this.talk.shift(); }
    note(text, t = 2.6) { this.msg = { text, t }; }

    // ---------- 申請者 ----------
    callNext() {
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
      this.xray = false;
      this.analyzer = { seq: null, fresh: 0, busy: 0, owner: null };
      this.loupe = { hair: null, owner: null };
      this.queueN = Math.max(3, this.queueN - 1); this.queueShift = 12;
      V.audio.sfx.click();
      const give = [];
      give.push(V.docs.make("id", A));
      if (A.ticket) give.push(V.docs.make("ticket", A));
      if (A.permit) give.push(V.docs.make("permit", A));
      if (A.med) give.push(V.docs.make("med", A));
      if (A.envelope) give.push(V.docs.make("envelope", A));
      this.after(0.9, () => {
        give.forEach(d => { d.loc = "tray"; this.items.push(d); });
        V.audio.sfx.paper();
        A.greet.forEach(line => this.say("them", line));
      });
    }

    requestSample(kind) {
      const A = this.cur;
      if (!A || this.phase !== "present") return;
      if (kind === "kitBlood") {
        this.say("you", "採血します。指を。");
        V.audio.sfx.lancet();
        this.after(1.4, () => { if (this.cur !== A) return; const v = V.docs.make("vial", A); v.loc = "tray"; this.items.push(v); this.say("them", "(指先を差し出した)"); V.audio.sfx.drop(); });
      } else {
        this.say("you", "毛髪の検体を。");
        this.after(1.4, () => { if (this.cur !== A) return; const h = V.docs.make("hair", A); h.loc = "tray"; this.items.push(h); this.say("them", A.hairSample === "cut" ? "(袋に入った毛髪を出した)" : "(髪を数本抜いて渡した)"); V.audio.sfx.drop(); });
      }
    }

    decide(verdict) {
      const A = this.cur;
      if (!A || this.phase !== "present") { this.note("窓口に申請者がいません。"); return; }
      const id = this.items.find(d => d.kind === "id" && d.owner === A);
      if (verdict === "detain") {
        const ev = V.applicant.flaws(A).filter(f => f.act === "detain" && A.found.has(f.type));
        if (!ev.length) { this.note("拘束するには、偽装の証拠を【照合】で指摘してください。", 3.2); V.audio.sfx.nothing(); return; }
        this.drawer = false;
        this.verdict = "detain";
        this.say("you", "警備、来てくれ。");
        this.say("them", pick(V.LINES.detained));
        V.audio.sfx.alarm();
        this.phase = "detained"; this.phaseT = 0;
        return;
      }
      if (!id || id.loc !== "desk") { this.note("ID を机の上に置いてから判定してください。"); return; }
      if (id.stamp) { this.note("この ID には、もう印が押されています。"); return; }
      id.stamp = verdict; id.dirty = true; id.front();
      this.verdict = verdict;
      this.drawer = false;
      V.audio.sfx.stamp(verdict === "deny");
      this.say("sys", `判定:${VERB[verdict]}。書類を受取口へ返す。`);
    }

    checkLeave() {
      const A = this.cur;
      if (!A || this.phase !== "present" || !this.verdict) return;
      const papers = this.items.filter(d => d.owner === A && ["id", "ticket", "permit", "med"].includes(d.kind));
      if (papers.every(d => d.loc === "tray")) {
        this.phase = "leaving"; this.phaseT = 0;
        const pool = { approve: V.LINES.approved, limit: V.LINES.limited, deny: V.LINES.denied }[this.verdict];
        this.say("them", pick(pool));
        V.audio.sfx.paper();
      }
    }

    finishApplicant() {
      const A = this.cur, verdict = this.verdict;
      // 封筒
      const env = this.items.find(d => d.kind === "envelope" && d.owner === A);
      if (env) {
        if (env.loc === "desk") { this.flags.bribe = true; this.game.state.flags.bribe = true; this.say("sys", "封筒を、引き出しにしまった。"); }
        else this.game.state.flags.envelopeReturned = true;
      }
      this.items = this.items.filter(d => d.owner !== A);
      if (this.analyzer.owner === A) this.analyzer = { seq: null, fresh: 0, busy: 0, owner: null };
      if (this.loupe.owner === A) this.loupe = { hair: null, owner: null };
      this.evaluate(A, verdict);
      if (A.scripted) this.game.state.flags[A.id] = verdict;
      this.cur = null; this.verdict = null; this.phase = "empty"; this.xray = false; this.sel = null;
      if (this.clock >= DAY_MINUTES) this.say("sys", "18:00。受付終了。");
    }

    evaluate(A, verdict) {
      const t = V.applicant.truth(A);
      this.stats.processed++;
      if (verdict === "detain") this.stats.detained++;
      if (t.ok.includes(verdict)) {
        this.stats.correct++;
        let pay = V.PAY_CORRECT;
        if (verdict === "detain") pay += V.PAY_DETAIN_BONUS;
        this.stats.earned += pay;
        return;
      }
      const fl = V.applicant.flaws(A);
      let reason;
      if (verdict === "approve" || verdict === "limit") reason = fl.length ? "見落とし:" + FLAW_TEXT[fl[0].type] : "限定の対象ではない申請者";
      else reason = t.best === "limit" ? "作業許可証のある職員は【限定】で通す" : "正当な申請者を止めた";
      this.stats.citations++;
      const fine = this.stats.citations > V.CITATION_FREE ? V.CITATION_FINE : 0;
      this.stats.earned -= fine;
      this.stats.mistakes.push(reason);
      this.slip = { reason, n: this.stats.citations, fine, t: 6 };
      V.audio.sfx.citation();
    }

    endShift() {
      this.ended = true;
      this.drawer = false; this.inspect = false;
      V.audio.sfx.chime();
    }

    summary() { return { stats: this.stats, flags: this.flags }; }

    // ---------- 照合 ----------
    fieldsAt() {
      const out = [], A = this.cur;
      const add = (key, x, y, w, h, label) => out.push({ key, x, y, w, h, label });
      add("today", 54, 1, 44, 10, "本日 " + this.today);
      this.items.filter(d => d.loc === "desk").sort((a, b) => a.z - b.z).forEach(d => {
        d.render(this.day);
        d.fields.forEach(f => { if (!f.key.startsWith("tab.")) out.push({ key: f.key, x: d.x + f.x, y: d.y + f.y, w: f.w, h: f.h, label: f.label, doc: d }); });
      });
      if (A && this.phase === "present") {
        if (this.xray) add("xray", L.win.x + 40, L.win.y + 30, 76, 70, "X線像");
        else { const top = V.cmToY(A.actualH); add("body.height", L.win.x + 50, Math.round(top) - 3, 56, 8, "頭頂の高さ"); }
        if (this.day >= 2) add("heart", L.heart.x, L.heart.y, L.heart.w, L.heart.h, "心拍");
        if (this.day >= 3) add("scale", L.scale.x, L.scale.y, L.scale.w, L.scale.h, "体重 " + A.massActual.toFixed(1) + "kg");
        if (this.analyzer.seq && this.analyzer.owner === A) add("seq", L.analyzer.x + 4, L.analyzer.y + 14, 98, 14, "解析結果 " + this.analyzer.seq);
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
        if (hit.act === "detain") this.say("sys", "偽装の証拠。【拘束】できる。");
      } else {
        this.flashes.push({ r: a, t: 0.7, c: S[6] }, { r: b, t: 0.7, c: S[6] });
        V.audio.sfx.nothing();
        this.note("矛盾は見つからない。", 1.6);
      }
    }

    // ---------- 入力 ----------
    trayLayout() {
      let x = L.tray.x + 3, y = L.tray.y + 6;
      const out = [];
      this.items.filter(d => d.loc === "tray").sort((a, b) => a.z - b.z).forEach(d => {
        const w = { id: 26, ticket: 24, permit: 22, med: 20, envelope: 16, vial: 6, hair: 12 }[d.kind] || 10;
        if (x + w > L.tray.x + L.tray.w - 2) { x = L.tray.x + 3; y += 15; }
        out.push({ d, x, y, w, h: 17 });
        x += w + 3;
      });
      return out;
    }

    onDown(x, y, button) {
      this.mouse = { x, y };
      if (this.ended) return;
      if (this.slip && inRect(x, y, { x: 236, y: 86, w: 136, h: 46 })) { this.slip = null; return; }
      if (button === 2) { this.toggleInspect(); return; }
      // 判定の引き出し
      if (inRect(x, y, L.drawerTab)) { this.drawer = !this.drawer; V.audio.sfx.drawer(); return; }
      if (this.drawer) {
        const b = this.drawerButtons().find(b => inRect(x, y, b));
        if (b) { this.decide(b.v); return; }
        if (inRect(x, y, this.drawerRect())) return;
      }
      if (inRect(x, y, L.inspect)) { this.toggleInspect(); return; }
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
      if (inRect(x, y, L.kitBlood)) { this.startDrag({ kind: "kitBlood", w: 22, h: 22, x: L.kitBlood.x, y: L.kitBlood.y, kit: true }, x, y); return; }
      if (this.day >= 3 && inRect(x, y, L.kitHair)) { this.startDrag({ kind: "kitHair", w: 22, h: 22, x: L.kitHair.x, y: L.kitHair.y, kit: true }, x, y); return; }
      // 受取口
      const t = this.trayLayout().reverse().find(m => inRect(x, y, m));
      if (t) {
        const d = t.d;
        d.loc = "hand"; d.front(); d.dirty = true;
        d.x = Math.round(x - d.w / 2); d.y = Math.round(y - 8);
        this.drag = { item: d, dx: x - d.x, dy: y - d.y, from: "tray" };
        V.audio.sfx.paper();
        return;
      }
      // 机の上
      const onDesk = this.items.filter(d => (d.loc === "desk" || d.loc === "slot") && d.hit(x, y)).sort((a, b) => b.z - a.z)[0];
      if (onDesk) {
        onDesk.front();
        const from = onDesk.loc;
        onDesk.loc = "hand"; onDesk.dirty = true;
        this.drag = { item: onDesk, dx: x - onDesk.x, dy: y - onDesk.y, from, ox: onDesk.x, oy: onDesk.y };
        V.audio.sfx.paper();
      }
    }
    startDrag(item, x, y) { this.drag = { item, dx: x - item.x, dy: y - item.y, from: "rack" }; V.audio.sfx.click(); }

    onMove(x, y) {
      this.mouse = { x, y };
      if (this.drag) { this.drag.item.x = Math.round(x - this.drag.dx); this.drag.item.y = Math.round(y - this.drag.dy); }
    }

    onUp(x, y) {
      const dg = this.drag; if (!dg) return;
      this.drag = null;
      const it = dg.item;
      const cx = x, cy = y;
      if (it.kit) {
        if (inRect(cx, cy, L.tray)) this.requestSample(it.kind);
        return;
      }
      // 受取口へ
      if (inRect(cx, cy, L.tray) || (cy > L.tray.y - 6 && cx < L.desk.x - 2 && cy > L.talk.y)) {
        if (it.kind === "rules") { this.toSlot(it); return; }
        it.loc = "tray"; it.dirty = true; V.audio.sfx.drop();
        this.checkLeave();
        return;
      }
      // 解析機
      if (it.kind === "vial" && inRect(cx, cy, L.analyzer)) {
        this.items = this.items.filter(d => d !== it);
        this.analyzer = { seq: null, fresh: 0, busy: 1.3, owner: it.owner };
        V.audio.sfx.machine();
        const A = it.owner;
        this.after(1.3, () => { if (this.analyzer.owner === A) { this.analyzer.seq = A.sample; this.analyzer.fresh = A.fresh; } });
        return;
      }
      if (it.kind === "hair" && this.day >= 3 && inRect(cx, cy, L.loupe)) {
        this.items = this.items.filter(d => d !== it);
        this.loupe = { hair: it.owner.hairSample, owner: it.owner };
        V.audio.sfx.drop();
        return;
      }
      if (it.kind === "rules" && inRect(cx, cy, L.bookSlot)) { this.toSlot(it); return; }
      // 机の上に置く
      if (cx >= L.desk.x && cy >= L.desk.y) {
        it.loc = "desk";
        if (it.kind === "rules") it.dirty = true;
        const { w, h } = it.size();
        it.x = V.clamp(it.x, L.desk.x + 1, 480 - w); it.y = V.clamp(it.y, L.desk.y + 1, 270 - h);
        V.audio.sfx.drop();
        return;
      }
      // それ以外は元の場所へ
      if (dg.from === "tray") { it.loc = "tray"; return; }
      if (it.kind === "rules" && dg.from === "slot") { this.toSlot(it); return; }
      it.loc = "desk"; it.x = dg.ox ?? it.x; it.y = dg.oy ?? it.y;
      const { w, h } = it.size();
      it.x = V.clamp(it.x, L.desk.x + 1, 480 - w); it.y = V.clamp(it.y, L.desk.y + 1, 270 - h);
    }
    toSlot(it) { it.loc = "slot"; it.x = L.bookSlot.x; it.y = L.bookSlot.y; it.dirty = true; V.audio.sfx.drop(); }

    onKey(k) {
      if (this.ended) return;
      if (k === "f" || k === "F") this.toggleInspect();
      else if (k === " ") { if (!this.cur) this.callNext(); }
      else if (k === "Escape") { this.inspect = false; this.sel = null; this.drawer = false; }
      else if (k === "d" || k === "D") { this.drawer = !this.drawer; V.audio.sfx.drawer(); }
      else if (this.drawer && "1234".includes(k)) this.decide(["approve", "limit", "deny", "detain"][+k - 1]);
    }
    toggleInspect() { this.inspect = !this.inspect; this.sel = null; V.audio.sfx.click(); this.hintSeen.inspect = true; }

    drawerRect() { const d = L.drawer, off = Math.round((1 - this.drawerK) * (d.h + 2)); return { x: d.x, y: d.y + off, w: d.w, h: d.h }; }
    drawerButtons() {
      const r = this.drawerRect();
      return ["approve", "limit", "deny", "detain"].map((v, i) => ({ v, x: r.x + 6 + i * 52, y: r.y + 8, w: 48, h: 42 }));
    }

    // ---------- 手引き ----------
    hint() {
      const A = this.cur, day = this.day;
      if (this.ended) return "";
      if (day === 1 && this.served === 0) return "【呼出】を押して、最初の申請者を呼んでください。(Space キーでも呼べます)";
      if (A && A.tutorial) {
        const id = this.items.find(d => d.kind === "id" && d.owner === A);
        if (this.phase !== "present") return "";
        if (id && id.loc === "tray" && !id.stamp) return "受取口の書類を、机の上へドラッグしてください。";
        if (!this.analyzer.seq && !this.items.some(d => d.kind === "vial") && this.analyzer.busy <= 0) return "道具棚の【採血キット】を受取口へドラッグすると、採血できます。";
        if (this.items.some(d => d.kind === "vial")) return "血液の管を、右上の解析機へドラッグしてください。";
        if (this.analyzer.seq && !this.hintSeen.inspect) return "【照合】(F キー/右クリック)を押し、IDのゲノム署名と解析結果を順にクリックして比べます。";
        if (!this.verdict) return "照合を終えたら、右下の【判定】を開いて判定を選ぶと、IDに印が押されます。";
        return "書類をすべて受取口へ戻すと、申請者は去ります。";
      }
      if (day === 1 && this.served === 1 && !A) return "規則冊子は机の左下。机の上に置くと開きます。身長は窓の目盛りで読みます。";
      if (day === 2 && this.served === 0) return "新しい規則:搭乗券と心拍。規則冊子の「書類」のページを確認しましょう。";
      if (day === 3 && this.served === 0) return "新しい道具:毛髪キットとルーペ、X線、計量台。規則冊子の「検体」のページを確認しましょう。";
      return "";
    }

    // ---------- 描画 ----------
    draw(g) {
      const A = this.cur;
      g.img(this.bg, 0, 0);
      this.drawHall(g);
      this.drawTop(g);
      this.drawWindow(g);
      this.drawTalk(g);
      this.drawTray(g);
      this.drawSide(g);
      this.drawDeskFixed(g);
      this.items.filter(d => d.loc === "desk" || d.loc === "slot").sort((a, b) => a.z - b.z).forEach(d => this.drawDoc(g, d));
      this.drawDrawer(g);
      if (this.drag) {
        const it = this.drag.item;
        if (it.kit) this.drawKit(g, it.kind, it.x, it.y, true);
        else this.drawDoc(g, it, true);
      }
      if (this.inspect) this.drawInspect(g);
      this.flashes.forEach(f => { if (Math.floor(f.t * 8) % 2 === 0) { g.frame(f.r.x - 1, f.r.y - 1, f.r.w + 2, f.r.h + 2, f.c); g.frame(f.r.x - 2, f.r.y - 2, f.r.w + 4, f.r.h + 4, f.c); } });
      const h = this.hint();
      if (h) { g.rect(0, 72, 480, 12, "rgba(13,20,23,.86)"); g.text(h, 240, 74, S[8], { align: "center" }); }
      if (this.slip) this.drawSlip(g);
      if (this.msg) { const w = V.Surface.measure(this.msg.text) + 16; g.rect(324 - w / 2, 160, w, 14, S[0]); g.frame(324 - w / 2, 160, w, 14, S[5]); g.text(this.msg.text, 324, 163, S[8], { align: "center" }); }
      if (this.fade > 0) g.rect(0, 0, 480, 270, `rgba(13,20,23,${this.fade})`);
      if (this.ended && this.fade > 0.3) g.text("18:00  業務終了", 240, 128, S[8], { align: "center", size: 32 });
    }

    drawTop(g) {
      const m = Math.floor(this.clock), hh = 8 + Math.floor(m / 60), mm = m % 60;
      g.text(`DAY ${this.day}`, 4, 2, S[7]);
      g.text(this.today, 56, 2, S[7]);
      g.text(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, 110, 2, this.clock >= DAY_MINUTES ? V.RED : S[8]);
      g.text(`ELY-${10 + this.day}`, 150, 2, S[6]);
      g.text(`最終便まで ${30 - this.day}日`, 196, 2, S[6]);
      g.text(`処理 ${this.stats.processed}`, 300, 2, S[6]);
      g.text(`違反 ${this.stats.citations}`, 348, 2, this.stats.citations ? V.RED : S[6]);
      g.text(`₡ ${this.game.state.credits + this.stats.earned}`, 476, 2, S[8], { align: "right" });
      if (this.inspect) { g.rect(0, 0, 480, 1, S[8]); }
    }

    drawHall(g) {
      const n = this.queueN, fr = Math.floor(this.t * 3);
      for (let k = 0; k < n; k++) {
        const x = 176 + k * 20 + Math.round(this.queueShift) + (k % 3) * 2;
        if (x > 470) break;
        V.art.queuePerson(g, x, 58, this.day * 100 + this.served + k, this.queueShift > 0 ? fr + k : 0);
      }
      // ゲートの扉の上のランプ
      const busy = !!this.cur;
      g.rect(156, 36, 6, 3, busy ? S[4] : S[8]);
    }

    drawWindow(g) {
      const A = this.cur, w = L.win;
      const ctx = g.ctx; ctx.save(); ctx.beginPath(); ctx.rect(w.x * 2, w.y * 2, w.w * 2, w.h * 2); ctx.clip();
      if (this.xray && A) { g.rect(w.x, w.y, w.w, w.h, S[0]); }
      if (A) {
        let dx = 0;
        if (this.phase === "entering") dx = Math.round((1 - this.phaseT / 0.9) * 90);
        if (this.phase === "leaving") dx = -Math.round((this.phaseT / 0.9) * 90);
        const top = Math.round(V.cmToY(A.actualH));
        const nervous = this.phase === "present" && A.found.size > 0;
        if (!A._bust || A._bustNerv !== nervous) { A._bust = V.art.bust(A, { sweat: nervous }); A._bustNerv = nervous; }
        if (!A._x && this.xray) A._x = V.art.bustX(A);
        const bx = w.x + 46 + dx, breath = this.phase === "present" ? Math.round(Math.sin(this.t * (nervous ? 5 : 2.4)) * 0.6 + 0.4) : 0;
        if (this.xray) g.img(A._x || (A._x = V.art.bustX(A)), bx, top + breath);
        else g.img(A._bust, bx, top + breath);
        if (this.phase === "detained") {
          const k = Math.min(1, this.phaseT / 0.6);
          [[-1, 0], [1, 1]].forEach(([s, i]) => { const gx = w.x + 78 + s * (90 - k * 50) - 12; g.rect(gx, w.y + 14, 24, 86, S[0]); g.rect(gx + 6, w.y + 6, 12, 12, S[0]); g.rect(gx + 4, w.y + 4, 16, 4, S[1]); });
        }
      }
      // 目盛りの数字
      for (let cm = 130; cm <= 200; cm += 10) g.text(String(cm), w.x + 2, Math.round(V.cmToY(cm)) + 1, this.xray && A ? S[4] : S[6]);
      // ガラスの映り込み
      for (let k = 0; k < 26; k++) g.rect(w.x + 118 + k, w.y + 6 + k * 3, 1, 3, "rgba(211,218,220,.10)");
      ctx.restore();
      if (!A && !this.ended) g.text(this.clock >= DAY_MINUTES ? "受付終了" : "― 窓口 空き ―", w.x + w.w / 2, w.y + 44, S[5], { align: "center" });
    }

    drawTalk(g) {
      const b = L.talk, lines = [];
      for (let i = this.talk.length - 1; i >= 0 && lines.length < 4; i--) {
        const m = this.talk[i], col = m.who === "them" ? S[8] : m.who === "you" ? S[6] : S[5];
        const pre = m.who === "you" ? "> " : m.who === "sys" ? "・" : "";
        const ws = V.Surface.wrap(pre + m.text, b.w - 6);
        for (let j = ws.length - 1; j >= 0 && lines.length < 4; j--) lines.unshift({ t: ws[j], c: col });
      }
      lines.forEach((ln, i) => g.text(ln.t, b.x + 3, b.y + 1 + i * 9, ln.c));
    }

    drawTray(g) {
      g.text("受取口", L.tray.x + L.tray.w - 3, L.tray.y + L.tray.h - 10, S[4], { align: "right" });
      this.trayLayout().forEach(m => V.docs.mini(g, m.d, m.x, m.y));
      if (this.drag && !this.drag.item.kit && inRect(this.mouse.x, this.mouse.y, L.tray)) g.frame(L.tray.x, L.tray.y, L.tray.w, L.tray.h, S[7]);
      if (this.drag && this.drag.item.kit) g.frame(L.tray.x, L.tray.y, L.tray.w, L.tray.h, S[6]);
    }

    drawSide(g) {
      const A = this.cur, present = A && this.phase === "present";
      // 心拍
      const h = L.heart;
      if (this.day >= 2 && present) {
        const irr = A.heart === "irregular";
        let prev = h.y + 9;
        for (let x = 0; x < h.w - 2; x++) {
          const ph = (x + this.t * 30) % 19, beat = irr ? ((x + Math.floor(this.t * 30)) % 37 < 19 ? 0 : 4) : 0;
          let y = h.y + 9;
          if (Math.abs(ph - (8 + beat)) < 1) y = h.y + 2; else if (Math.abs(ph - (9 + beat)) < 1) y = h.y + 13;
          g.rect(h.x + 1 + x, Math.min(prev, y), 1, Math.abs(prev - y) + 1, S[7]);
          prev = y;
        }
      } else g.text(this.day >= 2 ? "心拍 --" : "", h.x + 3, h.y + 4, S[4]);
      // 計量台
      const s = L.scale;
      if (this.day >= 3) g.text(present ? A.massActual.toFixed(1) + "kg" : "--.-kg", s.x + s.w - 3, s.y + 3, present ? S[8] : S[4], { align: "right" });
      // 呼出
      const c = L.call, can = !A && !this.ended && this.clock < DAY_MINUTES;
      button(g, c, "呼出", can, can && Math.floor(this.t * 2) % 2 === 0);
      if (this.day >= 3) button(g, L.xbtn, "X線", !!present, this.xray);
    }

    drawDeskFixed(g) {
      // 道具棚
      this.drawKit(g, "kitBlood", L.kitBlood.x, L.kitBlood.y);
      if (this.day >= 3) this.drawKit(g, "kitHair", L.kitHair.x, L.kitHair.y);
      // 解析機
      const a = L.analyzer;
      g.rect(a.x + 1, a.y + 1, a.w, a.h, S[0]); g.rect(a.x, a.y, a.w, a.h, S[4]);
      g.text("遺伝子解析機", a.x + 4, a.y + 2, S[1]);
      g.rect(a.x + 3, a.y + 12, a.w - 6, 30, S[0]);
      if (this.analyzer.busy > 0) {
        const k = 1 - this.analyzer.busy / 1.3;
        g.rect(a.x + 6, a.y + 34, Math.round((a.w - 12) * k), 3, S[6]);
        g.text("解析中…", a.x + 6, a.y + 16, S[6]);
      } else if (this.analyzer.seq) {
        for (let i = 0; i < 16; i++) { const b = this.analyzer.seq[i], x = a.x + 3 + i * 6; g.rect(x, a.y + 15, 5, 9, V.BASE[b]); g.text(b, x + 0.5, a.y + 16, S[0]); }
        g.text(`凝固 +${this.analyzer.fresh.toFixed(1)}s`, a.x + 6, a.y + 30, this.analyzer.fresh > 0.3 ? S[8] : S[6]);
      } else g.text("血液の管をここへ", a.x + a.w / 2, a.y + 22, S[5], { align: "center" });
      g.rect(a.x + 8, a.y + 45, 22, 6, S[2]); g.rect(a.x + 10, a.y + 46, 18, 3, S[0]);
      // ルーペ
      const l = L.loupe;
      g.rect(l.x + 1, l.y + 1, l.w, l.h, S[0]); g.rect(l.x, l.y, l.w, l.h, this.day >= 3 ? S[4] : S[3]);
      if (this.day >= 3) {
        g.rect(l.x + 3, l.y + 3, l.w - 6, l.h - 6, S[0]);
        if (this.loupe.hair) {
          const y = l.y + 20;
          for (let x = l.x + 8; x < l.x + 74; x++) g.rect(x, y + Math.round(Math.sin(x / 7) * 1.5), 1, 2, S[6]);
          if (this.loupe.hair === "root") { g.rect(l.x + 74, y - 3, 8, 8, S[7]); g.rect(l.x + 76, y - 2, 5, 6, S[8]); g.text("毛根", l.x + 86, y - 4, S[6]); }
          else { g.rect(l.x + 74, y - 2, 1, 6, S[6]); g.text("切断面", l.x + 78, y - 4, S[6]); }
        } else g.text("毛髪をここへ", l.x + l.w / 2, l.y + 15, S[5], { align: "center" });
      } else g.text("ルーペ(未支給)", l.x + l.w / 2, l.y + 15, S[2], { align: "center" });
      // 照合ボタン
      button(g, L.inspect, "照合 F", true, this.inspect);
      // 判定の引き出しのつまみ
      button(g, L.drawerTab, this.drawer ? "判定 ▼" : "判定 ▲", !!this.cur, this.drawer);
    }

    drawKit(g, kind, x, y, held) {
      g.rect(x + 1, y + 1, 22, 22, S[0]); g.rect(x, y, 22, 22, held ? S[5] : S[3]);
      if (kind === "kitBlood") { g.rect(x + 9, y + 3, 4, 13, S[7]); g.rect(x + 10, y + 9, 2, 6, V.RED); g.rect(x + 10, y + 16, 2, 4, S[6]); }
      else { g.rect(x + 4, y + 5, 14, 12, S[7]); for (let k = 0; k < 9; k++) g.rect(x + 6 + k, y + 10 + Math.round(Math.sin(k) * 1.5), 1, 1, S[1]); }
    }

    drawDoc(g, d, held) {
      const c = d.render(this.day), { w, h } = d.size();
      if (held && d.kind !== "rules") g.rect(d.x + 3, d.y + 3, w, h, "rgba(13,20,23,.45)");
      else g.rect(d.x + 1, d.y + 1, w, h, "rgba(13,20,23,.6)");
      g.imgSame(c, d.x, d.y);
    }

    drawDrawer(g) {
      if (this.drawerK < 0.02) return;
      const r = this.drawerRect();
      const ctx = g.ctx; ctx.save(); ctx.beginPath(); ctx.rect(r.x * 2, (L.drawer.y - 4) * 2, r.w * 2, (L.drawer.h + 4) * 2); ctx.clip();
      g.rect(r.x, r.y, r.w, r.h, S[1]); g.frame(r.x, r.y, r.w, r.h, S[4]);
      const labels = { approve: ["適格", S[7]], limit: ["限定", S[6]], deny: ["不適格", V.RED], detain: ["拘束", V.RED_DARK] };
      this.drawerButtons().forEach((b, i) => {
        const [t, c] = labels[b.v], hov = inRect(this.mouse.x, this.mouse.y, b);
        g.rect(b.x + 1, b.y + 2, b.w, b.h, S[0]);
        g.rect(b.x, b.y + (hov ? 1 : 0), b.w, b.h - 1, c);
        g.rect(b.x, b.y + (hov ? 1 : 0), b.w, 3, "rgba(255,255,255,.18)");
        g.text(t, b.x + b.w / 2, b.y + 15 + (hov ? 1 : 0), b.v === "approve" || b.v === "limit" ? S[0] : S[8], { align: "center" });
        g.text(String(i + 1), b.x + b.w - 4, b.y + b.h - 11, b.v === "approve" || b.v === "limit" ? S[3] : S[6], { align: "right" });
      });
      ctx.restore();
    }

    drawInspect(g) {
      g.frame(0, 0, 480, 270, S[8]); g.frame(1, 1, 478, 268, S[8]);
      g.rect(206, 241, 52, 12, S[8]); g.text("照合中", 232, 243, S[0], { align: "center" });
      const hov = this.fieldAt(this.mouse.x, this.mouse.y);
      if (this.sel) { const r = this.sel; g.frame(r.x - 1, r.y - 1, r.w + 2, r.h + 2, S[8]); g.frame(r.x - 2, r.y - 2, r.w + 4, r.h + 4, S[8]); }
      if (hov && hov !== this.sel) g.frame(hov.x - 1, hov.y - 1, hov.w + 2, hov.h + 2, S[7]);
      const tip = (hov || this.sel);
      if (tip && tip.label) {
        const t = (this.sel && hov && hov.key !== this.sel.key ? shortLabel(this.sel) + " ⇔ " : "") + tip.label;
        const w = Math.min(300, V.Surface.measure(t) + 10), x = V.clamp(this.mouse.x + 8, 2, 478 - w), y = V.clamp(this.mouse.y + 12, 14, 254);
        g.rect(x, y, w, 12, S[0]); g.frame(x, y, w, 12, S[6]); g.text(t, x + 5, y + 2, S[8]);
      }
    }

    drawSlip(g) {
      const s = this.slip, x = 236, y = 86;
      g.rect(x + 2, y + 2, 136, 46, "rgba(13,20,23,.6)");
      g.rect(x, y, 136, 46, S[8]); g.rect(x, y, 136, 11, V.RED);
      g.text("違反通知", x + 4, y + 1, S[8]);
      g.text(`${s.n}件目`, x + 132, y + 1, S[8], { align: "right" });
      g.para(s.reason, x + 4, y + 14, 128, S[0]);
      g.text(s.fine ? `罰金 ₡${s.fine}` : `警告(${V.CITATION_FREE}件までは罰金なし)`, x + 4, y + 34, S[3]);
    }
  }

  function button(g, r, label, enabled, lit) {
    g.rect(r.x + 1, r.y + 1, r.w, r.h, S[0]);
    g.rect(r.x, r.y, r.w, r.h, lit ? S[7] : enabled ? S[4] : S[2]);
    g.rect(r.x, r.y, r.w, 1, lit ? S[8] : enabled ? S[5] : S[3]);
    g.text(label, r.x + r.w / 2, r.y + (r.h - 8) / 2, lit ? S[0] : enabled ? S[8] : S[4], { align: "center" });
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shortLabel(f) { return (f.label || f.key).split(" ")[0]; }

  V.Shift = Shift;
  V.SHIFT_CONST = { DAY_MINUTES, SEC_PER_MIN, VERB, FLAW_TEXT };
})();
