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
      if (this.kind === "rules" && this.loc === "slot") return { w: 30, h: 36 };
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

  const row = (g, d, key, label, value, x, y, vx, w, color) => {
    g.text(label, x, y, S[4]);
    g.text(value, vx, y, color || S[0]);
    d.field(key, x - 1, y - 1, w, 10, label + " " + value);
  };

  const DRAW = {
    id(g, d) {
      const A = d.owner;
      g.rect(0, 0, d.w, d.h, S[7]);
      g.frame(0, 0, d.w, d.h, S[5]);
      g.rect(0, 0, d.w, 10, S[3]);
      g.text("ゲノムID", 3, 1, S[8]);
      g.text(A.idNo, d.w - 3, 1, S[6], { align: "right" });
      g.img(V.art.photo(A), 4, 13, 24, 30);
      g.frame(3, 12, 26, 32, S[5]);
      g.text(A.latin, 32, 12, S[0]); d.field("id.name", 31, 11, 64, 10, "氏名 " + A.latin);
      row(g, d, "id.class", "区分", A.role, 32, 21, 50, 46);
      row(g, d, "id.status", "判定", A.status, 32, 30, 50, 46);
      row(g, d, "id.height", "身長", `${A.predH[0]}-${A.predH[1]}cm`, 32, 39, 50, 52);
      row(g, d, "id.expiry", "期限", A.expiry, 32, 48, 50, 62);
      if (A.hand) g.text("利き手 " + A.hand, 121, 48, S[3], { align: "right" });
      // 判定印の枠
      g.text("判定印", 108, 12, S[5], { align: "center" });
      for (let k = 0; k < 27; k += 2) { g.px(95 + k, 21, S[5]); g.px(95 + k, 44, S[5]); }
      for (let k = 0; k < 23; k += 2) { g.px(95, 21 + k, S[5]); g.px(121, 21 + k, S[5]); }
      // ゲノム署名(16塩基)
      for (let k = 0; k < 16; k++) {
        const b = A.genome[k], x = 14 + k * 6;
        g.rect(x, 59, 5, 9, V.BASE[b]);
        g.text(b, x + 0.5, 60, S[0]);
      }
      d.field("id.genome", 13, 58, 98, 11, "ゲノム署名 " + A.genome);
      if (d.stamp) stampMark(g, d.stamp, 96, 22, 25, 22);
    },
    ticket(g, d) {
      const T = d.owner.ticket;
      g.rect(0, 0, d.w, d.h, S[6]);
      g.rect(0, 0, 14, d.h, S[5]);
      for (let y = 2; y < d.h; y += 4) g.rect(14, y, 1, 2, S[4]);
      g.text("搭乗", 2, 4, S[1]); g.text("券", 4, 14, S[1]);
      g.text("BOARDING / " + T.flight, 18, 2, S[2]);
      g.rect(18, 11, d.w - 22, 1, S[4]);
      g.text(T.name, 18, 14, S[0]); d.field("ticket.name", 17, 13, d.w - 20, 10, "氏名 " + T.name);
      row(g, d, "ticket.date", "日付", T.date, 18, 24, 36, 58);
      row(g, d, "ticket.mass", "質量", T.mass.toFixed(1) + "kg", 18, 34, 36, 46);
      g.text("区分 " + T.cls, 18, 44, S[3]);
      V.art.seal(g, d.w - 13, d.h - 14, T.seal);
      d.field("ticket.seal", d.w - 24, d.h - 25, 22, 22, "印章 " + T.seal);
    },
    permit(g, d) {
      const P = d.owner.permit;
      g.rect(0, 0, d.w, d.h, S[7]);
      g.frame(0, 0, d.w, d.h, S[4]);
      g.rect(0, 0, d.w, 10, S[5]);
      g.text("作業許可証", 3, 1, S[0]);
      g.text(P.name, 4, 13, S[0]); d.field("permit.name", 3, 12, d.w - 6, 10, "氏名 " + P.name);
      row(g, d, "permit.zone", "区画", P.zone, 4, 24, 22, 60);
      row(g, d, "permit.expiry", "期限", P.expiry, 4, 34, 22, 64);
      g.text("港湾局 地上業務課", 4, 44, S[4]);
    },
    med(g, d) {
      const M = d.owner.med;
      g.rect(0, 0, d.w, d.h, S[8]);
      g.frame(0, 0, d.w, d.h, S[5]);
      g.text("医療記録", 3, 2, S[2]);
      g.rect(3, 11, d.w - 6, 1, S[5]);
      g.text(M.name, 4, 14, S[0]); d.field("med.name", 3, 13, d.w - 6, 10, "氏名 " + M.name);
      g.text("既往", 4, 25, S[4]);
      const n = g.para(M.cond, 4, 34, d.w - 8, S[0]);
      d.field("med.cond", 3, 24, d.w - 6, 12 + n * 10, "既往 " + M.cond);
      for (let x = 40; x < 76; x++) g.rect(x, 56 + Math.round(Math.sin(x / 3) * 2), 1, 1, S[3]);
    },
    envelope(g, d) {
      g.rect(0, 0, d.w, d.h, S[5]);
      for (let x = 0; x < d.w / 2; x++) { g.rect(x, Math.round(x * 0.5), 1, 1, S[4]); g.rect(d.w - 1 - x, Math.round(x * 0.5), 1, 1, S[4]); }
      g.frame(0, 0, d.w, d.h, S[4]);
      g.text("忘れ物", d.w / 2, d.h - 12, S[1], { align: "center" });
    },
    vial(g, d) {
      g.rect(1, 0, 6, 4, S[4]);
      g.rect(1, 4, 6, 17, S[7]);
      g.rect(2, 9, 4, 11, V.RED);
      g.rect(2, 9, 1, 11, "#E8705E");
      g.rect(1, 21, 6, 1, S[5]);
    },
    hair(g, d) {
      g.rect(0, 2, d.w, d.h - 2, S[7]);
      g.rect(0, 2, d.w, 2, S[5]);
      g.frame(0, 2, d.w, d.h - 2, S[5]);
      for (let k = 0; k < 12; k++) g.rect(4 + k, 9 + Math.round(Math.sin(k / 2) * 2), 1, 1, S[1]);
    },
    citation(g, d) {
      const c = d.cite;
      g.rect(0, 0, d.w, d.h, S[8]);
      g.rect(0, 0, d.w, 11, V.RED);
      g.text("違反切符", 4, 1, S[8]);
      g.text(`No.${c.n}  ${c.time}`, d.w - 4, 1, S[8], { align: "right" });
      g.text("申請者 " + c.who, 4, 14, S[0]);
      g.text("あなたの判定 " + c.verdict, 4, 24, S[2]);
      g.rect(4, 34, d.w - 8, 1, S[5]);
      let y = 37;
      c.lines.forEach(t => { y += g.para(t, 4, y, d.w - 8, S[0]) * 10; });
      if (c.rule) { y += 2; y += g.para("規則:" + c.rule, 4, y, d.w - 8, S[3]) * 10; }
      g.rect(4, d.h - 13, d.w - 8, 1, S[5]);
      g.text(c.fine ? `罰金 ₡${c.fine}(給与から差し引く)` : `警告(1日${V.CITATION_FREE}件まで罰金なし)`, 4, d.h - 11, c.fine ? V.RED : S[3]);
    },
    rules(g, d, day) {
      if (d.loc === "slot") {
        g.rect(0, 0, 30, 36, S[1]); g.frame(0, 0, 30, 36, S[4]);
        g.rect(3, 0, 2, 36, S[3]);
        g.text("規則", 15, 13, S[7], { align: "center" });
        return;
      }
      g.rect(0, 0, d.w, d.h, S[1]);
      g.rect(3, 12, d.w - 6, d.h - 15, S[7]);
      const pages = V.RULE_PAGES.filter((_, i) => V.RULES.some(r => r.page === i && r.day <= day));
      pages.forEach((p, i) => {
        const tx = 3 + i * 34, on = i === d.page;
        g.rect(tx, 2, 32, 10, on ? S[7] : S[3]);
        g.text(p, tx + 16, 3, on ? S[0] : S[6], { align: "center" });
        d.field("tab." + i, tx, 2, 32, 10, "");
      });
      let y = 16;
      V.RULES.filter(r => r.page === d.page && r.day <= day).forEach(r => {
        const lines = V.Surface.wrap(r.text, d.w - 16);
        g.rect(6, y + 3, 2, 2, S[3]);
        lines.forEach((ln, i) => g.text(ln, 11, y + i * 9, r.day === day && day > 1 ? S[0] : S[2]));
        d.field(r.key, 4, y - 1, d.w - 8, lines.length * 9 + 1, r.text);
        y += lines.length * 9 + 3;
        if (r.key === "rule.seal") {
          V.art.seal(g, 24, y + 10, V.SEAL_CURRENT);
          g.text("現行の印章(目盛り16)", 38, y + 6, S[3]);
          d.fields[d.fields.length - 1].h += 23;
          y += 24;
        }
      });
    }
  };

  function stampMark(g, verdict, x, y, w, h) {
    const map = { approve: ["適格", S[3]], limit: ["限定", S[3]], deny: ["不適格", V.RED] };
    const [t, c] = map[verdict] || ["?", S[3]];
    g.frame(x, y, w, h, c); g.frame(x + 1, y + 1, w - 2, h - 2, c);
    g.text(t, x + w / 2, y + h / 2 - 4, c, { align: "center" });
  }

  // 受取口の中に置くときの小さな姿
  const MINI = { id: [26, 17], ticket: [24, 14], permit: [22, 14], med: [20, 16], envelope: [16, 10], vial: [6, 12], hair: [12, 10] };
  function mini(g, d, x, y) {
    const look = {
      id: [26, 17, S[7], S[3]], ticket: [24, 14, S[6], S[5]], permit: [22, 14, S[7], S[5]], med: [20, 16, S[8], S[5]],
      envelope: [16, 10, S[5], S[4]], vial: [6, 12, S[7], V.RED], hair: [12, 10, S[7], S[1]]
    }[d.kind];
    if (!look) return { w: 0, h: 0 };
    const [w, h, bg, ac] = look;
    g.rect(x + 1, y + 1, w, h, S[0]);
    g.rect(x, y, w, h, bg);
    if (d.kind === "vial") g.rect(x + 1, y + 4, 4, 7, ac);
    else if (d.kind === "hair") g.rect(x + 2, y + 5, 8, 1, ac);
    else g.rect(x, y, w, 3, ac);
    if (d.kind === "id" && d.stamp) g.rect(x + 14, y + 6, 8, 5, d.stamp === "deny" ? V.RED : S[3]);
    return { w, h };
  }

  const SIZES = { id: [124, 70], ticket: [96, 56], permit: [88, 54], med: [84, 64], envelope: [56, 34], vial: [8, 22], hair: [20, 18], rules: [154, 150], citation: [130, 96] };
  function make(kind, owner) { const [w, h] = SIZES[kind]; return new Doc(kind, owner, w, h); }

  V.docs = { Doc, make, mini, stampMark, MINI };
})();
