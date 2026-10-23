// 判定ロジックのテスト(ブラウザなしで動く部分だけを読み込む)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { window: {}, Math, Date, String, Number, Object, Array, Set, JSON };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["palette.js", "data.js", "applicant.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), ctx);
const V = ctx.V;
const make = (day, id, flags = {}) => {
  const spec = V.SCRIPTED[day].find(s => s.id === id);
  return V.applicant.create(day, 1, spec, null);
};

test("物語の申請者の正しい判定", () => {
  const expect = { 1: { rina: "approve", tam: "deny", walter: "limit", kai: "detain" }, 2: { mira: "deny", plum: "approve", hallow: "approve", broker: "approve" }, 3: { nora: "approve", sol: "detain", hallow2: "approve" } };
  for (const day of [1, 2, 3]) for (const [id, best] of Object.entries(expect[day])) {
    assert.strictEqual(V.applicant.truth(make(day, id)).best, best, `${day}日目 ${id}`);
  }
});

test("カイの欠点は身長と遺伝子の2つ", () => {
  const types = [...V.applicant.flaws(make(1, "kai")).map(f => f.type)].sort().join(",");
  assert.strictEqual(types, "genome,height");
});

test("ソルの欠点は毛髪とX線", () => {
  const types = [...V.applicant.flaws(make(3, "sol")).map(f => f.type)].sort().join(",");
  assert.strictEqual(types, "hair,xray");
});

test("採血の対象者:乗員と、ID発行から30日以内の者", () => {
  assert.strictEqual(make(1, "rina").target, true);
  assert.strictEqual(make(1, "kai").target, true);
  assert.strictEqual(make(1, "tam").target, false);
  assert.strictEqual(make(2, "hallow").target, true);
  assert.strictEqual(make(2, "mira").target, false);
});

test("遺伝子の不一致は、採血の対象者にだけ仕込まれる", () => {
  for (const day of [1, 2, 3]) for (let seed = 1; seed < 300; seed++) {
    const A = V.applicant.create(day, seed, null, "genome");
    assert.ok(A.target, `${day}日目 seed ${seed}`);
  }
});

test("3日目:対象者は毛髪台紙を出し、台紙がなければ不適格", () => {
  for (let seed = 1; seed < 200; seed++) {
    const A = V.applicant.create(3, seed, null, null);
    assert.strictEqual(A.hairCard, A.target);
    const B = V.applicant.create(3, seed, null, "hairMissing");
    if (B.role !== "地上職員") { assert.strictEqual(B.hairCard, false); assert.strictEqual(V.applicant.truth(B).best, "deny"); }
  }
});

test("体重が違うだけの申請者は、X線に何も写らず適格", () => {
  for (let seed = 1; seed < 200; seed++) {
    const A = V.applicant.create(3, seed, null, "mass");
    if (!A.ticket) continue;
    assert.ok(Math.abs(A.massActual - A.ticket.mass) > 0.5);
    assert.strictEqual(A.xray, null);
  }
});

test("照合の組み合わせは順不同", () => {
  const A = make(1, "kai");
  assert.ok(V.applicant.match(A, "id.genome", "seq"));
  assert.ok(V.applicant.match(A, "seq", "id.genome"));
  assert.ok(V.applicant.match(A, "body.height", "id.height"));
  assert.strictEqual(V.applicant.match(A, "id.name", "today"), null);
});

test("名もなき申請者:仕込んだ欠点が必ず判定に現れる", () => {
  for (const day of [1, 2, 3]) {
    for (let seed = 1; seed < 400; seed++) {
      const r = V.rng(seed);
      const flaw = r.pick(V.applicant.flawPool(day));
      const A = V.applicant.create(day, seed, null, flaw);
      const f = V.applicant.flaws(A);
      const noTicket = ["ticketName", "ticketDate", "seal", "xray"].includes(flaw) && !A.ticket;
      const staffSkip = ["hair", "hairMissing"].includes(flaw) && A.role === "地上職員";
      if (noTicket || staffSkip || flaw === "mass") continue; // mass は体重が違うだけで、偽装ではない
      assert.ok(f.length > 0, `${day}日目 seed ${seed} 欠点 ${flaw} が判定に出ない`);
      assert.ok(["deny", "detain"].includes(V.applicant.truth(A).best));
    }
  }
});

test("欠点のない名もなき申請者は、通すか限定", () => {
  for (const day of [1, 2, 3]) for (let seed = 1; seed < 300; seed++) {
    const A = V.applicant.create(day, seed, null, null);
    const t = V.applicant.truth(A).best;
    if (A.role === "地上職員" && A.status === "INVALID") assert.strictEqual(t, "limit");
    else assert.strictEqual(t, "approve", `${day}日目 seed ${seed}: ${JSON.stringify(V.applicant.flaws(A))}`);
  }
});

test("搭乗券は2日目から、乗客と乗員だけが持つ", () => {
  for (let seed = 1; seed < 100; seed++) {
    const a1 = V.applicant.create(1, seed, null, null), a2 = V.applicant.create(2, seed, null, null);
    assert.strictEqual(a1.ticket, null);
    assert.strictEqual(!!a2.ticket, a2.role !== "地上職員");
  }
});
