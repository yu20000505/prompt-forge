import { fileURLToPath } from 'node:url';
// 直接打 /api/characters/refine，看服务端到底返回什么。开发期排查用。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CFG = path.join(os.tmpdir(), `pf-dbg-${process.pid}.json`);
const APP = 43160;
const MOCK = 43199;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kids = [];

const start = (args, env = {}) => {
  const c = spawn(process.execPath, args, { cwd: ROOT, stdio: 'ignore', env: { ...process.env, NO_OPEN: '1', ...env } });
  kids.push(c);
  return c;
};
const stop = () => {
  for (const c of kids) { try { c.kill('SIGKILL'); } catch { /* 已退出 */ } }
  for (const f of [CFG, `${CFG}.bak`, `${CFG}.tmp`]) { try { fs.unlinkSync(f); } catch { /* 无 */ } }
};
const waitHttp = async (url) => {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(url)).ok) return true; } catch { /* 等 */ }
    await sleep(300);
  }
  return false;
};

try {
  start(['tests/mock-openai.mjs', String(MOCK)]);
  start(['src/server.mjs', String(APP)], { PF_CONFIG: CFG });
  const ok = (await waitHttp(`http://127.0.0.1:${MOCK}/v1/models`)) && (await waitHttp(`http://127.0.0.1:${APP}/`));
  if (!ok) throw new Error('服务没起来');

  await fetch(`http://127.0.0.1:${APP}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseURL: `http://127.0.0.1:${MOCK}/v1`, apiKey: 'sk-test', model: 'mock-prompt-model' }),
  });

  const body = {
    instruction: '改成夜景',
    previous: {
      prompt_en: 'candid street photography of three busking musicians',
      prompt_zh: '黄昏时分，三个街头乐手即兴演出',
      aspect: '16:9',
    },
  };

  const r = await fetch(`http://127.0.0.1:${APP}/api/characters/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  console.log('HTTP', r.status, '|', r.headers.get('content-type'));

  const text = await r.text();
  if (!text.includes('data:')) {
    console.log('非 SSE 响应：', text.slice(0, 400));
  } else {
    let acc = '';
    for (const line of text.split('\n')) {
      const l = line.trim();
      if (!l.startsWith('data:')) continue;
      const j = JSON.parse(l.slice(5).trim());
      if (j.type === 'delta') acc += j.text;
      else if (j.type === 'error') console.log('SSE 错误：', j.message);
    }
    let o = null;
    try { o = JSON.parse(acc); } catch { /* 解析失败 */ }
    console.log('解析成功:', !!o);
    if (o) {
      console.log('title      :', o.title);
      console.log('prompt_en  :', String(o.prompt_en).slice(0, 60));
      console.log('prompt_zh  :', String(o.prompt_zh).slice(0, 60));
    } else {
      console.log('原文:', acc.slice(0, 300));
    }
  }
} catch (err) {
  console.log('异常：', err.message);
} finally {
  stop();
  process.exit(0);
}
