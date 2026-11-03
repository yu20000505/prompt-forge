/**
 * promptstate.mjs — 状态化提示词编译器（Prompt Forge 可选插件，零依赖）
 *
 * 规则来源：NAI 社区长期积累的出图约定（权重语法、UC 分层、分级、年龄控制）。
 * 它把「提示词」拆成三件事：
 *   1. 静态 DNA    —— 角色不怎么会变的部分（脸/发/身材/物种）
 *   2. 动态状态    —— 每回合都在变的部分（服装破损、湿润、体液、束缚、姿势、分级）
 *   3. 编译规则    —— 状态 → 标签的确定性映射表（阈值、倍率、互斥、配额）
 * 于是模型只负责「叙述和判断变化」，标签由本地规则算出来，可复算、可校验、可回滚。
 *
 * 本模块只实现第 3 层与它的数据契约，不依赖任何 LLM：
 *   compileScene()  把「角色状态数组 + 场景」编译成 正向 / 负向 提示词
 *   lint()          体检：重复、自相矛盾、互斥失效、权重虚高、配额不足
 *
 * 用法：
 *   import { compileScene, lint } from './promptstate.mjs';
 *   const out = compileScene({ chars, scene, engine: 'nai-v4', style: 'nai' });
 *   console.log(out.positive, out.negative, out.report);
 */

export const VERSION = '0.1.0';

/* ============================================================
 * 1. 权重语法
 * ============================================================
 * 各家引擎的写法并不通用，这是最容易搞错的一层：
 *   nai-v3  {x} ×1.05 / [x] ×0.95（每层括号累乘），没有精确权重、没有负权重
 *   nai-v4  {x} [x] 同 v3，另外支持 1.5::x:: 精确权重 与 -1.5::x:: 负权重
 *   sd      (x:1.5)，括号默认 ×1.1
 *   plain   不加权（Flux / DALL·E 这类自然语言模型，权重符号会被当正文读）
 *
 * 注意：`(x:1.5)` 是 SD 语法，写进 NAI 会被当普通文字；`-1.5::x::` 只在 NAI v4+ 生效。
 */

const BRACE_UP = [1, 1.05, 1.1025, 1.1576]; // 0~3 层 {}

/** 把标签包装成目标引擎的加权写法。value=1 时原样返回。 */
export function w(tag, value = 1, engine = 'nai-v4') {
  const t = String(tag ?? '').trim();
  if (!t || !Number.isFinite(value) || value === 1) return t;

  if (engine === 'plain') return t;

  if (engine === 'sd') {
    return value > 0 ? `(${t}:${round2(value)})` : `[${t}:${round2(Math.abs(value))}]`;
  }

  // NAI
  if (value < 0) {
    return engine === 'nai-v4' ? `${round2(value)}::${t}::` : `[${t}]`;
  }
  if (engine === 'nai-v3') {
    // 只剩括号可用：向上取最近的一档，向下同理
    let up = 0;
    for (let i = 1; i < BRACE_UP.length; i += 1) if (BRACE_UP[i] <= value + 1e-6) up = i;
    if (up === 0) return value < 1 ? `[${t}]` : t;
    return `${'{'.repeat(up)}${t}${'}'.repeat(up)}`;
  }
  // nai-v4：括号能覆盖就用括号（更省字符），否则用精确权重
  if (value >= 1.05 && value <= 1.16) {
    const up = value >= 1.15 ? 3 : value >= 1.1 ? 2 : 1;
    return `${'{'.repeat(up)}${t}${'}'.repeat(up)}`;
  }
  if (value >= 0.9 && value < 1) return value > 0.93 ? `[${t}]` : `[[${t}]]`;
  return `${round2(value)}::${t}::`;
}

const round2 = (n) => Math.round(n * 100) / 100;

/* ============================================================
 * 2. 规则表：状态 → 标签
 * ============================================================
 * 这里的做法是「数值分档」，不是让模型自由形容。
 * 好处：同一个 60 分的破损度，永远编译出同一串标签。
 */

/** 服装破损：阈值 → 标签组（world book uid005 genClothingPrompt） */
export const DAMAGE_TIERS = [
  { min: 80, level: 3 },
  { min: 50, level: 2 },
  { min: 20, level: 1 },
  { min: 1, level: 0 },
];

/** 服装湿润：阈值 → 标签组 + 是否透视 */
export const WET_TIERS = [
  { min: 80, tags: ['{(soaked:1.2)}', 'see-through'], seeThrough: true },
  { min: 50, tags: ['wet clothes', 'see-through'], seeThrough: true },
  { min: 20, tags: ['damp clothes'], seeThrough: false },
  { min: 1, tags: ['slightly wet clothes'], seeThrough: false },
];

export const FLUID_TYPES = {
  sweat: 'sweat',
  saliva: 'saliva',
  drool: 'drool',
  tears: 'tears',
  cum: 'cum',
  love_juice: 'pussy juice',
  precum: 'precum',
  milk: 'breast milk',
  blood: 'blood',
  squirt: 'squirting',
  water: 'water',
};

/** 体液量：词 → 前置修饰（trace → flooding 六档） */
export const FLUID_AMOUNT = {
  trace: ['slight', 0.95],
  little: ['some', 0.95],
  moderate: ['covered in', 1.05],
  much: ['dripping', 1.1],
  dripping: ['dripping with', 1.1],
  flooding: ['drenched in', 1.16],
};

/** 年龄分档：分档决定「敢不敢用 mature / milf」以及负向黑名单 */
export const AGE_BUCKETS = {
  teen: { label: '少女', tags: [['young', 1.05], ['teenage', 0.95]], allow: [], ban: ['mature', 'milf', 'old', 'elderly'] },
  young: { label: '青年', tags: [['young woman', 1.05], ['adult', 1.05]], allow: [], ban: ['mature', 'milf', 'middle-aged'] },
  mature: { label: '轻熟', tags: [['adult', 1.05], ['mature', 0.95]], allow: ['mature'], ban: ['milf', 'old', 'elderly'] },
  middle: { label: '中年', tags: [['mature female', 1.05], ['milf', 0.9]], allow: ['mature', 'milf'], ban: ['old', 'elderly', 'aged'] },
  elder: { label: '老年', tags: [['elderly', 1.05], ['old woman', 1.05]], allow: ['elderly', 'old'], ban: ['young', 'teenage'] },
};

/** 老化黑名单：中年及以下角色出现这些词一定显老（world book 年龄表现控制规则） */
export const ANTI_AGING_TAGS = [
  'wrinkles', "crow's feet", 'forehead lines', 'nasolabial folds',
  'age spots', 'sagging skin', 'saggy breasts', 'old', 'elderly', 'aged',
];

/** 年龄负向词：分档不足时才加；发色是银/白/灰的角色要剔除 white/grey hair */
export const AGE_UC = {
  teen: ANTI_AGING_TAGS,
  young: ANTI_AGING_TAGS,
  mature: ["crow's feet", 'forehead lines', 'age spots', 'sagging skin', 'saggy breasts', 'old', 'elderly', 'aged'],
  middle: ANTI_AGING_TAGS,
  elder: [],
};

/** 分级 → 正向前缀 + 负向增量（world book 分级判断规则） */
export const RATING = {
  Safe: { prefix: [], negative: ['nsfw', 'nude', 'naked', 'nipples', 'pussy', 'penis', 'exposed breasts', 'topless', 'bottomless'] },
  R: { prefix: [['nsfw', 1.1]], negative: ['pussy', 'penis', 'sex', 'penetration', 'censored', 'mosaic'] },
  X: { prefix: [['nsfw', 1.1], ['explicit', 1.1]], negative: ['censored', 'mosaic'] },
};

/** 景别与人数：人一多，特写必然糊脸（world book _mx_shots_） */
export const SHOT_LIMITS = {
  1: { allow: ['extreme closeup', 'closeup', 'medium shot', 'cowboy shot', 'full body', 'wide shot'], ban: [] },
  2: { allow: ['upper body', 'medium shot', 'cowboy shot', 'full body', 'wide shot'], ban: ['extreme closeup', 'closeup'] },
  3: { allow: ['cowboy shot', 'full body', 'wide shot', 'group shot'], ban: ['extreme closeup', 'closeup', 'upper body'] },
  4: { allow: ['full body', 'wide shot', 'group shot'], ban: ['extreme closeup', 'closeup', 'upper body', 'medium shot', 'cowboy shot'] },
  5: { allow: ['wide shot', 'group shot', 'crowd shot'], ban: ['closeup', 'upper body', 'medium shot', 'cowboy shot'] },
};

/** 人数词与空间坐标（world book 空间方案） */
export function countTags(n) {
  if (n <= 1) return [['solo', 1]];
  if (n === 2) return [['duo', 1.05], ['2people', 1]];
  if (n === 3) return [['trio', 1.1], ['3people', 1.05]];
  return [['group', 1.05], ['multiple people', 1]];
}

export const SPATIAL = {
  2: [
    { name: '左右对称', slots: ['on left', 'on right'], best: '对话 / 对峙' },
    { name: '前后纵深', slots: ['foreground', 'background'], best: '保护 / 跟随' },
    { name: '紧密并排', slots: ['close together', 'side by side'], best: '亲密 / 并肩' },
  ],
  3: [
    { name: '横向三人', slots: ['on left', 'in center', 'on right'], best: '并排站立' },
    { name: '纵深三人', slots: ['foreground', 'midground', 'background'], best: '队列 / 追逐' },
    { name: '三角构图', slots: ['front center', 'back left', 'back right'], best: '领队 / 保护' },
  ],
  4: [
    { name: '四角网格', slots: ['top left', 'top right', 'bottom left', 'bottom right'], best: '群像' },
    { name: '前二后二', slots: ['front left', 'front right', 'back left', 'back right'], best: '队伍行进' },
  ],
  5: [
    { name: '前三后二', slots: ['front left', 'front center', 'front right', 'back left', 'back right'], best: '标准五人' },
  ],
};

/** 互斥特征分层：N 越大，能负担的互斥越少（world book _mx_tierConfig_） */
export const MUTEX_TIERS = [
  { id: 'tier1', weight: 1.5, keys: ['hairColor', 'hairColorSub', 'eyeColor', 'outfitColor'], label: '发色 / 瞳色 / 服装色' },
  { id: 'tier2', weight: 1.3, keys: ['faceShape', 'hairStyle', 'bodyType', 'chest'], label: '脸型 / 发型 / 体型 / 胸' },
  { id: 'tier3', weight: 1.2, keys: ['skinTone', 'eyeShape'], label: '肤色 / 眼型' },
  { id: 'tier4', weight: 1.3, keys: ['ears', 'tail', 'wings', 'horns'], label: '非人特征' },
  { id: 'tier5', weight: 1.2, keys: ['glasses', 'choker', 'hairAccessory'], label: '配饰' },
];

export const MUTEX_PLAN = {
  2: ['tier1', 'tier2', 'tier3', 'tier4', 'tier5'],
  3: ['tier1', 'tier2', 'tier4'],
  4: ['tier1', 'tier4'],
  5: ['tier1'],
};

/** 基础负向：只放「画坏了」的词，不放「画什么」的词 */
export const BASE_NEGATIVE = [
  'lowres', 'bad anatomy', 'bad hands', 'text', 'error', 'missing fingers',
  'extra digit', 'fewer digits', 'cropped', 'signature', 'watermark',
  'username', 'blurry', 'bad face', 'poorly drawn face',
];

/**
 * 绝不进负向的身份词：写了就等于把角色删掉（world book 反复强调的铁律）。
 * 注意这里只收「角色是谁」的词，不收「画面怎么排」的词 ——
 * solo / duo / group / monster / no humans 进负向是安全的，甚至是必要的。
 */
export const IDENTITY_TOKENS = [
  '1girl', '1boy', '2girls', '2boys', 'girl', 'boy', 'male', 'female',
  'man', 'woman', 'human', 'person', 'people',
];

/* ============================================================
 * 3. 分级判定
 * ============================================================
 * 只看「状态里有没有」，不看模型心情：
 * 穿着内衣 ≠ 露点，湿透 ≠ 透明，性感姿势 ≠ 裸露。
 */
export function judgeRating(ch = {}) {
  const reasons = [];
  const outfit = ch.outfit || {};
  const m = ch.mutable || {};

  if (m.sex && (m.sex.active || m.sex.penetration)) {
    reasons.push('性行为进行中');
    return { level: 'X', reasons };
  }
  if (m.arousal && (m.arousal.exposed || m.arousal.genitalTags)) {
    reasons.push('性器官描写');
    return { level: 'X', reasons };
  }
  if (m.bondage && m.bondage.active && (m.bondage.gag || m.bondage.plug || m.bondage.restraint === 'genital')) {
    reasons.push('私处束缚 / 插入物');
    return { level: 'X', reasons };
  }
  if (outfit.status === 'Naked' || outfit.dressLevel === 'naked') {
    reasons.push('全裸');
    return { level: 'R', reasons };
  }
  if (outfit.dressLevel === 'underwear only' || outfit.dressLevel === 'lingerie') {
    // 社区约定：内衣也是衣服，理论上 Safe。这里取中间值 R，交给调用方覆盖。
    reasons.push('仅内衣');
    return { level: 'R', reasons };
  }
  if (m.bondage && m.bondage.active) {
    reasons.push('束缚状态');
    return { level: 'R', reasons };
  }
  if (outfit.seeThrough) {
    reasons.push('透明 / 透视');
    return { level: 'R', reasons };
  }
  return { level: 'Safe', reasons: ['衣着完整'] };
}

/* ============================================================
 * 4. 片段编译器
 * ============================================================ */

const push = (arr, tag, weight = 1, engine = 'nai-v4') => {
  const t = String(tag ?? '').trim();
  if (!t) return;
  arr.push(w(t, weight, engine));
};

function garment(item, engine) {
  if (!item || !item.type || item.worn === false) return [];
  const out = [];
  const base = [item.color, item.pattern, item.material, item.type].filter(Boolean).join(' ');
  if (!base) return [];

  const damage = Number(item.damage) || 0;
  const tier = DAMAGE_TIERS.find((t) => damage >= t.min);
  if (!tier) {
    push(out, base, 1.0, engine);
  } else if (tier.level === 0) {
    push(out, base, 1.0, engine);
    push(out, 'slightly torn', 1.0, engine);
  } else if (tier.level === 1) {
    push(out, base, 1.0, engine);
    push(out, 'damaged clothing', 0.95, engine);
  } else if (tier.level === 2) {
    push(out, `torn ${base}`, 1.1, engine);
    push(out, 'damaged clothing', 0.95, engine);
  } else {
    push(out, `torn ${base}`, 1.16, engine);
    push(out, 'ripped clothing', 1.05, engine);
  }
  (item.damageParts || []).forEach((p) => push(out, `torn at ${p}`, 0.95, engine));

  if (item.displaced && item.displaceDesc) push(out, item.displaceDesc, 0.95, engine);

  const wet = Number(item.wet) || 0;
  const wetTier = WET_TIERS.find((t) => wet >= t.min);
  if (wetTier) wetTier.tags.forEach((t) => push(out, t, 1, engine));
  if (wet > 0 && item.wetType) push(out, `wet with ${FLUID_TYPES[item.wetType] || item.wetType}`, 0.95, engine);

  (item.stains || []).forEach((s) => push(out, `${FLUID_TYPES[s] || s} stained`, (Number(item.stainLevel) || 0) >= 50 ? 1.1 : 0.95, engine));
  return out;
}

function fluidTags(list, engine) {
  return (list || []).map((f) => {
    if (!f || f.present === false) return '';
    const type = FLUID_TYPES[f.type] || f.type;
    if (!type) return '';
    const [modifier, weight] = FLUID_AMOUNT[f.amount] || ['', 1];
    const stateTag = f.state === 'dried' ? ' dried' : f.state === 'sticky' ? ' sticky' : '';
    const core = `${modifier ? `${modifier} ` : ''}${type}${stateTag}`.trim();
    const placed = f.part ? `${core} on ${f.part}` : core;
    return w(placed, weight, engine);
  }).filter(Boolean);
}

function markTags(list, engine) {
  return (list || []).map((m) => {
    if (!m || !m.type) return '';
    const fresh = m.fresh === false ? '' : 'fresh ';
    const weight = m.severity === 'deep' ? 1.1 : 0.95;
    return w(`${fresh}${m.type}${m.part ? ` on ${m.part}` : ''}`, weight, engine);
  }).filter(Boolean);
}

function bondageTags(b, ctx = {}, engine = 'nai-v4') {
  if (!b || !b.active) return [];
  const out = [];
  if (b.type) push(out, `${b.type} bondage`, 1.05, engine);
  if (b.blindfold) push(out, b.blindfoldType || 'blindfold', 1.05, engine);
  if (b.gag) push(out, b.gagType || 'ball gag', 1.05, engine);
  if (b.collar) push(out, b.collarType || 'collar', 1.05, engine);
  if (b.leash) push(out, 'leash', 1.05, engine);
  if (b.arms === 'behind back') { push(out, 'arms behind back', 1.1, engine); push(out, 'bound wrists', 1.05, engine); }
  else if (b.arms === 'above head') { push(out, 'arms up', 1.1, engine); push(out, 'suspended', 1.05, engine); }
  else if (b.arms) push(out, 'bound arms', 1.05, engine);
  if (b.legs) push(out, b.spreader ? 'spreader bar' : 'bound legs', 1.05, engine);
  if (b.plug) { push(out, b.plugType || 'butt plug', 1.05, engine); if (String(b.plugType || '').includes('tail')) push(out, 'tail plug', 1.05, engine); }
  if (b.ropeMarks) push(out, 'rope marks', 0.95, engine);
  if (b.suspension) push(out, 'suspension bondage', 1.05, engine);
  return out;
}

function poseTags(p, engine) {
  if (!p) return [];
  const out = [];
  if (p.base) push(out, p.base, 1.05, engine);
  if (p.detail) push(out, p.detail, 1.0, engine);
  if (p.facing) push(out, p.facing, 0.95, engine);
  if (p.head) push(out, p.head, 0.95, engine);
  if (p.gaze) push(out, p.gaze, 0.95, engine);
  if (p.arms) push(out, p.arms, 1.05, engine);
  if (p.hands) push(out, p.hands, 0.95, engine);
  if (p.legs) push(out, p.legs, 1.05, engine);
  return out;
}

/** 物种分流：人形用 1girl/1boy，非人形必须 no humans（world book 物种分流协议） */
function speciesTags(ch, engine) {
  const out = [];
  const isHuman = (ch.kind || 'human') === 'human';
  if (isHuman) {
    if (ch.gender === 'male') push(out, '1boy', 1, engine);
    else if (ch.gender === 'none') push(out, 'no humans', 1, engine);
    else push(out, '1girl', 1, engine);
  } else {
    push(out, 'no humans', 1, engine);
    if (ch.species) push(out, ch.species, 1, engine);
    push(out, 'monster', 1.0, engine);
  }
  return out;
}

/* ============================================================
 * 5. 单角色编译
 * ============================================================ */
export function compileCharacter(ch, opts = {}) {
  const engine = opts.engine || 'nai-v4';
  const index = opts.index ?? 0;
  const others = opts.others || [];
  const dna = ch.dna || {};
  const outfit = ch.outfit || {};
  const expr = ch.expression || {};
  const m = ch.mutable || {};
  const warnings = [];

  const rating = judgeRating(ch);
  const age = AGE_BUCKETS[ch.age?.bucket || 'young'] || AGE_BUCKETS.young;
  const tags = [];

  // 【0】负权重排斥：先手排除别人的特征，比事后抢救便宜
  if (others.length && opts.mutex !== false) {
    const mutex = mutexFor(ch, others, engine);
    if (mutex.length) tags.push(mutex.join(', '));
  }

  // 【1】身份 → 【2】名字 → 【3】分级前缀
  tags.push(...speciesTags(ch, engine));
  // 角色名默认不进提示词：NAI 认的是 danbooru 已有角色 tag，
  // 自创名只是高权重噪音，还可能激活同名角色。已知 IP 角色可传 nameWeight 打开。
  if (ch.name && opts.nameWeight) push(tags, ch.name, opts.nameWeight, engine);
  RATING[rating.level].prefix.forEach(([t, v]) => push(tags, t, v, engine));

  // 【4】物种 / 年龄
  if (ch.kind !== 'nonhuman') {
    age.tags.forEach(([t, v]) => push(tags, t, v, engine));
    if (ch.species && ch.species !== 'human') push(tags, ch.species, 1.0, engine);
  }

  // 【5】身体框架
  if (dna.build) push(tags, dna.build, 1.05, engine);
  if (dna.height) push(tags, dna.height, 1.0, engine);
  if (dna.skin) push(tags, dna.skin, 1.05, engine);
  push(tags, 'detailed skin', 1.0, engine);
  push(tags, 'skin texture', 1.05, engine);

  // 【6】面部 ≥10
  ['faceShape', 'cheeks', 'chin', 'eyeSize', 'eyeShape', 'eyeColor', 'lashes', 'lips', 'lipColor', 'nose']
    .forEach((k, i) => { if (dna[k]) push(tags, dna[k], i === 5 ? 1.1 : 1.0, engine); });

  // 【7】头发 ≥7
  if (dna.hairColor) push(tags, dna.hairColor, 1.1, engine);
  ['hairColorSub', 'hairLength', 'hairStyle', 'bangs', 'hairTexture', 'hairAccessory']
    .forEach((k) => { if (dna[k]) push(tags, dna[k], 1.0, engine); });

  // 【8】身材 ≥8
  if (dna.chest) push(tags, dna.chest, 1.1, engine);
  ['chestShape', 'waist', 'hips', 'thighs', 'calves']
    .forEach((k) => { if (dna[k]) push(tags, dna[k], 1.0, engine); });

  // 非人特征
  if (ch.kind !== 'nonhuman') {
    ['ears', 'tail', 'wings', 'horns'].forEach((k) => { if (dna[k]) push(tags, dna[k], 1.05, engine); });
  }

  // 【9】当前服装 ≥10，且必须带颜色
  const garments = [];
  if (outfit.collar) garments.push(...garment(outfit.collar, engine));
  ['top', 'dress', 'bottom', 'bra', 'panties', 'socks', 'shoes'].forEach((k) => {
    garments.push(...garment(outfit[k], engine));
  });
  (outfit.accessories || []).forEach((a) => { if (a) push(garments, a, 0.95, engine); });
  tags.push(...garments);
  (['top', 'dress', 'bottom', 'shoes', 'socks'].forEach((k) => {
    const g = outfit[k];
    if (g && g.type && g.worn !== false && !g.color) warnings.push(`「${k}」没有写颜色，模型会自己随机分配`);
  }));

  // 【10】姿势 / 动作绑定（动作必须带主语，否则多人场景会画反）
  poseTags(m.pose, engine).forEach((t) => tags.push(t));
  if (m.action) push(tags, `${ch.name || 'character'} ${m.action}`, opts.bindAction === false ? 1.0 : 1.3, engine);

  // 【11】表情
  ['eyes', 'mouth', 'overall'].forEach((k) => { if (expr[k]) push(tags, expr[k], 1.0, engine); });

  // 【12】空间坐标
  if (opts.slot) push(tags, opts.slot, 1.05, engine);

  // 【13】可动状态：体液 / 印记 / 束缚
  tags.push(...fluidTags(m.fluids, engine));
  tags.push(...markTags(m.marks, engine));
  tags.push(...bondageTags(m.bondage, { rating: rating.level }, engine));

  const deduped = dedupeTags(tags);
  const merged = deduped.join(', ');
  return {
    index,
    name: ch.name || `Character ${index + 1}`,
    rating,
    positive: merged,
    quota: quotaReport(merged),
    warnings,
  };
}

/** N 人互斥：给角色 i 生成「别人的特征」负向串，按人数降级（world book _mx_tierConfig_） */
export function mutexFor(ch, others, engine = 'nai-v4') {
  const n = others.length + 1;
  const plan = MUTEX_PLAN[Math.min(n, 5)] || MUTEX_PLAN[5];
  const out = [];
  const seen = new Set();
  MUTEX_TIERS.filter((t) => plan.includes(t.id)).forEach((tier) => {
    others.forEach((o) => {
      tier.keys.forEach((k) => {
        const v = (o.dna || {})[k];
        if (!v) return;
        // 中文锚点拼进负权重等于没写（NAI 不认），直接跳过，交给界面提示去补英文
        if (/[\u3400-\u9fff]/.test(String(v))) return;
        const key = String(v).toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(w(v, -tier.weight, engine));
      });
    });
  });
  return out;
}

/* ============================================================
 * 6. 场景编译
 * ============================================================ */
export function compileScene({ chars = [], scene = {}, engine = 'nai-v4', style = 'nai' } = {}) {
  const n = chars.length || 1;
  const problems = [];
  const shotInfo = SHOT_LIMITS[Math.min(n, 5)] || SHOT_LIMITS[5];

  const shot = scene.shot || shotInfo.allow[Math.min(1, shotInfo.allow.length - 1)];
  if (shotInfo.ban.includes(shot)) {
    problems.push(`景别「${shot}」在 ${n} 人场景里会糊脸，建议改成 ${shotInfo.allow.join(' / ')}`);
  }

  const spatialSets = SPATIAL[Math.min(Math.max(n, 2), 5)] || SPATIAL[2];
  const spatial = n >= 2 ? (spatialSets[scene.spatial ?? 0] || spatialSets[0]) : null;

  // Scene 段
  const sceneTags = [];
  RATING[judgeSceneRating(chars)].prefix.forEach(([t, v]) => push(sceneTags, t, v, engine));
  push(sceneTags, scene.frame || 'single frame', 1.0, engine);
  push(sceneTags, 'cinematic still', 1.0, engine);
  if (scene.view) push(sceneTags, scene.view, 1.05, engine);
  push(sceneTags, shot, 1.0, engine);
  countTags(n).forEach(([t, v]) => push(sceneTags, t, v, engine));
  // 空间坐标只放在各自角色段里：Scene 里再放一份，等于同一个位置词出现两次
  if (scene.light) push(sceneTags, scene.light, 1.0, engine);
  if (scene.composition) push(sceneTags, scene.composition, 1.0, engine);
  if (scene.location) push(sceneTags, scene.location, 1.05, engine);
  if (scene.mood) push(sceneTags, scene.mood, 1.0, engine);
  if (style === 'nai') push(sceneTags, 'film grain', 1.0, engine);

  // 每个角色
  const compiled = chars.map((ch, i) => compileCharacter(ch, {
    engine,
    index: i,
    others: chars.filter((_, j) => j !== i),
    slot: n >= 2 && spatial ? spatial.slots[i] : '',
    bindAction: scene.bindAction,
    nameWeight: scene.nameWeight || ch.nameWeight || 0,
  }));

  const positive = [
    `Scene Composition: ${dedupeTags(sceneTags).join(', ')}`,
    ...compiled.map((c, i) => `Character ${i + 1} Prompt: ${c.positive}`),
  ].join('; ');

  const negative = buildNegative({ chars, scene, engine, style, compiled });

  return {
    positive,
    negative,
    scene: { shot, shotAllow: shotInfo.allow, spatial: spatial ? spatial.name : null, spatialBest: spatial?.best || '' },
    characters: compiled,
    problems,
    stats: {
      characters: n,
      positiveTags: countTagTokens(positive),
      negativeTags: countTagTokens(negative),
      positiveTokens: estimateTokens(positive),
      negativeTokens: estimateTokens(negative),
    },
  };
}

function judgeSceneRating(chars) {
  const order = { X: 2, R: 1, Safe: 0 };
  return chars.reduce((acc, ch) => {
    const lv = judgeRating(ch).level;
    return order[lv] > order[acc] ? lv : acc;
  }, 'Safe');
}

/* ============================================================
 * 7. 负向提示词构建：基础 + 分级 + 年龄 + 物种 + 互斥
 * ============================================================ */
export function buildNegative({ chars = [], scene = {}, engine = 'nai-v4', style = 'nai', compiled = [] } = {}) {
  const out = [...BASE_NEGATIVE];
  const seen = new Set(out.map((x) => x.toLowerCase()));

  const pushUC = (tag) => {
    const t = String(tag || '').trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  // 分级 UC（取全场最高分级）
  RATING[judgeSceneRating(chars)].negative.forEach(pushUC);

  // 场景级：多人时禁掉单人词；单人之类
  const n = chars.length || 1;
  if (n >= 2) ['solo', 'alone'].forEach(pushUC);

  // 每角色：年龄 UC（银发角色要剔除 white/grey hair，否则自己就是矛盾）
  const allHuman = chars.every((c) => (c.kind || 'human') === 'human');
  chars.forEach((ch) => {
    const bucket = ch.age?.bucket || 'young';
    const ageUC = AGE_UC[bucket] || [];
    const hair = String(ch.dna?.hairColor || '').toLowerCase();
    const silverHaired = /silver|white|grey|gray|platinum|ash/.test(hair);
    ageUC.forEach((t) => {
      if (silverHaired && /hair/.test(t)) return; // 自相矛盾：屏蔽白发会连角色本身一起抹掉
      pushUC(t);
    });

    // 全场都是人形时，才值得禁 monster；
    // 反过来「给非人形角色禁 1girl/human」是自相矛盾的（UC 本来就不允许出现 1girl），
    // 正向前缀已经有 no humans,<物种>，不需要再把身份词丢进负向。
    if (allHuman) pushUC('monster');

    // 角色自带 taboos（设定集条目已有这个字段，直接并进来）
    (ch.taboos || []).forEach(pushUC);
  });

  // 世界级 taboos
  (scene.taboos || []).forEach(pushUC);

  // 注意：多人互斥不放这里。互斥写作 -1.5::别人特征::，
  // 只放在各自的 Character Prompt 开头（见 compileCharacter），
  // 同时进正负两边会重复施加，还会把负向串撑爆。

  return out.join(', ');
}

/* ============================================================
 * 7.5 设定集条目 → 角色状态（对接 Prompt Forge 现有数据结构）
 * ============================================================
 * worlds/*.json 的条目是 { name, summary, facts:[{label,value}], visualAnchors, taboos }。
 * visualAnchors 本来就是「一条逗号分隔的视觉锚点串」，等价于角色 DNA 的压缩表示。
 * 这里把它拆回结构化字段，能认出来的落到对应槽位，认不出来的原样返回，
 * 让界面提示用户去补 —— 不要猜。
 */
const ANCHOR_SLOTS = [
  { key: 'hairColor', re: /hair\s*color|发色|头发|hair/i, weight: 1.1 },
  { key: 'eyeColor', re: /eye|瞳|眼珠/i, weight: 1.1 },
  { key: 'skin', re: /skin|肤/i, weight: 1.05 },
  { key: 'chest', re: /breast|bust|胸/i, weight: 1.1 },
  { key: 'build', re: /build|slender|petite|curvy|body|体型|身材/i, weight: 1.05 },
  { key: 'height', re: /height|tall|short|身高/i, weight: 1.0 },
  { key: 'faceShape', re: /face|脸/i, weight: 1.0 },
  { key: 'ears', re: /ear|耳/i, weight: 1.05 },
  { key: 'tail', re: /tail|尾/i, weight: 1.05 },
  { key: 'wings', re: /wing|翼|翅/i, weight: 1.05 },
  { key: 'horns', re: /horn|角/i, weight: 1.05 },
  { key: 'hairStyle', re: /ponytail|braid|bun|twin tail|hair style|发型|辫|马尾/i, weight: 1.0 },
];

const NONHUMAN_SPECIES = /dragon|slime|tentacle|beast|wolf|fox|cat|bird|serpent|mecha|robot|creature|龙|史莱姆|触手|兽|狼|狐|猫|鸟|蛇|机械/i;

export function entryToCharacter(entry = {}, opts = {}) {
  const anchors = String(entry.visualAnchors || '')
    .split(/[,，、;；]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const dna = {};
  const outfitParts = [];
  const unmapped = [];

  anchors.forEach((a) => {
    const slot = ANCHOR_SLOTS.find((s) => s.re.test(a));
    if (slot && !dna[slot.key]) { dna[slot.key] = a; return; }
    if (/dress|robe|coat|shirt|blouse|skirt|pants|armor|uniform|cloak|袍|裙|衣|甲|制服/i.test(a)) {
      outfitParts.push(a);
      return;
    }
    unmapped.push(a);
  });

  const summary = String(entry.summary || '');
  const nonhuman = NONHUMAN_SPECIES.test(`${summary} ${anchors.join(' ')}`);

  const ch = {
    id: entry.id,
    name: entry.name || 'character',
    gender: opts.gender || (nonhuman && !/1girl|female|女/.test(summary) ? 'none' : 'female'),
    kind: nonhuman ? 'nonhuman' : 'human',
    species: nonhuman ? (anchors.find((a) => NONHUMAN_SPECIES.test(a)) || 'monster') : 'human',
    age: { bucket: opts.ageBucket || 'young' },
    dna,
    outfit: {},
    taboos: String(entry.taboos || '').split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean),
    source: { entryId: entry.id, from: 'worlds' },
  };

  // 服装：认领第一个可当主衣的锚点，颜色从锚点里抠（NAI 里服装没颜色就会随机配色）
  if (outfitParts.length) {
    const main = outfitParts[0];
    const colorMatch = main.match(/(white|black|red|blue|green|grey|gray|silver|gold|brown|purple|pink|青灰|朱砂|灰白|银|金|黑|白|红)/i);
    const type = main.replace(colorMatch?.[0] || '', '').trim() || main;
    ch.outfit.dress = { type, color: colorMatch?.[0] || '', worn: true };
    ch.outfit.dressLevel = 'fully dressed';
    ch.outfit.status = 'Intact';
    // 服装整串也进 DNA：多人互斥要压的是「别人那件衣服」，只压颜色会把黑发一起压掉
    dna.outfitColor = main;
    ch.outfit.mainColor = colorMatch?.[0] || '';
  }

  // 中文锚点不能直接当标签用：NAI 只认英文词，这一步必须显式提示，不能悄悄吞掉
  const needsTranslation = anchors.filter((a) => /[\u3400-\u9fff]/.test(a));

  return { character: ch, unmapped, anchors, needsTranslation };
}

/* ============================================================
 * 8. 体检（lint）
 * ============================================================
 * 出图社区反复总结的「失败判定清单」，值得直接变成可执行规则。
 */
export function lint({ positive = '', negative = '', scene = {}, chars = [], engine = 'nai-v4', budget = 9000 } = {}) {
  const issues = [];
  const add = (level, code, msg) => issues.push({ level, code, msg });

  // 1) 括号配对
  const balanced = (s) => {
    let curly = 0; let square = 0;
    for (const ch of s) {
      if (ch === '{') curly += 1;
      else if (ch === '}') curly -= 1;
      else if (ch === '[') square += 1;
      else if (ch === ']') square -= 1;
      if (curly < 0 || square < 0) return false;
    }
    return curly === 0 && square === 0;
  };
  if (!balanced(positive)) add('error', 'bracket', '正向提示词括号不配对：模型会把整段当普通文字读');
  if (!balanced(negative)) add('error', 'bracket-neg', '负向提示词括号不配对');

  // 2) 负向里出现身份词 = 角色消失（最常见的坑）
  const negLower = negative.toLowerCase();
  IDENTITY_TOKENS.forEach((t) => {
    if (new RegExp(`(^|[,\\s:])${escapeRe(t)}($|[,\\s:])`).test(negLower)) {
      add('error', 'uc-identity', `负向里出现「${t}」：这会顺着权重把整个角色抹掉，请删掉`);
    }
  });

  // 3) 人数词自相矛盾
  const n = chars.length || Math.max(1, readScene(positive).total);
  if (n === 1 && /\b(duo|trio|group|multiple people|2people|3people)\b/.test(positive)) {
    add('error', 'count-tag', '单人场景里出现了多人词');
  }
  if (n >= 2 && /\bsolo\b/.test(positive) && !/\bsolo\b/.test(negative)) {
    add('error', 'count-tag-2', `场上 ${n} 个角色却留着 solo`);
  }

  // 4) 景别与人数
  const shotInfo = SHOT_LIMITS[Math.min(n, 5)] || SHOT_LIMITS[5];
  const reportedShots = [];
  shotInfo.ban.forEach((b) => {
    if (!positive.toLowerCase().includes(b)) return;
    if (reportedShots.some((r) => r.includes(b))) return; // "extreme closeup" 已经报过 "closeup"
    reportedShots.push(b);
    add('error', 'shot', `${n} 人场景用了被禁景别「${b}」`);
  });

  // 5) 重复标签（DNA 和当前服装各来一份是常态）
  const dups = findDuplicates(positive);
  if (dups.length) add('warn', 'dup', `重复标签 ${dups.length} 个：${dups.slice(0, 8).join(', ')}`);

  // 6) 权重虚高：一半以上标签都带权重，等于没加权
  const tags = splitTopLevel(positive);
  const weighted = tags.filter((t) => /^[{[]|:\d/.test(t) || /\d::.*::$/.test(t)).length;
  if (tags.length > 8 && weighted / tags.length > 0.6) {
    add('info', 'weight-inflation', `${weighted}/${tags.length} 个标签都带了权重，强调已经失去意义，建议只留 3~6 个真正要强调的`);
  }

  // 7) 年龄自相矛盾
  chars.forEach((ch) => {
    const bucket = ch.age?.bucket || 'young';
    const banned = AGE_BUCKETS[bucket]?.ban || [];
    const text = `${positive} ${negative}`.toLowerCase();
    banned.forEach((b) => {
      if (tagPresent(positive.toLowerCase(), b)) {
        add('error', 'age', `「${ch.name || '角色'}」是 ${AGE_BUCKETS[bucket].label}，正向却用了 ${b}（会显老）`);
      }
      if (bucket !== 'elder' && AGE_UC[bucket]?.includes(b) && !negative.toLowerCase().includes(b)) {
        add('info', 'age-uc', `「${ch.name || '角色'}」的负向缺抗老化词 ${b}`);
      }
      if (bucket === 'elder' && /young|teenage/.test(text) && tagPresent(positive.toLowerCase(), b)) {
        add('info', 'age-uc-2', '老年角色正向里混了年轻词');
      }
    });
  });

  // 8) 服装没颜色
  chars.forEach((ch) => {
    ['top', 'dress', 'bottom', 'shoes'].forEach((k) => {
      const g = ch.outfit?.[k];
      if (g?.type && g.worn !== false && !g.color) {
        add('warn', 'garment-color', `「${ch.name || '角色'}」的 ${k} 没有颜色`);
      }
    });
  });

  // 9) 负权重语法与引擎不匹配
  if (engine === 'nai-v3' && /-\d+(\.\d+)?::/.test(negative)) {
    add('error', 'engine-weight', '负权重 -1.5::x:: 只在 NAI v4+ 生效，v3 会当成普通文字');
  }
  if (engine === 'plain' && /[{}[\]]/.test(positive)) {
    add('warn', 'engine-plain', '自然语言模型会把 {} [] 当正文读，权重符号应当去掉');
  }
  if (engine === 'nai-v4' && /\(\w[\w\s-]*:\d/.test(positive)) {
    const m = positive.match(/\(([\w\s-]+):(\d+(?:\.\d+)?)\)/);
    add('warn', 'engine-sd-syntax', m
      ? `「(${m[1]}:${m[2]})」是 SD 写法，NAI 不认；要写成 ${m[2]}::${m[1].trim()}::`
      : '检测到 SD 写法 (tag:1.5)，NAI 不认这种语法');
  }

  // 10) 场景级问题
  (scene.problems || []).forEach((p) => add('warn', 'scene', p));

  // 11) 预算
  const tokens = estimateTokens(positive) + estimateTokens(negative);
  if (tokens > budget) add('warn', 'budget', `估算 ${tokens} tokens，超过预算 ${budget}：先删重复和弱权重标签`);
  const posOnly = estimateTokens(positive);
  if (posOnly > budget * 0.75) add('warn', 'budget-pos', `仅正向就 ${posOnly} tokens，主体容易丢失`);

  return {
    issues,
    ok: !issues.some((i) => i.level === 'error'),
    errors: issues.filter((i) => i.level === 'error').length,
    warnings: issues.filter((i) => i.level === 'warn').length,
    tokens,
  };
}

/* ============================================================
 * 10. NAI 专用：从「已有提示词文本」反推 UC 与体检
 * ============================================================
 * 没有角色状态表也能干活：人数、分级、物种、景别、年龄档全都写在标签里，
 * 从标签反推出来就够了。这一层是给「一句话生成」流程用的，
 * 不需要用户填任何表单。
 */

// 画质词属于「画质串 / 画师串」，不写进 positive。整理时见到就剥掉。
export const NAI_QUALITY = ['masterpiece', 'best quality', 'very aesthetic', 'absurdres'];
export const QUALITY_TAGS = [
  ...NAI_QUALITY,
  'highres', 'amazing quality', 'good quality', 'normal quality', 'aesthetic',
];

const COUNT_TAGS = [
  { key: 'girls', re: /^(\d+|multiple)\s*girls?$/ },
  { key: 'boys', re: /^(\d+|multiple)\s*boys?$/ },
];

const RATING_MARKERS = {
  explicit: ['sex', 'penetration', 'vaginal', 'anal', 'fellatio', 'cum', 'creampie', 'squirting', 'pussy juice', 'ejaculation', 'nude', 'naked', 'penis', 'pussy'],
  nsfw: ['nsfw', 'nipples', 'topless', 'bottomless', 'see-through', 'undressing', 'exposed breasts', 'underboob', 'sideboob'],
};

const SPATIAL_TAGS = [
  'on left', 'on right', 'in center', 'foreground', 'midground', 'background',
  'front left', 'front right', 'front center', 'back left', 'back right', 'back center',
  'top left', 'top right', 'bottom left', 'bottom right',
  'side by side', 'close together', 'far apart', 'overlapping',
];

const SHOT_TAGS = [
  'portrait', 'upper body', 'cowboy shot', 'full body', 'wide shot', 'group shot',
  'closeup', 'close-up', 'extreme closeup', 'medium shot', 'from above', 'from below',
  'dutch angle', 'pov',
];

/** 把一条提示词拆成「标签 + 权重」的最小表示 */
export function parseTags(text = '') {
  return splitTopLevel(text)
    .map((raw) => {
      const weightMatch = raw.match(/^(-?\d+(?:\.\d+)?)::(.+)::$/);
      if (weightMatch) return { raw, tag: weightMatch[2].trim(), weight: Number(weightMatch[1]), weighted: true };
      const sdMatch = raw.match(/^\((.+):(\d+(?:\.\d+)?)\)$/);
      if (sdMatch) return { raw, tag: sdMatch[1].trim(), weight: Number(sdMatch[2]), weighted: true, sdSyntax: true };
      const braces = raw.match(/^(\{+)(.+?)(\}+)$/);
      if (braces && braces[1].length === braces[3].length) {
        return { raw, tag: braces[2].trim(), weight: 1 + 0.05 * braces[1].length, weighted: true };
      }
      const brackets = raw.match(/^(\[+)(.+?)(\]+)$/);
      if (brackets && brackets[1].length === brackets[3].length) {
        return { raw, tag: brackets[2].trim(), weight: 1 - 0.05 * brackets[1].length, weighted: true };
      }
      return { raw, tag: raw.trim(), weight: 1, weighted: false };
    })
    .filter((t) => t.tag);
}

/** 从正向标签反推场景事实：人数、分级、物种、景别、年龄档 */
export function readScene(positive = '') {
  const parsed = parseTags(positive);
  const tags = parsed.map((t) => t.tag.toLowerCase());

  let girls = 0;
  let boys = 0;
  let multiple = false;
  for (const t of tags) {
    if (t === 'solo') continue;
    if (t === 'multiple girls') { girls = Math.max(girls, 4); multiple = true; continue; }
    if (t === 'multiple boys') { boys = Math.max(boys, 4); multiple = true; continue; }
    for (const c of COUNT_TAGS) {
      const m = t.match(c.re);
      if (!m) continue;
      const n = m[1] === 'multiple' ? 4 : Number(m[1]);
      if (c.key === 'girls') girls = Math.max(girls, n);
      else boys = Math.max(boys, n);
      if (m[1] === 'multiple') multiple = true;
    }
  }
  if (!girls && tags.includes('1girl')) girls = 1;
  if (!boys && tags.includes('1boy')) boys = 1;
  const total = girls + boys;

  const has = (list) => list.some((k) => tags.some((t) => t === k || t.includes(k)));

  let rating = 'Safe';
  if (has(RATING_MARKERS.explicit)) rating = 'X';
  else if (has(RATING_MARKERS.nsfw)) rating = 'R';

  return {
    tags,
    parsed,
    total,
    girls,
    boys,
    multiple,
    nonhuman: tags.includes('no humans'),
    shots: SHOT_TAGS.filter((s) => tags.includes(s)),
    spatial: SPATIAL_TAGS.filter((s) => tags.includes(s)),
    rating,
    ageBucket: /elderly|old woman|old man|aged/.test(positive) ? 'elder'
      : /mature female|milf|middle-aged/.test(positive) ? 'middle'
        : /mature/.test(positive) ? 'mature'
          : /young woman|young man|adult|teenage/.test(positive) ? 'young' : 'unknown',
    silverHaired: /\b(silver|white|grey|gray|platinum|ash)[ -]hair\b|silver_hair|white_hair/.test(positive),
  };
}

/** 按 NAI 惯例给标签归类，用于重排顺序 */
const ORDER_BUCKETS = [
  { rank: 0, re: /^(masterpiece|best quality|very aesthetic|absurdres|highres|detailed|official art|amazing quality)$/ },
  { rank: 1, re: /^(solo|1girl|1boy|2girls|2boys|[3-9]\+?girls|[3-9]\+?boys|multiple girls|multiple boys|duo|trio|group|multiple people|2people|3people|couple)$/ },
  { rank: 2, re: /^(no humans|monster|creature|dragon|slime|tentacles?|robot|mecha)$/ },
  { rank: 3, re: /(age|young|adult|mature|elderly|teenage|old|loli|shota|milf|child|woman|man|girl|boy)/ },
  { rank: 4, re: /(face|cheek|chin|jaw|nose|lips|mouth|teeth|freckles|mole|scar|eyebrow)/ },
  { rank: 5, re: /(eye|pupil|eyelash|glasses|blindfold)/ },
  { rank: 6, re: /(hair|bangs|braid|ponytail|twintails|ahoge|bun)/ },
  { rank: 7, re: /(breast|chest|waist|hip|thigh|leg|arm|hand|skin|muscle|body|stomach|shoulder|neck|ear|tail|wing|horn|fang|claw|scale)/ },
  { rank: 8, re: /(shirt|blouse|skirt|dress|coat|jacket|sweater|uniform|robe|armor|bra|panty|panties|underwear|thighhigh|stocking|sock|boot|shoe|glove|hat|cap|ribbon|necklace|choker|earring|jewel|belt|cloak|scarf|kimono|yukata|bikini|swimsuit|apron)/ },
  { rank: 9, re: /(standing|sitting|kneeling|lying|walking|running|crouch|leaning|spread|raised|holding|hugging|looking|from_?behind|arm|hand up)/ },
  { rank: 10, re: /(smile|grin|frown|tears|crying|blush|embarrassed|angry|surprised|expression|open mouth|closed eyes|parted lips)/ },
  { rank: 11, re: new RegExp(`^(${SPATIAL_TAGS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`) },
  { rank: 12, re: /(sky|forest|street|room|building|tree|water|rain|snow|cloud|night|day|indoor|outdoor|background|ruins|city|field|mountain|ocean|beach)/ },
  { rank: 13, re: /(light|lighting|shadow|glow|sunset|sunrise|backlight|rim light|god rays|volumetric|dim|bright)/ },
  { rank: 14, re: new RegExp(`^(${SHOT_TAGS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`) },
];

function rankOf(tag) {
  const t = tag.toLowerCase();
  for (const b of ORDER_BUCKETS) if (b.re.test(t)) return b.rank;
  return 15;
}

/**
 * 把一条正向提示词整理成 NAI 规范形态：
 * 小写、去重、按 NAI 习惯排序、剥掉画质词、清掉 SD 语法与 MJ 参数。
 * 返回改动说明，方便界面告诉用户「我动了什么」。
 */
export function normalizeNai(positive = '', opts = {}) {
  const engine = opts.engine || 'nai-v4';
  const mixed = opts.format === 'mixed';  // 半自然语言：保留语序、不强求小写
  const stripSet = new Set((opts.stripTags || []).map((t) => String(t).toLowerCase()));
  const notes = [];
  let text = String(positive || '');

  // 清掉别的平台的参数
  const before = text;
  text = text.replace(/--(ar|no|style|v|q|s|chaos|stylize|niji)\b[^,;]*/gi, '');
  if (text !== before) notes.push('去掉了 Midjourney 参数（--ar / --no 等）');

  const parsed = parseTags(text);
  const noHumans = parsed.some((t) => bareTag(t.tag).toLowerCase() === 'no humans');
  const qualitySet2 = new Set(QUALITY_TAGS);
  const seen = new Set();
  const kept = [];
  let sdConverted = 0;
  let lowercased = 0;
  let stripped = 0;
  let countDropped = 0;
  let qualityDropped = 0;

  for (const t of parsed) {
    let tag = t.tag.trim().replace(/\s+/g, ' ').replace(/[.。]$/, '');
    if (!tag) continue;
    // danbooru 是小写约定：全大写/首字母大写的标签在 NAI 里命中率明显更低。
    // 半自然语言不强制小写（短语里的大写是语法的一部分）。
    if (!mixed && !/^[A-Z0-9]{2,5}$/.test(tag) && /[A-Z]/.test(tag)) {
      const lower = tag.toLowerCase();
      if (lower !== tag) { tag = lower; lowercased += 1; }
    }

    const bare = bareTag(tag).toLowerCase();

    // 非人形角色同时写了 4girls：人数标签和 no humans 互斥，人数标签必须让位
    if (noHumans && /^(\d+\+?|multiple)\s*(girls?|boys?)$/.test(bare)) { countDropped += 1; continue; }

    // 画质词不进 positive：用户有单独的画质串，混进来只会重复
    if (qualitySet2.has(bare)) { qualityDropped += 1; continue; }

    // 年龄控制：中年及以下角色身上的皱纹类标签一律删掉（绝对禁用清单）
    if (stripSet.has(bare)) { stripped += 1; continue; }

    if (t.sdSyntax) {
      sdConverted += 1;
      if (engine === 'nai-v3') {
        if (t.weight > 1) tag = `{${tag}}`;
        else if (t.weight < 1) tag = `[${tag}]`;
        else tag = tag;
      } else if (t.weight !== 1) {
        tag = `${t.weight}::${tag}::`;
      }
    } else if (t.weighted && Math.abs(t.weight - 1) > 1e-6) {
      // {tag} / [tag] 这类本来就合法的 NAI 权重：保留，别在整理时丢掉
      tag = w(bareTag(tag), t.weight, engine);
    }

    const key = bareTag(tag).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ tag, rank: rankOf(bareTag(tag)) });
  }
  if (sdConverted) notes.push(`${sdConverted} 处 SD 写法 (tag:1.2) 已转成 NAI 语法`);
  if (lowercased) notes.push(`${lowercased} 个大写标签已转小写（danbooru 约定）`);
  if (qualityDropped) notes.push(`去掉了 ${qualityDropped} 个画质词（masterpiece 等属于画质串，不进 positive）`);
  if (stripped) notes.push(`删掉了 ${stripped} 个会显老的标签（皱纹类）`);
  if (countDropped) notes.push('非人形角色：已删掉与 no humans 冲突的人数标签');

  // 标签流按 danbooru 习惯重排；半自然语言保持原语序（重排会把句子读乱）
  if (!mixed) kept.sort((a, b) => a.rank - b.rank);

  // 画质词已在上面剥掉，这里只按顺序输出本体
  const out = kept.map((k) => k.tag);

  const weighted = out.filter((t) => /^[{[]|::/.test(t)).length;
  if (weighted > 4) notes.push(`${weighted} 个标签带了权重，超过 4 个时强调会互相抵消，建议只留最关键的几个`);

  return { positive: out.join(', '), notes };
}

/**
 * 组装 NAI 的 UC（负向）。五层：基础 ∪ 分级 ∪ 人数 ∪ 年龄 ∪ 物种/镜头。
 * 已有 negative 会保留在开头，只做去重与补全。
 */
export function composeUc(positive = '', negative = '', opts = {}) {
  const scene = opts.scene || readScene(positive);
  const notes = [];
  const out = [];
  const seen = new Set();

  const add = (tag) => {
    const t = String(tag || '').trim();
    if (!t) return;
    const k = bareTag(t).toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  // 0) 用户/模型已有的 negative：先剔掉身份词，再保留
  const userNeg = parseTags(negative).map((t) => t.tag);
  userNeg.forEach((t) => {
    const lower = bareTag(t).toLowerCase();
    if (IDENTITY_TOKENS.includes(lower)) {
      notes.push(`删掉了负向里的「${lower}」——它会把角色一起抹掉`);
      return;
    }
    // 场上就是怪物，再把 monster 压进负向等于要求它别出现
    if (scene.nonhuman && /^(monster|creature|no humans)$/.test(lower)) {
      notes.push(`场上是非人形角色，已从负向移除「${lower}」`);
      return;
    }
    add(t);
  });

  // 1) 基础 UC
  BASE_NEGATIVE.forEach(add);

  // 2) 分级
  RATING[scene.rating].negative.forEach(add);
  if (scene.rating === 'Safe') notes.push('判定为 Safe：已加入 nsfw 类排除词');
  if (scene.rating === 'X') notes.push('判定为 X 级：已加入 censored / mosaic 排除词');

  // 3) 人数一致性
  if (scene.total >= 2) {
    add('solo');
    add('alone');
  } else if (scene.total <= 1) {
    add('duo');
    add('2people');
    add('multiple girls');
  }

  // 4) 年龄：只有出现 mature 类标签才需要抗老化，银发角色必须跳过发色词
  if (scene.ageBucket === 'middle' || scene.ageBucket === 'mature') {
    ['wrinkles', "crow's feet", 'forehead lines', 'nasolabial folds', 'age spots', 'sagging skin', 'saggy breasts', 'old', 'elderly', 'aged']
      .forEach((t) => { if (!(scene.silverHaired && /hair/.test(t))) add(t); });
    notes.push('角色带 mature 类标签：已补抗老化 UC，避免画成老年人');
  }

  // 5) 人数太多时禁掉特写，否则脸必糊
  const total = Math.max(scene.total, 1);
  if (total >= 3) {
    ['closeup', 'upper body', 'portrait'].forEach(add);
    notes.push(`${total} 人场景：已禁掉 closeup / upper body`);
  } else if (total === 2) {
    ['extreme closeup', 'closeup'].forEach(add);
  }

  // 6) 物种分流：全场是人形时才禁 monster
  if (!scene.nonhuman) add('monster');

  // 7) 世界/条目自带的 taboos（中文标签原样保留，NAI 会忽略但不影响别的）
  (opts.taboos || []).forEach(add);

  return { negative: out.join(', '), notes, scene };
}

/**
 * 面向「一句话生成」流程的一站式整理：正规范化 + UC 组装 + 体检。
 */
export function polishNai({ positive = '', negative = '', engine = 'nai-v4', format = 'tags', taboos = [], budget = 9000 } = {}) {
  // 先按原文判断年龄档，再决定要不要删皱纹类标签：顺序反了就删不掉
  const pre = readScene(positive);
  const stripTags = (pre.ageBucket === 'young' || pre.ageBucket === 'mature' || pre.ageBucket === 'middle')
    ? ANTI_AGING_TAGS.filter((t) => !/hair/i.test(t))
    : [];

  const normalized = normalizeNai(positive, { engine, format, stripTags });
  const uc = composeUc(normalized.positive, negative, { engine, taboos });
  const report = lint({
    positive: normalized.positive,
    negative: uc.negative,
    chars: [],
    scene: { problems: [] },
    engine,
    budget,
  });
  return {
    positive: normalized.positive,
    negative: uc.negative,
    notes: [...normalized.notes, ...uc.notes],
    scene: uc.scene,
    report,
  };
}

/* ============================================================
 * 9. 工具
 * ============================================================ */

/**
 * 按顶层逗号切标签（忽略 {} [] () 内部的逗号）。
 * 分号也当分隔符：Scene Composition / Character N Prompt 之间就是用 `;` 连的，
 * 不切开的话跨段检查（人数词、重复标签）全都会失效。
 */
export function splitTopLevel(text = '') {
  const out = [];
  let depth = 0; let buf = '';
  for (const ch of String(text)) {
    if ('{[(('.includes(ch)) depth += 1;
    else if ('}])'.includes(ch)) depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** 把整串按 `;` 切成段（Scene 段 / 各角色段），并去掉 "Character 1 Prompt:" 之类的前缀 */
export function splitSegments(text = '') {
  return String(text)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^[A-Za-z]+(?:\s\d+)?\s*(?:Composition|Prompt)\s*:\s*/i, ''));
}

/** 去掉权重符号后的裸词 */
export function bareTag(tag = '') {
  return String(tag)
    .replace(/^-?\d+(\.\d+)?::/, '')
    .replace(/::$/, '')
    .replace(/^\((.+):\d+(\.\d+)?\)$/, '$1')
    .replace(/^[{[]+/, '')
    .replace(/[}\]]+$/, '')
    .replace(/^\(+|\)+$/g, '')
    .trim();
}

export function dedupeTags(tags = []) {
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    if (!t) continue;
    const key = bareTag(t).toLowerCase().replace(/\s+/g, ' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function findDuplicates(text = '') {
  // 只在「同一段」内查重：不同角色各有一份 "long hair" 是正常的，
  // 同一角色段里 DNA 和当前服装各来一份才是浪费。
  const out = [];
  splitSegments(text).forEach((seg) => {
    const seen = new Map();
    splitTopLevel(seg).forEach((t) => {
      const k = bareTag(t).toLowerCase();
      if (!k) return;
      seen.set(k, (seen.get(k) || 0) + 1);
    });
    seen.forEach((c, k) => { if (c > 1) out.push(`${k}×${c}`); });
  });
  return out;
}

export function countTagTokens(text = '') {
  return splitTopLevel(text).filter(Boolean).length;
}

/** 粗估 token：英文按 4 字符/ token，CJK 按 1 字/ token */
export function estimateTokens(text = '') {
  const s = String(text);
  let cjk = 0;
  for (const ch of s) if (/[\u3400-\u9FFF\uF900-\uFAFF]/.test(ch)) cjk += 1;
  return Math.ceil((s.length - cjk) / 3.6) + cjk;
}

/** 分部位标签配额（world book：脸≥10 发≥7 身材≥8 服装≥10） */
export function quotaReport(positive = '') {
  const total = countTagTokens(positive);
  return {
    total,
    meets50: total >= 50,
    note: total < 20
      ? '标签偏少：角色辨识度会不够，脸/发/身材/服装值得各补几条'
      : total < 50
        ? `目前 ${total} 个标签，社区给新角色的配额是 ≥50`
        : `目前 ${total} 个标签，配额充足`,
  };
}

function tagPresent(haystack, needle) {
  return new RegExp(`(^|[,\\s:([{])${escapeRe(needle)}($|[,\\s:)\\]}])`).test(haystack);
}
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  VERSION,
  w,
  judgeRating,
  compileCharacter,
  compileScene,
  buildNegative,
  mutexFor,
  entryToCharacter,
  lint,
  parseTags,
  readScene,
  normalizeNai,
  composeUc,
  polishNai,
  splitTopLevel,
  splitSegments,
  bareTag,
  dedupeTags,
  findDuplicates,
  countTagTokens,
  estimateTokens,
  quotaReport,
};
