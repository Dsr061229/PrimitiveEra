/* ============================================================
   原始纪元 · systems.js —— 建造/经济/科技/村民/驯养/部落/事件/祝福/存档
   ============================================================ */
'use strict';
PE.mods = {}; // 全局修正集（祝福/科技/天赋/神器汇总）

PE.meta = { totem: 0, talents: {}, unlocks: {}, achieves: {}, bestNight: 0, wins: 0 };

PE.sys = (() => {
  const U = PE.U;
  const S = {};

  /* ================= 修正集重算 ================= */
  S.recalcMods = () => {
    const m = {};
    const add = (k, v) => { m[k] = (m[k] || 0) + v; };
    for (const bid of S.bless.owned) {
      const b = PE.D.BLESSINGS.find(x => x.id === bid);
      if (b) for (const k in b.mod) add(k, b.mod[k]);
    }
    const t = PE.meta.talents;
    add('fireout', 0.1 * (t.t_fire || 0));
    add('maxhp', 15 * (t.t_hp || 0));
    add('wallhp', 0.15 * (t.t_wall || 0));
    if (PE.player.cls === 'chief') add('wallcost', 0.2);
    if (S.tech && S.tech.has('taming')) add('petbuff', 0.25);
    if (PE.world.artifacts.eternalflame) { add('fireout', 0.5); add('fuel', 0.3); }
    if (PE.world.artifacts.wardrum) { add('villdmg', 0.3); add('petbuff', 0.3); }
    PE.mods = m;
    // 玩家血量上限同步
    const P = PE.player;
    const nm = PE.D.BAL.PLAYER_HP + (m.maxhp || 0);
    if (nm > P.maxhp) P.hp += nm - P.maxhp;
    P.maxhp = nm;
  };
  S.warBuff = () => {
    let b = 1;
    if (PE.world.phase === 'night') {
      if (S.tech.has('warhorn')) b *= 1.3;
      if (PE.world.artifacts.wardrum) b *= 1.15;
    }
    return b;
  };
  S.potBonus = () => {
    let n = 0;
    for (const b of PE.world.buildings) if (!b.dead && b.type === 'pot') n++;
    return Math.min(n, 3) * 0.05;
  };

  /* ================= 建筑 ================= */
  S.makeBuilding = (type, x, y) => {
    const def = PE.D.BUILDINGS[type];
    const T = 32, tx = Math.floor(x / T), ty = Math.floor(y / T);
    const hpMult = def.cat === 'wall' ? 1 + (PE.mods.wallhp || 0) : 1;
    return {
      id: U.uid(), type, def, cat: def.cat,
      x: tx * T + 16, y: ty * T + 16,
      hp: Math.round(def.hp * hpMult), maxhp: Math.round(def.hp * hpMult),
      lvl: 1, flash: 0, cd: 0, cdT: 0, burnT: 0, dead: false, marked: false,
    };
  };
  S.destroyBuilding = (b, src) => {
    if (b.dead) return;
    // 大地回响祝福：每夜首毁免费复原
    if (PE.mods.rebuild && PE.world.phase === 'night' && !S._rebuiltTonight && b.cat === 'wall') {
      S._rebuiltTonight = true;
      b.hp = b.maxhp;
      PE.fx.magic(b.x, b.y - 10, '#8fe86d');
      PE.ui.toast('大地回响：' + b.def.name + ' 复原了!', '#8fe86d');
      return;
    }
    b.dead = true; b.hp = 0;
    PE.world.removeBuildingTile(b);
    PE.flow.rebuild(PE.world.camp.x, PE.world.camp.y);
    PE.fx.burst(b.x, b.y - 10, 20, { color: '#a4713d', size: 4, life: 0.8, sp: 180 });
    PE.audio.sfx('breakB', { x: b.x, y: b.y });
    PE.cam.shake(4);
    S._lostTonight++;
    if (b === PE.world.campfire) {
      PE.ui.toast('长明篝火熄灭了……', '#ff5a4a');
      PE.main.endRun(false);
    }
  };
  // 取坐标处的建筑（含不占格的陷阱/火把桩等）
  S.buildingAt = (x, y) => {
    const b = PE.world.buildingAtTile(Math.floor(x / 32), Math.floor(y / 32));
    if (b && !b.dead) return b;
    let best = null, bd = 26 * 26;
    for (const c of PE.world.buildings) {
      if (c.dead) continue;
      const d = U.dist2(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  // 主动拆除：返还 50% 材料（与被敌人摧毁走不同逻辑，不触发失败判定/复原祝福）
  S.demolish = b => {
    if (!b || b.dead) return;
    if (b.cat === 'core') { PE.ui.toast('部落的心脏可不能拆！', '#ff8f7a'); PE.audio.sfx('error'); return; }
    const back = [];
    for (const k in b.def.cost) {
      const n = Math.floor(b.def.cost[k] * 0.5);
      if (n > 0) { PE.world.addRes(k, n); back.push('+' + n + PE.D.RES[k].name); }
    }
    b.dead = true;
    PE.world.removeBuildingTile(b);
    PE.flow.rebuild(PE.world.camp.x, PE.world.camp.y);
    PE.fx.burst(b.x, b.y - 10, 12, { color: '#a4713d', size: 3.5, life: 0.6, sp: 130 });
    PE.audio.sfx('breakB', { x: b.x, y: b.y, vol: 0.5 });
    PE.fx.text(b.x, b.y - 22, back.join(' ') || '已拆除', '#c9e8a0', 12);
    PE.ui.toast('已拆除 ' + b.def.name + (back.length ? '，返还 ' + back.join(' ') : ''));
  };

  // 被建筑/水域困住时弹回最近可行走点（玩家/村民/战兽通用）
  S.freeStuck = e => {
    for (let r = 1; r <= 5; r++) {
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * U.TAU;
        const nx = e.x + Math.cos(a) * r * 20, ny = e.y + Math.sin(a) * r * 20;
        if (PE.world.walkable(nx, ny, true)) { e.x = nx; e.y = ny; return true; }
      }
    }
    return false;
  };

  S.repairAllCost = () => {
    let missing = 0;
    for (const b of PE.world.buildings) if (!b.dead) missing += b.maxhp - b.hp;
    return Math.ceil(missing / (PE.D.BAL.REPAIR_HP_PER_EMBER * (1 + (PE.mods.repair || 0))));
  };
  S.repairAll = () => {
    const cost = S.repairAllCost();
    if (cost <= 0) { PE.ui.toast('没有需要修理的建筑'); return; }
    if (PE.world.ember < cost) { PE.ui.toast('火种不足 (需 ' + cost + ')', '#ff8f7a'); PE.audio.sfx('error'); return; }
    PE.world.ember -= cost;
    for (const b of PE.world.buildings) if (!b.dead) { if (b.hp < b.maxhp) PE.fx.heal(b.x, b.y - 10); b.hp = b.maxhp; }
    PE.audio.sfx('build'); PE.ui.toast('全部修理完毕');
  };

  /* ---------- 建造模式 ---------- */
  S.build = {
    active: false, sel: null, ghost: { x: 0, y: 0, ok: false },
    available() {
      return Object.keys(PE.D.BUILDINGS).filter(id => {
        const d = PE.D.BUILDINGS[id];
        if (d.cat === 'core') return false;
        if (d.tech && !S.tech.has(d.tech)) return false;
        if (id === 'wall_wood' || id === 'wall_stone' || id === 'wall_bone') return true; // 也可直接建
        return true;
      });
    },
    count(type) { let n = 0; for (const b of PE.world.buildings) if (!b.dead && b.type === type) n++; return n; },
    enter(type) { this.active = true; this.sel = type; PE.audio.sfx('ui'); },
    exit() { this.active = false; this.sel = null; },
    update() {
      if (!this.active || !this.sel) return;
      const p = PE.input.st.pointer;
      const w = PE.cam.toWorld(p.x, p.y);
      const T = 32, tx = Math.floor(w.x / T), ty = Math.floor(w.y / T);
      this.ghost.x = tx * T + 16; this.ghost.y = ty * T + 16;
      this.ghost.tx = tx; this.ghost.ty = ty;
      if (this.sel === 'demolish') { // 拆除模式：指向建筑
        this.ghost.existing = S.buildingAt(w.x, w.y);
        this.ghost.ok = !!this.ghost.existing && this.ghost.existing.cat !== 'core';
        return;
      }
      this.ghost.existing = PE.world.buildingAtTile(tx, ty);
      this.ghost.ok = this.valid(tx, ty);
    },
    valid(tx, ty) {
      const T = 32, x = tx * T + 16, y = ty * T + 16;
      if (PE.world.isWater(x, y)) return false;
      if (U.dist(x, y, PE.world.camp.x, PE.world.camp.y) > 900) return false; // 建造半径
      const ex = PE.world.buildingAtTile(tx, ty);
      if (ex) { // 允许墙升级
        const d = PE.D.BUILDINGS[this.sel];
        return ex.def.up === this.sel && !ex.dead;
      }
      for (const b of PE.world.buildings) if (!b.dead && b.tx === tx && b.ty === ty) return false;
      for (const n of PE.world.nodes) if (!n.dead && U.dist2(x, y, n.x, n.y) < 26 * 26) return false;
      // 不能把建筑压在人或兽身上（防止把自己/村民砌进墙里）
      if (U.dist2(x, y, PE.player.x, PE.player.y) < 30 * 30) return false;
      for (const c of PE.grid.query(x, y, 30, [])) {
        if (c.kind === 'villager' || c.kind === 'pet' || c.kind === 'npc' || c.kind === 'ally') return false;
      }
      const def = PE.D.BUILDINGS[this.sel];
      if (def.max && this.count(this.sel) >= def.max) return false;
      return true;
    },
    place() {
      if (this.sel === 'demolish') { // 拆除模式下点击=拆
        if (this.ghost.ok) { S.demolish(this.ghost.existing); this.ghost.existing = null; this.ghost.ok = false; }
        else PE.audio.sfx('error');
        return;
      }
      if (!this.ghost.ok) { PE.audio.sfx('error'); return; }
      const def = PE.D.BUILDINGS[this.sel];
      const cost = PE.world.buildCost(def);
      const ex = this.ghost.existing;
      if (!PE.world.pay(cost)) { PE.ui.toast('材料不足', '#ff8f7a'); PE.audio.sfx('error'); return; }
      if (ex && ex.def.up === this.sel) { // 原位升级
        PE.world.removeBuildingTile(ex);
        ex.type = this.sel; ex.def = def;
        ex.maxhp = Math.round(def.hp * (1 + (PE.mods.wallhp || 0)));
        ex.hp = ex.maxhp;
        PE.world.placeBuildingTile(ex);
      } else {
        const b = S.makeBuilding(this.sel, this.ghost.x, this.ghost.y);
        PE.world.buildings.push(b);
        PE.world.placeBuildingTile(b);
      }
      PE.flow.rebuild(PE.world.camp.x, PE.world.camp.y);
      PE.audio.sfx('build');
      PE.fx.burst(this.ghost.x, this.ghost.y - 10, 8, { color: '#c2b280', size: 3, life: 0.5, sp: 90 });
      if (def.max && this.count(this.sel) >= def.max) this.exit();
    },
  };

  /* ---------- 建筑逐帧（图腾塔/陷阱/帐篷/火油沟） ---------- */
  S.updateBuildings = dt => {
    const W = PE.world;
    for (const b of W.buildings) {
      if (b.dead) continue;
      if (b.flash > 0) b.flash -= dt;
      if (b.cdT > 0) b.cdT -= dt;
      const d = b.def;
      if (d.turret) {
        b.cd -= dt;
        if (b.cd <= 0) {
          const foe = PE.enemies.nearestFoe(b, d.turret.range);
          if (foe) {
            b.cd = 1 / d.turret.rate;
            const a = U.ang(b.x, b.y - 24, foe.x, foe.y);
            PE.projectiles.shoot(b.x, b.y - 24, a, { dmg: d.turret.dmg * (1 + (PE.mods.trapdmg || 0)), kind: 'stone', spd: 420, byPlayer: false });
            PE.audio.sfx('bow', { x: b.x, y: b.y, vol: 0.4 });
          }
        }
      }
      if (b.type === 'spike' && b.cdT <= 0) {
        const foe = PE.enemies.nearestFoe(b, 24);
        if (foe && !foe.fly) {
          b.cdT = d.cd;
          PE.combat.hit(foe, d.dmg * (1 + (PE.mods.trapdmg || 0)), { hitstop: false });
          foe.slowT = 2;
        }
      }
      if (b.type === 'tripwire' && b.cdT <= 0) {
        const foe = PE.enemies.nearestFoe(b, 22);
        if (foe && !foe.fly) {
          b.cdT = d.cd;
          foe.stun = d.stun; foe.state = 'approach';
          PE.fx.text(foe.x, foe.y - 24, '绊倒!', '#ffcf5f', 14);
          PE.audio.sfx('roll', { x: b.x, y: b.y });
        }
      }
      if (b.type === 'firepit') {
        if (b.burnT > 0) {
          b.burnT -= dt;
          const foes = PE.grid.query(b.x, b.y, 34, []);
          for (const f of foes) if (f.kind === 'enemy') PE.combat.hit(f, d.burn * (1 + (PE.mods.trapdmg || 0)) * dt, { hitstop: false });
          if (Math.random() < dt * 10) PE.fx.sparks(b.x + U.rand(-12, 12), b.y - 6, 1);
          if (b.burnT <= 0) b.cdT = d.cd;
        } else if (b.cdT <= 0) {
          const foe = PE.enemies.nearestFoe(b, 26);
          if (foe) { b.burnT = d.dur; PE.audio.sfx('build', { x: b.x, y: b.y }); }
        }
      }
      if (b.type === 'tent' && W.phase === 'night') {
        for (const e of W.ents) {
          if (e.kind === 'villager' && !e.dead && U.dist2(e.x, e.y, b.x, b.y) < 70 * 70 && e.hp < e.maxhp) e.hp = Math.min(e.maxhp, e.hp + 2 * dt);
        }
      }
    }
  };

  /* ================= 科技 ================= */
  S.tech = {
    done: {}, researching: null, prog: 0,
    has(id) { return !!this.done[id]; },
    canStart(id) {
      const t = PE.D.TECH[id];
      if (this.done[id] || this.researching) return false;
      if (t.req && !this.done[t.req]) return false;
      // 需要研究石坛
      if (!PE.world.buildings.some(b => !b.dead && b.def.research)) return false;
      return PE.world.canPay({ ...t.cost, ember: t.ember });
    },
    start(id) {
      if (!this.canStart(id)) { PE.audio.sfx('error'); return false; }
      const t = PE.D.TECH[id];
      PE.world.pay({ ...t.cost, ember: t.ember });
      this.researching = id; this.prog = 0;
      PE.audio.sfx('buy');
      return true;
    },
    grant(id) { this.done[id] = true; },
    update(dt) {
      if (!this.researching) return;
      let spd = 1;
      for (const e of PE.world.ents) if (e.kind === 'villager' && e.job === 'shaman' && !e.dead) { spd = 1.5; break; }
      this.prog += dt * spd;
      const t = PE.D.TECH[this.researching];
      if (this.prog >= t.t) {
        this.done[this.researching] = true;
        PE.ui.toast('🔬 研究完成：' + t.name, '#6ddcff');
        PE.audio.sfx('bless');
        this.researching = null;
      }
    },
  };

  /* ================= 商店 / 打造 ================= */
  /* ---------- 篝火升级 ---------- */
  S.fireUpCost = () => {
    const cf = PE.world.campfire;
    if (!cf || cf.lvl >= 5) return null;
    return PE.D.BAL.FIRE_UP[cf.lvl];
  };
  S.upgradeFire = () => {
    const cf = PE.world.campfire, cost = S.fireUpCost();
    if (cost === null) { PE.ui.toast('篝火已是最高等级'); return; }
    if (PE.world.ember < cost) { PE.ui.toast('火种不足 (需 ' + cost + ')', '#ff8f7a'); PE.audio.sfx('error'); return; }
    PE.world.ember -= cost;
    cf.lvl++; cf.maxhp += 300; cf.hp = cf.maxhp;
    PE.fx.ring(cf.x, cf.y - 10, '#ffcf5f', 180);
    PE.fx.burst(cf.x, cf.y - 20, 24, { color: '#ff9b3d', size: 4, life: 0.9, sp: 160, up: 260 });
    PE.audio.sfx('bless');
    PE.ui.toast(`🔥 篝火升到 Lv${cf.lvl}！产出与光圈大增`, '#ffcf5f');
  };

  S.shopBuy = item => {
    const W = PE.world;
    if (item.id === 'buy_repair') { S.repairAll(); return; }
    if (item.id === 'buy_upfire') { S.upgradeFire(); return; }
    if (item.id === 'buy_villager' && S.vill.count() >= S.vill.cap()) { PE.ui.toast('村民已达上限(需更多帐篷)', '#ff8f7a'); PE.audio.sfx('error'); return; }
    if (W.ember < item.ember) { PE.ui.toast('火种不足', '#ff8f7a'); PE.audio.sfx('error'); return; }
    W.ember -= item.ember;
    const g = item.give;
    if (g.weapon) PE.player.gainWeapon(g.weapon);
    if (g.arrows) W.arrows += Math.round(g.arrows / (PE.mods.arrowcost ? 0.5 : 1) * 1); // 祝福已在打造端生效，这里直接给
    if (g.res) for (const k in g.res) W.addRes(k, g.res[k]);
    if (g.usable) PE.player.gainUsable(g.usable);
    if (g.villager) S.vill.add();
    PE.audio.sfx('buy');
  };
  S.craftBuy = id => {
    const r = PE.D.CRAFT[id], W = PE.world;
    if (r.tech && !S.tech.has(r.tech)) { PE.audio.sfx('error'); return; }
    let cost = r.cost;
    if (id === 'arrows' && PE.mods.arrowcost) { cost = {}; for (const k in r.cost) cost[k] = Math.max(1, Math.ceil(r.cost[k] * PE.mods.arrowcost)); }
    if (!W.pay(cost)) { PE.ui.toast('材料不足', '#ff8f7a'); PE.audio.sfx('error'); return; }
    if (r.kind === 'weapon') PE.player.gainWeapon(r.out);
    else if (r.kind === 'tool') { PE.player.toolTier = r.out === 'tool3' ? 3 : 2; PE.ui.toast('工具升级!'); }
    else if (r.kind === 'ammo') W.arrows += r.n;
    else if (r.kind === 'usable') PE.player.gainUsable(r.out, r.n);
    else if (r.kind === 'armor') { PE.player.armor = true; PE.ui.toast('穿上兽皮甲'); }
    PE.audio.sfx('buy');
  };

  /* ================= 村民 ================= */
  S.vill = {
    fallen: [], // 本局阵亡者（唤灵术）
    count() { let n = 0; for (const e of PE.world.ents) if (e.kind === 'villager' && !e.dead) n++; return n; },
    cap() {
      let c = PE.D.BAL.VILL_CAP_BASE;
      for (const b of PE.world.buildings) if (!b.dead && b.def.pop) c += b.def.pop;
      return Math.min(c, 8);
    },
    add(data) {
      const W = PE.world;
      const e = {
        id: U.uid(), kind: 'villager', type: 'villager',
        x: W.camp.x + U.rand(-60, 60), y: W.camp.y + U.rand(40, 90),
        r: 11, hp: 80, maxhp: 80, face: 1, walk: 0, t: U.rand(0, 9), flash: 0, dead: false,
        name: data ? data.name : U.pick(PE.D.NAMES) + (Math.random() < 0.3 ? '·' + U.pick(PE.D.NAMES) : ''),
        trait: data ? data.trait : U.pick(Object.keys(PE.D.TRAITS)),
        job: data ? data.job : 'gatherer',
        atkTimer: 0, atkT: 0, state: 'idle', node: null, sickDays: 0, morale: true,
        skin: U.pick(['#d8a06a', '#c98f5a', '#b87f4f']),
      };
      if (data && data.hp) e.hp = data.hp;
      W.ents.push(e);
      PE.ui.toast('👤 ' + e.name + ' 加入了部落 (' + PE.D.TRAITS[e.trait].name + ')');
      return e;
    },
    die(e, src) {
      if (e.dead) return;
      e.dead = true;
      this.fallen.push(e.name);
      PE.fx.burst(e.x, e.y - 8, 12, { color: '#a82c2c', size: 3, life: 0.6, sp: 120 });
      PE.ui.toast('💀 ' + e.name + ' 永远离开了部落…', '#ff5a4a');
      PE.audio.sfx('die', { x: e.x, y: e.y });
    },
    raiseSpirits() {
      for (const name of this.fallen.slice(0, 3)) {
        const a = PE.enemies.spawnAlly(PE.world.camp.x + U.rand(-50, 50), PE.world.camp.y + U.rand(-50, 50), null, 1);
        a.spirit = true; a.name = name;
        PE.fx.magic(a.x, a.y, '#6ddcff');
      }
      if (this.fallen.length) PE.ui.toast('唤灵术：逝者归来助战!', '#6ddcff');
    },
    dmg() { return 12 * (1 + (PE.mods.villdmg || 0)) * S.warBuff(); },
    update(e, dt) {
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      if (e.atkT > 0) e.atkT -= dt * 3;
      if (!PE.world.walkable(e.x, e.y, true)) S.freeStuck(e); // 被砌进墙里自动脱困
      const W = PE.world, night = W.phase === 'night';
      const trait = e.trait;
      // 胆小夜晚回篝火边
      if (night && (trait === 'timid' || !e.morale)) { this.goTo(e, W.camp.x + Math.sin(e.id) * 70, W.camp.y + Math.cos(e.id) * 70, dt); return; }
      if (!e.morale) { e.walk = 0; return; }
      // 逃离近敌（非猎人）
      const foe = PE.enemies.nearestFoe(e, e.job === 'hunter' ? 240 : 130);
      if (foe && e.job !== 'hunter') {
        const a = U.ang(foe.x, foe.y, e.x, e.y);
        this.move(e, Math.cos(a), Math.sin(a), 80, dt);
        return;
      }
      switch (e.job) {
        case 'gatherer': {
          if (night) { this.goTo(e, W.camp.x + Math.sin(e.id) * 80, W.camp.y + Math.cos(e.id) * 80, dt); return; }
          // 走不到的资源点拉黑（每天黎明清空），换下一个
          if (e.node && e._stuckT > 2.5) {
            (e.badNodes = e.badNodes || new Set()).add(e.node.id);
            e.node = null; e._stuckT = 0;
          }
          if (!e.node || e.node.dead) {
            e.node = null;
            e.searchCd = (e.searchCd || 0) - dt;
            if (e.searchCd <= 0) {
              e.searchCd = 1.5;
              let bd = Infinity;
              for (const n of W.nodes) {
                if (n.dead || n.fish || n.type === 'obsidian' || n.type === 'star') continue;
                if (e.badNodes && e.badNodes.has(n.id)) continue;
                if (U.dist2(n.x, n.y, W.camp.x, W.camp.y) > 1300 * 1300) continue; // 不跑出安全范围
                const d = U.dist2(n.x, n.y, e.x, e.y); // 就近取材(以村民自身为准)
                if (d < bd) { bd = d; e.node = n; }
              }
            }
          }
          if (e.node) {
            const d = U.dist(e.x, e.y, e.node.x, e.node.y);
            if (d > 40) this.goTo(e, e.node.x, e.node.y, dt);
            else {
              e.walk = 0; e.atkTimer -= dt;
              if (e.atkTimer <= 0) {
                e.atkTimer = 1.4; e.atkT = 1;
                const n = e.node;
                n.hits -= 1; n.shake = 0.2;
                const y = W.nodeYield(n), gmult = (1 + (PE.mods.gather || 0) + S.potBonus()) * (trait === 'diligent' ? 1.15 : 1);
                for (const k in y) W.addRes(k, Math.max(1, Math.round(y[k] * gmult)));
                PE.audio.sfx(n.type === 'tree' ? 'chop' : 'mine', { x: n.x, y: n.y, vol: 0.5 });
                if (n.hits <= 0) { n.dead = true; n.respawnDay = W.day + (n.type === 'bush' ? 1 : 3); e.node = null; }
              }
            }
          } else e.walk = Math.max(0, e.walk - dt * 5);
          break;
        }
        case 'hunter': {
          let tgt = foe;
          if (!tgt && !night) { // 白天猎小动物
            let bd = 500 * 500;
            for (const c of W.ents) {
              if (c.kind !== 'wild' || c.dead || !c.flee) continue;
              const d = U.dist2(e.x, e.y, c.x, c.y);
              if (d < bd) { bd = d; tgt = c; }
            }
          }
          if (tgt) {
            const d = U.dist(e.x, e.y, tgt.x, tgt.y);
            if (d < e.r + tgt.r + 10) {
              e.walk = 0; e.atkTimer -= dt;
              if (e.atkTimer <= 0) {
                e.atkTimer = 1; e.atkT = 1;
                PE.combat.hit(tgt, this.dmg() * (trait === 'brave' ? 1.25 : 1), { from: e, kb: 6, hitstop: false });
              }
            } else if (d < 600) this.goTo(e, tgt.x, tgt.y, dt);
          } else {
            // 巡逻篝火
            const gx = W.camp.x + Math.cos(e.t * 0.5 + e.id) * 130, gy = W.camp.y + Math.sin(e.t * 0.5 + e.id) * 130;
            this.goTo(e, gx, gy, dt, 20);
          }
          break;
        }
        case 'shaman': {
          this.goTo(e, W.camp.x - 60, W.camp.y - 40, dt, 30);
          if (night) {
            e.shieldCd = (e.shieldCd || 0) - dt;
            if (e.shieldCd <= 0 && !PE.player.dead) {
              e.shieldCd = 10;
              PE.player.shield = Math.min(40, PE.player.shield + 30);
              PE.fx.magic(PE.player.x, PE.player.y - 16, '#6ddcff');
            }
          }
          break;
        }
        case 'artisan': {
          if (!e.fixTarget || e.fixTarget.dead || e.fixTarget.hp >= e.fixTarget.maxhp) {
            e.fixTarget = null;
            let worst = 1;
            for (const b of W.buildings) {
              if (b.dead) continue;
              const p = b.hp / b.maxhp;
              if (p < worst) { worst = p; e.fixTarget = b; }
            }
            if (worst > 0.95) e.fixTarget = null;
          }
          if (e.fixTarget) {
            const b = e.fixTarget, d = U.dist(e.x, e.y, b.x, b.y);
            if (d > 40) this.goTo(e, b.x, b.y, dt);
            else {
              e.walk = 0; e.atkTimer -= dt;
              if (e.atkTimer <= 0) {
                e.atkTimer = 0.5; e.atkT = 1;
                const cost = 1; // 半价
                if (W.ember >= cost) { W.ember -= cost; b.hp = Math.min(b.maxhp, b.hp + 20); PE.audio.sfx('repair', { x: b.x, y: b.y }); }
              }
            }
          } else this.goTo(e, W.camp.x + 70, W.camp.y + 30, dt, 30);
          break;
        }
      }
    },
    move(e, dx, dy, sp, dt) {
      const nx = e.x + dx * sp * dt, ny = e.y + dy * sp * dt;
      let moved = false;
      if (PE.world.walkable(nx, e.y, true)) { e.x = nx; moved = true; }
      else if (dx && PE.world.walkable(nx, e.y + 14, true)) { e.y += sp * dt * 0.8; moved = true; } // 门口滑入辅助
      else if (dx && PE.world.walkable(nx, e.y - 14, true)) { e.y -= sp * dt * 0.8; moved = true; }
      if (PE.world.walkable(e.x, ny, true)) { e.y = ny; moved = true; }
      else if (dy && PE.world.walkable(e.x + 14, ny, true)) { e.x += sp * dt * 0.8; moved = true; }
      else if (dy && PE.world.walkable(e.x - 14, ny, true)) { e.x -= sp * dt * 0.8; moved = true; }
      e.walk = Math.min(1, e.walk + dt * 5);
      if (dx) e.face = dx > 0 ? 1 : -1;
      // 卡住 3 秒：原始人会翻越障碍（仅友方，不影响防线对敌）
      if (!moved) {
        e._stuckT = (e._stuckT || 0) + dt;
        if (e._stuckT > 3) {
          e._stuckT = 0;
          const hx = e.x + dx * 76, hy = e.y + dy * 76;
          if (PE.world.walkable(hx, hy, true)) {
            e.x = hx; e.y = hy;
            PE.fx.text(e.x, e.y - 30, '翻越!', '#c9e8a0', 11);
          }
        }
      } else e._stuckT = 0;
    },
    goTo(e, x, y, dt, stopAt = 10) {
      const d = U.dist(e.x, e.y, x, y);
      if (d < stopAt) { e.walk = Math.max(0, e.walk - dt * 5); return; }
      const a = U.ang(e.x, e.y, x, y);
      this.move(e, Math.cos(a), Math.sin(a), 85, dt);
    },
    draw(ctx, e) {
      ctx.save(); ctx.translate(e.x, e.y);
      PE.S.shadow(ctx, 11);
      const jobC = { gatherer: '#7a9a4e', hunter: '#c25b3a', shaman: '#5a7a8a', artisan: '#8a6a3a' };
      PE.S.humanoid(ctx, {
        skin: e.skin, cloth: jobC[e.job] || '#8a5a3a', hair: '#2a1e12', size: 0.9,
        face: e.face, walk: e.walk, t: e.t, atk: Math.max(0, e.atkT),
        weapon: e.job === 'hunter' ? 'spear' : null, e,
      });
      // 名字与血条
      ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(240,230,200,0.85)';
      ctx.fillText(e.name + (e.sickDays > 0 ? '🤒' : ''), 0, -52);
      if (e.hp < e.maxhp) {
        ctx.fillStyle = 'rgba(20,15,10,0.7)'; ctx.fillRect(-13, -48, 26, 3);
        ctx.fillStyle = '#6db15f'; ctx.fillRect(-12, -47.5, 24 * (e.hp / e.maxhp), 2);
      }
      ctx.restore();
    },
  };

  /* ================= 战兽 ================= */
  S.pets = {
    cap() { let c = 1; for (const b of PE.world.buildings) if (!b.dead && b.def.beast) c += b.def.beast; return c; },
    count() { let n = 0; for (const e of PE.world.ents) if (e.kind === 'pet' && !e.dead) n++; return n; },
    hasEagle() { return PE.world.ents.some(e => e.kind === 'pet' && e.type === 'eagle' && !e.dead); },
    add(type) {
      const d = PE.D.PETS[type];
      const buff = 1 + (PE.mods.petbuff || 0);
      const e = {
        id: U.uid(), kind: 'pet', type, x: PE.player.x + 30, y: PE.player.y + 20,
        r: d.r, hp: d.hp * buff, maxhp: d.hp * buff, dmg: d.dmg * buff, spd: d.spd,
        face: 1, walk: 0, t: U.rand(0, 9), flash: 0, dead: false, atkTimer: 0, atkT: 0,
        growth: 0, savedOnce: false, mounted: false,
      };
      PE.world.ents.push(e);
      PE.ui.toast('🐾 ' + d.name + ' 加入了部落!');
      PE.audio.sfx('bless');
      return e;
    },
    tryTame(wild) {
      if (this.count() >= this.cap()) { PE.ui.toast('兽栏已满(建造兽栏+2)', '#ff8f7a'); return; }
      const wd = PE.D.WILD[wild.type];
      if (!wd || !wd.tameAs) return;
      if ((PE.world.res.food || 0) < wd.tameN) { PE.ui.toast(`需要 ${wd.tameN} 食物驯服`, '#ff8f7a'); return; }
      PE.world.res.food -= wd.tameN;
      wild.dead = true;
      this.add(wd.tameAs);
      PE.fx.heal(wild.x, wild.y - 10);
    },
    die(e) {
      if (PE.mods.petsave && !e.savedOnce) {
        e.savedOnce = true; e.hp = e.maxhp * 0.3;
        PE.fx.magic(e.x, e.y, '#8fe86d');
        PE.ui.toast('灵魂链接救下了 ' + PE.D.PETS[e.type].name + '!', '#8fe86d');
        return;
      }
      e.dead = true;
      if (PE.player.mount === e) PE.player.dismount();
      PE.ui.toast('💔 ' + PE.D.PETS[e.type].name + ' 倒下了…', '#ff5a4a');
      PE.fx.burst(e.x, e.y - 8, 12, { color: '#a82c2c', size: 3, life: 0.6, sp: 120 });
    },
    update(e, dt) {
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      if (e.atkT > 0) e.atkT -= dt * 3;
      if (e.mounted) return; // 被骑乘时由玩家驱动
      if (!e.fly && e.type !== 'eagle' && !PE.world.walkable(e.x, e.y, true)) S.freeStuck(e);
      const P = PE.player, d = PE.D.PETS[e.type];
      if (e.type === 'eagle') { // 绕玩家盘旋 + 侦查
        const a = e.t * 1.2;
        const gx = P.x + Math.cos(a) * 90, gy = P.y + Math.sin(a) * 90 - 30;
        const ang = U.ang(e.x, e.y, gx, gy);
        e.x += Math.cos(ang) * e.spd * dt; e.y += Math.sin(ang) * e.spd * dt;
        e.face = Math.cos(ang) >= 0 ? 1 : -1; e.walk = 1;
        PE.world.revealFog(e.x, e.y, 500);
        return;
      }
      const foe = PE.enemies.nearestFoe(e, 260) || (U.dist(P.x, P.y, e.x, e.y) < 300 ? PE.enemies.nearestFoe(P, 220) : null);
      if (foe) {
        const dd = U.dist(e.x, e.y, foe.x, foe.y);
        if (dd < e.r + foe.r + 8) {
          e.walk = 0; e.atkTimer -= dt;
          if (e.atkTimer <= 0) {
            e.atkTimer = 0.9; e.atkT = 1;
            PE.combat.hit(foe, e.dmg * (1 + e.growth), { from: e, kb: 8, hitstop: false });
          }
        } else S.vill.move(e, Math.cos(U.ang(e.x, e.y, foe.x, foe.y)), Math.sin(U.ang(e.x, e.y, foe.x, foe.y)), e.spd, dt);
      } else {
        const dd = U.dist(e.x, e.y, P.x, P.y);
        if (dd > 60) S.vill.move(e, Math.cos(U.ang(e.x, e.y, P.x, P.y)), Math.sin(U.ang(e.x, e.y, P.x, P.y)), e.spd, dt);
        else e.walk = Math.max(0, e.walk - dt * 5);
      }
    },
    draw(ctx, e) {
      ctx.save(); ctx.translate(e.x, e.y);
      if (e.type === 'eagle') {
        PE.S.shadow(ctx, 8, 0.3, 0.12);
        ctx.translate(0, -46 + Math.sin(e.t * 3) * 5);
        ctx.scale(e.face, 1);
        const fl = Math.sin(e.t * 9) * 0.6;
        ctx.fillStyle = '#6e5a45';
        for (const s of [-1, 1]) { ctx.save(); ctx.scale(s, 1); ctx.rotate(fl * 0.4); ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(16, -10, 24, -2); ctx.quadraticCurveTo(14, 4, 3, 4); ctx.closePath(); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = '#8a705a'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 8, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#e8d5a8'; ctx.beginPath(); ctx.arc(0, -6, 4, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#e8b93d'; ctx.beginPath(); ctx.moveTo(3, -7); ctx.lineTo(8, -5); ctx.lineTo(3, -4); ctx.closePath(); ctx.fill();
      } else {
        PE.S.shadow(ctx, e.r + 2);
        const cfg = PE.S.QUAD[e.type] ? PE.S.QUAD[e.type](e) : PE.S.QUAD.warwolf(e);
        cfg.face = e.face; cfg.walk = e.walk; cfg.t = e.t; cfg.e = e;
        PE.S.quadruped(ctx, cfg);
      }
      if (e.hp < e.maxhp) {
        ctx.fillStyle = 'rgba(20,15,10,0.7)'; ctx.fillRect(-13, -46, 26, 3);
        ctx.fillStyle = '#6ddcff'; ctx.fillRect(-12, -45.5, 24 * (e.hp / e.maxhp), 2);
      }
      ctx.restore();
    },
  };

  /* ================= 部落外交 ================= */
  S.tribes = {
    rep: {}, merc: 0,
    init() { for (const id in PE.D.TRIBES) this.rep[id] = PE.D.TRIBES[id].rep0; },
    change(id, n) {
      this.rep[id] = U.clamp(this.rep[id] + n, -100, 100);
      PE.ui.toast(`${PE.D.TRIBES[id].name} 声望 ${n > 0 ? '+' : ''}${n} (${this.rep[id]})`, n > 0 ? '#8fe86d' : '#ff8f7a');
      if (this.rep[id] >= 60) S.achieve('a_ally');
    },
    status(id) { const r = this.rep[id]; return r >= 60 ? '盟友' : r >= 20 ? '友好' : r > -40 ? '中立' : '敌对'; },
    trade(id, gi) {
      const g = PE.D.TRIBES[id].goods[gi];
      if (g.rep && this.rep[id] < g.rep) { PE.ui.toast(`需要声望 ≥ ${g.rep}`, '#ff8f7a'); PE.audio.sfx('error'); return; }
      if (!PE.world.pay(g.pay)) { PE.ui.toast('付不起…', '#ff8f7a'); PE.audio.sfx('error'); return; }
      if (g.get.tech) { S.tech.grant(g.get.tech); PE.ui.toast('学会了部落技艺：' + PE.D.TECH[g.get.tech].name, '#6ddcff'); }
      else if (g.get.warpaint) { PE.world.warpaintNights = 3; PE.ui.toast('战纹加身：攻击+25% 持续3夜!', '#c25b3a'); }
      else for (const k in g.get) PE.world.addRes(k, g.get[k]);
      this.change(id, 3);
      PE.audio.sfx('buy');
    },
    gift(id) {
      const a = PE.D.TRIBE_ACT.gift;
      if (!PE.world.pay(a.pay)) { PE.ui.toast('食物不足', '#ff8f7a'); return; }
      this.change(id, a.rep);
      PE.audio.sfx('buy');
    },
    hire(id) {
      const a = PE.D.TRIBE_ACT.hire;
      if (PE.world.ember < a.ember) { PE.ui.toast('火种不足', '#ff8f7a'); return; }
      PE.world.ember -= a.ember;
      const e = PE.enemies.spawnAlly(PE.world.camp.x + U.rand(-60, 60), PE.world.camp.y + U.rand(-60, 60), id, 2);
      this.change(id, a.rep);
      PE.ui.toast(PE.D.TRIBES[id].name + '的战士加入守夜(2晚)');
      PE.audio.sfx('buy');
    },
    raid() { // 主动劫掠
      for (const id in this.rep) { /* 由 npcKilled 触发 */ }
    },
    npcKilled(e) {
      e.dead = true;
      const id = e.tribe;
      this.change(id, -50);
      PE.world.ember += 150;
      PE.world.addRes('food', 10); PE.world.addRes('fur', 5);
      if (id === 'ash') PE.world.addRes('obsidian', 2); else PE.world.addRes('herb', 5), PE.world.addRes('clay', 5);
      PE.ui.toast('你劫掠了' + PE.D.TRIBES[id].name + '——他们不会忘记这笔血债!', '#ff5a4a');
      PE.audio.sfx('stinger', { vol: 0.5 });
    },
    raidTonight() {
      for (const id in this.rep) {
        if (this.rep[id] <= -40 && PE.world.day >= 3 && Math.random() < 0.55) return id;
      }
      return null;
    },
    sendAllies(bossNight) {
      if (!bossNight) return;
      for (const id in this.rep) {
        if (this.rep[id] >= 60) {
          for (let i = 0; i < 2; i++) PE.enemies.spawnAlly(PE.world.camp.x + U.rand(-70, 70), PE.world.camp.y + U.rand(-70, 70), id, 1);
          PE.ui.toast('🤝 ' + PE.D.TRIBES[id].name + ' 派战士驰援!', '#8fe86d');
        }
      }
    },
  };

  /* ================= 随机事件 ================= */
  S.events = {
    roll() {
      if (Math.random() > 0.4) return null;
      const W = PE.world;
      const pool = PE.D.EVENTS.filter(ev => {
        if (ev.req && !S.tech.has(ev.req)) return false;
        if (ev.minVill && S.vill.count() < ev.minVill) return false;
        if (ev.id === 'ev_wanderer' && S.vill.count() >= S.vill.cap()) return false;
        return true;
      });
      return U.wpick(pool, e => e.w);
    },
    choose(ev, ci) {
      const c = ev.choices[ci];
      if (c.pay && !PE.world.pay(c.pay)) { PE.ui.toast('付不起…', '#ff8f7a'); PE.audio.sfx('error'); return false; }
      this.apply(c.fx);
      return true;
    },
    apply(fx) {
      const W = PE.world;
      if (!fx) return;
      if (fx === 'villager') S.vill.add();
      else if (fx === 'meteor') {
        const a = U.rand(0, U.TAU), d = U.rand(500, 800);
        const x = U.clamp(W.camp.x + Math.cos(a) * d, 100, PE.MAPW - 100), y = U.clamp(W.camp.y + Math.sin(a) * d, 100, PE.MAPH - 100);
        W.nodes.push({ id: U.uid(), type: 'star', x, y, rtype: 'star', hits: 6, maxhits: 6, dead: false });
        const g = PE.enemies.spawn('rhino', x + 40, y);
        g.guard = true;
        W.revealFog(x, y, 200);
        PE.ui.toast('☄ 陨石坠落点已标记在地图上(有巨兽守卫)!', '#7fd7e8');
      }
      else if (fx === 'herd') {
        const f = PE.D.MAP.regions.find(r => r.id === 'forest');
        for (let i = 0; i < 6; i++) PE.enemies.spawnWild('deer', f.x + U.rand(-200, 200), f.y + U.rand(-200, 200));
        PE.ui.toast('🦌 鹿群出现在幽绿森林!');
      }
      else if (fx === 'quake') {
        for (const b of W.buildings) if (!b.dead && b.cat === 'wall') b.hp = Math.max(1, b.hp * 0.85);
        PE.cam.shake(8); PE.audio.sfx('thunder');
      }
      else if (fx === 'sabercub') S.pets.add('sabercub');
      else if (fx === 'plague') {
        const vs = W.ents.filter(e => e.kind === 'villager' && !e.dead);
        if (vs.length) { const v = U.pick(vs); v.sickDays = 3; PE.ui.toast(v.name + ' 病倒了，3天后将不治…', '#ff8f7a'); }
      }
      else if (fx === 'cure') PE.ui.toast('村民痊愈了');
      else if (fx === 'blessing') PE.ui.offerBlessing();
      else if (typeof fx === 'object') {
        if (fx.res) for (const k in fx.res) W.addRes(k, fx.res[k]);
        if (fx.rep) for (const k in fx.rep) S.tribes.change(k, fx.rep[k]);
      }
    },
  };

  /* ================= 祝福 ================= */
  S.bless = {
    owned: [],
    offer(n) {
      n = n || (PE.meta.talents.t_bless ? 4 : 3);
      const uniq = ['b_dawnheal', 'b_rollcrit', 'b_innerlight', 'b_rebuild', 'b_petsave', 'b_double', 'b_arrow'];
      const pool = PE.D.BLESSINGS.filter(b =>
        !(uniq.includes(b.id) && this.owned.includes(b.id)) &&
        !(PE.isTouch && b.id === 'b_rollcrit')); // 触屏无翻滚
      const out = [];
      const bag = U.shuffle(pool);
      for (const b of bag) {
        if (out.length >= n) break;
        const w = b.tier === 0 ? 6 : b.tier === 1 ? 3 : 1;
        if (Math.random() < w / 6 || bag.length - bag.indexOf(b) <= n - out.length) out.push(b);
      }
      while (out.length < n && pool.length) out.push(U.pick(pool));
      return out.slice(0, n);
    },
    take(id) {
      this.owned.push(id);
      S.recalcMods();
      PE.audio.sfx('bless');
    },
  };

  /* ================= 昼夜钩子 ================= */
  S._lostTonight = 0; S._rebuiltTonight = false;

  S.onDusk = () => {
    const W = PE.world;
    S._lostTonight = 0; S._rebuiltTonight = false;
    // 村民口粮
    let need = 0;
    for (const e of W.ents) if (e.kind === 'villager' && !e.dead) need += PE.D.BAL.VILL_FOOD * (e.trait === 'glutton' ? 2 : 1) * (W.season() === 'snow' ? 2 : 1);
    if (need > 0) {
      if ((W.res.food || 0) >= need) {
        W.res.food -= need;
        for (const e of W.ents) if (e.kind === 'villager') e.morale = true;
      } else {
        W.res.food = 0;
        for (const e of W.ents) if (e.kind === 'villager' && !e.dead) { e.morale = false; e.hp = Math.max(5, e.hp - 10); }
        PE.ui.toast('⚠ 食物不够！村民们士气崩溃了', '#ff8f7a');
      }
    }
    // 第15夜：梦魇之门抉择
    if (W.day === PE.D.BAL.FINAL_NIGHT && !W.endless) {
      const ready = Object.keys(W.artifacts).length >= 3 && S.tech.has('gatekey');
      if (ready) PE.ui.showGateChoice();
      else PE.ui.toast('今晚是第15夜——最长的夜。守住它!', '#ff5a4a');
    }
    PE.ui.showForecast();
  };

  S.dawn = () => {
    const W = PE.world;
    // 奖励
    let reward = PE.D.BAL.DAWN_REWARD(W.day);
    if (S._lostTonight === 0) reward += 15;
    if (W.bloodmoon) { reward *= 2; S.achieve('a_blood'); }
    if (PE.mods.dawnx2) reward *= 2;
    W.ember += Math.round(reward);
    if (W.day >= 5) S.achieve('a_n5');
    // 第15夜防守成功 → 胜利
    if (W.day >= PE.D.BAL.FINAL_NIGHT && !W.endless) { PE.main.endRun(true, true); return; }
    W.day++;
    W.phase = 'day'; W.phaseT = 0; W.bloodmoon = false;
    W.weather = W.rollWeather ? W.rollWeather() : 'sun';
    // 夜间残敌消散
    for (const e of W.ents) {
      if (e.kind === 'enemy' && !e.dead && !e.guard) { e.dead = true; PE.fx.smoke(e.x, e.y - 10); }
      if (e.kind === 'ally' && !e.dead) { e.nightsLeft--; if (e.nightsLeft <= 0 || e.spirit) { e.dead = true; PE.fx.magic(e.x, e.y, '#6ddcff'); } }
    }
    // 玩家恢复
    const P = PE.player;
    if (PE.mods.dawnheal) P.hp = P.maxhp; else P.heal(20);
    P.hunger = Math.max(P.hunger, 40);
    // 村民恢复 & 瘟疫
    for (const e of W.ents) {
      if (e.kind !== 'villager' || e.dead) continue;
      e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.3);
      e.badNodes = null; e.node = null; e.searchCd = 0; // 资源黑名单每天重置
      if (e.sickDays > 0) { e.sickDays--; if (e.sickDays === 0) S.vill.die(e); }
    }
    // 战兽成长/恢复
    for (const e of W.ents) {
      if (e.kind !== 'pet' || e.dead) continue;
      e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.4);
      if (PE.D.PETS[e.type].growth) { e.growth += 0.05; e.maxhp *= 1.05; e.hp = e.maxhp; }
    }
    // 渔网
    if (S.tech.has('fishnet')) { W.addRes('food', 6); }
    if (W.warpaintNights > 0) W.warpaintNights--;
    // 节点重生
    for (const n of W.nodes) if (n.dead && n.respawnDay <= W.day && n.respawnDay < 9000) { n.dead = false; n.hits = n.maxhits; }
    S.spawnWildDay();
    // 记录
    PE.meta.bestNight = Math.max(PE.meta.bestNight, W.nightsSurvived);
    S.saveMeta();
    PE.audio.music.setMode('day'); PE.audio.music.intensity = 0;
    // 黎明 UI 流程：结算→事件→祝福
    PE.ui.showDawn(Math.round(reward));
    S.saveRun();
  };

  S.spawnWildDay = () => {
    const W = PE.world;
    const counts = { deer: 0, rabbit: 0, w_wolf: 0, w_boar: 0 };
    for (const e of W.ents) if (e.kind === 'wild' && !e.dead) counts[e.type] = (counts[e.type] || 0) + 1;
    const want = { deer: 4, rabbit: 4, w_wolf: 3, w_boar: 2 };
    const f = PE.D.MAP.regions.find(r => r.id === 'forest');
    for (const t in want) {
      for (let i = counts[t] || 0; i < want[t]; i++) {
        const a = U.rand(0, U.TAU), d = U.rand(100, f.r * 0.9);
        const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d;
        if (PE.world.walkable(x, y)) PE.enemies.spawnWild(t, x, y);
      }
    }
  };

  /* ================= 血月仪式 ================= */
  S.bloodRitual = () => {
    if (!S.tech.has('bloodrite')) return;
    if (PE.world.phase !== 'day') { PE.ui.toast('只能在白天举行仪式'); return; }
    if (PE.world.bloodmoonQueued) { PE.ui.toast('血月已在酝酿…'); return; }
    if (!PE.world.pay({ food: 15 })) { PE.ui.toast('需要 15 食物献祭', '#ff8f7a'); return; }
    PE.world.bloodmoonQueued = true;
    PE.ui.toast('🌕 献祭完成——今晚血月将至!', '#ff5a4a');
    PE.audio.sfx('stinger', { vol: 0.6 });
  };

  /* ================= 梦魇位面 ================= */
  S.enterNightmare = () => {
    const W = PE.world;
    W.nightmare = true;
    W.phase = 'night'; W.phaseT = 0;
    // 清场
    for (const e of W.ents) if (e.kind === 'enemy' || e.kind === 'wild') e.dead = true;
    W.memfire = { x: W.camp.x, y: W.camp.y, r: 240 };
    W.memfireDecay = 0;
    PE.enemies.spawnBoss('lord');
    PE.enemies.director.active = false;
    PE.audio.music.setMode('boss');
    PE.ui.toast('你踏入了梦魇位面——守住记忆篝火，杀死梦魇之主!', '#b06dff');
    // 木材补给点
    S._nmWoodT = 5;
  };
  S.updateNightmare = dt => {
    const W = PE.world;
    if (!W.nightmare) return;
    const mf = W.memfire;
    if (W.memfireDecay > 0) mf.r -= dt * 6;
    else mf.r -= dt * 2;
    // 掉木材补给
    S._nmWoodT -= dt;
    if (S._nmWoodT <= 0) {
      S._nmWoodT = U.rand(4, 7);
      const a = U.rand(0, U.TAU), d = U.rand(120, 300);
      W.pickups.push({ x: W.camp.x + Math.cos(a) * d, y: W.camp.y + Math.sin(a) * d, kind: 'wood', t: 0 });
    }
    // 玩家拾取喂火
    for (let i = W.pickups.length - 1; i >= 0; i--) {
      const p = W.pickups[i]; p.t += dt;
      if (U.dist2(p.x, p.y, PE.player.x, PE.player.y) < 30 * 30) {
        W.pickups.splice(i, 1);
        mf.r = Math.min(300, mf.r + 28);
        PE.fx.sparks(mf.x, mf.y - 20, 8);
        PE.fx.text(PE.player.x, PE.player.y - 24, '记忆之火 +', '#ffcf5f', 14);
        PE.audio.sfx('ember');
      } else if (p.t > 12) W.pickups.splice(i, 1);
    }
    if (mf.r <= 55) { PE.ui.toast('记忆之火熄灭了……', '#ff5a4a'); PE.main.endRun(false); }
  };

  /* ================= 成就 / 局外 ================= */
  S.achieve = id => {
    if (PE.meta.achieves[id]) return;
    PE.meta.achieves[id] = true;
    const a = PE.D.ACHIEVES.find(x => x.id === id);
    if (a) { PE.ui.toast('🏆 成就：' + a.name, '#ffcf5f'); PE.meta.totem += 20; }
    S.saveMeta();
  };

  /* ================= 存档 ================= */
  S.saveMeta = () => { try { localStorage.setItem('pe_meta_v1', JSON.stringify(PE.meta)); } catch (e) {} };
  S.loadMeta = () => {
    try {
      const s = localStorage.getItem('pe_meta_v1');
      if (s) Object.assign(PE.meta, JSON.parse(s));
    } catch (e) {}
  };
  S.hasRun = () => { try { return !!localStorage.getItem('pe_run_v1'); } catch (e) { return false; } };
  S.clearRun = () => { try { localStorage.removeItem('pe_run_v1'); } catch (e) {} };
  S.saveRun = () => {
    const W = PE.world, P = PE.player;
    const data = {
      v: 1, day: W.day, ember: W.ember, res: W.res, arrows: W.arrows, endless: W.endless,
      weather: W.weather, paintings: W.paintings, frags: W.frags, artifacts: W.artifacts, kills: W.kills,
      nightsSurvived: W.nightsSurvived, warpaint: W.warpaintNights,
      player: { cls: P.cls, weapons: P.weapons, usables: P.usables, armor: P.armor, toolTier: P.toolTier, hp: P.hp },
      buildings: W.buildings.filter(b => !b.dead).map(b => ({ t: b.type, x: b.x, y: b.y, hp: b.hp, lvl: b.lvl, fuel: b.fuel })),
      nodes: W.nodes.map(n => ({ t: n.type, x: n.x, y: n.y, h: n.hits, d: n.dead ? 1 : 0, r: n.respawnDay, rt: n.rtype, big: n.big ? 1 : 0, f: n.fish ? 1 : 0 })),
      pois: W.pois.map(p => ({ k: p.kind, found: p.found ? 1 : 0, taken: p.taken ? 1 : 0, used: p.used ? 1 : 0 })),
      villagers: W.ents.filter(e => e.kind === 'villager' && !e.dead).map(e => ({ name: e.name, trait: e.trait, job: e.job, hp: e.hp })),
      pets: W.ents.filter(e => e.kind === 'pet' && !e.dead).map(e => ({ t: e.type, hp: e.hp, g: e.growth })),
      tech: S.tech.done, bless: S.bless.owned, tribes: S.tribes.rep,
      fog: Array.from(W.fog),
      fallen: S.vill.fallen,
    };
    try { localStorage.setItem('pe_run_v1', JSON.stringify(data)); } catch (e) {}
  };
  S.loadRun = () => {
    let data;
    try { data = JSON.parse(localStorage.getItem('pe_run_v1')); } catch (e) { return false; }
    if (!data) return false;
    const W = PE.world;
    PE.player.reset(data.player.cls);
    W.init(data.player.cls, PE.meta.talents);
    // 覆盖状态
    W.day = data.day; W.ember = data.ember; W.res = data.res; W.arrows = data.arrows;
    W.endless = data.endless; W.weather = data.weather; W.paintings = data.paintings;
    W.frags = data.frags; W.artifacts = data.artifacts; W.kills = data.kills;
    W.nightsSurvived = data.nightsSurvived; W.warpaintNights = data.warpaint || 0;
    // 玩家
    const P = PE.player, pd = data.player;
    P.weapons = pd.weapons; P.usables = pd.usables; P.armor = pd.armor; P.toolTier = pd.toolTier;
    P.rebuildHotbar();
    // 建筑（清掉 init 生成的篝火后重建）
    for (const b of W.buildings) PE.world.removeBuildingTile(b);
    W.buildings = []; W.btile.clear(); W.campfire = null;
    for (const bd of data.buildings) {
      const b = S.makeBuilding(bd.t, bd.x, bd.y);
      b.hp = bd.hp; b.lvl = bd.lvl || 1;
      if (bd.t === 'campfire') { b.fuel = bd.fuel || 50; b.maxhp = 600 + 300 * (b.lvl - 1); W.campfire = b; }
      W.buildings.push(b);
      W.placeBuildingTile(b);
    }
    // 节点
    W.nodes = data.nodes.map(n => ({ id: U.uid(), type: n.t, x: n.x, y: n.y, hits: n.h, maxhits: hits0(n.t), dead: !!n.d, respawnDay: n.r, rtype: n.rt, big: !!n.big, fish: !!n.f }));
    function hits0(t) { return t === 'tree' ? 4 : t === 'rock' ? 5 : t === 'bush' ? 2 : t === 'obsidian' || t === 'star' ? 6 : t === 'clay' ? 3 : t === 'fishspot' ? 99 : 1; }
    // POI 状态
    data.pois.forEach((p, i) => { if (W.pois[i]) { W.pois[i].found = !!p.found; W.pois[i].taken = !!p.taken; W.pois[i].used = !!p.used; } });
    // 村民/战兽（先清 init 产物——init 不生成村民，安全）
    for (const vd of data.villagers) S.vill.add(vd);
    for (const pdd of data.pets) { const e = S.pets.add(pdd.t); e.hp = pdd.hp; e.growth = pdd.g || 0; }
    S.tech.done = data.tech || {};
    S.bless.owned = data.bless || [];
    S.tribes.rep = data.tribes || S.tribes.rep;
    S.vill.fallen = data.fallen || [];
    if (data.fog) W.fog = new Uint8Array(data.fog);
    S.recalcMods();
    PE.flow.rebuild(W.camp.x, W.camp.y);
    return true;
  };

  return S;
})();
