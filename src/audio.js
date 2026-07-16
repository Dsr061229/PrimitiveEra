/* ============================================================
   原始纪元 · audio.js —— WebAudio 全合成：音效配方 + 程序化 BGM
   ============================================================ */
'use strict';
PE.audio = (() => {
  let AC = null, master, musicBus, sfxBus, unlocked = false;
  let noiseBuf = null;

  function unlock() {
    if (unlocked) return;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.connect(AC.destination); master.gain.value = 0.9;
      musicBus = AC.createGain(); musicBus.connect(master); musicBus.gain.value = PE.settings.music;
      sfxBus = AC.createGain(); sfxBus.connect(master); sfxBus.gain.value = PE.settings.sfx;
      // 噪声缓冲
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 1, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      unlocked = true;
      music.start();
    } catch (e) { /* 无音频环境静默降级 */ }
  }
  const setVol = () => { if (!unlocked) return; musicBus.gain.value = PE.settings.music; sfxBus.gain.value = PE.settings.sfx; };

  /* ---------- 基础构件 ---------- */
  function env(node, t0, a, peak, d, sus = 0) { // 包络
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t0 + a + d);
    node.connect(g); return g;
  }
  function osc(type, f0, t0, dur, slideTo) {
    const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.05); return o;
  }
  function noise(t0, dur, filterF, q = 1, type = 'lowpass') {
    const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = filterF; f.Q.value = q;
    src.connect(f); src.start(t0); src.stop(t0 + dur + 0.05); return f;
  }
  function pan(x) { // -1..1 声像
    if (!AC.createStereoPanner) { const g = AC.createGain(); return g; }
    const p = AC.createStereoPanner(); p.pan.value = PE.U.clamp(x, -1, 1); return p;
  }
  function out(node, t0, dur, gain = 1, panX = 0, bus = null) {
    const p = pan(panX); node.connect(p); p.connect(bus || sfxBus);
    return p;
  }

  /* ---------- 音效配方 ---------- */
  const lastPlay = {};
  const R = {
    hit(o) { const t = AC.currentTime; out(env(osc('square', 220, t, 0.1, 90), t, 0.005, 0.5 * o.v, 0.09), t, 0.15, 1, o.pan); },
    crit(o) { const t = AC.currentTime; out(env(osc('square', 440, t, 0.12, 130), t, 0.004, 0.55 * o.v, 0.12), t, 0.2, 1, o.pan); out(env(osc('square', 880, t, 0.1, 260), t, 0.004, 0.3 * o.v, 0.1), t, 0.2, 1, o.pan); },
    chop(o) { const t = AC.currentTime; out(env(noise(t, 0.09, 800, 2), t, 0.004, 0.55 * o.v, 0.08), t, 0.1, 1, o.pan); out(env(osc('triangle', 150, t, 0.06, 90), t, 0.004, 0.3 * o.v, 0.05), t, 0.1, 1, o.pan); },
    mine(o) { const t = AC.currentTime; out(env(noise(t, 0.07, 2600, 3, 'bandpass'), t, 0.003, 0.5 * o.v, 0.06), t, 0.1, 1, o.pan); },
    pickup(o) { const t = AC.currentTime; out(env(osc('sine', 620, t, 0.09, 900), t, 0.005, 0.28 * o.v, 0.08), t, 0.12, 1, o.pan); },
    ember(o) { const t = AC.currentTime; out(env(osc('sine', 900, t, 0.06, 1250), t, 0.004, 0.15 * o.v, 0.05), t, 0.1, 1, o.pan); },
    build(o) { const t = AC.currentTime; for (let i = 0; i < 3; i++) { const tt = t + i * 0.07; out(env(noise(tt, 0.05, 600 + i * 300, 2), tt, 0.004, 0.4 * o.v, 0.05), tt, 0.08, 1, o.pan); } },
    repair(o) { const t = AC.currentTime; out(env(noise(t, 0.05, 1800, 4, 'bandpass'), t, 0.003, 0.35 * o.v, 0.04), t, 0.06, 1, o.pan); },
    eat(o) { const t = AC.currentTime; out(env(noise(t, 0.12, 500, 1), t, 0.01, 0.35 * o.v, 0.1), t, 0.14, 1, o.pan); },
    roll(o) { const t = AC.currentTime; out(env(noise(t, 0.18, 400, 1), t, 0.01, 0.25 * o.v, 0.16), t, 0.2, 1, o.pan); },
    bow(o) { const t = AC.currentTime; out(env(osc('sawtooth', 300, t, 0.12, 90), t, 0.003, 0.3 * o.v, 0.1), t, 0.14, 1, o.pan); out(env(noise(t, 0.08, 3000, 2, 'highpass'), t, 0.003, 0.15 * o.v, 0.06), t, 0.1, 1, o.pan); },
    hurt(o) { const t = AC.currentTime; out(env(osc('sawtooth', 190, t, 0.18, 70), t, 0.005, 0.5 * o.v, 0.16), t, 0.22, 1, 0); },
    wolf(o) { const t = AC.currentTime; const oo = osc('sawtooth', 380, t, 1.1, 240); const lfo = osc('sine', 6, t, 1.1); const lg = AC.createGain(); lg.gain.value = 18; lfo.connect(lg); lg.connect(oo.frequency); const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; oo.connect(f); out(env(f, t, 0.25, 0.22 * o.v, 0.8), t, 1.2, 1, o.pan); },
    roar(o) { const t = AC.currentTime; out(env(osc('sawtooth', 110, t, 0.7, 55), t, 0.03, 0.6 * o.v, 0.6), t, 0.8, 1, o.pan); out(env(noise(t, 0.7, 350, 1), t, 0.03, 0.4 * o.v, 0.6), t, 0.8, 1, o.pan); PE.cam.shake(3); },
    wallhit(o) { const t = AC.currentTime; out(env(noise(t, 0.12, 250, 1), t, 0.005, 0.6 * o.v, 0.1), t, 0.15, 1, o.pan); out(env(osc('sine', 70, t, 0.12, 45), t, 0.005, 0.5 * o.v, 0.1), t, 0.15, 1, o.pan); },
    breakB(o) { const t = AC.currentTime; out(env(noise(t, 0.4, 400, 1), t, 0.01, 0.7 * o.v, 0.35), t, 0.45, 1, o.pan); },
    die(o) { const t = AC.currentTime; out(env(osc('triangle', 300, t, 0.25, 60), t, 0.005, 0.4 * o.v, 0.22), t, 0.3, 1, o.pan); },
    ui(o) { const t = AC.currentTime; out(env(osc('sine', 700, t, 0.05, 850), t, 0.003, 0.18 * o.v, 0.045), t, 0.07, 1, 0); },
    buy(o) { const t = AC.currentTime; [660, 880].forEach((f, i) => out(env(osc('sine', f, t + i * 0.07, 0.08), t + i * 0.07, 0.004, 0.22 * o.v, 0.07), t, 0.1, 1, 0)); },
    error(o) { const t = AC.currentTime; out(env(osc('square', 160, t, 0.12, 120), t, 0.004, 0.2 * o.v, 0.1), t, 0.15, 1, 0); },
    bless(o) { const t = AC.currentTime; [523, 659, 784, 1046].forEach((f, i) => out(env(osc('triangle', f, t + i * 0.09, 0.4), t + i * 0.09, 0.01, 0.16 * o.v, 0.35), t, 0.5, 1, 0)); },
    stinger(o) { const t = AC.currentTime; out(env(osc('sawtooth', 55, t, 1.6, 50), t, 0.02, 0.55 * o.v, 1.5), t, 1.7, 1, 0); [110, 165].forEach(f => out(env(osc('sawtooth', f, t + 0.15, 1.2, f * 0.9), t + 0.15, 0.02, 0.25 * o.v, 1.1), t, 1.4, 1, 0)); },
    thunder(o) { const t = AC.currentTime; out(env(noise(t, 0.9, 180, 1), t, 0.01, 0.8 * o.v, 0.85), t, 1, 1, o.pan); },
    heartbeat(o) { const t = AC.currentTime; [0, 0.16].forEach((d, i) => out(env(osc('sine', i ? 55 : 65, t + d, 0.12, 40), t + d, 0.005, (i ? 0.5 : 0.7) * o.v, 0.1), t, 0.3, 1, 0)); },
    explode(o) { const t = AC.currentTime; out(env(noise(t, 0.5, 300, 1), t, 0.005, 0.8 * o.v, 0.45), t, 0.55, 1, o.pan); out(env(osc('sine', 90, t, 0.4, 40), t, 0.005, 0.7 * o.v, 0.35), t, 0.45, 1, o.pan); },
    horn(o) { const t = AC.currentTime; out(env(osc('sawtooth', 175, t, 1.2, 174), t, 0.08, 0.4 * o.v, 1.0), t, 1.3, 1, 0); out(env(osc('sawtooth', 176.5, t, 1.2), t, 0.08, 0.3 * o.v, 1.0), t, 1.3, 1, 0); },
    fishbite(o) { const t = AC.currentTime; out(env(osc('sine', 500, t, 0.08, 300), t, 0.004, 0.35 * o.v, 0.07), t, 0.1, 1, o.pan); },
  };

  // sfx('hit', {x,y} 世界坐标可选, vol)
  function sfx(name, opt = {}) {
    if (!unlocked || !R[name]) return;
    const now = performance.now();
    if (lastPlay[name] && now - lastPlay[name] < 45) return; // 同音效限流
    lastPlay[name] = now;
    let panX = 0, v = opt.vol || 1;
    if (opt.x !== undefined && PE.player) {
      const dx = opt.x - PE.cam.x, dy = opt.y - PE.cam.y, d = Math.hypot(dx, dy);
      if (d > 950) return;
      panX = PE.U.clamp(dx / 600, -0.85, 0.85);
      v *= PE.U.clamp(1 - d / 950, 0.1, 1);
    }
    try { R[name]({ pan: panX, v }); } catch (e) { /* ignore */ }
  }

  /* ---------- 程序化 BGM ---------- */
  const PENTA = [0, 2, 4, 7, 9]; // 宫调五声
  const music = {
    mode: 'title', intensity: 0, step: 0, nextT: 0, timer: null, base: 220,
    setMode(m) { if (this.mode !== m) { this.mode = m; this.step = 0; } },
    start() {
      if (this.timer) return;
      this.timer = setInterval(() => this.tick(), 60);
    },
    note(f, t, dur, vol, type = 'triangle', vib = 0) {
      const o = AC.createOscillator(); o.type = type; o.frequency.value = f;
      if (vib) { const l = AC.createOscillator(); l.frequency.value = 5.5; const lg = AC.createGain(); lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
      const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
    },
    drum(t, type, vol) {
      if (type === 'low') { const o = AC.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15); const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.3); }
      else { const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = type === 'hi' ? 4500 : 1500; const g = AC.createGain(); g.gain.setValueAtTime(vol * 0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); s.connect(f); f.connect(g); g.connect(musicBus); s.start(t); s.stop(t + 0.15); }
    },
    tick() {
      if (!unlocked || PE.settings.music <= 0.01) return;
      const t = AC.currentTime;
      if (t < this.nextT) return;
      const m = this.mode;
      let bpm = m === 'day' ? 62 : m === 'night' ? 96 + this.intensity * 46 : m === 'boss' ? 150 : 54;
      const beat = 60 / bpm / 2; // 八分音
      this.nextT = (this.nextT > t - 0.5 ? this.nextT : t) + beat;
      const s = this.step++;
      const rand = PE.U.hash2(s * 7.13, s * 3.71);
      if (m === 'title' || m === 'day') {
        // 骨笛旋律：稀疏五声
        if (s % 4 === 0 && rand < 0.75) {
          const oct = rand < 0.2 ? 2 : 1;
          const f = this.base * oct * Math.pow(2, PENTA[Math.floor(rand * 5) % 5] / 12);
          this.note(f, this.nextT, beat * (rand < 0.3 ? 6 : 3.5), 0.12, 'triangle', 4);
        }
        if (s % 16 === 8 && rand < 0.4) this.drum(this.nextT, 'low', 0.12); // 远处轻鼓
      } else if (m === 'night' || m === 'boss') {
        const dense = m === 'boss' ? 1 : this.intensity;
        if (s % 4 === 0) this.drum(this.nextT, 'low', 0.28 + dense * 0.15);
        if (s % 4 === 2 && dense > 0.3) this.drum(this.nextT, 'mid', 0.16);
        if (s % 2 === 1 && dense > 0.6 && rand < 0.7) this.drum(this.nextT, 'hi', 0.08);
        if (m === 'boss' && s % 8 === 4) this.drum(this.nextT, 'low', 0.4);
        if (s % 16 === 0 && rand < 0.5) { // 低音吟唱
          const f = 110 * Math.pow(2, PENTA[Math.floor(rand * 5)] / 12);
          this.note(f, this.nextT, beat * 10, 0.1, 'sawtooth', 3);
        }
      }
    },
  };

  /* ---------- 篝火环境声（循环） ---------- */
  let fireGain = null;
  function fireLoop(active, vol) {
    if (!unlocked) return;
    if (active && !fireGain) {
      const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      fireGain = AC.createGain(); fireGain.gain.value = 0;
      s.connect(f); f.connect(fireGain); fireGain.connect(sfxBus); s.start();
      // 噼啪
      setInterval(() => { if (fireGain && fireGain.gain.value > 0.01 && Math.random() < 0.5) { const t = AC.currentTime; out(env(noise(t, 0.03, 3200, 3, 'bandpass'), t, 0.002, fireGain.gain.value * 2.4, 0.025), t, 0.05, 1, 0); } }, 350);
    }
    if (fireGain) fireGain.gain.value = active ? vol * 0.12 : 0;
  }

  return { unlock, sfx, music, setVol, fireLoop, get ready() { return unlocked; } };
})();
