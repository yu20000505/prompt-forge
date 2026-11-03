// 冒烟测试：设定集结果的保存路径（saved/worlds/）+ 列表 + 备份 + 删除/撤销。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const ROOT = 'G:/AI/DSH-提示词软件';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-world-save-'));
const CFG = path.join(tmp, 'config.json');
const SAVED = path.join(tmp, 'saved');
const STATE = path.join(tmp, 'state');
const WORLDS = path.join(tmp, 'worlds');

const freePort = () => new Promise((resolve) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => {
    const p = srv.address().port;
    srv.close(() => resolve(p));
  });
});

const PORT = await freePort();
const BASE = `http://127.0.0.1:${PORT}`;
const child = spawn(process.execPath, ['src/server.mjs', String(PORT)], {
  cwd: ROOT,
  stdio: 'ignore',
  env: { ...process.env, NO_OPEN: '1', PF_STRICT_PORT: '1', PF_CONFIG: CFG, PF_SAVED: SAVED, PF_STATE: STATE, PF_WORLDS: WORLDS },
});

let bad = 0;
const check = (name, ok, extra = '') => {
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/config`);
      if (r.ok) return true;
    } catch { /* 还没起来 */ }
    await sleep(300);
  }
  return false;
}

try {
  if (!(await waitUp())) throw new Error('服务没起来');

  // 1) 保存一条设定集结果
  const content = '## 正向提示词\n\n1girl, silver hair, snow, rooftop\n\n## 负向提示词\n\nlowres';
  const saveRes = await fetch(`${BASE}/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'world',
      title: '九霄残卷 · 雪夜拔刀',
      content,
      meta: { positive: '1girl, silver hair, snow, rooftop', negative: 'lowres', world: '九霄残卷', entries: ['沈照雪'] },
    }),
  });
  const saved = await saveRes.json();
  check('保存返回 folder=worlds', saved.folder === 'worlds', JSON.stringify(saved.file));
  const worldFile = path.join(SAVED, 'worlds', saved.file);
  check('文件真的落在 saved/worlds/', fs.existsSync(worldFile), worldFile);

  // 2) 列表里认得出「设定集」
  const list = await (await fetch(`${BASE}/api/saved`)).json();
  const item = (list.items || []).find((it) => it.name === saved.file);
  check('列表里出现这条，且 kind=设定集', item && item.kind === '设定集', item ? item.kind : '(没找到)');
  check('摘要取自正向提示词', item && item.summary.includes('1girl'), item ? item.summary.slice(0, 40) : '');

  // 3) 单条读取 & 收藏
  const one = await (await fetch(`${BASE}/api/saved/item?file=${encodeURIComponent(saved.file)}`)).json();
  check('单条能读回 meta.world', one.meta && one.meta.world === '九霄残卷', JSON.stringify(one.meta?.world));
  const fav = await (await fetch(`${BASE}/api/saved/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: saved.file, favorite: true }),
  })).json();
  check('可以收藏', fav.ok === true && fav.favorite === true);

  // 4) 备份导出带前缀，导入能还原到子目录
  const backup = await (await fetch(`${BASE}/api/backup/export`)).json();
  const inBackup = (backup.files || []).find((f) => f.name === `worlds/${saved.file}`);
  check('备份导出里是 worlds/ 前缀', !!inBackup, (backup.files || []).map((f) => f.name).join(', '));
  const del = await (await fetch(`${BASE}/api/saved/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: saved.file }),
  })).json();
  check('删除后文件不在 worlds/', del.ok === true && !fs.existsSync(worldFile));
  const imported = await (await fetch(`${BASE}/api/backup/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'merge', files: backup.files }),
  })).json();
  check('导入成功', imported.ok === true, JSON.stringify(imported));
  check('导入后回到 saved/worlds/', fs.existsSync(worldFile), worldFile);

  // 5) 撤销删除：回到 worlds/ 而不是根目录
  const del2 = await (await fetch(`${BASE}/api/saved/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: saved.file }),
  })).json();
  const restore = await (await fetch(`${BASE}/api/saved/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trash: del2.trash, original: del2.original }),
  })).json();
  check('撤销删除回到 saved/worlds/', restore.ok === true && fs.existsSync(path.join(SAVED, 'worlds', restore.file)), JSON.stringify(restore.file));

  // 6) 普通提示词仍然落在 saved/ 根目录
  const p2 = await (await fetch(`${BASE}/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'prompt', title: '普通提示词', content: '## 正向提示词\n\n1girl', meta: { positive: '1girl' } }),
  })).json();
  check('普通提示词仍在根目录', p2.folder === '' && fs.existsSync(path.join(SAVED, p2.file)), p2.file);
} catch (err) {
  bad++;
  console.log('FAIL  异常：' + err.message);
} finally {
  try { child.kill('SIGKILL'); } catch { /* 已退出 */ }
  await sleep(300);
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(bad ? `\n${bad} 项失败` : '\n全部通过');
process.exit(bad ? 1 : 0);
