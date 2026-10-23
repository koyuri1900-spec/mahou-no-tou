// VALID — 音
// 審査中は曲を鳴らさず、ホールの環境音だけにする。曲は節目(タイトル、夜)にだけ鳴らす。
// どの曲にも同じ4音の主題 D–A–G–E を入れる。主題が D に帰って完成するのは最終便の日だけ。
(function () {
  let ctx = null, master = null, sfxBus = null, musicBus = null, ambBus = null, verb = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
      ambBus = ctx.createGain(); ambBus.gain.value = 0.45; ambBus.connect(master);
      verb = ctx.createConvolver();
      const len = ctx.sampleRate * 4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      verb.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.5; verb.connect(wet); wet.connect(musicBus);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  const NOTE = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, Bb: 1, B: 2 };
  const hz = n => { const m = n.match(/^([A-G][#b]?)(-?\d)$/); return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] - 4) * 12) / 12); };

  function tone(dest, t, f, dur, o = {}) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.toT || dur));
    if (o.detune) osc.detune.value = o.detune;
    const pk = o.gain ?? 0.2, a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pk, t + a);
    g.gain.setTargetAtTime(0.0001, t + a, o.decay ?? dur / 4);
    let n = osc;
    if (o.filter) { const fl = ctx.createBiquadFilter(); fl.type = o.ftype || "lowpass"; fl.frequency.value = o.filter; osc.connect(fl); n = fl; }
    n.connect(g); g.connect(dest);
    if (o.send) g.connect(verb);
    osc.start(t); osc.stop(t + dur + 1);
  }

  let nbuf = null;
  function noiseBuf() {
    if (!nbuf) {
      nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = nbuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = i % 2 ? w * 0.5 : last * 3.5; }
    }
    return nbuf;
  }
  function burst(dest, t, dur, gain, freq, type = "bandpass", q = 1) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---- 効果音 ----
  const sfx = {
    stamp(red) {
      if (!ensure()) return; const t = ctx.currentTime;
      burst(sfxBus, t, 0.02, 0.6, 4500);
      burst(sfxBus, t, 0.16, 0.9, 240, "lowpass");
      tone(sfxBus, t, 95, 0.22, { gain: 0.5, to: 38 });
      if (red) tone(sfxBus, t + 0.05, 220, 0.3, { type: "triangle", gain: 0.06, to: 180 });
    },
    paper() { if (!ensure()) return; burst(sfxBus, ctx.currentTime, 0.09, 0.25, 2500, "highpass"); },
    drop() { if (!ensure()) return; const t = ctx.currentTime; burst(sfxBus, t, 0.05, 0.3, 900); tone(sfxBus, t, 160, 0.06, { gain: 0.08 }); },
    click() { if (!ensure()) return; const t = ctx.currentTime; tone(sfxBus, t, 1800, 0.03, { type: "square", gain: 0.04, decay: 0.01 }); },
    drawer() { if (!ensure()) return; const t = ctx.currentTime; burst(sfxBus, t, 0.25, 0.25, 500, "bandpass", 2); tone(sfxBus, t + 0.2, 120, 0.08, { gain: 0.15 }); },
    lancet() { if (!ensure()) return; const t = ctx.currentTime; burst(sfxBus, t, 0.03, 0.5, 7000); tone(sfxBus, t + 0.01, 2600, 0.05, { type: "square", gain: 0.05 }); },
    machine() {
      if (!ensure()) return; const t = ctx.currentTime;
      tone(sfxBus, t, 80, 1.3, { type: "sawtooth", gain: 0.06, to: 520, toT: 0.9, attack: 0.2, filter: 1200 });
      burst(sfxBus, t, 1.2, 0.05, 900);
      tone(sfxBus, t + 1.2, 1320, 0.3, { gain: 0.08 });
    },
    found() { // 矛盾を見つけた
      if (!ensure()) return; const t = ctx.currentTime;
      tone(sfxBus, t, 98, 0.25, { type: "square", gain: 0.07, filter: 900 });
      tone(sfxBus, t, 103.8, 0.25, { type: "square", gain: 0.05, filter: 900 });
      tone(sfxBus, t, 55, 0.6, { gain: 0.3 });
    },
    nothing() { if (!ensure()) return; const t = ctx.currentTime; tone(sfxBus, t, 440, 0.08, { gain: 0.05 }); tone(sfxBus, t + 0.09, 330, 0.12, { gain: 0.05 }); },
    chime() { if (!ensure()) return; const t = ctx.currentTime; ["E5", "C5", "G4"].forEach((n, k) => { tone(sfxBus, t + k * 0.42, hz(n), 1.4, { gain: 0.09, decay: 0.45, send: true }); }); },
    alarm() { if (!ensure()) return; const t = ctx.currentTime; for (let k = 0; k < 4; k++) tone(sfxBus, t + k * 0.5, k % 2 ? 660 : 880, 0.4, { type: "square", gain: 0.035, filter: 2000 }); },
    citation() { if (!ensure()) return; const t = ctx.currentTime; for (let k = 0; k < 14; k++) tone(sfxBus, t + k * 0.03, 1800 + (k % 3) * 200, 0.02, { type: "square", gain: 0.03, decay: 0.01 }); },
    coin() { if (!ensure()) return; const t = ctx.currentTime; tone(sfxBus, t, 1568, 0.2, { gain: 0.06 }); tone(sfxBus, t + 0.07, 2093, 0.25, { gain: 0.05 }); },
    xray() { if (!ensure()) return; const t = ctx.currentTime; tone(sfxBus, t, 60, 0.8, { type: "sawtooth", gain: 0.05, filter: 300 }); burst(sfxBus, t, 0.8, 0.08, 3000); }
  };

  // ---- ホールの環境音(審査中ずっと) ----
  let amb = null;
  function startHall() {
    if (!ensure() || amb) return;
    const t = ctx.currentTime, nodes = [], timers = [];
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(1, t + 2); out.connect(ambBus);
    const loopNoise = (freq, type, gain, q = 0.8) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf(); s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
      s.connect(f); f.connect(g); g.connect(out); s.start(t); nodes.push(s); return g;
    };
    loopNoise(240, "lowpass", 0.55);                // 空調
    const crowd = loopNoise(650, "bandpass", 0.16);  // ざわめき
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.19; lg.gain.value = 0.08;
    lfo.connect(lg); lg.connect(crowd.gain); lfo.start(t); nodes.push(lfo);
    const hum = ctx.createOscillator(), hg = ctx.createGain(); hum.frequency.value = 50; hg.gain.value = 0.012; hum.connect(hg); hg.connect(out); hum.start(t); nodes.push(hum);
    const events = () => {
      if (!amb) return;
      const tt = ctx.currentTime + 0.1, r = Math.random();
      if (r < 0.35) { // 遠いエンジン試験
        const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = noiseBuf(); f.type = "lowpass"; f.frequency.value = 85;
        g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(1.3, tt + 3); g.gain.exponentialRampToValueAtTime(0.0001, tt + 8);
        s.connect(f); f.connect(g); g.connect(out); s.start(tt); s.stop(tt + 8.5);
      } else if (r < 0.6) { // 遠い構内放送
        ["G4", "E4"].forEach((n, k) => tone(out, tt + k * 0.4, hz(n), 1, { gain: 0.025, decay: 0.3 }));
        for (let k = 0; k < 9; k++) burst(out, tt + 1 + k * 0.17, 0.14, 0.06, 500 + Math.random() * 400, "bandpass", 3);
      } else if (r < 0.8) { // 足音・台車
        for (let k = 0; k < 4; k++) burst(out, tt + k * 0.32, 0.05, 0.1, 1200);
      }
      timers.push(setTimeout(events, 6000 + Math.random() * 7000));
    };
    timers.push(setTimeout(events, 2500));
    amb = { out, nodes, timers };
  }
  function stopHall() {
    if (!amb || !ctx) return;
    const a = amb; amb = null;
    a.timers.forEach(clearTimeout);
    a.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    setTimeout(() => { a.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); a.out.disconnect(); }, 2000);
  }

  // ---- 曲(節目だけ) ----
  let song = null;
  const MOTIF = ["D4", "A4", "G4", "E4"];
  function glass(dest, t, f, gain = 0.09) {
    tone(dest, t, f, 4, { gain, attack: 0.01, decay: 1.2, send: true });
    tone(dest, t, f * 2.01, 2, { gain: gain * 0.25, decay: 0.5, send: true });
    tone(dest, t, f * 3.98, 1, { gain: gain * 0.08, decay: 0.25 });
  }
  function pad(dest, t, notes, dur, gain = 0.03) {
    notes.forEach(n => {
      tone(dest, t, hz(n), dur, { type: "sawtooth", gain, attack: 3, decay: dur / 2, filter: 700, detune: -6, send: true });
      tone(dest, t, hz(n), dur, { type: "triangle", gain: gain * 1.2, attack: 3, decay: dur / 2, detune: 7, send: true });
    });
  }
  const SONGS = {
    title(out, timers) {
      const loop = () => {
        if (!song) return; const t = ctx.currentTime + 0.05;
        pad(out, t, ["D3", "A3", "E4"], 10); pad(out, t + 10, ["Bb2", "F3", "D4"], 10);
        MOTIF.forEach((n, k) => glass(out, t + 1.5 + k * 1.1, hz(n)));
        ["D4", "A4", "G4", "F4"].forEach((n, k) => glass(out, t + 11.5 + k * 1.1, hz(n), 0.07));
        timers.push(setTimeout(loop, 20000));
      };
      loop();
    },
    night(out, timers) {
      const box = (t, n, g = 0.07) => { tone(out, t, hz(n) * 2, 2.5, { gain: g, decay: 0.6, send: true }); tone(out, t, hz(n) * 4.02, 1, { gain: g * 0.3, decay: 0.2 }); };
      const loop = () => {
        if (!song) return; const t = ctx.currentTime + 0.05;
        pad(out, t, ["D3", "F3", "A3"], 11, 0.014);
        MOTIF.forEach((n, k) => box(t + 1 + k * 0.9, n));
        tone(out, t + 4.6, hz("D4") * 2 * Math.pow(2, -0.7 / 12), 2.5, { gain: 0.06, decay: 0.6, send: true }); // 最後の音が少し外れる
        ["F4", "E4", "D4"].forEach((n, k) => box(t + 7 + k * 1, n, 0.045));
        timers.push(setTimeout(loop, 13000));
      };
      loop();
    },
    sting(out) { // 事件や締めの一撃
      const t = ctx.currentTime + 0.05;
      tone(out, t, 36.7, 6, { type: "sawtooth", gain: 0.25, attack: 0.05, decay: 2, filter: 160 });
      glass(out, t + 1.2, hz("D4"), 0.07); glass(out, t + 2.4, hz("A4"), 0.06);
    }
  };
  function music(name) {
    if (!ensure()) return;
    if (song && song.name === name) return;
    stopMusic();
    const out = ctx.createGain(); out.gain.value = 1; out.connect(musicBus);
    song = { name, out, timers: [] };
    SONGS[name](out, song.timers);
  }
  function stopMusic() {
    if (!song || !ctx) return;
    const s = song; song = null;
    s.timers.forEach(clearTimeout);
    s.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
    setTimeout(() => s.out.disconnect(), 4000);
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  }

  V.audio = { ensure, sfx, startHall, stopHall, music, stopMusic, setMuted, get muted() { return muted; } };
})();
