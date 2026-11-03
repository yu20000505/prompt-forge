/**
 * check-promptstate.mjs — 状态化提示词编译器的自检
 * 跑法：node tests/check-promptstate.mjs
 * 退出码非 0 即失败；同时打印一份实际编译结果，方便肉眼核对。
 */
import {
  w, judgeRating, compileScene, buildNegative, lint, entryToCharacter,
  bareTag, dedupeTags, splitTopLevel, estimateTokens,
} from '../src/promptstate.mjs';

let failed = 0;
const ok = (cond, msg) => {
  if (!cond) { failed += 1; console.error(`  ✗ ${msg}`); } else { console.log(`  ✓ ${msg}`); }
};

console.log('\n[w() 权重语法]');
ok(w('red hair', 1) === 'red hair', '权重 1 不加符号');
ok(w('red hair', 1.1, 'nai-v4') === '{{red hair}}', 'NAI 1.1 → 双层花括号');
ok(w('mature', 0.95, 'nai-v4') === '[mature]', 'NAI 0.95 → 方括号弱化');
ok(w('blonde hair', -1.5, 'nai-v4') === '-1.5::blonde hair::', 'NAI v4 负权重写法');
ok(w('blonde hair', -1.5, 'nai-v3') === '[blonde hair]', 'NAI v3 不支持负权重时降级为弱化');
ok(w('soft light', 1.3, 'sd') === '(soft light:1.3)', 'SD 精确权重');
ok(w('soft light', 1.3, 'plain') === 'soft light', '自然语言模型不加任何符号');

console.log('\n[bareTag / splitTopLevel]');
ok(bareTag('{{red hair}}') === 'red hair', '剥掉花括号');
ok(bareTag('-1.5::blonde hair::') === 'blonde hair', '剥掉负权重');
ok(bareTag('(soft light:1.3)') === 'soft light', '剥掉 SD 权重');
ok(splitTopLevel('a, {b, c}, d').length === 3, '括号内逗号不切分');
ok(dedupeTags(['red hair', '{{red hair}}', 'blue eyes']).length === 2, '同一标签加不同权重算重复');

console.log('\n[judgeRating 分级]');
ok(judgeRating({ outfit: { status: 'Intact', dressLevel: 'fully dressed' } }).level === 'Safe', '穿好衣服 = Safe');
ok(judgeRating({ outfit: { dressLevel: 'underwear only' } }).level === 'R', '只剩内衣 = R');
ok(judgeRating({ outfit: { status: 'Naked' } }).level === 'R', '全裸 = R');
ok(judgeRating({ mutable: { sex: { active: true } } }).level === 'X', '性行为 = X');
ok(judgeRating({ outfit: { dressLevel: 'fully dressed' }, mutable: { bondage: { active: true, plug: true } } }).level === 'X', '私处插入物 = X');

/* ---------- 一套两人场景：人形女性 + 非人形生物 ---------- */
const chars = [
  {
    name: 'Lin',
    gender: 'female',
    kind: 'human',
    species: 'human',
    age: { bucket: 'young' },
    dna: {
      build: 'slender', height: 'average height', skin: 'fair skin',
      faceShape: 'heart-shaped face', cheeks: 'soft cheeks', chin: 'pointed chin',
      eyeSize: 'big eyes', eyeShape: 'almond eyes', eyeColor: 'green eyes',
      lashes: 'long eyelashes', lips: 'full lips', lipColor: 'pink lips', nose: 'small nose',
      hairColor: 'red hair', hairColorSub: 'orange hair', hairLength: 'long hair',
      hairStyle: 'wavy hair', bangs: 'side bangs', hairTexture: 'silky hair',
      chest: 'medium breasts', chestShape: 'perky breasts', waist: 'slim waist',
      hips: 'wide hips', thighs: 'thick thighs',
      ears: 'fox ears', tail: 'fox tail',
    },
    outfit: {
      status: 'Damaged', dressLevel: 'fully dressed', mainColor: 'white',
      top: { type: 'blouse', color: 'white', damage: 60, damageParts: ['chest'], wet: 70, wetType: 'water' },
      bottom: { type: 'skirt', color: 'black', damage: 10 },
      bra: { type: 'lace bra', color: 'white' },
      panties: { type: 'panties', color: 'white', wet: 30, wetType: 'love_juice' },
      socks: { type: 'thighhighs', color: 'black' },
      shoes: { type: 'boots', color: 'brown', damage: 0 },
    },
    expression: { eyes: 'gentle eyes', mouth: 'parted lips', overall: 'flushed' },
    mutable: {
      fluids: [
        { part: 'cheek', type: 'cum', amount: 'moderate', state: 'fresh' },
        { part: 'inner thigh', type: 'love_juice', amount: 'dripping', state: 'fresh' },
      ],
      marks: [{ type: 'hickey', part: 'neck', fresh: true, severity: 'normal' }],
      pose: { base: 'kneeling', head: 'head tilted', gaze: 'looking at viewer' },
    },
  },
  {
    name: 'Ash',
    gender: 'none',
    kind: 'nonhuman',
    species: 'dragon',
    age: { bucket: 'young' },
    dna: { build: 'huge', skin: 'scales', eyeColor: 'yellow eyes' },
    outfit: {},
    mutable: { pose: { base: 'looming' } },
  },
];

console.log('\n[compileScene 两人场景]');
const out = compileScene({
  chars,
  scene: { shot: 'cowboy shot', light: 'dramatic backlight, blue rim light', location: 'ruined stone hall', mood: 'tense' },
  engine: 'nai-v4',
  style: 'nai',
});

console.log('\n--- 正向 ---\n' + out.positive);
console.log('\n--- 负向 ---\n' + out.negative);
console.log('\n--- 统计 ---\n' + JSON.stringify(out.stats, null, 2));

ok(out.positive.startsWith('Scene Composition:'), 'Scene 段在最前');
ok(/Character 1 Prompt:/.test(out.positive) && /Character 2 Prompt:/.test(out.positive), '两个角色段都在');
ok(!out.positive.includes('1.8::Lin::'), '自创角色名默认不进提示词（只制造噪音）');

const named = compileScene({
  chars: [{ name: 'Hatsune Miku', gender: 'female', dna: { hairColor: 'teal hair' } }],
  scene: { shot: 'upper body', nameWeight: 1.5 },
  engine: 'nai-v4',
});
ok(named.positive.includes('1.5::Hatsune Miku::'), '已知 IP 角色可以显式开 nameWeight');
ok(out.positive.includes('1girl'), '人形女性用 1girl');
ok(/no humans/.test(out.positive) && /dragon/.test(out.positive), '非人形生物用 no humans + 物种名');
ok(out.positive.includes('{{medium breasts}}'), '胸部走双括号强调');
ok(!/best quality|masterpiece/.test(out.positive), '没有全局质量词');
ok(/\bduo\b/.test(out.positive), '两人场景带 duo');
ok(!/\bsolo\b/.test(out.positive), '两人场景没有 solo');
ok(out.negative.includes('solo'), '多人时把 solo 放进负向');
ok(/-1\.5::/.test(out.positive), '角色段存在负权重互斥');
ok(out.positive.includes('fox ears') && /-1\.5::fox ears::/.test(out.positive) === false, '自己的兽耳不会被自己屏蔽');
ok(out.negative.includes('monster') === false, '非人形生物在场时没有把 monster 压进负向');
ok(out.problems.length === 0, `景别合法（problems=${JSON.stringify(out.problems)}）`);

console.log('\n[lint 体检：故意做一份坏提示词]');
const bad = lint({
  positive: 'Scene Composition: masterpiece, solo, {duo}, 2people, {{red hair}}, {{red hair}}; Character 1 Prompt: 1girl, {(blouse:1.5)}, wrinkles, {{mature female}}',
  negative: 'lowres, 1girl, male, worst quality',
  chars: [{ name: 'Lin', age: { bucket: 'young' }, dna: { hairColor: 'red hair' }, outfit: { top: { type: 'blouse' } } }],
  engine: 'nai-v4',
});
bad.issues.forEach((i) => console.log(`  [${i.level}] ${i.code}: ${i.msg}`));
ok(bad.issues.some((i) => i.code === 'uc-identity'), '抓到负向里的身份词');
ok(bad.issues.some((i) => i.code === 'count-tag'), '抓到单人多人数词冲突');
ok(bad.issues.some((i) => i.code === 'dup'), '抓到重复标签');
ok(bad.issues.some((i) => i.code === 'age'), '抓到年龄矛盾');
ok(bad.issues.some((i) => i.code === 'garment-color'), '抓到服装缺颜色');
ok(bad.issues.some((i) => i.code === 'engine-sd-syntax'), '抓到 SD 语法混进 NAI');
ok(bad.ok === false, '有 error 时 ok=false');

const shotBad = lint({
  positive: 'Scene Composition: extreme closeup, duo, 2people; Character 1 Prompt: 1girl; Character 2 Prompt: 1boy',
  negative: 'lowres',
  chars: [{ name: 'A' }, { name: 'B' }],
  engine: 'nai-v4',
});
shotBad.issues.forEach((i) => console.log(`  [${i.level}] ${i.code}: ${i.msg}`));
ok(shotBad.issues.some((i) => i.code === 'shot'), '抓到景别与人数冲突');

console.log('\n[entryToCharacter 把设定集条目接进来]');
const entry = {
  id: 'entry-1',
  category: 'character',
  name: '沈照雪',
  summary: '银发刀客，左眼有旧伤，浑身是常年雪原的气味',
  visualAnchors: 'silver hair, sharp grey eyes, 灰白长袍, lean build, 断水刀',
  taboos: '现代服装, 笑容',
};
const mapped = entryToCharacter(entry);
console.log('  dna =', JSON.stringify(mapped.character.dna));
console.log('  outfit =', JSON.stringify(mapped.character.outfit));
console.log('  未归类锚点 =', JSON.stringify(mapped.unmapped));
ok(mapped.character.dna.hairColor === 'silver hair', '发色锚点落进 hairColor');
ok(mapped.character.dna.eyeColor === 'sharp grey eyes', '瞳色锚点落进 eyeColor');
ok(mapped.character.outfit.dress?.type?.includes('长袍'), '服装锚点落进 outfit.dress');
ok(mapped.character.taboos.length === 2, 'taboos 直接成为负向候选');
ok(mapped.unmapped.includes('断水刀'), '认不出的锚点原样返回，不瞎猜');
ok(mapped.needsTranslation.includes('灰白长袍'), '中文锚点被标成待翻译（NAI 只吃英文）');
ok(mapped.character.outfit.dress.color === '灰白', '颜色能从中文锚点里抠出来');

const mappedCompile = compileScene({ chars: [mapped.character], scene: { shot: 'upper body' }, engine: 'nai-v4' });
ok(mappedCompile.negative.includes('现代服装') && mappedCompile.negative.includes('笑容'), '条目 taboos 自动进负向');
ok(mappedCompile.positive.includes('silver hair'), '编译产物带上条目锚点');
console.log('\n--- 条目编译结果 ---\n' + mappedCompile.positive);

console.log('\n[lint 干净提示词]');
const clean = lint({
  positive: out.positive,
  negative: out.negative,
  chars,
  scene: { problems: out.problems },
  engine: 'nai-v4',
});
clean.issues.forEach((i) => console.log(`  [${i.level}] ${i.code}: ${i.msg}`));
ok(clean.ok, '编译产物本身没有 error');

console.log('\n[token 估算]');
ok(estimateTokens('a'.repeat(360)) === 100, '360 个英文字符 ≈ 100 tokens');
ok(estimateTokens('中文') === 2, 'CJK 按 1 字 1 token');

console.log(failed ? `\n✗ ${failed} 项失败` : '\n✓ 全部通过');
process.exit(failed ? 1 : 0);
