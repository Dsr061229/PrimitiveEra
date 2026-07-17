/* ============================================================
   原始纪元 · data.js —— 全部数值配置（对应设计文档 02 / 05）
   ============================================================ */
'use strict';
PE.D = {};

/* ---------------- 全局平衡常数 ---------------- */
PE.D.BAL = {
  DAY_LEN: 360, DUSK_LEN: 30, NIGHT_LEN: 150,
  THREAT_BASE: 7, THREAT_GROW: 1.42, THREAT_GROW_ENDLESS: 1.22,
  BLOODMOON_MULT: 2.0, BLOODMOON_CHANCE: 0.15,
  FIRE_OUT_BASE: 0.8,          // 火种/秒/篝火等级
  FIRE_FUEL_SEC: 60,           // 每级每 60s 烧 1 木
  FIRE_UP: [0, 50, 150, 400, 900], // 升级到 lvl+1 的火种费用（按当前 lvl 索引）
  DAWN_REWARD: n => 20 + 10 * n,
  PLAYER_HP: 100, PLAYER_STA: 100, STA_ROLL: 25, STA_REGEN: 18,
  HUNGER_DRAIN: 100 / 420,     // 7分钟耗尽
  VILL_FOOD: 2, VILL_CAP_BASE: 3,
  REPAIR_HP_PER_EMBER: 10,
  FINAL_NIGHT: 15,
};

/* ---------------- 资源 ---------------- */
PE.D.RES = {
  wood:     { name: '木材',   c: '#a4713d' },
  stone:    { name: '石头',   c: '#9aa2ab' },
  food:     { name: '食物',   c: '#e0705a' },
  fur:      { name: '皮毛',   c: '#c99a63' },
  flint:    { name: '燧石',   c: '#707a88' },
  bone:     { name: '骨头',   c: '#e8e2d0' },
  clay:     { name: '黏土',   c: '#b98058' },
  herb:     { name: '草药',   c: '#6db15f' },
  obsidian: { name: '黑曜石', c: '#4a3f63' },
  star:     { name: '星陨铁', c: '#7fd7e8' },
};

/* ---------------- 武器（hotbar 装备） ---------------- */
PE.D.WEAPONS = {
  club:    { name: '木棒',     dmg: 12, rate: 1.2, range: 52,  type: 'melee', kb: 14, desc: '祖传的开局伙伴' },
  spear:   { name: '燧石矛',   dmg: 22, rate: 1.0, range: 62,  type: 'melee', kb: 12, desc: '可靠的狩猎矛' },
  hammer:  { name: '骨制战锤', dmg: 40, rate: 0.6, range: 58,  type: 'melee', kb: 26, arc: 2.6, desc: '横扫击退，大开大合' },
  bow:     { name: '短弓',     dmg: 18, rate: 1.5, range: 380, type: 'bow',   kb: 6,  desc: '消耗箭矢，风筝利器' },
  obspear: { name: '黑曜石长矛', dmg: 55, rate: 0.9, range: 68, type: 'melee', kb: 16, pierce: 2, desc: '锋利到能刺穿两个敌人' },
  starbow: { name: '星陨猎弓', dmg: 45, rate: 1.2, range: 420, type: 'bow',   kb: 8,  aoe: 70, desc: '箭矢炸裂星火' },
  thunderspear: { name: '⚡雷石之矛', dmg: 70, rate: 1.0, range: 70, type: 'melee', kb: 20, proc: 'thunder', artifact: true, desc: '神器：两成概率引落天雷' },
};
PE.D.USABLES = {
  torch:    { name: '火把',    desc: '手持照明，夜魔惧光' },
  meat:     { name: '烤肉',    desc: '按下食用：+35 血 (消耗食物x3)' },
  herbmed:  { name: '草药膏',  desc: '按下食用：+60 血' },
  firebomb: { name: '炸药陶罐', desc: '投掷爆炸，范围 150' },
  trap_kit: { name: '陷阱', desc: '' },
};

/* ---------------- 建筑 ---------------- */
PE.D.BUILDINGS = {
  fence:    { name: '木栅栏', cost: { wood: 2 },            hp: 120,  cat: 'wall', up: 'wall_wood', desc: '第一夜的依靠' },
  wall_wood:{ name: '木墙',   cost: { wood: 4, stone: 1 },  hp: 300,  cat: 'wall', up: 'wall_stone', desc: '扎实的木墙' },
  wall_stone:{ name: '石墙',  cost: { stone: 6, wood: 2 },  hp: 700,  cat: 'wall', up: 'wall_bone', tech: 'masonry', desc: '野猪撞不动' },
  wall_bone:{ name: '骨墙',   cost: { bone: 6, stone: 6 },  hp: 1500, cat: 'wall', thorns: 0.1, tech: 'bonecraft', desc: '尖刺反伤 10%' },
  gate:     { name: '兽皮门', cost: { wood: 5, fur: 2 },    hp: 220,  cat: 'wall', door: true, desc: '自己人能通过' },
  torchpost:{ name: '火把桩', cost: { wood: 2, flint: 1 },  hp: 60,   cat: 'util', light: 110, desc: '一小圈安全的光' },
  tent:     { name: '帐篷',   cost: { wood: 6, fur: 2 },    hp: 150,  cat: 'util', pop: 2, desc: '村民上限 +2，夜晚回血' },
  pot:      { name: '储物陶罐', cost: { clay: 6, wood: 2 }, hp: 80,   cat: 'util', gather: 0.05, tech: 'pottery', max: 3, desc: '采集产出 +5%' },
  bench:    { name: '工作台', cost: { wood: 8, stone: 3 },  hp: 200,  cat: 'util', craft: true, max: 1, desc: '打造装备与陷阱' },
  altar:    { name: '研究石坛', cost: { stone: 8 },         hp: 250,  cat: 'util', research: true, max: 1, desc: '钻研部落科技' },
  corral:   { name: '兽栏',   cost: { wood: 8, fur: 2 },    hp: 180,  cat: 'util', beast: 2, desc: '战兽上限 +2' },
  tower:    { name: '瞭望塔', cost: { wood: 12, stone: 4 }, hp: 300,  cat: 'util', watch: true, max: 2, desc: '提前预警夜袭方向' },
  spike:    { name: '尖刺坑', cost: { wood: 4, flint: 2 },  hp: 90,   cat: 'trap', dmg: 40, slow: 0.5, cd: 2.5, tech: 'traps', desc: '踩中扎脚又减速' },
  tripwire: { name: '绊索',   cost: { wood: 2, fur: 1 },    hp: 60,   cat: 'trap', stun: 1.5, cd: 8, tech: 'traps', desc: '冲锋兽的克星' },
  firepit:  { name: '火油沟', cost: { clay: 4, wood: 4 },   hp: 100,  cat: 'trap', burn: 25, dur: 8, cd: 16, tech: 'pottery', desc: '燃烧的护城沟' },
  totem:    { name: '图腾塔', cost: { stone: 8, herb: 3 },  hp: 240,  cat: 'trap', turret: { dmg: 15, rate: 2, range: 180 }, tech: 'totemtower', desc: '先祖之灵自动投掷石弹' },
  campfire: { name: '长明篝火', cost: {}, hp: 600, cat: 'core', desc: '部落的心脏，绝不能熄灭' },
};

/* ---------------- 敌人 ----------------
   behavior: charge 冲撞墙 | jump 跳一级墙 | fly 飞行 | split 分裂 |
   armored 正面减伤 | sneak 直奔村民 | pack 群体增益 | eye 标记 | stomp 践踏 */
PE.D.ENEMIES = {
  wolf:      { name: '野狼',   hp: 40,  dmg: 7,  spd: 95,  r: 13, threat: 1,  night: 1,  drops: { food: 2, fur: 1 }, ember: 6,  atkRate: 1.1, aggro: 260 },
  direwolf:  { name: '头狼',   hp: 90,  dmg: 13, spd: 100, r: 16, threat: 3,  night: 3,  drops: { food: 3, fur: 2, bone: 1 }, ember: 14, atkRate: 1.0, behavior: 'pack', aggro: 300 },
  boar:      { name: '野猪',   hp: 110, dmg: 18, spd: 70,  r: 17, threat: 3,  night: 3,  drops: { food: 5, fur: 1 }, ember: 12, atkRate: 0.8, behavior: 'charge', wallMult: 3, aggro: 220 },
  snake:     { name: '毒蛇',   hp: 25,  dmg: 6,  spd: 60,  r: 10, threat: 2,  night: 4,  drops: { food: 1, herb: 1 }, ember: 8, atkRate: 1.2, behavior: 'sneak', poison: 3, aggro: 400 },
  saber:     { name: '剑齿虎', hp: 200, dmg: 24, spd: 105, r: 18, threat: 6,  night: 6,  drops: { food: 6, fur: 3, bone: 2 }, ember: 24, atkRate: 0.9, behavior: 'jump', aggro: 320 },
  bat:       { name: '夜蝠',   hp: 15,  dmg: 4,  spd: 130, r: 8,  threat: 0.7, night: 7, drops: {}, ember: 3, atkRate: 1.4, behavior: 'fly', group: 8, aggro: 500 },
  bear:      { name: '巨熊',   hp: 600, dmg: 34, spd: 55,  r: 24, threat: 10, night: 8,  drops: { food: 10, fur: 5, bone: 3 }, ember: 40, atkRate: 0.7, wallMult: 2, aggro: 240 },
  bogspawn:  { name: '沼泽魔裔', hp: 150, dmg: 18, spd: 75, r: 15, threat: 7, night: 9,  drops: { herb: 2 }, ember: 20, atkRate: 1.0, behavior: 'split', nightmare: true, aggro: 280 },
  rhino:     { name: '岩甲犀', hp: 900, dmg: 30, spd: 50,  r: 26, threat: 14, night: 11, drops: { stone: 6, bone: 4, food: 6 }, ember: 55, atkRate: 0.7, behavior: 'armored', wallMult: 2, aggro: 220 },
  mammoth:   { name: '猛犸',   hp: 2000, dmg: 48, spd: 42, r: 34, threat: 25, night: 13, drops: { food: 20, fur: 8, bone: 8 }, ember: 120, atkRate: 0.55, behavior: 'stomp', wallMult: 4, aggro: 200 },
  eye:       { name: '夜魔之眼', hp: 60, dmg: 0, spd: 85,  r: 12, threat: 4,  night: 5,  drops: {}, ember: 18, behavior: 'eye', fly: true, nightmare: true, aggro: 0 },
  tribal:    { name: '部落战士', hp: 130, dmg: 15, spd: 88, r: 14, threat: 5, night: 99, drops: { flint: 1 }, ember: 15, atkRate: 1.0, aggro: 320, humanoid: true },
};
PE.D.BOSSES = {
  claw:   { name: '夜魔·爪',   hp: 600,  dmg: 40, spd: 78, r: 26, night: 5,  ember: 300, drops: { bone: 5 } },
  shadow: { name: '夜魔·影',   hp: 2500, dmg: 60, spd: 70, r: 30, night: 10, ember: 600, drops: { obsidian: 4 } },
  lord:   { name: '梦魇之主',  hp: 6000, dmg: 80, spd: 62, r: 40, night: 15, ember: 2000, drops: {} },
};

/* ---------------- 野生动物（白天猎物/驯养源） ---------------- */
PE.D.WILD = {
  deer:   { name: '鹿',   hp: 45, spd: 120, r: 14, drops: { food: 5, fur: 2 }, flee: true },
  rabbit: { name: '兔子', hp: 12, spd: 130, r: 8,  drops: { food: 2 }, flee: true },
  w_wolf: { name: '野狼', hp: 40, dmg: 8, spd: 95, r: 13, drops: { food: 2, fur: 1 }, tameFood: 'food', tameN: 3, tameAs: 'warwolf' },
  w_boar: { name: '野猪', hp: 120, dmg: 20, spd: 70, r: 17, drops: { food: 5, fur: 1 }, tameFood: 'food', tameN: 5, tameAs: 'ridingboar' },
  hyena:  { name: '鬣狗', hp: 55, dmg: 9, spd: 105, r: 12, drops: { food: 2, bone: 1 }, ember: 6, atkRate: 1.1, aggressive: 1, aggro: 240 }, // 白天也主动袭击
};
PE.D.PETS = {
  warwolf:    { name: '战狼',   hp: 120, dmg: 16, spd: 110, r: 13, desc: '白天助猎，夜晚巡逻' },
  ridingboar: { name: '披甲野猪', hp: 200, dmg: 22, spd: 95, r: 17, ride: 1.6, desc: '可骑乘冲撞 (交互键上下)' },
  eagle:      { name: '巨鹰',   hp: 80,  dmg: 8,  spd: 160, r: 11, scout: true, desc: '侦查天眼，预报敌情详情' },
  sabercub:   { name: '幼年剑齿虎', hp: 150, dmg: 24, spd: 115, r: 15, growth: 0.05, desc: '每存活一夜 +5% 属性' },
};

/* ---------------- 科技树 ---------------- */
PE.D.TECH = {
  cook:      { name: '烤肉架',   br: 'surv', cost: { wood: 6 }, ember: 30, t: 30, desc: '篝火可烤肉，食物回复翻倍' },
  herblore:  { name: '草药学',   br: 'surv', cost: { herb: 4 }, ember: 50, t: 40, req: 'cook', desc: '解锁草药膏打造' },
  pottery:   { name: '制陶',     br: 'surv', cost: { clay: 6 }, ember: 60, t: 45, req: 'herblore', desc: '解锁陶罐/火油沟/炸药罐' },
  weaving:   { name: '织布保暖', br: 'surv', cost: { fur: 6 }, ember: 70, t: 45, req: 'pottery', desc: '雪季体温流失减半' },
  fishnet:   { name: '渔网',     br: 'surv', cost: { fur: 3, wood: 4 }, ember: 80, t: 50, req: 'weaving', desc: '每天黎明自动 +6 食物' },
  harvest:   { name: '丰收图腾', br: 'surv', cost: { herb: 6, stone: 4 }, ember: 120, t: 60, req: 'fishnet', desc: '全部落采集 x1.5' },
  bonecraft: { name: '骨器工艺', br: 'war',  cost: { bone: 4 }, ember: 40, t: 35, desc: '解锁骨锤/骨墙/骨制工具' },
  traps:     { name: '陷阱工艺', br: 'war',  cost: { wood: 8, flint: 3 }, ember: 50, t: 40, req: 'bonecraft', desc: '解锁尖刺坑/绊索' },
  totemtower:{ name: '图腾塔',   br: 'war',  cost: { stone: 8, herb: 2 }, ember: 80, t: 50, req: 'traps', desc: '解锁自动攻击图腾塔' },
  masonry:   { name: '砌石术',   br: 'war',  cost: { stone: 10 }, ember: 60, t: 40, req: 'traps', desc: '解锁石墙' },
  obsidianedge:{ name: '黑曜石开锋', br: 'war', cost: { obsidian: 3 }, ember: 120, t: 60, req: 'totemtower', desc: '解锁黑曜石武器/工具' },
  warhorn:   { name: '战争号角', br: 'war',  cost: { bone: 6, fur: 4 }, ember: 160, t: 70, req: 'obsidianedge', desc: '夜晚全体攻击 x1.3' },
  taming:    { name: '驯兽术',   br: 'myst', cost: { food: 8 }, ember: 30, t: 30, desc: '战兽更强壮：属性 +25%（驯服本身无需科技）' },
  healtotem: { name: '治疗图腾', br: 'myst', cost: { herb: 5, stone: 3 }, ember: 60, t: 45, req: 'taming', desc: '篝火光圈内缓慢回血' },
  vision:    { name: '视界术',   br: 'myst', cost: { herb: 4, flint: 2 }, ember: 70, t: 45, req: 'healtotem', desc: '敌情预告显示准确成分' },
  bloodrite: { name: '血月仪式', br: 'myst', cost: { food: 15, herb: 5 }, ember: 100, t: 55, req: 'vision', desc: '黄昏可献祭召唤血月(双倍风险与收获)' },
  spirits:   { name: '唤灵术',   br: 'myst', cost: { herb: 8, bone: 4 }, ember: 140, t: 65, req: 'bloodrite', desc: '阵亡村民化作灵魂战士战斗一夜' },
  gatekey:   { name: '梦魇之钥', br: 'myst', cost: { obsidian: 2, star: 1 }, ember: 200, t: 80, req: 'spirits', desc: '通关必研：与三神器共启梦魇之门' },
};

/* ---------------- 打造配方（工作台） ---------------- */
PE.D.CRAFT = {
  spear:    { out: 'spear', kind: 'weapon', cost: { wood: 4, flint: 2 }, desc: '' },
  bow:      { out: 'bow', kind: 'weapon', cost: { wood: 6, fur: 2 }, desc: '' },
  hammer:   { out: 'hammer', kind: 'weapon', cost: { bone: 4, wood: 3 }, tech: 'bonecraft' },
  obspear:  { out: 'obspear', kind: 'weapon', cost: { obsidian: 3, wood: 4 }, tech: 'obsidianedge' },
  starbow:  { out: 'starbow', kind: 'weapon', cost: { star: 2, wood: 6, fur: 3 }, tech: 'obsidianedge' },
  tool2:    { out: 'tool2', kind: 'tool', cost: { bone: 3, wood: 2 }, tech: 'bonecraft', name: '骨制工具', desc: '采集 x1.5' },
  tool3:    { out: 'tool3', kind: 'tool', cost: { obsidian: 2, bone: 2 }, tech: 'obsidianedge', name: '黑曜石工具', desc: '采集 x2 可采黑曜石' },
  arrows:   { out: 'arrows', kind: 'ammo', n: 20, cost: { wood: 2, flint: 2 }, name: '箭矢 x20' },
  herbmed:  { out: 'herbmed', kind: 'usable', n: 2, cost: { herb: 3 }, tech: 'herblore', name: '草药膏 x2' },
  firebomb: { out: 'firebomb', kind: 'usable', n: 2, cost: { clay: 3, flint: 2 }, tech: 'pottery', name: '炸药陶罐 x2' },
  armor:    { out: 'armor', kind: 'armor', cost: { fur: 6, bone: 2 }, name: '兽皮甲', desc: '受伤 -25%' },
};

/* ---------------- 图腾商店（火种购买） ---------------- */
PE.D.SHOP = [
  { id: 'buy_upfire', name: '⬆升级篝火(产出/光圈/血量)', ember: 0, dyn: true, give: { upfire: 1 } },
  { id: 'buy_spear', name: '燧石矛', ember: 60, give: { weapon: 'spear' } },
  { id: 'buy_bow', name: '短弓', ember: 80, give: { weapon: 'bow' } },
  { id: 'buy_arrows', name: '箭矢 x20', ember: 25, give: { arrows: 20 } },
  { id: 'buy_meat', name: '食物 x10', ember: 30, give: { res: { food: 10 } } },
  { id: 'buy_wood', name: '木材 x10', ember: 25, give: { res: { wood: 10 } } },
  { id: 'buy_torch', name: '火把', ember: 15, give: { usable: 'torch' } },
  { id: 'buy_villager', name: '招募村民', ember: 150, give: { villager: 1 } },
  { id: 'buy_repair', name: '全体修理', ember: 0, give: { repairAll: 1 }, dyn: true },
];

/* ---------------- 部落 ---------------- */
PE.D.TRIBES = {
  river: {
    name: '河岸部落', color: '#4e8fb8', rep0: 10, x: 3780, y: 1740,
    persona: '温和的渔猎商人',
    goods: [
      { name: '稀有草药 x3', get: { herb: 3 }, pay: { food: 6 } },
      { name: '黏土 x5', get: { clay: 5 }, pay: { wood: 8 } },
      { name: '鲜鱼 x8', get: { food: 8 }, pay: { fur: 3 } },
      { name: '渔网技术', get: { tech: 'fishnet' }, pay: { ember: 120 }, rep: 30 },
    ],
  },
  ash: {
    name: '灰烬部落', color: '#c25b3a', rep0: -10, x: 3620, y: 3700,
    persona: '好战的火山猎人', hostileRaids: true,
    goods: [
      { name: '黑曜石 x2', get: { obsidian: 2 }, pay: { food: 10 } },
      { name: '战纹颜料(攻击+25% 3夜)', get: { warpaint: 1 }, pay: { ember: 100 } },
      { name: '骨头 x5', get: { bone: 5 }, pay: { food: 8 } },
      { name: '星陨铁 x1', get: { star: 1 }, pay: { ember: 250 }, rep: 40 },
    ],
  },
};
PE.D.TRIBE_ACT = {
  gift: { name: '赠礼 (食物x5)', pay: { food: 5 }, rep: 12 },
  hire: { name: '雇佣战士 (守夜2晚)', ember: 120, rep: 5 },
};

/* ---------------- 黎明祝福（三选一词条池） ---------------- */
PE.D.BLESSINGS = [
  { id: 'b_gather', name: '丰饶之手', tier: 0, desc: '采集产出 +20%', mod: { gather: 0.2 } },
  { id: 'b_speed', name: '疾风之足', tier: 0, desc: '移动速度 +8%', mod: { spd: 0.08 } },
  { id: 'b_dawnheal', name: '晨光沐浴', tier: 0, desc: '每夜开始回满生命', mod: { dawnheal: 1 } },
  { id: 'b_arrow', name: '轻羽箭术', tier: 0, desc: '箭矢造价减半', mod: { arrowcost: 0.5 } },
  { id: 'b_repair', name: '巧手', tier: 0, desc: '修理效率 x1.5', mod: { repair: 0.5 } },
  { id: 'b_hp', name: '巨熊血脉', tier: 0, desc: '生命上限 +25', mod: { maxhp: 25 } },
  { id: 'b_sta', name: '不倦', tier: 0, desc: '体力恢复 +50%', mod: { staregen: 0.5 } },
  { id: 'b_fuel', name: '省柴之术', tier: 0, desc: '篝火燃料消耗减半', mod: { fuel: 0.5 } },
  { id: 'b_fire', name: '火之亲和', tier: 1, desc: '篝火产出 +30%', mod: { fireout: 0.3 } },
  { id: 'b_trap', name: '猎杀陷阱', tier: 1, desc: '陷阱伤害 x1.5', mod: { trapdmg: 0.5 } },
  { id: 'b_rollcrit', name: '猎豹突袭', tier: 1, desc: '翻滚后下次攻击必暴击', mod: { rollcrit: 1 } },
  { id: 'b_vill', name: '战吼图腾', tier: 1, desc: '村民攻击 +40%', mod: { villdmg: 0.4 } },
  { id: 'b_light', name: '光之疆域', tier: 1, desc: '所有光圈 +25%', mod: { light: 0.25 } },
  { id: 'b_crit', name: '锐目', tier: 1, desc: '暴击率 +15%', mod: { crit: 0.15 } },
  { id: 'b_thorns', name: '荆棘之魂', tier: 1, desc: '墙体反伤 +15%', mod: { thorns: 0.15 } },
  { id: 'b_pet', name: '兽语者', tier: 1, desc: '战兽属性 +30%', mod: { petbuff: 0.3 } },
  { id: 'b_greed', name: '贪婪图腾', tier: 2, desc: '击杀 10% 概率火种翻倍', mod: { greed: 0.1 } },
  { id: 'b_rebuild', name: '大地回响', tier: 2, desc: '每夜首个被毁建筑立即免费复原', mod: { rebuild: 1 } },
  { id: 'b_petsave', name: '灵魂链接', tier: 2, desc: '战兽死亡改为重伤(每局一次)', mod: { petsave: 1 } },
  { id: 'b_innerlight', name: '心中之火', tier: 2, desc: '黑暗中你也视为身处光圈', mod: { innerlight: 1 } },
  { id: 'b_vamp', name: '血祭', tier: 2, desc: '击杀回复 5 生命', mod: { vamp: 5 } },
  { id: 'b_double', name: '先祖庇佑', tier: 2, desc: '黎明奖励翻倍', mod: { dawnx2: 1 } },
];

/* ---------------- 随机事件 ---------------- */
PE.D.EVENTS = [
  { id: 'ev_wanderer', name: '流浪原始人', w: 10, desc: '一位瘦弱的流浪者请求加入部落。', choices: [
    { t: '收留 (食物x5)', pay: { food: 5 }, fx: 'villager' }, { t: '拒绝', fx: null }] },
  { id: 'ev_meteor', name: '陨石坠落!', w: 6, desc: '一颗流星坠入大地，散发奇异光芒——但有巨兽在守着它。', choices: [
    { t: '标记位置', fx: 'meteor' }] },
  { id: 'ev_herd', name: '兽群迁徙', w: 8, desc: '大群鹿正在穿过森林，狩猎的好机会！', choices: [
    { t: '好!', fx: 'herd' }] },
  { id: 'ev_quake', name: '地震', w: 5, desc: '大地震颤，所有墙体受损 15%。', choices: [
    { t: '哎…', fx: 'quake' }] },
  { id: 'ev_trader', name: '神秘商队', w: 7, desc: '披着兽皮的神秘商人路过营地。', choices: [
    { t: '黑曜石x2 (80火种)', pay: { ember: 80 }, fx: { res: { obsidian: 2 } } },
    { t: '星陨铁x1 (200火种)', pay: { ember: 200 }, fx: { res: { star: 1 } } },
    { t: '送客', fx: null }] },
  { id: 'ev_saberden', name: '剑齿虎巢穴', w: 5, req: 'taming', desc: '猎人发现一处剑齿虎巢，里面有只幼崽。', choices: [
    { t: '用熟肉驯服 (食物x8)', pay: { food: 8 }, fx: 'sabercub' }, { t: '离开', fx: null }] },
  { id: 'ev_plague', name: '瘟疫', w: 5, minVill: 1, desc: '一名村民发起了高烧，急需草药。', choices: [
    { t: '医治 (草药x3)', pay: { herb: 3 }, fx: 'cure' }, { t: '听天由命', fx: 'plague' }] },
  { id: 'ev_dream', name: '先祖托梦', w: 5, desc: '梦中，先祖的图腾在星空下闪耀。', choices: [
    { t: '领受祝福', fx: 'blessing' }] },
  { id: 'ev_envoy_river', name: '河岸部落使者', w: 6, desc: '河岸部落使者带来一篮鲜鱼示好。', choices: [
    { t: '回赠皮毛 (皮毛x2)', pay: { fur: 2 }, fx: { rep: { river: 15 }, res: { food: 6 } } },
    { t: '收下但不回礼', fx: { rep: { river: -8 }, res: { food: 6 } } }] },
  { id: 'ev_tribute', name: '灰烬部落索贡', w: 6, desc: '灰烬部落战士傲慢地要求进贡食物。', choices: [
    { t: '进贡 (食物x30)', pay: { food: 30 }, fx: { rep: { ash: 10 } } },
    { t: '拒绝!', fx: { rep: { ash: -30 } } }] },
];

/* ---------------- 职业 / 天赋 ---------------- */
PE.D.CLASSES = {
  hunter:  { name: '猎手', desc: '初始短弓+40箭矢，移速 +10%', unlock: 0 },
  shamanC: { name: '巫医', desc: '自带治疗图腾效果，草药效果翻倍，初始草药膏x2', unlock: 100 },
  chief:   { name: '工匠首领', desc: '建筑费用 -20%，初始多一名村民', unlock: 150 },
};
PE.D.TALENTS = [
  { id: 't_res', name: '祖辈馈赠', max: 3, cost: l => 30 * (l + 1), desc: '开局 +20 木材与石头/级' },
  { id: 't_fire', name: '火种守护', max: 3, cost: l => 40 * (l + 1), desc: '篝火产出 +10%/级' },
  { id: 't_hp', name: '硬骨头', max: 3, cost: l => 35 * (l + 1), desc: '生命上限 +15/级' },
  { id: 't_wall', name: '筑垒天赋', max: 3, cost: l => 40 * (l + 1), desc: '墙体血量 +15%/级' },
  { id: 't_bless', name: '通灵者', max: 1, cost: () => 120, desc: '黎明祝福三选一变四选一' },
  { id: 't_wolf', name: '狼之友', max: 1, cost: () => 100, desc: '开局自带一头战狼' },
];

/* ---------------- 地图布局 ---------------- */
PE.D.MAP = {
  camp: { x: 2400, y: 2520 },
  regions: [
    { id: 'camp',   name: '部落营地', x: 2400, y: 2520, r: 480,  biome: 'plain' },
    { id: 'forest', name: '幽绿森林', x: 1380, y: 2820, r: 700,  biome: 'forest' },
    { id: 'river',  name: '大河',     x: 3660, y: 2400, r: 800,  biome: 'river' },
    { id: 'swamp',  name: '迷雾沼泽', x: 2280, y: 3900, r: 600,  biome: 'swamp' },
    { id: 'cave',   name: '回声洞穴', x: 1140, y: 1260, r: 550,  biome: 'rock' },
    { id: 'snow',   name: '白牙雪山', x: 2520, y: 840,  r: 640,  biome: 'snow' },
    { id: 'volcano',name: '灰烬火山', x: 3840, y: 3780, r: 600,  biome: 'volcano' },
    { id: 'bonewaste', name: '巨骨荒原', x: 4000, y: 1080, r: 540, biome: 'plain' }, // 新区域：远古骸骨与鬣狗群
  ],
  // 河流带（矩形近似，x 范围内不可通行，浅滩除外）
  riverBand: { x0: 3336, x1: 3540, fordY: [2220, 2460], fordY2: [3300, 3540] },
  paintings: [ // 壁画碎片 x6
    { x: 1080, y: 1140 }, { x: 1260, y: 1440 }, { x: 2100, y: 4020 },
    { x: 2460, y: 3840 }, { x: 2580, y: 660 }, { x: 3960, y: 3660 },
  ],
  artifacts: {
    thunderspear: { need: ['frag1'], where: 'cave', x: 996, y: 1320, name: '雷石之矛' },
    eternalflame: { need: ['frag2'], where: 'volcano', x: 3984, y: 3912, name: '不灭火种' },
    wardrum: { need: [], where: 'swamp', x: 2376, y: 4068, star: 3, name: '先祖战鼓' },
  },
  eagleNest: { x: 2712, y: 744 },
  chests: [ // 遗落宝箱 x12（探索奖励）
    { x: 1320, y: 3140 }, { x: 1630, y: 2420 }, { x: 3140, y: 2020 }, { x: 1970, y: 3980 },
    { x: 860, y: 1540 }, { x: 2300, y: 620 }, { x: 4010, y: 4010 }, { x: 2900, y: 3020 },
    { x: 4060, y: 1000 }, { x: 3050, y: 3260 }, { x: 560, y: 2520 }, { x: 3260, y: 560 },
  ],
};

/* ---------------- 村民名字/性格 ---------------- */
PE.D.NAMES = ['乌拉', '格朗', '莫卡', '塔布', '恰恰', '努克', '洛丹', '希亚', '波鲁', '坎恩', '蒂雅', '梅朵', '岩生', '小穗', '苍牙'];
PE.D.TRAITS = {
  diligent: { name: '勤劳', desc: '产出 +15%' },
  timid:    { name: '胆小', desc: '夜晚躲进帐篷' },
  brave:    { name: '勇猛', desc: '战斗 +25%' },
  glutton:  { name: '贪吃', desc: '口粮 x2' },
};
PE.D.JOBS = {
  gatherer: { name: '采集者', desc: '自动采集木/石/浆果' },
  hunter:   { name: '猎人', desc: '白天狩猎，夜晚持矛守卫' },
  shaman:   { name: '巫师', desc: '研究加速50%，夜晚为你护盾' },
  artisan:  { name: '工匠', desc: '自动修理受损建筑(半价)' },
};

/* ---------------- 成就 ---------------- */
PE.D.ACHIEVES = [
  { id: 'a_n5', name: '第一个黎明连击', desc: '存活到第 5 夜' },
  { id: 'a_boss1', name: '爪下余生', desc: '击败夜魔·爪' },
  { id: 'a_boss2', name: '影散', desc: '击败夜魔·影' },
  { id: 'a_win', name: '永夜终结者', desc: '击败梦魇之主' },
  { id: 'a_ally', name: '结义', desc: '与一个部落结盟' },
  { id: 'a_blood', name: '血月狂欢', desc: '在血月之夜存活' },
];
