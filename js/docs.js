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

  const row = (g, d, key, label, value, x, y, vx, w, color, lc) => {
    g.text(label, x, y, lc || S[4]);
    const vw = g.text(value, vx, y, color || S[0]);
    d.field(key, x - 1, y - 1, Math.ceil(vx - x + vw) + 2, 10, label + " " + value);
  };
  // 液晶のデータ板:机の面に浮かぶ、淡く光る枠
  const C = V.LCD;
  const LCD_KINDS = ["reg", "ticket", "permit", "med", "xfilm"];
  function lcdBase(g, d, title, right) {
    g.rect(0, 0, d.w, d.h, C.panel);
    g.frame(0, 0, d.w, d.h, C.line);
    g.rect(1, 1, d.w - 2, 9, C.line);
    g.text(title, 3, 1, C.hi);
    if (right) g.text(right, d.w - 3, 1, C.text, { align: "right" });
  }
  const lrow = (g, d, key, label, value, x, y, vx, color) => row(g, d, key, label, value, x, y, vx, 0, color || C.hi, C.dim);

  const DRAW = {
    // IDカード(物):表に印字されているのは顔写真と頭文字つきの氏名、番号、チップだけ。中身は登録簿にある
    id(g, d) {
      const A = d.owner, U = V.applicant;
      g.rect(0, 0, d.w, d.h, S[7]);
      g.frame(0, 0, d.w, d.h, S[5]);
      g.rect(0, 0, d.w, 9, S[3]);
      g.text("ゲノムID", 3, 0, S[8]);
      g.img(V.art.photo(A, U.cardLook(A)), 3, 12, 20, 26);
      g.frame(2, 11, 22, 28, S[5]);
      d.field("card.photo", 1, 10, 24, 30, "カードの顔写真");
      const nm = U.cardName(A);
      d.field("card.name", 26, 11, Math.ceil(g.text(nm, 27, 12, S[0])) + 2, 10, "印字 " + nm);
      // チップと、判定で灯る小さなランプ
      g.rect(27, 23, 13, 10, V.GOLD); g.frame(27, 23, 13, 10, S[3]);
      g.rect(27, 27, 13, 1, S[3]); g.rect(33, 23, 1, 10, S[3]);
      const led = { approve: S[8], limit: S[6], deny: V.RED }[d.stamp] || S[4];
      g.rect(44, 25, 4, 4, S[2]); g.rect(45, 26, 2, 2, led);
      if (d.stamp) g.text({ approve: "適格", limit: "限定", deny: "不適格" }[d.stamp], 50, 24, d.stamp === "deny" ? V.RED : S[2]);
      g.text(A.idNo, 27, 33, S[4]);
    },
    // 登録簿(データ):カードを端末に差すと机に出る。試作版では、ここに書かれていることは正しい
    reg(g, d) {
      const A = d.owner, U = V.applicant, look = U.regLook(A);
      lcdBase(g, d, "登録簿", A.idNo);
      g.img(V.art.photo(A, look), 4, 13, 20, 26);
      g.frame(3, 12, 22, 28, C.text);
      d.field("reg.photo", 2, 11, 24, 30, "登録簿の顔写真");
      if (A.hand) g.text(A.hand + "手", 4, 42, C.dim);
      d.field("reg.name", 27, 12, Math.ceil(g.text(A.regLatin, 28, 13, C.hi)) + 2, 10, "氏名 " + A.regLatin);
      g.text(A.role, 28, 22, C.hi); d.field("reg.class", 27, 21, V.Surface.measure(A.role) + 2, 10, "区分 " + A.role);
      d.field("reg.status", 70, 21, Math.ceil(g.text(A.status, 71, 22, A.status === "VALID" ? C.hi : C.text)) + 2, 10, "判定 " + A.status);
      lrow(g, d, "reg.height", "身長", `${A.predH[0]}-${A.predH[1]}cm`, 28, 31, 46);
      g.text("瞳", 28, 40, C.dim);
      g.rect(46, 41, 6, 6, V.IRIS[look.eyeP]); g.frame(45, 40, 8, 8, C.line);
      g.text(U.eyeWord(look.eyeP), 56, 40, C.hi);
      d.field("reg.eye", 27, 39, 40, 10, "瞳の色 " + U.eyeWord(look.eyeP));
      lrow(g, d, "reg.expiry", "期限", A.expiry, 28, 49, 46);
      lrow(g, d, "reg.issued", "発行", A.issued, 28, 58, 46);
    },
    ticket(g, d) {
      const T = d.owner.ticket;
      lcdBase(g, d, "搭乗券", T.flight);
      g.text(T.name, 4, 12, C.hi); d.field("ticket.name", 3, 11, d.w - 6, 10, "氏名 " + T.name);
      lrow(g, d, "ticket.date", "日付", T.date, 4, 22, 22);
      lrow(g, d, "ticket.mass", "質量", T.mass.toFixed(1) + "kg", 4, 31, 22);
      g.text(T.cls, 4, 40, C.dim);
      V.art.seal(g, d.w - 11, d.h - 11, T.seal, C.text);
      d.field("ticket.seal", d.w - 21, d.h - 21, 20, 20, "印章 " + T.seal);
    },
    permit(g, d) {
      const P = d.owner.permit;
      lcdBase(g, d, "作業許可証");
      g.text(P.name, 4, 12, C.hi); d.field("permit.name", 3, 11, d.w - 6, 10, "氏名 " + P.name);
      lrow(g, d, "permit.zone", "区画", P.zone, 4, 21, 22);
      lrow(g, d, "permit.expiry", "期限", P.expiry, 4, 30, 22);
    },
    med(g, d) {
      const M = d.owner.med;
      lcdBase(g, d, "医療記録");
      g.text(M.name, 4, 12, C.hi); d.field("med.name", 3, 11, d.w - 6, 10, "氏名 " + M.name);
      g.text("既往", 4, 21, C.dim);
      const n = g.para(M.cond, 4, 30, d.w - 8, C.hi, { lh: 9 });
      d.field("med.cond", 3, 20, d.w - 6, 11 + n * 9, "既往 " + M.cond);
    },
    envelope(g, d) {
      g.rect(0, 0, d.w, d.h, S[5]);
      for (let x = 0; x < d.w / 2; x++) { g.rect(x, Math.round(x * 0.5), 1, 1, S[4]); g.rect(d.w - 1 - x, Math.round(x * 0.5), 1, 1, S[4]); }
      g.frame(0, 0, d.w, d.h, S[4]);
      g.text("忘れ物", d.w / 2, d.h - 10, S[1], { align: "center" });
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
      lcdBase(g, d, "X線", d.owner.latin.split(" ")[1] || "");
      g.rect(2, 10, d.w - 4, d.h - 12, S[0]);
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
      // 見開き:左右2ページ。ページ番号と、左右の中央にめくる矢印
      const M = 9, PW = (d.w - M * 2 - 2) / 2, pages = rulePages(day, PW);
      d.spreads = Math.ceil(pages.length / 2);
      d.page = V.clamp(d.page, 0, d.spreads - 1);
      g.rect(0, 0, d.w, d.h, S[1]);
      [0, 1].forEach(side => {
        const px = M + side * (PW + 2), idx = d.page * 2 + side;
        g.rect(px, 3, PW, d.h - 6, S[7]);
        g.rect(side ? px : px + PW - 2, 3, 2, d.h - 6, S[6]);
        if (!pages[idx]) return;
        let y = 6;
        pages[idx].forEach(e => {
          const r = e.rule, fresh = r.day === day && day > 1;
          g.rect(px + 3, y + 3, 2, 2, fresh ? S[0] : S[4]);
          e.lines.forEach((ln, i) => g.text(ln, px + 7, y + i * 9, fresh ? S[0] : S[2]));
          d.field(r.key, px + 1, y - 1, PW - 2, e.lines.length * 9 + 1 + (e.seal ? 22 : 0), r.text);
          y += e.lines.length * 9;
          if (e.seal) { V.art.seal(g, px + 16, y + 10, V.SEAL_CURRENT); g.text("現行", px + 28, y + 6, S[3]); y += 22; }
          y += 3;
        });
        g.text(String(idx + 1), px + PW / 2, d.h - 13, S[4], { align: "center" });
      });
      g.rect(d.w / 2 - 1, 3, 2, d.h - 6, S[1]);
      const my = Math.round(d.h / 2 - 8);
      if (d.page > 0) { g.rect(1, my, 7, 16, S[5]); g.text("◀", 4.5, my + 4, S[0], { align: "center" }); d.field("tab.prev", 0, my - 6, M, 28, ""); }
      if (d.page < d.spreads - 1) { g.rect(d.w - 8, my, 7, 16, S[5]); g.text("▶", d.w - 4.5, my + 4, S[0], { align: "center" }); d.field("tab.next", d.w - M, my - 6, M, 28, ""); }
    }
  };

  // 規則をページに詰める(新しい規則が先頭のページに来る)
  function rulePages(day, w) {
    const list = V.RULES.filter(r => r.day <= day).sort((a, b) => (b.day === day) - (a.day === day));
    const pages = [[]], H = 84;
    let used = 0;
    list.forEach(r => {
      const lines = V.Surface.wrap(r.text, w - 10), seal = r.key === "rule.seal";
      const h = lines.length * 9 + 3 + (seal ? 22 : 0);
      if (used + h > H && pages[pages.length - 1].length) { pages.push([]); used = 0; }
      pages[pages.length - 1].push({ rule: r, lines, seal });
      used += h;
    });
    return pages;
  }

  // 受取口の中に置くときの小さな姿
  const MINI = { id: [24, 15], envelope: [16, 10], hairCard: [14, 10] };
  function mini(g, d, x, y) {
    const look = {
      id: [24, 15, S[7], S[3]], envelope: [16, 10, S[5], S[4]], hairCard: [14, 10, S[8], S[1]]
    }[d.kind];
    if (!look) return { w: 0, h: 0 };
    const [w, h, bg, ac] = look;
    g.rect(x + 1, y + 1, w, h, S[0]);
    g.rect(x, y, w, h, bg);
    if (d.kind === "hairCard") g.rect(x + 2, y + 5, 10, 1, ac);
    else g.rect(x, y, w, 3, ac);
    if (d.kind === "id") { g.rect(x + 2, y + 5, 6, 8, S[5]); g.rect(x + 10, y + 8, 4, 3, V.GOLD); if (d.stamp) g.rect(x + 16, y + 9, 2, 2, { approve: S[8], limit: S[6], deny: V.RED }[d.stamp]); }
    return { w, h };
  }

  const SIZES = { id: [76, 42], reg: [118, 68], ticket: [86, 50], permit: [82, 40], med: [74, 50], envelope: [46, 26], hairCard: [44, 30], xfilm: [54, 70], rules: [206, 104], citation: [120, 80] };
  function make(kind, owner) { const [w, h] = SIZES[kind]; const d = new Doc(kind, owner, w, h); d.lcd = LCD_KINDS.includes(kind); return d; }

  V.docs = { Doc, make, mini, MINI, rulePages };
})();
