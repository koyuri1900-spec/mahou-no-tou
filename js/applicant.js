// VALID — 申請者の生成と、欠点(矛盾)の判定
(function () {
  const BASES = "ACGT";

  // ---- 日付 ----
  const toNum = d => { const [y, m, dd] = d.split(".").map(Number); return Date.UTC(y, m - 1, dd) / 86400000; };
  const fromNum = n => { const d = new Date(n * 86400000); return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`; };
  const addDays = (d, k) => fromNum(toNum(d) + k);
  V.date = { toNum, fromNum, addDays };

  function randSeq(r) { let s = ""; for (let i = 0; i < 16; i++) s += BASES[r.int(0, 3)]; return s; }
  function mutate(seq, positions, r) {
    const a = seq.split("");
    positions.forEach(p => { const others = BASES.replace(a[p], ""); a[p] = others[r.int(0, 2)]; });
    return a.join("");
  }
  function typo(latin, r) { // 名前の1文字違い
    const a = latin.split(""), idx = [];
    a.forEach((c, i) => { if (/[A-Z]/.test(c)) idx.push(i); });
    const i = r.pick(idx.slice(1));
    const swaps = { A: "E", E: "A", I: "Y", O: "U", U: "O", N: "M", M: "N", R: "L", L: "R", K: "C", C: "K", S: "Z", T: "D", D: "T", W: "V", V: "W", H: "N", Y: "I", B: "P", P: "B", G: "J", F: "P", Z: "S", J: "G" };
    a[i] = swaps[a[i]] || "X";
    return a.join("");
  }

  // 見た目(遺伝子型から)
  function makeLook(r, sex, role) {
    const eye = [r.pick(["B", "B", "G", "b", "b"]), r.pick(["B", "G", "b", "b"])];
    const eyeP = eye.includes("B") ? "B" : eye.includes("G") ? "G" : "b";
    const hairG = [r.pick(["D", "D", "d"]), r.pick(["D", "d", "d"])];
    const dark = hairG.includes("D");
    const coatByRole = { "乗客": r.pick([V.S[3], V.S[4], V.S[5], V.S[2]]), "乗員": V.S[6], "地上職員": V.S[3] };
    return {
      eye, eyeP, hairG,
      hair: dark ? r.pick([V.S[0], V.S[1], V.S[2]]) : r.pick([V.S[5], V.S[6]]),
      skin: r.int(0, 3),
      style: sex === "女" ? r.pick([1, 3, 3, 0]) : r.pick([0, 0, 1, 2, 4]),
      face: r(),
      coat: coatByRole[role] || V.S[4],
      beard: sex === "男" && r.chance(0.2)
    };
  }

  // ---- 申請者を作る ----
  // spec は data.js の物語の申請者、または null(名もなき申請者)。flaw は名もなき申請者に仕込む欠点。
  function create(day, seed, spec, flaw) {
    spec = spec || {};
    const r = V.rng(spec.seed || seed);
    const today = V.DATES[day];
    const sex = spec.sex || r.pick(["男", "女"]);
    const role = spec.role || r.pick(["乗客", "乗客", "乗客", "乗客", "乗客", "乗員", "地上職員", "地上職員"]);
    const first = spec.first || r.pick(V.NAMES.first);
    const lastPair = spec.last ? [spec.last, ""] : r.pick(V.NAMES.last), last = lastPair[0];
    const latin = spec.latin || `${V.LATIN[first]} ${lastPair[1]}`;
    const status = spec.status || (role === "地上職員" ? r.pick(["VALID", "INVALID", "INVALID"]) : "VALID");
    const look = makeLook(r, sex, role);
    const center = spec.predH ? (spec.predH[0] + spec.predH[1]) / 2 : (sex === "女" ? r.int(158, 172) : r.int(168, 186));
    const predH = spec.predH || [center - 3, center + 3];
    const genome = randSeq(r);
    const A = {
      day, seed, id: spec.id || "p" + seed, scripted: !!spec.id,
      first, last, name: `${first}・${last}`, latin, sex, role, status,
      dob: `${r.int(2041, 2069)}.${String(r.int(1, 12)).padStart(2, "0")}.${String(r.int(1, 28)).padStart(2, "0")}`,
      idNo: `GX-${r.int(1000, 9999)}-${r.int(1000, 9999)}`,
      expiry: spec.expiry || addDays(today, r.int(40, 900)),
      predH, actualH: spec.actualH || r.int(predH[0], predH[1]),
      genome, sample: spec.sampleMut ? mutate(genome, spec.sampleMut, r) : genome,
      fresh: spec.fresh || 0,
      hand: spec.hand || null,
      look,
      ticket: null, permit: null, med: null, envelope: !!spec.envelope,
      heart: spec.heart || "normal",
      hairSample: spec.hair || "root",
      massActual: 0,
      xray: spec.xray || null,
      greet: spec.greet || [r.pick(V.LINES.greet[role])],
      replies: spec.replies || {},
      tutorial: !!spec.tutorial,
      found: new Set()
    };
    // 書類
    const needTicket = day >= 2 && role !== "地上職員";
    if (needTicket || spec.ticket) {
      const declared = Math.round(r.int(480, 950)) / 10;
      A.ticket = Object.assign({ name: latin, date: today, flight: `ELY-${10 + day}`, mass: declared, seal: V.SEAL_CURRENT, cls: role }, spec.ticket || {});
      A.massActual = Math.round((declared + (spec.massDiff ?? (r() * 0.6 - 0.3))) * 10) / 10;
    } else {
      A.massActual = Math.round(r.int(480, 950)) / 10;
    }
    if (role === "地上職員" && status === "INVALID") {
      A.permit = Object.assign({ name: latin, zone: r.pick(["整備区画", "燃料区画", "清掃区画", "搬入口"]), expiry: addDays(today, r.int(5, 120)) }, spec.permit || {});
    }
    if (spec.med) A.med = Object.assign({ name: latin, cond: "不整脈" }, spec.med);
    if (flaw) applyFlaw(A, flaw, r, today);
    return A;
  }

  // 名もなき申請者に欠点を1つ仕込む
  function applyFlaw(A, flaw, r, today) {
    switch (flaw) {
      case "expired": A.expiry = addDays(today, -r.int(1, 90)); break;
      case "status": if (A.role === "地上職員") A.permit = null; A.status = "INVALID"; break;
      case "permit": A.role = "地上職員"; A.status = "INVALID"; A.ticket = null; A.look.coat = V.S[3];
        A.permit = { name: A.latin, zone: "整備区画", expiry: addDays(today, -r.int(1, 30)) }; break;
      case "genome": { const n = r.int(1, 3), pos = []; while (pos.length < n) { const p = r.int(0, 15); if (!pos.includes(p)) pos.push(p); } A.sample = mutate(A.genome, pos, r); break; }
      case "height": A.actualH = r.chance(0.6) ? A.predH[1] + r.int(4, 9) : A.predH[0] - r.int(5, 9); break;
      case "ticketName": if (A.ticket) A.ticket.name = typo(A.latin, r); break;
      case "ticketDate": if (A.ticket) A.ticket.date = addDays(today, r.pick([-2, -1, 1, 3])); break;
      case "seal": if (A.ticket) A.ticket.seal = V.SEAL_OLD; break;
      case "heart": A.heart = "irregular"; A.med = null; break;
      case "hair": A.hairSample = "cut"; break;
      case "mass": if (A.ticket) A.massActual = Math.round((A.ticket.mass + r.int(8, 25) / 10) * 10) / 10; break;
      case "xray": A.xray = "pouch"; if (A.ticket) A.massActual = Math.round((A.ticket.mass + r.int(1, 3) / 10) * 10) / 10; break;
    }
    A.planted = flaw;
  }

  // ---- 欠点の一覧 ----
  // a と b は照合で選ぶ2つの欄。act は正しい判定(deny=不適格、detain=拘束)。
  function flaws(A) {
    const day = A.day, today = V.DATES[day], checks = V.dayChecks(day), out = [];
    const add = (type, a, b, act) => out.push({ type, a, b, act });
    const passenger = A.role !== "地上職員";
    if (toNum(A.expiry) < toNum(today)) add("expired", "id.expiry", "today", "deny");
    if (passenger && A.status === "INVALID") add("status", "id.status", "rule.status", "deny");
    if (!passenger && A.status === "INVALID") {
      if (!A.permit) add("status", "id.status", "rule.staff", "deny");
      else {
        if (toNum(A.permit.expiry) < toNum(today)) add("permit", "permit.expiry", "today", "deny");
        if (A.permit.name !== A.latin) add("permit", "permit.name", "id.name", "deny");
      }
    }
    if (A.sample !== A.genome) add("genome", "id.genome", "seq", "detain");
    if (A.actualH > A.predH[1] || A.actualH < A.predH[0]) add("height", "id.height", "body.height", "detain");
    if (checks.includes("ticket") && A.ticket) {
      if (A.ticket.name !== A.latin) add("ticketName", "ticket.name", "id.name", "deny");
      if (A.ticket.date !== today) add("ticketDate", "ticket.date", "today", "deny");
    }
    if (checks.includes("seal") && A.ticket && A.ticket.seal !== V.SEAL_CURRENT) add("seal", "ticket.seal", "rule.seal", "deny");
    if (checks.includes("heart") && A.heart === "irregular" && !(A.med && A.med.name === A.latin)) add("heart", "heart", "rule.heart", "deny");
    if (checks.includes("hair") && A.hairSample === "cut") add("hair", "hair", "rule.hair", "detain");
    if (checks.includes("mass") && A.ticket && Math.abs(A.massActual - A.ticket.mass) > 0.5) add("mass", "ticket.mass", "scale", "detain");
    if (checks.includes("xray") && A.xray) add("xray", "xray", "rule.xray", "detain");
    return out;
  }

  // 正しい判定。detain が正解のときは deny も許す(拘束は報奨つき)
  function truth(A) {
    const f = flaws(A);
    if (f.some(x => x.act === "detain")) return { best: "detain", ok: ["detain", "deny"] };
    if (f.length) return { best: "deny", ok: ["deny"] };
    if (A.role === "地上職員" && A.status === "INVALID") return { best: "limit", ok: ["limit"] };
    return { best: "approve", ok: ["approve"] };
  }

  // 2つの欄の組み合わせが欠点に当たるか
  function match(A, k1, k2) {
    return flaws(A).find(f => (f.a === k1 && f.b === k2) || (f.a === k2 && f.b === k1)) || null;
  }

  function reply(A, type, r) {
    if (A.replies[type]) return A.replies[type];
    const pool = V.LINES.flaw[type] || V.LINES.noFlaw;
    return pool[Math.floor((r ? r() : Math.random()) * pool.length)];
  }

  // その日の名もなき申請者に仕込む欠点の候補(新しい規則ほど出やすい)
  function flawPool(day) {
    const p = ["expired", "status", "permit", "genome", "height", "genome", "height"];
    if (day >= 2) p.push("ticketName", "ticketDate", "seal", "seal", "heart", "heart");
    if (day >= 3) p.push("hair", "hair", "mass", "xray", "xray");
    return p;
  }

  V.applicant = { create, flaws, truth, match, reply, flawPool };
})();
