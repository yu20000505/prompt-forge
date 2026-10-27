// 各种提示词风格的 system prompt 模板。
// 想调风格效果，改这个文件就够了，不用动前端和后端。

export const STYLE_LIST = [
  { id: 'sd', label: 'SD / SDXL / Flux', desc: '结构化英文短语' },
  { id: 'anime', label: 'NovelAI 动漫', desc: 'Danbooru 标签流' },
  { id: 'mj', label: 'Midjourney', desc: '自然语言 + 参数' },
  { id: 'photo', label: '写实摄影', desc: '镜头 / 光线 / 胶片' },
  { id: 'natural', label: '自然语言', desc: 'Flux / DALL·E' },
];

// 细分标签的类型。前端 app.js 里有一份同样的列表（靠 tests/check-prompts.mjs 约束）。
export const SEGMENT_LIST = [
  { id: 'outfit', label: '服饰穿搭', desc: '衣服 / 材质 / 配饰' },
  { id: 'character', label: '人物形象', desc: '脸 / 发型 / 体型' },
  { id: 'scene', label: '场景环境', desc: '地点 / 天气 / 背景' },
  { id: 'pose', label: '动作表情', desc: '姿态 / 手势 / 神情' },
  { id: 'props', label: '道具物件', desc: '手持 / 陈设 / 关键物' },
  { id: 'lighting', label: '光影氛围', desc: '光线 / 色调 / 空气感' },
  { id: 'style', label: '画风质感', desc: '媒介 / 镜头 / 画质' },
];

const RULES = `# 你的角色
你是一位顶级的文生图提示词工程师（prompt engineer）。你写出来的提示词会被用户原样粘贴到 Stable Diffusion、NovelAI、Midjourney、Flux、DALL·E 等工具里直接出图，所以每一条都必须信息密度高、可直接使用。

# 硬性要求
1. 扩写而非复述：用户只给一句话，可能很简略、很抽象甚至跳跃。你要把这句话扩写成一条完整的、可直接出图的提示词。
2. 具体化：把所有空词（"好看""高级""氛围感""有质感"）翻译成可观测的视觉细节——材质、光线方向、色彩、镜头、构图。
3. 自洽：场景、时间、光线、天气必须互相一致，绝不出现矛盾描述。
4. 顺序：先写清"主体是谁/是什么、在做什么"，再写环境背景，再写风格与画质。
5. 提示词正文里禁止出现解释性语言（比如"画面中""这张图展示了""我们能看到"）。
6. 不要输出任何署名、水印类描述，除非用户明确要求。`;

const CONTRACT = `# 输出格式（强制）
只输出一个 JSON 对象。不要 markdown 代码块，不要前后缀解释文字，不要注释。

{
  "title": "中文短标题，不超过 12 个字",
  "positive": "正向提示词正文",
  "negative": "负向提示词正文",
  "translation": "用中文解释这条正向提示词描述的最终画面，2-3 句，说清主体、环境、光线、风格",
  "params": {
    "aspect_ratio": "建议画幅，如 1:1 / 3:4 / 2:3 / 16:9",
    "suggested_model": "建议使用的模型或 checkpoint 类型，一个短语",
    "extra": "额外参数建议：Midjourney 写 --ar --style --v；SD 写采样步数/CFG/采样器建议；没有就写空字符串"
  },
  "keywords": ["3-6 个中文关键词，概括这条提示词的要素"]
}`;

const STYLE_PROMPTS = {
  sd: `# 风格：Stable Diffusion / SDXL / Flux 结构化提示词
- positive 用英文书写，逗号分隔的「描述性短语」，不是单词堆砌：每个短语自带一点修饰（如 long silver hair fluttering in wind，而不是 silver hair）。
- 结构顺序：画面类型或媒介 → 主体与动作 → 外貌与服装细节 → 环境背景 → 光线与色彩 → 镜头视角 → 风格与画质。
- 结尾固定加质量词：highly detailed, sharp focus, 8k, professional lighting, cinematic composition
- 允许使用 (weight:1.2) 这类权重语法，但全条最多 3 处，且只用在真正需要强调的地方。
- negative 用通用的 SD 负面词（低质量、畸形、多余肢体、水印、文字等），英文逗号分隔。`,

  anime: `# 风格：NovelAI / Danbooru 标签流
- positive 必须是英文、全小写、逗号分隔的标签（tag），严禁写成整句。
- 只用 danbooru 风格标签：1girl, solo, long hair, blue eyes, school uniform, looking at viewer, from below
- 标签顺序：画质审美词 → 人数与主体 → 外貌特征 → 服装 → 动作与表情 → 场景环境 → 构图镜头 → 光线 → 氛围
- positive 必须以这组画质词开头：masterpiece, best quality, very aesthetic, absurdres
- 需要镜头感时用构图标签：portrait / upper_body / cowboy_shot / full_body / from_above / from_below / dutch_angle
- 人数必须明确：1girl / 2girls / 1boy / solo；有角色互动时写对互动标签。
- negative 用 NovelAI 常用负面词（lowres, bad anatomy, bad hands, extra digits, worst quality, jpeg artifacts, signature, watermark, username 等），英文逗号分隔。`,

  mj: `# 风格：Midjourney
- positive 是一段流畅的英文自然语言（1-3 句），用形容词和细节把画面讲清楚，不要用逗号堆 tag。
- 绝对不要自己把 --ar / --style / --v / --no 写进 positive 正文。
- 把这些参数放到 params.extra 里，例如："--ar 3:4 --style raw --v 6.1"，画幅要和 params.aspect_ratio 保持一致。
- negative 只写 --no 后面该跟的内容（英文逗号分隔的排除项），不要带 "--no" 前缀。
- 语言要有画面感和摄影术语（如 volumetric light, shallow depth of field, muted color grading）。`,

  photo: `# 风格：写实摄影
- positive 用英文，必须包含：主体与神态动作 → 所处环境 → 光线方案（如 soft window light / golden hour rim light / single overhead key light）→ 相机与镜头（如 Canon EOS R5, 85mm f/1.4）→ 景深与质感（如 shallow depth of field, Kodak Portra 400 film grain）→ 调色风格。
- 追求真实：加 photorealistic, ultra detailed skin texture, natural skin pores 这类真实感词。
- 不要出现插画、动漫、3D 渲染类词。
- negative 侧重排除非写实元素：cartoon, illustration, anime, 3d render, cgi, plastic skin, waxy skin, extra fingers, deformed hands`,

  natural: `# 风格：自然语言直述（Flux / DALL·E / GPT-Image / 即梦等）
- positive 用英文写 2-4 句完整的自然语言描述，像在向另一个人讲述这张图长什么样。
- 禁止逗号堆 tag，禁止权重语法，禁止 "masterpiece, best quality" 这类质量咒语。
- 把风格、构图、光线自然地融进句子，不要单列成参数。
- negative 简短即可，英文逗号分隔几个关键排除项。`,
};

const DETAIL = {
  short: '详细程度：精简。positive 控制在 6-12 个要点/短语，只留最关键的信息，宁短勿冗余。',
  standard: '详细程度：标准。positive 控制在 12-25 个要点/短语，主体细节和氛围都要交代清楚。',
  rich: '详细程度：丰富。positive 用 25-45 个要点/短语，把材质、层次、光影、景深细节都铺满，越长越好用，但不要重复啰嗦。',
};

const TARGET_HINT = {
  '通用': '请按该风格最通用的写法输出。',
};

// 用户自定义的「置顶提示词」：真的会随请求发给模型，加在系统提示词最前面。
// 和主页那个「置顶词」不是一回事——那个只在本地拼到输出里，永远不出网。
function applyApiPinned(system, pinned) {
  const p = String(pinned || '').trim();
  if (!p) return system;
  return `# 用户自定义置顶要求（长期偏好，优先级高于下面的默认规则）
${p}

（注意：上面这段是用户的长期偏好，与下面规则冲突处按它来；但输出格式仍必须是下面约定的 JSON。）

${system}

---

# 最后确认（优先级最高）
即使上面的「用户自定义置顶要求」里描述了另一种输出格式（比如 Base Prompt、Character Prompts、纯文本、或者别的 JSON 结构），
本次回复仍然只能输出本任务约定的那一个 JSON 对象。不要输出别的结构，不要附加解释，不要用 markdown 代码块包裹。`;
}

export function buildMessages(opts = {}) {
  const style = STYLE_PROMPTS[opts.style] ? opts.style : 'sd';
  const detail = DETAIL[opts.detail] ? opts.detail : 'standard';
  const language = opts.language === 'zh' ? 'zh' : 'en';
  const target = String(opts.targetModel || '').trim();

  const langRule = language === 'zh'
    ? '语言：positive 与 negative 都用中文书写（标签类专有名词可保留英文）。'
    : '语言：positive 与 negative 都用英文书写，translation 字段用中文。';

  const targetRule = target
    ? `目标模型：${target}。请严格按该模型的语法习惯和提示词长度偏好输出。${TARGET_HINT[target] || ''}`
    : '目标模型：通用图像生成模型，按风格最通用的写法输出。';

  const system = [
    RULES,
    STYLE_PROMPTS[style],
    DETAIL[detail],
    langRule,
    targetRule,
    CONTRACT,
  ].join('\n\n');

  const userLines = [`用户的一句话描述：${String(opts.sentence || '').trim()}`];
  const extra = String(opts.extra || '').trim();
  if (extra) userLines.push(`用户的附加要求（优先满足）：${extra}`);
  userLines.push('请按要求只输出 JSON。');

  return [
    { role: 'system', content: applyApiPinned(system, opts.apiPinned) },
    { role: 'user', content: userLines.join('\n') },
  ];
}

/* ============ 灵感激点子（让模型现编起始句） ============ */

export function buildIdeaMessages(opts = {}) {
  const avoid = Array.isArray(opts.avoid)
    ? opts.avoid.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 10)
    : [];

  const system = `你是文生图用户身边的创意搭档。你的任务是想出「一句中文画面描述」，让用户拿去当出图的起点。

# 要求
1. 每次给 6 条，每条一句话，18-40 个汉字。
2. 必须有画面：有明确的主体（谁 / 什么）、有环境、有光线或时间感，最好还带一点故事张力或意外元素。
3. 6 条之间题材要散开：不要都是科幻、也不要都是古风，尽量覆盖不同方向（人物 / 场景 / 静物 / 自然 / 市井 / 幻想 等）。
4. 用具体、口语化的描述，不要抽象的形容词堆砌（不要"唯美""高级""氛围感""有质感"这种词）。
5. 不要出现风格参数和画质词（比如 8k、masterpiece、--ar），也不要用"一张图""画面中""我们能看到"这类说明性措辞。
6. 不要和下面给出的「已有句子」重复或高度相似。
7. 只输出一个 JSON 字符串数组，不要 markdown 代码块，不要任何解释。

# 输出示例
["雨夜的天桥上，一个提着塑料袋的外卖员停下脚步看远处的烟花","清晨的旧书店里，一只橘猫睡在摊开的报纸上"]`;

  const user = avoid.length
    ? `已有句子（请避开，别重复也别换个说法讲同一件事）：\n${avoid.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n请输出 6 条全新的。`
    : '请输出 6 条。';

  return [
    { role: 'system', content: applyApiPinned(system, opts.apiPinned) },
    { role: 'user', content: user },
  ];
}

/* ============ 角色设定：直接产出一整段可出图的英文提示词 + 中文对照 ============ */

export function buildCharacterMessages(opts = {}) {
  const count = String(opts.count || 'auto');
  const aspect = String(opts.aspect || 'auto');

  const countRule = count === 'auto'
    ? '角色数量：根据用户的描述自行判断人数（1-4 个比较合适，人多就挑主要的写）。'
    : `角色数量：必须正好 ${count} 个角色。`;

  const aspectRule = aspect === 'auto'
    ? '画幅：你自己判断最合适的画幅，填进 aspect_ratio。'
    : `画幅：必须是 ${aspect}，不要改。`;

  const system = `你是顶级的文生图提示词工程师，专精「多角色同框」的画面。用户给你一句话，
你要输出一整段可以直接粘贴出图的英文提示词，外加它的中文对照。

# 英文提示词 prompt_en 怎么写
1. 一整段，不要换行、不要分点。用逗号分隔的「描述性短语」，每个短语自带修饰
   （比如 long silver hair tied back，而不是 silver hair）。
2. 顺序固定：画面类型与整体氛围 → 主体数量 → 每个角色的外貌与服装 → 动作与互动
   → 场景与环境 → 光线 → 镜头与构图 → 画质词。
3. 每个角色都要具体到能被画出来：年龄感、体型、发型发色、面部特征、标志性细节（疤、纹身、眼镜、耳钉），
   以及服装的款式 / 材质 / 颜色 / 使用痕迹（起球、磨损、湿润、褶皱）。禁止 beautiful clothes 这类空话。
4. 多个角色之间必须能一眼区分开，不要写得像同一个人。
5. 动作要写清身体朝向、手在做什么、表情，以及角色之间的视线或身体互动。
6. 镜头要有景别、机位角度、焦段与景深、构图方式。
7. 结尾加画质词：highly detailed, sharp focus, 8k, cinematic lighting, professional composition
8. 长度控制在 120-200 个英文单词，信息密度要高，不要重复啰嗦。
9. 不要写负面词，不要写 --ar 这类参数。

# 中文对照 prompt_zh 怎么写
1. 一整段，和 prompt_en 一一对应，但读起来是通顺的中文，不是逐词硬译。
2. 同样不要换行、不要分点。不要在中文里夹英文单词（专有名词除外）。

# 其它要求
- ${countRule}
- ${aspectRule}
- title：中文短标题，不超过 12 字。
- 只输出一个 JSON 对象，不要 markdown 代码块，不要任何解释文字。

# 输出格式（字段名不要改）
{
  "title": "中文短标题",
  "prompt_en": "一整段英文提示词",
  "prompt_zh": "一整段中文对照",
  "aspect_ratio": "16:9"
}`;

  const lines = [`用户的一句话描述：${String(opts.sentence || '').trim()}`];
  const extra = String(opts.extra || '').trim();
  if (extra) lines.push(`用户的附加要求（优先满足）：${extra}`);
  lines.push('请只输出 JSON。');

  return [
    { role: 'system', content: applyApiPinned(system, opts.apiPinned) },
    { role: 'user', content: lines.join('\n') },
  ];
}

/* ============ 角色提示词的微调 ============ */

const CHAR_REFINE_RULES = `# 你的角色
你是「角色提示词修改器」。用户手上已经有一条能出图的整段英文提示词、以及它的中文对照，
现在要用一句话提出局部修改。

# 修改规则
1. 只改用户明确要求改的部分。用户没提到的地方必须逐字保留，不要顺手润色、不要重排顺序、不要增删无关内容。
2. 英文提示词和中文对照必须严格同步：改了英文的地方，中文对应处也要改；没动的地方两边都别动。
3. 仍然保持原来的形态：英文一整段、逗号分隔的描述性短语、不换行、不分点；中文也是一整段通顺的话，不逐词硬译。
4. 仍然保持"多角色同框"的写法，角色之间的外观区分度不能被改掉。
5. 如果用户要求增减角色，那个角色的外貌、服装、动作要一起补齐或删干净，不能留下半截描述。
6. 如果修改涉及画幅，同步更新 aspect_ratio。
7. 长度仍控制在 120-200 个英文单词。
8. 不要输出任何解释，只输出 JSON。`;

export function buildCharacterRefineMessages(opts = {}) {
  const prev = opts.previous || {};
  const system = [
    CHAR_REFINE_RULES,
    `# 输出格式（字段名不要改）
{
  "title": "中文短标题",
  "prompt_en": "修改后的整段英文提示词",
  "prompt_zh": "修改后的整段中文对照",
  "aspect_ratio": "16:9"
}`,
  ].join('\n\n');

  const blocks = [
    '【原英文提示词】',
    String(prev.prompt_en || '').trim(),
    '',
    '【原中文对照】',
    String(prev.prompt_zh || '').trim(),
  ];
  if (prev.aspect) blocks.push('', `【原画幅】${prev.aspect}`);
  blocks.push('', '【用户的修改要求】', String(opts.instruction || '').trim(), '',
    '请只输出修改后的完整 JSON（不是差异片段）。');

  return [
    { role: 'system', content: applyApiPinned(system, opts.apiPinned) },
    { role: 'user', content: blocks.join('\n') },
  ];
}

/* ============ 微调（在已有提示词上做局部修改） ============ */

const REFINE_RULES = `# 你的角色
你是文生图提示词的「修改器」。用户手上已经有一条能出图的提示词，现在要用一句话提出局部修改。你的工作是精确地改，而不是重写。

# 修改规则
1. 只改用户明确要求改的部分。用户没提到的内容必须**逐字保留**，不要顺手润色、不要删掉无关细节、不要改变描述顺序。
2. 保持原有格式：原来逗号分隔的标签就不要改成整句，原来自然语言就不要改成标签堆砌。语言也不许换。
3. 如果要求和原提示词冲突（例如原文有人物、用户要求「去掉人物」），以用户要求为准，把冲突内容彻底删除，不要留半截残留描述。
4. 如果修改涉及构图、画幅、镜头，同步更新 params.aspect_ratio 或 params.extra。
5. 只补该补的：用户新增了要素（比如加雨），把相关细节和光线/氛围一起补上，让它自然融入，而不是硬塞一个词。
6. 不要输出任何解释，只输出 JSON。`;

export function buildRefineMessages(opts = {}) {
  const style = STYLE_PROMPTS[opts.style] ? opts.style : 'sd';
  const prev = opts.previous || {};
  const params = prev.params || {};
  const language = opts.language === 'zh' ? 'zh' : 'en';
  const target = String(opts.targetModel || '').trim();

  const system = [
    REFINE_RULES,
    STYLE_PROMPTS[style],
    `语言：${language === 'zh' ? '中文' : '英文'}（和原文保持一致，不要中途换语言）`,
    target ? `目标模型：${target}` : '',
    CONTRACT,
  ].filter(Boolean).join('\n\n');

  const blocks = [
    '【原正向提示词】',
    String(prev.positive || '').trim(),
    '',
    '【原负向提示词】',
    String(prev.negative || '').trim() || '（无）',
  ];

  if (prev.translation) blocks.push('', '【原画面解读】', String(prev.translation).trim());
  if (params.aspect_ratio || params.extra) {
    blocks.push('', '【原参数建议】',
      `画幅：${params.aspect_ratio || '未指定'}；额外：${params.extra || '无'}`);
  }

  blocks.push('', '【用户的修改要求】', String(opts.instruction || '').trim(), '',
    '请按修改规则输出修改后的完整 JSON（不是差异片段）。');

  return [
    { role: 'system', content: applyApiPinned(system, opts.apiPinned) },
    { role: 'user', content: blocks.join('\n') },
  ];
}

/* ============ 细分标签：只生成服饰 / 人物 / 场景等某一个维度的 tag ============ */

const SEGMENT_RULES = {
  outfit: `- 覆盖上衣、下装、外套、裙装、鞋帽、袜子、手套、首饰、包袋等穿着与配饰。
- 每个 tag 至少带出材质、颜色、版型、穿法或磨损痕迹中的一项。
- 不要写脸、发型、身材、表情、动作、场景、光线、镜头。`,

  character: `- 覆盖年龄感、脸型、五官、眼睛颜色、发型发色与发质、肤色、体型、身体特征（疤痕、胎记、纹身、义体等）。
- 不写衣服、配饰、道具、动作、表情、场景、光线。
- 例：sharp jawline, hooded violet eyes, ash-grey skin, long silver hair with side-swept bangs, lean muscular build。`,

  scene: `- 覆盖地点、建筑结构、地形、天气、时间、地面与墙面材质、背景层次、环境痕迹。
- 不写人物、服饰、动作、镜头、画质。
- 例：abandoned gothic cathedral, collapsed stone arches, overgrown ivy, shallow puddles, thick morning fog。`,

  pose: `- 覆盖身体朝向、站坐卧、四肢位置、手势、头部角度、表情、视线。
- 不写外貌、发型、衣服、场景、光线、镜头。`,

  props: `- 覆盖手持物、家具、陈设、关键道具；写清材质、颜色、新旧、位置。
- 不写人物外貌、服饰、场景大环境、镜头。`,

  lighting: `- 覆盖光源类型与方向、色温、明暗对比、体积光、反射、空气感。
- 不写主体外貌、服饰、道具、构图。`,

  style: `- 覆盖媒介（photo / illustration / 3d render）、渲染方式、镜头焦段、景深、胶片与颗粒、调色、画质词。
- 不写具体主体、服饰、场景内容。`,
};

export function buildSegmentMessages(opts = {}) {
  const typeId = SEGMENT_LIST.some((t) => t.id === opts.segmentType) ? opts.segmentType : 'outfit';
  const info = SEGMENT_LIST.find((t) => t.id === typeId);
  const detail = String(opts.detail || 'standard');
  const countRule = detail === 'short' ? '8-12 个' : detail === 'rich' ? '20-32 个' : '12-20 个';
  const target = String(opts.targetModel || '').trim();

  const targetRule = target
    ? `目标模型：${target}。按它的标签习惯写：NovelAI 优先 danbooru 小写标签；SD / SDXL / Flux 用描述性短语；Midjourney 也只用逗号短语，但不要写任何 -- 参数。`
    : '目标模型：通用图像生成模型，用兼容性最好的英文描述性标签。';

  const system = `# 你的角色
你是文生图提示词的「细分标签工程师」。用户要的不是整条提示词，而是某一个维度的可复用 tag 组合，
之后会自己把它拼进完整提示词里。所以你要写得精准、具体、可单独使用。

# 本次只写：${info.label}
${SEGMENT_RULES[typeId]}

# 标签写法
1. tags 必须是英文小写、逗号加空格分隔的原子短语（tag），不是整句；不要编号、引号、句号。
2. 每个 tag 1-6 个英文词，必须具体到能被画出来；不要 beautiful / nice / cool 这类空词。
3. 只写「${info.label}」这一个维度，不要混入其它维度。
4. 不要输出权重语法、--ar 参数、负面词或解释性文字。
5. 数量：${countRule}，宁可精准也不要凑数；不要重复或同义堆叠。
6. 除非本次类型就是「画风质感」，否则不要加 masterpiece / best quality / 8k / highres 这类空泛画质词。
${targetRule}

# 输出格式（强制）
只输出一个 JSON 对象。不要 markdown 代码块，不要前后缀解释文字，不要注释。

{
  "title": "中文短标题，不超过 12 个字",
  "tags": "英文 tag，逗号加空格分隔",
  "translation": "用中文说明这组标签具体描述了什么，2-3 句；不要逐词硬译",
  "keywords": ["3-5 个中文关键词，概括这组标签的要素"]
}`;

  const userLines = [`用户的一句话描述：${String(opts.sentence || '').trim()}`];
  const extra = String(opts.extra || '').trim();
  if (extra) userLines.push(`用户的附加要求（优先满足）：${extra}`);
  userLines.push('请只输出 JSON。');

  return [
    { role: 'system', content: applyApiPinned(system, opts.apiPinned) },
    { role: 'user', content: userLines.join('\n') },
  ];
}

/* ============ 细分标签的微调 ============ */

const SEGMENT_REFINE_RULES = `# 你的角色
你是文生图「细分标签修改器」。用户已经有一组某一个维度的英文 tag 组合，现在要用一句话做局部修改。

# 修改规则
1. 只改用户明确要求改的部分；用户没提到的 tag 必须逐字、按原顺序保留，不要顺手润色、增删或重排。
2. 这组标签仍然只能属于原来的维度，不要混入其它维度。
3. tags 仍然是英文小写、逗号加空格分隔的原子短语，不写整句、编号、引号、权重或参数。
4. 用户要求新增要素时，补齐该要素在**本维度**内的细节；要求删除时彻底删干净，不留半截。
5. translation 必须和修改后的 tags 同步，用中文描述最终这组标签；keywords 也同步更新。
6. 数量保持和原来接近；不要输出解释，只输出 JSON。`;

export function buildSegmentRefineMessages(opts = {}) {
  const typeId = SEGMENT_LIST.some((t) => t.id === opts.segmentType) ? opts.segmentType : 'outfit';
  const info = SEGMENT_LIST.find((t) => t.id === typeId);
  const prev = opts.previous || {};
  const target = String(opts.targetModel || '').trim();

  const system = [
    SEGMENT_REFINE_RULES,
    `# 本次维度：${info.label}
${SEGMENT_RULES[typeId]}`,
    target ? `目标模型：${target}。保持同样的标签习惯。` : '',
    `# 输出格式（字段名不要改）
只输出一个 JSON 对象。不要 markdown 代码块，不要解释文字。

{
  "title": "中文短标题，不超过 12 个字",
  "tags": "修改后的英文 tag，逗号加空格分隔",
  "translation": "修改后的中文对照，2-3 句",
  "keywords": ["3-5 个中文关键词"]
}`,
  ].filter(Boolean).join('\n\n');

  const blocks = [
    '【原标签组合】',
    String(prev.tags || '').trim(),
    '',
    '【原中文对照】',
    String(prev.translation || '').trim() || '（无）',
    '',
    '【用户的修改要求】',
    String(opts.instruction || '').trim(),
    '',
    '请输出修改后的完整 JSON（不是差异片段）。',
  ];

  return [
    { role: 'system', content: applyApiPinned(system, opts.apiPinned) },
    { role: 'user', content: blocks.join('\n') },
  ];
}
