/* ============================================================
   原始纪元 · ui.js —— 即时模式 UI / HUD / 面板 / 菜单（双端自适应）
   ============================================================ */
'use strict';
PE.ui = (() => {
  const U = PE.U;
  const ui = {
    panel: null, panelArg: null,      // 'build'|'shop'|'craft'|'tech'|'vill'|'tribe'
    modal: null, modalData: null,     // 'dawn'|'event'|'blessing'|'gate'
    toasts: [], forecastT: 0, forecast: null,
    uiRects: [], _newRects: [],
  };
  const F = s => `${Math.round(s * PE.ui_s)}px sans-serif`;
  const FB = s => `bold ${Math.round(s * PE.ui_s)}px sans-serif`;
  const sc = v => v * PE.ui_s;

  /* ---------- 基础控件 ---------- */
  function regRect(x, y, w, h) { ui._newRects.push({ x, y, w, h }); }
  ui.overUI = (x, y) => ui.uiRects.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  function hit(x, y, w, h) {
    for (const t of PE.input.st.taps) {
      if (t.fresh && t.x >= x && t.x <= x + w && t.y >= y && t.y <= y + h) { PE.input.eatTap(t); PE.audio.sfx('ui'); return true; }
    }
    return false;
  }
  function hover(x, y, w, h) {
    const p = PE.input.st.pointer;
    const over = p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
    if (over) PE.input.st.uiHot = true;
    return over;
  }
  function btn(ctx, x, y, w, h, label, opt = {}) {
    regRect(x, y, w, h);
    const hov = hover(x, y, w, h) && !opt.disabled;
    ctx.fillStyle = opt.disabled ? 'rgba(60,55,48,0.85)' : hov ? (opt.color || '#7a5a36') : (opt.color2 || '#5c4428');
    PE.S.rr(ctx, x, y, w, h, sc(8)); ctx.fill();
    ctx.strokeStyle = opt.disabled ? '#4a4238' : '#2a1e12'; ctx.lineWidth = 2; ctx.stroke();
    if (!opt.disabled) { ctx.strokeStyle = 'rgba(255,230,180,0.25)'; ctx.lineWidth = 1; PE.S.rr(ctx, x + 2, y + 2, w - 4, h - 4, sc(6)); ctx.stroke(); }
    ctx.fillStyle = opt.disabled ? '#8a8272' : '#f0e6cc';
    ctx.font = opt.font || FB(15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    return !opt.disabled && hit(x, y, w, h);
  }
  function panelBg(ctx, x, y, w, h, title) {
    regRect(x, y, w, h);
    hover(x, y, w, h);
    ctx.fillStyle = 'rgba(30,24,18,0.94)';
    PE.S.rr(ctx, x, y, w, h, sc(14)); ctx.fill();
    ctx.strokeStyle = '#6e5636'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(240,220,170,0.12)'; ctx.lineWidth = 1;
    PE.S.rr(ctx, x + 4, y + 4, w - 8, h - 8, sc(11)); ctx.stroke();
    if (title) {
      ctx.fillStyle = '#e8cf9a'; ctx.font = FB(20); ctx.textAlign = 'center';
      ctx.fillText(title, x + w / 2, y + sc(32));
      ctx.strokeStyle = 'rgba(200,170,110,0.35)';
      ctx.beginPath(); ctx.moveTo(x + sc(20), y + sc(44)); ctx.lineTo(x + w - sc(20), y + sc(44)); ctx.stroke();
    }
  }
  function costText(cost) {
    const parts = [];
    for (const k in cost) parts.push((k === 'ember' ? '🔥' : PE.D.RES[k].name) + cost[k]);
    return parts.join(' ');
  }
  function bar(ctx, x, y, w, h, v01, c, bg = 'rgba(15,12,10,0.8)') {
    ctx.fillStyle = bg; PE.S.rr(ctx, x, y, w, h, h / 2); ctx.fill();
    if (v01 > 0.01) { ctx.fillStyle = c; PE.S.rr(ctx, x + 1.5, y + 1.5, Math.max(h - 3, (w - 3) * U.clamp(v01, 0, 1)), h - 3, (h - 3) / 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; PE.S.rr(ctx, x, y, w, h, h / 2); ctx.stroke();
  }

  /* ---------- 公共 API ---------- */
  ui.toast = (msg, color = '#f0e6cc') => {
    ui.toasts.push({ msg, color, t: 4.5 });
    if (ui.toasts.length > 5) ui.toasts.shift();
  };
  ui.openPanel = (name, arg) => { ui.panel = name; ui.panelArg = arg; PE.sys.build.exit(); PE.audio.sfx('ui'); };
  ui.closePanel = () => { ui.panel = null; };
  ui.modalOpen = () => !!(ui.modal || ui.panel);
  ui.showDawn = reward => { ui.modal = 'dawn'; ui.modalData = { reward, day: PE.world.day, kills: PE.world.kills }; };
  ui.showForecast = () => { ui.forecast = PE.enemies.director.forecast(); ui.forecastT = 12; };
  ui.showGateChoice = () => { ui.modal = 'gate'; };
  ui.offerBlessing = () => { ui.modal = 'blessing'; ui.modalData = { opts: PE.sys.bless.offer() }; };

  /* ---------- HUD ---------- */
  function drawHUD(ctx) {
    const W = PE.world, P = PE.player;
    const m = sc(12);
    // 左上：状态条
    let y = m;
    const bw = sc(190), bh = sc(16);
    bar(ctx, m, y, bw, bh, P.hp / P.maxhp, P.hp < P.maxhp * 0.3 ? '#d84a2e' : '#c0392b');
    ctx.fillStyle = '#fff'; ctx.font = F(11); ctx.textAlign = 'left';
    ctx.fillText(`${Math.ceil(P.hp)}/${P.maxhp}`, m + sc(6), y + bh - sc(4));
    if (P.shield > 0) bar(ctx, m + bw * (P.hp / P.maxhp), y, bw * Math.min(P.shield / P.maxhp, 1 - P.hp / P.maxhp), bh, 1, 'rgba(109,220,255,0.8)', 'rgba(0,0,0,0)');
    y += bh + sc(4);
    bar(ctx, m, y, bw * 0.8, sc(9), P.sta / 100, '#5da45a'); y += sc(13);
    bar(ctx, m, y, bw * 0.8, sc(9), P.hunger / 100, '#e0913d'); y += sc(13);
    if (W.season() === 'snow') { bar(ctx, m, y, bw * 0.8, sc(9), P.warmth / 100, '#6db8e8'); y += sc(13); }
    if (W.fear > 5) { bar(ctx, m, y, bw * 0.8, sc(9), W.fear / 100, '#b06dff'); ctx.fillStyle = '#b06dff'; ctx.font = F(10); ctx.fillText('恐惧', m + bw * 0.8 + sc(5), y + sc(8)); y += sc(13); }
    // 篝火状态
    const cf = W.campfire;
    if (cf) {
      y += sc(4);
      ctx.drawImage(PE.S.icon('ember', 22), m, y);
      bar(ctx, m + sc(26), y + sc(4), bw * 0.6, sc(11), cf.hp / cf.maxhp, '#ff7b3d');
      ctx.fillStyle = cf.fuelOk ? '#c9c2a8' : '#ff5a4a'; ctx.font = F(11);
      ctx.fillText(cf.fuelOk ? `篝火 Lv${cf.lvl}` : '⚠缺燃料!', m + sc(26) + bw * 0.6 + sc(6), y + sc(13));
      y += sc(22);
    }
    // 顶中：时钟 + 天数
    const cx = PE.W / 2, cy = m + sc(30), cr = sc(26);
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, U.TAU);
    ctx.fillStyle = 'rgba(20,16,12,0.75)'; ctx.fill();
    const c01 = W.clock01();
    const dayFrac = PE.D.BAL.DAY_LEN / (PE.D.BAL.DAY_LEN + PE.D.BAL.DUSK_LEN + PE.D.BAL.NIGHT_LEN);
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, cr - 2, -Math.PI / 2, -Math.PI / 2 + c01 * U.TAU);
    ctx.fillStyle = W.phase === 'day' ? 'rgba(255,200,90,0.85)' : W.phase === 'dusk' ? 'rgba(255,120,60,0.85)' : 'rgba(90,110,220,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#6e5636'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, U.TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = FB(15); ctx.textAlign = 'center';
    ctx.fillText('第' + W.day + '夜', cx, cy + sc(5));
    // 天气/血月
    ctx.font = F(14);
    const wIcon = W.weather === 'rain' ? '🌧' : W.weather === 'fog' ? '🌫' : '☀';
    ctx.fillText(wIcon + (W.bloodmoon || W.bloodmoonQueued ? ' 🔴' : ''), cx, cy + cr + sc(16));
    if (W.day === 5 || W.day === 10 || W.day === 15) { ctx.fillStyle = '#ff8f7a'; ctx.font = FB(11); ctx.fillText('⚠ Boss夜', cx, cy - cr - sc(6)); }
    // 右上：火种 + 资源
    ctx.textAlign = 'right'; ctx.font = FB(17);
    ctx.fillStyle = '#ffb86b';
    ctx.drawImage(PE.S.icon('ember', 24), PE.W - m - sc(88), m);
    ctx.fillText(U.fmt(W.ember), PE.W - m, m + sc(18));
    let ry = m + sc(30);
    ctx.font = F(12.5);
    const showRes = ['wood', 'stone', 'food', 'fur', 'flint', 'bone', 'clay', 'herb', 'obsidian', 'star'];
    let col = 0;
    for (const k of showRes) {
      const v = W.res[k] || 0;
      if (v <= 0 && !['wood', 'stone', 'food'].includes(k)) continue;
      const rx = PE.W - m - col * sc(74);
      ctx.drawImage(PE.S.icon(k, 18), rx - sc(60), ry);
      ctx.fillStyle = '#e8dfc8';
      ctx.fillText(v, rx, ry + sc(14));
      col++;
      if (col >= 2) { col = 0; ry += sc(22); }
    }
    if (col > 0) ry += sc(22);
    if (W.arrows > 0) { ctx.drawImage(PE.S.icon('arrows', 18), PE.W - m - sc(60), ry); ctx.fillText(W.arrows, PE.W - m, ry + sc(14)); ry += sc(22); }
    // 底中：快捷栏
    const hbN = P.hotbar.length, hbS = sc(52), hbGap = sc(8);
    const hbX = PE.W / 2 - (hbN * hbS + (hbN - 1) * hbGap) / 2, hbY = PE.H - hbS - sc(10);
    for (let i = 0; i < hbN; i++) {
      const x = hbX + i * (hbS + hbGap), it = P.hotbar[i];
      regRect(x, hbY, hbS, hbS); hover(x, hbY, hbS, hbS);
      ctx.fillStyle = i === P.sel ? 'rgba(120,90,50,0.92)' : 'rgba(35,28,20,0.85)';
      PE.S.rr(ctx, x, hbY, hbS, hbS, sc(8)); ctx.fill();
      ctx.strokeStyle = i === P.sel ? '#ffcf5f' : '#5c4428'; ctx.lineWidth = i === P.sel ? 2.5 : 2; ctx.stroke();
      ctx.drawImage(PE.S.icon(it.id, 34), x + hbS / 2 - 17, hbY + hbS / 2 - 20);
      ctx.fillStyle = '#c9c2a8'; ctx.font = F(10); ctx.textAlign = 'center';
      const label = it.kind === 'weapon' ? PE.D.WEAPONS[it.id].name : PE.D.USABLES[it.id].name;
      ctx.fillText(label.slice(0, 5), x + hbS / 2, hbY + hbS - sc(4));
      // 数量
      if (it.kind === 'usable' && it.id !== 'torch' && it.id !== 'meat') {
        ctx.fillStyle = '#ffcf5f'; ctx.font = FB(12); ctx.textAlign = 'right';
        ctx.fillText(P.usables[it.id] || 0, x + hbS - sc(4), hbY + sc(14));
      }
      if (!PE.isTouch) { ctx.fillStyle = 'rgba(240,230,200,0.5)'; ctx.font = F(9); ctx.textAlign = 'left'; ctx.fillText(i + 1, x + sc(3), hbY + sc(11)); }
      if (hit(x, hbY, hbS, hbS)) { P.sel = i; P.hotbarSel = P.hotbar[i]; }
    }
    // 底左：小地图
    drawMinimap(ctx);
    // 右侧功能按钮
    const fbS = sc(46);
    let fy = PE.H / 2 - fbS * 2.6;
    const fx = PE.W - fbS - sc(8);
    if (btn(ctx, fx, fy, fbS, fbS, '🏗', { font: F(22) })) { ui.panel = ui.panel === 'build' ? null : 'build'; } fy += fbS + sc(7);
    if (btn(ctx, fx, fy, fbS, fbS, '🔬', { font: F(22) })) { ui.panel = ui.panel === 'tech' ? null : 'tech'; } fy += fbS + sc(7);
    if (btn(ctx, fx, fy, fbS, fbS, '🛒', { font: F(22) })) { ui.panel = ui.panel === 'shop' ? null : 'shop'; } fy += fbS + sc(7);
    if (btn(ctx, fx, fy, fbS, fbS, '👥', { font: F(22) })) { ui.panel = ui.panel === 'vill' ? null : 'vill'; } fy += fbS + sc(7);
    const repCost = PE.sys.repairAllCost();
    if (repCost > 0) { if (btn(ctx, fx, fy, fbS, fbS, '🔨' + repCost, { font: F(13), color: '#7a6236' })) PE.sys.repairAll(); fy += fbS + sc(7); }
    if (PE.sys.tech.has('bloodrite') && W.phase === 'day' && !W.bloodmoonQueued) {
      if (btn(ctx, fx, fy, fbS, fbS, '🌕', { font: F(20), color: '#8a3a3a', color2: '#6a2a2a' })) PE.sys.bloodRitual();
      fy += fbS + sc(7);
    }
    if (btn(ctx, fx, fy, fbS, fbS, '⏸', { font: F(20) })) PE.paused = true;
    // 触屏操作按钮
    if (PE.isTouch) drawTouchControls(ctx);
    // 黄昏敌情预告
    if (ui.forecastT > 0 && ui.forecast) {
      ui.forecastT -= 1 / 60;
      const f = ui.forecast;
      const fw = sc(360), fh = sc(58), fx2 = PE.W / 2 - fw / 2, fy2 = sc(96);
      ctx.fillStyle = 'rgba(40,18,14,0.88)'; PE.S.rr(ctx, fx2, fy2, fw, fh, sc(10)); ctx.fill();
      ctx.strokeStyle = f.blood ? '#c22e2e' : '#6e5636'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = f.blood ? '#ff8f7a' : '#e8cf9a'; ctx.font = FB(14); ctx.textAlign = 'center';
      ctx.fillText((f.blood ? '🔴 血月之夜! ' : '🌙 今夜敌情: ') + (f.boss ? '【Boss来袭】' : '') + (f.raid ? '【部落夜袭】' : ''), PE.W / 2, fy2 + sc(22));
      ctx.font = F(13); ctx.fillStyle = '#d8cfc0';
      ctx.fillText(f.text + (f.exact ? '' : ' (侦查不足,情报模糊)'), PE.W / 2, fy2 + sc(43));
    }
    // 夜袭方向箭头
    if ((W.phase === 'night' || W.phase === 'dusk') && PE.enemies.director.plan) {
      for (const a of PE.enemies.director.plan.dirs) {
        const ax = PE.W / 2 + Math.cos(a) * Math.min(PE.W, PE.H) * 0.38;
        const ay = PE.H / 2 + Math.sin(a) * Math.min(PE.W, PE.H) * 0.38;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
        const pulse = 0.6 + Math.sin(PE.time * 5) * 0.4;
        ctx.fillStyle = `rgba(220,70,50,${pulse})`;
        ctx.beginPath(); ctx.moveTo(sc(14), 0); ctx.lineTo(-sc(6), -sc(9)); ctx.lineTo(-sc(6), sc(9)); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    // Boss 血条
    for (const e of W.ents) {
      if (!e.dead && e.boss) {
        const bw2 = Math.min(sc(420), PE.W * 0.6), bx = PE.W / 2 - bw2 / 2, by = sc(64);
        ctx.fillStyle = '#f0e6cc'; ctx.font = FB(14); ctx.textAlign = 'center';
        ctx.fillText(e.def.name, PE.W / 2, by - sc(4));
        bar(ctx, bx, by, bw2, sc(12), e.hp / e.maxhp, '#b02eff');
        break;
      }
    }
    // 梦魇位面：记忆篝火计量
    if (W.nightmare && W.memfire) {
      const bw2 = sc(280), bx = PE.W / 2 - bw2 / 2, by = sc(44);
      ctx.fillStyle = '#ffcf5f'; ctx.font = FB(12); ctx.textAlign = 'center';
      ctx.fillText('记忆篝火', PE.W / 2, by - sc(2));
      bar(ctx, bx, by, bw2, sc(10), (W.memfire.r - 50) / 250, '#ff9b3d');
    }
    // 交互提示
    drawInteractHint(ctx);
    // 屏幕效果：低血红晕 / 恐惧紫晕
    if (P.hp < P.maxhp * 0.35 || W.fear > 40) {
      const a = P.hp < P.maxhp * 0.35 ? (1 - P.hp / (P.maxhp * 0.35)) * 0.4 : 0;
      const fa = W.fear > 40 ? (W.fear - 40) / 60 * 0.35 : 0;
      const g = ctx.createRadialGradient(PE.W / 2, PE.H / 2, Math.min(PE.W, PE.H) * 0.3, PE.W / 2, PE.H / 2, Math.max(PE.W, PE.H) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, a > fa ? `rgba(180,30,20,${a + Math.sin(PE.time * 6) * 0.05})` : `rgba(120,40,180,${fa})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, PE.W, PE.H);
    }
  }

  function drawMinimap(ctx) {
    const W = PE.world;
    const ms = sc(140), mx = sc(10), my = PE.H - ms - sc(10);
    regRect(mx, my, ms, ms); hover(mx, my, ms, ms);
    ctx.save();
    ctx.globalAlpha = 0.92;
    PE.S.rr(ctx, mx, my, ms, ms, sc(8)); ctx.clip();
    ctx.drawImage(W.miniCv, mx, my, ms, ms);
    // 迷雾
    const k = ms / PE.MAPW, fc = W.FOGC * k * (PE.MAPW / (W.FOGC * W.FOGN));
    ctx.fillStyle = 'rgba(10,10,16,0.85)';
    const cell = ms / W.FOGN;
    for (let gy = 0; gy < W.FOGN; gy++) for (let gx = 0; gx < W.FOGN; gx++) {
      if (!W.fog[gy * W.FOGN + gx]) ctx.fillRect(mx + gx * cell, my + gy * cell, cell + 0.5, cell + 0.5);
    }
    // 标记
    const dot = (x, y, c, r = 2.5) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(mx + x * k, my + y * k, sc(r), 0, U.TAU); ctx.fill(); };
    dot(W.camp.x, W.camp.y, '#ffb86b', 3.5);
    for (const p of W.pois) {
      if (p.kind === 'tribecamp' && !W.fogAt(p.x, p.y)) dot(p.x, p.y, PE.D.TRIBES[p.tribe].color, 3);
      if (p.kind === 'painting' && !p.found && !W.fogAt(p.x, p.y)) dot(p.x, p.y, '#ffcf5f', 2);
      if (p.kind === 'chest' && !p.taken && !W.fogAt(p.x, p.y)) dot(p.x, p.y, '#e8b93d', 2);
    }
    for (const n of W.nodes) if (n.type === 'star' && !n.dead && !W.fogAt(n.x, n.y)) dot(n.x, n.y, '#7fd7e8', 2.5);
    for (const e of W.ents) if (!e.dead && e.kind === 'enemy' && !W.fogAt(e.x, e.y)) dot(e.x, e.y, '#ff4a3d', 1.8);
    dot(PE.player.x, PE.player.y, '#fff', 3);
    ctx.restore();
    ctx.strokeStyle = '#6e5636'; ctx.lineWidth = 2; PE.S.rr(ctx, mx, my, ms, ms, sc(8)); ctx.stroke();
  }

  function drawTouchControls(ctx) {
    // 虚拟摇杆
    const j = PE.input.st.joy;
    if (j) {
      ctx.strokeStyle = 'rgba(240,230,200,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(j.ox, j.oy, sc(56), 0, U.TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(240,230,200,0.4)';
      ctx.beginPath(); ctx.arc(j.ox + j.x * sc(56), j.oy + j.y * sc(56), sc(26), 0, U.TAU); ctx.fill();
    }
    // 动作按钮
    const bs = sc(42);
    const defs = [
      ['atk', '⚔', PE.W - sc(76), PE.H - sc(96), sc(50)],
      ['roll', '💨', PE.W - sc(160), PE.H - sc(66), bs],
      ['interact', '✋', PE.W - sc(66), PE.H - sc(190), bs],
    ];
    for (const [name, icon, x, y, r] of defs) {
      PE.input.regBtn(name, x, y, r * 1.25);
      const on = PE.input.st.tbtn[name];
      ctx.fillStyle = on ? 'rgba(200,150,80,0.75)' : 'rgba(50,40,30,0.62)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(240,220,180,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#f0e6cc'; ctx.font = F(r * 0.7 / PE.ui_s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icon, x, y); ctx.textBaseline = 'alphabetic';
    }
  }

  function drawInteractHint(ctx) {
    const P = PE.player, W = PE.world;
    if (ui.modalOpen()) return;
    let hint = null;
    if (P.fishing) hint = P.fishing.window > 0 ? '❗收杆!' : '等待鱼儿上钩…';
    else {
      for (const poi of W.pois) {
        if (U.dist2(P.x, P.y, poi.x, poi.y) > 70 * 70) continue;
        if (poi.kind === 'painting' && !poi.found) hint = '查看壁画';
        else if (poi.kind === 'artifact' && !poi.taken) hint = '触碰神器祭坛';
        else if (poi.kind === 'eagle' && !poi.used) hint = '仰望巨鹰';
        else if (poi.kind === 'chest' && !poi.taken) hint = '打开遗落的宝箱';
        else if (poi.kind === 'tribecamp') hint = '拜访' + PE.D.TRIBES[poi.tribe].name;
      }
      if (!hint) {
        for (const e of PE.grid.query(P.x, P.y, 70, [])) {
          if (e.kind === 'npc') { hint = '与商人交谈'; break; }
          if (e.kind === 'wild' && e.tameable && e.hp < e.maxhp * 0.5) { hint = '驯服'; break; }
          if (e.kind === 'pet' && PE.D.PETS[e.type].ride && !P.mount) { hint = '骑乘'; break; }
        }
      }
      if (!hint) for (const n of W.nodes) if (n.fish && U.dist2(P.x, P.y, n.x, n.y) < 90 * 90) { hint = '钓鱼'; break; }
      if (!hint && W.campfire && U.dist2(P.x, P.y, W.campfire.x, W.campfire.y) < 90 * 90) hint = '图腾商店';
      if (!hint) for (const b of W.buildings) {
        if (b.dead || U.dist2(P.x, P.y, b.x, b.y) > 70 * 70) continue;
        if (b.def.craft) { hint = '打造装备'; break; }
        if (b.def.research) { hint = '研究科技'; break; }
      }
    }
    if (hint) {
      const s = PE.cam.toScreen(P.x, P.y);
      ctx.fillStyle = 'rgba(20,16,12,0.85)'; ctx.font = F(13); ctx.textAlign = 'center';
      const tw = ctx.measureText(hint).width + sc(30);
      PE.S.rr(ctx, s.x - tw / 2, s.y - sc(78), tw, sc(24), sc(6)); ctx.fill();
      ctx.fillStyle = '#ffcf5f';
      ctx.fillText((PE.isTouch ? '✋ ' : '[E] ') + hint, s.x, s.y - sc(61));
    }
  }

  /* ---------- 面板 ---------- */
  function drawPanels(ctx) {
    if (!ui.panel) return;
    const pw = Math.min(sc(620), PE.W - sc(20)), ph = Math.min(sc(460), PE.H - sc(20));
    const px = PE.W / 2 - pw / 2, py = PE.H / 2 - ph / 2;
    const titles = { build: '🏗 建造', shop: '🛒 图腾商店', craft: '⚒ 工作台', tech: '🔬 部落科技', vill: '👥 村民', tribe: '🤝 部落外交' };
    panelBg(ctx, px, py, pw, ph, titles[ui.panel]);
    if (btn(ctx, px + pw - sc(44), py + sc(8), sc(36), sc(36), '✕')) ui.closePanel();
    const cx = px + sc(16), cy = py + sc(56), cw = pw - sc(32);
    ctx.textAlign = 'left';
    if (ui.panel === 'build') drawBuild(ctx, cx, cy, cw, ph - sc(70));
    else if (ui.panel === 'shop') drawShop(ctx, cx, cy, cw);
    else if (ui.panel === 'craft') drawCraft(ctx, cx, cy, cw);
    else if (ui.panel === 'tech') drawTech(ctx, cx, cy, cw, ph - sc(70));
    else if (ui.panel === 'vill') drawVill(ctx, cx, cy, cw);
    else if (ui.panel === 'tribe') drawTribe(ctx, cx, cy, cw);
  }

  function drawBuild(ctx, x, y, w, h) {
    const list = PE.sys.build.available();
    const bs = sc(102), gap = sc(8), cols = Math.floor(w / (bs + gap));
    list.forEach((id, i) => {
      const d = PE.D.BUILDINGS[id];
      const bx = x + (i % cols) * (bs + gap), by = y + Math.floor(i / cols) * (bs * 0.82 + gap);
      const afford = PE.world.canPay(PE.world.buildCost(d));
      const maxed = d.max && PE.sys.build.count(id) >= d.max;
      regRect(bx, by, bs, bs * 0.78); hover(bx, by, bs, bs * 0.78);
      ctx.fillStyle = maxed ? 'rgba(50,45,40,0.8)' : afford ? 'rgba(70,55,35,0.9)' : 'rgba(55,42,35,0.7)';
      PE.S.rr(ctx, bx, by, bs, bs * 0.78, sc(8)); ctx.fill();
      ctx.strokeStyle = '#5c4428'; ctx.lineWidth = 2; ctx.stroke();
      // 迷你精灵
      ctx.save(); ctx.translate(bx + bs / 2, by + bs * 0.46); ctx.scale(0.85, 0.85);
      PE.S.drawBuilding(ctx, { type: id, def: d, hp: 1, maxhp: 1, lvl: 1, x: 0, y: 0, fuelOk: true, cat: d.cat }, PE.time);
      ctx.restore();
      ctx.fillStyle = afford && !maxed ? '#f0e6cc' : '#8a8272'; ctx.font = FB(12); ctx.textAlign = 'center';
      ctx.fillText(d.name + (maxed ? '(满)' : ''), bx + bs / 2, by + bs * 0.58);
      ctx.font = F(10); ctx.fillStyle = afford ? '#c9b98a' : '#a06a5a';
      ctx.fillText(costText(PE.world.buildCost(d)), bx + bs / 2, by + bs * 0.71);
      if (!maxed && hit(bx, by, bs, bs * 0.78)) {
        if (afford) { PE.sys.build.enter(id); ui.closePanel(); }
        else PE.audio.sfx('error');
      }
    });
    // 拆除模式入口（触屏可用；PC 也可直接右键点建筑拆除）
    const di = list.length;
    const cols2 = Math.floor(w / (sc(102) + sc(8)));
    const dbs = sc(102), dgap = sc(8);
    const dx = x + (di % cols2) * (dbs + dgap), dy = y + Math.floor(di / cols2) * (dbs * 0.82 + dgap);
    regRect(dx, dy, dbs, dbs * 0.78); hover(dx, dy, dbs, dbs * 0.78);
    ctx.fillStyle = 'rgba(96,46,36,0.92)';
    PE.S.rr(ctx, dx, dy, dbs, dbs * 0.78, sc(8)); ctx.fill();
    ctx.strokeStyle = '#8a4a34'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffb09a'; ctx.font = FB(24); ctx.textAlign = 'center';
    ctx.fillText('⛏', dx + dbs / 2, dy + dbs * 0.4);
    ctx.font = FB(12); ctx.fillText('拆除模式', dx + dbs / 2, dy + dbs * 0.58);
    ctx.font = F(10); ctx.fillStyle = '#d8a08a';
    ctx.fillText('返还50%材料', dx + dbs / 2, dy + dbs * 0.71);
    if (hit(dx, dy, dbs, dbs * 0.78)) { PE.sys.build.enter('demolish'); ui.closePanel(); }
    ctx.fillStyle = '#8a8272'; ctx.font = F(11); ctx.textAlign = 'center';
    ctx.fillText('点地面放置 · 点已有墙原位升级 · 右键点建筑=直接拆除(返还50%)', x + w / 2, y + h - sc(4));
  }

  function drawShop(ctx, x, y, w) {
    const cf = PE.world.campfire;
    if (cf) {
      ctx.fillStyle = '#ffb86b'; ctx.font = FB(13); ctx.textAlign = 'left';
      ctx.fillText(`长明篝火 Lv${cf.lvl}/5 · 产出 ${(PE.D.BAL.FIRE_OUT_BASE * cf.lvl * (1 + (PE.mods.fireout || 0))).toFixed(1)} 火种/秒`, x + sc(4), y + sc(8));
    }
    PE.D.SHOP.forEach((it, i) => {
      const by = y + sc(16) + i * sc(44);
      ctx.fillStyle = '#f0e6cc'; ctx.font = F(14); ctx.textAlign = 'left';
      ctx.fillText(it.name, x + sc(8), by + sc(24));
      let price = it.ember, dis = false, label = null;
      if (it.id === 'buy_repair') { price = PE.sys.repairAllCost(); dis = price <= 0; }
      if (it.id === 'buy_upfire') {
        const c = PE.sys.fireUpCost();
        if (c === null) { dis = true; label = '已满级'; } else price = c;
      }
      if (btn(ctx, x + w - sc(120), by + sc(2), sc(112), sc(34), label || ('🔥 ' + price), { disabled: dis || PE.world.ember < price })) PE.sys.shopBuy(it);
    });
  }

  function drawCraft(ctx, x, y, w) {
    let row = 0;
    for (const id in PE.D.CRAFT) {
      const r = PE.D.CRAFT[id];
      if (r.tech && !PE.sys.tech.has(r.tech)) continue;
      // 已拥有的武器/工具/护甲不再显示
      if (r.kind === 'weapon' && PE.player.weapons.includes(r.out)) continue;
      if (r.kind === 'tool' && PE.player.toolTier >= (r.out === 'tool3' ? 3 : 2)) continue;
      if (r.kind === 'armor' && PE.player.armor) continue;
      const by = y + row * sc(42);
      const name = r.name || PE.D.WEAPONS[r.out].name;
      const desc = r.desc !== undefined ? r.desc : (PE.D.WEAPONS[r.out] ? PE.D.WEAPONS[r.out].desc : '');
      ctx.drawImage(PE.S.icon(r.out, 26), x, by + sc(4));
      ctx.fillStyle = '#f0e6cc'; ctx.font = F(14); ctx.textAlign = 'left';
      ctx.fillText(name, x + sc(34), by + sc(18));
      ctx.fillStyle = '#9a917c'; ctx.font = F(10.5);
      ctx.fillText(desc.slice(0, 26), x + sc(34), by + sc(33));
      let cost = r.cost;
      if (id === 'arrows' && PE.mods.arrowcost) { cost = {}; for (const k in r.cost) cost[k] = Math.max(1, Math.ceil(r.cost[k] * 0.5)); }
      if (btn(ctx, x + w - sc(170), by + sc(4), sc(162), sc(32), costText(cost), { font: F(12), disabled: !PE.world.canPay(cost) })) PE.sys.craftBuy(id);
      row++;
    }
    if (row === 0) { ctx.fillStyle = '#8a8272'; ctx.font = F(13); ctx.fillText('暂无可打造的东西（研究更多科技解锁）', x, y + sc(20)); }
  }

  function drawTech(ctx, x, y, w, h) {
    const T = PE.sys.tech;
    const brs = [['surv', '🌿 生存', '#5da45a'], ['war', '⚔ 战争', '#c25b3a'], ['myst', '🔮 巫术', '#8a5ad0']];
    const colW = w / 3;
    brs.forEach(([br, label, color], bi) => {
      const bx = x + bi * colW;
      ctx.fillStyle = color; ctx.font = FB(14); ctx.textAlign = 'center';
      ctx.fillText(label, bx + colW / 2, y + sc(12));
      let row = 0;
      for (const id in PE.D.TECH) {
        const t = PE.D.TECH[id];
        if (t.br !== br) continue;
        const ty = y + sc(24) + row * sc(56);
        const done = T.has(id), researching = T.researching === id;
        const locked = t.req && !T.has(t.req);
        const bw2 = colW - sc(10);
        regRect(bx + sc(5), ty, bw2, sc(50)); hover(bx + sc(5), ty, bw2, sc(50));
        ctx.fillStyle = done ? 'rgba(60,90,55,0.55)' : researching ? 'rgba(90,80,40,0.8)' : locked ? 'rgba(40,36,32,0.7)' : 'rgba(60,50,36,0.9)';
        PE.S.rr(ctx, bx + sc(5), ty, bw2, sc(50), sc(6)); ctx.fill();
        ctx.strokeStyle = done ? '#5da45a' : '#4a3a26'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = done ? '#9adf8a' : locked ? '#6a6355' : '#f0e6cc'; ctx.font = FB(12); ctx.textAlign = 'left';
        ctx.fillText((done ? '✓ ' : '') + t.name, bx + sc(11), ty + sc(16));
        ctx.font = F(9.5); ctx.fillStyle = locked ? '#5a5348' : '#a89c80';
        wrapText(ctx, t.desc, bx + sc(11), ty + sc(29), bw2 - sc(12), sc(11), 2);
        if (researching) {
          bar(ctx, bx + sc(9), ty + sc(42), bw2 - sc(16), sc(5), T.prog / t.t, '#6ddcff');
        } else if (!done && !locked) {
          ctx.font = F(9); ctx.fillStyle = PE.world.canPay({ ...t.cost, ember: t.ember }) ? '#c9b98a' : '#a06a5a';
          ctx.textAlign = 'right';
          ctx.fillText(costText({ ...t.cost, ember: t.ember }), bx + bw2 - sc(4), ty + sc(47));
          ctx.textAlign = 'left';
          if (hit(bx + sc(5), ty, bw2, sc(50))) T.start(id);
        }
        row++;
      }
    });
    if (!PE.world.buildings.some(b => !b.dead && b.def.research)) {
      ctx.fillStyle = '#ff8f7a'; ctx.font = FB(13); ctx.textAlign = 'center';
      ctx.fillText('⚠ 需要先建造「研究石坛」', x + w / 2, y + h - sc(6));
    }
  }
  function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
    let line = '', ln = 0;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW) {
        ctx.fillText(line, x, y + ln * lh); line = ch; ln++;
        if (ln >= maxLines) return;
      } else line += ch;
    }
    if (line) ctx.fillText(line, x, y + ln * lh);
  }

  function drawVill(ctx, x, y, w) {
    const vs = PE.world.ents.filter(e => e.kind === 'villager' && !e.dead);
    ctx.fillStyle = '#c9c2a8'; ctx.font = F(13); ctx.textAlign = 'left';
    ctx.fillText(`村民 ${vs.length}/${PE.sys.vill.cap()} (帐篷+2上限)  ·  每人黄昏吃2食物`, x, y + sc(6));
    vs.forEach((v, i) => {
      const by = y + sc(18) + i * sc(46);
      ctx.fillStyle = '#f0e6cc'; ctx.font = FB(14);
      ctx.fillText(v.name, x + sc(4), by + sc(20));
      ctx.fillStyle = '#a89c80'; ctx.font = F(11);
      ctx.fillText(PE.D.TRAITS[v.trait].name + '·' + PE.D.TRAITS[v.trait].desc + (v.morale ? '' : ' 😡罢工'), x + sc(4), by + sc(36));
      bar(ctx, x + sc(150), by + sc(14), sc(70), sc(8), v.hp / v.maxhp, '#6db15f');
      // 职业按钮
      const jobs = Object.keys(PE.D.JOBS);
      jobs.forEach((j, ji) => {
        const jx = x + w - sc(4) - (jobs.length - ji) * sc(74);
        if (btn(ctx, jx, by + sc(4), sc(68), sc(32), PE.D.JOBS[j].name, { font: F(11.5), color: v.job === j ? '#7a9a4e' : undefined, color2: v.job === j ? '#5e7a3a' : undefined })) { v.job = j; v.node = null; }
      });
    });
    if (!vs.length) { ctx.fillStyle = '#8a8272'; ctx.font = F(13); ctx.fillText('还没有村民。收留流浪者或在商店招募。', x, y + sc(40)); }
  }

  function drawTribe(ctx, x, y, w) {
    const tid = ui.panelArg || 'river';
    const tr = PE.D.TRIBES[tid], TS = PE.sys.tribes;
    // 切换页签
    Object.keys(PE.D.TRIBES).forEach((id, i) => {
      if (btn(ctx, x + i * sc(150), y - sc(4), sc(142), sc(30), PE.D.TRIBES[id].name, { color: tid === id ? PE.D.TRIBES[id].color : undefined, font: F(13) })) ui.panelArg = id;
    });
    const rep = TS.rep[tid];
    ctx.fillStyle = '#c9c2a8'; ctx.font = F(13); ctx.textAlign = 'left';
    ctx.fillText(`${tr.persona} · 关系:${TS.status(tid)}`, x, y + sc(46));
    bar(ctx, x, y + sc(54), w * 0.6, sc(10), (rep + 100) / 200, rep >= 20 ? '#5da45a' : rep <= -40 ? '#c0392b' : '#c9a84a');
    ctx.fillStyle = '#f0e6cc'; ctx.font = FB(12); ctx.textAlign = 'left';
    ctx.fillText(`声望 ${rep}`, x + w * 0.6 + sc(10), y + sc(63));
    // 行动
    if (btn(ctx, x, y + sc(74), sc(150), sc(34), PE.D.TRIBE_ACT.gift.name, { font: F(12) })) TS.gift(tid);
    if (btn(ctx, x + sc(158), y + sc(74), sc(190), sc(34), PE.D.TRIBE_ACT.hire.name + ' 🔥120', { font: F(12) })) TS.hire(tid);
    // 货物
    ctx.fillStyle = '#e8cf9a'; ctx.font = FB(13);
    ctx.fillText('交易货物：', x, y + sc(132));
    tr.goods.forEach((g, i) => {
      const by = y + sc(140) + i * sc(42);
      ctx.fillStyle = g.rep && rep < g.rep ? '#6a6355' : '#f0e6cc'; ctx.font = F(13);
      ctx.fillText(g.name + (g.rep ? ` (需声望${g.rep})` : ''), x + sc(4), by + sc(22));
      if (btn(ctx, x + w - sc(170), by + sc(2), sc(162), sc(32), '付 ' + costText(g.pay), { font: F(12), disabled: (g.rep && rep < g.rep) || !PE.world.canPay(g.pay) })) TS.trade(tid, i);
    });
    ctx.fillStyle = '#8a8272'; ctx.font = F(10.5);
    ctx.fillText('声望≥60结盟:Boss夜驰援 · ≤-40敌对:会夜袭你 · 攻击商人=劫掠(-50)', x, y + sc(140) + tr.goods.length * sc(42) + sc(16));
  }

  /* ---------- 模态 ---------- */
  function drawModals(ctx) {
    if (!ui.modal) return;
    ctx.fillStyle = 'rgba(8,6,4,0.6)'; ctx.fillRect(0, 0, PE.W, PE.H);
    regRect(0, 0, PE.W, PE.H);
    const mw = Math.min(sc(560), PE.W - sc(30));
    if (ui.modal === 'dawn') {
      const mh = sc(240), mx = PE.W / 2 - mw / 2, my = PE.H / 2 - mh / 2;
      panelBg(ctx, mx, my, mw, mh, '🌅 第 ' + (ui.modalData.day - 1) + ' 夜 · 幸存');
      ctx.fillStyle = '#f0e6cc'; ctx.font = F(15); ctx.textAlign = 'center';
      ctx.fillText(`黎明奖励 +${ui.modalData.reward} 🔥`, PE.W / 2, my + sc(86));
      ctx.fillStyle = '#c9c2a8'; ctx.font = F(13);
      ctx.fillText(`累计击杀 ${ui.modalData.kills} · 火种 ${PE.world.ember}`, PE.W / 2, my + sc(114));
      const fc = PE.enemies.director.threatBudget(ui.modalData.day);
      ctx.fillStyle = '#ff8f7a';
      ctx.fillText(`今夜威胁预估：${Math.round(fc)} (昨夜的 ${Math.round(fc / PE.enemies.director.threatBudget(ui.modalData.day - 1) * 100)}%)`, PE.W / 2, my + sc(140));
      if (btn(ctx, PE.W / 2 - sc(80), my + mh - sc(60), sc(160), sc(42), '继续', { font: FB(16) })) {
        ui.modal = null;
        const ev = PE.sys.events.roll();
        if (ev) { ui.modal = 'event'; ui.modalData = { ev }; }
        else ui.offerBlessing();
      }
    } else if (ui.modal === 'event') {
      const ev = ui.modalData.ev;
      const mh = sc(100 + ev.choices.length * 52 + 80), mx = PE.W / 2 - mw / 2, my = PE.H / 2 - mh / 2;
      panelBg(ctx, mx, my, mw, mh, '📜 ' + ev.name);
      ctx.fillStyle = '#d8cfc0'; ctx.font = F(14); ctx.textAlign = 'center';
      wrapTextC(ctx, ev.desc, PE.W / 2, my + sc(74), mw - sc(60), sc(20));
      ev.choices.forEach((c, i) => {
        const dis = c.pay && !PE.world.canPay(c.pay);
        if (btn(ctx, PE.W / 2 - sc(150), my + sc(118) + i * sc(52), sc(300), sc(42), c.t, { disabled: dis, font: F(14) })) {
          if (PE.sys.events.choose(ev, i)) { ui.modal = null; ui.offerBlessing(); }
        }
      });
    } else if (ui.modal === 'blessing') {
      const opts = ui.modalData.opts;
      const cw2 = sc(158), ch = sc(190), gap = sc(12);
      const total = opts.length * cw2 + (opts.length - 1) * gap;
      const mx = PE.W / 2 - total / 2, my = PE.H / 2 - ch / 2;
      ctx.fillStyle = '#e8cf9a'; ctx.font = FB(20); ctx.textAlign = 'center';
      ctx.fillText('✨ 先祖的祝福 · 三选一', PE.W / 2, my - sc(22));
      opts.forEach((b, i) => {
        const bx = mx + i * (cw2 + gap);
        const tierC = b.tier === 2 ? '#b06dff' : b.tier === 1 ? '#6ddcff' : '#9adf8a';
        regRect(bx, my, cw2, ch);
        const hov = hover(bx, my, cw2, ch);
        ctx.fillStyle = hov ? 'rgba(60,50,36,0.98)' : 'rgba(38,32,24,0.96)';
        PE.S.rr(ctx, bx, my, cw2, ch, sc(10)); ctx.fill();
        ctx.strokeStyle = tierC; ctx.lineWidth = hov ? 3 : 2; ctx.stroke();
        ctx.fillStyle = tierC; ctx.font = FB(15); ctx.textAlign = 'center';
        ctx.fillText(b.name, bx + cw2 / 2, my + sc(38));
        ctx.fillStyle = '#c9c2a8'; ctx.font = F(12);
        wrapTextC(ctx, b.desc, bx + cw2 / 2, my + sc(72), cw2 - sc(20), sc(17));
        ctx.fillStyle = '#7a7264'; ctx.font = F(10);
        ctx.fillText(b.tier === 2 ? '史诗' : b.tier === 1 ? '稀有' : '祝福', bx + cw2 / 2, my + ch - sc(14));
        if (hit(bx, my, cw2, ch)) {
          PE.sys.bless.take(b.id);
          ui.toast('获得祝福：' + b.name, tierC);
          ui.modal = null;
          PE.sys.saveRun();
        }
      });
    } else if (ui.modal === 'gate') {
      const mh = sc(250), mx = PE.W / 2 - mw / 2, my = PE.H / 2 - mh / 2;
      panelBg(ctx, mx, my, mw, mh, '🌀 梦魇之门已开启');
      ctx.fillStyle = '#d8cfc0'; ctx.font = F(14); ctx.textAlign = 'center';
      wrapTextC(ctx, '三件神器与梦魇之钥共鸣。你可以踏入梦魇位面，猎杀诅咒之源——或者留下，防守最长的一夜。', PE.W / 2, my + sc(78), mw - sc(70), sc(21));
      if (btn(ctx, PE.W / 2 - sc(190), my + mh - sc(70), sc(180), sc(46), '⚔ 讨伐梦魇之主', { color: '#7a3a8a', color2: '#5a2a6a', font: FB(14) })) {
        ui.modal = null; PE.sys.enterNightmare();
      }
      if (btn(ctx, PE.W / 2 + sc(10), my + mh - sc(70), sc(180), sc(46), '🛡 防守到底', { font: FB(14) })) ui.modal = null;
    }
  }
  function wrapTextC(ctx, text, cx, y, maxW, lh) {
    let line = '', ln = 0;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, cx, y + ln * lh); line = ch; ln++; }
      else line += ch;
    }
    if (line) ctx.fillText(line, cx, y + ln * lh);
  }

  /* ---------- Toast ---------- */
  function drawToasts(ctx) {
    let y = sc(112);
    for (const t of ui.toasts) {
      t.t -= 1 / 60;
      const a = Math.min(1, t.t / 0.8);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = FB(14); ctx.textAlign = 'center';
      const w = ctx.measureText(t.msg).width + sc(36);
      ctx.fillStyle = 'rgba(24,20,14,0.88)';
      PE.S.rr(ctx, PE.W / 2 - w / 2, y, w, sc(30), sc(15)); ctx.fill();
      ctx.fillStyle = t.color;
      ctx.fillText(t.msg, PE.W / 2, y + sc(20));
      y += sc(36);
      ctx.globalAlpha = 1;
    }
    ui.toasts = ui.toasts.filter(t => t.t > 0);
  }

  /* ---------- 暂停 / 菜单界面 ---------- */
  function drawPause(ctx) {
    ctx.fillStyle = 'rgba(8,6,4,0.72)'; ctx.fillRect(0, 0, PE.W, PE.H);
    regRect(0, 0, PE.W, PE.H);
    const mw = sc(380), mh = sc(420), mx = PE.W / 2 - mw / 2, my = PE.H / 2 - mh / 2;
    panelBg(ctx, mx, my, mw, mh, '⏸ 暂停');
    let y = my + sc(70);
    if (btn(ctx, mx + sc(60), y, mw - sc(120), sc(46), '▶ 继续游戏', { font: FB(15) })) PE.paused = false;
    y += sc(58);
    // 音量
    const vol = (label, key) => {
      ctx.fillStyle = '#c9c2a8'; ctx.font = F(14); ctx.textAlign = 'left';
      ctx.fillText(label, mx + sc(40), y + sc(24));
      if (btn(ctx, mx + sc(150), y, sc(38), sc(36), '−')) { PE.settings[key] = Math.max(0, +(PE.settings[key] - 0.1).toFixed(1)); PE.audio.setVol(); }
      ctx.fillStyle = '#f0e6cc'; ctx.font = FB(14); ctx.textAlign = 'center';
      ctx.fillText(Math.round(PE.settings[key] * 100) + '%', mx + sc(222), y + sc(24));
      if (btn(ctx, mx + sc(256), y, sc(38), sc(36), '+')) { PE.settings[key] = Math.min(1, +(PE.settings[key] + 0.1).toFixed(1)); PE.audio.setVol(); }
      y += sc(46);
    };
    vol('音乐', 'music'); vol('音效', 'sfx');
    if (btn(ctx, mx + sc(60), y, mw - sc(120), sc(40), '震屏: ' + (PE.settings.shake ? '开' : '关'), { font: F(14) })) PE.settings.shake = !PE.settings.shake;
    y += sc(52);
    if (btn(ctx, mx + sc(60), y, mw - sc(120), sc(40), '💾 存档并回主菜单', { font: F(14) })) { PE.sys.saveRun(); PE.paused = false; PE.main.toTitle(); }
    y += sc(52);
    if (btn(ctx, mx + sc(60), y, mw - sc(120), sc(40), '☠ 放弃本局', { color: '#7a3a3a', color2: '#5a2a2a', font: F(14) })) { PE.paused = false; PE.main.endRun(false, false, true); }
  }

  /* ---------- 建造模式覆盖层 ---------- */
  function drawBuildOverlay(ctx) {
    const B = PE.sys.build;
    if (!B.active) return;
    ctx.fillStyle = 'rgba(20,16,12,0.85)'; ctx.font = FB(14); ctx.textAlign = 'center';
    let txt;
    if (B.sel === 'demolish') txt = '⛏ 拆除模式：点击建筑拆除 (返还50%材料)';
    else { const d = PE.D.BUILDINGS[B.sel]; txt = `建造中: ${d.name} (${costText(PE.world.buildCost(d))}) · 点地面放置`; }
    const w = ctx.measureText(txt).width + sc(40);
    PE.S.rr(ctx, PE.W / 2 - w / 2, sc(64), w, sc(32), sc(8)); ctx.fill();
    ctx.fillStyle = '#ffcf5f'; ctx.fillText(txt, PE.W / 2, sc(85));
    if (btn(ctx, PE.W / 2 + w / 2 + sc(6), sc(64), sc(72), sc(32), '取消', { font: F(13) })) B.exit();
  }

  /* ---------- 主绘制入口（run 状态） ---------- */
  ui.draw = ctx => {
    ui._newRects = [];
    drawHUD(ctx);
    drawBuildOverlay(ctx);
    drawPanels(ctx);
    drawModals(ctx);
    drawToasts(ctx);
    if (PE.paused) drawPause(ctx);
    ui.uiRects = ui._newRects;
  };

  /* ---------- 标题 / 职业 / 天赋 / 结算（由 main 调用） ---------- */
  ui.drawTitle = ctx => {
    ui._newRects = [];
    drawTitleBg(ctx);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8cf9a'; ctx.font = FB(52);
    ctx.fillText('原 始 纪 元', PE.W / 2, PE.H * 0.3);
    ctx.font = F(16); ctx.fillStyle = '#a89c80';
    ctx.fillText('— Primitive Era · 守住篝火，终结永夜 —', PE.W / 2, PE.H * 0.3 + sc(34));
    const bw = sc(240), bx = PE.W / 2 - bw / 2;
    let y = PE.H * 0.46;
    if (PE.sys.hasRun()) {
      if (btn(ctx, bx, y, bw, sc(50), '▶ 继续上局', { font: FB(17), color: '#7a6236' })) PE.main.continueRun();
      y += sc(62);
    }
    if (btn(ctx, bx, y, bw, sc(50), '🔥 新的一局', { font: FB(17) })) PE.main.toClassSelect();
    y += sc(62);
    if (btn(ctx, bx, y, bw, sc(50), `🗿 图腾天赋 (${PE.meta.totem}点)`, { font: FB(15) })) PE.state = 'talent';
    y += sc(62);
    ctx.fillStyle = '#6a6355'; ctx.font = F(12);
    ctx.fillText(`最远存活: 第${PE.meta.bestNight}夜 · 通关${PE.meta.wins}次 · ${PE.isTouch ? '触屏模式' : 'WASD移动/鼠标攻击/E交互/空格翻滚/B建造'}`, PE.W / 2, PE.H - sc(30));
    drawToasts(ctx);
    ui.uiRects = ui._newRects;
  };
  function drawTitleBg(ctx) {
    ctx.fillStyle = '#0d0f1a'; ctx.fillRect(0, 0, PE.W, PE.H);
    // 星
    for (let i = 0; i < 60; i++) {
      const sx = U.hash2(i, 1) * PE.W, sy = U.hash2(i, 7) * PE.H * 0.6;
      ctx.fillStyle = `rgba(220,230,255,${0.2 + U.hash2(i, 3) * 0.5 * (0.6 + Math.sin(PE.time * 2 + i) * 0.4)})`;
      ctx.fillRect(sx, sy, 2, 2);
    }
    // 篝火 + 光晕
    const fx2 = PE.W / 2, fy2 = PE.H * 0.78;
    const g = ctx.createRadialGradient(fx2, fy2, 10, fx2, fy2, sc(300));
    g.addColorStop(0, 'rgba(255,150,60,0.35)'); g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, PE.W, PE.H);
    ctx.save(); ctx.translate(fx2, fy2); ctx.scale(2, 2);
    PE.S.drawBuilding(ctx, { type: 'campfire', def: PE.D.BUILDINGS.campfire, lvl: 2, hp: 1, maxhp: 1, fuelOk: true, cat: 'core', x: 0, y: 0 }, PE.time);
    ctx.restore();
    if (Math.random() < 0.3) PE.fx.sparks(fx2 + U.rand(-10, 10), fy2 - sc(30), 1);
    PE.fx.update(1 / 60);
    ctx.save(); PE.fx.draw(ctx, { x: 0, y: 0, w: PE.W, h: PE.H }); ctx.restore();
  }
  ui.drawClassSelect = ctx => {
    ui._newRects = [];
    drawTitleBg(ctx);
    ctx.fillStyle = '#e8cf9a'; ctx.font = FB(26); ctx.textAlign = 'center';
    ctx.fillText('选择你的首领', PE.W / 2, PE.H * 0.18);
    const ids = Object.keys(PE.D.CLASSES);
    const cw2 = sc(200), ch = sc(240), gap = sc(16);
    const mx = PE.W / 2 - (ids.length * cw2 + (ids.length - 1) * gap) / 2, my = PE.H * 0.26;
    ids.forEach((id, i) => {
      const c = PE.D.CLASSES[id];
      const locked = c.unlock > 0 && !PE.meta.unlocks[id];
      const bx = mx + i * (cw2 + gap);
      regRect(bx, my, cw2, ch);
      const hov = hover(bx, my, cw2, ch);
      ctx.fillStyle = hov && !locked ? 'rgba(60,50,36,0.95)' : 'rgba(32,28,22,0.92)';
      PE.S.rr(ctx, bx, my, cw2, ch, sc(12)); ctx.fill();
      ctx.strokeStyle = locked ? '#4a4238' : '#8a6a3a'; ctx.lineWidth = 2.5; ctx.stroke();
      // 立绘
      ctx.save(); ctx.translate(bx + cw2 / 2, my + sc(120)); ctx.scale(1.7, 1.7);
      PE.S.humanoid(ctx, {
        skin: '#d8a06a', cloth: id === 'shamanC' ? '#5a7a8a' : id === 'chief' ? '#8a6a3a' : '#8a5a3a',
        hair: '#3a2a1c', feather: id === 'shamanC' ? '#6ddcff' : '#c25b3a',
        t: PE.time + i, walk: 0.3, weapon: id === 'hunter' ? 'bow' : id === 'chief' ? 'hammer' : 'spear', e: {},
      });
      ctx.restore();
      ctx.fillStyle = locked ? '#6a6355' : '#f0e6cc'; ctx.font = FB(17); ctx.textAlign = 'center';
      ctx.fillText(c.name, bx + cw2 / 2, my + sc(150));
      ctx.fillStyle = '#a89c80'; ctx.font = F(11.5);
      wrapTextC(ctx, c.desc, bx + cw2 / 2, my + sc(172), cw2 - sc(24), sc(16));
      if (locked) {
        if (btn(ctx, bx + sc(30), my + ch - sc(40), cw2 - sc(60), sc(32), `解锁 🗿${c.unlock}`, { font: F(12), disabled: PE.meta.totem < c.unlock })) {
          PE.meta.totem -= c.unlock; PE.meta.unlocks[id] = true; PE.sys.saveMeta();
          PE.audio.sfx('bless');
        }
      } else if (hit(bx, my, cw2, ch)) PE.main.startRun(id);
    });
    if (btn(ctx, sc(16), sc(16), sc(90), sc(38), '← 返回', { font: F(13) })) PE.state = 'title';
    drawToasts(ctx);
    ui.uiRects = ui._newRects;
  };
  ui.drawTalents = ctx => {
    ui._newRects = [];
    drawTitleBg(ctx);
    ctx.fillStyle = '#e8cf9a'; ctx.font = FB(26); ctx.textAlign = 'center';
    ctx.fillText(`🗿 图腾天赋 · 剩余 ${PE.meta.totem} 点`, PE.W / 2, sc(60));
    const mw = Math.min(sc(560), PE.W - sc(30));
    const mx = PE.W / 2 - mw / 2;
    PE.D.TALENTS.forEach((t, i) => {
      const y = sc(96) + i * sc(58);
      const lvl = PE.meta.talents[t.id] || 0;
      const maxed = lvl >= t.max;
      const cost = maxed ? 0 : t.cost(lvl);
      ctx.fillStyle = '#f0e6cc'; ctx.font = FB(15); ctx.textAlign = 'left';
      ctx.fillText(`${t.name}  ${'●'.repeat(lvl)}${'○'.repeat(t.max - lvl)}`, mx, y + sc(20));
      ctx.fillStyle = '#a89c80'; ctx.font = F(12);
      ctx.fillText(t.desc, mx, y + sc(40));
      if (btn(ctx, mx + mw - sc(130), y + sc(4), sc(126), sc(40), maxed ? '已满' : `强化 🗿${cost}`, { font: F(13), disabled: maxed || PE.meta.totem < cost })) {
        PE.meta.totem -= cost; PE.meta.talents[t.id] = lvl + 1; PE.sys.saveMeta(); PE.audio.sfx('bless');
      }
    });
    // 成就
    ctx.fillStyle = '#8a8272'; ctx.font = F(11); ctx.textAlign = 'center';
    const done = Object.keys(PE.meta.achieves).length;
    ctx.fillText(`成就 ${done}/${PE.D.ACHIEVES.length}: ` + PE.D.ACHIEVES.map(a => (PE.meta.achieves[a.id] ? '🏆' : '▫') + a.name).join('  '), PE.W / 2, PE.H - sc(50));
    if (btn(ctx, sc(16), sc(16), sc(90), sc(38), '← 返回', { font: F(13) })) PE.state = 'title';
    drawToasts(ctx);
    ui.uiRects = ui._newRects;
  };
  ui.drawEnd = ctx => {
    ui._newRects = [];
    const r = PE.main.result || {};
    ctx.fillStyle = r.win ? 'rgba(20,24,16,0.96)' : 'rgba(24,12,10,0.96)';
    ctx.fillRect(0, 0, PE.W, PE.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = r.win ? '#9adf8a' : '#ff8f7a'; ctx.font = FB(40);
    ctx.fillText(r.win ? (r.lesser ? '🌅 你守住了最长的夜' : '☀ 永夜终结!') : '🔥 篝火熄灭了…', PE.W / 2, PE.H * 0.28);
    ctx.fillStyle = '#d8cfc0'; ctx.font = F(16);
    const lines = [
      `存活 ${r.nights} 夜 · 击杀 ${r.kills} · 壁画 ${PE.world.paintings}/6 · 神器 ${Object.keys(PE.world.artifacts).length}/3`,
      `获得图腾点 +${r.totem} (共 ${PE.meta.totem})`,
    ];
    lines.forEach((l, i) => ctx.fillText(l, PE.W / 2, PE.H * 0.4 + i * sc(30)));
    const bw = sc(220), bx = PE.W / 2 - bw / 2;
    let y = PE.H * 0.56;
    if (r.win && r.lesser && !PE.world.endless) {
      if (btn(ctx, bx, y, bw, sc(48), '♾ 进入无尽模式', { color: '#5a3a7a', color2: '#43285c', font: FB(15) })) PE.main.enterEndless();
      y += sc(60);
    }
    if (btn(ctx, bx, y, bw, sc(48), '🔄 再来一局', { font: FB(15) })) PE.main.toClassSelect();
    y += sc(60);
    if (btn(ctx, bx, y, bw, sc(48), '🏠 主菜单', { font: FB(15) })) PE.main.toTitle();
    drawToasts(ctx);
    ui.uiRects = ui._newRects;
  };

  return ui;
})();
