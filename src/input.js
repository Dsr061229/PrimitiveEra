/* ============================================================
   原始纪元 · input.js —— 键鼠 + 触屏统一动作层
   逻辑层只读: mv() 移动向量 | aim() 瞄准角 | held(a) | pressed(a)
   UI 层读取: taps[] 本帧点击/轻触(屏幕坐标) | pointer 当前位置
   ============================================================ */
'use strict';
PE.input = (() => {
  const keys = {}, prevKeys = {};
  const KEYMAP = {
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Space: 'roll', KeyE: 'interact', KeyB: 'build', KeyT: 'tech', KeyF: 'shop',
    Escape: 'pause', Tab: 'panel', KeyQ: 'swap', KeyR: 'repair',
    Digit1: 'hot1', Digit2: 'hot2', Digit3: 'hot3', Digit4: 'hot4', Digit5: 'hot5', Digit6: 'hot6',
  };
  const st = {
    taps: [],            // {x,y} 本帧结束的点击（UI 消费）
    rtaps: [],           // {x,y} 右键点击（取消建造/拆除建筑）
    pointer: { x: 0, y: 0, down: false },
    mouse: { x: 0, y: 0, down: false },
    joy: null,           // {ox,oy,x,y} 虚拟摇杆
    tbtn: {},            // 触屏按钮按下状态 name->bool（HUD 注册矩形）
    tbtnRects: {},       // name->{x,y,r}
    _pressed: new Set(), // 边沿触发动作
    uiHot: false,        // 本帧指针是否被 UI 面板捕获
  };

  function actDown(a) { st._pressed.add(a); keys[a] = true; }
  function actUp(a) { keys[a] = false; }

  window.addEventListener('keydown', e => {
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    const a = KEYMAP[e.code]; if (a && !e.repeat) actDown(a);
  });
  window.addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) actUp(a); });
  window.addEventListener('contextmenu', e => e.preventDefault());

  const cvPos = e => ({ x: e.clientX, y: e.clientY });
  window.addEventListener('mousemove', e => { const p = cvPos(e); st.mouse.x = p.x; st.mouse.y = p.y; st.pointer.x = p.x; st.pointer.y = p.y; });
  window.addEventListener('mousedown', e => {
    PE.audio.unlock();
    if (e.button === 2) { st.rtaps.push({ x: e.clientX, y: e.clientY, fresh: true }); return; }
    if (e.button !== 0) return;
    st.mouse.down = true; st.pointer.down = true;
    st.taps.push({ x: e.clientX, y: e.clientY, fresh: true });
  });
  window.addEventListener('mouseup', () => { st.mouse.down = false; st.pointer.down = false; });

  /* ---------- 触屏 ---------- */
  const touches = new Map(); // id -> {x,y,sx,sy,role:'joy'|'btn:xxx'|'tap'}
  function hitTBtn(x, y) {
    for (const name in st.tbtnRects) {
      const r = st.tbtnRects[name];
      if (PE.U.dist2(x, y, r.x, r.y) <= r.r * r.r) return name;
    }
    return null;
  }
  window.addEventListener('touchstart', e => {
    e.preventDefault(); PE.audio.unlock();
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;
      const btn = (PE.state === 'run' && !PE.ui.modalOpen()) ? hitTBtn(x, y) : null;
      if (btn) {
        touches.set(t.identifier, { x, y, role: 'btn:' + btn });
        st.tbtn[btn] = true; actDown(btn);
      } else if (PE.state === 'run' && !PE.ui.modalOpen() && x < PE.W * 0.45 && y > PE.H * 0.25) {
        touches.set(t.identifier, { x, y, sx: x, sy: y, role: 'joy' });
        st.joy = { ox: x, oy: y, x: 0, y: 0 };
      } else {
        touches.set(t.identifier, { x, y, sx: x, sy: y, role: 'tap' });
        st.pointer.x = x; st.pointer.y = y; st.pointer.down = true;
      }
    }
  }, { passive: false });
  window.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const rec = touches.get(t.identifier); if (!rec) continue;
      rec.x = t.clientX; rec.y = t.clientY;
      if (rec.role === 'joy' && st.joy) {
        const dx = rec.x - st.joy.ox, dy = rec.y - st.joy.oy, len = Math.hypot(dx, dy), max = 70 * PE.ui_s;
        const k = len > max ? max / len : 1;
        st.joy.x = dx * k / max; st.joy.y = dy * k / max;
      } else if (rec.role === 'tap') { st.pointer.x = rec.x; st.pointer.y = rec.y; }
    }
  }, { passive: false });
  const touchEnd = e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const rec = touches.get(t.identifier); if (!rec) continue;
      touches.delete(t.identifier);
      if (rec.role === 'joy') { st.joy = null; }
      else if (rec.role.startsWith('btn:')) { const n = rec.role.slice(4); st.tbtn[n] = false; actUp(n); }
      else {
        st.pointer.down = false;
        // 位移小视为轻触
        if (PE.U.dist(rec.x, rec.y, rec.sx, rec.sy) < 18) st.taps.push({ x: rec.x, y: rec.y, fresh: true });
      }
    }
  };
  window.addEventListener('touchend', touchEnd, { passive: false });
  window.addEventListener('touchcancel', touchEnd, { passive: false });

  /* ---------- 动作层 API ---------- */
  return {
    st,
    // 移动向量（归一化）
    mv() {
      if (st.joy) { const l = Math.hypot(st.joy.x, st.joy.y); return l > 0.15 ? { x: st.joy.x, y: st.joy.y, l: Math.min(l, 1) } : { x: 0, y: 0, l: 0 }; }
      let x = 0, y = 0;
      if (keys.up) y -= 1; if (keys.down) y += 1; if (keys.left) x -= 1; if (keys.right) x += 1;
      const l = Math.hypot(x, y); return l ? { x: x / l, y: y / l, l: 1 } : { x: 0, y: 0, l: 0 };
    },
    // 瞄准角：PC=鼠标方向；触屏=自动瞄准最近敌人，否则朝向移动方向
    aim(px, py) {
      if (!PE.isTouch || st.mouse.down) {
        const w = PE.cam.toWorld(st.mouse.x, st.mouse.y);
        return PE.U.ang(px, py, w.x, w.y);
      }
      const foes = PE.grid.query(px, py, 340, []).filter(e => e.kind === 'enemy' || e.kind === 'wild');
      if (foes.length) {
        foes.sort((a, b) => PE.U.dist2(px, py, a.x, a.y) - PE.U.dist2(px, py, b.x, b.y));
        return PE.U.ang(px, py, foes[0].x, foes[0].y);
      }
      const m = this.mv(); if (m.l) return Math.atan2(m.y, m.x);
      return PE.player ? PE.player.faceAng : 0;
    },
    held(a) { return !!keys[a] || !!st.tbtn[a]; },
    pressed(a) { return st._pressed.has(a); },
    attackHeld() { return (!PE.isTouch && st.mouse.down && !st.uiHot) || !!st.tbtn.atk || !!keys.atk; },
    // HUD 注册触屏圆形按钮
    regBtn(name, x, y, r) { st.tbtnRects[name] = { x, y, r }; },
    clearBtns() { st.tbtnRects = {}; },
    consumeTaps() { const t = st.taps.filter(t => t.fresh); return t; },
    eatTap(t) { t.fresh = false; },
    endFrame() { st._pressed.clear(); st.taps.length = 0; st.rtaps.length = 0; st.uiHot = false; },
  };
})();
