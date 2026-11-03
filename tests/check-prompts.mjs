// 校验各 prompt 构造函数的结构（不联网）。开发期自测。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildMessages,
  buildRefineMessages,
  buildIdeaMessages,
  buildCharacterMessages,
  buildCharacterRefineMessages,
  buildSegmentMessages,
  buildSegmentRefineMessages,
  SEGMENT_LIST,
} from '../src/styles.mjs';
import { DEFAULT_JAILBREAK_PROMPT, withJailbreak } from '../src/jailbreak.mjs';

let bad = 0;
const check = (name, ok, extra = '') => {
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ---------- 角色设定（整段提示词 + 中文对照） ----------
const c = buildCharacterMessages({ sentence: '三个流浪乐手', count: '3', aspect: '16:9' });
const cs = c[0].content;
check('角色设定要 prompt_en 字段', cs.includes('"prompt_en"'));
check('角色设定要 prompt_zh 字段', cs.includes('"prompt_zh"'));
check('角色设定不再要求 characters 表', !cs.includes('"characters"'));
check('角色设定限制标签数 50-80', cs.includes('50-80'));
check('角色设定含画幅硬约束', cs.includes('必须是 16:9'));
check('角色设定含角色数硬约束', cs.includes('正好 3 个'));
check('角色设定要求一整段不换行', cs.includes('不要换行'));
check('角色设定禁止负面词与参数', cs.includes('不要写负面词'));
check('角色设定明确不要画质词', cs.includes('不要写画质词'));
check('角色设定的用户消息含原句', c[1].content.includes('三个流浪乐手'));
check('角色设定含附加要求位', buildCharacterMessages({ sentence: 'x', extra: '全女性' })[1].content.includes('全女性'));
check('画幅 auto 时不给硬约束', !buildCharacterMessages({ sentence: 'x' })[0].content.includes('必须是'));

const charRich = buildCharacterMessages({
  sentence: 'x', detail: 'rich', targetModel: 'NovelAI V4.5',
});
check('角色设定详细程度映射到标签数', charRich[0].content.includes('80-120'));
check('角色设定带 NAI 目标模型约束',
  charRich[0].content.includes('NovelAI V4.5') && charRich[0].content.includes('NAI V4'));
check('角色设定要求人数标签', charRich[0].content.includes('2girls') && charRich[0].content.includes('trio'));
check('角色设定要求服装带颜色', charRich[0].content.includes('每件都必须带颜色'));
check('角色设定禁止非人形用 1girl', charRich[0].content.includes('no humans'));
const charRefShort = buildCharacterRefineMessages({
  previous: { prompt_en: 'a cat' }, instruction: '更写实', detail: 'short',
});
check('角色微调也带标签数与 NAI 约束',
  charRefShort[0].content.includes('30-50') && charRefShort[0].content.includes('人数标签必须和实际角色数一致'));

const naiV5 = buildMessages({ sentence: '银发少女', targetModel: 'NovelAI V5' });
check('目标模型模糊匹配 NAI V5 → 按 V4 处理',
  naiV5[0].content.includes('NAI V4 / V4.5') && naiV5[0].content.includes('danbooru'));

const naiV3 = buildMessages({ sentence: '银发少女', targetModel: 'NovelAI V3' });
check('NAI V3 明确禁用精确权重与负权重',
  naiV3[0].content.includes('NAI V3')
    && naiV3[0].content.includes('不要写 1.3::tag::'));

const plainGen = buildMessages({ sentence: '猫' });
check('不传 targetModel 时默认按 NAI V4.5',
  plainGen[0].content.includes('NovelAI V4.5'));
check('正向提示词要求英文小写标签',
  plainGen[0].content.includes('全小写') && plainGen[0].content.includes('danbooru'));
check('负向提示词禁止身份词',
  plainGen[0].content.includes('绝对禁止**在 negative 里出现身份词'));

const mixedGen = buildMessages({ sentence: '银发少女', format: 'mixed' });
check('半自然语言：要求描述性短语而不是原子标签',
  mixedGen[0].content.includes('半自然语言') && mixedGen[0].content.includes('描述性短语'));
check('半自然语言：同样明确不要画质词',
  mixedGen[0].content.includes('不要写画质词'));
check('半自然语言：权重与 UC 规则仍然跟着走',
  mixedGen[0].content.includes('## 权重语法') && mixedGen[0].content.includes('## negative（UC）怎么写'));
check('标签流没有半自然语言段落',
  !buildMessages({ sentence: 'x' })[0].content.includes('半自然语言'));

const mixedChar = buildCharacterMessages({ sentence: '三个乐手', format: 'mixed' });
check('角色设定的半自然语言分支',
  mixedChar[0].content.includes('半自然语言的描述性短语')
    && mixedChar[0].content.includes('不是原子标签'));
check('半自然语言角色设定按短语数给长度',
  buildCharacterMessages({ sentence: 'x', format: 'mixed', detail: 'rich' })[0].content.includes('32-48'));
check('标签流角色设定仍按标签数给长度',
  buildCharacterMessages({ sentence: 'x', detail: 'rich' })[0].content.includes('80-120'));

const zhGen = buildMessages({ sentence: '猫', language: 'zh' });
check('提示词语言不再影响 output（NAI 恒英文）',
  zhGen[0].content.includes('必须是英文小写标签'));

// ---------- 细分标签（只生成一个维度的 tag） ----------
const seg = buildSegmentMessages({
  sentence: '银发吸血鬼少女',
  segmentType: 'character',
  detail: 'rich',
  targetModel: 'NovelAI',
  extra: '不要配饰',
});
const segSys = seg[0].content;
check('细分标签要 tags 字段', segSys.includes('"tags"'));
check('细分标签只要当前维度', segSys.includes('本次只写：人物形象') && segSys.includes('不写衣服'));
check('细分标签禁止混入其它维度', segSys.includes('只写「人物形象」这一个维度'));
check('细分标签要求逗号分隔', segSys.includes('逗号加空格分隔'));
check('细分标签 rich 数量 20-32', segSys.includes('20-32'));
check('细分标签带目标模型约束', segSys.includes('NovelAI'));
check('细分标签用户消息含原句与附加要求',
  seg[1].content.includes('银发吸血鬼少女') && seg[1].content.includes('不要配饰'));
check('细分标签 7 种类型都能构造',
  SEGMENT_LIST.length === 7 && SEGMENT_LIST.every((t) => buildSegmentMessages({
    sentence: 'x', segmentType: t.id,
  })[0].content.includes(t.label)));
check('细分标签要求 danbooru 原子短语',
  buildSegmentMessages({ sentence: 'x' })[0].content.includes('danbooru 原子短语'));

// ---------- 细分标签的微调 ----------
const segRef = buildSegmentRefineMessages({
  previous: { tags: 'black lace dress, silver buckles', translation: '黑色蕾丝长裙' },
  instruction: '更华丽',
  segmentType: 'outfit',
  targetModel: 'SDXL',
});
const segRefSys = segRef[0].content;
check('细分微调要 tags 字段', segRefSys.includes('"tags"'));
check('细分微调要求未提到的 tag 逐字保留', segRefSys.includes('逐字'));
check('细分微调锁定当前维度', segRefSys.includes('本次维度：服饰穿搭'));
check('细分微调把非 NAI 目标归一成 NAI', segRefSys.includes('NovelAI V4.5'));
check('细分微调的用户消息含原标签与要求',
  segRef[1].content.includes('black lace dress') && segRef[1].content.includes('更华丽'));
check('细分微调要求 danbooru 短语并保留顺序',
  buildSegmentRefineMessages({
    previous: { tags: 'a' }, instruction: 'b',
  })[0].content.includes('danbooru 短语'));

// ---------- 任务 system 自带 JSON 锁；不再有任何「追加层」 ----------
const gens = [
  ['generate', buildMessages({ sentence: '猫', style: 'sd' })],
  ['refine', buildRefineMessages({ previous: { positive: 'a' }, instruction: 'b' })],
  ['characters', c],
  ['idea', buildIdeaMessages({})],
  ['segment', buildSegmentMessages({ sentence: '银发少女', segmentType: 'outfit' })],
  ['segmentRefine', buildSegmentRefineMessages({ previous: { tags: 'a' }, instruction: 'b' })],
];
for (const [name, msgs] of gens) {
  const sys = msgs[0].content;
  check(`${name} 的 system 明确要求 JSON 输出`, sys.includes('JSON'));
  check(`${name} 只有 system + user 两条消息`, msgs.length === 2 && msgs[1].role === 'user');
  check(`${name} 不再拼「追加指令」段`, !sys.includes('追加指令'));
}

// ---------- 破限词：独立置顶 system ----------
const taskOnly = buildMessages({ sentence: '猫' });
const jabTask = withJailbreak(taskOnly, { on: true, text: '' });
check('破限词成为第一条 system，任务规则退到第二条',
  jabTask.length === taskOnly.length + 1
  && jabTask[0].role === 'system'
  && jabTask[0].content === DEFAULT_JAILBREAK_PROMPT
  && jabTask[1].content === taskOnly[0].content);
check('留空回落内置默认（不是关闭）',
  withJailbreak(taskOnly, { on: true, text: '   ' })[0].content === DEFAULT_JAILBREAK_PROMPT);
check('自定义正文优先于内置默认',
  withJailbreak(taskOnly, { on: true, text: '  我的破限词  ' })[0].content === '我的破限词');
check('关闭破限词时消息一条不多',
  withJailbreak(taskOnly, { on: false, text: 'x' }).length === taskOnly.length
  && withJailbreak(taskOnly, { on: false, text: '' })[0].content === taskOnly[0].content);
check('破限词只置顶一次（幂等入口）',
  withJailbreak(withJailbreak(taskOnly, { on: true, text: 'JB' }), { on: true, text: 'JB' }).length === taskOnly.length + 1);
check('旧破限层已彻底不再注入',
  !JSON.stringify(jabTask).includes('unrestricted:execution-mode')
  && !JSON.stringify(jabTask).includes('Unrestricted local execution mode'));

// ---------- 规则包已整体下线 ----------
const stylesSrc = fs.readFileSync(path.join(ROOT, 'src/styles.mjs'), 'utf8');
check('规则包拼装入口已从 styles.mjs 移除',
  !/composeRulePacks|composeSystemLayers|applyApiPinned|applyCustomRules/.test(stylesSrc));
check('任务 system 里不会出现「规则包」字样',
  !JSON.stringify(gens.map(([, m]) => m)).includes('规则包'));

// ---------- 其余 builder 仍正常 ----------
check('generate 两种消息', buildMessages({ sentence: '猫' }).length === 2);
check('refine 把原提示词带进 user',
  buildRefineMessages({ previous: { positive: 'a cat' }, instruction: '改成竖构图', style: 'sd' })[1].content.includes('a cat'));
check('idea 用户消息默认文案', buildIdeaMessages({})[1].content === '请输出 6 条。');
check('idea 会带上避重清单', buildIdeaMessages({ avoid: ['句子A'] })[1].content.includes('句子A'));

console.log('');
console.log(bad === 0 ? '全部通过 ✓' : `${bad} 项失败 ✗`);
process.exit(bad === 0 ? 0 : 1);
