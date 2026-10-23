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

  const row = (g, d, key, label, value, x, y, vx, w, color) => {
    g.text(label, x, y, S[4]);
    const vw = g.text(value, vx, y, color || S[0]);
    d.field(key, x - 1, y - 1, Math.ceil(vx - x + vw) + 2, 10, label + " " + value);
  };

  const DRAW = {
    id(g, d) {
      const A = d.owner;
      g.rect(0, 0, d.w, d.h, S[7]);
      g.frame(0, 0, d.w, d.h, S[5]);
      g.rect(0, 0, d.w, 9, S[3]);
      g.text("ゲノムID", 3, 0, S[8]);
      g.text(A.idNo, d.w - 3, 0, S[6], { align: "right" });
      g.img(V.art.photo(A), 3, 11, 20, 26);
      g.frame(2, 10, 22, 28, S[5]);
      if (A.hand) g.text(A.hand + "手", 4, 40, S[3]);
      d.field("id.name", 26, 10, Math.ceil(g.text(A.latin, 27, 11, S[0])) + 2, 10, "氏名 " + A.latin);
      g.text(A.role, 27, 20, S[0]); d.field("id.class", 26, 19, V.Surface.measure(A.role) + 2, 10, "区分 " + A.role);
      d.field("id.status", 62, 19, Math.ceil(g.text(A.status, 63, 20, S[0])) + 2, 10, "判定 " + A.status);
      row(g, d, "id.height", "身長", `${A.predH[0]}-${A.predH[1]}cm`, 27, 29, 45, 56);
      row(g, d, "id.expiry", "期限", A.expiry, 27, 38, 45, 60);
      row(g, d, "id.issued", "発行", A.issued, 27, 47, 45, 60);
      // 判定印の枠(縦)
      for (let k = 0; k < 16; k += 2) { g.px(90 + k, 20, S[5]); g.px(90 + k, 52, S[5]); }
      for (let k = 0; k < 32; k += 2) { g.px(90, 20 + k, S[5]); g.px(105, 20 + k, S[5]); }
      g.text("印", 98, 11, S[5], { align: "center" });
      // ゲノム署名(16塩基)
      for (let k = 0; k < 16; k++) {
        const b = A.genome[k], x = 6 + k * 6;
        g.rect(x, 56, 5, 9, V.BASE[b]);
        g.text(b, x + 0.5, 57, S[0]);
      }
      d.field("id.genome", 5, 55, 98, 11, "ゲノム署名 " + A.genome);
      if (d.stamp) stampMark(g, d.stamp, 90, 20, 16, 33);
    },
    ticket(g, d) {
      const T = d.owner.ticket;
      g.rect(0, 0, d.w, d.h, S[6]);
      g.rect(0, 0, 10, d.h, S[5]);
      for (let y = 2; y < d.h; y += 4) g.rect(10, y, 1, 2, S[4]);
      g.text("搭", 1, 6, S[1]); g.text("乗", 1, 16, S[1]); g.text("券", 1, 26, S[1]);
      g.text(T.name, 13, 2, S[0]); d.field("ticket.name", 12, 1, d.w - 14, 10, "氏名 " + T.name);
      row(g, d, "ticket.date", "日付", T.date, 13, 12, 30, 58);
      row(g, d, "ticket.mass", "質量", T.mass.toFixed(1) + "kg", 13, 21, 30, 46);
      g.text(T.cls + " " + T.flight, 13, 30, S[3]);
      V.art.seal(g, d.w - 11, d.h - 11, T.seal);
      d.field("ticket.seal", d.w - 21, d.h - 21, 20, 20, "印章 " + T.seal);
    },
    permit(g, d) {
      const P = d.owner.permit;
      g.rect(0, 0, d.w, d.h, S[7]);
      g.frame(0, 0, d.w, d.h, S[4]);
      g.rect(0, 0, d.w, 9, S[5]);
      g.text("作業許可証", 3, 0, S[0]);
      g.text(P.name, 4, 11, S[0]); d.field("permit.name", 3, 10, d.w - 6, 10, "氏名 " + P.name);
      row(g, d, "permit.zone", "区画", P.zone, 4, 20, 22, 54);
      row(g, d, "permit.expiry", "期限", P.expiry, 4, 29, 22, 64);
    },
    med(g, d) {
      const M = d.owner.med;
      g.rect(0, 0, d.w, d.h, S[8]);
      g.frame(0, 0, d.w, d.h, S[5]);
      g.text("医療記録", 3, 1, S[2]);
      g.rect(3, 10, d.w - 6, 1, S[5]);
      g.text(M.name, 4, 12, S[0]); d.field("med.name", 3, 11, d.w - 6, 10, "氏名 " + M.name);
      g.text("既往", 4, 21, S[4]);
      const n = g.para(M.cond, 4, 30, d.w - 8, S[0], { lh: 9 });
      d.field("med.cond", 3, 20, d.w - 6, 11 + n * 9, "既往 " + M.cond);
    },
    envelope(g, d) {
      g.rect(0, 0, d.w, d.h, S[5]);
      for (let x = 0; x < d.w / 2; x++) { g.rect(x, Math.round(x * 0.5), 1, 1, S[4]); g.rect(d.w - 1 - x, Math.round(x * 0.5), 1, 1, S[4]); }
      g.frame(0, 0, d.w, d.h, S[4]);
      g.text("忘れ物", d.w / 2, d.h - 10, S[1], { align: "center" });
    },
    vial(g, d) {
      g.rect(1, 0, 6, 4, S[4]);
      g.rect(1, 4, 6, 17, S[7]);
      g.rect(2, 9, 4, 11, V.RED);
      g.rect(2, 9, 1, 11, "#E8705E");
      g.rect(1, 21, 6, 1, S[5]);
    },
    // 毛髪台紙:1倍では毛根の有無がほとんど見えない。ルーペで拡大して確かめる
    hairCard(g, d) {
      const A = d.owner;
      g.rect(0, 0, d.w, d.h, S[8]);
      g.frame(0, 0, d.w, d.h, S[5]);
      g.text("毛髪台紙", 3, 1, S[3]);
      g.rect(4, 15, d.w - 8, 9, S[7]);
      for (let k = 0; k < 28; k++) g.rect(7 + k, 19 + Math.round(Math.sin(k / 3) * 0.6), 1, 1, S[1]);
      if (A.hairSample === "root") { g.rect(35, 18, 2, 2, S[3]); g.rect(36, 18.5, 1, 1, S[5]); }
      else g.rect(35, 18.5, 0.5, 2, S[1]);
      g.text(A.latin.split(" ")[1] || "", d.w - 3, d.h - 9, S[4], { align: "right" });
      d.field("hair", 3, 13, d.w - 6, 13, "毛髪の端(ルーペで拡大)");
    },
    xfilm(g, d) {
      g.rect(0, 0, d.w, d.h, S[0]);
      g.frame(0, 0, d.w, d.h, S[3]);
      g.text("X線", 3, 1, S[5]);
      g.text((d.owner.latin.split(" ")[1] || ""), d.w - 3, 1, S[4], { align: "right" });
      const img = V.art.bustX(d.owner, 0.55);
      g.img(img, Math.round(d.w / 2 - img.width / 2), 11, img.width, Math.min(img.height, d.h - 13));
      d.field("xray", 2, 10, d.w - 4, d.h - 12, "X線写真");
    },
    citation(g, d) {
      const c = d.cite;
      g.rect(0, 0, d.w, d.h, S[8]);
      g.rect(0, 0, d.w, 10, V.RED);
      g.text("違反切符", 3, 0, S[8]);
      g.text(`No.${c.n} ${c.time}`, d.w - 3, 0, S[8], { align: "right" });
      g.text(c.who + " / " + c.verdict, 3, 12, S[0]);
      g.rect(3, 21, d.w - 6, 1, S[5]);
      let y = 23;
      c.lines.forEach(t => { y += g.para(t, 3, y, d.w - 6, S[0], { lh: 9 }) * 9; });
      if (c.rule) { y += 1; y += g.para("規則:" + c.rule, 3, y, d.w - 6, S[3], { lh: 9 }) * 9; }
      g.rect(3, d.h - 11, d.w - 6, 1, S[5]);
      g.text(c.fine ? `罰金 ₡${c.fine}` : `警告(1日${V.CITATION_FREE}件まで罰金なし)`, 3, d.h - 10, c.fine ? V.RED : S[3]);
    },
    rules(g, d, day) {
      if (d.loc === "slot") {
        const { w, h } = d.size();
        g.rect(0, 0, w, h, S[1]); g.frame(0, 0, w, h, S[4]);
        g.rect(0, 3, w, 1, S[3]); g.rect(0, h - 4, w, 1, S[3]);
        g.text("規則冊子", w / 2, 7, S[7], { align: "center" });
        return;
      }
      const pages = rulePages(day, d.w);
      d.page = V.clamp(d.page, 0, pages.length - 1);
      g.rect(0, 0, d.w, d.h, S[1]);
      g.rect(2, 2, d.w - 4, d.h - 14, S[7]);
      let y = 5;
      pages[d.page].forEach(e => {
        const r = e.rule, fresh = r.day === day && day > 1;
        g.rect(5, y + 3, 2, 2, fresh ? S[0] : S[4]);
        e.lines.forEach((ln, i) => g.text(ln, 9, y + i * 9, fresh ? S[0] : S[2]));
        d.field(r.key, 3, y - 1, d.w - 6, e.lines.length * 9 + 1 + (e.seal ? 22 : 0), r.text);
        y += e.lines.length * 9;
        if (e.seal) { V.art.seal(g, 20, y + 10, V.SEAL_CURRENT); g.text("現行(目盛り16)", 32, y + 6, S[3]); y += 22; }
        y += 3;
      });
      // ページ送り
      const fy = d.h - 11;
      g.text(`${d.page + 1} / ${pages.length}`, d.w / 2, fy + 1, S[6], { align: "center" });
      if (d.page > 0) { g.rect(3, fy, 16, 10, S[3]); g.text("◀", 11, fy + 1, S[8], { align: "center" }); d.field("tab.prev", 3, fy, 16, 10, ""); }
      if (d.page < pages.length - 1) { g.rect(d.w - 19, fy, 16, 10, S[3]); g.text("▶", d.w - 11, fy + 1, S[8], { align: "center" }); d.field("tab.next", d.w - 19, fy, 16, 10, ""); }
    }
  };

  // 規則をページに詰める(新しい規則が先頭のページに来る)
  function rulePages(day, w) {
    const list = V.RULES.filter(r => r.day <= day).sort((a, b) => (b.day === day) - (a.day === day));
    const pages = [[]], H = 80;
    let used = 0;
    list.forEach(r => {
      const lines = V.Surface.wrap(r.text, w - 14), seal = r.key === "rule.seal";
      const h = lines.length * 9 + 3 + (seal ? 22 : 0);
      if (used + h > H && pages[pages.length - 1].length) { pages.push([]); used = 0; }
      pages[pages.length - 1].push({ rule: r, lines, seal });
      used += h;
    });
    return pages;
  }

  // 判定印(縦書き)
  function stampMark(g, verdict, x, y, w, h) {
    const map = { approve: ["適格", S[3]], limit: ["限定", S[3]], deny: ["不適格", V.RED] };
    const [t, c] = map[verdict] || ["?", S[3]];
    g.frame(x, y, w, h, c); g.frame(x + 1, y + 1, w - 2, h - 2, c);
    const chars = [...t], y0 = y + h / 2 - chars.length * 4.5;
    chars.forEach((ch, i) => g.text(ch, x + w / 2, y0 + i * 9, c, { align: "center" }));
  }

  // 受取口の中に置くときの小さな姿
  const MINI = { id: [26, 17], ticket: [24, 14], permit: [22, 14], med: [20, 16], envelope: [16, 10], vial: [6, 12], hairCard: [14, 10], xfilm: [14, 17] };
  function mini(g, d, x, y) {
    const look = {
      id: [26, 17, S[7], S[3]], ticket: [24, 14, S[6], S[5]], permit: [22, 14, S[7], S[5]], med: [20, 16, S[8], S[5]],
      envelope: [16, 10, S[5], S[4]], vial: [6, 12, S[7], V.RED], hairCard: [14, 10, S[8], S[1]], xfilm: [14, 17, S[0], S[6]]
    }[d.kind];
    if (!look) return { w: 0, h: 0 };
    const [w, h, bg, ac] = look;
    g.rect(x + 1, y + 1, w, h, S[0]);
    g.rect(x, y, w, h, bg);
    if (d.kind === "vial") g.rect(x + 1, y + 4, 4, 7, ac);
    else if (d.kind === "hairCard") g.rect(x + 2, y + 5, 10, 1, ac);
    else if (d.kind === "xfilm") { g.frame(x, y, w, h, S[3]); g.rect(x + 5, y + 3, 4, 4, ac); g.rect(x + 6, y + 7, 2, 8, ac); }
    else g.rect(x, y, w, 3, ac);
    if (d.kind === "id" && d.stamp) g.rect(x + 14, y + 6, 8, 5, d.stamp === "deny" ? V.RED : S[3]);
    return { w, h };
  }

  const SIZES = { id: [108, 66], ticket: [84, 46], permit: [78, 40], med: [72, 50], envelope: [46, 26], vial: [8, 22], hairCard: [44, 30], xfilm: [54, 70], rules: [120, 100], citation: [120, 80] };
  function make(kind, owner) { const [w, h] = SIZES[kind]; return new Doc(kind, owner, w, h); }

  V.docs = { Doc, make, mini, stampMark, MINI, rulePages };
})();
