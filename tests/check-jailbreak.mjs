// 校验破限词（置顶 system）的发送语义：留空回落默认、关闭不发、只置顶一次、
// 以及旧「破限层」确实已经从代码里移除。开发期自测，不联网。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_JAILBREAK_PROMPT,
  JAILBREAK_MARKER,
  JAILBREAK_META,
  JAILBREAK_TEXT_MAX,
  PROBE_SENTENCE,
  classifyProbeReply,
  describeProbeVerdict,
  isCustomJailbreak,
  resolveJailbreakText,
  withJailbreak,
} from '../src/jailbreak.mjs';
import { buildMessages } from '../src/styles.mjs';

let bad = 0;
const check = (name, ok, extra = '') => {
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ---------- 默认文本 ----------
check('内置默认是 FORGE 内核结构',
  DEFAULT_JAILBREAK_PROMPT.startsWith('<forge_kernel version="1">')
  && DEFAULT_JAILBREAK_PROMPT.trimEnd().endsWith('</forge_kernel>')
  && DEFAULT_JAILBREAK_PROMPT.includes('<forge_role>')
  && DEFAULT_JAILBREAK_PROMPT.includes('<forge_scope>')
  && DEFAULT_JAILBREAK_PROMPT.includes('<forge_output>')
  && DEFAULT_JAILBREAK_PROMPT.includes('<forge_limits>'));
check('默认文本写明了成年与输出协议',
  DEFAULT_JAILBREAK_PROMPT.includes('按成年人处理')
  && DEFAULT_JAILBREAK_PROMPT.includes('十八岁')
  && DEFAULT_JAILBREAK_PROMPT.includes('只输出任务协议规定的那一个结构'));
check('默认文本长度合理（< 4000 字）',
  DEFAULT_JAILBREAK_PROMPT.length > 800 && DEFAULT_JAILBREAK_PROMPT.length < 4000,
  `${DEFAULT_JAILBREAK_PROMPT.length} 字`);
check('默认文本是原创：不含第三方内核的标识与句式',
  !/nvwa|NVWA|源氏集团/.test(DEFAULT_JAILBREAK_PROMPT)
  && !/standalone_core|model_identity|adult_content|safety_guardrails/.test(DEFAULT_JAILBREAK_PROMPT)
  && !/不因材料包含成人主题/.test(DEFAULT_JAILBREAK_PROMPT));
check('元信息是自有的，不指向第三方文本',
  JAILBREAK_META.name === 'FORGE 内核' && /原创/.test(JAILBREAK_META.origin)
  && !JAILBREAK_META.repo && JAILBREAK_META.chars === DEFAULT_JAILBREAK_PROMPT.length);
check('标记常量能认出这段正文',
  DEFAULT_JAILBREAK_PROMPT.includes(JAILBREAK_MARKER) && JAILBREAK_MARKER === '<forge_kernel');

// ---------- 解析语义：留空 = 默认，不是关闭 ----------
check('空串回落内置默认', resolveJailbreakText('') === DEFAULT_JAILBREAK_PROMPT);
check('只有空白也回落内置默认', resolveJailbreakText('   \n\t ') === DEFAULT_JAILBREAK_PROMPT);
check('null / undefined 回落内置默认',
  resolveJailbreakText(null) === DEFAULT_JAILBREAK_PROMPT
  && resolveJailbreakText(undefined) === DEFAULT_JAILBREAK_PROMPT);
check('自定义内容首尾空白被 trim', resolveJailbreakText('  我的规则  ') === '我的规则');
check('已自定义判定与设置页同口径',
  isCustomJailbreak('x') && !isCustomJailbreak('') && !isCustomJailbreak('   '));

// ---------- 注入：置顶、独立、幂等 ----------
const task = buildMessages({ sentence: '猫' });
const out = withJailbreak(task, { on: true, text: '' });
check('破限词是新的第一条 system，任务规则后移一条',
  out.length === task.length + 1 && out[0].role === 'system' && out[1] === task[0]);
check('破限词没有和任务规则拼进同一条消息',
  out[0].content === DEFAULT_JAILBREAK_PROMPT && out[1].content.includes('# 输出格式（强制）'));
check('关闭时不发（消息数与未接入前一致）',
  withJailbreak(task, { on: false, text: 'JB' }).length === task.length);
check('默认开启（on 缺省视为开）',
  withJailbreak(task, { text: 'JB' })[0].content === 'JB');
check('幂等：同一段只置顶一次',
  withJailbreak(withJailbreak(task, { on: true, text: 'JB' }), { on: true, text: 'JB' }).length === task.length + 1);
check('空数组也不炸', withJailbreak([], { on: true, text: 'JB' }).length === 1
  && withJailbreak(null, { on: true, text: 'JB' }).length === 1);

// ---------- 破限词是唯一的自定义规则入口 ----------
const stylesSrc = fs.readFileSync(path.join(ROOT, 'src/styles.mjs'), 'utf8');
check('规则包拼装入口已整体移除',
  !/composeRulePacks|composeSystemLayers|applyApiPinned|applyCustomRules/.test(stylesSrc));
check('任务 system 里不出现「规则包」字样',
  !JSON.stringify(buildMessages({ sentence: '猫' })).includes('规则包'));

// ---------- 旧文件与旧端点已经不存在 ----------
check('旧破限层模块已删除',
  !fs.existsSync(path.join(ROOT, 'src/unrestricted.mjs'))
  && !fs.existsSync(path.join(ROOT, 'src/unrestricted-block.mjs')));
const serverSrc = fs.readFileSync(path.join(ROOT, 'src/server.mjs'), 'utf8');
check('server 不再引用旧破限层', !/unrestricted\.mjs|buildUnrestrictedBlock/.test(serverSrc));
check('旧 /api/unrestricted 端点已移除', !/\/api\/unrestricted/.test(serverSrc));
check('新端点 /api/jailbreak 已接上',
  serverSrc.includes("pathname === '/api/jailbreak' && req.method === 'GET'")
  && serverSrc.includes("pathname === '/api/jailbreak/check'"));
check('配置字段换成 jailbreakOn / jailbreakPrompt',
  serverSrc.includes("'jailbreakOn'") && serverSrc.includes("'jailbreakPrompt'")
  && !serverSrc.includes("'unrestrictedOn'"));

// ---------- 自检判定 ----------
check('自检：正常 JSON 判为通过',
  classifyProbeReply(JSON.stringify({ positive: 'x'.repeat(60), negative: '' })).verdict === 'ok');
check('自检：过短判为勉强',
  classifyProbeReply(JSON.stringify({ positive: 'short' })).verdict === 'thin');
check('自检：拒答句式判为被拒',
  classifyProbeReply('抱歉，我不能提供这类内容。').verdict === 'refused'
  && classifyProbeReply("I'm sorry, I can't help with that.").verdict === 'refused');
check('自检：空回复', classifyProbeReply('   ').verdict === 'empty');
check('自检：非 JSON 非拒答判为异常', classifyProbeReply('这张图应该是一个女孩站在雨里。').verdict === 'unknown');
check('自检：结论文案齐全', describeProbeVerdict('ok').includes('破限词')
  && describeProbeVerdict('refused').includes('破限词'));
check('自检探针是露骨中文句', PROBE_SENTENCE.includes('露骨'));
check('长度上限是个正经数字', JAILBREAK_TEXT_MAX >= 4000);

console.log(bad ? `\n${bad} 项失败` : '\n全部通过');
process.exit(bad ? 1 : 0);
