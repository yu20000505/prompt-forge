// 检查 app.js 里引用的 #id 在 index.html 里是否真的存在。
// 这次就是漏删了一个绑定，导致 bind() 抛异常、后面所有绑定都没执行。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')));
const html = fs.readFileSync(path.join(ROOT, 'src/public/index.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'src/public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/public/styles.css'), 'utf8');

const htmlIds = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]));

// app.js 里所有 $('#xxx') / querySelector('#xxx') / getElementById('xxx')
const refs = new Map();
const add = (id, where) => {
  if (!refs.has(id)) refs.set(id, []);
  refs.get(id).push(where);
};
for (const m of js.matchAll(/\$\('#([\w-]+)'\)/g)) add(m[1], `$('#${m[1]}')`);
for (const m of js.matchAll(/querySelector(?:All)?\('#([\w-]+)'/g)) add(m[1], `querySelector('#${m[1]}')`);
for (const m of js.matchAll(/getElementById\('([\w-]+)'\)/g)) add(m[1], `getElementById('${m[1]}')`);

const missing = [...refs.keys()].filter((id) => !htmlIds.has(id)).sort();
const unused = [...htmlIds].filter((id) => !refs.has(id) && !js.includes(`'${id}'`)).sort();

console.log(`HTML 里的 id：${htmlIds.size} 个；app.js 引用的 id：${refs.size} 个`);
console.log('');

if (missing.length) {
  console.log(`✗ 引用了不存在的 id（${missing.length} 个）：`);
  for (const id of missing) {
    const lines = js.split('\n').map((l, i) => (l.includes(`'#${id}'`) || l.includes(`'${id}'`) ? i + 1 : 0)).filter(Boolean);
    console.log(`  #${id}  ← app.js 第 ${lines.join(', ')} 行`);
  }
} else {
  console.log('✓ 所有引用到的 id 都存在于 HTML');
}

// 顺带查 CSS 里引用的 id 选择器
const cssIds = new Set([...css.matchAll(/(?<![\w#])#([a-zA-Z][\w-]*)\s*(?:[,{:.\s])/g)].map((m) => m[1]));
const cssMissing = [...cssIds].filter((id) => !htmlIds.has(id) && !['fff', '000'].includes(id));
if (cssMissing.length) {
  console.log(`\n· CSS 里出现但 HTML 没有的 id（可能是死样式）：${cssMissing.join(', ')}`);
}

if (unused.length) {
  console.log(`\n· HTML 里有、JS 没引用的 id（可能只是被 CSS 用到）：${unused.join(', ')}`);
}

process.exit(missing.length === 0 ? 0 : 1);
