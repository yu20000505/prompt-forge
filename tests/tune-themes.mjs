import { fileURLToPath } from 'node:url';
// 根据对比度要求调整不达标的 token，输出替换表。只做计算和打印，不改文件。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const css = fs.readFileSync(path.join(ROOT, 'src/public/styles.css'), 'utf8');

const parseBlock = (body) => {
  const out = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    const v = m[2].trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) out[m[1]] = v;
  }
  return out;
};

const expand = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
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

// 往「对比度变大」的方向混合：亮背景压深，暗背景提亮
function adjustUntil(hex, bg, need, steps = 80) {
  const towardsWhite = lum(bg) < 0.35;
  const base = expand(hex);
  const target = towardsWhite ? 255 : 0;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const cur = toHex(base.map((v) => v + (target - v) * t));
    if (contrast(cur, bg) >= need) return cur;
  }
  return towardsWhite ? '#ffffff' : '#000000';
}

const themes = [{ id: 'sage', tokens: parseBlock(css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]) }];
for (const m of css.matchAll(/\[data-theme="([\w-]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
  themes.push({ id: m[1], tokens: parseBlock(m[2]) });
}
const merged = themes.map((t) => ({ id: t.id, tokens: { ...themes[0].tokens, ...t.tokens } }));

const replaceMap = new Map();

for (const t of merged) {
  const tk = { ...t.tokens };
  const panel = tk.panel;
  const fixes = [];

  if (contrast(tk.dim, panel) < 4.6) {
    const next = adjustUntil(tk.dim, panel, 4.6);
    fixes.push(['dim', tk.dim, next, contrast(next, panel)]);
  }
  if (contrast(tk.faint, panel) < 3.2) {
    const next = adjustUntil(tk.faint, panel, 3.2);
    fixes.push(['faint', tk.faint, next, contrast(next, panel)]);
  }
  if (contrast(tk['accent-2-soft'], panel) < 4.6) {
    const next = adjustUntil(tk['accent-2-soft'], panel, 4.6);
    fixes.push(['accent-2-soft', tk['accent-2-soft'], next, contrast(next, panel)]);
  }
  if (contrast(tk['accent-ink'], tk.accent) < 4.6) {
    const next = adjustUntil(tk.accent, '#ffffff', 4.6);
    fixes.push(['accent', tk.accent, next, contrast(next, '#ffffff')]);
  }

  if (fixes.length) {
    console.log(`【${t.id}】`);
    for (const [name, from, to, ratio] of fixes) {
      console.log(`  --${name}: ${from} -> ${to}   (${ratio.toFixed(2)}:1)`);
      if (!replaceMap.has(from)) replaceMap.set(from, to);
    }
  }
}

console.log('\n替换表:');
console.log(JSON.stringify(Object.fromEntries(replaceMap), null, 2));
