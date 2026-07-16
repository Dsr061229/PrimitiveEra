/* ============================================================
   原始纪元 · world.js —— 世界状态：时间/季节/天气/地图/资源点/迷雾/网格
   ============================================================ */
'use strict';
PE.world = (() => {
  const U = PE.U, D = () => PE.D, T = 32;

  const W = {
    day: 1, phase: 'day', phaseT: 0, endless: false,
    weather: 'sun', nextWeather: 'sun', bloodmoon: false, bloodmoonQueued: false, nightmare: false,
    ember: 0, res: {}, arrows: 0,
    ents: [], buildings: [], projs: [], pickups: [],
    nodes: [], pois: [],
    btile: new Map(),          // tileKey -> building
    fog: null, FOGC: 100, FOGN: 40,
    paintings: 0, frags: {}, artifacts: {},
    fear: 0, kills: 0, nightsSurvived: 0, threatsToday: [],
    camp: { x: 2000, y: 2100 }, campfire: null,
    fuelT: 0, emberAcc: 0, warpaintNights: 0,
    seed: 0, rng: Math.random,
    groundCv: null, miniCv: null,
  };

  /* ---------- 时间 ---------- */
  W.phaseLen = () => W.phase === 'day' ? PE.D.BAL.DAY_LEN : W.phase === 'dusk' ? PE.D.BAL.DUSK_LEN : PE.D.BAL.NIGHT_LEN;
  W.season = () => W.day <= 6 ? 'green' : W.day <= 12 ? 'rain' : 'snow';
  W.dayLight = () => W.phase === 'day' ? 1 : W.phase === 'dusk' ? 1 - W.phaseT / PE.D.BAL.DUSK_LEN : 0;
  W.clock01 = () => { // 一昼夜进度 0..1
    const B = PE.D.BAL, total = B.DAY_LEN + B.DUSK_LEN + B.NIGHT_LEN;
    let t = W.phaseT + (W.phase === 'dusk' ? B.DAY_LEN : W.phase === 'night' ? B.DAY_LEN + B.DUSK_LEN : 0);
    return t / total;
  };

  /* ---------- 资源 ---------- */
  W.addRes = (id, n) => { W.res[id] = (W.res[id] || 0) + n; };
  W.canPay = cost => {
    for (const k in cost) {
      if (k === 'ember') { if (W.ember < cost[k]) return false; }
      else if ((W.res[k] || 0) < cost[k]) return false;
    }
    return true;
  };
  W.pay = cost => {
    if (!W.canPay(cost)) return false;
    for (const k in cost) { if (k === 'ember') W.ember -= cost[k]; else W.res[k] -= cost[k]; }
    return true;
  };
  W.buildCost = def => { // 职业/天赋修正
    const m = 1 - (PE.mods.wallcost || 0), out = {};
    for (const k in def.cost) out[k] = Math.max(1, Math.ceil(def.cost[k] * m));
    return out;
  };

  /* ---------- 地形 ---------- */
  const biomeGrid = new Uint8Array(PE.GW * PE.GH); // 0 plain 1 forest 2 river岸 3 swamp 4 rock 5 snow 6 volcano 7 water
  const BIOME_C = {
    0: ['#7d9c50', '#71914a'], 1: ['#5e8a44', '#54793c'], 2: ['#c2b280', '#b0a070'],
    3: ['#5c6e44', '#52623c'], 4: ['#8a8478', '#7a746a'], 5: ['#dfe6ea', '#cbd6dd'],
    6: ['#6e5a50', '#5f4c44'], 7: ['#3d6a8c', '#356082'],
  };
  const BIOME_ID = { plain: 0, forest: 1, river: 2, swamp: 3, rock: 4, snow: 5, volcano: 6 };

  // 环岛海岸线（带噪声起伏，代替生硬的地图边界墙）
  W.coastAt = (x, y) => 110 + U.noise2(x * 0.004, y * 0.004) * 130;
  W.isWater = (x, y) => {
    const bd = Math.min(x, y, PE.MAPW - x, PE.MAPH - y);
    if (bd < W.coastAt(x, y)) return true; // 大海
    const rb = PE.D.MAP.riverBand;
    if (x < rb.x0 || x > rb.x1) return false;
    if ((y > rb.fordY[0] && y < rb.fordY[1]) || (y > rb.fordY2[0] && y < rb.fordY2[1])) return false;
    return true;
  };
  W.biomeAt = (x, y) => {
    if (W.isWater(x, y)) return 7;
    const bd = Math.min(x, y, PE.MAPW - x, PE.MAPH - y);
    if (bd < W.coastAt(x, y) + 70) return 2; // 海滩
    let best = 0, bestW = 0;
    for (const r of PE.D.MAP.regions) {
      const d = U.dist(x, y, r.x, r.y);
      if (d < r.r) { const w = 1 - d / r.r; if (w > bestW) { bestW = w; best = BIOME_ID[r.biome]; } }
    }
    return best;
  };
  W.regionAt = (x, y) => {
    let best = null, bd = 1e9;
    for (const r of PE.D.MAP.regions) { const d = U.dist(x, y, r.x, r.y); if (d < r.r && d < bd) { bd = d; best = r; } }
    return best;
  };
  W.tileKey = (tx, ty) => ty * PE.GW + tx;
  W.walkable = (x, y, friendly) => {
    if (x < 40 || y < 40 || x > PE.MAPW - 40 || y > PE.MAPH - 40) return false;
    if (W.isWater(x, y)) return false;
    const b = W.btile.get(W.tileKey(Math.floor(x / T), Math.floor(y / T)));
    if (b) return !!(friendly && b.def.door);
    return true;
  };

  /* ---------- 地面烘焙（半分辨率 2000x2000） ---------- */
  W.bakeGround = () => {
    const cv = document.createElement('canvas'); cv.width = 2000; cv.height = 2000;
    const c = cv.getContext('2d'), s = 0.5; // 世界->烘焙 缩放
    for (let ty = 0; ty < PE.GH; ty++) for (let tx = 0; tx < PE.GW; tx++) {
      const wx = tx * T + 16, wy = ty * T + 16;
      const b = W.biomeAt(wx, wy);
      biomeGrid[W.tileKey(tx, ty)] = b;
      const n = U.noise2(tx * 0.35, ty * 0.35);
      const cols = BIOME_C[b];
      c.fillStyle = n > 0.5 ? cols[0] : cols[1];
      c.fillRect(tx * T * s, ty * T * s, T * s + 1, T * s + 1);
      // 细节点缀
      const h = U.hash2(tx * 3.1, ty * 5.7);
      if (b <= 1 && h > 0.82) { c.fillStyle = 'rgba(60,90,40,0.5)'; c.fillRect(tx * T * s + h * 10, ty * T * s + 6, 2, 3); }
      if (b === 4 && h > 0.85) { c.fillStyle = 'rgba(60,58,52,0.6)'; c.fillRect(tx * T * s + 4, ty * T * s + h * 10, 3, 2); }
      if (b === 6 && h > 0.9) { c.fillStyle = 'rgba(200,80,40,0.5)'; c.fillRect(tx * T * s + 3, ty * T * s + 8, 4, 1.5); }
      if (b === 7) { // 水波
        c.fillStyle = 'rgba(255,255,255,0.08)';
        if (h > 0.7) c.fillRect(tx * T * s + 2, ty * T * s + h * 12, 8, 1.2);
      }
    }
    // 水岸高光
    c.strokeStyle = 'rgba(230,225,200,0.35)'; c.lineWidth = 2;
    const rb = PE.D.MAP.riverBand;
    for (const x of [rb.x0, rb.x1]) { c.beginPath(); c.moveTo(x * s, 0); c.lineTo(x * s, 2000); c.stroke(); }
    W.groundCv = cv;
    // 小地图底
    const m = document.createElement('canvas'); m.width = 220; m.height = 220;
    m.getContext('2d').drawImage(cv, 0, 0, 220, 220);
    W.miniCv = m;
  };
  W.drawGround = (ctx, view) => {
    const s = 0.5;
    ctx.drawImage(W.groundCv, view.x * s, view.y * s, view.w * s, view.h * s, view.x, view.y, view.w, view.h);
    // 雪季覆霜
    if (W.season() === 'snow') { ctx.fillStyle = 'rgba(225,235,245,0.28)'; ctx.fillRect(view.x, view.y, view.w, view.h); }
  };

  /* ---------- 建筑格 ---------- */
  W.placeBuildingTile = b => {
    const tx = Math.floor(b.x / T), ty = Math.floor(b.y / T);
    b.tx = tx; b.ty = ty;
    if (b.def.cat === 'wall' || b.def.pop || b.def.craft || b.def.research || b.def.beast || b.def.watch) {
      W.btile.set(W.tileKey(tx, ty), b);
      PE.flow.setCost(tx, ty, b.def.cat === 'wall' ? PE.flow.BLOCK : Infinity);
    } else if (b.def.cat === 'trap' || b.type === 'torchpost' || b.type === 'pot') {
      PE.flow.setCost(tx, ty, b.type === 'totem' ? 1 : 1.5); // 敌人略避开陷阱
    }
  };
  W.removeBuildingTile = b => {
    const k = W.tileKey(b.tx, b.ty);
    if (W.btile.get(k) === b) W.btile.delete(k);
    PE.flow.setCost(b.tx, b.ty, W.isWater(b.tx * T + 16, b.ty * T + 16) ? Infinity : 1);
  };
  W.buildingAtTile = (tx, ty) => W.btile.get(W.tileKey(tx, ty));

  /* ---------- 资源点生成 ---------- */
  function scatter(region, type, n, opt = {}) {
    const r = PE.D.MAP.regions.find(x => x.id === region);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const a = U.rand(0, U.TAU), d = U.rand(region === 'camp' ? 140 : 60, r.r * 0.92);
        const x = r.x + Math.cos(a) * d, y = r.y + Math.sin(a) * d;
        if (!W.walkable(x, y)) continue;
        if (U.dist(x, y, W.camp.x, W.camp.y) < 120) continue;
        W.nodes.push({
          id: U.uid(), type, x, y, biome: r.biome, big: opt.big && Math.random() < 0.3,
          rtype: opt.rtype, hits: hitsFor(type), maxhits: hitsFor(type), dead: false, respawnAt: 0,
        });
        break;
      }
    }
  }
  function hitsFor(t) { return t === 'tree' ? 4 : t === 'rock' ? 5 : t === 'bush' ? 2 : t === 'herb' ? 1 : t === 'clay' ? 3 : t === 'obsidian' ? 6 : t === 'star' ? 6 : 1; }
  W.nodeYield = n => { // 采集掉落
    switch (n.type) {
      case 'tree': return { wood: U.randi(2, 3) };
      case 'mushroom': return { food: 3 };
      case 'rock': return Math.random() < 0.2 ? { stone: 1, flint: 1 } : { stone: 1 };
      case 'bush': return { food: 2 };
      case 'herb': return { herb: U.randi(1, 2) };
      case 'clay': return { clay: U.randi(1, 2) };
      case 'obsidian': return { obsidian: 1 };
      case 'star': return { star: 1 };
    }
    return {};
  };

  function spawnNodes() {
    scatter('camp', 'tree', 14); scatter('camp', 'rock', 8); scatter('camp', 'bush', 8);
    scatter('forest', 'tree', 46, { big: true }); scatter('forest', 'bush', 14); scatter('forest', 'herb', 10); scatter('forest', 'rock', 6); scatter('forest', 'mushroom', 6);
    scatter('swamp', 'mushroom', 10);
    scatter('river', 'clay', 12); scatter('river', 'rock', 10); scatter('river', 'bush', 6);
    scatter('swamp', 'herb', 16); scatter('swamp', 'tree', 12); scatter('swamp', 'clay', 6);
    scatter('cave', 'rock', 18); scatter('cave', 'obsidian', 8);
    scatter('snow', 'rock', 10); scatter('snow', 'tree', 10); scatter('snow', 'star', 2);
    scatter('volcano', 'obsidian', 10); scatter('volcano', 'rock', 12);
    // 河中鱼点
    const rb = PE.D.MAP.riverBand;
    for (let i = 0; i < 6; i++) {
      const fy = i % 2 ? U.rand(rb.fordY[0], rb.fordY[1]) : U.rand(rb.fordY2[0], rb.fordY2[1]);
      W.nodes.push({ id: U.uid(), type: 'fishspot', x: U.rand(rb.x0 + 20, rb.x1 - 20), y: fy + (i % 2 ? -160 : 160), hits: 99, maxhits: 99, fish: true });
    }
  }

  /* ---------- POI ---------- */
  function spawnPOIs() {
    const M = PE.D.MAP;
    W.pois.push({ kind: 'cave', x: 950, y: 1000 });
    M.paintings.forEach((p, i) => W.pois.push({ kind: 'painting', x: p.x, y: p.y, idx: i, found: false }));
    for (const id in M.artifacts) {
      const a = M.artifacts[id];
      W.pois.push({ kind: 'artifact', aid: id, x: a.x, y: a.y, name: a.name, taken: false });
    }
    W.pois.push({ kind: 'eagle', x: M.eagleNest.x, y: M.eagleNest.y, used: false });
    M.chests.forEach(c => W.pois.push({ kind: 'chest', x: c.x, y: c.y, taken: false }));
    // 部落营地
    for (const tid in PE.D.TRIBES) {
      const tr = PE.D.TRIBES[tid];
      W.pois.push({ kind: 'tribecamp', tribe: tid, x: tr.x, y: tr.y });
      // 部落 NPC
      PE.enemies.spawnNPC(tid, tr.x, tr.y + 50);
    }
  }

  /* ---------- 迷雾 ---------- */
  W.initFog = () => { W.fog = new Uint8Array(W.FOGN * W.FOGN); };
  W.revealFog = (x, y, r) => {
    const c = W.FOGC, n = W.FOGN;
    const x0 = Math.max(0, Math.floor((x - r) / c)), x1 = Math.min(n - 1, Math.floor((x + r) / c));
    const y0 = Math.max(0, Math.floor((y - r) / c)), y1 = Math.min(n - 1, Math.floor((y + r) / c));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      if (U.dist2(gx * c + c / 2, gy * c + c / 2, x, y) < r * r) W.fog[gy * n + gx] = 1;
    }
  };
  W.fogAt = (x, y) => {
    const c = W.FOGC, gx = U.clamp(Math.floor(x / c), 0, W.FOGN - 1), gy = U.clamp(Math.floor(y / c), 0, W.FOGN - 1);
    return !W.fog[gy * W.FOGN + gx];
  };

  /* ---------- 初始化一局 ---------- */
  W.init = (classId, talents) => {
    W.day = 1; W.phase = 'day'; W.phaseT = 0; W.endless = false;
    W.weather = 'sun'; W.nextWeather = 'sun'; W.bloodmoon = false; W.nightmare = false;
    W.ember = 60; W.res = { wood: 40, stone: 20, food: 30, fur: 2, flint: 4, bone: 0, clay: 0, herb: 0, obsidian: 0, star: 0 };
    W.arrows = 0; W.ents = []; W.buildings = []; W.projs = []; W.pickups = []; W.nodes = []; W.pois = [];
    W.btile.clear(); W.paintings = 0; W.frags = {}; W.artifacts = {}; W.fear = 0; W.kills = 0;
    W.nightsSurvived = 0; W.fuelT = 0; W.emberAcc = 0; W.warpaintNights = 0;
    W.seed = Math.floor(Math.random() * 1e9); W.rng = U.rngSeed(W.seed);
    // 天赋加成
    const tl = id => (talents && talents[id]) || 0;
    W.res.wood += 20 * tl('t_res'); W.res.stone += 20 * tl('t_res');
    PE.flow.init();
    // 水域成本
    for (let ty = 0; ty < PE.GH; ty++) for (let tx = 0; tx < PE.GW; tx++) {
      if (W.isWater(tx * T + 16, ty * T + 16)) PE.flow.setCost(tx, ty, Infinity);
    }
    W.bakeGround(); W.initFog();
    spawnNodes(); spawnPOIs();
    // 篝火
    const cf = PE.sys.makeBuilding('campfire', W.camp.x, W.camp.y);
    cf.lvl = 1; cf.fuel = 100; cf.fuelOk = true;
    W.campfire = cf; W.buildings.push(cf);
    W.revealFog(W.camp.x, W.camp.y, 600);
    PE.flow.rebuild(W.camp.x, W.camp.y);
    PE.sys.tribes.init();
    PE.sys.spawnWildDay();
  };

  /* ---------- 天气 ---------- */
  function rollWeather() {
    const s = W.season();
    const pool = s === 'rain' ? [['sun', 3], ['rain', 5], ['fog', 2]] : s === 'snow' ? [['sun', 4], ['fog', 3], ['rain', 0]] : [['sun', 6], ['rain', 2], ['fog', 1]];
    return U.wpick(pool.filter(p => p[1] > 0), p => p[1])[0];
  }

  W.rollWeather = rollWeather;

  /* ---------- 昼夜推进 ---------- */
  W.update = dt => {
    W.phaseT += dt;
    const len = W.phaseLen();
    if (W.nightmare) W.phaseT = Math.min(W.phaseT, len - 1); // 梦魇位面：长夜不尽
    if (W.phaseT >= len) {
      W.phaseT = 0;
      if (W.phase === 'day') {
        W.phase = 'dusk';
        PE.enemies.director.planNight();
        PE.sys.onDusk();
      } else if (W.phase === 'dusk') {
        W.phase = 'night';
        PE.enemies.director.startNight();
        PE.audio.music.setMode(PE.enemies.director.bossNight ? 'boss' : 'night');
      } else if (W.phase === 'night') {
        W.nightsSurvived = W.day;
        PE.sys.dawn(); // 内部推进 W.day、弹结算
      }
    }
    // 篝火经济
    const cf = W.campfire;
    if (cf && !cf.dead) {
      // 燃料
      const fuelNeed = dt / (PE.D.BAL.FIRE_FUEL_SEC / cf.lvl) * (1 - (PE.mods.fuel || 0));
      cf.fuel -= fuelNeed;
      if (cf.fuel <= 0) {
        if ((W.res.wood || 0) >= 1) { W.res.wood -= 1; cf.fuel += 1; cf.fuelOk = true; }
        else { cf.fuel = 0; cf.fuelOk = false; }
      } else cf.fuelOk = true;
      // 产火种
      let villNear = 0;
      for (const e of W.ents) if (e.kind === 'villager' && !e.dead && U.dist2(e.x, e.y, cf.x, cf.y) < 300 * 300) villNear++;
      let rate = PE.D.BAL.FIRE_OUT_BASE * cf.lvl * (1 + 0.1 * villNear) * (1 + (PE.mods.fireout || 0));
      if (!cf.fuelOk) rate *= 0.5;
      if (W.weather === 'rain') rate *= 0.75;
      W.emberAcc += rate * dt;
      if (W.emberAcc >= 1) { const n = Math.floor(W.emberAcc); W.emberAcc -= n; W.ember += n; }
      // 光照登记（含呼吸波动）
      const breath = 1 + Math.sin(PE.time * 1.7) * 0.04;
      let lr = (150 + cf.lvl * 60) * breath;
      if (!cf.fuelOk) lr *= 0.45;
      if (W.artifacts.eternalflame) lr *= 1.15;
      cf.lightR = lr;
      PE.audio.fireLoop(true, U.clamp(1 - U.dist(PE.player.x, PE.player.y, cf.x, cf.y) / 500, 0, 1));
      if (Math.random() < dt * 8 && cf.fuelOk) PE.fx.sparks(cf.x + U.rand(-6, 6), cf.y - 20, 1);
      if (Math.random() < dt * 2) PE.fx.smoke(cf.x, cf.y - 30);
    }
    // 恐惧值（夜晚在光圈外）
    if (W.phase === 'night' && !W.nightmare) {
      const inLight = PE.light.isLit(PE.player.x, PE.player.y) || PE.mods.innerlight;
      if (!inLight) {
        W.fear = Math.min(100, W.fear + dt * 9);
        if (W.fear >= 100) { W.fear = 20; PE.enemies.spawnHunterEye(); }
      } else W.fear = Math.max(0, W.fear - dt * 18);
    } else W.fear = Math.max(0, W.fear - dt * 25);
    // 节点重生检查（黎明时由 sys.dawn 批量处理）
    // 迷雾揭示
    W.revealFog(PE.player.x, PE.player.y, 300);
  };

  /* ---------- 注册所有光源（逻辑帧调用） ---------- */
  W.registerLights = () => {
    PE.light.clear();
    const le = W.lightEat > 0 ? 0.5 : 1; // 夜魔·影吞光
    const cf = W.campfire;
    if (cf && !cf.dead && !W.nightmare) PE.light.add(cf.x, cf.y - 10, (cf.lightR || 200) * le);
    for (const b of W.buildings) {
      if (b.dead) continue;
      if (b.type === 'torchpost') PE.light.add(b.x, b.y - 20, 110 * le * (1 + Math.sin(PE.time * 3 + b.x) * 0.05));
      if (b.type === 'firepit' && b.burnT > 0) PE.light.add(b.x, b.y, 90 * le);
      if (b.type === 'totem') PE.light.add(b.x, b.y - 20, 70 * le, 0);
    }
    const P = PE.player;
    if (P.hotbarSel && P.hotbarSel.id === 'torch') PE.light.add(P.x, P.y - 14, 130 * le);
    if (W.nightmare && W.memfire) PE.light.add(W.memfire.x, W.memfire.y, W.memfire.r);
  };

  return W;
})();
