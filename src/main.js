/* ============================================================
   原始纪元 · main.js —— 状态机 / 更新编排 / 渲染管线
   ============================================================ */
'use strict';
PE.paused = false;

PE.main = (() => {
  const U = PE.U;
  const M = { result: null };

  /* ================= 流程控制 ================= */
  M.toTitle = () => { PE.state = 'title'; PE.audio.music.setMode('title'); };
  M.toClassSelect = () => { PE.state = 'class'; };
  M.startRun = classId => {
    PE.sys.clearRun();
    PE.sys.bless.owned = [];
    PE.sys.tech.done = {}; PE.sys.tech.researching = null; PE.sys.tech.prog = 0;
    PE.sys.vill.fallen = [];
    PE.player.cls = classId;
    PE.sys.recalcMods();
    PE.player.reset(classId);
    PE.world.init(classId, PE.meta.talents);
    PE.sys.recalcMods();
    if (PE.meta.talents.t_wolf) PE.sys.pets.add('warwolf');
    // 开局自带村民：采集者 + 猎人（工匠首领再多一名工匠）
    const v1 = PE.sys.vill.add(); v1.job = 'gatherer';
    const v2 = PE.sys.vill.add(); v2.job = 'hunter';
    if (classId === 'chief') { const v3 = PE.sys.vill.add(); v3.job = 'artisan'; }
    PE.state = 'run'; PE.paused = false;
    PE.audio.music.setMode('day'); PE.audio.music.intensity = 0;
    PE.ui.toast('白天采集资源、按 🏗 建起防线——夜晚兽群将扑向篝火!', '#e8cf9a');
    PE.ui.toast('两位村民已就位。挥动武器就能砍树采矿，去商店可升级篝火。', '#a89c80');
  };
  M.continueRun = () => {
    PE.player.cls = 'hunter';
    if (PE.sys.loadRun()) {
      PE.state = 'run'; PE.paused = false;
      PE.audio.music.setMode('day');
      PE.ui.toast('欢迎回来，首领。今天是第 ' + PE.world.day + ' 天。', '#e8cf9a');
    } else PE.ui.toast('存档读取失败', '#ff8f7a');
  };
  M.endRun = (win, lesser, abandoned) => {
    if (PE.state !== 'run') return;
    const W = PE.world;
    const nights = W.nightsSurvived;
    let totem = nights * 10 + (win ? (lesser ? 80 : 200) : 0);
    if (abandoned) totem = Math.floor(totem / 2);
    PE.meta.totem += totem;
    PE.meta.bestNight = Math.max(PE.meta.bestNight, nights);
    if (win) { PE.meta.wins++; if (!lesser) PE.sys.achieve('a_win'); }
    PE.sys.saveMeta();
    PE.sys.clearRun();
    M.result = { win, lesser, nights, kills: W.kills, totem };
    PE.state = 'end';
    PE.audio.music.setMode('title');
    PE.audio.fireLoop(false, 0);
  };
  M.enterEndless = () => {
    const W = PE.world;
    W.endless = true; W.nightmare = false;
    W.day++; W.phase = 'day'; W.phaseT = 0;
    PE.player.hp = PE.player.maxhp;
    PE.state = 'run'; PE.paused = false;
    PE.audio.music.setMode('day');
    PE.ui.toast('♾ 无尽模式：黑暗没有尽头，看你能撑到第几夜!', '#b06dff');
    PE.sys.saveRun();
  };

  /* ================= 更新 ================= */
  M.update = dt => {
    if (PE.state !== 'run') return;
    const W = PE.world, inp = PE.input;

    /* 快捷键（暂停/面板层） */
    if (inp.pressed('pause')) {
      if (PE.sys.build.active) PE.sys.build.exit();
      else if (PE.ui.panel) PE.ui.closePanel();
      else if (!PE.ui.modal) PE.paused = !PE.paused;
    }
    if (PE.paused || PE.ui.modalOpen()) return; // 面板打开时暂停模拟
    if (inp.pressed('build')) { if (PE.sys.build.active) PE.sys.build.exit(); else PE.ui.openPanel('build'); }
    if (inp.pressed('tech')) PE.ui.openPanel('tech');
    if (inp.pressed('shop')) PE.ui.openPanel('shop');
    if (inp.pressed('panel')) PE.ui.openPanel('vill');
    if (inp.pressed('repair')) PE.sys.repairAll();

    /* 右键：退出建造模式 / 直接拆除建筑 */
    const B = PE.sys.build;
    for (const t of inp.st.rtaps) {
      if (!t.fresh) continue;
      t.fresh = false;
      if (B.active) { B.exit(); continue; }
      if (PE.ui.overUI(t.x, t.y)) continue;
      const w = PE.cam.toWorld(t.x, t.y);
      const b = PE.sys.buildingAt(w.x, w.y);
      if (b) PE.sys.demolish(b);
    }

    /* 建造模式 */
    if (B.active) {
      B.update();
      for (const t of inp.st.taps) {
        if (t.fresh && !PE.ui.overUI(t.x, t.y)) { inp.eatTap(t); B.place(); }
      }
    }

    /* 空间哈希重建 */
    PE.grid.clear();
    for (const e of W.ents) if (!e.dead) PE.grid.insert(e);

    /* 世界与系统 */
    W.update(dt);
    if (PE.state !== 'run') return; // dawn 可能触发 endRun
    PE.sys.tech.update(dt);
    PE.sys.updateBuildings(dt);
    PE.sys.updateNightmare(dt);
    PE.enemies.director.update(dt);

    /* 玩家 */
    PE.player.update(dt);

    /* 实体 */
    for (const e of W.ents) {
      if (e.dead) continue;
      if (e.slowT > 0) { e.slowT -= dt; e.spd = (e.def.spd || 60) * 0.5; }
      else if (e.def && e.def.spd) e.spd = e.def.spd;
      if (e.kind === 'villager') PE.sys.vill.update(e, dt);
      else if (e.kind === 'pet') PE.sys.pets.update(e, dt);
      else PE.enemies.updateEnt(e, dt);
    }
    /* 友方单位彼此/与玩家轻推分离，避免堆在门口挡路 */
    const Pl = PE.player;
    for (const e of W.ents) {
      if (e.dead) continue;
      const k = e.kind;
      if (k !== 'villager' && k !== 'pet' && k !== 'ally' && k !== 'npc') continue;
      if (e === Pl.mount || e.type === 'eagle') continue;
      let dx = e.x - Pl.x, dy = e.y - Pl.y;
      let d2 = dx * dx + dy * dy, min = e.r + Pl.r + 3;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2), push = (min - d) * 0.5;
        const nx = e.x + dx / d * push, ny = e.y + dy / d * push;
        if (W.walkable(nx, ny, true)) { e.x = nx; e.y = ny; }
      }
      for (const o of PE.grid.query(e.x, e.y, 30, [])) {
        if (o === e || o.dead) continue;
        const ok2 = o.kind;
        if (ok2 !== 'villager' && ok2 !== 'pet' && ok2 !== 'ally' && ok2 !== 'npc') continue;
        dx = e.x - o.x; dy = e.y - o.y; d2 = dx * dx + dy * dy; min = e.r + o.r;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2), push = (min - d) * 0.25;
          const nx = e.x + dx / d * push, ny = e.y + dy / d * push;
          if (W.walkable(nx, ny, true)) { e.x = nx; e.y = ny; }
        }
      }
    }
    // 清理
    for (let i = W.ents.length - 1; i >= 0; i--) if (W.ents[i].dead) W.ents.splice(i, 1);
    for (let i = W.buildings.length - 1; i >= 0; i--) if (W.buildings[i].dead) W.buildings.splice(i, 1);

    PE.projectiles.update(dt);
    PE.fx.update(dt);
    PE.fx.updateTexts(dt);
    PE.fx.updateWeather(dt);

    /* 相机与光照 */
    PE.cam.follow(PE.player.x, PE.player.y, dt);
    W.registerLights();
  };

  /* ================= 渲染 ================= */
  M.render = () => {
    const ctx = PE.ctx;
    if (!ctx) return;
    ctx.setTransform(PE.DPR, 0, 0, PE.DPR, 0, 0);
    ctx.fillStyle = '#0a0c10'; ctx.fillRect(0, 0, PE.W, PE.H);

    if (PE.state === 'title') { PE.ui.drawTitle(ctx); return; }
    if (PE.state === 'class') { PE.ui.drawClassSelect(ctx); return; }
    if (PE.state === 'talent') { PE.ui.drawTalents(ctx); return; }
    if (PE.state === 'end') { PE.ui.drawEnd(ctx); return; }
    if (PE.state !== 'run') return;

    const W = PE.world;
    PE.cam.apply(ctx);
    const view = PE.cam.view();

    /* 1. 地面 */
    W.drawGround(ctx, view);
    /* 2. 云影 */
    PE.fx.drawClouds(ctx);
    /* 3. 梦魇位面地面效果 */
    if (W.nightmare && W.memfire) {
      ctx.strokeStyle = `rgba(255,155,60,${0.5 + Math.sin(PE.time * 3) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(W.memfire.x, W.memfire.y, W.memfire.r, W.memfire.r * 0.55, 0, 0, U.TAU); ctx.stroke();
    }
    /* 4. Y 排序实体层 */
    const items = [];
    const vx0 = view.x - 120, vx1 = view.x + view.w + 120, vy0 = view.y - 160, vy1 = view.y + view.h + 120;
    const inView = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
    for (const n of W.nodes) if (!n.dead && inView(n.x, n.y)) items.push({ y: n.y, k: 'node', o: n });
    for (const b of W.buildings) if (!b.dead && inView(b.x, b.y)) items.push({ y: b.y, k: 'building', o: b });
    for (const p of W.pois) if (inView(p.x, p.y)) items.push({ y: p.y, k: 'poi', o: p });
    for (const e of W.ents) if (!e.dead && inView(e.x, e.y) && e !== PE.player.mount) items.push({ y: e.y, k: 'ent', o: e });
    for (const p of W.pickups) if (inView(p.x, p.y)) items.push({ y: p.y, k: 'pickup', o: p });
    if (PE.player.mount) items.push({ y: PE.player.y + 1, k: 'ent', o: PE.player.mount });
    items.push({ y: PE.player.y + (PE.player.mount ? 2 : 0), k: 'player' });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.k === 'node') drawNode(ctx, it.o);
      else if (it.k === 'building') { ctx.save(); ctx.translate(it.o.x, it.o.y); PE.S.shadow(ctx, 16, 0.3, 0.2); PE.S.drawBuilding(ctx, it.o, PE.time); ctx.restore(); }
      else if (it.k === 'poi') drawPOI(ctx, it.o);
      else if (it.k === 'pickup') drawPickup(ctx, it.o);
      else if (it.k === 'ent') {
        const e = it.o;
        if (e.kind === 'villager') PE.sys.vill.draw(ctx, e);
        else if (e.kind === 'pet') PE.sys.pets.draw(ctx, e);
        else PE.enemies.drawEnt(ctx, e);
      }
      else if (it.k === 'player') PE.player.draw(ctx);
    }
    /* 5. 投射物 / 粒子 / 天气 / 飘字 */
    PE.projectiles.draw(ctx);
    PE.fx.draw(ctx, view);
    PE.fx.drawWeather(ctx);
    /* 6. 建造幽灵 */
    drawGhost(ctx);
    PE.fx.drawTexts(ctx);
    /* 7. 光照（内部切回屏幕空间） */
    PE.light.render(ctx);
    /* 8. UI */
    ctx.setTransform(PE.DPR, 0, 0, PE.DPR, 0, 0);
    PE.ui.draw(ctx);
  };

  function drawNode(ctx, n) {
    ctx.save();
    ctx.translate(n.x, n.y);
    if (n.shake > 0) { n.shake -= 1 / 60; ctx.translate(U.rand(-2, 2), 0); }
    switch (n.type) {
      case 'tree': PE.S.shadow(ctx, 14, 0.3, 0.2); PE.S.drawTree(ctx, n, PE.time); break;
      case 'rock': PE.S.shadow(ctx, 15, 0.3, 0.2); PE.S.drawRock(ctx, n); break;
      case 'obsidian': PE.S.shadow(ctx, 15, 0.3, 0.2); PE.S.drawRock(ctx, { ...n, rtype: 'obsidian' }); break;
      case 'star': PE.S.shadow(ctx, 15, 0.3, 0.2); PE.S.drawRock(ctx, { ...n, rtype: 'star' }); break;
      case 'bush': PE.S.shadow(ctx, 12, 0.3, 0.18); PE.S.drawBush(ctx, n); break;
      case 'herb': PE.S.drawHerb(ctx); break;
      case 'mushroom': PE.S.drawMushroom(ctx); break;
      case 'clay': PE.S.drawClay(ctx); break;
      case 'fishspot': PE.S.drawFishSpot(ctx, PE.time); break;
    }
    ctx.restore();
  }
  function drawPOI(ctx, p) {
    ctx.save(); ctx.translate(p.x, p.y);
    if (p.kind === 'cave') { PE.S.shadow(ctx, 30, 0.3, 0.25); PE.S.drawCave(ctx); }
    else if (p.kind === 'painting') { if (!p.found) PE.S.drawPainting(ctx, PE.time); else { ctx.globalAlpha = 0.45; PE.S.drawPainting(ctx, 0); ctx.globalAlpha = 1; } }
    else if (p.kind === 'artifact' && !p.taken) PE.S.drawArtifactPickup(ctx, PE.time, p.name);
    else if (p.kind === 'chest' && !p.taken) { PE.S.shadow(ctx, 14, 0.32, 0.2); PE.S.drawChest(ctx, PE.time); }
    else if (p.kind === 'eagle' && !p.used) {
      PE.S.shadow(ctx, 18, 0.3, 0.2); PE.S.drawRock(ctx, { rtype: null });
      ctx.fillStyle = '#6e5a45'; ctx.beginPath(); ctx.ellipse(0, -26, 7, 9, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#e8d5a8'; ctx.beginPath(); ctx.arc(0, -34, 4, 0, U.TAU); ctx.fill();
    }
    else if (p.kind === 'tribecamp') {
      const tr = PE.D.TRIBES[p.tribe];
      PE.S.shadow(ctx, 28, 0.3, 0.25);
      PE.S.drawHut(ctx, tr.color);
      ctx.save(); ctx.translate(-46, 14); ctx.scale(0.7, 0.7); PE.S.drawHut(ctx, tr.color); ctx.restore();
      ctx.fillStyle = 'rgba(240,230,200,0.9)'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(tr.name, 0, -56);
    }
    ctx.restore();
  }
  function drawPickup(ctx, p) {
    ctx.save(); ctx.translate(p.x, p.y);
    PE.S.shadow(ctx, 8, 0.35, 0.2);
    const hov = Math.sin(PE.time * 4 + p.x) * 3;
    ctx.translate(0, -8 + hov);
    ctx.fillStyle = `rgba(255,207,95,${0.25 + Math.sin(PE.time * 5) * 0.1})`;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, U.TAU); ctx.fill();
    ctx.drawImage(PE.S.icon('wood', 22), -11, -11);
    ctx.restore();
  }
  function drawGhost(ctx) {
    const B = PE.sys.build;
    if (!B.active || !B.sel) return;
    const g = B.ghost;
    if (B.sel === 'demolish') { // 拆除模式：红框标示目标
      const ex = g.existing;
      if (ex) {
        ctx.strokeStyle = `rgba(255,90,60,${0.7 + Math.sin(PE.time * 6) * 0.2})`; ctx.lineWidth = 2.5;
        ctx.strokeRect(ex.x - 18, ex.y - 36, 36, 42);
        ctx.fillStyle = 'rgba(255,120,90,0.95)'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('点击拆除', ex.x, ex.y - 44);
      }
      return;
    }
    const d = PE.D.BUILDINGS[B.sel];
    // 网格
    ctx.strokeStyle = 'rgba(240,230,200,0.12)'; ctx.lineWidth = 1;
    const T = 32, gx0 = Math.floor((g.x - 160) / T) * T, gy0 = Math.floor((g.y - 160) / T) * T;
    for (let x = gx0; x <= gx0 + 320; x += T) { ctx.beginPath(); ctx.moveTo(x, gy0); ctx.lineTo(x, gy0 + 320); ctx.stroke(); }
    for (let y = gy0; y <= gy0 + 320; y += T) { ctx.beginPath(); ctx.moveTo(gx0, y); ctx.lineTo(gx0 + 320, y); ctx.stroke(); }
    // 射程圈
    if (d.turret) { ctx.strokeStyle = 'rgba(109,220,255,0.35)'; ctx.beginPath(); ctx.arc(g.x, g.y, d.turret.range, 0, U.TAU); ctx.stroke(); }
    if (d.light) { ctx.strokeStyle = 'rgba(255,200,90,0.3)'; ctx.beginPath(); ctx.arc(g.x, g.y, d.light, 0, U.TAU); ctx.stroke(); }
    // 幽灵
    ctx.globalAlpha = 0.65;
    ctx.save(); ctx.translate(g.x, g.y);
    PE.S.drawBuilding(ctx, { type: B.sel, def: d, hp: 1, maxhp: 1, lvl: 1, fuelOk: true, cat: d.cat, x: g.x, y: g.y }, PE.time);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = g.ok ? 'rgba(120,220,120,0.8)' : 'rgba(220,80,60,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(g.x - 16, g.y - 16, 32, 32);
    if (g.existing && g.existing.def.up === B.sel) {
      ctx.fillStyle = 'rgba(120,220,120,0.9)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⬆ 升级', g.x, g.y - 40);
    }
  }

  /* ================= 启动 ================= */
  M.boot = () => {
    PE.initCanvas();
    PE.sys.loadMeta();
    PE.state = 'title';
    PE.loop.start();
  };

  return M;
})();

window.addEventListener('load', () => PE.main.boot());
