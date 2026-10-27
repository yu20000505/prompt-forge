import { fileURLToPath } from 'node:url';
// 在真实渲染的页面上自动审计文字对比度：找出「字和它背后的底色太接近」的元素。
// 换皮肤后眼睛看不到的问题，这一步能抓出来。
import { spawn } from 'node:child_process';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = process.env.APP_URL || 'http://127.0.0.1:43125/';
const APP_PORT = new URL(APP).port || '80';
const DEBUG_PORT = 9336;
const OUT = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${path.join(process.env.TEMP, 'pf-contrast-profile')}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1440,1100', APP,
], { stdio: 'ignore' });

async function target() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page' && t.url.includes(`:${APP_PORT}`));
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* 等 */ }
    await sleep(250);
  }
  throw new Error('调试端口没起来');
}

const AUDIT = `(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((v) => parseFloat(v));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  };
  // 渐变背景没有 background-color，得从 background-image 里取色标，按最差的那个算
  const stopsOf = (cs, fg) => {
    const img = cs.backgroundImage || '';
    if (!img.includes('gradient')) return null;
    const rgbas = [...img.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => {
      const p = m[1].split(',').map((v) => parseFloat(v));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }).filter((c) => c.a > 0.5);
    if (!rgbas.length) return null;
    let worst = rgbas[0];
    for (const c of rgbas) if (ratio(fg, c) < ratio(fg, worst)) worst = c;
    return worst;
  };
  const bgOf = (el, fg) => {
    let cur = el;
    while (cur) {
      const cs = getComputedStyle(cur);
      const g = stopsOf(cs, fg);
      if (g) return g;
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0.5) return bg;
      cur = cur.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (parseFloat(cs.opacity) < 0.1) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasText) continue;
    const fg = parse(cs.color);
    if (!fg || fg.a < 0.5) continue;
    const c = ratio(fg, bgOf(el, fg));
    if (c < 3.0) {
      bad.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 36),
        text: el.textContent.trim().slice(0, 26),
        ratio: Math.round(c * 100) / 100,
      });
    }
  }
  return bad;
})()`;

async function main() {
  const ws = new WebSocket(await target());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
  });
  const send = (method, params = {}) => {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };

  for (let i = 0; i < 60; i++) {
    if (await evalJs(`!!document.querySelector('#styleChips .chip')`).catch(() => false)) break;
    await sleep(200);
  }

  // 两个界面都扫一遍，避免只测到首页
  const views = ['prompt', 'character'];
  const themes = ['sage', 'haze', 'mauve', 'bean', 'sand', 'steel', 'night'];
  let total = 0;

  const report = (theme, where, bad) => {
    total += bad.length;
    if (!bad.length) return;
    console.log(`\n【${theme} / ${where}】${bad.length} 处对比度偏低`);
    for (const b of bad.slice(0, 8)) {
      console.log(`  ${String(b.ratio).padStart(5)}:1  <${b.tag} class="${b.cls}"> "${b.text}"`);
    }
  };

  for (const theme of themes) {
    await evalJs(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)}); true`);
    await sleep(250);

    // 两个主界面
    for (const v of views) {
      await evalJs(`document.querySelector('#mainTabs .tab[data-view="${v}"]').click(); true`);
      await sleep(250);
      report(theme, v, await evalJs(AUDIT));
    }

    // 错误条 + 提示条
    await evalJs(`document.querySelector('#mainTabs .tab[data-view="prompt"]').click(); true`);
    await sleep(150);
    await evalJs(`showErr('对比度审计用的测试错误文案', () => {}); toast('对比度审计用的提示条'); true`);
    await sleep(250);
    report(theme, '错误条/提示条', await evalJs(AUDIT));
    await evalJs(`hideErr(); true`);

    // 设置弹窗
    await evalJs(`document.querySelector('#btnSettings').click(); true`);
    await sleep(400);
    report(theme, '设置弹窗', await evalJs(AUDIT));
    await evalJs(`document.querySelector('#btnCancelSettings').click(); true`);
    await sleep(200);

    // 保存库抽屉
    await evalJs(`document.querySelector('#btnLibrary').click(); true`);
    await sleep(700);
    report(theme, '保存库', await evalJs(AUDIT));
    await evalJs(`document.querySelector('#btnLibClose').click(); true`);
    await sleep(200);
  }

  // 恢复默认皮肤
  await evalJs(`document.documentElement.setAttribute('data-theme', 'sage'); true`);

  console.log('');
  console.log(total === 0 ? '真实渲染下的文字对比度全部达标 ✓' : `共 ${total} 处偏低 ✗`);
  chrome.kill();
  process.exit(total === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('审计脚本异常：', e.message);
  chrome.kill();
  process.exit(2);
});
