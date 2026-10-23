// VALID — パレットと共通の小道具
// 色の規則:世界は灰色(S0〜S8)で描き、色を持つのは遺伝子(塩基・瞳)と、血と不一致の赤だけ。
window.V = window.V || {};

V.S = ["#0D1417", "#141C1F", "#1C272B", "#2A363B", "#43525A", "#6B7B83", "#A3B0B5", "#D3DADC", "#ECEFEE"];
V.BASE = { A: "#5BAA6E", C: "#4F86D6", G: "#DDB040", T: "#9B6BD0" };
V.RED = "#D1432F";
V.RED_DARK = "#7E2A20";
V.IRIS = { B: "#7A5A3C", G: "#5BAA6E", b: "#4F86D6" };
V.GOLD = "#DDB040";

V.BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
V.bayer = (x, y) => V.BAYER[(y & 3) * 4 + (x & 3)] / 16;

// 再現できる乱数(申請者の生成や背景の配置に使う)
V.rng = function (seed) {
  let s = (Math.floor(seed) % 2147483647 + 2147483647) % 2147483647 || 1;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  return r;
};

V.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
