/* ============================================================
   原始纪元 · fx.js —— 粒子 / 光照 / 天气 / 飘字
   ============================================================ */
'use strict';

/* ---------------- 粒子系统（对象池） ---------------- */
PE.fx = (() => {
  const U = PE.U;
  const MAX = 800;
  const pool = [];
  for (let i = 0; i < MAX; i++) pool.push({ on: false });
  let cursor = 0;

  function spawn(x, y, opt) {
    if (PE.quality === 0 && Math.random() < 0.5) return;
    const p = pool[cursor]; cursor = (cursor + 1) % MAX;
    p.on = true; p.x = x; p.y = y; p.z = opt.z || 0;
    p.vx = opt.vx || 0; p.vy = opt.vy || 0; p.vz = opt.vz || 0;
    p.g = opt.g !== undefined ? opt.g : 220;
    p.life = p.life0 = opt.life || 0.6;
    p.size = opt.size || 3; p.color = opt.color || '#fff';
    p.drag = opt.drag || 0; p.glow = opt.glow || false; p.ring = opt.ring || false;
  }
  function burst(x, y, n, opt) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, U.TAU), sp = U.rand(opt.spMin || 30, opt.sp || 120);
      spawn(x, y, { ...opt, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: -U.rand(40, opt.up || 160), z: -U.rand(4, 18) });
    }
  }
  const blood = (x, y, n = 8) => burst(x, y, n, { color: '#a82c2c', size: 3, life: 0.5, g: 500, sp: 140 });
  const chips = (x, y, c = '#a4713d', n = 6) => burst(x, y, n, { color: c, size: 2.5, life: 0.55, g: 480, sp: 110 });
  const sparks = (x, y, n = 5) => burst(x, y, n, { color: '#ffcf5f', size: 2, life: 0.7, g: -30, sp: 50, glow: true });
  const smoke = (x, y) => spawn(x, y, { color: 'rgba(90,80,70,0.4)', size: U.rand(4, 8), life: 1.6, vz: -35, g: -12, vx: U.rand(-8, 8) });
  const ring = (x, y, color = '#ffcf5f', size = 60) => spawn(x, y, { ring: true, color, size, life: 0.45, g: 0 });
  const heal = (x, y) => burst(x, y, 6, { color: '#8fe86d', size: 2.5, life: 0.8, g: -60, sp: 30, glow: true });
  const magic = (x, y, color = '#b06dff') => burst(x, y, 10, { color, size: 3, life: 0.8, g: -40, sp: 80, glow: true });

  function update(dt) {
    for (const p of pool) {
      if (!p.on) continue;
      p.life -= dt; if (p.life <= 0) { p.on = false; continue; }
      p.vz += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z > 0) { p.z = 0; p.vz *= -0.4; p.vx *= 0.6; p.vy *= 0.6; }
      if (p.drag) { const d = 1 - p.drag * dt; p.vx *= d; p.vy *= d; }
    }
  }
  function draw(ctx, view) {
    for (const p of pool) {
      if (!p.on) continue;
      if (p.x < view.x - 40 || p.x > view.x + view.w + 40 || p.y < view.y - 60 || p.y > view.y + view.h + 40) continue;
      const t01 = p.life / p.life0;
      ctx.globalAlpha = Math.min(t01 * 2, 1);
      if (p.ring) {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3 * t01 + 1;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * (1 - t01 + 0.15), p.size * (1 - t01 + 0.15) * 0.5, 0, 0, U.TAU); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        const s = p.size * (0.5 + t01 * 0.5);
        ctx.fillRect(p.x - s / 2, p.y + p.z - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- 飘字 ---------------- */
  const texts = [];
  function text(x, y, str, color = '#fff', size = 14) {
    texts.push({ x: x + U.rand(-6, 6), y, str, color, size, life: 1, vy: -44 });
    if (texts.length > 60) texts.shift();
  }
  function updateTexts(dt) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]; t.life -= dt * 0.9; t.y += t.vy * dt; t.vy *= 0.96;
      if (t.life <= 0) texts.splice(i, 1);
    }
  }
  function drawTexts(ctx) {
    ctx.textAlign = 'center';
    for (const t of texts) {
      ctx.globalAlpha = Math.min(t.life * 2, 1);
      ctx.font = `bold ${t.size}px sans-serif`;
      ctx.strokeStyle = 'rgba(15,10,8,0.8)'; ctx.lineWidth = 3;
      ctx.strokeText(t.str, t.x, t.y - 30);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y - 30);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- 天气粒子 + 云影 ---------------- */
  const wparts = [];
  function updateWeather(dt) {
    const W = PE.world; if (!W) return;
    const want = W.weather === 'rain' ? (PE.quality === 2 ? 90 : 45) : W.season() === 'snow' ? (PE.quality === 2 ? 60 : 30) : 0;
    const v = PE.cam.view();
    while (wparts.length < want) wparts.push({ x: U.rand(v.x, v.x + v.w), y: U.rand(v.y, v.y + v.h), s: U.rand(0.6, 1.3) });
    if (wparts.length > want) wparts.length = want;
    const rain = W.weather === 'rain';
    for (const p of wparts) {
      if (rain) { p.x += 120 * dt * p.s; p.y += 560 * dt * p.s; }
      else { p.x += Math.sin(PE.time * 2 + p.s * 20) * 26 * dt; p.y += 55 * dt * p.s; }
      if (p.x > v.x + v.w) p.x -= v.w; if (p.x < v.x) p.x += v.w;
      if (p.y > v.y + v.h) { p.y = v.y - 10; p.x = U.rand(v.x, v.x + v.w); }
    }
  }
  function drawWeather(ctx) {
    const W = PE.world; if (!W || !wparts.length) return;
    if (W.weather === 'rain') {
      ctx.strokeStyle = 'rgba(160,200,240,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const p of wparts) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 3, p.y - 14 * p.s); }
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(240,246,255,0.85)';
      for (const p of wparts) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 * p.s, 0, U.TAU); ctx.fill(); }
    }
  }
  // 云影（白天真实感）
  const clouds = []; for (let i = 0; i < 7; i++) clouds.push({ x: U.rand(0, 4000), y: U.rand(0, 4000), r: U.rand(180, 420), sp: U.rand(9, 16) });
  function drawClouds(ctx) {
    if (PE.quality < 2 || !PE.world) return;
    const day01 = PE.world.dayLight();
    if (day01 < 0.35) return;
    ctx.fillStyle = `rgba(30,40,60,${0.09 * day01})`;
    for (const c of clouds) {
      const x = (c.x + PE.time * c.sp) % 4600 - 300;
      ctx.beginPath(); ctx.ellipse(x, c.y, c.r, c.r * 0.55, 0, 0, U.TAU);
      ctx.ellipse(x + c.r * 0.7, c.y + 30, c.r * 0.7, c.r * 0.4, 0, 0, U.TAU); ctx.fill();
    }
  }

  return { spawn, burst, blood, chips, sparks, smoke, ring, heal, magic, update, draw, text, updateTexts, drawTexts, updateWeather, drawWeather, drawClouds };
})();

/* ---------------- 光照系统 ---------------- */
PE.light = (() => {
  const U = PE.U;
  let lcv = null, lctx = null;
  const lights = []; // 每帧重填 {x,y,r,warm}

  function ensure() {
    if (!lcv) { lcv = document.createElement('canvas'); lctx = lcv.getContext('2d'); }
    const w = Math.ceil(PE.W * PE.DPR / 2), h = Math.ceil(PE.H * PE.DPR / 2); // 半分辨率
    if (lcv.width !== w || lcv.height !== h) { lcv.width = w; lcv.height = h; }
  }
  function clear() { lights.length = 0; }
  function add(x, y, r, warm = 1) { lights.push({ x, y, r: r * (1 + (PE.mods.light || 0)), warm }); }
  function isLit(x, y) {
    for (const l of lights) if (U.dist2(x, y, l.x, l.y) < l.r * l.r) return true;
    return false;
  }
  // 环境暗度 0(白天)~1(深夜) 与色调
  function ambient() {
    const W = PE.world;
    if (!W) return { dark: 0, tint: null };
    if (W.nightmare) return { dark: 0.72, tint: 'rgba(120,20,30,0.30)' };
    const p = W.phase, t = W.phaseT;
    let dark = 0, tint = null;
    if (p === 'day') {
      const d01 = t / PE.D.BAL.DAY_LEN;
      if (d01 < 0.12) { tint = `rgba(255,150,70,${0.16 * (1 - d01 / 0.12)})`; } // 清晨
      else if (d01 > 0.85) { tint = `rgba(255,110,60,${0.18 * (d01 - 0.85) / 0.15})`; }
      dark = 0;
    } else if (p === 'dusk') {
      const d01 = t / PE.D.BAL.DUSK_LEN;
      dark = d01 * 0.55; tint = `rgba(255,90,50,${0.22 * (1 - d01 * 0.6)})`;
    } else if (p === 'night') {
      dark = 0.78;
      if (W.bloodmoon) tint = 'rgba(180,30,40,0.22)';
    }
    if (W.weather === 'fog') dark = Math.max(dark, 0.25);
    return { dark, tint };
  }
  function render(ctx) {
    const { dark, tint } = ambient();
    const v = PE.cam.view();
    if (dark > 0.03) {
      ensure();
      const sc = lcv.width / PE.W / PE.DPR * PE.DPR; // 光画布对屏幕比例
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = 'source-over';
      const isBM = PE.world && (PE.world.bloodmoon || PE.world.nightmare);
      lctx.fillStyle = isBM ? `rgba(28,6,14,${dark})` : `rgba(8,10,26,${dark})`;
      lctx.fillRect(0, 0, lcv.width, lcv.height);
      // 挖光洞
      lctx.globalCompositeOperation = 'destination-out';
      const k = lcv.width / PE.W; // 屏幕->光画布
      for (const l of lights) {
        const s = PE.cam.toScreen(l.x, l.y);
        if (s.x < -l.r || s.x > PE.W + l.r || s.y < -l.r || s.y > PE.H + l.r) continue;
        const r = l.r * PE.cam.zoom * k;
        const g = lctx.createRadialGradient(s.x * k, s.y * k, r * 0.12, s.x * k, s.y * k, r);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.65, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g; lctx.beginPath(); lctx.arc(s.x * k, s.y * k, r, 0, U.TAU); lctx.fill();
      }
      ctx.setTransform(PE.DPR, 0, 0, PE.DPR, 0, 0);
      ctx.drawImage(lcv, 0, 0, PE.W, PE.H);
      // 暖光叠加
      ctx.globalCompositeOperation = 'overlay';
      for (const l of lights) {
        if (!l.warm) continue;
        const s = PE.cam.toScreen(l.x, l.y);
        const r = l.r * PE.cam.zoom * 0.8;
        if (s.x < -r || s.x > PE.W + r || s.y < -r || s.y > PE.H + r) continue;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        g.addColorStop(0, 'rgba(255,150,60,0.28)'); g.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, U.TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (tint) {
      ctx.setTransform(PE.DPR, 0, 0, PE.DPR, 0, 0);
      ctx.fillStyle = tint; ctx.fillRect(0, 0, PE.W, PE.H);
    }
  }
  return { clear, add, isLit, ambient, render, lights };
})();
