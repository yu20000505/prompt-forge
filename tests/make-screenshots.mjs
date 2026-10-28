import { fileURLToPath } from 'node:url';
// 生成 README 用的截图：起一个临时实例（假接口），用无头 Chrome 走一遍真实流程后截图。
// 用法：node tests/make-screenshots.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'docs', 'screenshots');
const APP_PORT = Number(process.env.PF_SHOT_PORT || 43140);
const MOCK_PORT = Number(process.env.PF_MOCK_PORT || 43199);
const DEBUG_PORT = Number(process.env.PF_DEBUG_PORT || 9340);
const CFG = path.join(os.tmpdir(), `pf-shot-config-${process.pid}.json`);
const SAVED = path.join(os.tmpdir(), `pf-shot-saved-${process.pid}`);
const STATE = path.join(os.tmpdir(), `pf-shot-state-${process.pid}`);
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = `http://127.0.0.1:${APP_PORT}/`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kids = [];
const start = (args, env = {}) => {
  const c = spawn(process.execPath, args, {
    cwd: ROOT, stdio: 'ignore',
    env: { ...process.env, NO_OPEN: '1', ...env },
  });
  kids.push(c);
  return c;
};
const stopAll = () => {
  for (const c of kids) { try { c.kill('SIGKILL'); } catch { /* 已退出 */ } }
  for (const f of [CFG, `${CFG}.bak`, `${CFG}.tmp`]) { try { fs.unlinkSync(f); } catch { /* 无 */ } }
  try { fs.rmSync(SAVED, { recursive: true, force: true }); } catch { /* 无 */ }
  try { fs.rmSync(STATE, { recursive: true, force: true }); } catch { /* 无 */ }
};
const waitHttp = async (url, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url)).ok) return true; } catch { /* 等 */ }
    await sleep(300);
  }
  return false;
};

function connect() {
  return new Promise(async (resolve, reject) => {
    let wsUrl = null;
    for (let i = 0; i < 80; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
        const p = list.find((t) => t.type === 'page' && t.url.includes(`:${APP_PORT}`));
        if (p?.webSocketDebuggerUrl) { wsUrl = p.webSocketDebuggerUrl; break; }
      } catch { /* 等 */ }
      await sleep(250);
    }
    if (!wsUrl) return reject(new Error('Chrome 调试端口没起来'));

    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let seq = 0;
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { resolve: r, reject: j } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? j(new Error(JSON.stringify(m.error))) : r(m.result);
      }
    });
    ws.addEventListener('open', () => resolve({
      send: (method, params = {}) => {
        const id = ++seq;
        return new Promise((r, j) => { pending.set(id, { resolve: r, reject: j }); ws.send(JSON.stringify({ id, method, params })); });
      },
      close: () => ws.close(),
    }), { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`输出目录：${OUT}`);

  start(['tests/mock-openai.mjs', String(MOCK_PORT)]);
  start(['src/server.mjs', String(APP_PORT)], { PF_CONFIG: CFG, PF_SAVED: SAVED, PF_STATE: STATE });

  if (!(await waitHttp(`http://127.0.0.1:${MOCK_PORT}/v1/models`))) throw new Error('假接口没起来');
  if (!(await waitHttp(APP_URL))) throw new Error('应用没起来');

  await fetch(`${APP_URL}api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseURL: `http://127.0.0.1:${MOCK_PORT}/v1`,
      apiKey: 'sk-demo',
      model: 'demo-model',
      pinnedPositive: 'masterpiece, best quality, very aesthetic',
      pinnedNegative: 'lowres, worst quality',
    }),
  });

  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${path.join(os.tmpdir(), `pf-shot-profile-${process.pid}`)}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--hide-scrollbars', '--window-size=1440,1000',
    APP_URL,
  ], { stdio: 'ignore' });
  kids.push(chrome);

  const cdp = await connect();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const js = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const shoot = async (name) => {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(shot.data, 'base64'));
    console.log(`  ✓ ${name}`);
  };
  const waitVisible = async (sel, tries = 120) => {
    for (let i = 0; i < tries; i++) {
      const ok = await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const c = getComputedStyle(e); const b = e.getBoundingClientRect(); return c.display !== 'none' && b.width > 0; })()`);
      if (ok) return true;
      await sleep(200);
    }
    return false;
  };

  for (let i = 0; i < 60; i++) {
    if (await js(`!!document.querySelector('#styleSelect option')`)) break;
    await sleep(200);
  }
  await sleep(400);

  // 1) 主界面：生成一条提示词
  await js(`(() => {
    const s = document.querySelector('#sentence');
    s.value = '雨夜的霓虹街头，一位赛博朋克女剑客回头看向镜头';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#btnGenerate').click();
    return true;
  })()`);
  if (!(await waitVisible('#cards'))) throw new Error('生成结果没出现');
  await sleep(600);
  await shoot('01-main.png');

  // 2) 角色设定
  await js(`document.querySelector('#mainTabs .tab[data-view="character"]').click(); true`);
  await sleep(400);
  await js(`(() => {
    const s = document.querySelector('#charSentence');
    s.value = '三个流浪乐手在地铁站出口表演，傍晚刚下过雨';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#btnCharGenerate').click();
    return true;
  })()`);
  if (!(await waitVisible('#charCards'))) throw new Error('角色结果没出现');
  await sleep(600);
  await shoot('02-character.png');

  // 3) 细分提示词
  await js(`document.querySelector('#mainTabs .tab[data-view="segment"]').click(); true`);
  await sleep(400);
  await js(`(() => {
    const s = document.querySelector('#segSentence');
    s.value = '银发吸血鬼贵族少女，穿黑色蕾丝长裙';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#btnSegGenerate').click();
    return true;
  })()`);
  if (!(await waitVisible('#segCards'))) throw new Error('细分标签没出现');
  await sleep(600);
  await shoot('05-segment.png');

  // 4) 拼装板
  await js(`document.querySelector('#btnSegAddBoard').click(); true`);
  await sleep(400);
  await js(`document.querySelector('#btnBoard').click(); true`);
  if (!(await waitVisible('#boardDrawer'))) throw new Error('拼装板没出现');
  await sleep(500);
  await shoot('06-board.png');
  await js(`document.querySelector('#btnBoardClose').click(); true`);
  await sleep(300);

  // 5) 皮肤面板
  await js(`document.querySelector('#mainTabs .tab[data-view="prompt"]').click(); true`);
  await sleep(300);
  await js(`document.querySelector('#btnTheme').click(); true`);
  await sleep(500);
  await shoot('03-theme.png');
  await js(`document.querySelector('#btnTheme').click(); true`);
  await sleep(200);

  // 6) 设置弹窗
  await js(`document.querySelector('#btnSettings').click(); true`);
  await sleep(600);
  await shoot('04-settings.png');

  cdp.close();
  console.log('完成');
}

main()
  .then(() => { stopAll(); process.exit(0); })
  .catch((err) => {
    console.error('截图失败：', err.message);
    stopAll();
    process.exit(1);
  });
