import { fileURLToPath } from 'node:url';
// 检查每套皮肤的 WCAG 对比度，避免"看着还行但其实看不清"。
// 直接解析 styles.css 里的 token，不依赖浏览器。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const css = fs.readFileSync(path.join(ROOT, 'src/public/styles.css'), 'utf8');

function parseBlock(body) {
  const out = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    const v = m[2].trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) out[m[1]] = v;
  }
  return out;
}

function expand(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const lum = (hex) => {
  const [r, g, b] = expand(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const la = lum(a);
  const lb = lum(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

// ---- 收集主题 ----
const themes = [];
const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
if (!rootMatch) {
  console.log('解析不到 :root');
  process.exit(1);
}
themes.push({ id: 'sage', tokens: parseBlock(rootMatch[1]) });

for (const m of css.matchAll(/\[data-theme="([\w-]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
  themes.push({ id: m[1], tokens: parseBlock(m[2]) });
}

// sage 是默认，没有 data-theme 覆盖块
const merged = themes.map((t) => ({ id: t.id, tokens: { ...themes[0].tokens, ...t.tokens } }));

// ---- 需要检查的配对 ----
const PAIRS = [
  ['正文 / 页面底', 'text', 'bg', 7],
  ['正文 / 面板', 'text', 'panel', 7],
  ['正文 / 输入框', 'text', 'panel-2', 7],
  ['次级文字 / 面板', 'text-2', 'panel', 5],
  ['说明文字 / 面板', 'dim', 'panel', 4.5],
  ['弱化文字 / 面板', 'faint', 'panel', 3],
  ['主按钮文字 / 主色', 'accent-ink', 'accent', 4.5],
  ['强调文字 / 面板', 'accent-soft', 'panel', 4.5],
  ['次强调文字 / 面板', 'accent-2-soft', 'panel', 4.5],
  ['成功文字 / 面板', 'ok-soft', 'panel', 4.5],
  ['警告文字 / 面板', 'warn-soft', 'panel', 4.5],
  ['危险文字 / 面板', 'danger-soft', 'panel', 4.5],
  ['等宽正文 / 面板', 'mono-text', 'panel', 5],
];

let fails = 0;
for (const t of merged) {
  console.log(`\n【${t.id}】`);
  for (const [label, fg, bg, min] of PAIRS) {
    const a = t.tokens[fg];
    const b = t.tokens[bg];
    if (!a || !b) {
      console.log(`  ?  ${label}：缺 token (${fg}=${a}, ${bg}=${b})`);
      fails++;
      continue;
    }
    const c = contrast(a, b);
    const ok = c >= min;
    if (!ok) fails++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(16)} ${c.toFixed(2)} : 1  (需 ≥ ${min})   ${a} on ${b}`);
  }
}

console.log('');
console.log(fails === 0 ? '所有皮肤对比度达标 ✓' : `${fails} 项不达标 ✗`);
process.exit(fails === 0 ? 0 : 1);
