// 诊断：history 抽屉点「关闭」为什么没反应。
// 关键区别：属性 hidden 是否为 true（JS 状态） vs 计算样式 display 是否为 none（真实可见性）。
import { spawn } from 'node:child_process';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
const APP = process.env.APP_URL || 'http://127.0.0.1:43125/';
const profile = path.join(process.env.TEMP, 'pf-diag-profile');

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,1000', APP,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page' && t.url.includes('43125'));
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* 等 */ }
    await sleep(250);
  }
  throw new Error('调试端口没起来');
}

async function main() {
  const ws = new WebSocket(await findTarget());
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
  await send('Runtime.enable');

  const js = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };

  for (let i = 0; i < 60; i++) {
    if (await js(`!!document.querySelector('#styleChips .chip')`).catch(() => false)) break;
    await sleep(200);
  }

  const probe = (sel) => `(() => {
    const e = document.querySelector('${sel}');
    if (!e) return { sel: '${sel}', missing: true };
    const cs = getComputedStyle(e);
    const b = e.getBoundingClientRect();
    return { sel: '${sel}', hiddenAttr: e.hidden, display: cs.display, visibility: cs.visibility,
             w: Math.round(b.width), h: Math.round(b.height), opacity: cs.opacity };
  })()`;

  const show = (label, rows) => {
    console.log(`\n【${label}】`);
    for (const r of rows) {
      console.log(`  ${r.sel.padEnd(14)} hidden属性=${String(r.hiddenAttr).padEnd(5)} display=${String(r.display).padEnd(9)} 尺寸=${String(r.w) + 'x' + String(r.h)}`);
    }
  };

  const targets = ['#drawer', '#drawerMask', '#stream', '#empty', '#cards', '#err'];
  show('页面刚加载', await Promise.all(targets.map((t) => js(probe(t)))));

  await js(`document.querySelector('#btnHistory').click(); true`);
  await sleep(500);
  show('点了「历史记录」之后', await Promise.all(targets.map((t) => js(probe(t)))));

  const hit = await js(`(() => {
    const btn = document.querySelector('#btnCloseDrawer');
    const b = btn.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return { btnRect: {x:Math.round(b.x), y:Math.round(b.y), w:Math.round(b.width), h:Math.round(b.height)},
             topElement: top ? (top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + (top.className && typeof top.className === 'string' ? '.' + top.className.trim().split(/\\s+/).join('.') : '')) : 'null',
             isSameAsButton: top === btn || (top && btn.contains(top)) };
  })()`);
  console.log('\n【关闭按钮可点击性】');
  console.log(`  按钮位置 ${JSON.stringify(hit.btnRect)}`);
  console.log(`  该点最上层元素: ${hit.topElement}`);
  console.log(`  是否就是按钮本身: ${hit.isSameAsButton}`);

  await js(`document.querySelector('#btnCloseDrawer').click(); true`);
  await sleep(500);
  show('点了「关闭」之后', await Promise.all(targets.map((t) => js(probe(t)))));

  const after = await js(probe('#drawer'));
  console.log('\n【结论】');
  if (after.hiddenAttr === true && after.display !== 'none') {
    console.log(`  BUG 确认：hidden 属性已置为 true，但计算样式 display=${after.display}，元素仍然可见。`);
    console.log('  原因：CSS 里 .drawer{display:flex} 属于作者样式，优先级高于浏览器默认的 [hidden]{display:none}。');
  } else if (after.hiddenAttr === false) {
    console.log('  hidden 属性没被改，说明点击事件没触发（事件绑定或覆盖问题）。');
  } else {
    console.log(`  正常：hidden=true 且 display=${after.display}，确实隐藏了。`);
  }

  chrome.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error('诊断脚本异常：', e.message);
  chrome.kill();
  process.exit(1);
});
