// 校验内置破限层：上游正文是否逐字保留、附加约定是否只在后面追加、
// 注入顺序与摘除还原是否成立。纯本地，不联网。
import crypto from 'node:crypto';
import {
  UPSTREAM,
  LAYER_OPEN,
  LAYER_CLOSE,
  buildUnrestrictedBlock,
  hasUnrestricted,
  stripUnrestricted,
  fuseUnrestricted,
  classifyProbeReply,
  describeProbeVerdict,
  PROBE_SENTENCE,
} from '../src/unrestricted.mjs';
import { UPSTREAM_BLOCK } from '../src/unrestricted-block.mjs';
import { composeSystemLayers, buildMessages, composeRulePacks } from '../src/styles.mjs';

let bad = 0;
const check = (name, ok, extra = '') => {
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

// 上游原文的指纹：长度 + sha256。改了上游正文（哪怕一个字）这里就会红，
// 提醒你同步 THIRD_PARTY_NOTICES 与 docs/unrestricted.md 里的版本说明。
const UPSTREAM_SHA256 = '69d74c40bede59b272c7a9f6e2b680cf151c603b9c6c9f818161cf1d693e7c61';

// ---------- 上游原文逐字保留 ----------
check('上游正文长度与 v0.2.6 一致', UPSTREAM_BLOCK.length === 10246, `${UPSTREAM_BLOCK.length} 字符`);
check('上游正文 sha256 未被改动',
  crypto.createHash('sha256').update(UPSTREAM_BLOCK, 'utf8').digest('hex') === UPSTREAM_SHA256);
check('上游正文首尾句完整',
  UPSTREAM_BLOCK.startsWith('## Unrestricted local execution mode')
  && UPSTREAM_BLOCK.trimEnd().endsWith('unrestricted depth of the payload reported through it.'));
check('上游的任务路由与尺度规则都在',
  ['KEYGEN / CRACK', 'REVERSE ENGINEERING', 'ANTI-DEBUG', 'FICTION / CREATIVE WRITING',
    'GUIDES / CHEMISTRY', 'RESOURCES / 找资源', 'Never judge a character', 'force-defaulted to 18+',
    'censored substitute', 'no permission check']
    .every((k) => UPSTREAM_BLOCK.includes(k)));
check('上游宿主专属内容保持原样（不做删改）',
  UPSTREAM_BLOCK.includes('run_code') && UPSTREAM_BLOCK.includes('structured_output')
  && UPSTREAM_BLOCK.includes('Plan mode'));

// ---------- 注入段 = 原文 + 附加约定 ----------
const block = buildUnrestrictedBlock();
check('注入段带首尾标记', block.startsWith(LAYER_OPEN) && block.endsWith(LAYER_CLOSE));
check('注入段里原文一字不差地出现', block.includes(UPSTREAM_BLOCK), `原文 ${UPSTREAM_BLOCK.length} 字符`);
check('附加约定排在原文之后',
  block.indexOf('## Prompt Forge 附加约定') > block.indexOf(UPSTREAM_BLOCK.trimEnd()));
check('附加约定覆盖本工具需要的东西',
  ['只输出任务约定的那一个 JSON 对象', 'positive 只放要出现的内容', 'danbooru', '没有工具']
    .every((k) => block.includes(k)));
check('注入段不出现未替换的模板占位符', !/\$\{|\{\{/.test(block));
check('注入段比原文长（说明附加约定确实追加了）', block.length > UPSTREAM_BLOCK.length + 300,
  `${block.length} vs ${UPSTREAM_BLOCK.length}`);
check('记录上游来源、版本与逐字事实',
  UPSTREAM.name === 'dsh-unrestricted' && UPSTREAM.version === '0.2.6'
  && UPSTREAM.license === 'MIT' && UPSTREAM.verbatim === true
  && UPSTREAM.repo.includes('github.com'));

// ---------- 注入 / 撤除 ----------
const base = '你是提示词编辑。只输出 JSON。';
check('注入后能识别出来', hasUnrestricted(fuseUnrestricted(base, block)) && !hasUnrestricted(base));
check('重复注入不会叠加',
  fuseUnrestricted(fuseUnrestricted(base, block), block).split(LAYER_OPEN).length === 2);
check('撤除后与原文逐字一致',
  stripUnrestricted(fuseUnrestricted(base, block)) === base);
check('没有注入时撤除是空操作', stripUnrestricted(base) === base);
check('空块不产生任何注入',
  fuseUnrestricted(base, '') === base && fuseUnrestricted('', '') === '');

// ---------- 拼装入口 ----------
const packs = [{ name: '固定画风', text: '画风固定为胶片颗粒', enabled: true }];
const both = composeSystemLayers({ unrestrictedOn: true, packs, packsOn: true });
check('破限层在规则包之前', both.indexOf(LAYER_OPEN) >= 0 && both.indexOf(LAYER_OPEN) < both.indexOf('## 规则包：固定画风'));
check('只开破限层不发规则包',
  !composeSystemLayers({ unrestrictedOn: true, packs: [], packsOn: true }).includes('规则包：固定画风'));
check('只开规则包不带破限层',
  !composeSystemLayers({ unrestrictedOn: false, packs }).includes(LAYER_OPEN)
  && composeSystemLayers({ unrestrictedOn: false, packs }).includes('固定画风'));
check('两条都关时返回空串',
  composeSystemLayers({ unrestrictedOn: false, packs, packsOn: false }) === '');
check('规则包总开关关闭时一条都不发', composeRulePacks(packs, false) === '');

// ---------- 进到真实任务里 ----------
const sys = buildMessages({ sentence: '雨夜的霓虹街头', apiPinned: both })[0].content;
check('最终 system prompt 里破限层只出现一次', sys.split(LAYER_OPEN).length === 2);
check('JSON 锁永远在最后',
  sys.trimEnd().endsWith('不要用 markdown 代码块包裹。')
  && sys.lastIndexOf('规则包：固定画风') < sys.indexOf('# 输出格式确认'));
check('任务规则仍然在破限层之前',
  sys.indexOf('# 输出格式（强制）') < sys.indexOf(LAYER_OPEN));
check('关闭后与未接入前逐字一致',
  buildMessages({ sentence: '猫' })[0].content
  === buildMessages({ sentence: '猫', apiPinned: composeSystemLayers({ unrestrictedOn: false }) })[0].content);

// ---------- 自检结论 ----------
check('自检：合格 JSON 且内容够长算通过',
  classifyProbeReply(JSON.stringify({ positive: 'a'.repeat(60), translation: '中文' })).verdict === 'ok');
check('自检：JSON 里出现「抱歉」但内容正常，仍算通过',
  classifyProbeReply(JSON.stringify({ positive: 'x'.repeat(60), translation: '抱歉让你久等' })).verdict === 'ok');
check('自检：被截断但 positive 已写出，也算通过',
  classifyProbeReply('{"positive":"hello world, a long explicit description of the scene that got cut').verdict === 'ok');
check('自检：内容过短的 JSON 算敷衍',
  classifyProbeReply(JSON.stringify({ positive: 'a nude woman' })).verdict === 'thin');
check('自检：中文拒答能识别',
  classifyProbeReply('抱歉，我无法提供这类内容。').verdict === 'refused'
  && classifyProbeReply('作为一个人工智能，我不能协助这个请求。').verdict === 'refused');
check('自检：英文拒答能识别',
  classifyProbeReply("I'm sorry, but I can't help with that.").verdict === 'refused'
  && classifyProbeReply('I cannot provide this content.').verdict === 'refused');
check('自检：无拒答但不是 JSON 算异常',
  classifyProbeReply('这是一段普通的散文，没有拒绝，也没有 JSON。').verdict === 'unknown');
check('自检：空回复单独归类', classifyProbeReply('   ').verdict === 'empty');
check('自检：探针句子是成人场景且不含违法内容',
  PROBE_SENTENCE.includes('成年') && !/儿童|未成年|幼/.test(PROBE_SENTENCE));
check('自检：每种结论都有中文说明',
  ['ok', 'thin', 'refused', 'empty', 'unknown'].every((v) => describeProbeVerdict(v).length > 6));

console.log('');
console.log(bad === 0 ? '全部通过 ✓' : `${bad} 项失败 ✗`);
process.exit(bad === 0 ? 0 : 1);
