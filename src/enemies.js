/* ============================================================
   原始纪元 · enemies.js —— 敌人AI / Boss / 兽潮导演 / 野生动物
   ============================================================ */
'use strict';
PE.enemies = (() => {
  const U = PE.U;

  /* ---------- 生成 ---------- */
  function baseEnt(kind, type, x, y, def) {
    return {
      id: U.uid(), kind, type, x, y, r: def.r || 12,
      hp: def.hp, maxhp: def.hp, dmg: def.dmg || 0, spd: def.spd || 60,
      face: 1, walk: 0, t: U.rand(0, 10), flash: 0, dead: false,
      atkTimer: 0, atkT: 0, state: 'approach', target: null,
      def,
    };
  }
  function spawn(type, x, y) {
    const def = PE.D.ENEMIES[type];
    const e = baseEnt('enemy', type, x, y, def);
    e.atkRate = def.atkRate || 1; e.behavior = def.behavior;
    if (def.behavior === 'armored') { e.armored = true; e.kbResist = 0.8; }
    if (def.behavior === 'fly' || def.fly) e.fly = true;
    if (def.behavior === 'stomp') { e.kbResist = 1; e.stompCd = 5; }
    if (type === 'mammoth' || type === 'bear' || type === 'rhino') e.kbResist = 0.7;
    if (def.nightmare) e.nightmare = true;
    PE.world.ents.push(e);
    return e;
  }
  function spawnWild(type, x, y) {
    const def = PE.D.WILD[type];
    const e = baseEnt('wild', type, x, y, def);
    e.flee = def.flee; e.tameable = !!def.tameAs; e.home = { x, y };
    e.aggro = false; e.atkRate = def.atkRate || 1; // 无攻速会导致 1/undefined=NaN 只咬一口
    PE.world.ents.push(e);
    return e;
  }
  function spawnNPC(tribe, x, y) {
    const e = baseEnt('npc', 'trader', x, y, { hp: 300, r: 13, spd: 40 });
    e.tribe = tribe; e.home = { x, y };
    PE.world.ents.push(e);
    return e;
  }
  function spawnAlly(x, y, tribe, nights) {
    const e = baseEnt('ally', 'tribal', x, y, { hp: 160, dmg: 18, spd: 95, r: 14 });
    e.tribe = tribe; e.nightsLeft = nights || 2;
    PE.world.ents.push(e);
    PE.fx.magic(x, y, PE.D.TRIBES[tribe].color);
    return e;
  }
  function spawnBoss(bid) {
    const def = PE.D.BOSSES[bid];
    const a = U.rand(0, U.TAU);
    const x = PE.world.camp.x + Math.cos(a) * 700, y = PE.world.camp.y + Math.sin(a) * 700;
    const e = baseEnt('enemy', 'boss_' + bid, x, y, def);
    e.boss = bid; e.nightmare = true; e.kbResist = 1; e.atkRate = 0.8;
    e.skillCd = 6; e.lightStun = 0; e.phase = 1;
    if (bid === 'shadow') e.fly = true;
    PE.world.ents.push(e);
    PE.audio.sfx('stinger'); PE.cam.shake(8);
    PE.ui.toast(`⚠ ${def.name} 现身了！`, '#ff5a4a');
    return e;
  }
  function spawnHunterEye() {
    const P = PE.player;
    const a = U.rand(0, U.TAU);
    const e = spawn('eye', P.x + Math.cos(a) * 400, P.y + Math.sin(a) * 400);
    e.huntPlayer = true;
    PE.ui.toast('黑暗中，有什么东西盯上了你…', '#b06dff');
    PE.audio.sfx('stinger', { vol: 0.5 });
  }

  /* ---------- 目标选择 ---------- */
  function nearestCreature(e, r, kinds) {
    let best = null, bd = r * r;
    const cand = PE.grid.query(e.x, e.y, r, []);
    for (const c of cand) {
      if (c.dead || c === e) continue;
      if (!kinds.includes(c.kind)) continue;
      if (c.kind === 'player' && (c.downT > 0)) continue;
      const d = U.dist2(e.x, e.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    // 玩家不在 grid 里，单独判
    if (kinds.includes('player') && !PE.player.dead && PE.player.downT <= 0) {
      const d = U.dist2(e.x, e.y, PE.player.x, PE.player.y);
      if (d < bd) { bd = d; best = PE.player; }
    }
    return best;
  }
  function moveEnt(e, dx, dy, sp, dt, friendly) {
    const nx = e.x + dx * sp * dt, ny = e.y + dy * sp * dt;
    let blocked = null;
    if (e.fly || PE.world.walkable(nx, e.y, friendly)) e.x = nx;
    else blocked = PE.world.buildingAtTile(Math.floor(nx / 32), Math.floor(e.y / 32));
    if (e.fly || PE.world.walkable(e.x, ny, friendly)) e.y = ny;
    else blocked = blocked || PE.world.buildingAtTile(Math.floor(e.x / 32), Math.floor(ny / 32));
    e.walk = Math.min(1, e.walk + dt * 5);
    if (dx) e.face = dx > 0 ? 1 : -1;
    return blocked;
  }
  function attackCreature(e, c, dt) {
    e.atkTimer -= dt;
    if (e.atkTimer <= 0) {
      e.atkTimer = 1 / e.atkRate; e.atkT = 1;
      let dmg = e.dmg;
      if (PE.light.isLit(e.x, e.y)) dmg *= 0.8;
      if (c === PE.player) PE.player.damage(dmg, e);
      else PE.combat.hit(c, dmg, { from: e, kb: 8, hitstop: false, poison: e.def.poison });
    }
  }
  function attackBuilding(e, b, dt) {
    e.atkTimer -= dt;
    if (e.atkTimer <= 0) {
      e.atkTimer = 1 / (e.atkRate || 1); e.atkT = 1;
      let dmg = e.dmg * (e.def.wallMult && e.state === 'charge_hit' ? e.def.wallMult : 1);
      if (b.marked) dmg *= 1.25;
      PE.combat.hitBuilding(b, dmg, e);
    }
  }

  /* ---------- 敌人主 AI ---------- */
  function updateEnemy(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    if (e.atkT > 0) e.atkT -= dt * 3;
    if (e.poisonT > 0) { e.poisonT -= dt; e.hp -= e.poisonDmg * dt; if (e.hp <= 0) { die(e, true); return; } }
    // 夜魔怕光：光中持续掉血
    if (e.nightmare && PE.light.isLit(e.x, e.y)) {
      e.hp -= 4 * dt; e.flash = Math.max(e.flash, 0.05);
      if (e.hp <= 0) { die(e, false); return; }
    }
    if (e.stun > 0) { e.stun -= dt; e.walk = 0; return; }
    if (e.boss) return updateBoss(e, dt);
    const W = PE.world, cf = W.campfire;

    /* 特性: 夜魔之眼 */
    if (e.behavior === 'eye') {
      let tgt = e.markTarget;
      if (e.huntPlayer) { // 恐惧猎杀模式
        const d = U.dist(e.x, e.y, PE.player.x, PE.player.y);
        const a = U.ang(e.x, e.y, PE.player.x, PE.player.y);
        moveEnt(e, Math.cos(a), Math.sin(a), e.spd, dt, false);
        if (d < 40) { PE.player.damage(15, e); die(e, false); }
        if (PE.light.isLit(e.x, e.y)) { e.hp -= 12 * dt; if (e.hp <= 0) die(e, false); }
        return;
      }
      if (!tgt || tgt.dead) {
        const bs = W.buildings.filter(b => !b.dead && b.cat !== 'core');
        e.markTarget = tgt = bs.length ? U.pick(bs) : cf;
      }
      if (tgt) {
        const orb = e.t * 2;
        const gx = tgt.x + Math.cos(orb) * 50, gy = tgt.y + Math.sin(orb) * 50;
        const a = U.ang(e.x, e.y, gx, gy);
        moveEnt(e, Math.cos(a), Math.sin(a), e.spd, dt, false);
        if (U.dist2(e.x, e.y, tgt.x, tgt.y) < 90 * 90) tgt.marked = true;
      }
      return;
    }

    /* 特性: 冲锋（野猪） */
    if (e.behavior === 'charge') {
      if (e.state === 'windup') {
        e.windupT -= dt; e.walk = 0;
        if (e.windupT <= 0) { e.state = 'dash'; e.dashT = 1.2; PE.audio.sfx('roar', { x: e.x, y: e.y, vol: 0.4 }); }
        return;
      }
      if (e.state === 'dash') {
        e.dashT -= dt;
        const blocked = moveEnt(e, Math.cos(e.dashAng), Math.sin(e.dashAng), e.spd * 3.4, dt, false);
        if (blocked) {
          e.state = 'charge_hit'; attackBuilding(e, blocked, 999); e.state = 'approach';
          e.stun = 2; PE.cam.shake(5); PE.fx.ring(e.x, e.y, '#c2b280', 40);
          return;
        }
        // 撞生物
        const c = nearestCreature(e, 30, ['player', 'villager', 'pet', 'ally']);
        if (c) { if (c === PE.player) PE.player.damage(e.dmg * 1.5, e); else PE.combat.hit(c, e.dmg * 1.5, { from: e, kb: 30, hitstop: false }); e.state = 'approach'; e.stun = 1; }
        if (e.dashT <= 0) e.state = 'approach';
        return;
      }
      // 寻找冲锋时机
      const tgt = nearestCreature(e, 240, ['player', 'villager', 'pet', 'ally']);
      if (tgt && e.chargeCd <= 0 || (e.chargeCd <= 0 && PE.flow.distAt(e.x, e.y) < 18 && PE.flow.distAt(e.x, e.y) > 3)) {
        const aimTo = tgt || cf;
        if (aimTo) {
          e.state = 'windup'; e.windupT = 0.7; e.chargeCd = 5;
          e.dashAng = U.ang(e.x, e.y, aimTo.x, aimTo.y);
          PE.fx.text(e.x, e.y - 24, '❗', '#ffcf5f', 18);
          return;
        }
      }
      e.chargeCd = (e.chargeCd || 3) - dt;
    }

    /* 通用目标决策 */
    let tgt = null;
    if (e.behavior === 'sneak') {
      tgt = nearestCreature(e, 2000, ['villager']) || nearestCreature(e, e.def.aggro, ['player', 'pet', 'ally']);
    } else if (e.def.aggro) {
      tgt = nearestCreature(e, e.def.aggro, ['player', 'villager', 'pet', 'ally']);
    }

    if (tgt) {
      const d = U.dist(e.x, e.y, tgt.x, tgt.y);
      const reach = e.r + tgt.r + 8;
      if (d < reach + 4) { e.walk = 0; e.face = tgt.x > e.x ? 1 : -1; attackCreature(e, tgt, dt); return; }
      const a = U.ang(e.x, e.y, tgt.x, tgt.y);
      const blocked = moveEnt(e, Math.cos(a), Math.sin(a), e.spd * packBuff(e), dt, false);
      if (blocked) { tryJumpOr(e, blocked, dt); }
      return;
    }

    /* 飞行直扑篝火 */
    if (e.fly) {
      if (!cf || cf.dead) return;
      const d = U.dist(e.x, e.y, cf.x, cf.y);
      if (d < 40) { attackBuilding(e, cf, dt); e.walk = 0; return; }
      const a = U.ang(e.x, e.y, cf.x, cf.y);
      moveEnt(e, Math.cos(a), Math.sin(a), e.spd, dt, false);
      return;
    }

    /* 流场向篝火 */
    const dir = PE.flow.dirAt(e.x, e.y);
    if (cf && !cf.dead && U.dist2(e.x, e.y, cf.x, cf.y) < (e.r + 34) * (e.r + 34)) { attackBuilding(e, cf, dt); e.walk = 0; return; }
    if (dir && (dir.x || dir.y)) {
      const blocked = moveEnt(e, dir.x, dir.y, e.spd * packBuff(e), dt, false);
      if (blocked) tryJumpOr(e, blocked, dt);
    } else if (dir === null) {
      // 无路（被围死/水域）：直线逼近并砸墙
      const a = U.ang(e.x, e.y, W.camp.x, W.camp.y);
      const blocked = moveEnt(e, Math.cos(a), Math.sin(a), e.spd, dt, false);
      if (blocked) tryJumpOr(e, blocked, dt);
    }
    // 践踏（猛犸）
    if (e.behavior === 'stomp') {
      e.stompCd -= dt;
      if (e.stompCd <= 0) {
        e.stompCd = 5;
        PE.cam.shake(6); PE.fx.ring(e.x, e.y, '#c2b280', 120);
        const c = PE.grid.query(e.x, e.y, 120, []);
        for (const t of c) if (t !== e && (t.kind === 'villager' || t.kind === 'pet' || t.kind === 'ally')) PE.combat.hit(t, 25, { from: e, kb: 24, hitstop: false });
        if (!PE.player.dead && U.dist2(e.x, e.y, PE.player.x, PE.player.y) < 120 * 120) PE.player.damage(25, e);
        PE.audio.sfx('roar', { x: e.x, y: e.y, vol: 0.6 });
      }
    }
  }
  function packBuff(e) {
    if (e.type !== 'wolf') return 1;
    const near = PE.grid.query(e.x, e.y, 200, []);
    for (const c of near) if (c.type === 'direwolf' && !c.dead) return 1.25;
    return 1;
  }
  function tryJumpOr(e, blocked, dt) {
    // 剑齿虎跳一级墙
    if (e.behavior === 'jump' && (e.jumpCd || 0) <= 0 && (blocked.type === 'fence' || blocked.type === 'wall_wood' || blocked.type === 'gate')) {
      const a = U.ang(e.x, e.y, PE.world.camp.x, PE.world.camp.y);
      e.x += Math.cos(a) * 76; e.y += Math.sin(a) * 76;
      e.jumpCd = 6;
      PE.fx.text(e.x, e.y - 30, '跃过!', '#ffcf5f', 14);
      PE.fx.ring(e.x, e.y, '#c2b280', 30);
      return;
    }
    if (e.jumpCd > 0) e.jumpCd -= dt;
    attackBuilding(e, blocked, dt);
    e.walk = 0;
  }

  /* ---------- Boss AI ---------- */
  function updateBoss(e, dt) {
    const W = PE.world, cf = W.campfire;
    e.skillCd -= dt;
    if (e.boss === 'claw') {
      // 怕光硬直
      if (PE.light.isLit(e.x, e.y) && e.lightStun <= 0) {
        e.lightStun = 6; e.stun = 1.5;
        PE.fx.text(e.x, e.y - 40, '被光灼伤!', '#ffcf5f', 16);
        return;
      }
      e.lightStun -= dt;
      // 找最弱墙
      if (!e.target || e.target.dead) {
        const walls = W.buildings.filter(b => !b.dead && b.def.cat === 'wall');
        e.target = walls.length ? walls.reduce((a, b) => a.hp < b.hp ? a : b) : cf;
      }
      const tgt = nearestCreature(e, 120, ['player', 'villager', 'pet', 'ally']) || e.target;
      if (!tgt) return;
      const d = U.dist(e.x, e.y, tgt.x, tgt.y);
      if (d < e.r + (tgt.r || 20) + 14) {
        e.walk = 0;
        if (tgt.def && tgt.def.cat !== undefined) attackBuilding(e, tgt, dt); else attackCreature(e, tgt, dt);
        if (e.skillCd <= 0) { // 横扫
          e.skillCd = 10; e.atkT = 1;
          PE.combat.aoe(e.x, e.y, 90, 30, { hostileOnly: false, byPlayer: false });
        }
      } else {
        const a = U.ang(e.x, e.y, tgt.x, tgt.y);
        moveEnt(e, Math.cos(a), Math.sin(a), e.spd, dt, false);
      }
    } else if (e.boss === 'shadow') {
      // 绕营地飘 + 召唤 + 吞光
      e.orbA = (e.orbA || 0) + dt * 0.35;
      const gx = cf.x + Math.cos(e.orbA) * 240, gy = cf.y + Math.sin(e.orbA) * 240;
      const a = U.ang(e.x, e.y, gx, gy);
      moveEnt(e, Math.cos(a), Math.sin(a), e.spd, dt, false);
      if (e.skillCd <= 0) {
        e.skillCd = 12;
        if (Math.random() < 0.55) { // 召唤蝙蝠
          PE.ui.toast('夜魔·影 召唤了蝠群！', '#b06dff');
          for (let i = 0; i < 5; i++) spawn('bat', e.x + U.rand(-40, 40), e.y + U.rand(-40, 40));
        } else { // 吞噬光
          W.lightEat = 5;
          PE.ui.toast('光在收缩…!', '#b06dff');
          PE.audio.sfx('stinger', { vol: 0.6 });
        }
      }
      // 幽弹射玩家
      e.spitCd = (e.spitCd || 3) - dt;
      if (e.spitCd <= 0 && !PE.player.dead) {
        e.spitCd = 3;
        const pa = U.ang(e.x, e.y, PE.player.x, PE.player.y);
        PE.projectiles.shoot(e.x, e.y - 30, pa, { dmg: 22, kind: 'spit', friendly: false, spd: 300 });
      }
    } else if (e.boss === 'lord') {
      const hp01 = e.hp / e.maxhp;
      const newPhase = hp01 > 0.66 ? 1 : hp01 > 0.33 ? 2 : 3;
      if (newPhase !== e.phase) {
        e.phase = newPhase;
        PE.audio.sfx('stinger'); PE.cam.shake(10);
        PE.ui.toast(newPhase === 2 ? '梦魇之主召唤记忆中的兽群！' : '黑暗在吞噬记忆篝火——用木材喂火!', '#ff5a4a');
        if (newPhase === 3) W.memfireDecay = 14;
      }
      // 追玩家近战
      const tgt = PE.player.downT > 0 ? null : PE.player;
      if (tgt) {
        const d = U.dist(e.x, e.y, tgt.x, tgt.y);
        if (d < e.r + 24) { e.walk = 0; attackCreature(e, tgt, dt); }
        else { const a = U.ang(e.x, e.y, tgt.x, tgt.y); moveEnt(e, Math.cos(a), Math.sin(a), e.spd * (e.phase === 1 ? 1 : 0.85), dt, false); }
      }
      if (e.skillCd <= 0) {
        e.skillCd = e.phase === 1 ? 7 : 9;
        if (e.phase === 1) { PE.combat.aoe(e.x, e.y, 110, 35, {}); }
        else if (e.phase === 2) {
          const pool = ['wolf', 'wolf', 'saber', 'bogspawn'];
          for (let i = 0; i < 3; i++) { const a2 = U.rand(0, U.TAU); spawn(U.pick(pool), e.x + Math.cos(a2) * 120, e.y + Math.sin(a2) * 120); }
        } else {
          // 阶段3：撕扯记忆篝火
          if (W.memfire) { W.memfire.r = Math.max(60, W.memfire.r - 40); PE.ui.toast('梦魇撕扯着火光!', '#ff5a4a'); }
        }
      }
    }
  }

  /* ---------- 野生动物 AI ---------- */
  function updateWild(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    if (e.atkT > 0) e.atkT -= dt * 3;
    const P = PE.player, d = U.dist(e.x, e.y, P.x, P.y);
    if (e.flee) {
      if (d < 160 || e.scared) {
        e.scared = Math.max(0, (e.scared || 0) - dt);
        const a = U.ang(P.x, P.y, e.x, e.y);
        moveEnt(e, Math.cos(a), Math.sin(a), e.spd, dt, false);
        if (d < 160) e.scared = 2;
      } else wander(e, dt);
      return;
    }
    // 掠食者：鬣狗全天主动袭击（含玩家/村民/战兽）；野狼/野猪夜晚捕猎【黑暗中】的目标
    const night = PE.world.phase === 'night';
    const predator = e.def.aggressive || (night && (e.type === 'w_wolf' || e.type === 'w_boar'));
    if (predator) {
      let prey = nearestCreature(e, e.def.aggro || 300, ['player', 'villager', 'pet', 'ally']);
      if (night && prey && (PE.light.isLit(prey.x, prey.y) || PE.mods.innerlight && prey === PE.player)) prey = null; // 夜晚光圈庇护
      if (prey) {
        const dp = U.dist(e.x, e.y, prey.x, prey.y);
        if (dp < e.r + prey.r + 8) { e.walk = 0; attackCreature(e, prey, dt); }
        else { const a = U.ang(e.x, e.y, prey.x, prey.y); moveEnt(e, Math.cos(a), Math.sin(a), e.spd, dt, false); }
        return;
      }
    }
    // 野狼/野猪：被打了才反击
    if (e.aggro && d < 300) {
      if (d < e.r + P.r + 8) { e.walk = 0; attackCreature(e, P, dt); }
      else { const a = U.ang(e.x, e.y, P.x, P.y); moveEnt(e, Math.cos(a), Math.sin(a), e.spd, dt, false); }
    } else wander(e, dt);
  }
  function wander(e, dt) {
    e.wanderT = (e.wanderT || 0) - dt;
    if (e.wanderT <= 0) { e.wanderT = U.rand(1.5, 4); e.wa = U.rand(0, U.TAU); e.wm = Math.random() < 0.6; }
    if (e.wm) {
      // 不离家太远
      if (e.home && U.dist(e.x, e.y, e.home.x, e.home.y) > 260) e.wa = U.ang(e.x, e.y, e.home.x, e.home.y);
      moveEnt(e, Math.cos(e.wa), Math.sin(e.wa), e.spd * 0.4, dt, false);
    } else e.walk = Math.max(0, e.walk - dt * 5);
  }
  /* ---------- 盟军 AI ---------- */
  function updateAlly(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    if (e.atkT > 0) e.atkT -= dt * 3;
    const cf = PE.world.campfire;
    const foe = nearestFoe(e, 280);
    if (foe) {
      const d = U.dist(e.x, e.y, foe.x, foe.y);
      if (d < e.r + foe.r + 8) { e.walk = 0; attackCreature(e, foe, dt); }
      else { const a = U.ang(e.x, e.y, foe.x, foe.y); moveEnt(e, Math.cos(a), Math.sin(a), e.spd, dt, true); }
    } else {
      const gx = cf.x + Math.cos(e.id) * 90, gy = cf.y + Math.sin(e.id) * 90;
      if (U.dist(e.x, e.y, gx, gy) > 30) { const a = U.ang(e.x, e.y, gx, gy); moveEnt(e, Math.cos(a), Math.sin(a), e.spd * 0.7, dt, true); }
      else e.walk = Math.max(0, e.walk - dt * 5);
    }
  }
  function nearestFoe(e, r) {
    let best = null, bd = r * r;
    for (const c of PE.grid.query(e.x, e.y, r, [])) {
      if (c.dead || c.kind !== 'enemy') continue;
      const d = U.dist2(e.x, e.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  /* ---------- NPC ---------- */
  function updateNPC(e, dt) { e.t += dt; if (e.flash > 0) e.flash -= dt; wander(e, dt); }

  /* ---------- 死亡 ---------- */
  function die(e, byPlayer) {
    if (e.dead) return;
    e.dead = true;
    PE.fx.burst(e.x, e.y - 8, 14, { color: '#a82c2c', size: 3.5, life: 0.6, sp: 160 });
    PE.audio.sfx('die', { x: e.x, y: e.y });
    PE.world.kills++;
    // 分裂
    if (e.behavior === 'split' && !e.small) {
      for (let i = 0; i < 2; i++) {
        const s = spawn('bogspawn', e.x + U.rand(-20, 20), e.y + U.rand(-20, 20));
        s.small = true; s.hp = s.maxhp = 60; s.dmg = 10; s.r = 10;
      }
    }
    // 移除标记
    if (e.markTarget) e.markTarget.marked = false;
    // 掉落（击杀有奖：资源直接入库并飘字）
    const drops = e.def.drops || {};
    const parts = [];
    for (const k in drops) {
      const n = Math.max(1, Math.round(drops[k] * (0.7 + Math.random() * 0.6)));
      PE.world.addRes(k, n);
      parts.push('+' + n + PE.D.RES[k].name);
    }
    if (parts.length) PE.fx.text(e.x, e.y - 28, parts.join(' '), '#c9e8a0', 12);
    let ember = e.def.ember || 0;
    if (PE.world.bloodmoon) ember *= 2;
    if (PE.mods.greed && Math.random() < PE.mods.greed) { ember *= 2; PE.fx.text(e.x, e.y - 26, '贪婪!', '#ffcf5f', 14); }
    if (ember) { PE.world.ember += ember; PE.fx.text(e.x, e.y - 12, '+' + ember + '🔥', '#ff9b3d', 13); PE.audio.sfx('ember', { x: e.x, y: e.y }); }
    if (byPlayer && PE.mods.vamp) PE.player.heal(PE.mods.vamp);
    // Boss 掉碎片
    if (e.boss === 'claw') { PE.world.frags.frag1 = true; PE.ui.toast('掉落了【夜魔碎片Ⅰ】——去回声洞穴的雷石祭坛!', '#ffcf5f'); PE.sys.achieve('a_boss1'); }
    if (e.boss === 'shadow') { PE.world.frags.frag2 = true; PE.ui.toast('掉落了【夜魔碎片Ⅱ】——去火山口的火焰祭坛!', '#ffcf5f'); PE.sys.achieve('a_boss2'); }
    if (e.boss === 'lord') { PE.main.endRun(true); }
    // 野生驯养源死亡后白天补充
  }

  /* ---------- 兽潮导演 ---------- */
  const director = {
    plan: null, waveIdx: 0, nextWaveT: 0, active: false, bossNight: false, allNightsSpawned: false,
    threatBudget(day) {
      const B = PE.D.BAL;
      let b = B.THREAT_BASE * Math.pow(B.THREAT_GROW, Math.min(day, 15) - 1);
      if (day > 15) b *= Math.pow(B.THREAT_GROW_ENDLESS, day - 15);
      if (PE.world.bloodmoon) b *= B.BLOODMOON_MULT;
      return b;
    },
    planNight() {
      const W = PE.world, day = W.day;
      // 血月判定
      W.bloodmoon = W.bloodmoonQueued || (day > 6 && Math.random() < PE.D.BAL.BLOODMOON_CHANCE) || (W.endless && day % 5 === 0);
      W.bloodmoonQueued = false;
      let budget = this.threatBudget(day);
      this.bossNight = (day === 5 || day === 10 || day === 15) || (W.endless && day % 5 === 0 && day > 15);
      if (this.bossNight) budget *= 0.6; // Boss 夜小怪略减
      // 敌池
      const pool = Object.keys(PE.D.ENEMIES).filter(id => {
        const d = PE.D.ENEMIES[id];
        return d.night <= day && id !== 'tribal';
      });
      const comp = {};
      if (day === 1) comp.wolf = 3; // 第一夜保底轻松：只有三头狼
      else if (day === 2) { comp.wolf = 5; }
      else {
        let spent = 0;
        while (spent < budget) {
          const id = U.pick(pool);
          const d = PE.D.ENEMIES[id];
          const n = d.group || 1;
          comp[id] = (comp[id] || 0) + n;
          spent += d.threat * n;
          if (Object.keys(comp).length > 60) break;
        }
      }
      // 敌对部落夜袭
      const raid = PE.sys.tribes.raidTonight();
      if (raid) comp.tribal = (comp.tribal || 0) + Math.min(2 + Math.floor(day / 3), 8);
      // 分波
      const nWaves = U.clamp(2 + Math.floor(day / 5), 2, 4);
      const dirs = [];
      const nd = U.randi(1, Math.min(3, 1 + Math.floor(day / 4)));
      for (let i = 0; i < nd; i++) dirs.push(U.rand(0, U.TAU));
      this.plan = { comp, nWaves, dirs, raid, day };
      this.waveIdx = 0;
      W.threatsToday = Object.keys(comp);
    },
    startNight() {
      this.active = true; this.waveIdx = 0; this.nextWaveT = 3;
      const W = PE.world;
      if (W.bloodmoon) { PE.ui.toast('🌕 血月升起——加倍的危险与收获!', '#ff5a4a'); PE.audio.sfx('stinger'); }
      // 部落盟军驰援（Boss 夜）
      PE.sys.tribes.sendAllies(this.bossNight);
      // 灵魂战士
      if (PE.sys.tech.has('spirits')) PE.sys.vill.raiseSpirits();
      PE.audio.music.intensity = 0.3;
    },
    update(dt) {
      if (!this.active || PE.world.phase !== 'night') return;
      const plan = this.plan; if (!plan) return;
      this.nextWaveT -= dt;
      if (this.nextWaveT <= 0 && this.waveIdx < plan.nWaves) {
        this.spawnWave();
        this.waveIdx++;
        this.nextWaveT = U.rand(22, 32);
        PE.audio.music.intensity = Math.min(1, 0.3 + this.waveIdx * 0.25);
        // Boss 在第二波登场
        if (this.bossNight && this.waveIdx === 2) {
          const day = plan.day;
          if (day === 5) spawnBoss('claw');
          else if (day === 10) spawnBoss('shadow');
          else if (day >= 15 && !PE.world.nightmare) spawnBoss(day === 15 ? 'claw' : U.pick(['claw', 'shadow'])); // 15夜防守线为强化爪
        }
      }
      // 影 Boss 吞光计时
      if (PE.world.lightEat > 0) PE.world.lightEat -= dt;
    },
    spawnWave() {
      const plan = this.plan, W = PE.world;
      const share = 1 / plan.nWaves;
      PE.ui.toast(`第 ${this.waveIdx + 1}/${plan.nWaves} 波来袭!`, '#ff8f7a');
      PE.audio.sfx('horn', { vol: 0.5 });
      for (const id in plan.comp) {
        let n = Math.round(plan.comp[id] * share);
        if (id === 'mammoth' || id === 'rhino' || id === 'bear') n = this.waveIdx === plan.nWaves - 1 ? plan.comp[id] : 0; // 重型压轴
        for (let i = 0; i < n; i++) {
          const a = U.pick(plan.dirs) + U.rand(-0.35, 0.35);
          let x = W.camp.x + Math.cos(a) * U.rand(680, 820), y = W.camp.y + Math.sin(a) * U.rand(680, 820);
          x = U.clamp(x, 80, PE.MAPW - 80); y = U.clamp(y, 80, PE.MAPH - 80);
          for (let t2 = 0; t2 < 10 && !W.walkable(x, y); t2++) { x += (W.camp.x - x) * 0.15; y += (W.camp.y - y) * 0.15; } // 避开水域
          const e = spawn(id, x, y);
          if (id === 'tribal') { e.def = { ...e.def }; e.hostileTribe = plan.raid; }
        }
      }
      // 限制总量
      let cnt = 0;
      for (const e of W.ents) if (!e.dead && e.kind === 'enemy') cnt++;
      if (cnt > 90) { /* 超载保护：不再生成 */ this.waveIdx = plan.nWaves; }
    },
    // 黄昏预告文本
    forecast() {
      const plan = this.plan; if (!plan) return null;
      const known = PE.sys.tech.has('vision') || PE.sys.pets.hasEagle();
      const names = Object.keys(plan.comp).map(id => PE.D.ENEMIES[id].name);
      const total = Object.values(plan.comp).reduce((a, b) => a + b, 0);
      return {
        dirs: plan.dirs, boss: this.bossNight, blood: PE.world.bloodmoon, raid: plan.raid,
        text: known ? `${names.join('、')} 共约${total}只` : `${names.slice(0, 2).join('、')}${names.length > 2 ? '…还有更多' : ''}`,
        exact: known,
      };
    },
  };

  /* ---------- 绘制 ---------- */
  function drawEnt(ctx, e) {
    ctx.save(); ctx.translate(e.x, e.y);
    const S = PE.S;
    if (!e.fly) S.shadow(ctx, e.r + 3);
    else S.shadow(ctx, e.r, 0.3, 0.15);
    if (e.boss === 'claw') S.drawBossClaw(ctx, e, e.t);
    else if (e.boss === 'shadow') S.drawBossShadow(ctx, e, e.t);
    else if (e.boss === 'lord') S.drawBossLord(ctx, e, e.t);
    else if (e.type === 'snake') S.drawSnake(ctx, e, e.t);
    else if (e.type === 'bat') S.drawBat(ctx, e, e.t);
    else if (e.type === 'eye') S.drawEye(ctx, e, e.t);
    else if (e.type === 'bogspawn') S.drawBogspawn(ctx, e, e.t);
    else if (e.type === 'tribal' || e.type === 'trader') {
      const tc = e.tribe ? PE.D.TRIBES[e.tribe] : (e.hostileTribe ? PE.D.TRIBES[e.hostileTribe] : null);
      S.humanoid(ctx, {
        skin: '#c99060', cloth: tc ? tc.color : '#7a5a3a', hair: '#241a10',
        face: e.face, walk: e.walk, t: e.t, atk: Math.max(0, e.atkT), weapon: 'spear',
        feather: e.kind === 'ally' ? '#8fe86d' : (e.kind === 'enemy' ? '#ff5a4a' : '#e8d5a8'), e,
      });
    }
    else if (S.QUAD[e.type]) {
      const cfg = S.QUAD[e.type](e);
      cfg.face = e.face; cfg.walk = e.walk; cfg.t = e.t; cfg.e = e;
      S.quadruped(ctx, cfg);
      if (e.state === 'windup') { ctx.fillStyle = '#ffcf5f'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('❗', 0, -46); }
    }
    // 血条
    if ((e.kind === 'enemy' || e.aggro) && e.hp < e.maxhp) {
      const w = e.boss ? 60 : 26, hp01 = e.hp / e.maxhp;
      ctx.fillStyle = 'rgba(20,15,10,0.7)'; ctx.fillRect(-w / 2, e.boss ? -110 : -44, w, 4);
      ctx.fillStyle = e.boss ? '#b02eff' : '#d84a2e'; ctx.fillRect(-w / 2 + 1, (e.boss ? -110 : -44) + 1, (w - 2) * hp01, 2);
    }
    // 驯服提示
    if (e.tameable && e.hp < e.maxhp * 0.5) {
      ctx.fillStyle = '#8fe86d'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('可驯服 [E]', 0, -50 + Math.sin(e.t * 4) * 3);
    }
    ctx.restore();
  }

  function updateEnt(e, dt) {
    if (e.kind === 'enemy') updateEnemy(e, dt);
    else if (e.kind === 'wild') updateWild(e, dt);
    else if (e.kind === 'ally') updateAlly(e, dt);
    else if (e.kind === 'npc') updateNPC(e, dt);
  }

  return { spawn, spawnWild, spawnNPC, spawnAlly, spawnBoss, spawnHunterEye, updateEnt, drawEnt, die, director, nearestFoe };
})();
