/* ============================================================
   原始纪元 · core.js —— 命名空间/工具/RNG/游戏循环/相机/空间哈希/流场寻路
   ============================================================ */
'use strict';
window.PE = {
  VERSION: '1.0.0',
  TILE: 32,
  MAPW: 4000, MAPH: 4000,
  GW: 125, GH: 125,          // 寻路格数
  W: 0, H: 0, DPR: 1,        // 屏幕尺寸
  time: 0,                    // 全局运行秒
  hitstop: 0,                 // 顿帧计时
  state: 'boot',              // boot|title|class|talent|run|dead|victory
  quality: 2,                 // 2 高 1 中 0 低（自动降档）
  isTouch: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
};

/* ---------------- 工具 ---------------- */
PE.U = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
  const ang = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  const angLerp = (a, b, t) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return a + d * t; };
  const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const wpick = (arr, wfn) => { // 权重抽取
    let sum = 0; for (const it of arr) sum += wfn(it);
    let r = Math.random() * sum;
    for (const it of arr) { r -= wfn(it); if (r <= 0) return it; }
    return arr[arr.length - 1];
  };
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let _uid = 1; const uid = () => _uid++;
  // 带种子 PRNG（mulberry32）
  const rngSeed = seed => { let s = seed >>> 0; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const fmt = n => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n) + '';
  // 简易噪声（value noise，用于地面纹理）
  const hash2 = (x, y) => { let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  const noise2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
  };
  return { TAU, clamp, lerp, dist, dist2, ang, angLerp, rand, randi, pick, wpick, shuffle, uid, rngSeed, easeOut, fmt, noise2, hash2 };
})();

/* ---------------- 相机 ---------------- */
PE.cam = {
  x: 2000, y: 2000, zoom: 1, targetZoom: 1,
  shakeT: 0, shakeA: 0,
  shake(amount) { this.shakeA = Math.max(this.shakeA, amount); this.shakeT = Math.max(this.shakeT, 0.35); },
  follow(tx, ty, dt) {
    const k = 1 - Math.pow(0.001, dt);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * k * 0.5;
    if (this.shakeT > 0) this.shakeT -= dt;
  },
  // 视野世界矩形
  view() {
    const w = PE.W / this.zoom, h = PE.H / this.zoom;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  },
  apply(ctx) {
    let sx = 0, sy = 0;
    if (this.shakeT > 0 && PE.settings.shake) {
      const a = this.shakeA * (this.shakeT / 0.35);
      sx = PE.U.rand(-a, a); sy = PE.U.rand(-a, a);
    }
    ctx.setTransform(PE.DPR * this.zoom, 0, 0, PE.DPR * this.zoom,
      PE.DPR * (PE.W / 2 - (this.x + sx) * this.zoom), PE.DPR * (PE.H / 2 - (this.y + sy) * this.zoom));
  },
  toWorld(sx, sy) { return { x: this.x + (sx - PE.W / 2) / this.zoom, y: this.y + (sy - PE.H / 2) / this.zoom }; },
  toScreen(wx, wy) { return { x: (wx - this.x) * this.zoom + PE.W / 2, y: (wy - this.y) * this.zoom + PE.H / 2 }; },
};

/* ---------------- 空间哈希（每帧重建） ---------------- */
PE.grid = {
  cell: 128, map: new Map(),
  key(cx, cy) { return cx * 1000 + cy; },
  clear() { this.map.clear(); },
  insert(e) {
    const cx = Math.floor(e.x / this.cell), cy = Math.floor(e.y / this.cell);
    const k = this.key(cx, cy);
    let arr = this.map.get(k); if (!arr) { arr = []; this.map.set(k, arr); }
    arr.push(e);
  },
  query(x, y, r, out) {
    out = out || [];
    const c = this.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c),
      y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c), r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const arr = this.map.get(this.key(cx, cy)); if (!arr) continue;
      for (const e of arr) if (!e.dead && PE.U.dist2(x, y, e.x, e.y) <= r2) out.push(e);
    }
    return out;
  },
};

/* ---------------- 流场寻路（Dijkstra，从篝火向外） ----------------
   costGrid: 1=空地  BLOCK_COST=建筑(可拆墙穿过)  Infinity=水/边界
   敌人沿 cost 递减方向走；若下一格是建筑格则攻击该建筑 */
PE.flow = {
  cost: null, dist: null, dirty: true, BLOCK: 26,
  init() {
    const n = PE.GW * PE.GH;
    this.cost = new Float32Array(n).fill(1);
    this.dist = new Float32Array(n).fill(Infinity);
  },
  idx(tx, ty) { return ty * PE.GW + tx; },
  setCost(tx, ty, c) { if (tx >= 0 && ty >= 0 && tx < PE.GW && ty < PE.GH) { this.cost[this.idx(tx, ty)] = c; this.dirty = true; } },
  rebuild(goalX, goalY) { // goal 世界坐标（篝火）
    const T = PE.TILE, gw = PE.GW, gh = PE.GH;
    const dist = this.dist; dist.fill(Infinity);
    const gtx = PE.U.clamp(Math.floor(goalX / T), 0, gw - 1), gty = PE.U.clamp(Math.floor(goalY / T), 0, gh - 1);
    // 简易二叉堆
    const heap = [], push = (d, i) => { heap.push([d, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let p = 0; for (;;) { let l = p * 2 + 1, r = l + 1, m = p; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === p) break; [heap[p], heap[m]] = [heap[m], heap[p]]; p = m; } } return top; };
    dist[this.idx(gtx, gty)] = 0; push(0, this.idx(gtx, gty));
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (heap.length) {
      const [d, i] = pop();
      if (d > dist[i]) continue;
      const tx = i % gw, ty = (i / gw) | 0;
      for (const [dx, dy] of N4) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const ni = ny * gw + nx, c = this.cost[ni];
        if (c === Infinity) continue;
        const nd = d + c;
        if (nd < dist[ni]) { dist[ni] = nd; push(nd, ni); }
      }
    }
    this.dirty = false;
  },
  // 返回 {x,y} 单位向量（朝 cost 下降方向）；无路时返回 null
  dirAt(wx, wy) {
    const T = PE.TILE, gw = PE.GW;
    const tx = PE.U.clamp(Math.floor(wx / T), 1, gw - 2), ty = PE.U.clamp(Math.floor(wy / T), 1, PE.GH - 2);
    const d = this.dist, i = ty * gw + tx;
    if (d[i] === Infinity) return null;
    let best = d[i], bx = 0, by = 0;
    const cand = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [dx, dy] of cand) {
      const v = d[(ty + dy) * gw + (tx + dx)];
      if (v < best) { best = v; bx = dx; by = dy; }
    }
    if (bx === 0 && by === 0) return { x: 0, y: 0 };
    const len = Math.hypot(bx, by); return { x: bx / len, y: by / len };
  },
  distAt(wx, wy) {
    const tx = PE.U.clamp(Math.floor(wx / PE.TILE), 0, PE.GW - 1), ty = PE.U.clamp(Math.floor(wy / PE.TILE), 0, PE.GH - 1);
    return this.dist[ty * PE.GW + tx];
  },
};

/* ---------------- 设置 ---------------- */
PE.settings = { music: 0.7, sfx: 0.8, shake: true, lang: 'zh' };

/* ---------------- 游戏循环（固定步长 60Hz） ---------------- */
PE.loop = {
  last: 0, acc: 0, STEP: 1 / 60, fps: 60, _fpsAcc: 0, _fpsN: 0, running: false, _errAt: 0,
  // 任何一帧的异常都不能中断 rAF 链（否则整个游戏冻结）
  _err(err) {
    const now = performance.now();
    if (now - this._errAt > 2000) { this._errAt = now; console.error('[PE]', err); }
  },
  start() {
    if (this.running) return; this.running = true;
    this.last = performance.now();
    const frame = now => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000; this.last = now;
      if (dt > 0.25) dt = 0.25; // 后台切回防雪崩
      this._fpsAcc += dt; this._fpsN++;
      if (this._fpsAcc >= 1) { this.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; PE.autoQuality(); }
      this.acc += dt;
      let steps = 0;
      while (this.acc >= this.STEP && steps < 5) {
        if (PE.hitstop > 0) { PE.hitstop -= this.STEP; }
        else { PE.time += this.STEP; try { PE.main.update(this.STEP); } catch (err) { this._err(err); } }
        this.acc -= this.STEP; steps++;
      }
      try { PE.main.render(); } catch (err) { this._err(err); }
      PE.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },
};
PE.autoQuality = () => {
  if (PE.loop.fps < 40 && PE.quality > 0) PE.quality--;
  else if (PE.loop.fps > 57 && PE.quality < 2) PE.quality++;
};

/* ---------------- 画布初始化与缩放 ---------------- */
PE.initCanvas = () => {
  const cv = document.getElementById('game');
  PE.canvas = cv; PE.ctx = cv.getContext('2d');
  const resize = () => {
    PE.DPR = Math.min(window.devicePixelRatio || 1, 2);
    PE.W = window.innerWidth; PE.H = window.innerHeight;
    cv.width = Math.floor(PE.W * PE.DPR); cv.height = Math.floor(PE.H * PE.DPR);
    cv.style.width = PE.W + 'px'; cv.style.height = PE.H + 'px';
    // UI 缩放：触屏更大；小屏适配
    PE.ui_s = (PE.isTouch ? 1.25 : 1) * PE.U.clamp(Math.min(PE.W / 1280, PE.H / 720), 0.72, 1.35);
    PE.cam.targetZoom = PE.U.clamp(Math.min(PE.W / 1280, PE.H / 720), 0.8, 1.25) * (PE.isTouch ? 0.9 : 1);
  };
  window.addEventListener('resize', resize); resize();
  window.addEventListener('blur', () => { if (PE.state === 'run' && !PE.paused) PE.paused = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && PE.state === 'run') PE.paused = true; });
};
