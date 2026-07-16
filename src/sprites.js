/* ============================================================
   原始纪元 · sprites.js —— 程序化精灵（伪3D直立式，脚底为原点）
   风格规范：2px 深描边 / 大色块 / 垂直渐变塑体积 / 椭圆软阴影
   ============================================================ */
'use strict';
PE.S = (() => {
  const U = PE.U;
  const OUT = '#1d1510'; // 统一描边色

  /* ---------- 基础助手 ---------- */
  function shadow(ctx, w, h = 0.35, alpha = 0.25) {
    ctx.save(); ctx.fillStyle = `rgba(10,8,20,${alpha})`;
    ctx.beginPath(); ctx.ellipse(0, 0, w, w * h, 0, 0, U.TAU); ctx.fill(); ctx.restore();
  }
  function rr(ctx, x, y, w, h, r) { // 圆角矩形路径
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function vgrad(ctx, y0, y1, c0, c1) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
  function shade(hex, f) { // f>0 变亮 <0 变暗
    const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    const m = c => U.clamp(Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f)), 0, 255);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }
  function flash(ctx, e) { if (e.flash > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,255,255,${Math.min(e.flash * 5, 0.85)})`; ctx.fillRect(-60, -120, 120, 130); ctx.globalCompositeOperation = 'source-over'; } }

  /* ---------- 人形（玩家/村民/部落战士/商人） ---------- */
  // o: {skin,cloth,hair,size,face,walk,t,atk,weapon,torch,hp01,paint}
  function humanoid(ctx, o) {
    const s = o.size || 1, t = o.t || 0, w = o.walk || 0;
    const leg = Math.sin(t * 11) * 5 * w, bob = Math.abs(Math.sin(t * 11)) * 2.2 * w;
    ctx.save(); ctx.scale((o.face || 1) * s, s); ctx.translate(0, -bob);
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.lineCap = 'round';
    // 腿
    ctx.strokeStyle = shade(o.skin, -0.35); ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(-3, -14); ctx.lineTo(-3 + leg, -1); ctx.moveTo(3, -14); ctx.lineTo(3 - leg, -1); ctx.stroke();
    // 躯干（兽皮衣）
    ctx.fillStyle = vgrad(ctx, -30, -12, shade(o.cloth, 0.18), shade(o.cloth, -0.22));
    rr(ctx, -7.5, -30, 15, 18, 5); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    // 后臂
    const aimA = o.atkAng || 0, atk = o.atk || 0;
    ctx.strokeStyle = shade(o.skin, -0.15); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-5, -26); ctx.lineTo(-9 - leg * 0.4, -17); ctx.stroke();
    // 头
    ctx.fillStyle = vgrad(ctx, -42, -30, shade(o.skin, 0.25), o.skin);
    ctx.beginPath(); ctx.arc(0, -36, 7, 0, U.TAU); ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke();
    // 头发/头饰
    ctx.fillStyle = o.hair || '#3a2a1c';
    ctx.beginPath(); ctx.arc(0, -38, 7, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(6, -40); ctx.closePath(); ctx.fill();
    if (o.feather) { ctx.fillStyle = o.feather; ctx.beginPath(); ctx.moveTo(2, -43); ctx.quadraticCurveTo(7, -52, 3, -53); ctx.quadraticCurveTo(0, -49, 2, -43); ctx.fill(); }
    if (o.paint) { ctx.strokeStyle = o.paint; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(2, -38); ctx.lineTo(6, -36); ctx.stroke(); }
    // 前臂 + 武器
    ctx.save(); ctx.translate(4, -25);
    const swing = atk > 0 ? Math.sin(atk * Math.PI) * 1.6 : 0;
    ctx.rotate(-0.5 + swing);
    ctx.strokeStyle = shade(o.skin, -0.05); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, 6); ctx.stroke();
    if (o.weapon) { ctx.translate(7, 6); ctx.rotate(0.5); drawWeapon(ctx, o.weapon); }
    if (o.torch) { ctx.translate(7, 6); drawTorchHand(ctx, t); }
    ctx.restore();
    flash(ctx, o.e || {});
    ctx.restore();
  }
  function drawWeapon(ctx, id) {
    ctx.lineCap = 'round';
    if (id === 'club') { ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(4, -16); ctx.stroke(); ctx.strokeStyle = '#8f6239'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(3, -12); ctx.lineTo(4, -17); ctx.stroke(); }
    else if (id === 'spear' || id === 'obspear' || id === 'thunderspear') {
      ctx.strokeStyle = '#8f6239'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(5, -20); ctx.stroke();
      ctx.fillStyle = id === 'spear' ? '#8b95a5' : id === 'obspear' ? '#4a3f63' : '#9fe8ff';
      ctx.beginPath(); ctx.moveTo(3.5, -18); ctx.lineTo(9, -27); ctx.lineTo(7.5, -16); ctx.closePath(); ctx.fill();
      if (id === 'thunderspear') { ctx.strokeStyle = '#cef3ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(5, -22); ctx.lineTo(8, -25); ctx.stroke(); }
    }
    else if (id === 'hammer') { ctx.strokeStyle = '#8f6239'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(4, -14); ctx.stroke(); ctx.fillStyle = '#ded6c0'; rr(ctx, -1, -22, 11, 9, 3); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); }
    else if (id === 'bow' || id === 'starbow') {
      ctx.strokeStyle = id === 'starbow' ? '#7fd7e8' : '#8f6239'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(2, -6, 12, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6.3, -17.1); ctx.lineTo(6.3, 5.1); ctx.stroke();
    }
  }
  function drawTorchHand(ctx, t) {
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(2, -12); ctx.stroke();
    const f = 1 + Math.sin(t * 13) * 0.15;
    ctx.fillStyle = '#ff9b3d'; ctx.beginPath(); ctx.ellipse(2.5, -16, 4 * f, 6 * f, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.ellipse(2.5, -15, 2 * f, 3.4 * f, 0, 0, U.TAU); ctx.fill();
  }

  /* ---------- 四足兽（参数化） ---------- */
  // o: {body,belly,size,face,walk,t,head:{snout,ears,tusks,horn,mane,fangs},tail,eyes}
  function quadruped(ctx, o) {
    const s = o.size || 1, t = o.t || 0, w = o.walk || 0;
    const leg = Math.sin(t * 10) * 6 * w, leg2 = Math.sin(t * 10 + Math.PI) * 6 * w;
    const breathe = Math.sin(t * 3) * 0.02 + 1;
    ctx.save(); ctx.scale((o.face || 1) * s, s * breathe);
    ctx.lineCap = 'round';
    // 四腿
    ctx.strokeStyle = shade(o.body, -0.4); ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-10, -12); ctx.lineTo(-11 + leg, -1); ctx.moveTo(-5, -12); ctx.lineTo(-5 + leg2, -1);
    ctx.moveTo(7, -12); ctx.lineTo(7 + leg2, -1); ctx.moveTo(12, -12); ctx.lineTo(13 + leg, -1);
    ctx.stroke();
    // 身体
    ctx.fillStyle = vgrad(ctx, -26, -8, shade(o.body, 0.22), shade(o.body, -0.25));
    ctx.beginPath(); ctx.ellipse(0, -17, 16, 9.5, 0, 0, U.TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    if (o.belly) { ctx.fillStyle = o.belly; ctx.beginPath(); ctx.ellipse(-1, -13, 10, 4.5, 0, 0, U.TAU); ctx.fill(); }
    if (o.head.mane) { ctx.fillStyle = shade(o.body, -0.35); ctx.beginPath(); ctx.ellipse(8, -22, 8, 7, -0.4, 0, U.TAU); ctx.fill(); }
    if (o.plates) { ctx.fillStyle = shade(o.body, 0.28); for (let i = -1; i < 2; i++) { ctx.beginPath(); ctx.ellipse(i * 8, -23, 4.5, 3, 0, 0, U.TAU); ctx.fill(); } }
    // 尾巴
    if (o.tail) { ctx.strokeStyle = shade(o.body, -0.2); ctx.lineWidth = o.tail === 'thick' ? 5 : 3; ctx.beginPath(); ctx.moveTo(-15, -19); ctx.quadraticCurveTo(-22, -22 + Math.sin(t * 7) * 3, -21, -26 + Math.sin(t * 7) * 3); ctx.stroke(); }
    // 头
    const hb = Math.sin(t * 5) * 0.8;
    ctx.save(); ctx.translate(15, -22 + hb);
    ctx.fillStyle = vgrad(ctx, -8, 6, shade(o.body, 0.28), shade(o.body, -0.1));
    ctx.beginPath(); ctx.ellipse(2, 0, 7.5, 6.5, 0.15, 0, U.TAU); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    const h = o.head;
    if (h.snout) { ctx.fillStyle = shade(o.body, -0.08); ctx.beginPath(); ctx.ellipse(8, 2, 4.5, 3, 0.2, 0, U.TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(11.5, 1.5, 1.3, 0, U.TAU); ctx.fill(); }
    if (h.ears) { ctx.fillStyle = shade(o.body, -0.15); ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(-4, -12); ctx.lineTo(2, -6); ctx.closePath(); ctx.moveTo(3, -5); ctx.lineTo(3, -12); ctx.lineTo(8, -5); ctx.closePath(); ctx.fill(); }
    if (h.tusks) { ctx.strokeStyle = '#f0ead6'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(8, 3); ctx.quadraticCurveTo(12, 1, 11, -3); ctx.stroke(); }
    if (h.bigTusks) { ctx.strokeStyle = '#f0ead6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(7, 4); ctx.quadraticCurveTo(18, 6, 20, -6); ctx.stroke(); }
    if (h.fangs) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(7, 4); ctx.lineTo(6, 8); ctx.moveTo(10, 4); ctx.lineTo(9.5, 8); ctx.stroke(); }
    if (h.horn) { ctx.fillStyle = '#d8cfc0'; ctx.beginPath(); ctx.moveTo(7, -3); ctx.quadraticCurveTo(13, -9, 9, -12); ctx.quadraticCurveTo(8, -7, 5, -4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (h.trunk) { ctx.strokeStyle = shade(o.body, -0.1); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(8, 1); ctx.quadraticCurveTo(13, 8, 10 + Math.sin(t * 4) * 2, 15); ctx.stroke(); }
    // 眼睛
    ctx.fillStyle = o.eyes || OUT; ctx.beginPath(); ctx.arc(3, -2, o.eyeR || 1.4, 0, U.TAU); ctx.fill();
    ctx.restore();
    flash(ctx, o.e || {});
    ctx.restore();
  }

  const QUAD = {
    wolf:   e => ({ body: '#8b8577', belly: '#b8b2a4', size: 0.85, tail: 'thin', head: { snout: 1, ears: 1, fangs: e.kind === 'enemy' }, eyes: e.kind === 'enemy' ? '#ff4a3d' : undefined }),
    w_wolf: () => ({ body: '#8b8577', belly: '#b8b2a4', size: 0.85, tail: 'thin', head: { snout: 1, ears: 1 } }),
    direwolf: () => ({ body: '#5a544c', belly: '#8b8577', size: 1.05, tail: 'thick', head: { snout: 1, ears: 1, mane: 1, fangs: 1 }, eyes: '#ff4a3d' }),
    boar:   () => ({ body: '#7a5b45', belly: '#a08268', size: 0.95, tail: 'thin', head: { snout: 1, ears: 1, tusks: 1 }, eyes: '#ffb03d' }),
    w_boar: () => ({ body: '#7a5b45', belly: '#a08268', size: 0.95, tail: 'thin', head: { snout: 1, ears: 1, tusks: 1 } }),
    saber:  () => ({ body: '#c9924f', belly: '#e8c99a', size: 1.1, tail: 'thin', head: { snout: 1, ears: 1, fangs: 1 }, eyes: '#ff4a3d' }),
    bear:   () => ({ body: '#5c4633', belly: '#7a5f47', size: 1.45, tail: null, head: { snout: 1, ears: 1 }, eyes: '#ff6a3d' }),
    rhino:  () => ({ body: '#6e7480', belly: '#8d939e', size: 1.5, tail: 'thin', plates: 1, head: { snout: 1, horn: 1 }, eyes: '#ffb03d' }),
    mammoth:() => ({ body: '#7a5f47', belly: '#96causeoff', size: 2.1, tail: 'thin', head: { trunk: 1, bigTusks: 1, ears: 1 }, eyes: '#ff8a3d' }),
    deer:   () => ({ body: '#b08d5e', belly: '#d8bd94', size: 0.9, tail: 'thin', head: { snout: 1, ears: 1, horn: 1 } }),
    rabbit: () => ({ body: '#cbb9a0', belly: '#efe6d6', size: 0.45, tail: 'thin', head: { snout: 1, ears: 1 } }),
    warwolf:() => ({ body: '#7d8b9a', belly: '#aab8c4', size: 0.9, tail: 'thick', head: { snout: 1, ears: 1, fangs: 1 }, eyes: '#6ddcff' }),
    ridingboar: () => ({ body: '#6e5138', belly: '#98causeoff', size: 1.15, tail: 'thin', plates: 1, head: { snout: 1, tusks: 1, ears: 1 } }),
    sabercub: () => ({ body: '#d8a45f', belly: '#f0d8aa', size: 0.75, tail: 'thin', head: { snout: 1, ears: 1, fangs: 1 }, eyes: '#6dffb0' }),
  };
  // 修正上面两个笔误色值
  QUAD.mammoth = () => ({ body: '#7a5f47', belly: '#967a5c', size: 2.1, tail: 'thin', head: { trunk: 1, bigTusks: 1, ears: 1 }, eyes: '#ff8a3d' });
  QUAD.ridingboar = () => ({ body: '#6e5138', belly: '#987a58', size: 1.15, tail: 'thin', plates: 1, head: { snout: 1, tusks: 1, ears: 1 } });

  /* ---------- 特殊敌人 ---------- */
  function drawSnake(ctx, e, t) {
    ctx.save(); ctx.scale(e.face || 1, 1);
    ctx.strokeStyle = '#5c8b4a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const x = -18 + i * 7, y = -4 + Math.sin(t * 8 + i * 1.4) * 3.5; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = '#3d5c33'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#5c8b4a'; ctx.beginPath(); ctx.ellipse(20, -5 + Math.sin(t * 8 + 7) * 3, 5.5, 4, 0, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#ff4a3d'; ctx.beginPath(); ctx.arc(22, -6, 1.2, 0, U.TAU); ctx.fill();
    flash(ctx, e); ctx.restore();
  }
  function drawBat(ctx, e, t) {
    const fl = Math.sin(t * 16) * 0.9, hover = Math.sin(t * 5 + e.id) * 3;
    ctx.save(); ctx.translate(0, -26 + hover);
    ctx.fillStyle = '#3d3450';
    for (const s of [-1, 1]) { ctx.save(); ctx.scale(s, 1); ctx.rotate(fl * 0.5); ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(12, -7, 16, 0); ctx.quadraticCurveTo(10, 2, 3, 3); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#4a4060'; ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 5.5, 0, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ff4a3d'; ctx.beginPath(); ctx.arc(-1.5, -1, 1, 0, U.TAU); ctx.arc(1.5, -1, 1, 0, U.TAU); ctx.fill();
    flash(ctx, e); ctx.restore();
  }
  function drawEye(ctx, e, t) {
    const hover = Math.sin(t * 3 + e.id) * 4;
    ctx.save(); ctx.translate(0, -34 + hover);
    ctx.fillStyle = 'rgba(60,40,90,0.75)'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 5.5, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#c22e2e'; ctx.beginPath(); ctx.arc(Math.sin(t * 2) * 2, 0, 3.2, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = '#8a5ad0'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { const a = t * 1.5 + i * U.TAU / 5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); ctx.stroke(); }
    flash(ctx, e); ctx.restore();
  }
  function drawBogspawn(ctx, e, t) {
    const s = e.small ? 0.6 : 1;
    ctx.save(); ctx.scale(s, s);
    const wob = Math.sin(t * 6) * 2;
    ctx.fillStyle = vgrad(ctx, -30, 0, '#5a7a4a', '#31402a');
    ctx.beginPath(); ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(-14, -18 - wob, 0, -24 - wob); ctx.quadraticCurveTo(14, -18 - wob, 12, 0);
    for (let i = 5; i >= 0; i--) ctx.lineTo(-12 + i * 4.8, Math.sin(t * 9 + i) * 2.5);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#c9e84a'; ctx.beginPath(); ctx.arc(-4, -16 - wob, 2.2, 0, U.TAU); ctx.arc(4, -16 - wob, 2.2, 0, U.TAU); ctx.fill();
    flash(ctx, e); ctx.restore();
  }
  /* ---------- Boss ---------- */
  function drawBossClaw(ctx, e, t) {
    quadruped(ctx, { body: '#3a2f4a', belly: '#544766', size: 1.9, tail: 'thick', head: { snout: 1, ears: 1, fangs: 1, mane: 1 }, eyes: '#ff2e2e', eyeR: 2.2, t, walk: e.walk, face: e.face, e });
    // 巨爪
    ctx.save(); ctx.scale(e.face || 1, 1);
    ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const cl = e.atkT > 0 ? Math.sin(e.atkT * Math.PI) * 10 : 0;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(26 + i * 4, -20); ctx.lineTo(32 + i * 4 + cl, -6 + cl * 0.5); ctx.stroke(); }
    ctx.restore();
  }
  function drawBossShadow(ctx, e, t) {
    const hover = Math.sin(t * 2.2) * 5;
    ctx.save(); ctx.translate(0, -30 + hover); ctx.scale(1.6, 1.6);
    ctx.fillStyle = 'rgba(30,20,55,0.88)';
    ctx.beginPath(); ctx.moveTo(-16, 10);
    ctx.quadraticCurveTo(-20, -22, 0, -30); ctx.quadraticCurveTo(20, -22, 16, 10);
    for (let i = 4; i >= 0; i--) ctx.quadraticCurveTo(-16 + i * 8 + 4, 16 + Math.sin(t * 5 + i * 2) * 4, -16 + i * 8, 10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6a4ad0'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#b02eff'; ctx.beginPath(); ctx.arc(-6, -14, 3, 0, U.TAU); ctx.arc(6, -14, 3, 0, U.TAU); ctx.fill();
    ctx.fillStyle = 'rgba(176,46,255,0.35)'; ctx.beginPath(); ctx.arc(-6, -14, 6 + Math.sin(t * 6) * 2, 0, U.TAU); ctx.arc(6, -14, 6 + Math.sin(t * 6) * 2, 0, U.TAU); ctx.fill();
    flash(ctx, e); ctx.restore();
  }
  function drawBossLord(ctx, e, t) {
    ctx.save(); ctx.scale((e.face || 1) * 2.4, 2.4);
    const sway = Math.sin(t * 2) * 1.5;
    // 腿
    ctx.strokeStyle = '#241a38'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const leg = Math.sin(t * 6) * 4 * (e.walk || 0);
    ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(-6 + leg, 0); ctx.moveTo(5, -20); ctx.lineTo(6 - leg, 0); ctx.stroke();
    // 躯干
    ctx.fillStyle = vgrad(ctx, -52, -14, '#4a3868', '#241a38');
    rr(ctx, -13 + sway * 0.3, -52, 26, 34, 9); ctx.fill(); ctx.strokeStyle = '#0d0818'; ctx.lineWidth = 2; ctx.stroke();
    // 臂爪
    ctx.strokeStyle = '#332552'; ctx.lineWidth = 6;
    const arm = e.atkT > 0 ? Math.sin(e.atkT * Math.PI) * 14 : Math.sin(t * 2.5) * 2;
    ctx.beginPath(); ctx.moveTo(-11, -44); ctx.lineTo(-20, -30 + arm * 0.3); ctx.moveTo(11, -44); ctx.lineTo(22, -30 - arm); ctx.stroke();
    ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(20 + i * 2, -30 - arm); ctx.lineTo(24 + i * 2.5, -22 - arm); ctx.stroke(); }
    // 头 + 巨角
    ctx.fillStyle = '#38285a'; ctx.beginPath(); ctx.arc(sway, -58, 9, 0, U.TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d8cfc0'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-6 + sway, -64); ctx.quadraticCurveTo(-16 + sway, -76, -10 + sway, -84); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6 + sway, -64); ctx.quadraticCurveTo(16 + sway, -76, 10 + sway, -84); ctx.stroke();
    ctx.fillStyle = '#ff2e2e';
    ctx.beginPath(); ctx.arc(-3.5 + sway, -59, 2.2, 0, U.TAU); ctx.arc(3.5 + sway, -59, 2.2, 0, U.TAU); ctx.fill();
    flash(ctx, e); ctx.restore();
  }

  /* ---------- 植被 / 资源点 ---------- */
  function drawTree(ctx, n, t) {
    const sway = Math.sin(t * 0.9 + n.x * 0.01) * 0.02;
    const big = n.big ? 1.35 : 1, hp01 = n.hits / n.maxhits;
    ctx.save(); ctx.scale(big, big);
    ctx.strokeStyle = '#6e4a28'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sway * 30, -34); ctx.stroke();
    ctx.save(); ctx.translate(sway * 40, -46); ctx.rotate(sway);
    const g = n.biome === 'snow' ? ['#5c7a68', '#41594c'] : n.biome === 'swamp' ? ['#5c7a3a', '#3d5226'] : ['#4e8a3f', '#2f5c28'];
    ctx.fillStyle = vgrad(ctx, -30, 22, g[0], g[1]);
    for (const [ox, oy, r] of [[-12, 8, 14], [12, 8, 14], [0, -8, 17], [0, 8, 15]]) { ctx.beginPath(); ctx.arc(ox, oy, r * (0.7 + hp01 * 0.3), 0, U.TAU); ctx.fill(); }
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
    if (n.biome === 'snow') { ctx.fillStyle = 'rgba(240,246,255,0.8)'; ctx.beginPath(); ctx.arc(0, -14, 12, Math.PI, U.TAU); ctx.fill(); }
    ctx.restore(); ctx.restore();
  }
  function drawRock(ctx, n) {
    const c = n.rtype === 'obsidian' ? '#4a3f63' : n.rtype === 'star' ? '#3d6a78' : '#8d939e';
    ctx.fillStyle = vgrad(ctx, -22, 0, shade(c, 0.25), shade(c, -0.2));
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-12, -14); ctx.lineTo(-3, -20); ctx.lineTo(8, -16); ctx.lineTo(15, -4); ctx.lineTo(13, 0); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = shade(c, 0.4); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(-2, -8); ctx.stroke();
    if (n.rtype === 'star') { ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(2, -10, 3 + Math.sin(PE.time * 4) * 1, 0, U.TAU); ctx.fill(); }
    if (n.rtype === 'obsidian') { ctx.fillStyle = '#7a68b0'; ctx.beginPath(); ctx.arc(-2, -9, 2, 0, U.TAU); ctx.fill(); }
  }
  function drawBush(ctx, n) {
    ctx.fillStyle = vgrad(ctx, -16, 0, '#4e7a3f', '#31552a');
    ctx.beginPath(); ctx.arc(-7, -6, 8, 0, U.TAU); ctx.arc(7, -6, 8, 0, U.TAU); ctx.arc(0, -11, 9, 0, U.TAU); ctx.fill();
    if (n.hits > 0) { ctx.fillStyle = '#d84a5f'; for (const [x, y] of [[-8, -8], [0, -14], [8, -7], [3, -5]]) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, U.TAU); ctx.fill(); } }
  }
  function drawHerb(ctx) {
    ctx.strokeStyle = '#6db15f'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 3, 0); ctx.quadraticCurveTo(i * 5, -8, i * 4, -13 - Math.abs(i)); ctx.stroke(); }
    ctx.fillStyle = '#b0e86d'; ctx.beginPath(); ctx.arc(0, -14, 3, 0, U.TAU); ctx.fill();
  }
  function drawClay(ctx) {
    ctx.fillStyle = '#b98058'; ctx.beginPath(); ctx.ellipse(0, -3, 14, 7, 0, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#9a6845'; ctx.beginPath(); ctx.ellipse(0, -4, 8, 4, 0, 0, U.TAU); ctx.fill();
  }
  function drawMushroom(ctx) {
    for (const [x, s] of [[-6, 0.7], [4, 1], [-1, 0.55]]) {
      ctx.save(); ctx.translate(x, 0); ctx.scale(s, s);
      ctx.fillStyle = '#e8e2d0'; rr(ctx, -2.5, -9, 5, 9, 2); ctx.fill();
      ctx.fillStyle = '#c25b3a'; ctx.beginPath(); ctx.ellipse(0, -9, 7, 5, 0, Math.PI, U.TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#f0d8aa'; ctx.beginPath(); ctx.arc(-2, -11, 1.2, 0, U.TAU); ctx.arc(3, -10, 1, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
  }
  function drawChest(ctx, t) {
    ctx.fillStyle = vgrad(ctx, -18, 0, '#a4713d', '#6e4a28');
    rr(ctx, -13, -16, 26, 16, 3); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#8f6239'; rr(ctx, -14, -21, 28, 7, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8b93d'; ctx.fillRect(-2.5, -14, 5, 6);
    const g = 0.35 + Math.sin(t * 3) * 0.2;
    ctx.strokeStyle = `rgba(255,220,120,${g})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -10, 20, 0, U.TAU); ctx.stroke();
  }
  function drawFishSpot(ctx, t) {
    ctx.strokeStyle = 'rgba(220,240,255,0.5)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) { const r = ((t * 0.7 + i * 0.5) % 1) * 16; ctx.globalAlpha = 1 - r / 16; ctx.beginPath(); ctx.ellipse(0, -2, r, r * 0.45, 0, 0, U.TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  /* ---------- 建筑 ---------- */
  function drawBuilding(ctx, b, t) {
    const hp01 = b.hp / b.maxhp;
    switch (b.type) {
      case 'campfire': {
        const lv = b.lvl, f = 1 + Math.sin(t * 9) * 0.12, s = 1 + lv * 0.12;
        ctx.save(); ctx.scale(s, s);
        // 石圈
        ctx.fillStyle = '#7d838c';
        for (let i = 0; i < 7; i++) { const a = i / 7 * U.TAU; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 15, -Math.sin(a) * 6 - 1, 4.5, 3.5, 0, 0, U.TAU); ctx.fill(); }
        // 柴堆
        ctx.strokeStyle = '#6e4a28'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(9, -7); ctx.moveTo(-9, -7); ctx.lineTo(9, -2); ctx.stroke();
        if (b.fuelOk !== false) {
          // 火焰三层
          ctx.fillStyle = 'rgba(255,110,40,0.85)'; ctx.beginPath(); ctx.moveTo(-10, -4); ctx.quadraticCurveTo(-8 * f, -26 * f, 0, -34 * f); ctx.quadraticCurveTo(8 * f, -26 * f, 10, -4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,170,60,0.9)'; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.quadraticCurveTo(-5 * f, -18 * f, 0, -24 * f); ctx.quadraticCurveTo(5 * f, -18 * f, 6, -4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.quadraticCurveTo(-2, -10 * f, 0, -13 * f); ctx.quadraticCurveTo(2, -10 * f, 3, -4); ctx.closePath(); ctx.fill();
        } else { ctx.fillStyle = '#d84a2e'; ctx.beginPath(); ctx.arc(0, -5, 3 + Math.sin(t * 6), 0, U.TAU); ctx.fill(); }
        ctx.restore(); break;
      }
      case 'fence': {
        ctx.strokeStyle = shade('#a4713d', -0.15 * (1 - hp01)); ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (const x of [-11, 0, 11]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -22); ctx.stroke(); ctx.fillStyle = '#8f6239'; ctx.beginPath(); ctx.moveTo(x - 2.5, -22); ctx.lineTo(x, -27); ctx.lineTo(x + 2.5, -22); ctx.fill(); }
        ctx.strokeStyle = '#8f6239'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -15); ctx.lineTo(14, -13); ctx.stroke(); break;
      }
      case 'wall_wood': {
        ctx.fillStyle = vgrad(ctx, -30, 0, '#a4713d', '#6e4a28');
        rr(ctx, -15, -28, 30, 28, 3); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#6e4a28'; ctx.lineWidth = 2;
        for (const x of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(x, -27); ctx.lineTo(x, -1); ctx.stroke(); }
        crack(ctx, hp01, -15, -28, 30, 28); break;
      }
      case 'wall_stone': {
        ctx.fillStyle = vgrad(ctx, -32, 0, '#9aa2ab', '#5f666e');
        rr(ctx, -16, -30, 32, 30, 3); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(40,44,50,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-16, -15); ctx.lineTo(16, -15); ctx.moveTo(-5, -30); ctx.lineTo(-5, -15); ctx.moveTo(6, -15); ctx.lineTo(6, 0); ctx.stroke();
        crack(ctx, hp01, -16, -30, 32, 30); break;
      }
      case 'wall_bone': {
        ctx.fillStyle = vgrad(ctx, -32, 0, '#e8e2d0', '#a8a290');
        rr(ctx, -16, -28, 32, 28, 4); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#f5f0e0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (const x of [-10, 0, 10]) { ctx.beginPath(); ctx.moveTo(x, -26); ctx.lineTo(x - 3, -38); ctx.stroke(); }
        crack(ctx, hp01, -16, -28, 32, 28); break;
      }
      case 'gate': {
        ctx.fillStyle = vgrad(ctx, -28, 0, '#c99a63', '#8f6239');
        rr(ctx, -14, -26, 28, 26, 3); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#6e4a28'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -13); ctx.lineTo(14, -13); ctx.stroke();
        ctx.fillStyle = '#e8d5a8'; ctx.beginPath(); ctx.arc(0, -16, 3, 0, U.TAU); ctx.fill(); break;
      }
      case 'torchpost': {
        ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -24); ctx.stroke();
        const f = 1 + Math.sin(t * 12 + b.x) * 0.2;
        ctx.fillStyle = '#ff9b3d'; ctx.beginPath(); ctx.ellipse(0, -29, 5 * f, 8 * f, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.ellipse(0, -27, 2.5 * f, 4 * f, 0, 0, U.TAU); ctx.fill(); break;
      }
      case 'tent': {
        ctx.fillStyle = vgrad(ctx, -34, 0, '#c99a63', '#8f6b42');
        ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, -34); ctx.lineTo(22, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#4a3520'; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(0, -14); ctx.lineTo(7, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6e4a28'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, -40); ctx.stroke(); break;
      }
      case 'pot': {
        ctx.fillStyle = vgrad(ctx, -20, 0, '#c98d63', '#8f5e42');
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-13, -10, -7, -16); ctx.lineTo(7, -16); ctx.quadraticCurveTo(13, -10, 8, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#6e422e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, -8); ctx.stroke(); break;
      }
      case 'bench': {
        ctx.fillStyle = '#8f6239'; rr(ctx, -18, -14, 36, 6, 2); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#6e4a28'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(-14, 0); ctx.moveTo(14, -8); ctx.lineTo(14, 0); ctx.stroke();
        ctx.fillStyle = '#9aa2ab'; rr(ctx, -8, -20, 7, 6, 1); ctx.fill(); // 石锤
        ctx.fillStyle = '#c99a63'; rr(ctx, 3, -19, 9, 4, 1); ctx.fill(); break;
      }
      case 'altar': {
        ctx.fillStyle = vgrad(ctx, -26, 0, '#8d939e', '#5f666e');
        for (const [x, h] of [[-12, 18], [12, 18], [0, 26]]) { rr(ctx, x - 4, -h, 8, h, 2); ctx.fill(); }
        ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, -16, -30, 32, 5, 2); ctx.fillStyle = '#7d838c'; ctx.fill(); ctx.stroke();
        const g = Math.sin(t * 3) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(109,220,255,${g * 0.8})`; ctx.beginPath(); ctx.arc(0, -34, 3.5, 0, U.TAU); ctx.fill(); break;
      }
      case 'corral': {
        ctx.strokeStyle = '#8f6239'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (const x of [-16, -5, 6, 16]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -16); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-18, -12); ctx.lineTo(18, -12); ctx.moveTo(-18, -5); ctx.lineTo(18, -5); ctx.stroke();
        ctx.fillStyle = '#c99a63'; ctx.beginPath(); ctx.arc(10, -20, 4, 0, U.TAU); ctx.fill(); break;
      }
      case 'tower': {
        ctx.strokeStyle = '#6e4a28'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-6, -34); ctx.moveTo(10, 0); ctx.lineTo(6, -34); ctx.moveTo(-9, -12); ctx.lineTo(9, -12); ctx.moveTo(-8, -23); ctx.lineTo(8, -23); ctx.stroke();
        ctx.fillStyle = '#8f6239'; rr(ctx, -11, -40, 22, 7, 2); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#c99a63'; rr(ctx, -9, -50, 4, 10, 1); ctx.fill(); break;
      }
      case 'spike': {
        ctx.fillStyle = '#5c4a38'; ctx.beginPath(); ctx.ellipse(0, -2, 14, 7, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#d8cfc0';
        for (const [x, y] of [[-8, -3], [0, -4], [8, -3], [-4, 0], [4, 0]]) { ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.lineTo(x, y - 9); ctx.lineTo(x + 2.5, y); ctx.closePath(); ctx.fill(); }
        break;
      }
      case 'tripwire': {
        ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-13, -9); ctx.moveTo(13, 0); ctx.lineTo(13, -9); ctx.stroke();
        ctx.strokeStyle = b.cdT > 0 ? 'rgba(200,180,140,0.3)' : '#e8d5a8'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-13, -7); ctx.lineTo(13, -7); ctx.stroke(); break;
      }
      case 'firepit': {
        ctx.fillStyle = '#3d3226'; ctx.beginPath(); ctx.ellipse(0, -2, 15, 8, 0, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
        if (b.burnT > 0) { const f = 1 + Math.sin(t * 14) * 0.25; ctx.fillStyle = 'rgba(255,140,50,0.85)'; for (const x of [-8, 0, 8]) { ctx.beginPath(); ctx.ellipse(x, -6, 3.5 * f, 7 * f, 0, 0, U.TAU); ctx.fill(); } }
        else { ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(0, -3, 9, 4, 0, 0, U.TAU); ctx.fill(); }
        break;
      }
      case 'totem': {
        ctx.fillStyle = vgrad(ctx, -38, 0, '#a4713d', '#6e4a28');
        rr(ctx, -7, -36, 14, 36, 3); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        // 图腾脸
        ctx.strokeStyle = '#4a3520'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-7, -26); ctx.lineTo(7, -26); ctx.moveTo(-7, -12); ctx.lineTo(7, -12); ctx.stroke();
        const g = Math.sin(t * 4 + b.x) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(109,220,255,${g})`;
        ctx.beginPath(); ctx.arc(-3, -31, 2, 0, U.TAU); ctx.arc(3, -31, 2, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#c25b3a'; ctx.beginPath(); ctx.moveTo(-6, -19); ctx.lineTo(0, -23); ctx.lineTo(6, -19); ctx.lineTo(0, -15); ctx.closePath(); ctx.fill();
        // 翼
        ctx.fillStyle = '#8f6239'; ctx.beginPath(); ctx.moveTo(-7, -33); ctx.lineTo(-15, -38); ctx.lineTo(-7, -28); ctx.closePath(); ctx.moveTo(7, -33); ctx.lineTo(15, -38); ctx.lineTo(7, -28); ctx.closePath(); ctx.fill();
        break;
      }
    }
    // 血条（受损时）
    if (b.hp < b.maxhp && b.cat !== 'core') {
      ctx.fillStyle = 'rgba(20,15,10,0.7)'; ctx.fillRect(-14, -44, 28, 4);
      ctx.fillStyle = hp01 > 0.5 ? '#6db15f' : hp01 > 0.25 ? '#e8b93d' : '#d84a2e';
      ctx.fillRect(-13, -43, 26 * hp01, 2);
    }
    if (b.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(b.flash * 4, 0.6)})`; ctx.beginPath(); ctx.arc(0, -14, 20, 0, U.TAU); ctx.fill(); }
    if (b.marked) { drawMark(ctx, t); }
  }
  function crack(ctx, hp01, x, y, w, h) {
    if (hp01 > 0.66) return;
    ctx.strokeStyle = 'rgba(20,12,8,0.65)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.45, y + h * 0.4); ctx.lineTo(x + w * 0.3, y + h * 0.7); ctx.stroke();
    if (hp01 < 0.33) { ctx.beginPath(); ctx.moveTo(x + w * 0.7, y + h * 0.2); ctx.lineTo(x + w * 0.55, y + h * 0.55); ctx.lineTo(x + w * 0.75, y + h); ctx.stroke(); }
  }
  function drawMark(ctx, t) {
    ctx.strokeStyle = `rgba(200,60,255,${0.5 + Math.sin(t * 6) * 0.3})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -16, 24, 0, U.TAU); ctx.stroke();
  }

  /* ---------- POI ---------- */
  function drawCave(ctx) {
    ctx.fillStyle = vgrad(ctx, -46, 0, '#6e747e', '#3d4148');
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-30, -40, 0, -46); ctx.quadraticCurveTo(30, -40, 34, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#12100e'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-12, -22, 0, -24); ctx.quadraticCurveTo(12, -22, 14, 0); ctx.closePath(); ctx.fill();
  }
  function drawPainting(ctx, t) {
    ctx.fillStyle = '#8d939e'; rr(ctx, -12, -26, 24, 26, 3); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#c25b3a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(-2, -10); ctx.moveTo(-2, -10); ctx.lineTo(2, -18); ctx.moveTo(4, -14); ctx.arc(5, -14, 3, 0, U.TAU); ctx.stroke();
    const g = Math.sin(t * 3) * 0.3 + 0.5;
    ctx.strokeStyle = `rgba(255,220,120,${g})`; ctx.beginPath(); ctx.arc(0, -13, 18, 0, U.TAU); ctx.stroke();
  }
  function drawHut(ctx, color) {
    ctx.fillStyle = vgrad(ctx, -40, 0, shade(color, 0.15), shade(color, -0.3));
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-20, -26) ; ctx.quadraticCurveTo(0, -46, 20, -26); ctx.lineTo(26, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#241a12'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(0, -20, 8, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(color, 0.35); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, -24); ctx.lineTo(14, -24); ctx.stroke();
  }
  function drawArtifactPickup(ctx, t, name) {
    const hov = Math.sin(t * 2.5) * 3;
    ctx.save(); ctx.translate(0, -14 + hov);
    ctx.fillStyle = `rgba(255,220,120,${0.25 + Math.sin(t * 4) * 0.1})`; ctx.beginPath(); ctx.arc(0, 0, 16, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  /* ---------- 图标（缓存小画布） ---------- */
  const iconCache = {};
  function icon(id, size = 26) {
    const key = id + '_' + size;
    if (iconCache[key]) return iconCache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d'); c.translate(size / 2, size / 2); const s = size / 30;
    c.scale(s, s); c.lineWidth = 2; c.strokeStyle = OUT;
    const R = PE.D.RES[id];
    if (R) {
      if (id === 'wood') { c.fillStyle = R.c; rr(c, -10, -5, 20, 10, 4); c.fill(); c.stroke(); c.fillStyle = shade(R.c, 0.35); c.beginPath(); c.ellipse(10, 0, 3, 5, 0, 0, U.TAU); c.fill(); c.stroke(); }
      else if (id === 'stone' || id === 'flint' || id === 'obsidian' || id === 'star') { c.fillStyle = R.c; c.beginPath(); c.moveTo(-10, 6); c.lineTo(-6, -7); c.lineTo(3, -10); c.lineTo(10, -2); c.lineTo(7, 7); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = shade(R.c, 0.5); c.lineWidth = 1.5; c.beginPath(); c.moveTo(-3, -7); c.lineTo(0, 0); c.stroke(); }
      else if (id === 'food') { c.fillStyle = R.c; c.beginPath(); c.ellipse(0, 1, 8, 7, 0, 0, U.TAU); c.fill(); c.stroke(); c.strokeStyle = '#f0ead6'; c.lineWidth = 3; c.beginPath(); c.moveTo(-9, -4); c.lineTo(-12, -8); c.moveTo(9, -4); c.lineTo(12, -8); c.stroke(); }
      else if (id === 'fur') { c.fillStyle = R.c; c.beginPath(); c.moveTo(-9, -8); c.quadraticCurveTo(0, -12, 9, -8); c.lineTo(7, 6); c.quadraticCurveTo(4, 10, 0, 6); c.quadraticCurveTo(-4, 10, -7, 6); c.closePath(); c.fill(); c.stroke(); }
      else if (id === 'bone') { c.strokeStyle = OUT; c.fillStyle = R.c; c.save(); c.rotate(-0.6); rr(c, -9, -2.5, 18, 5, 2.5); c.fill(); c.stroke(); for (const e of [-9, 9]) { c.beginPath(); c.arc(e, -3, 3, 0, U.TAU); c.arc(e, 3, 3, 0, U.TAU); c.fill(); } c.restore(); }
      else if (id === 'clay') { c.fillStyle = R.c; c.beginPath(); c.arc(-4, 2, 6, 0, U.TAU); c.arc(4, 0, 7, 0, U.TAU); c.fill(); c.stroke(); }
      else if (id === 'herb') { c.strokeStyle = '#6db15f'; c.lineWidth = 2.5; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 4, 10); c.quadraticCurveTo(i * 7, -2, i * 5, -9); c.stroke(); } }
      iconCache[key] = cv; return cv;
    }
    if (id === 'ember') { c.fillStyle = '#ff9b3d'; c.beginPath(); c.moveTo(0, -11); c.quadraticCurveTo(8, -2, 5, 5); c.quadraticCurveTo(3, 9, 0, 10); c.quadraticCurveTo(-3, 9, -5, 5); c.quadraticCurveTo(-8, -2, 0, -11); c.fill(); c.strokeStyle = OUT; c.stroke(); c.fillStyle = '#ffe08a'; c.beginPath(); c.ellipse(0, 3, 3, 5, 0, 0, U.TAU); c.fill(); }
    else if (PE.D.WEAPONS[id]) { c.translate(-3, 8); c.scale(1.15, 1.15); drawWeapon(c, id); }
    else if (id === 'torch') { c.translate(-1, 8); drawTorchHand(c, 1); }
    else if (id === 'herbmed') { c.fillStyle = '#6db15f'; c.beginPath(); c.arc(0, 0, 8, 0, U.TAU); c.fill(); c.stroke(); c.strokeStyle = '#e8f5d0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.moveTo(0, -4); c.lineTo(0, 4); c.stroke(); }
    else if (id === 'meat') { c.fillStyle = '#c9704a'; c.beginPath(); c.ellipse(1, 0, 8, 6, 0.5, 0, U.TAU); c.fill(); c.stroke(); c.fillStyle = '#f0ead6'; c.beginPath(); c.arc(-7, 5, 3, 0, U.TAU); c.fill(); c.stroke(); }
    else if (id === 'firebomb') { c.fillStyle = '#b98058'; c.beginPath(); c.arc(0, 2, 8, 0, U.TAU); c.fill(); c.stroke(); c.strokeStyle = '#e8b93d'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(4, -11, 2, -13); c.stroke(); }
    else if (id === 'arrows') { c.strokeStyle = '#8f6239'; c.lineWidth = 2; c.beginPath(); c.moveTo(-8, 8); c.lineTo(6, -6); c.stroke(); c.fillStyle = '#8b95a5'; c.beginPath(); c.moveTo(4, -8); c.lineTo(10, -10); c.lineTo(8, -4); c.closePath(); c.fill(); }
    else if (id === 'armor') { c.fillStyle = '#c99a63'; c.beginPath(); c.moveTo(-8, -8); c.lineTo(8, -8); c.lineTo(6, 8); c.quadraticCurveTo(0, 11, -6, 8); c.closePath(); c.fill(); c.stroke(); }
    else if (id === 'tool2' || id === 'tool3') { c.strokeStyle = '#8f6239'; c.lineWidth = 3; c.beginPath(); c.moveTo(-6, 9); c.lineTo(4, -5); c.stroke(); c.fillStyle = id === 'tool2' ? '#e8e2d0' : '#4a3f63'; c.beginPath(); c.moveTo(1, -9); c.lineTo(10, -6); c.lineTo(4, -1); c.closePath(); c.fill(); c.stroke(); }
    else if (id === 'skull') { c.fillStyle = '#e8e2d0'; c.beginPath(); c.arc(0, -2, 8, 0, U.TAU); c.fill(); rr(c, -5, 3, 10, 6, 2); c.fill(); c.fillStyle = OUT; c.beginPath(); c.arc(-3, -3, 2.2, 0, U.TAU); c.arc(3, -3, 2.2, 0, U.TAU); c.fill(); }
    else { c.fillStyle = '#8d939e'; c.beginPath(); c.arc(0, 0, 9, 0, U.TAU); c.fill(); c.stroke(); }
    iconCache[key] = cv; return cv;
  }

  return { shadow, rr, vgrad, shade, humanoid, quadruped, QUAD, drawWeapon, drawSnake, drawBat, drawEye, drawBogspawn, drawBossClaw, drawBossShadow, drawBossLord, drawTree, drawRock, drawBush, drawHerb, drawClay, drawMushroom, drawChest, drawFishSpot, drawBuilding, drawCave, drawPainting, drawHut, drawArtifactPickup, icon, OUT };
})();
