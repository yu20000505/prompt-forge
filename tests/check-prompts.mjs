// 校验四个 prompt 构造函数的结构（不联网）。开发期自测。
import {
  buildMessages,
  buildRefineMessages,
  buildIdeaMessages,
  buildCharacterMessages,
  buildSegmentMessages,
  buildSegmentRefineMessages,
  SEGMENT_LIST,
} from '../src/styles.mjs';

let bad = 0;
const check = (name, ok, extra = '') => {
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const PIN = 'PIN-MARKER-42';

// ---------- 角色设定（整段提示词 + 中文对照） ----------
const c = buildCharacterMessages({ sentence: '三个流浪乐手', count: '3', aspect: '16:9', apiPinned: PIN });
const cs = c[0].content;
check('角色设定要 prompt_en 字段', cs.includes('"prompt_en"'));
check('角色设定要 prompt_zh 字段', cs.includes('"prompt_zh"'));
check('角色设定不再要求 characters 表', !cs.includes('"characters"'));
check('角色设定限制 120-200 词', cs.includes('120-200'));
check('角色设定含画幅硬约束', cs.includes('必须是 16:9'));
check('角色设定含角色数硬约束', cs.includes('正好 3 个'));
check('角色设定要求一整段不换行', cs.includes('不要换行'));
check('角色设定禁止负面词与参数', cs.includes('不要写负面词'));
check('角色设定仍要求带画质词', cs.includes('cinematic lighting'));
check('角色设定的用户消息含原句', c[1].content.includes('三个流浪乐手'));
check('角色设定含附加要求位', buildCharacterMessages({ sentence: 'x', extra: '全女性' })[1].content.includes('全女性'));
check('画幅 auto 时不给硬约束', !buildCharacterMessages({ sentence: 'x' })[0].content.includes('必须是'));

// ---------- 细分标签（只生成一个维度的 tag） ----------
const seg = buildSegmentMessages({
  sentence: '银发吸血鬼少女',
  segmentType: 'character',
  detail: 'rich',
  targetModel: 'NovelAI V4',
  extra: '不要配饰',
  apiPinned: PIN,
});
const segSys = seg[0].content;
check('细分标签要 tags 字段', segSys.includes('"tags"'));
check('细分标签只要当前维度', segSys.includes('本次只写：人物形象') && segSys.includes('不写衣服'));
check('细分标签禁止混入其它维度', segSys.includes('只写「人物形象」这一个维度'));
check('细分标签要求逗号分隔', segSys.includes('逗号加空格分隔'));
check('细分标签 rich 数量 20-32', segSys.includes('20-32'));
check('细分标签带目标模型约束', segSys.includes('NovelAI V4'));
check('细分标签用户消息含原句与附加要求',
  seg[1].content.includes('银发吸血鬼少女') && seg[1].content.includes('不要配饰'));
check('细分标签 7 种类型都能构造',
  SEGMENT_LIST.length === 7 && SEGMENT_LIST.every((t) => buildSegmentMessages({
    sentence: 'x', segmentType: t.id,
  })[0].content.includes(t.label)));

// ---------- 细分标签的微调 ----------
const segRef = buildSegmentRefineMessages({
  previous: { tags: 'black lace dress, silver buckles', translation: '黑色蕾丝长裙' },
  instruction: '更华丽',
  segmentType: 'outfit',
  targetModel: 'SDXL',
  apiPinned: PIN,
});
const segRefSys = segRef[0].content;
check('细分微调要 tags 字段', segRefSys.includes('"tags"'));
check('细分微调要求未提到的 tag 逐字保留', segRefSys.includes('逐字'));
check('细分微调锁定当前维度', segRefSys.includes('本次维度：服饰穿搭'));
check('细分微调带目标模型', segRefSys.includes('SDXL'));
check('细分微调的用户消息含原标签与要求',
  segRef[1].content.includes('black lace dress') && segRef[1].content.includes('更华丽'));

// ---------- 置顶提示词注入 ----------
const gens = [
  ['generate', buildMessages({ sentence: '猫', style: 'sd', apiPinned: PIN })],
  ['refine', buildRefineMessages({ previous: { positive: 'a' }, instruction: 'b', apiPinned: PIN })],
  ['characters', c],
  ['idea', buildIdeaMessages({ apiPinned: PIN })],
  ['segment', buildSegmentMessages({ sentence: '银发少女', segmentType: 'outfit', apiPinned: PIN })],
  ['segmentRefine', buildSegmentRefineMessages({ previous: { tags: 'a' }, instruction: 'b', apiPinned: PIN })],
];
for (const [name, msgs] of gens) {
  const sys = msgs[0].content;
  check(`${name} 注入置顶并在最前`, sys.startsWith('# 用户自定义置顶要求') && sys.includes(PIN));
  check(`${name} 有 JSON 格式保护`, sys.includes('输出格式仍必须是下面约定的 JSON'));
  check(`${name} 末尾有最高优先级的格式确认`,
    sys.trimEnd().endsWith('不要用 markdown 代码块包裹。'), '');
}
check('填空时不注入置顶',
  !buildMessages({ sentence: '猫' })[0].content.includes('用户自定义置顶要求'));

// ---------- 其余 builder 仍正常 ----------
check('generate 两种消息', buildMessages({ sentence: '猫' }).length === 2);
check('refine 把原提示词带进 user',
  buildRefineMessages({ previous: { positive: 'a cat' }, instruction: '改成竖构图', style: 'sd' })[1].content.includes('a cat'));
check('idea 用户消息默认文案', buildIdeaMessages({})[1].content === '请输出 6 条。');
check('idea 会带上避重清单', buildIdeaMessages({ avoid: ['句子A'] })[1].content.includes('句子A'));

console.log('');
console.log(bad === 0 ? '全部通过 ✓' : `${bad} 项失败 ✗`);
process.exit(bad === 0 ? 0 : 1);
