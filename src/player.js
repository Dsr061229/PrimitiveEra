/* ============================================================
   原始纪元 · player.js —— 玩家 / 战斗结算 / 投射物
   ============================================================ */
'use strict';

/* ---------------- 战斗结算 ---------------- */
PE.combat = {
  // 对生物
  hit(e, dmg, opt = {}) {
    if (e.dead) return;
    let d = dmg;
    const crit = opt.crit || Math.random() < (0.05 + (opt.critBonus || 0));
    if (crit) d *= 2;
    if (e.armored && opt.from) { // 岩甲犀正面减伤
      const facing = Math.cos(PE.U.ang(e.x, e.y, opt.from.x, opt.from.y) - (e.face === -1 ? Math.PI : 0));
      if (facing > 0.3) { d *= 0.2; PE.fx.text(e.x, e.y, '格挡!', '#9aa2ab', 12); }
    }
    if (e.shield > 0) { const abs = Math.min(e.shield, d); e.shield -= abs; d -= abs; }
    if (e.kind === 'villager' && PE.light.isLit(e.x, e.y)) d *= 0.5; // 篝火光圈庇护村民
    e.hp -= d; e.flash = 0.18;
    if (opt.kb && e.kbResist !== 1) {
      const a = opt.from ? PE.U.ang(opt.from.x, opt.from.y, e.x, e.y) : PE.U.rand(0, PE.U.TAU);
      const k = opt.kb * (1 - (e.kbResist || 0));
      const friendly = e.kind !== 'enemy' && e.kind !== 'wild';
      const nx = e.x + Math.cos(a) * k, ny = e.y + Math.sin(a) * k;
      if (PE.world.walkable(nx, e.y, friendly)) e.x = nx;
      if (PE.world.walkable(e.x, ny, friendly)) e.y = ny;
    }
    PE.fx.blood(e.x, e.y - 10, crit ? 12 : 6);
    PE.fx.text(e.x, e.y, Math.round(d) + (crit ? '!' : ''), crit ? '#ffcf5f' : '#ff8f7a', crit ? 18 : 13);
    PE.audio.sfx(crit ? 'crit' : 'hit', { x: e.x, y: e.y });
    if (opt.hitstop !== false) PE.hitstop = Math.max(PE.hitstop, crit ? 0.09 : 0.055);
    if (opt.poison) { e.poisonT = 4; e.poisonDmg = opt.poison; }
    if (e.hp <= 0) {
      e.hp = 0;
      if (e.kind === 'enemy' || e.kind === 'wild') PE.enemies.die(e, opt.byPlayer);
      else if (e.kind === 'villager') PE.sys.vill.die(e);
      else if (e.kind === 'pet') PE.sys.pets.die(e);
      else if (e.kind === 'npc') PE.sys.tribes.npcKilled(e);
      else e.dead = true;
    }
    return d;
  },
  // 对建筑
  hitBuilding(b, dmg, src) {
    if (b.dead) return;
    b.hp -= dmg; b.flash = 0.15;
    PE.fx.chips(b.x, b.y - 12, b.type.startsWith('wall_stone') || b.type === 'altar' ? '#9aa2ab' : '#a4713d', 4);
    PE.audio.sfx('wallhit', { x: b.x, y: b.y });
    PE.cam.shake(b === PE.world.campfire ? 5 : 2);
    // 反伤尖刺
    const thorns = (b.def.thorns || 0) + (PE.mods.thorns || 0);
    if (thorns > 0 && src && !src.dead) PE.combat.hit(src, dmg * thorns, { hitstop: false });
    if (b.hp <= 0) PE.sys.destroyBuilding(b, src);
  },
  aoe(x, y, r, dmg, opt = {}) {
    const targets = PE.grid.query(x, y, r, []);
    for (const e of targets) {
      if (opt.hostileOnly && e.kind !== 'enemy' && e.kind !== 'wild') continue;
      PE.combat.hit(e, dmg, { from: { x, y }, kb: 18, hitstop: false, byPlayer: opt.byPlayer });
    }
    if (opt.buildings) for (const b of PE.world.buildings) if (!b.dead && PE.U.dist2(x, y, b.x, b.y) < r * r) PE.combat.hitBuilding(b, dmg * 0.5, null);
    PE.fx.burst(x, y, 24, { color: '#ff9b3d', size: 4, life: 0.7, sp: 220, up: 240 });
    PE.fx.ring(x, y, '#ffcf5f', r);
    PE.audio.sfx('explode', { x, y });
    PE.cam.shake(6);
  },
  thunder(x, y, byPlayer) {
    PE.fx.spawn(x, y, { color: '#cef3ff', size: 6, life: 0.25, g: 0 });
    for (let i = 0; i < 8; i++) PE.fx.spawn(x + PE.U.rand(-4, 4), y - i * 14, { color: '#9fe8ff', size: 4, life: 0.22, g: 0, glow: true });
    PE.combat.aoe(x, y, 60, 45, { hostileOnly: true, byPlayer });
    PE.audio.sfx('thunder', { x, y });
  },
};

/* ---------------- 投射物 ---------------- */
PE.projectiles = {
  shoot(x, y, ang, opt) {
    PE.world.projs.push({
      x, y, z: -16, vx: Math.cos(ang) * (opt.spd || 520), vy: Math.sin(ang) * (opt.spd || 520),
      dmg: opt.dmg, life: opt.life || 1.2, kind: opt.kind || 'arrow', pierce: opt.pierce || 0,
      aoe: opt.aoe || 0, friendly: opt.friendly !== false, byPlayer: opt.byPlayer, hitSet: new Set(), ang,
    });
  },
  lob(x, y, tx, ty, opt) { // 抛物线（炸药罐）
    const t = 0.7, dx = tx - x, dy = ty - y;
    PE.world.projs.push({
      x, y, z: -20, vx: dx / t, vy: dy / t, vz: -160, g: 460,
      dmg: opt.dmg, life: t, kind: 'bomb', aoe: opt.aoe, friendly: true, byPlayer: true, lob: true,
    });
  },
  update(dt) {
    const W = PE.world;
    for (let i = W.projs.length - 1; i >= 0; i--) {
      const p = W.projs[i];
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.lob) { p.vz += p.g * dt; p.z += p.vz * dt; }
      let hit = p.life <= 0;
      if (!hit && !p.lob) {
        // 命中检测
        const targets = PE.grid.query(p.x, p.y, 22, []);
        for (const e of targets) {
          if (p.hitSet.has(e.id)) continue;
          const hostile = e.kind === 'enemy' || e.kind === 'wild';
          if (p.friendly ? !hostile : (e !== PE.player && e.kind !== 'villager' && e.kind !== 'pet')) continue;
          if (p.friendly === false && e === PE.player && PE.player.rollT > 0) continue;
          p.hitSet.add(e.id);
          PE.combat.hit(e, p.dmg, { from: { x: p.x - p.vx * 0.01, y: p.y - p.vy * 0.01 }, kb: 8, byPlayer: p.byPlayer, hitstop: false });
          if (p.aoe) { PE.combat.aoe(p.x, p.y, p.aoe, p.dmg * 0.5, { hostileOnly: p.friendly, byPlayer: p.byPlayer }); hit = true; break; }
          if (p.pierce-- <= 0) { hit = true; break; }
        }
        if (!hit && !PE.world.walkable(p.x, p.y, true) && !PE.world.isWater(p.x, p.y)) hit = true; // 撞墙
      }
      if (p.lob && p.z >= 0) { PE.combat.aoe(p.x, p.y, p.aoe || 150, p.dmg, { hostileOnly: false, buildings: false, byPlayer: true }); hit = true; }
      if (hit) W.projs.splice(i, 1);
    }
  },
  draw(ctx) {
    for (const p of PE.world.projs) {
      ctx.save(); ctx.translate(p.x, p.y + (p.z || 0));
      if (p.kind === 'arrow') {
        ctx.rotate(p.ang);
        ctx.strokeStyle = '#8f6239'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(7, 0); ctx.stroke();
        ctx.fillStyle = p.aoe ? '#7fd7e8' : '#8b95a5'; ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(12, 0); ctx.lineTo(6, 3); ctx.closePath(); ctx.fill();
      } else if (p.kind === 'bomb') {
        ctx.fillStyle = '#b98058'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, PE.U.TAU); ctx.fill();
        ctx.strokeStyle = PE.S.OUT; ctx.lineWidth = 2; ctx.stroke();
        PE.fx.sparks(p.x, p.y + p.z - 8, 1);
      } else if (p.kind === 'stone') {
        ctx.fillStyle = '#9aa2ab'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, PE.U.TAU); ctx.fill();
      } else if (p.kind === 'spit') {
        ctx.fillStyle = '#b02eff'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, PE.U.TAU); ctx.fill();
      }
      ctx.restore();
    }
  },
};

/* ---------------- 玩家 ---------------- */
PE.player = (() => {
  const U = PE.U;
  const P = {
    kind: 'player', id: 0, x: 2000, y: 2200, r: 12,
    hp: 100, maxhp: 100, sta: 100, hunger: 100, warmth: 100,
    faceAng: 0, face: 1, walk: 0, t: 0, flash: 0, dead: false,
    rollT: 0, rollCd: 0, atkCd: 0, atkT: 0, downT: 0, shield: 0,
    weapons: ['club'], usables: {}, armor: false, toolTier: 1,
    hotbar: [], sel: 0, hotbarSel: null,
    mount: null, cls: 'hunter', rollCritReady: false,
    fishing: null, // {node, t, biteAt, window}
  };

  P.reset = classId => {
    Object.assign(P, {
      x: PE.world.camp.x, y: PE.world.camp.y + 110, hp: 100, sta: 100, hunger: 100, warmth: 100,
      rollT: 0, rollCd: 0, atkCd: 0, atkT: 0, downT: 0, shield: 0, dead: false, flash: 0,
      weapons: ['club'], usables: { torch: 1, meat: 1 }, armor: false, toolTier: 1,
      sel: 0, mount: null, cls: classId, rollCritReady: false, fishing: null,
    });
    P.maxhp = PE.D.BAL.PLAYER_HP + (PE.mods.maxhp || 0);
    if (classId === 'hunter') { P.weapons.push('bow'); PE.world.arrows = 40; }
    if (classId === 'shamanC') { P.usables.herbmed = 2; }
    P.hp = P.maxhp;
    P.rebuildHotbar();
  };

  P.rebuildHotbar = () => {
    P.hotbar = [];
    // 只展示最新 3 把武器，保证烤肉/火把等消耗品永远不被挤掉
    for (const w of P.weapons.slice(-3)) P.hotbar.push({ id: w, kind: 'weapon' });
    for (const uid of ['meat', 'torch', 'herbmed', 'firebomb']) {
      if (uid === 'meat' || P.usables[uid]) P.hotbar.push({ id: uid, kind: 'usable' });
    }
    P.hotbar = P.hotbar.slice(0, 8);
    if (P.sel >= P.hotbar.length) P.sel = 0;
    P.hotbarSel = P.hotbar[P.sel];
  };
  P.weapon = () => {
    const h = P.hotbarSel;
    if (h && h.kind === 'weapon') return PE.D.WEAPONS[h.id];
    return PE.D.WEAPONS[P.weapons[0]] || PE.D.WEAPONS.club;
  };
  P.weaponId = () => (P.hotbarSel && P.hotbarSel.kind === 'weapon') ? P.hotbarSel.id : P.weapons[0];
  P.gainWeapon = id => { if (!P.weapons.includes(id)) { P.weapons.push(id); PE.fx.text(P.x, P.y - 20, '获得 ' + PE.D.WEAPONS[id].name, '#ffcf5f', 15); P.rebuildHotbar(); } };
  P.gainUsable = (id, n = 1) => { P.usables[id] = (P.usables[id] || 0) + n; P.rebuildHotbar(); };

  P.speed = () => {
    let s = 150 * (1 + (PE.mods.spd || 0));
    if (P.cls === 'hunter') s *= 1.1;
    if (P.mount) s *= PE.D.PETS[P.mount.type].ride || 1;
    if (PE.world.season() === 'snow' && P.warmth <= 0) s *= 0.7;
    return s;
  };

  P.damage = (dmg, src) => {
    if (P.rollT > 0 || P.dead || P.downT > 0) return;
    let d = dmg * (P.armor ? 0.75 : 1);
    if (P.shield > 0) { const abs = Math.min(P.shield, d); P.shield -= abs; d -= abs; }
    // 光圈减伤（原始人的信仰）
    if (PE.light.isLit(P.x, P.y)) d *= 0.9;
    P.hp -= d; P.flash = 0.2;
    PE.fx.blood(P.x, P.y - 10, 8);
    PE.audio.sfx('hurt');
    PE.cam.shake(4);
    if (src) { // 击退不允许推进墙体/水域
      const a = U.ang(src.x, src.y, P.x, P.y);
      const nx = P.x + Math.cos(a) * 10, ny = P.y + Math.sin(a) * 10;
      if (PE.world.walkable(nx, P.y, true)) P.x = nx;
      if (PE.world.walkable(P.x, ny, true)) P.y = ny;
    }
    if (P.hp <= 0) { // 倒地：8秒后篝火边复活，掉 30% 火种
      P.hp = 0; P.downT = 8;
      PE.world.ember = Math.floor(PE.world.ember * 0.7);
      PE.fx.text(P.x, P.y - 30, '你倒下了…', '#ff5a4a', 20);
      if (P.mount) P.dismount();
    }
  };
  P.heal = n => { P.hp = Math.min(P.maxhp, P.hp + n); PE.fx.heal(P.x, P.y - 10); };
  P.dismount = () => { if (P.mount) { P.mount.mounted = false; P.mount = null; } };
  // 骑乘可用性：'off'=可下坐骑 'on'=旁边有可骑战兽 null=无
  P.canMount = () => {
    if (P.mount) return 'off';
    for (const e of PE.grid.query(P.x, P.y, 80, [])) {
      if (e.kind === 'pet' && !e.dead && PE.D.PETS[e.type].ride) return 'on';
    }
    return null;
  };

  /* ---------- 使用消耗品 ---------- */
  function useSelected() {
    const h = P.hotbarSel; if (!h || h.kind !== 'usable') return;
    const Wd = PE.world;
    if (h.id === 'meat') {
      if ((Wd.res.food || 0) < 3) { PE.fx.text(P.x, P.y - 20, '食物不足', '#ff8f7a'); PE.audio.sfx('error'); return; }
      Wd.res.food -= 3;
      const mult = PE.sys.tech.has('cook') ? 2 : 1;
      P.heal(18 * mult * (P.cls === 'shamanC' ? 1.5 : 1));
      P.hunger = Math.min(100, P.hunger + 35);
      PE.audio.sfx('eat');
    } else if (h.id === 'herbmed') {
      if (!P.usables.herbmed) return;
      P.usables.herbmed--; P.heal(60 * (P.cls === 'shamanC' ? 2 : 1)); PE.audio.sfx('eat'); P.rebuildHotbar();
    } else if (h.id === 'firebomb') {
      if (!P.usables.firebomb) return;
      P.usables.firebomb--;
      const w = PE.cam.toWorld(PE.input.st.pointer.x, PE.input.st.pointer.y);
      let tx = w.x, ty = w.y;
      if (PE.isTouch) { const a = PE.input.aim(P.x, P.y); tx = P.x + Math.cos(a) * 180; ty = P.y + Math.sin(a) * 180; }
      const d = U.dist(P.x, P.y, tx, ty);
      if (d > 260) { tx = P.x + (tx - P.x) / d * 260; ty = P.y + (ty - P.y) / d * 260; }
      PE.projectiles.lob(P.x, P.y - 20, tx, ty, { dmg: 90, aoe: 150 });
      PE.audio.sfx('bow'); P.rebuildHotbar();
    }
  }

  /* ---------- 攻击 ---------- */
  function tryAttack(dt) {
    if (P.atkCd > 0 || P.downT > 0) return;
    const wid = P.weaponId(), w = PE.D.WEAPONS[wid];
    if (P.hotbarSel && P.hotbarSel.kind === 'usable') return;
    const aim = PE.input.aim(P.x, P.y);
    P.faceAng = aim; P.face = Math.cos(aim) >= 0 ? 1 : -1;
    P.atkCd = 1 / (w.rate * (PE.sys.warBuff() || 1));
    P.atkT = 1;
    let dmgMult = (1 + (PE.mods.dmg || 0)) * (PE.world.warpaintNights > 0 ? 1.25 : 1) * PE.sys.warBuff();
    const critBonus = (PE.mods.crit || 0) + (P.rollCritReady ? 1 : 0);
    P.rollCritReady = false;
    if (w.type === 'bow') {
      if (PE.world.arrows <= 0) { PE.fx.text(P.x, P.y - 20, '没有箭矢!', '#ff8f7a'); PE.audio.sfx('error'); P.atkCd = 0.3; return; }
      PE.world.arrows--;
      PE.projectiles.shoot(P.x, P.y - 14, aim, { dmg: w.dmg * dmgMult, aoe: w.aoe, byPlayer: true, spd: 560 });
      PE.audio.sfx('bow', { x: P.x, y: P.y });
      return;
    }
    // 近战弧形
    const range = w.range, arc = w.arc || 1.6;
    const cx = P.x + Math.cos(aim) * range * 0.55, cy = P.y + Math.sin(aim) * range * 0.55;
    let pierce = w.pierce || 1, hitAny = false;
    const targets = PE.grid.query(cx, cy, range * 0.75, []);
    targets.sort((a, b) => U.dist2(P.x, P.y, a.x, a.y) - U.dist2(P.x, P.y, b.x, b.y));
    for (const e of targets) {
      if (e === P || e.kind === 'villager' || e.kind === 'pet' || e.kind === 'npc') continue;
      const a = U.ang(P.x, P.y, e.x, e.y);
      const da = Math.abs(((a - aim + Math.PI) % U.TAU + U.TAU) % U.TAU - Math.PI); // 归一化角差
      if (da > arc / 2) continue;
      PE.combat.hit(e, w.dmg * dmgMult, { from: P, kb: w.kb, byPlayer: true, critBonus });
      if (w.proc === 'thunder' && Math.random() < 0.2) PE.combat.thunder(e.x, e.y, true);
      hitAny = true;
      if (--pierce <= 0) break;
    }
    // 打资源点（采集）
    if (!hitAny) {
      for (const n of PE.world.nodes) {
        if (n.dead || n.fish) continue;
        if (U.dist2(cx, cy, n.x, n.y) > 55 * 55) continue;
        gatherHit(n); hitAny = true; break;
      }
    }
    if (!hitAny) PE.audio.sfx('roll', { vol: 0.4 });
  }

  function gatherHit(n) {
    if ((n.type === 'obsidian' || n.type === 'star') && P.toolTier < 3) {
      PE.fx.text(n.x, n.y - 20, '需要黑曜石工具', '#ff8f7a'); PE.audio.sfx('error'); return;
    }
    const power = P.toolTier === 1 ? 1 : P.toolTier === 2 ? 1.5 : 2;
    n.hits -= power;
    n.shake = 0.2;
    PE.audio.sfx(n.type === 'tree' || n.type === 'bush' ? 'chop' : 'mine', { x: n.x, y: n.y });
    PE.fx.chips(n.x, n.y - 14, n.type === 'tree' ? '#5e8a44' : n.type === 'bush' ? '#d84a5f' : '#9aa2ab');
    // 每次命中掉产出
    const y = PE.world.nodeYield(n), gmult = 1 + (PE.mods.gather || 0) + PE.sys.potBonus() + (PE.sys.tech.has('harvest') ? 0.5 : 0);
    for (const k in y) {
      const amt = Math.max(1, Math.round(y[k] * gmult));
      PE.world.addRes(k, amt);
      PE.fx.text(n.x, n.y, `+${amt} ${PE.D.RES[k].name}`, PE.D.RES[k].c, 12);
    }
    PE.audio.sfx('pickup', { x: n.x, y: n.y, vol: 0.5 });
    if (n.hits <= 0) {
      n.dead = true;
      n.respawnDay = PE.world.day + (n.type === 'bush' ? 1 : n.type === 'tree' ? 3 : 2);
      if (n.type === 'obsidian' || n.type === 'star') n.respawnDay = 9999;
      PE.fx.burst(n.x, n.y - 10, 10, { color: '#a4713d', size: 3, life: 0.6, sp: 100 });
    }
  }

  /* ---------- 交互 ---------- */
  function tryInteract() {
    const Wd = PE.world;
    // 钓鱼收杆
    if (P.fishing) { finishFishing(); return; }
    // POI
    for (const poi of Wd.pois) {
      if (U.dist2(P.x, P.y, poi.x, poi.y) > 70 * 70) continue;
      if (poi.kind === 'painting' && !poi.found) {
        poi.found = true; Wd.paintings++;
        PE.fx.magic(poi.x, poi.y - 20, '#ffcf5f'); PE.audio.sfx('bless');
        PE.ui.toast(`发现壁画碎片 (${Wd.paintings}/6)：${PAINT_LORE[poi.idx]}`);
        return;
      }
      if (poi.kind === 'artifact' && !poi.taken) {
        const a = PE.D.MAP.artifacts[poi.aid];
        if (poi.aid === 'thunderspear' && !Wd.frags.frag1) { PE.ui.toast('雷石祭坛沉睡着——需要第5夜夜魔掉落的碎片'); return; }
        if (poi.aid === 'eternalflame' && !Wd.frags.frag2) { PE.ui.toast('火焰祭坛沉睡着——需要第10夜夜魔掉落的碎片'); return; }
        if (a.star && (Wd.res.star || 0) < a.star) { PE.ui.toast(`先祖战鼓需要 ${a.star} 星陨铁唤醒`); return; }
        if (a.star) Wd.res.star -= a.star;
        poi.taken = true; Wd.artifacts[poi.aid] = true;
        if (poi.aid === 'thunderspear') P.gainWeapon('thunderspear');
        PE.audio.sfx('bless'); PE.fx.magic(P.x, P.y - 20, '#ffcf5f');
        PE.ui.toast(`获得神器：${a.name}！(${Object.keys(Wd.artifacts).length}/3)`);
        return;
      }
      if (poi.kind === 'eagle' && !poi.used) {
        if ((Wd.ember || 0) >= 80) {
          Wd.ember -= 80; poi.used = true; PE.sys.pets.add('eagle');
          PE.ui.toast('崖顶的巨鹰接受了你的火种敬意，成为部落之眼！');
        } else PE.ui.toast('崖顶巨鹰俯视着你（花 80 火种敬奉可结缘）');
        return;
      }
      if (poi.kind === 'chest' && !poi.taken) {
        poi.taken = true;
        const roll = Math.random();
        let msg;
        if (roll < 0.3) { const n = U.randi(40, 90); Wd.ember += n; msg = '+' + n + ' 火种'; }
        else if (roll < 0.55) { Wd.addRes('food', 8); Wd.addRes('fur', 3); msg = '食物x8 皮毛x3'; }
        else if (roll < 0.75) { Wd.arrows += 15; msg = '箭矢x15'; }
        else if (roll < 0.9) { P.gainUsable('herbmed', 1); msg = '草药膏x1'; }
        else { Wd.addRes('star', 1); msg = '⭐星陨铁x1!'; }
        PE.fx.magic(poi.x, poi.y - 10, '#ffcf5f');
        PE.audio.sfx('bless');
        PE.ui.toast('📦 打开宝箱：' + msg, '#ffcf5f');
        return;
      }
      if (poi.kind === 'tribecamp') { PE.ui.openPanel('tribe', poi.tribe); return; }
    }
    // NPC / 驯养 / 钓鱼
    const near = PE.grid.query(P.x, P.y, 70, []);
    for (const e of near) {
      if (e.kind === 'npc') { PE.ui.openPanel('tribe', e.tribe); return; }
      if (e.kind === 'wild' && e.tameable && e.hp < e.maxhp * 0.5) { PE.sys.pets.tryTame(e); return; }
    }
    for (const n of Wd.nodes) {
      if (n.fish && U.dist2(P.x, P.y, n.x, n.y) < 90 * 90) { startFishing(n); return; }
    }
    // 篝火加柴/商店提示
    if (Wd.campfire && U.dist2(P.x, P.y, Wd.campfire.x, Wd.campfire.y) < 90 * 90) { PE.ui.openPanel('shop'); return; }
    for (const b of Wd.buildings) {
      if (b.dead || U.dist2(P.x, P.y, b.x, b.y) > 70 * 70) continue;
      if (b.def.craft) { PE.ui.openPanel('craft'); return; }
      if (b.def.research) { PE.ui.openPanel('tech'); return; }
    }
  }

  const PAINT_LORE = [
    '一团黑影吞噬了太阳…', '先祖们围着巨火起舞', '三件圣物闪耀于星空',
    '雷矛劈开了黑暗', '不灭之火永不熄灭', '战鼓声中，黑影退入门后',
  ];

  function startFishing(n) {
    P.fishing = { node: n, t: 0, biteAt: U.rand(2, 5), window: 0 };
    PE.fx.text(P.x, P.y - 24, '钓鱼中…', '#9fd7e8');
  }
  function finishFishing() {
    const f = P.fishing;
    if (f.window > 0) {
      const rare = Math.random() < 0.1;
      PE.world.addRes('food', 3);
      if (rare) { PE.world.ember += 25; PE.fx.text(P.x, P.y - 24, '稀有鱼! +25火种', '#ffcf5f', 16); }
      else PE.fx.text(P.x, P.y - 24, '+3 食物', '#e0705a', 14);
      PE.audio.sfx('pickup');
    } else PE.fx.text(P.x, P.y - 24, '鱼跑了…', '#9aa2ab');
    P.fishing = null;
  }

  /* ---------- 更新 ---------- */
  P.update = dt => {
    P.t += dt;
    if (P.atkCd > 0) P.atkCd -= dt;
    if (P.atkT > 0) P.atkT -= dt * 4;
    if (P.flash > 0) P.flash -= dt;
    if (P.rollCd > 0) P.rollCd -= dt;
    if (P.shield > 0) P.shield -= dt * 2;
    // 防卡死：若被建筑/水域困住，弹回最近可行走点
    if (!PE.world.walkable(P.x, P.y, true)) {
      let freed = false;
      for (let r = 1; r <= 5 && !freed; r++) {
        for (let i = 0; i < 16 && !freed; i++) {
          const a = i / 16 * U.TAU;
          const nx = P.x + Math.cos(a) * r * 20, ny = P.y + Math.sin(a) * r * 20;
          if (PE.world.walkable(nx, ny, true)) { P.x = nx; P.y = ny; freed = true; }
        }
      }
    }
    // 倒地
    if (P.downT > 0) {
      P.downT -= dt;
      if (P.downT <= 0) {
        P.hp = P.maxhp * 0.5; P.x = PE.world.camp.x; P.y = PE.world.camp.y + 60;
        PE.fx.heal(P.x, P.y); PE.fx.text(P.x, P.y - 30, '在篝火边醒来', '#8fe86d', 16);
      }
      return;
    }
    // 钓鱼
    if (P.fishing) {
      const f = P.fishing; f.t += dt;
      if (f.window > 0) { f.window -= dt; if (f.window <= 0) { PE.fx.text(P.x, P.y - 24, '鱼跑了…', '#9aa2ab'); P.fishing = null; } }
      else if (f.t >= f.biteAt) { f.window = 0.8; PE.audio.sfx('fishbite'); PE.fx.text(f.node.x, f.node.y - 10, '❗', '#ffcf5f', 22); }
      const m = PE.input.mv();
      if (m.l > 0.3) P.fishing = null; // 移动取消
      if (PE.input.pressed('interact')) tryInteract();
      return;
    }
    // 移动
    const m = PE.input.mv();
    const sp = P.speed() * (m.l || 0) * (P.rollT > 0 ? 1.9 : 1);
    let mvx = m.x, mvy = m.y;
    if (P.rollT > 0) { P.rollT -= dt; mvx = P.rollDx; mvy = P.rollDy; }
    if (mvx || mvy) {
      const step = sp * dt;
      const nx = P.x + mvx * step, ny = P.y + mvy * step;
      if (PE.world.walkable(nx, P.y, true)) P.x = nx;
      else if (mvx && !mvy) { // 门口辅助：贴墙时自动滑向 32px 的开口
        if (PE.world.walkable(nx, P.y + 14, true)) P.y += step * 0.85;
        else if (PE.world.walkable(nx, P.y - 14, true)) P.y -= step * 0.85;
      }
      if (PE.world.walkable(P.x, ny, true)) P.y = ny;
      else if (mvy && !mvx) {
        if (PE.world.walkable(P.x + 14, ny, true)) P.x += step * 0.85;
        else if (PE.world.walkable(P.x - 14, ny, true)) P.x -= step * 0.85;
      }
      P.walk = Math.min(1, P.walk + dt * 6);
      if (P.rollT <= 0) { P.faceAng = Math.atan2(mvy, mvx); P.face = mvx >= 0 ? (mvx === 0 ? P.face : 1) : -1; }
    } else P.walk = Math.max(0, P.walk - dt * 8);
    // 坐骑跟随
    if (P.mount) { P.mount.x = P.x; P.mount.y = P.y + 2; P.mount.face = P.face; P.mount.walk = P.walk; }
    // 翻滚
    if (PE.input.pressed('roll') && P.rollCd <= 0 && P.sta >= PE.D.BAL.STA_ROLL && !P.mount) {
      P.rollT = 0.4; P.rollCd = 0.9; P.sta -= PE.D.BAL.STA_ROLL;
      const a = m.l ? Math.atan2(m.y, m.x) : P.faceAng;
      P.rollDx = Math.cos(a); P.rollDy = Math.sin(a);
      if (PE.mods.rollcrit) P.rollCritReady = true;
      PE.audio.sfx('roll');
      PE.fx.burst(P.x, P.y, 5, { color: '#c2b280', size: 2.5, life: 0.4, sp: 60 });
    }
    // 体力
    P.sta = Math.min(100, P.sta + PE.D.BAL.STA_REGEN * (1 + (PE.mods.staregen || 0)) * dt);
    // 饥饿
    P.hunger -= PE.D.BAL.HUNGER_DRAIN * dt;
    if (P.hunger <= 0) { P.hunger = 0; P.hp -= 2 * dt; if (P.hp <= 0) P.damage(1); }
    // 体温（雪季）
    if (PE.world.season() === 'snow') {
      const warm = PE.light.isLit(P.x, P.y);
      const drain = PE.sys.tech.has('weaving') ? 2.5 : 5;
      P.warmth = U.clamp(P.warmth + (warm ? 15 : -drain) * dt, 0, 100);
      if (P.warmth <= 0) P.hp = Math.max(1, P.hp - 1.5 * dt);
    } else P.warmth = 100;
    // 中毒
    if (P.poisonT > 0) { P.poisonT -= dt; P.hp = Math.max(1, P.hp - 3 * dt); }
    // 治疗图腾
    if ((PE.sys.tech.has('healtotem') || P.cls === 'shamanC') && PE.world.campfire && PE.light.isLit(P.x, P.y) && P.hp < P.maxhp) {
      P.hp = Math.min(P.maxhp, P.hp + 1.5 * dt);
    }
    // 攻击 / 交互 / 使用
    if (PE.input.attackHeld() && !PE.ui.modalOpen() && !PE.sys.build.active) tryAttack(dt);
    if (PE.input.pressed('interact')) {
      if (P.hotbarSel && P.hotbarSel.kind === 'usable' && P.hotbarSel.id !== 'torch') useSelected();
      else tryInteract();
    }
    // 骑乘/下坐骑（独立按键：PC=C，触屏=临时按钮，与驯化的交互键分离）
    if (PE.input.pressed('mount')) {
      if (P.mount) { P.dismount(); PE.fx.text(P.x, P.y - 20, '下坐骑', '#e8d5a8'); }
      else {
        for (const e of PE.grid.query(P.x, P.y, 80, [])) {
          if (e.kind === 'pet' && !e.dead && PE.D.PETS[e.type].ride) {
            P.mount = e; e.mounted = true;
            PE.fx.text(P.x, P.y - 20, '骑上' + PE.D.PETS[e.type].name, '#e8d5a8');
            break;
          }
        }
      }
    }
    // 战兽指令切换（PC=X；HUD 按钮双端可点）
    if (PE.input.pressed('petcmd')) PE.sys.pets.cycleStance();
    // 热键
    for (let i = 1; i <= 8; i++) if (PE.input.pressed('hot' + i)) { if (P.hotbar[i - 1]) { P.sel = i - 1; P.hotbarSel = P.hotbar[P.sel]; PE.audio.sfx('ui'); } }
    if (PE.input.pressed('swap')) { P.sel = (P.sel + 1) % P.hotbar.length; P.hotbarSel = P.hotbar[P.sel]; PE.audio.sfx('ui'); }
    // 低血心跳
    if (P.hp < P.maxhp * 0.3 && Math.floor(PE.time * 1.4) !== Math.floor((PE.time - dt) * 1.4)) PE.audio.sfx('heartbeat', { vol: 1 - P.hp / (P.maxhp * 0.3) });
  };

  P.draw = ctx => {
    ctx.save(); ctx.translate(P.x, P.y);
    PE.S.shadow(ctx, 13);
    if (P.downT > 0) { // 倒地
      ctx.rotate(-1.3); PE.S.humanoid(ctx, { skin: '#d8a06a', cloth: '#8a5a3a', hair: '#3a2a1c', t: 0, walk: 0, e: P });
      ctx.restore(); return;
    }
    if (P.rollT > 0) ctx.rotate(Math.sin((0.4 - P.rollT) / 0.4 * Math.PI) * 0.7 * P.face);
    const clothC = P.cls === 'shamanC' ? '#5a7a8a' : P.cls === 'chief' ? '#8a6a3a' : '#8a5a3a';
    PE.S.humanoid(ctx, {
      skin: '#d8a06a', cloth: P.armor ? '#a08050' : clothC, hair: '#3a2a1c',
      feather: P.cls === 'shamanC' ? '#6ddcff' : '#c25b3a',
      face: P.face, walk: P.walk, t: P.t, atk: Math.max(0, P.atkT),
      weapon: (P.hotbarSel && P.hotbarSel.kind === 'weapon') ? P.hotbarSel.id : null,
      torch: P.hotbarSel && P.hotbarSel.id === 'torch',
      paint: PE.world.warpaintNights > 0 ? '#c22e2e' : null, e: P,
    });
    // 护盾
    if (P.shield > 0) { ctx.strokeStyle = `rgba(109,220,255,${0.4 + Math.sin(P.t * 6) * 0.15})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -22, 22, 0, U.TAU); ctx.stroke(); }
    // 钓鱼线
    if (P.fishing) { ctx.strokeStyle = 'rgba(230,230,220,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.face * 10, -28); ctx.lineTo(P.fishing.node.x - P.x, P.fishing.node.y - P.y); ctx.stroke(); }
    ctx.restore();
  };

  return P;
})();
