// VALID — 机の上の書類と検体
// 書類はそれぞれ自分の canvas(2倍解像度)に描いてキャッシュし、照合で選べる「欄」を持つ。
(function () {
  const S = V.S;
  let zTop = 1;

  class Doc {
    constructor(kind, owner, w, h) {
      this.kind = kind; this.owner = owner; this.w = w; this.h = h;
      this.x = 0; this.y = 0; this.loc = "tray"; this.z = zTop++;
      this.stamp = null; this.page = 0; this.fields = []; this.canvas = null; this.dirty = true;
    }
    front() { this.z = zTop++; }
    get open() { return this.kind === "rules" ? this.loc !== "slot" : true; }
    size() {
      if (this.kind === "rules" && this.loc === "slot") return { w: 34, h: 21 };
      return { w: this.w, h: this.h };
    }
    render(day) {
      if (!this.dirty && this.canvas) return this.canvas;
      const { w, h } = this.size();
      const g = V.gfx.hi(w, h);
      this.fields = [];
      DRAW[this.kind](g, this, day);
      this.canvas = g.canvas; this.dirty = false; this.renderedDay = day;
      return this.canvas;
    }
    field(key, x, y, w, h, label) { this.fields.push({ key, x, y, w, h, label }); }
    hit(px, py) { const { w, h } = this.size(); return px >= this.x && py >= this.y && px < this.x + w && py < this.y + h; }
  }

  // 文字は小さめ(12px = 6ドット)、行の間隔は7ドット。欄の枠は行と重ならない高さにする
  const F = { size: 12 }, LH = 7;
  const tx = (g, str, x, y, c, opt = {}) => g.text(str, x, y, c, Object.assign({ size: 12 }, opt));
  const fieldText = (g, d, key, str, x, y, c, label) => { const w = tx(g, str, x, y, c); d.field(key, x - 1, y, Math.ceil(w) + 2, LH, label); return w; };
  const row = (g, d, key, label, value, x, y, vx, color, lc) => {
    tx(g, label, x, y, lc || S[4]);
    const vw = tx(g, value, vx, y, color || S[0]);
    d.field(key, x - 1, y, Math.ceil(vx - x + vw) + 2, LH, label + " " + value);
  };
  // 液晶のデータ板:机の面に浮かぶ、淡く光る枠
  const C = V.LCD;
  const LCD_KINDS = ["reg", "ticket", "permit", "med", "xfilm"];
  function lcdBase(g, d, title, right) {
    g.rect(0, 0, d.w, d.h, C.panel);
    g.frame(0, 0, d.w, d.h, C.line);
    g.rect(1, 1, d.w - 2, 7, C.line);
    tx(g, title, 2, 1, C.hi);
    if (right) tx(g, right, d.w - 2, 1, C.text, { align: "right" });
  }
  const lrow = (g, d, key, label, value, x, y, vx, color) => row(g, d, key, label, value, x, y, vx, color || C.hi, C.dim);

  const DRAW = {
    // IDカード(物):表に印字されているのは顔写真と頭文字つきの氏名、番号、チップだけ。中身は登録簿にある
    id(g, d) {
      const A = d.owner, U = V.applicant;
      g.rect(0, 0, d.w, d.h, S[7]);
      g.frame(0, 0, d.w, d.h, S[5]);
      g.rect(0, 0, d.w, 7, S[3]);
      tx(g, "ゲノムID", 2, 0.5, S[8]);
      g.img(V.art.photo(A, U.cardLook(A), 14, 19, 0.55), 2, 9, 14, 19);
      g.frame(1, 8, 16, 21, S[5]);
      d.field("card.photo", 0, 7, 18, 23, "カードの顔写真");
      const nm = U.cardName(A);
      fieldText(g, d, "card.name", nm, 19, 9, S[0], "印字 " + nm);
      // チップと、判定で灯る小さなランプ
      g.rect(19, 17, 9, 7, V.GOLD); g.frame(19, 17, 9, 7, S[3]); g.rect(19, 20, 9, 1, S[3]); g.rect(23, 17, 1, 7, S[3]);
      const led = { approve: S[8], limit: S[6], deny: V.RED }[d.stamp] || S[4];
      g.rect(30, 18, 4, 4, S[2]); g.rect(31, 19, 2, 2, led);
      if (d.stamp) tx(g, { approve: "適格", limit: "限定", deny: "不適格" }[d.stamp], 36, 17, d.stamp === "deny" ? V.RED : S[2]);
      tx(g, A.idNo, 19, 25, S[4]);
    },
    // 登録簿(データ):カードを端末に置くと机に出る。試作版では、ここに書かれていることは正しい
    reg(g, d) {
      const A = d.owner, U = V.applicant, look = U.regLook(A);
      lcdBase(g, d, "登録簿", A.idNo);
      g.img(V.art.photo(A, look, 16, 21, 0.62), 2, 10, 16, 21);
      g.frame(1, 9, 18, 23, C.text);
      d.field("reg.photo", 0, 8, 20, 25, "登録簿の顔写真");
      if (A.hand) tx(g, A.hand + "手", 3, 34, C.dim);
      const x = 22, vx = 36;
      fieldText(g, d, "reg.name", A.regLatin, x, 10, C.hi, "氏名 " + A.regLatin);
      fieldText(g, d, "reg.class", A.role, x, 17, C.hi, "区分 " + A.role);
      fieldText(g, d, "reg.status", A.status, x + 34, 17, A.status === "VALID" ? C.hi : C.text, "判定 " + A.status);
      lrow(g, d, "reg.height", "身長", `${A.predH[0]}-${A.predH[1]}cm`, x, 24, vx);
      tx(g, "瞳", x, 31, C.dim);
      g.rect(vx, 31, 5, 5, V.IRIS[look.eyeP]); g.frame(vx - 1, 30, 7, 7, C.line);
      tx(g, U.eyeWord(look.eyeP), vx + 8, 31, C.hi);
      d.field("reg.eye", x - 1, 31, 30, LH, "瞳の色 " + U.eyeWord(look.eyeP));
      lrow(g, d, "reg.expiry", "期限", A.expiry, x, 38, vx);
      lrow(g, d, "reg.issued", "発行", A.issued, x, 45, vx);
    },
    ticket(g, d) {
      const T = d.owner.ticket;
      lcdBase(g, d, "搭乗券", T.flight);
      fieldText(g, d, "ticket.name", T.name, 3, 10, C.hi, "氏名 " + T.name);
      lrow(g, d, "ticket.date", "日付", T.date, 3, 17, 17);
      lrow(g, d, "ticket.mass", "質量", T.mass.toFixed(1) + "kg", 3, 24, 17);
      tx(g, T.cls, 3, 31, C.dim);
      V.art.seal(g, d.w - 9, d.h - 9, T.seal, C.text, 7);
      d.field("ticket.seal", d.w - 17, d.h - 17, 16, 16, "印章 " + T.seal);
    },
    permit(g, d) {
      const P = d.owner.permit;
      lcdBase(g, d, "作業許可証");
      fieldText(g, d, "permit.name", P.name, 3, 10, C.hi, "氏名 " + P.name);
      lrow(g, d, "permit.zone", "区画", P.zone, 3, 17, 17);
      lrow(g, d, "permit.expiry", "期限", P.expiry, 3, 24, 17);
    },
    med(g, d) {
      const M = d.owner.med;
      lcdBase(g, d, "医療記録");
      fieldText(g, d, "med.name", M.name, 3, 10, C.hi, "氏名 " + M.name);
      tx(g, "既往", 3, 17, C.dim);
      const n = g.para(M.cond, 3, 24, d.w - 6, C.hi, { size: 12, lh: LH });
      d.field("med.cond", 2, 17, d.w - 4, LH + n * LH, "既往 " + M.cond);
    },
    envelope(g, d) {
      g.rect(0, 0, d.w, d.h, S[5]);
      for (let x = 0; x < d.w / 2; x++) { g.rect(x, Math.round(x * 0.5), 1, 1, S[4]); g.rect(d.w - 1 - x, Math.round(x * 0.5), 1, 1, S[4]); }
      g.frame(0, 0, d.w, d.h, S[4]);
      tx(g, "忘れ物", d.w / 2, d.h - 8, S[1], { align: "center" });
    },
    // X線写真(全身)
    xfilm(g, d) {
      lcdBase(g, d, "X線", d.owner.latin.split(" ")[1] || "");
      g.rect(2, 9, d.w - 4, d.h - 11, S[0]);
      const img = V.art.xrayBody(d.owner, d.h - 13);
      g.img(img, Math.round(d.w / 2 - img.width / 2), 10);
      d.field("xray", 2, 9, d.w - 4, d.h - 11, "X線写真");
    },
    citation(g, d) {
      const c = d.cite;
      g.rect(0, 0, d.w, d.h, S[8]);
      g.rect(0, 0, d.w, 8, V.RED);
      tx(g, "違反切符", 2, 1, S[8]);
      tx(g, `No.${c.n} ${c.time}`, d.w - 2, 1, S[8], { align: "right" });
      tx(g, c.who + " / " + c.verdict, 2, 10, S[0]);
      g.rect(2, 18, d.w - 4, 1, S[5]);
      let y = 20;
      c.lines.forEach(t => { y += g.para(t, 2, y, d.w - 4, S[0], { size: 12, lh: LH }) * LH; });
      if (c.rule) { y += 1; y += g.para("規則:" + c.rule, 2, y, d.w - 4, S[3], { size: 12, lh: LH }) * LH; }
      g.rect(2, d.h - 9, d.w - 4, 1, S[5]);
      tx(g, c.fine ? `罰金 ₡${c.fine}` : `警告(1日${V.CITATION_FREE}件まで罰金なし)`, 2, d.h - 8, c.fine ? V.RED : S[3]);
    },
    rules(g, d, day) {
      if (d.loc === "slot") {
        const { w, h } = d.size();
        g.rect(0, 0, w, h, S[1]); g.frame(0, 0, w, h, S[4]);
        g.rect(0, 3, w, 1, S[3]); g.rect(0, h - 4, w, 1, S[3]);
        g.text("規則冊子", w / 2, 7, S[7], { align: "center" });
        return;
      }
      // 見開き:左右2ページ。上に分類の見出し(押すとその分類のページへ飛ぶ)、ページ番号、左右の中央にめくる矢印
      const M = 8, T = 9, PW = (d.w - M * 2 - 2) / 2, pages = rulePages(day, PW);
      d.spreads = Math.ceil(pages.length / 2);
      d.page = V.clamp(d.page, 0, d.spreads - 1);
      g.rect(0, 0, d.w, d.h, S[1]);
      let hx = M + 2;
      V.RULE_CATS.forEach(cat => {
        const start = pages.catStart[cat];
        if (start === undefined) return;
        const tw = V.Surface.measure(cat, 12) + 6, here = Math.floor(start / 2) === d.page;
        g.rect(hx, 1, tw, T - 1, here ? S[7] : S[4]);
        tx(g, cat, hx + tw / 2, 1.5, here ? S[0] : S[8], { align: "center" });
        d.field("tab.go." + start, hx, 0, tw, T, "");
        hx += tw + 2;
      });
      [0, 1].forEach(side => {
        const px = M + side * (PW + 2), idx = d.page * 2 + side;
        g.rect(px, T + 1, PW, d.h - T - 3, S[7]);
        g.rect(side ? px : px + PW - 2, T + 1, 2, d.h - T - 3, S[6]);
        if (!pages[idx]) return;
        let y = T + 3;
        pages[idx].forEach(e => {
          const r = e.rule, fresh = r.day === day && day > 1;
          if (e.head) { tx(g, "― " + r.cat + " ―", px + PW / 2, y, S[4], { align: "center" }); y += 8; }
          g.rect(px + 2, y + 2, 2, 2, fresh ? S[0] : S[4]);
          e.lines.forEach((ln, i) => tx(g, ln, px + 6, y + i * LH, fresh ? S[0] : S[2]));
          d.field(r.key, px + 1, y, PW - 2, e.lines.length * LH + (e.seal ? 16 : 0), r.text);
          y += e.lines.length * LH;
          if (e.seal) { V.art.seal(g, px + 12, y + 8, V.SEAL_CURRENT, null, 7); tx(g, "現行", px + 22, y + 5, S[3]); y += 16; }
          y += 2;
        });
        tx(g, String(idx + 1), px + PW / 2, d.h - 8, S[4], { align: "center" });
      });
      g.rect(d.w / 2 - 1, T + 1, 2, d.h - T - 3, S[1]);
      const my = Math.round(T + (d.h - T) / 2 - 6);
      if (d.page > 0) { g.rect(1, my, 6, 12, S[5]); tx(g, "◀", 4, my + 3, S[0], { align: "center" }); d.field("tab.prev", 0, my - 6, M, 24, ""); }
      if (d.page < d.spreads - 1) { g.rect(d.w - 7, my, 6, 12, S[5]); tx(g, "▶", d.w - 4, my + 3, S[0], { align: "center" }); d.field("tab.next", d.w - M, my - 6, M, 24, ""); }
    }
  };

  // 分類ごとに新しいページから始める(分類の中では、今日の新しい規則が先)
  function rulePages(day, w) {
    const pages = [], H = 70;
    pages.catStart = {};
    V.RULE_CATS.forEach(cat => {
      const list = V.RULES.filter(r => r.day <= day && r.cat === cat).sort((a, b) => (b.day === day) - (a.day === day));
      if (!list.length) return;
      if (!pages.length || pages[pages.length - 1].length) pages.push([]);
      pages.catStart[cat] = pages.length - 1;
      let used = 8;
      list.forEach((r, i) => {
        const lines = V.Surface.wrap(r.text, w - 8, 12), seal = r.key === "rule.seal";
        const h = lines.length * LH + 2 + (seal ? 16 : 0);
        if (used + h > H && pages[pages.length - 1].length) { pages.push([]); used = 0; }
        pages[pages.length - 1].push({ rule: r, lines, seal, head: i === 0 });
        used += h;
      });
    });
    return pages;
  }

  // 受取口の中に置くときの小さな姿
  const MINI = { id: [24, 15], envelope: [16, 10] };
  function mini(g, d, x, y) {
    const look = {
      id: [24, 15, S[7], S[3]], envelope: [16, 10, S[5], S[4]]
    }[d.kind];
    if (!look) return { w: 0, h: 0 };
    const [w, h, bg, ac] = look;
    g.rect(x + 1, y + 1, w, h, S[0]);
    g.rect(x, y, w, h, bg);
    g.rect(x, y, w, 3, ac);
    if (d.kind === "id") { g.rect(x + 2, y + 5, 6, 8, S[5]); g.rect(x + 10, y + 8, 4, 3, V.GOLD); if (d.stamp) g.rect(x + 16, y + 9, 2, 2, { approve: S[8], limit: S[6], deny: V.RED }[d.stamp]); }
    return { w, h };
  }

  const SIZES = { id: [56, 32], reg: [88, 53], ticket: [66, 38], permit: [64, 32], med: [62, 40], envelope: [34, 20], xfilm: [48, 96], rules: [176, 96], citation: [100, 60] };
  function make(kind, owner) { const [w, h] = SIZES[kind]; const d = new Doc(kind, owner, w, h); d.lcd = LCD_KINDS.includes(kind); return d; }

  V.docs = { Doc, make, mini, MINI, rulePages };
})();
