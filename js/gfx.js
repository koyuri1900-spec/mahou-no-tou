// VALID — 描画の土台
// 絵は 480×270 の「ドット座標」で描き、画面の canvas(960×540)には2倍で描く。
// 文字だけは 960×540 の解像度で DotGothic16 を描くので、ドット絵より半分細かいドット文字になる。
(function () {
  const ART_W = 480, ART_H = 270;
  const FONT = '"DotGothic16", monospace';

  // ---- 文字のビットマップ(にじみを消して2値にしたもの)をキャッシュする ----
  const cache = new Map();
  const mcan = document.createElement("canvas");
  const mctx = mcan.getContext("2d");

  function measurePx(str, size) {
    mctx.font = `${size}px ${FONT}`;
    return Math.ceil(mctx.measureText(str).width);
  }

  function glyphs(str, color, size) {
    const key = size + "|" + color + "|" + str;
    let c = cache.get(key);
    if (c) return c;
    const w = Math.max(1, measurePx(str, size) + 2), h = size + 4;
    c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.font = `${size}px ${FONT}`;
    g.textBaseline = "top";
    g.fillStyle = color;
    g.fillText(str, 0, 1);
    const d = g.getImageData(0, 0, w, h);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 100 ? 255 : 0;
    g.putImageData(d, 0, 0);
    if (cache.size > 3000) cache.clear();
    cache.set(key, c);
    return c;
  }

  // ---- Surface:任意の canvas に、ドット座標で描くための道具 ----
  // scale=2 の面(画面や書類)には文字も描ける。scale=1 の面(背景の下絵)は絵だけ。
  class Surface {
    constructor(canvas, scale) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.ctx.imageSmoothingEnabled = false;
      this.s = scale;
    }
    rect(x, y, w, h, c) {
      if (w <= 0 || h <= 0) return;
      const s = this.s;
      this.ctx.fillStyle = c;
      this.ctx.fillRect(Math.round(x * s), Math.round(y * s), Math.round(w * s), Math.round(h * s));
    }
    px(x, y, c) { this.rect(x, y, 1, 1, c); }
    // 4×4 のディザで濃淡を作る(level 0〜1)
    dither(x, y, w, h, c, level) {
      this.ctx.fillStyle = c;
      const s = this.s;
      for (let yy = Math.floor(y); yy < y + h; yy++)
        for (let xx = Math.floor(x); xx < x + w; xx++)
          if (V.bayer(xx, yy) < level) this.ctx.fillRect(xx * s, yy * s, s, s);
    }
    frame(x, y, w, h, c) {
      this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c);
      this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c);
    }
    // 文字。size は画面ピクセル(16 か 32 が DotGothic16 のドットに合う)
    text(str, x, y, color, opt = {}) {
      str = String(str);
      const size = opt.size || 16;
      const bmp = glyphs(str, color, size);
      const wArt = (bmp.width - 2) / 2;
      let dx = x;
      if (opt.align === "center") dx = x - wArt / 2;
      else if (opt.align === "right") dx = x - wArt;
      const k = this.s / 2;
      this.ctx.drawImage(bmp, Math.round(dx * this.s), Math.round(y * this.s), bmp.width * k, bmp.height * k);
      return wArt;
    }
    // 折り返して描く。戻り値は使った行数
    para(str, x, y, w, color, opt = {}) {
      const lines = Surface.wrap(str, w, opt.size || 16);
      const lh = opt.lh || ((opt.size || 16) / 2 + 2);
      lines.forEach((ln, i) => this.text(ln, x, y + i * lh, color, opt));
      return lines.length;
    }
    // 下絵(scale 1 の canvas)を貼る
    img(canvas, x, y, w, h) {
      const s = this.s;
      this.ctx.drawImage(canvas, Math.round(x * s), Math.round(y * s), Math.round((w ?? canvas.width) * s), Math.round((h ?? canvas.height) * s));
    }
    // 同じ倍率の canvas(書類など)を貼る
    imgSame(canvas, x, y) {
      this.ctx.drawImage(canvas, Math.round(x * this.s), Math.round(y * this.s));
    }
    static measure(str, size = 16) { return measurePx(String(str), size) / 2; }
    static wrap(str, w, size = 16) {
      const out = [];
      String(str).split("\n").forEach(par => {
        let line = "";
        for (const ch of par) {
          if (Surface.measure(line + ch, size) > w && line) {
            // 句読点を行頭に置かない
            if ("、。」』)!?ー…".includes(ch)) { line += ch; continue; }
            out.push(line); line = ch;
          } else line += ch;
        }
        out.push(line);
      });
      return out;
    }
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  // ドット座標 w×h の下絵(scale 1)
  function art(w, h) { return new Surface(makeCanvas(w, h), 1); }
  // ドット座標 w×h の書類(scale 2、文字も描ける)
  function hi(w, h) { return new Surface(makeCanvas(w * 2, h * 2), 2); }

  V.Surface = Surface;
  V.gfx = { ART_W, ART_H, FONT, art, hi, makeCanvas, glyphs, clearCache: () => cache.clear() };
})();
