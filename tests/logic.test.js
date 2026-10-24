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

test("ソルの欠点はX線の血液パッド(遺伝子は一致する)", () => {
  const A = make(3, "sol");
  assert.strictEqual(V.applicant.flaws(A).map(f => f.type).join(","), "xray");
  assert.strictEqual(A.sample, A.genome);
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

test("X線に写る物:パッドとボルトは拘束、記録のない心臓の機器は不適格", () => {
  for (let seed = 1; seed < 300; seed++) {
    const A = V.applicant.create(3, seed, null, "xray");
    if (!A.ticket) continue;
    const best = V.applicant.truth(A).best;
    if (A.xray === "device") assert.ok(["deny", "detain"].includes(best));
    else assert.strictEqual(best, "detain");
    assert.ok(Math.abs(A.massActual - A.ticket.mass) > 0.5);
  }
});

test("体重が違うだけの申請者は、X線に何も写らないか無害な物だけで適格", () => {
  for (let seed = 1; seed < 200; seed++) {
    const A = V.applicant.create(3, seed, null, "mass");
    if (!A.ticket) continue;
    assert.ok(Math.abs(A.massActual - A.ticket.mass) > 0.5);
    assert.ok([null, "plate", "device"].includes(A.xray));
    assert.ok(!V.applicant.flaws(A).some(f => f.type === "xray" || f.type === "implant"), `seed ${seed}`);
  }
});

test("照合の組み合わせは順不同", () => {
  const A = make(1, "kai");
  assert.ok(V.applicant.match(A, "reg.genome", "seq"));
  assert.ok(V.applicant.match(A, "seq", "reg.genome"));
  assert.ok(V.applicant.match(A, "body.height", "reg.height"));
  assert.strictEqual(V.applicant.match(A, "reg.name", "today"), null);
});

test("名もなき申請者:仕込んだ欠点が必ず判定に現れる", () => {
  for (const day of [1, 2, 3]) {
    for (let seed = 1; seed < 400; seed++) {
      const r = V.rng(seed);
      const flaw = r.pick(V.applicant.flawPool(day));
      const A = V.applicant.create(day, seed, null, flaw);
      const f = V.applicant.flaws(A);
      const noTicket = ["ticketName", "ticketDate", "seal", "xray"].includes(flaw) && !A.ticket;
      if (noTicket || flaw === "mass") continue; // mass は体重が違うだけで、偽装ではない
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

test("顔写真の偽装:登録簿の顔か瞳が本人と違えば拘束", () => {
  for (const day of [1, 2, 3]) for (let seed = 1; seed < 200; seed++) {
    const A = V.applicant.create(day, seed, null, "faceReg");
    const f = V.applicant.flaws(A).find(x => x.type === "faceReg");
    assert.ok(f, `${day}日目 seed ${seed}`);
    assert.ok(V.applicant.match(A, "face", "reg.photo"));
    if (A.faceVariant === "eye") assert.ok(V.applicant.match(A, "reg.eye", "face"));
    assert.strictEqual(V.applicant.truth(A).best, "detain");
  }
});

test("カードの偽造:印字が登録簿と違えば拘束。氏名の差し替えは名義の欠点と重ならない", () => {
  for (const day of [2, 3]) for (let seed = 1; seed < 200; seed++) {
    const A = V.applicant.create(day, seed, null, "cardForged");
    const types = V.applicant.flaws(A).map(x => x.type);
    assert.ok(types.includes("cardForged"), `${day}日目 seed ${seed}`);
    assert.ok(!types.includes("ticketName") && !types.includes("faceReg"));
    assert.ok(V.applicant.match(A, "card.photo", "reg.photo"));
    if (A.forged === "name") assert.ok(V.applicant.match(A, "card.name", "reg.name"));
    assert.strictEqual(V.applicant.truth(A).best, "detain");
  }
});
