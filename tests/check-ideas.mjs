// 验证灵感解析的兜底逻辑 + prompt 构造。开发期临时脚本。
import { buildIdeaMessages } from '../src/styles.mjs';

function parseIdeas(content) {
  let t = String(content || '').trim();
  if (!t) return [];
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  const a = t.indexOf('[');
  const b = t.lastIndexOf(']');
  if (a >= 0 && b > a) {
    try {
      const arr = JSON.parse(t.slice(a, b + 1));
      if (Array.isArray(arr)) {
        const out = arr
          .map((x) => (typeof x === 'string' ? x : x && (x.idea || x.text || x.sentence || x.title) || ''))
          .map((s) => String(s).trim())
          .filter(Boolean);
        if (out.length) return out.slice(0, 8);
      }
    } catch {
      /* 落到按行解析 */
    }
  }

  return t
    .split('\n')
    .map((line) => line
      .replace(/^\s*(?:[-*•·]|\d+[.、)）])\s*/, '')
      .replace(/^["'「『]/, '')
      .replace(/["'」』]\s*$/, '')
      .trim())
    .filter((line) => line.length >= 6 && !/^```/.test(line))
    .slice(0, 8);
}

const cases = [
  ['标准 JSON 数组', '["雨夜的天桥上有人等候","清晨的旧书店里有一只猫"]'],
  ['带 markdown 围栏', '```json\n["甲甲甲甲甲甲","乙乙乙乙乙乙"]\n```'],
  ['带序号列表', '1. 丙丙丙丙丙丙\n2. 丁丁丁丁丁丁'],
  ['带项目符号', '- 戊戊戊戊戊戊\n- 己己己己己己'],
  ['对象数组', '[{"idea":"庚庚庚庚庚庚"},{"text":"辛辛辛辛辛辛"}]'],
  ['前后有解释文字', '好的，这是 6 条：\n["壬壬壬壬壬壬","癸癸癸癸癸癸"]\n希望你喜欢。'],
  ['空内容', ''],
];

let bad = 0;
for (const [name, input] of cases) {
  const out = parseIdeas(input);
  const ok = name === '空内容' ? out.length === 0 : out.length >= 2;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(16)} → ${JSON.stringify(out)}`);
}

// prompt 构造
const noAvoid = buildIdeaMessages({});
const withAvoid = buildIdeaMessages({ avoid: ['雨夜的天桥', '清晨的旧书店', '', '   '] });
console.log('');
console.log('无 avoid user:', JSON.stringify(noAvoid[1].content));
console.log('有 avoid user 含句子:', withAvoid[1].content.includes('雨夜的天桥'));
console.log('空字符串被过滤:', !withAvoid[1].content.includes('3. '));
console.log('system 要求 6 条:', noAvoid[0].content.includes('6 条'));
console.log('system 禁止代码块:', noAvoid[0].content.includes('markdown'));

console.log('');
console.log(bad === 0 ? '解析兜底全部通过 ✓' : `${bad} 项失败 ✗`);
process.exit(bad === 0 ? 0 : 1);
