import { fileURLToPath } from 'node:url';
// 通过 CDP 驱动无头 Chrome 验证前端，包括置顶词拼接行为。开发期工具。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const APP = process.env.APP_URL || 'http://127.0.0.1:43125/';
const APP_PORT = new URL(APP).port || '80';
const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SAVED_DIR = process.env.PF_SAVED_DIR || '';

// 保存目录里的 md 文件（本进程直接读盘，验证「真的写到了本地」）
function savedFiles() {
  try {
    return fs.readdirSync(SAVED_DIR).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
}

function readSaved(name) {
  try {
    return fs.readFileSync(path.join(SAVED_DIR, name), 'utf8');
  } catch {
    return '';
  }
}

// 回收站里的 md 文件（软删除后应该出现在这里）
function trashedFiles() {
  try {
    return fs.readdirSync(path.join(SAVED_DIR, '.trash')).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
}

const profile = path.join(OUT_DIR, 'chrome-profile');
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1440,1080',
  APP,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
let failures = 0;
function check(name, ok, extra = '') {
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
  if (!ok) failures++;
}

async function findTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.url.includes(`:${APP_PORT}`));
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('Chrome 调试端口没起来');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
        return;
      }
      if (m.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        this.consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function main() {
  const wsUrl = await findTarget();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');

  const evalJs = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  };

  // 真实可见性判定：不只看 hidden 属性，还要看计算样式和实际盒子尺寸。
  // （之前只查 .hidden 属性，导致 [hidden] 被 CSS display 覆盖的 bug 没被抓到）
  const visExpr = (sel) => `(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return false;
    const cs = getComputedStyle(e);
    const b = e.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && b.width > 0 && b.height > 0;
  })()`;
  const visible = (sel) => evalJs(visExpr(sel));

  // 等页面脚本就绪
  for (let i = 0; i < 60; i++) {
    const ready = await evalJs(`!!document.querySelector('#styleChips .chip')`).catch(() => false);
    if (ready) break;
    await sleep(200);
  }

  // ---------- 1. 基础结构 ----------
  const chipCount = await evalJs(`document.querySelectorAll('#styleChips .chip').length`);
  check('风格 chip 渲染出 5 个', chipCount === 5, `实际 ${chipCount}`);
  const tabLabels = await evalJs(`[...document.querySelectorAll('#mainTabs .tab')].map(t => t.textContent)`);
  check('页签包含提示词 / 角色 / 细分三个模式',
    tabLabels.length === 3 && tabLabels.some((t) => t.includes('细分提示词')), JSON.stringify(tabLabels));

  // ---------- 1.5 初始可见性（hidden 必须真的不可见） ----------
  check('初始状态：抽屉不可见', (await visible('#drawer')) === false);
  check('初始状态：遮罩不可见', (await visible('#drawerMask')) === false);
  check('初始状态：流式框不可见', (await visible('#stream')) === false);
  check('初始状态：结果卡片不可见', (await visible('#cards')) === false);
  check('初始状态：空状态提示可见', (await visible('#empty')) === true);
  check('初始状态：错误条不可见', (await visible('#err')) === false);
  check('初始状态：提示词保存按钮禁用',
    (await evalJs(`document.querySelector('#btnSavePrompt').disabled`)) === true);

  // ---------- 1.8 皮肤 ----------
  const bgDefault = await evalJs(`getComputedStyle(document.body).backgroundColor`);
  check('默认皮肤是莫兰迪浅色（不是原来的暗色）', bgDefault !== 'rgb(10, 11, 16)', bgDefault);
  check('皮肤面板默认收起', (await visible('#themePop')) === false);

  await evalJs(`document.querySelector('#btnTheme').click(); true`);
  await sleep(350);
  check('点皮肤按钮能展开色板', (await visible('#themePop')) === true);
  const swatchCount = await evalJs(`document.querySelectorAll('#themeSwatches .theme-chip').length`);
  check('提供多套皮肤可选', swatchCount >= 6, `实际 ${swatchCount} 套`);
  const swatchNames = await evalJs(`[...document.querySelectorAll('#themeSwatches .theme-name')].map(e=>e.textContent)`);
  check('每套皮肤都有名字',
    swatchNames.length === swatchCount && swatchNames.every((n) => n.length > 1), JSON.stringify(swatchNames));
  check('当前皮肤有选中态',
    (await evalJs(`document.querySelectorAll('#themeSwatches .theme-chip.active').length`)) === 1);

  await evalJs(`[...document.querySelectorAll('#themeSwatches .theme-chip')].find((b) => b.dataset.theme === 'night').click(); true`);
  await sleep(450);
  const bgNight = await evalJs(`getComputedStyle(document.body).backgroundColor`);
  check('切到暗夜后背景真的变暗', bgNight === 'rgb(10, 11, 16)', bgNight);
  check('data-theme 已写入', (await evalJs(`document.documentElement.getAttribute('data-theme')`)) === 'night');
  check('选择已存进本地', (await evalJs(`localStorage.getItem('pf-theme')`)) === 'night');
  check('选完皮肤自动收起弹层', (await visible('#themePop')) === false);

  await evalJs(`document.querySelector('#btnTheme').click(); true`);
  await sleep(300);
  await evalJs(`[...document.querySelectorAll('#themeSwatches .theme-chip')].find((b) => b.dataset.theme === 'sage').click(); true`);
  await sleep(450);
  const bgBack = await evalJs(`getComputedStyle(document.body).backgroundColor`);
  check('切回莫兰迪后背景恢复', bgBack === bgDefault, `${bgBack} vs ${bgDefault}`);

  // ---------- 1.9 布局：左右两栏，控件都在输入卡里 ----------
  const noSidePanel = (await evalJs(`document.querySelectorAll('#sidePanel, .side, .workspace').length`)) === 0;
  check('没有额外的侧栏容器（回到两栏）', noSidePanel === true);

  const inComposer = await evalJs(`(() => {
    const ids = ['styleChips','targetModel','language','detail','extra','pinbox'];
    return ids.map((id) => ({ id, ok: !!document.querySelector('#viewPrompt .composer #' + id) }));
  })()`);
  const notInComposer = inComposer.filter((x) => !x.ok).map((x) => x.id);
  check('风格/模型/语言/详细度/附加要求/置顶词都在输入卡里',
    notInComposer.length === 0, notInComposer.length ? `缺：${notInComposer.join(',')}` : '全部在输入卡内');

  const gridCols = await evalJs(`getComputedStyle(document.querySelector('#viewPrompt')).gridTemplateColumns`);
  check('输入卡与结果卡左右分栏', gridCols.split(' ').length === 2, gridCols);

  check('初始状态：角色保存按钮禁用',
    (await evalJs(`document.querySelector('#btnCharSave').disabled`)) === true);
  check('页面里已经没有原生 datalist', (await evalJs(`document.querySelectorAll('datalist').length`)) === 0);

  // ---------- 1.6 主页「目标模型」下拉框 ----------
  await evalJs(`document.querySelector('#btnToggleTarget').click(); true`);
  await sleep(250);
  check('目标模型下拉框能展开', (await visible('#targetModelList')) === true);
  const targetCount = await evalJs(`document.querySelectorAll('#targetModelList .combo-item').length`);
  check('目标模型下拉框有选项', targetCount > 0, `实际 ${targetCount} 个`);
  await evalJs(`(() => {
    const it = document.querySelectorAll('#targetModelList .combo-item')[0];
    it.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
    return true;
  })()`);
  await sleep(250);
  const targetPicked = await evalJs(`document.querySelector('#targetModel').value`);
  check('目标模型能点选并回填', targetPicked === 'SDXL', targetPicked);
  check('选中后目标模型列表收起', (await visible('#targetModelList')) === false);

  // ---------- 1.7 随机灵感（走模型） ----------
  check('灵感条初始隐藏', (await visible('#ideaBar')) === false);
  await evalJs(`document.querySelector('#btnRandom').click(); true`);
  let ideasReady = false;
  for (let i = 0; i < 60; i++) {
    ideasReady = (await evalJs(`document.querySelectorAll('#ideaChips .idea-chip').length`)) > 0;
    if (ideasReady) break;
    await sleep(200);
  }
  check('点随机灵感后出现候选句', ideasReady);
  const ideaTexts = await evalJs(`[...document.querySelectorAll('#ideaChips .idea-chip')].map(e=>e.textContent)`);
  check('灵感条真的显示了', (await visible('#ideaBar')) === true);
  check('一次给多条候选', ideaTexts.length >= 5, `实际 ${ideaTexts.length} 条`);
  // 这句只在假接口里存在，能对上就说明确实走了接口而不是本地词库
  check('候选句来自接口而非本地词库',
    ideaTexts[0] === '凌晨四点的便利店门口，一个值夜班的人蹲在台阶上吃关东煮',
    ideaTexts[0]);
  const ideaHint = await evalJs(`document.querySelector('#ideaHint').textContent`);
  check('提示写明是模型现编', /模型现编/.test(ideaHint), ideaHint);

  // 点一条填进输入框
  await evalJs(`document.querySelectorAll('#ideaChips .idea-chip')[1].click(); true`);
  await sleep(250);
  const filledSentence = await evalJs(`document.querySelector('#sentence').value`);
  check('点候选句会填进输入框', filledSentence === ideaTexts[1], filledSentence);
  check('被选中的那条有高亮', (await evalJs(`document.querySelectorAll('#ideaChips .idea-chip.picked').length`)) === 1);

  // 收起
  await evalJs(`document.querySelector('#btnIdeaClose').click(); true`);
  await sleep(250);
  check('灵感条能收起', (await visible('#ideaBar')) === false);

  const statusText = await evalJs(`document.querySelector('#statusText').textContent`);
  check('状态栏显示已配置 Key', /已配置|deepseek|mock/i.test(statusText), statusText);

  const serverFeatures = await evalJs(`fetch('/api/config').then(r=>r.json()).then(j=>j.features)`);
  check('服务端声明细分接口可用', serverFeatures?.segment === true, JSON.stringify(serverFeatures));

  // 模拟前端拿到了新页面、后端还是旧进程的情况
  await evalJs(`S.serverStale = true; switchView('segment'); true`);
  await sleep(200);
  const staleMsg = await evalJs(`document.querySelector('#segErr').hidden ? '' : document.querySelector('#segErr').textContent`);
  check('旧服务端会提示重启', /旧进程/.test(staleMsg), staleMsg);
  await evalJs(`S.serverStale = false; hideSegErr(); switchView('prompt'); true`);

  const cfgBase = await evalJs(`fetch('/api/config').then(r=>r.json()).then(j=>j.baseURL)`);
  log(`      当前 BaseURL: ${cfgBase}`);

  // ---------- 2. 置顶词：填入 ----------
  const PIN = 'masterpiece, best quality, very aesthetic, absurdres';
  await evalJs(`(() => {
    const s = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); };
    s(document.querySelector('#pinPositive'), ${JSON.stringify(PIN)});
    s(document.querySelector('#pinNegative'), 'worst quality, lowres');
    const cb = document.querySelector('#pinEnabled');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', {bubbles:true}));
    document.querySelector('#targetModel').value = 'SDXL';
    s(document.querySelector('#sentence'), '雨夜的霓虹街头，一位赛博朋克女剑客回头看向镜头');
    return true;
  })()`);
  await sleep(1100); // 等防抖保存

  const savedCfg = await evalJs(`fetch('/api/config').then(r=>r.json())`);
  check('置顶正向词已持久化到服务端', savedCfg.pinnedPositive === PIN, JSON.stringify(savedCfg.pinnedPositive));
  check('置顶负向词已持久化到服务端', savedCfg.pinnedNegative === 'worst quality, lowres');
  check('置顶词开关默认开启', savedCfg.pinEnabled === true);

  // ---------- 3. 生成 ----------
  await evalJs(`document.querySelector('#btnGenerate').click(); true`);
  let done = false;
  for (let i = 0; i < 100; i++) {
    done = await visible('#cards');
    if (done) break;
    const err = await evalJs(`document.querySelector('#err').hidden ? '' : document.querySelector('#err').textContent`);
    if (err) { log(`      生成报错: ${err}`); break; }
    await sleep(200);
  }
  check('生成结果卡片已出现', done);

  const pos = await evalJs(`document.querySelector('#outPositive').textContent`);
  const neg = await evalJs(`document.querySelector('#outNegative').textContent`);
  const title = await evalJs(`document.querySelector('#outTitle').textContent`);
  const parsedOk = await evalJs(`document.querySelector('#outPositive').textContent.length`);
  check('生成结果卡片真的可见了', await visible('#cards'), `正向文本 ${parsedOk} 字`);
  const transInitial = await evalJs(`document.querySelector('#outTranslation').textContent`);
  check('置顶提示词确实随请求发给了模型',
    transInitial.includes('MARKER-固定画风-ABC123'), transInitial.slice(0, 62));

  // ---------- 3.2 保存到本地（提示词） ----------
  check('生成后保存按钮可用',
    (await evalJs(`document.querySelector('#btnSavePrompt').disabled`)) === false);
  await evalJs(`document.querySelector('#btnSavePrompt').click(); true`);
  await sleep(1000);

  const toastText = await evalJs(`document.querySelector('#toast').textContent`);
  check('保存后有提示', /已保存/.test(toastText), toastText);
  check('保存提示里带文件名', /\.md/.test(toastText), toastText);

  const filesAfterPrompt = savedFiles();
  check('提示词已写成磁盘文件', filesAfterPrompt.length >= 1, filesAfterPrompt.join(' | '));
  const promptFile = filesAfterPrompt.find((f) => f.includes('提示词')) || filesAfterPrompt[0] || '';
  const promptSaved = readSaved(promptFile);
  check('文件里有正向与负向两段',
    promptSaved.includes('## 正向提示词') && promptSaved.includes('## 负向提示词'), promptFile);
  check('文件里含原始描述', promptSaved.includes('> 原始描述：'), '');
  check('文件里含画面解读', promptSaved.includes('## 画面解读'), '');
  check('保存的是带置顶词的实际版本',
    promptSaved.includes('masterpiece, best quality'), '');
  check('文件名带时间戳和类型', /^\d{8}-\d{6}_提示词_/.test(promptFile), promptFile);

  const filesBeforeCtrlS = savedFiles().length;
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'s', ctrlKey:true, bubbles:true, cancelable:true})); true`);
  await sleep(1300);
  const filesAfterCtrlS = savedFiles().length;
  check('Ctrl+S 也能保存当前结果', filesAfterCtrlS === filesBeforeCtrlS + 1, `${filesBeforeCtrlS} -> ${filesAfterCtrlS}`);
  check('生成后流式框已隐藏', (await visible('#stream')) === false);
  const badgeP = await visible('#pinBadgeP');
  const badgeN = await visible('#pinBadgeN');
  const kwCount = await evalJs(`document.querySelectorAll('#outKeywords .kw').length`);
  const badgeCount = await evalJs(`document.querySelectorAll('#outBadges .badge').length`);
  const extraShown = await visible('#cardExtra');

  check('正向提示词以置顶词开头', pos.startsWith(PIN + ', '), pos.slice(0, 70));
  check('负向提示词以置顶负向词开头', neg.startsWith('worst quality, lowres'), neg.slice(0, 60));
  const lowresCount = (neg.match(/\blowres\b/g) || []).length;
  check('置顶词与正文的重复标签被去重', lowresCount === 1, `lowres 出现 ${lowresCount} 次`);
  check('正向卡片显示「含置顶词」标记', badgeP === true);
  check('负向卡片显示「含置顶词」标记', badgeN === true);
  check('标题已渲染', !!title, title);
  check('关键词渲染 >= 3', kwCount >= 3, `实际 ${kwCount}`);
  check('参数徽章渲染 >= 3', badgeCount >= 3, `实际 ${badgeCount}`);
  check('参数建议卡片显示', extraShown === true);

  // 徽章要记住生成时的语言：生成完再改下拉框，旧结果不能跟着变
  const langBadgeFix = await evalJs(`(() => {
    const read = () => [...document.querySelectorAll('#outBadges .badge')]
      .map(e => e.textContent).find(t => t === '中文' || t === '英文');
    const before = read();
    document.querySelector('#language').value = 'zh';
    renderResult(S.current.parsed, { sentence: S.current.sentence });
    const after = read();
    document.querySelector('#language').value = 'en';
    renderResult(S.current.parsed, { sentence: S.current.sentence });
    return { before, after };
  })()`);
  check('结果语言徽章不跟随当前下拉框',
    langBadgeFix.before === '英文' && langBadgeFix.after === '英文', JSON.stringify(langBadgeFix));

  const hist = await evalJs(`document.querySelector('#historyCount').textContent`);
  check('历史记录 +1', Number(hist) >= 1, `count=${hist}`);

  // ---------- 3.5 微调 ----------
  check('生成后微调区出现', (await visible('#refineBar')) === true);
  check('撤回按钮初始不可用', (await evalJs(`document.querySelector('#btnUndoRefine').disabled`)) === true);
  const chipCountRefine = await evalJs(`document.querySelectorAll('#refineChips button').length`);
  check('微调快捷选项已渲染', chipCountRefine >= 8, `实际 ${chipCountRefine} 个`);

  const titleBefore = await evalJs(`document.querySelector('#outTitle').textContent`);
  await evalJs(`(() => {
    const b = [...document.querySelectorAll('#refineChips button')].find(x => x.textContent.includes('竖构图'));
    b.click();
    return true;
  })()`);

  let refined = false;
  for (let i = 0; i < 100; i++) {
    const t = await evalJs(`document.querySelector('#outTitle').textContent`);
    if (t !== titleBefore) { refined = true; break; }
    await sleep(200);
  }
  check('微调后结果标题发生变化', refined, `"${titleBefore}" → "${await evalJs(`document.querySelector('#outTitle').textContent`)}"`);

  const posAfterRefine = await evalJs(`document.querySelector('#outPositive').textContent`);
  const transAfterRefine = await evalJs(`document.querySelector('#outTranslation').textContent`);
  const statusAfterRefine = await evalJs(`document.querySelector('#refineStatus').textContent`);

  check('微调后的提示词已更新', posAfterRefine.includes('vertical portrait composition'), posAfterRefine.slice(0, 50));
  check('微调结果仍带置顶词（只带一次）',
    posAfterRefine.startsWith(PIN + ', ') && (posAfterRefine.match(/masterpiece/g) || []).length === 1,
    `开头=${posAfterRefine.slice(0, 40)}`);
  check('微调请求确实带上了修改指令', /竖构图/.test(transAfterRefine), transAfterRefine.slice(0, 60));
  check('发给模型的提示词不含置顶词', !/masterpiece/.test(transAfterRefine), '模型收到的开头应是无前缀原文');
  check('微调次数已显示', /已微调 1 次/.test(statusAfterRefine), statusAfterRefine);
  check('微调后撤回按钮可用', (await evalJs(`document.querySelector('#btnUndoRefine').disabled`)) === false);

  // 撤回
  await evalJs(`document.querySelector('#btnUndoRefine').click(); true`);
  await sleep(400);
  const titleAfterUndo = await evalJs(`document.querySelector('#outTitle').textContent`);
  const statusAfterUndo = await evalJs(`document.querySelector('#refineStatus').textContent`);
  const undoDisabled = await evalJs(`document.querySelector('#btnUndoRefine').disabled`);
  check('撤回能回到微调前的结果', titleAfterUndo === titleBefore, `"${titleAfterUndo}"`);
  check('撤回后微调计数清零', statusAfterUndo === '', `"${statusAfterUndo}"`);
  check('撤回后撤回按钮重新禁用', undoDisabled === true);

  // 手输指令 + Enter
  await evalJs(`(() => {
    const i = document.querySelector('#refineInput');
    i.value = '换成黑白的';
    i.dispatchEvent(new Event('input', {bubbles:true}));
    i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
    return true;
  })()`);
  let refined2 = false;
  for (let i = 0; i < 100; i++) {
    const s = await evalJs(`document.querySelector('#refineStatus').textContent`);
    if (/已微调 1 次/.test(s)) { refined2 = true; break; }
    await sleep(200);
  }
  check('手输指令按 Enter 也能微调', refined2, `status="${await evalJs(`document.querySelector('#refineStatus').textContent`)}"`);

  // 微调后历史条目是就地更新，不应该多出一条
  const histAfterRefine = await evalJs(`document.querySelector('#historyCount').textContent`);
  check('微调不会刷屏历史记录', Number(histAfterRefine) === Number(hist), `微调前 ${hist} → 微调后 ${histAfterRefine}`);
  const histTopPositive = await evalJs(`(JSON.parse(localStorage.getItem('prompt-forge-history-v1')||'[]')[0]||{}).positive||''`);
  check('历史里存的是微调后的版本', histTopPositive.includes('vertical portrait composition'), histTopPositive.slice(0, 40));

  await sleep(300);
  let shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'shot-with-pin.png'), Buffer.from(shot.data, 'base64'));

  // ---------- 4. 关掉置顶词开关 ----------
  await evalJs(`(() => {
    const cb = document.querySelector('#pinEnabled');
    cb.checked = false;
    cb.dispatchEvent(new Event('change', {bubbles:true}));
    return true;
  })()`);
  await sleep(400);
  const posOff = await evalJs(`document.querySelector('#outPositive').textContent`);
  const badgePOff = await visible('#pinBadgeP');
  check('关闭开关后不再拼置顶词', !posOff.startsWith('masterpiece'), posOff.slice(0, 60));
  check('关闭开关后隐藏「含置顶词」标记', badgePOff === false);
  check('关闭开关后置顶词框置灰', await evalJs(`document.querySelector('#pinbox').classList.contains('off')`));

  // ---------- 5. 重新打开并刷新页面，检查持久化 ----------
  await evalJs(`(() => {
    const cb = document.querySelector('#pinEnabled');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', {bubbles:true}));
    return true;
  })()`);
  await sleep(900);
  await cdp.send('Page.reload', { ignoreCache: false });
  await sleep(1500);
  for (let i = 0; i < 40; i++) {
    const ok = await evalJs(`!!document.querySelector('#styleChips .chip')`).catch(() => false);
    if (ok) break;
    await sleep(200);
  }
  const pinAfterReload = await evalJs(`document.querySelector('#pinPositive').value`);
  const enabledAfterReload = await evalJs(`document.querySelector('#pinEnabled').checked`);
  check('刷新后置顶词仍在', pinAfterReload === PIN, JSON.stringify(pinAfterReload));
  check('刷新后开关状态仍在', enabledAfterReload === true);

  const posAfterReload = await evalJs(`document.querySelector('#outPositive').textContent`);
  check('刷新后结果区回到空状态', posAfterReload.trim() === '', JSON.stringify(posAfterReload));

  // ---------- 6. 风格切换 ----------
  await evalJs(`document.querySelectorAll('#styleChips .chip')[1].click(); true`);
  const activeStyle = await evalJs(`document.querySelector('#styleChips .chip.active b').textContent`);
  check('可以切换到 NovelAI 风格', /NovelAI/.test(activeStyle), activeStyle);

  // ---------- 7. 设置弹窗 ----------
  await evalJs(`document.querySelector('#btnSettings').click(); true`);
  await sleep(350);
  const dialogOpen = await evalJs(`document.querySelector('#settings').open`);
  check('设置弹窗能打开', dialogOpen === true);
  check('设置弹窗真的可见', (await visible('#settings')) === true);
  const apiPinnedShown = await evalJs(`document.querySelector('#cfgApiPinned').value`);
  check('设置里有「置顶提示词（会发送给 API）」这一栏',
    (await visible('#cfgApiPinned')) === true, `值="${apiPinnedShown}"`);
  check('已保存的置顶提示词能回显到设置里',
    apiPinnedShown === 'MARKER-固定画风-ABC123', apiPinnedShown);
  const ideaPinDefault = await evalJs(`document.querySelector('#cfgApiPinnedIdea').checked`);
  check('灵感请求的置顶开关默认关闭', ideaPinDefault === false);
  const keyPlaceholder = await evalJs(`document.querySelector('#cfgKey').placeholder`);
  check('设置里 Key 显示为已保存占位', /已保存/.test(keyPlaceholder), keyPlaceholder);

  // ---------- 7.5 模型下拉框 ----------
  const listClosedAtFirst = (await visible('#modelList')) === false;
  check('下拉框初始是收起的', listClosedAtFirst);

  await evalJs(`document.querySelector('#btnToggleModels').click(); true`);
  await sleep(250);
  check('点箭头能展开下拉框', (await visible('#modelList')) === true);
  const presetCount = await evalJs(`document.querySelectorAll('#modelList .combo-item').length`);
  check('展开后有可选模型（未拉取时给常用预设）', presetCount > 0, `实际 ${presetCount} 个`);
  const ariaOpen = await evalJs(`document.querySelector('#cfgModel').getAttribute('aria-expanded')`);
  check('输入框 aria-expanded 同步为 true', ariaOpen === 'true');

  // 输入过滤
  await evalJs(`(() => {
    const i = document.querySelector('#cfgModel');
    i.value = 'deep';
    i.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  await sleep(250);
  const filtered = await evalJs(`[...document.querySelectorAll('#modelList .combo-item')].map(e=>e.dataset.value)`);
  check('输入关键词能过滤列表', filtered.length === 2 && filtered.every((m) => m.includes('deep')), JSON.stringify(filtered));

  // 鼠标点选
  await evalJs(`(() => {
    const it = document.querySelectorAll('#modelList .combo-item')[1];
    it.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
    return true;
  })()`);
  await sleep(250);
  const picked = await evalJs(`document.querySelector('#cfgModel').value`);
  check('点列表项能选中并回填输入框', picked === 'deepseek-reasoner', picked);
  check('选中后下拉框自动收起', (await visible('#modelList')) === false);

  // 键盘操作
  await evalJs(`(() => {
    const i = document.querySelector('#cfgModel');
    i.value = '';
    i.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  await sleep(200);
  await evalJs(`(() => {
    const i = document.querySelector('#cfgModel');
    for (const key of ['ArrowDown','ArrowDown','Enter']) {
      i.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles:true, cancelable:true}));
    }
    return true;
  })()`);
  await sleep(250);
  const kbPicked = await evalJs(`document.querySelector('#cfgModel').value`);
  check('键盘 ↓↓ + Enter 能选中第二项', kbPicked === 'deepseek-reasoner', kbPicked);

  // Esc 只收列表，不关弹窗
  await evalJs(`document.querySelector('#btnToggleModels').click(); true`);
  await sleep(200);
  await evalJs(`document.querySelector('#cfgModel').dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true})); true`);
  await sleep(250);
  check('Esc 收起下拉框', (await visible('#modelList')) === false);
  check('Esc 后设置弹窗仍打开', (await evalJs(`document.querySelector('#settings').open`)) === true);

  // 拉取列表（走 mock 接口）
  await evalJs(`document.querySelector('#btnLoadModels').click(); true`);
  await sleep(1200);
  const fetchedItems = await evalJs(`[...document.querySelectorAll('#modelList .combo-item')].map(e=>e.dataset.value)`);
  check('拉取列表后下拉框自动展开', (await visible('#modelList')) === true);
  check('拉取到的模型出现在列表里', fetchedItems.length >= 2, JSON.stringify(fetchedItems));
  const groupText = await evalJs(`document.querySelector('#modelList .combo-group').textContent`);
  check('列表头显示已拉取数量', /已拉取\s*2/.test(groupText), groupText);

  // 点别处收起
  await evalJs(`document.querySelector('#settings h3').dispatchEvent(new MouseEvent('mousedown', {bubbles:true})); true`);
  await sleep(200);
  check('点别处能收起下拉框', (await visible('#modelList')) === false);

  shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'shot-settings.png'), Buffer.from(shot.data, 'base64'));

  await evalJs(`document.querySelector('#btnCancelSettings').click(); true`);
  await sleep(200);

  // ---------- 8. 历史抽屉 ----------
  await evalJs(`document.querySelector('#btnHistory').click(); true`);
  await sleep(350);
  check('历史抽屉能打开', (await visible('#drawer')) === true);
  check('打开时遮罩可见', (await visible('#drawerMask')) === true);
  const histItems = await evalJs(`document.querySelectorAll('.hist-item').length`);
  check('历史里有记录', histItems >= 1, `实际 ${histItems}`);

  // 历史搜索
  await evalJs(`(() => {
    const f = document.querySelector('#histFilter');
    f.value = '一个绝对不存在的关键词';
    f.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  await sleep(350);
  check('历史搜索无匹配时为空',
    (await evalJs(`document.querySelectorAll('.hist-item').length`)) === 0);
  await evalJs(`(() => {
    const f = document.querySelector('#histFilter');
    f.value = '';
    f.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  await sleep(350);
  check('历史搜索清空后恢复列表',
    (await evalJs(`document.querySelectorAll('.hist-item').length`)) === histItems);

  // 单条删除
  await evalJs(`document.querySelectorAll('.hist-item .h-del')[0].click(); true`);
  await sleep(450);
  const histAfterDel = await evalJs(`document.querySelectorAll('.hist-item').length`);
  check('能删除单条历史', histAfterDel === histItems - 1, `${histItems} -> ${histAfterDel}`);
  const histBadge = await evalJs(`document.querySelector('#historyCount').textContent`);
  check('历史计数同步减少', Number(histBadge) === histAfterDel, `badge=${histBadge}`);

  // 历史删除可撤销
  check('历史删除出现撤销按钮',
    (await evalJs(`!!document.querySelector('#toast .toast-undo')`)) === true);
  await evalJs(`document.querySelector('#toast .toast-undo').click(); true`);
  await sleep(500);
  const histAfterUndo = await evalJs(`document.querySelectorAll('.hist-item').length`);
  check('撤销删除能恢复历史', histAfterUndo === histItems, `${histAfterDel} -> ${histAfterUndo}`);
  const histBadgeUndo = await evalJs(`document.querySelector('#historyCount').textContent`);
  check('撤销后历史计数恢复', Number(histBadgeUndo) === histItems, `badge=${histBadgeUndo}`);

  // 清空全部也能撤销（先接管 confirm，无头浏览器里原生弹窗会卡住）
  await evalJs(`window.confirm = () => true; document.querySelector('#btnClearHistory').click(); true`);
  await sleep(450);
  check('清空历史后列表为空',
    (await evalJs(`document.querySelectorAll('.hist-item').length`)) === 0);
  await evalJs(`document.querySelector('#toast .toast-undo').click(); true`);
  await sleep(500);
  const histAfterClearUndo = await evalJs(`document.querySelectorAll('.hist-item').length`);
  check('撤销清空能恢复全部历史', histAfterClearUndo === histItems, `恢复到 ${histAfterClearUndo} 条`);

  shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'shot-history.png'), Buffer.from(shot.data, 'base64'));

  // 点「关闭」—— 这里回归的就是用户报的 bug
  await evalJs(`document.querySelector('#btnCloseDrawer').click(); true`);
  await sleep(400);
  check('点「关闭」后抽屉真的消失了', (await visible('#drawer')) === false);
  check('点「关闭」后遮罩真的消失了', (await visible('#drawerMask')) === false);

  // 点遮罩也能关
  await evalJs(`document.querySelector('#btnHistory').click(); true`);
  await sleep(350);
  await evalJs(`document.querySelector('#drawerMask').click(); true`);
  await sleep(400);
  check('点遮罩也能关闭抽屉', (await visible('#drawer')) === false);

  // ---------- 8.5 角色设定界面 ----------
  // 先放一句话在提示词视图里，待会儿切回来验证内容没丢
  await evalJs(`(() => {
    const s = document.querySelector('#sentence');
    s.value = '视图切换不该丢内容';
    s.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);

  await evalJs(`document.querySelector('#mainTabs .tab[data-view="character"]').click(); true`);
  await sleep(300);
  check('能切到角色设定视图',
    (await visible('#viewCharacter')) === true && (await visible('#viewPrompt')) === false);
  check('角色视图里没有正负提示词和置顶词',
    (await evalJs(`document.querySelectorAll('#viewCharacter #outPositive, #viewCharacter #pinbox, #viewCharacter #refineBar').length`)) === 0);

  // 快捷键 Ctrl+1 / Ctrl+2 切页签
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'1', ctrlKey:true, bubbles:true, cancelable:true})); true`);
  await sleep(300);
  check('Ctrl+1 切回提示词视图', (await visible('#viewPrompt')) === true);
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'2', ctrlKey:true, bubbles:true, cancelable:true})); true`);
  await sleep(300);
  check('Ctrl+2 切到角色设定视图', (await visible('#viewCharacter')) === true);

  // Ctrl+3 切到新的细分提示词页
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'3', ctrlKey:true, bubbles:true, cancelable:true})); true`);
  await sleep(300);
  check('Ctrl+3 切到细分提示词视图',
    (await visible('#viewSegment')) === true
      && (await visible('#viewPrompt')) === false
      && (await visible('#viewCharacter')) === false);
  const segTypeCount = await evalJs(`document.querySelectorAll('#segTypeChips .chip').length`);
  check('细分页有 7 类标签可选', segTypeCount === 7, `实际 ${segTypeCount}`);
  const segDefaultType = await evalJs(`document.querySelector('#segTypeChips .chip.active b').textContent`);
  check('细分页默认选中服饰穿搭', segDefaultType === '服饰穿搭', segDefaultType);

  // 切回角色视图，继续后面的角色生成
  await evalJs(`document.querySelector('#mainTabs .tab[data-view="character"]').click(); true`);
  await sleep(300);

  await evalJs(`(() => {
    const t = document.querySelector('#charSentence');
    t.value = '三个流浪乐手在地铁站出口表演，傍晚刚下过雨';
    t.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  await evalJs(`document.querySelector('#btnCharGenerate').click(); true`);
  let charDone = false;
  for (let i = 0; i < 120; i++) {
    charDone = await visible('#charCards');
    if (charDone) break;
    await sleep(200);
  }
  check('角色提示词生成成功', charDone,
    await evalJs(`document.querySelector('#charErr').hidden ? '' : document.querySelector('#charErr').textContent`));

  const charCards = await evalJs(`[...document.querySelectorAll('#charCards .card-head span')].map(e=>e.textContent)`);
  check('有英文提示词和中文对照两张卡',
    charCards.some((t) => /英文/.test(t)) && charCards.some((t) => /中文/.test(t)), JSON.stringify(charCards));

  const charEn = await evalJs(`document.querySelectorAll('#charCards .card-body')[0].textContent`);
  const charZh = await evalJs(`document.querySelectorAll('#charCards .card-body')[1].textContent`);

  check('英文提示词是一整段（没有换行）', !/\n/.test(charEn.trim()), `换行数 ${(charEn.match(/\n/g) || []).length}`);
  const wordCount = charEn.trim().split(/\s+/).filter(Boolean).length;
  check('英文提示词长度像样（>60 词）', wordCount > 60, `${wordCount} 词`);
  check('英文里不含中文', !/[\u4e00-\u9fa5]/.test(charEn), charEn.slice(0, 50));
  check('英文里带镜头与画质词',
    /35mm|f\/2\.8|lens/i.test(charEn) && /cinematic lighting|8k/i.test(charEn), charEn.slice(-60));
  check('中文对照是中文且不为空',
    /[\u4e00-\u9fa5]/.test(charZh) && charZh.length > 80, `${charZh.length} 字`);
  check('中文对照里没有大段英文', (charZh.match(/[a-zA-Z]{6,}/g) || []).length <= 3,
    JSON.stringify((charZh.match(/[a-zA-Z]{6,}/g) || []).slice(0, 5)));
  check('角色界面也带上了置顶提示词', charZh.includes('MARKER-固定画风-ABC123'), charZh.slice(0, 40));

  const charBadges = await evalJs(`[...document.querySelectorAll('#charCards .badges .badge')].map(e=>e.textContent)`);
  check('顶部显示词数与画幅',
    charBadges.some((b) => /词/.test(b)) && charBadges.some((b) => /16:9/.test(b)), JSON.stringify(charBadges));

  check('复制英文按钮已启用',
    (await evalJs(`document.querySelector('#btnCharCopyAll').disabled`)) === false);
  const charCopyText = await evalJs(`S.charText`);
  check('角色页的复制英文只含英文',
    charCopyText.length > 50 && !/[\u4e00-\u9fa5]/.test(charCopyText), charCopyText.slice(0, 40));
  check('每张卡都有自己的复制按钮',
    (await evalJs(`document.querySelectorAll('#charCards .card-head .copy').length`)) === 2);

  // ---------- 8.55 保存到本地（角色设定） ----------
  check('角色保存按钮可用',
    (await evalJs(`document.querySelector('#btnCharSave').disabled`)) === false);
  await evalJs(`document.querySelector('#btnCharSave').click(); true`);
  await sleep(1000);
  const filesAfterChar = savedFiles();
  check('角色设定也存成了文件', filesAfterChar.length >= 2, filesAfterChar.join(' | '));
  const charFile = filesAfterChar.find((f) => f.includes('角色设定')) || '';
  const charSaved = readSaved(charFile);
  check('角色文件名带类型', /_角色设定_/.test(charFile), charFile);
  check('文件里有英文提示词与中文对照',
    charSaved.includes('## 英文提示词') && charSaved.includes('## 中文对照'), charFile);
  check('文件里英文段是完整一段',
    (charSaved.split('## 英文提示词')[1] || '').split('## 中文对照')[0].trim().length > 300, '');

  // ---------- 8.6 角色提示词的微调 ----------
  check('生成后角色微调区出现', (await visible('#charRefineBar')) === true);
  check('角色撤回按钮初始不可用',
    (await evalJs(`document.querySelector('#btnCharUndoRefine').disabled`)) === true);
  const charChipCount = await evalJs(`document.querySelectorAll('#charRefineChips button').length`);
  check('角色微调快捷项已渲染', charChipCount >= 8, `实际 ${charChipCount} 个`);
  // 生成结束后微调区必须是可用的（这一条专抓「忘了刷新禁用态」的 bug）
  const chipsDisabled = await evalJs(`[...document.querySelectorAll('#charRefineChips button')].filter(b => b.disabled).length`);
  check('生成结束后微调快捷项是可点的', chipsDisabled === 0, `禁用 ${chipsDisabled} 个`);
  check('生成结束后微调输入框是可用的',
    (await evalJs(`document.querySelector('#charRefineInput').disabled`)) === false);

  const charTitleBefore = await evalJs(`document.querySelector('#charCards h3').textContent`);
  const enBefore = charEn;
  await evalJs(`(() => {
    const b = [...document.querySelectorAll('#charRefineChips button')].find(x => x.textContent.includes('夜景'));
    b.click();
    return true;
  })()`);

  let charRefined = false;
  for (let i = 0; i < 120; i++) {
    const t = await evalJs(`document.querySelector('#charCards h3').textContent`);
    if (t !== charTitleBefore) { charRefined = true; break; }
    await sleep(200);
  }
  check('角色微调后标题变化', charRefined,
    `"${charTitleBefore}" -> "${await evalJs(`document.querySelector('#charCards h3').textContent`)}"`);

  const enAfter = await evalJs(`document.querySelectorAll('#charCards .card-body')[0].textContent`);
  const zhAfter = await evalJs(`document.querySelectorAll('#charCards .card-body')[1].textContent`);
  check('英文提示词确实变了', enAfter !== enBefore && /nighttime/i.test(enAfter), enAfter.slice(0, 48));
  check('中文对照也跟着变了', /夜里|晚上/.test(zhAfter), zhAfter.slice(0, 36));
  check('微调指令确实发给了模型', /改成夜景/.test(zhAfter), zhAfter.slice(0, 26));
  check('微调后英文仍是一整段', !/\n/.test(enAfter.trim()));
  check('微调后英文仍不含中文', !/[\u4e00-\u9fa5]/.test(enAfter));
  const charRefineStatus = await evalJs(`document.querySelector('#charRefineStatus').textContent`);
  check('微调次数已显示', /已微调 1 次/.test(charRefineStatus), charRefineStatus);
  check('微调后撤回可用',
    (await evalJs(`document.querySelector('#btnCharUndoRefine').disabled`)) === false);

  // 撤回
  await evalJs(`document.querySelector('#btnCharUndoRefine').click(); true`);
  await sleep(400);
  const enUndone = await evalJs(`document.querySelectorAll('#charCards .card-body')[0].textContent`);
  check('撤回能回到微调前的英文', enUndone === enBefore, enUndone.slice(0, 38));
  check('撤回后计数清零',
    (await evalJs(`document.querySelector('#charRefineStatus').textContent`)) === '');
  check('撤回后撤回按钮重新禁用',
    (await evalJs(`document.querySelector('#btnCharUndoRefine').disabled`)) === true);

  // 切回去，原来的输入应该都还在（不重新加载页面）
  await evalJs(`document.querySelector('#mainTabs .tab[data-view="prompt"]').click(); true`);
  await sleep(300);
  check('能切回提示词视图', (await visible('#viewPrompt')) === true);
  check('切回后输入的一句话还在',
    (await evalJs(`document.querySelector('#sentence').value`)) === '视图切换不该丢内容',
    JSON.stringify(await evalJs(`document.querySelector('#sentence').value`)));
  check('切回后置顶词还在', (await evalJs(`document.querySelector('#pinPositive').value`)) === PIN);
  check('切回后角色设定的句子也还在',
    (await evalJs(`document.querySelector('#charSentence').value.length`)) > 5);

  // ---------- 8.7 保存库（可视化浏览 saved/ 目录） ----------
  const libBtnCount = await evalJs(`document.querySelector('#libBtnCount').textContent`);
  check('底部保存库计数已更新', Number(libBtnCount) >= 2, `count=${libBtnCount}`);

  await evalJs(`localStorage.removeItem('pf-lib-collapsed'); true`);
  await evalJs(`document.querySelector('#btnLibrary').click(); true`);
  await sleep(900);
  check('保存库能打开', (await visible('#libDrawer')) === true);
  const libItems = await evalJs(`document.querySelectorAll('#libList .lib-item').length`);
  check('保存库列出已保存的条目', libItems >= 2, `实际 ${libItems} 条`);

  const libKinds = await evalJs(`[...document.querySelectorAll('#libList .lib-kind')].map(e=>e.textContent)`);
  check('类型标签区分提示词与角色设定',
    libKinds.includes('提示词') && libKinds.includes('角色设定'), JSON.stringify(libKinds));

  const libGroups = await evalJs(`[...document.querySelectorAll('#libList .lib-group')].map(g => ({
    kind: g.dataset.kind,
    count: g.querySelectorAll('.lib-item').length,
  }))`);
  check('保存库按大分类分组',
    libGroups.length === 2
      && libGroups[0].kind === '提示词' && libGroups[1].kind === '角色设定'
      && libGroups[0].count + libGroups[1].count === libItems,
    JSON.stringify(libGroups));

  // 保存库的「复制」只给英文，不把中文对照拼进去
  const charLibCopy = await evalJs(`savedCopyText({ meta: { kind: 'character', prompt_en: 'english only', prompt_zh: '中文对照' } }, 'fallback')`);
  check('保存库复制角色设定只给英文', charLibCopy === 'english only', JSON.stringify(charLibCopy));
  const promptLibCopy = await evalJs(`savedCopyText({ meta: { kind: 'prompt', positive: 'a cat', negative: 'lowres', translation: '一只猫' } }, 'fallback')`);
  check('保存库复制提示词不带中文解读',
    promptLibCopy === ['a cat', 'lowres'].join(String.fromCharCode(10, 10)), JSON.stringify(promptLibCopy));
  const segLibCopy = await evalJs(`savedCopyText({ meta: { kind: 'segment', tags: 'black lace dress, silver buckles' } }, 'fallback')`);
  check('保存库复制细分标签只给标签', segLibCopy === 'black lace dress, silver buckles', JSON.stringify(segLibCopy));

  // 分类标题可点击收起 / 展开
  const promptGroupSel = '#libList .lib-group[data-kind="提示词"]';
  const promptHeadSel = `${promptGroupSel} .lib-group-head`;
  const promptItemSel = `${promptGroupSel} .lib-item`;
  check('分类默认展开',
    (await evalJs(`document.querySelector(${JSON.stringify(promptHeadSel)}).getAttribute('aria-expanded')`)) === 'true');
  await evalJs(`document.querySelector(${JSON.stringify(promptHeadSel)}).click(); true`);
  await sleep(300);
  check('点分类标题能收起',
    (await evalJs(`document.querySelector(${JSON.stringify(promptGroupSel)}).classList.contains('collapsed')`)) === true
      && (await evalJs(`document.querySelector(${JSON.stringify(promptHeadSel)}).getAttribute('aria-expanded')`)) === 'false'
      && (await visible(promptItemSel)) === false);
  const libCollapseState = await evalJs(`localStorage.getItem('pf-lib-collapsed')`);
  check('收起状态已记住', /提示词/.test(libCollapseState || ''), libCollapseState);
  await evalJs(`document.querySelector(${JSON.stringify(promptHeadSel)}).click(); true`);
  await sleep(300);
  check('再点一次能展开',
    (await visible(promptItemSel)) === true
      && (await evalJs(`document.querySelector(${JSON.stringify(promptHeadSel)}).getAttribute('aria-expanded')`)) === 'true');

  const libTitles = await evalJs(`[...document.querySelectorAll('#libList .lib-title')].map(e=>e.textContent)`);
  check('每条都显示名称', libTitles.every((t) => t && t.length > 1), JSON.stringify(libTitles));

  const libSummaries = await evalJs(`[...document.querySelectorAll('#libList .lib-summary')].map(e=>e.textContent)`);
  check('每条都显示摘要', libSummaries.every((s) => s.length > 10), (libSummaries[0] || '').slice(0, 44));

  const libTimes = await evalJs(`[...document.querySelectorAll('#libList .lib-time')].map(e=>e.textContent)`);
  check('每条都显示保存时间', libTimes.every((t) => /^\d{2}-\d{2} \d{2}:\d{2}$/.test(t)), JSON.stringify(libTimes));

  // 列表接口不该把完整正文塞进来（省带宽）
  const listPayload = await evalJs(`fetch('/api/saved').then(r=>r.json()).then(j => JSON.stringify(j.items.map(i => i.meta)))`);
  check('列表接口不返回完整正文',
    !listPayload.includes('"prompt_en"') && !listPayload.includes('"positive"'), listPayload.slice(0, 70));

  // 没有元数据的手写 .md 也要能载入（服务端按 ## 小节兜底解析）
  const HANDMADE = '手写的测试文件.md';
  fs.writeFileSync(path.join(SAVED_DIR, HANDMADE), [
    '# 手写的测试文件',
    '',
    '## 英文提示词',
    '',
    'a handmade english prompt for fallback parsing test',
    '',
    '## 中文对照',
    '',
    '这是手写的中文对照，用来测试兜底解析。',
    '',
  ].join('\n'), 'utf8');
  const handmadeItem = await evalJs(`fetch('/api/saved/item?file=' + encodeURIComponent(${JSON.stringify(HANDMADE)})).then(r=>r.json())`);
  check('手写文件能被识别为角色设定', handmadeItem?.kind === '角色设定', handmadeItem?.kind);
  check('手写文件按小节兜底解析出英文',
    handmadeItem?.meta?.prompt_en === 'a handmade english prompt for fallback parsing test',
    String(handmadeItem?.meta?.prompt_en).slice(0, 40));
  check('手写文件按小节兜底解析出中文',
    /手写的中文对照/.test(String(handmadeItem?.meta?.prompt_zh)), '');
  check('手写文件的标题取自 H1', handmadeItem?.title === '手写的测试文件', handmadeItem?.title);
  // 清理这个手写文件，不影响后面的计数
  fs.unlinkSync(path.join(SAVED_DIR, HANDMADE));

  // 搜索过滤
  await evalJs(`(() => {
    const f = document.querySelector('#libFilter');
    f.value = '角色';
    f.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  await sleep(400);
  const libFiltered = await evalJs(`document.querySelectorAll('#libList .lib-item').length`);
  check('搜索能过滤列表', libFiltered >= 1 && libFiltered < libItems, `${libItems} -> ${libFiltered}`);
  const filteredGroups = await evalJs(`[...document.querySelectorAll('#libList .lib-group')].map(g => g.dataset.kind)`);
  check('搜索时只显示命中的分类',
    filteredGroups.length === 1 && filteredGroups[0] === '角色设定', JSON.stringify(filteredGroups));

  // 清空搜索
  await evalJs(`(() => {
    const f = document.querySelector('#libFilter');
    f.value = '';
    f.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  await sleep(400);

  // 点「载入」把提示词载回界面
  await evalJs(`(() => {
    const items = [...document.querySelectorAll('#libList .lib-item')];
    const target = items.find((el) => el.querySelector('.lib-kind').textContent === '提示词');
    [...target.querySelectorAll('.lib-actions .btn')].find((b) => b.textContent === '载入').click();
    return true;
  })()`);
  await sleep(1000);
  check('载入后抽屉自动关闭', (await visible('#libDrawer')) === false);
  check('载入后切到提示词视图', (await visible('#viewPrompt')) === true);
  const loadedPositive = await evalJs(`document.querySelector('#outPositive').textContent`);
  check('载入的内容渲染到结果区', loadedPositive.length > 20, loadedPositive.slice(0, 40));
  check('载入时置顶词没有被二次拼接',
    (loadedPositive.match(/masterpiece/g) || []).length === 1,
    `masterpiece 出现 ${(loadedPositive.match(/masterpiece/g) || []).length} 次`);

  // ---------- 8.75 重命名 ----------
  // 上面「载入」把抽屉关了，这里重新打开
  await evalJs(`document.querySelector('#btnLibrary').click(); true`);
  await sleep(900);
  const filesBeforeRename = savedFiles().length;
  const nameBefore = await evalJs(`(() => {
    const it = [...document.querySelectorAll('#libList .lib-item')]
      .find((el) => el.querySelector('.lib-kind').textContent === '角色设定');
    return it ? it.querySelector('.lib-title').textContent : '';
  })()`);
  await evalJs(`(() => {
    const it = [...document.querySelectorAll('#libList .lib-item')]
      .find((el) => el.querySelector('.lib-kind').textContent === '角色设定');
    [...it.querySelectorAll('.lib-actions .btn')].find((b) => b.textContent === '重命名').click();
    return true;
  })()`);
  await sleep(500);
  check('点重命名进入编辑态',
    (await evalJs(`document.querySelectorAll('#libList .lib-rename').length`)) === 1);
  const editValue = await evalJs(`document.querySelector('#libList .lib-rename').value`);
  check('编辑框带出原名称', editValue === nameBefore, `${editValue} vs ${nameBefore}`);
  check('编辑态下有保存和取消',
    (await evalJs(`[...document.querySelectorAll('#libList .lib-actions .btn')].map(b=>b.textContent).join(',')`)).includes('取消'));

  // 取消应该还原
  await evalJs(`(() => {
    [...document.querySelectorAll('#libList .lib-actions .btn')].find((b) => b.textContent === '取消').click();
    return true;
  })()`);
  await sleep(400);
  check('取消后退出编辑态',
    (await evalJs(`document.querySelectorAll('#libList .lib-rename').length`)) === 0);
  check('取消后名称没变',
    (await evalJs(`(() => {
      const it = [...document.querySelectorAll('#libList .lib-item')]
        .find((el) => el.querySelector('.lib-kind').textContent === '角色设定');
      return it ? it.querySelector('.lib-title').textContent : '';
    })()`)) === nameBefore);

  // 正式改名
  const NEW_NAME = '改过名的测试条目';
  await evalJs(`(() => {
    const it = [...document.querySelectorAll('#libList .lib-item')]
      .find((el) => el.querySelector('.lib-kind').textContent === '角色设定');
    [...it.querySelectorAll('.lib-actions .btn')].find((b) => b.textContent === '重命名').click();
    return true;
  })()`);
  await sleep(400);
  await evalJs(`(() => {
    const i = document.querySelector('#libList .lib-rename');
    i.value = ${JSON.stringify(NEW_NAME)};
    i.dispatchEvent(new Event('input', {bubbles:true}));
    i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
    return true;
  })()`);
  await sleep(1400);

  const titlesAfterRename = await evalJs(`[...document.querySelectorAll('#libList .lib-title')].map(e=>e.textContent)`);
  check('重命名后列表显示新名称', titlesAfterRename.includes(NEW_NAME), JSON.stringify(titlesAfterRename));
  check('重命名后退出编辑态',
    (await evalJs(`document.querySelectorAll('#libList .lib-rename').length`)) === 0);

  const filesAfterRename = savedFiles();
  const renamedFile = filesAfterRename.find((f) => f.includes(NEW_NAME)) || '';
  check('磁盘文件名也跟着改了', !!renamedFile, filesAfterRename.join(' | '));
  check('文件名保留时间戳与类型前缀', /^\d{8}-\d{6}_(提示词|角色设定)_/.test(renamedFile), renamedFile);

  const renamedContent = readSaved(renamedFile);
  check('正文标题同步更新', renamedContent.startsWith(`# ${NEW_NAME}`), renamedContent.slice(0, 30));
  check('元数据里的标题同步更新', renamedContent.includes(`"title":"${NEW_NAME}"`), '');
  check('重命名后原文内容没丢',
    renamedContent.includes('## 正向提示词') || renamedContent.includes('## 英文提示词'), '');
  check('重命名后元数据字段完整保留',
    renamedContent.includes('"prompt_en"') && renamedContent.includes('"prompt_zh"'),
    (renamedContent.match(/"prompt_(en|zh)"/g) || []).join(','));

  // 改名后详情接口还能正常读出完整内容
  const itemAfterRename = await evalJs(`fetch('/api/saved/item?file=' + encodeURIComponent(${JSON.stringify(renamedFile)})).then(r=>r.json())`);
  check('重命名后仍能读出完整详情',
    itemAfterRename?.title === NEW_NAME && !!itemAfterRename?.meta?.prompt_en,
    `title=${itemAfterRename?.title} 有正文=${!!itemAfterRename?.meta?.prompt_en}`);
  check('重命名不会改变条目数量', filesAfterRename.length === filesBeforeRename, `${filesBeforeRename} -> ${filesAfterRename.length}`);

  // 关闭再打开，确认持久
  await evalJs(`document.querySelector('#btnLibClose').click(); true`);
  await sleep(300);
  await evalJs(`document.querySelector('#btnLibrary').click(); true`);
  await sleep(900);
  const titlesReopened = await evalJs(`[...document.querySelectorAll('#libList .lib-title')].map(e=>e.textContent)`);
  check('重新打开保存库仍是新名称', titlesReopened.includes(NEW_NAME), JSON.stringify(titlesReopened));

  // 删除一条
  await evalJs(`document.querySelector('#btnLibrary').click(); true`);
  await sleep(800);
  await evalJs(`window.confirm = () => true; true`);
  const libBefore = await evalJs(`document.querySelectorAll('#libList .lib-item').length`);
  await evalJs(`(() => {
    const items = [...document.querySelectorAll('#libList .lib-item')];
    [...items[items.length - 1].querySelectorAll('.lib-actions .btn')]
      .find((b) => b.textContent === '删除').click();
    return true;
  })()`);
  await sleep(1200);
  const libAfter = await evalJs(`document.querySelectorAll('#libList .lib-item').length`);
  check('能删除保存项', libAfter === libBefore - 1, `${libBefore} -> ${libAfter}`);
  const filesAfterDelete = savedFiles();
  check('删除时移出了保存目录', filesAfterDelete.length === libAfter, `磁盘 ${filesAfterDelete.length} / 列表 ${libAfter}`);
  const trashAfterDelete = trashedFiles();
  check('删除的文件进了回收站', trashAfterDelete.length === 1, trashAfterDelete.join(' | '));
  const trashMtime = trashAfterDelete.length
    ? fs.statSync(path.join(SAVED_DIR, '.trash', trashAfterDelete[0])).mtimeMs
    : 0;
  check('回收站时间戳记的是删除时间', Date.now() - trashMtime < 60 * 1000,
    `${Math.round((Date.now() - trashMtime) / 1000)}s 前`);
  check('删除提示条带撤销按钮',
    (await evalJs(`!!document.querySelector('#toast .toast-undo')`)) === true);
  // 提示条默认 pointer-events:none，撤销按钮必须真的可见、可点（看计算样式和盒子）
  const undoBtn = await evalJs(`(() => {
    const b = document.querySelector('#toast .toast-undo');
    const toast = document.querySelector('#toast');
    if (!b || !toast) return null;
    const r = b.getBoundingClientRect();
    return {
      w: r.width,
      h: r.height,
      display: getComputedStyle(b).display,
      pointerEvents: getComputedStyle(toast).pointerEvents,
      opacity: getComputedStyle(toast).opacity,
    };
  })()`);
  check('撤销按钮真的可见且可点',
    !!undoBtn && undoBtn.w > 0 && undoBtn.h > 0 && undoBtn.display !== 'none'
      && undoBtn.pointerEvents === 'auto' && Number(undoBtn.opacity) > 0,
    JSON.stringify(undoBtn));

  // 撤销删除：文件应该从回收站搬回来
  await evalJs(`document.querySelector('#toast .toast-undo').click(); true`);
  await sleep(1400);
  const libAfterUndo = await evalJs(`document.querySelectorAll('#libList .lib-item').length`);
  check('撤销删除能恢复条目', libAfterUndo === libBefore, `${libAfter} -> ${libAfterUndo}`);
  check('撤销后回收站清空', trashedFiles().length === 0, `剩 ${trashedFiles().length} 个`);

  await evalJs(`document.querySelector('#btnLibClose').click(); true`);
  await sleep(400);
  check('保存库能关闭', (await visible('#libDrawer')) === false);

  // ---------- 9. 窄屏 ----------
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 420, height: 900, deviceScaleFactor: 1, mobile: true,
  });
  await sleep(400);
  shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'shot-mobile.png'), Buffer.from(shot.data, 'base64'));
  const cols = await evalJs(`getComputedStyle(document.querySelector('#viewPrompt')).gridTemplateColumns`);
  check('窄屏下变成单列', !cols.includes(' '), cols);


  // ---------- 10. 布局度量（不靠截图判断） ----------
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await sleep(300);
  await evalJs(`document.querySelector('#drawerMask').click(); true`);
  await sleep(250);

  const measure = `(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null;
      const b = e.getBoundingClientRect(); return {x:b.x, y:b.y, w:b.width, h:b.height, r:b.right, b:b.bottom}; };
    return {
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      vw: innerWidth,
      composer: r('.composer'),
      result: r('.result'),
      pinbox: r('#pinbox'),
      pinPos: r('#pinPositive'),
      pinNeg: r('#pinNegative'),
      genBtn: r('#btnGenerate'),
      sentence: r('#sentence'),
      chips: r('#styleChips'),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`;

  const m = await evalJs(measure);
  check('桌面端无横向溢出', m.overflowX <= 1, `overflowX=${m.overflowX}`);
  check('输入区在结果区左侧（左右分栏）', m.composer.r <= m.result.x + 2, `composer.right=${Math.round(m.composer.r)} result.x=${Math.round(m.result.x)}`);
  check('两栏宽度接近（不是一边倒）', Math.abs(m.composer.w - m.result.w) / Math.max(m.composer.w, m.result.w) < 0.35,
    `${Math.round(m.composer.w)} vs ${Math.round(m.result.w)}`);
  check('两栏顶部对齐', Math.abs(m.composer.y - m.result.y) < 3, `${Math.round(m.composer.y)} vs ${Math.round(m.result.y)}`);
  check('置顶词框宽度合理', m.pinbox.w > 200, `w=${Math.round(m.pinbox.w)}`);
  check('置顶正向词输入框有正常宽度', m.pinPos.w > 120, `w=${Math.round(m.pinPos.w)}`);
  check('置顶负向词输入框有正常宽度', m.pinNeg.w > 120, `w=${Math.round(m.pinNeg.w)}`);
  check('宽屏下置顶词正负两栏左右并排', m.pinNeg.x >= m.pinPos.r - 2, `pos.right=${Math.round(m.pinPos.r)} neg.x=${Math.round(m.pinNeg.x)}`);
  check('生成按钮在输入框下方',
    m.genBtn.y > m.sentence.b - 2, `btn.y=` + Math.round(m.genBtn.y) + ` textarea.bottom=` + Math.round(m.sentence.b));
  check('生成按钮在输入卡范围内',
    m.genBtn.x >= m.composer.x - 1 && m.genBtn.r <= m.composer.r + 1,
    `btn.x=` + Math.round(m.genBtn.x) + ` composer=` + Math.round(m.composer.x) + `..` + Math.round(m.composer.r));
  check('生成按钮宽度撑满输入卡', Math.abs(m.genBtn.w - m.composer.w) < 45, `btn=${Math.round(m.genBtn.w)} panel=${Math.round(m.composer.w)}`);

  // 窄屏溢出
  // 样式表冒烟：几个关键规则真的生效了
  const cssSmoke = await evalJs(`(() => {
    const g = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : 'NO-EL'; };
    return {
      panelRadius: g('.panel', 'borderRadius'),
      primaryBg: g('.btn.primary', 'backgroundImage'),
      chipActive: g('#styleChips .chip.active', 'backgroundImage'),
      drawerW: g('#libDrawer', 'width'),
      cardBorder: g('.card', 'borderTopWidth'),
      toastPad: g('#toast', 'paddingTop'),
      pinCols: g('#pinboxBody', 'gridTemplateColumns'),
    };
  })()`);
  check('面板圆角生效', cssSmoke.panelRadius === '14px', cssSmoke.panelRadius);
  check('主按钮渐变生效', /gradient/.test(cssSmoke.primaryBg), cssSmoke.primaryBg.slice(0, 30));
  check('风格 chip 选中态有底色', /gradient/.test(cssSmoke.chipActive), String(cssSmoke.chipActive).slice(0, 40));
  check('抽屉宽度生效', /px$/.test(cssSmoke.drawerW) && cssSmoke.drawerW !== '0px', cssSmoke.drawerW);
  check('卡片有描边', cssSmoke.cardBorder === '1px', cssSmoke.cardBorder);
  check('提示条有内边距', cssSmoke.toastPad === '10px', cssSmoke.toastPad);
  check('置顶词两栏栅格生效', cssSmoke.pinCols.split(' ').length === 2, cssSmoke.pinCols);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(350);
  const m2 = await evalJs(measure);
  check('窄屏无横向溢出', m2.overflowX <= 1, `overflowX=${m2.overflowX}`);
  check('窄屏下输入与结果上下堆叠', m2.result.y >= m2.composer.b - 20, `composer.bottom=${Math.round(m2.composer.b)} result.y=${Math.round(m2.result.y)}`);
  check('窄屏下置顶词改为上下排列', m2.pinNeg.y >= m2.pinPos.b - 2, `pos.bottom=${Math.round(m2.pinPos.b)} neg.y=${Math.round(m2.pinNeg.y)}`);

  // ---------- 11. 置顶提示词的编辑与持久化 ----------
  await evalJs(`document.querySelector('#btnSettings').click(); true`);
  await sleep(400);
  await evalJs(`document.querySelector('#cfgApiPinned').value = 'EDITED-PIN-999'; true`);
  await evalJs(`document.querySelector('#cfgApiPinnedIdea').checked = true; true`);
  await evalJs(`document.querySelector('#btnSaveSettings').click(); true`);
  await sleep(1000);
  const cfgEdited = await evalJs(`fetch('/api/config').then(r=>r.json())`);
  check('置顶提示词修改后能保存',
    cfgEdited.apiPinnedPrompt === 'EDITED-PIN-999', JSON.stringify(cfgEdited.apiPinnedPrompt));
  check('灵感置顶开关能保存', cfgEdited.apiPinnedForIdea === true);

  await evalJs(`document.querySelector('#btnSettings').click(); true`);
  await sleep(400);
  await evalJs(`document.querySelector('#cfgApiPinned').value = 'MARKER-固定画风-ABC123'; true`);
  await evalJs(`document.querySelector('#cfgApiPinnedIdea').checked = false; true`);
  await evalJs(`document.querySelector('#btnSaveSettings').click(); true`);
  await sleep(1000);
  const cfgBack = await evalJs(`fetch('/api/config').then(r=>r.json())`);
  check('置顶提示词能改回原值',
    cfgBack.apiPinnedPrompt === 'MARKER-固定画风-ABC123', JSON.stringify(cfgBack.apiPinnedPrompt));
  check('灵感置顶开关能改回关闭', cfgBack.apiPinnedForIdea === false);
  check('保存置顶提示词不会动到 Key', cfgBack.hasKey === true);

  // ---------- 12. 细分提示词 ----------
  await evalJs(`document.querySelector('#mainTabs .tab[data-view="segment"]').click(); true`);
  await sleep(350);

  await evalJs(`(() => {
    const s = document.querySelector('#segSentence');
    s.value = '银发吸血鬼贵族少女，穿黑色蕾丝长裙';
    s.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('#segTarget').value = 'SDXL';
    document.querySelector('#segDetail').value = 'standard';
    return true;
  })()`);

  // 生成中可以取消，不能让界面永远停在「正在生成」
  await evalJs(`document.querySelector('#btnSegGenerate').click(); true`);
  await sleep(80);
  await evalJs(`document.querySelector('#btnSegCancel').click(); true`);
  await sleep(800);
  const cancelMsg = await evalJs(`document.querySelector('#segErr').hidden ? '' : document.querySelector('#segErr').textContent`);
  check('细分生成可以中途取消', /已取消/.test(cancelMsg), cancelMsg);
  check('取消后按钮和状态都恢复',
    (await evalJs(`document.querySelector('#btnSegGenerate').disabled`)) === false
      && (await evalJs(`document.querySelector('#btnSegCancel').hidden`)) === true
      && (await evalJs(`S.segBusy`)) === false);
  await evalJs(`hideSegErr(); true`);

  const histBeforeSeg = Number(await evalJs(`document.querySelector('#historyCount').textContent`));
  await evalJs(`document.querySelector('#btnSegGenerate').click(); true`);
  let segDone = false;
  for (let i = 0; i < 150; i++) {
    segDone = await visible('#segCards');
    if (segDone) break;
    await sleep(200);
  }
  const segErr = await evalJs(`document.querySelector('#segErr').hidden ? '' : document.querySelector('#segErr').textContent`);
  check('细分标签生成成功', segDone, segErr);

  const segCardLabels = await evalJs(`[...document.querySelectorAll('#segCards .card-head span')].map(e => e.textContent)`);
  check('细分结果有标签和中文对照两张卡',
    segCardLabels.some((t) => t.includes('标签组合')) && segCardLabels.some((t) => t.includes('中文对照')),
    JSON.stringify(segCardLabels));

  const segBadgeTexts = await evalJs(`[...document.querySelectorAll('#segCards .badges .badge')].map(e => e.textContent)`);
  check('细分结果标出类型与标签数',
    segBadgeTexts.includes('服饰穿搭') && segBadgeTexts.some((t) => /个标签/.test(t)),
    JSON.stringify(segBadgeTexts));

  const segTags = await evalJs(`document.querySelectorAll('#segCards .card-body')[0].textContent`);
  const segTagCount = segTags.split(/[,，]/).filter((s) => s.trim()).length;
  check('标签组合是一串逗号分隔的 tag',
    segTagCount >= 5 && !/[。；]/.test(segTags), `${segTagCount} 个 / ${segTags.slice(0, 50)}`);
  check('细分标签不拼置顶词',
    !segTags.includes('masterpiece') && !segTags.includes(PIN), segTags.slice(0, 40));

  const segZh = await evalJs(`document.querySelectorAll('#segCards .card-body')[1].textContent`);
  check('细分标签带中文对照', /[\u4e00-\u9fa5]/.test(segZh), segZh.slice(0, 40));

  const histAfterSeg = Number(await evalJs(`document.querySelector('#historyCount').textContent`));
  check('细分生成也进历史', histAfterSeg === histBeforeSeg + 1, `${histBeforeSeg} -> ${histAfterSeg}`);

  // 细分标签微调
  check('细分结果出现微调区', (await visible('#segRefineBar')) === true);
  check('细分撤回按钮初始不可用',
    (await evalJs(`document.querySelector('#btnSegUndoRefine').disabled`)) === true);
  check('细分微调控件已启用',
    (await evalJs(`document.querySelector('#btnSegRefine').disabled`)) === false
      && (await evalJs(`document.querySelector('#segRefineInput').disabled`)) === false
      && (await evalJs(`document.querySelectorAll('#segRefineChips button:disabled').length`)) === 0);
  await evalJs(`(() => {
    const b = [...document.querySelectorAll('#segRefineChips button')].find((x) => x.textContent === '更华丽');
    b.click();
    return true;
  })()`);
  let segRefined = false;
  for (let i = 0; i < 80; i++) {
    const t = await evalJs(`document.querySelectorAll('#segCards .card-body')[0].textContent`);
    if (t.includes('ornate')) { segRefined = true; break; }
    await sleep(200);
  }
  const segRefinedTags = await evalJs(`document.querySelectorAll('#segCards .card-body')[0].textContent`);
  check('细分微调后标签发生变化',
    segRefined && segRefinedTags !== segTags, segRefinedTags.slice(0, 50));
  const segRefineStatus = await evalJs(`document.querySelector('#segRefineStatus').textContent`);
  check('细分微调次数已显示', /已微调 1 次/.test(segRefineStatus), segRefineStatus);
  check('细分微调不新增历史',
    Number(await evalJs(`document.querySelector('#historyCount').textContent`)) === histAfterSeg);
  const histSegItem = await evalJs(`JSON.parse(localStorage.getItem('prompt-forge-history-v1') || '[]').find(h => h.kind === 'segment')`);
  check('细分微调同步更新历史', /ornate/.test(histSegItem?.tags || ''), (histSegItem?.tags || '').slice(0, 40));

  await evalJs(`document.querySelector('#btnSegUndoRefine').click(); true`);
  await sleep(500);
  const segTagsUndo = await evalJs(`document.querySelectorAll('#segCards .card-body')[0].textContent`);
  check('细分撤回能回到微调前', segTagsUndo === segTags, segTagsUndo.slice(0, 40));
  const histSegUndo = await evalJs(`JSON.parse(localStorage.getItem('prompt-forge-history-v1') || '[]').find(h => h.kind === 'segment')`);
  check('细分撤回也更新历史', !/ornate/.test(histSegUndo?.tags || ''), (histSegUndo?.tags || '').slice(0, 40));

  // 从历史恢复细分结果
  await evalJs(`document.querySelector('#btnHistory').click(); true`);
  await sleep(400);
  await evalJs(`document.querySelector('#historyList .hist-item').click(); true`);
  await sleep(450);
  check('从历史恢复细分结果回到细分页',
    (await visible('#viewSegment')) === true && (await visible('#segCards')) === true
      && (await evalJs(`document.querySelectorAll('#segCards .card-body')[0].textContent`)) === segTags);

  // 保存到保存库
  await evalJs(`document.querySelector('#btnSegSave').click(); true`);
  await sleep(1100);
  const segFile = savedFiles().find((f) => f.includes('_细分提示词_')) || '';
  check('细分结果保存成 md 文件', !!segFile, segFile);
  check('细分文件名带类型与标题', /^\d{8}-\d{6}_细分提示词_/.test(segFile), segFile);
  const segSaved = readSaved(segFile);
  check('保存文件包含标签组合和中文对照',
    segSaved.includes('## 标签组合') && segSaved.includes('## 中文对照'), '');
  check('保存文件元数据是 segment 类型', segSaved.includes('"kind":"segment"'), '');

  // 保存库识别与载入
  await evalJs(`document.querySelector('#btnLibrary').click(); true`);
  await sleep(900);
  const segLibItem = await evalJs(`(() => {
    const it = [...document.querySelectorAll('#libList .lib-item')]
      .find((x) => x.querySelector('.lib-kind')?.textContent === '细分提示词');
    if (!it) return null;
    return {
      kind: it.querySelector('.lib-kind').textContent,
      title: it.querySelector('.lib-title').textContent,
      cls: it.querySelector('.lib-kind').className,
    };
  })()`);
  check('保存库把细分结果单独归类',
    !!segLibItem && segLibItem.kind === '细分提示词' && /segment/.test(segLibItem.cls),
    JSON.stringify(segLibItem));

  const segGroups = await evalJs(`[...document.querySelectorAll('#libList .lib-group')].map(g => ({
    kind: g.dataset.kind,
    count: g.querySelectorAll('.lib-item').length,
  }))`);
  check('细分结果进入第三个分类',
    segGroups.length === 3
      && segGroups.map((g) => g.kind).join('/') === '提示词/角色设定/细分提示词'
      && segGroups[2].count === 1,
    JSON.stringify(segGroups));

  await evalJs(`(() => {
    const it = [...document.querySelectorAll('#libList .lib-item')]
      .find((x) => x.querySelector('.lib-kind')?.textContent === '细分提示词');
    [...it.querySelectorAll('.lib-actions .btn')].find((b) => b.textContent === '载入').click();
    return true;
  })()`);
  await sleep(900);
  check('载入细分结果回到细分页并渲染标签',
    (await visible('#viewSegment')) === true
      && (await evalJs(`document.querySelectorAll('#segCards .card-body')[0].textContent`)) === segTags);

  // 重命名不能把类型丢掉
  await evalJs(`document.querySelector('#btnLibrary').click(); true`);
  await sleep(800);
  await evalJs(`(() => {
    const it = [...document.querySelectorAll('#libList .lib-item')]
      .find((x) => x.querySelector('.lib-kind')?.textContent === '细分提示词');
    [...it.querySelectorAll('.lib-actions .btn')].find((b) => b.textContent === '重命名').click();
    return true;
  })()`);
  await sleep(350);
  await evalJs(`(() => {
    const i = document.querySelector('#libList .lib-rename');
    i.value = '改过名的细分条目';
    i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
    return true;
  })()`);
  await sleep(1400);
  const segRenamed = savedFiles().find((f) => f.includes('_细分提示词_改过名的细分条目.md')) || '';
  check('细分条目重命名后保留类型', !!segRenamed, savedFiles().join(' | '));
  await evalJs(`document.querySelector('#btnLibClose').click(); true`);
  await sleep(250);

  // 回到提示词页，后面的通用检查不依赖当前页
  await evalJs(`document.querySelector('#mainTabs .tab[data-view="prompt"]').click(); true`);
  await sleep(300);

  // ---------- 13. 控制台错误 ----------
  // ---------- 控制台错误 ----------
  // 先验一下错误栏的「重试」按钮
  await evalJs(`showErr('这是一条测试错误', () => {}); true`);
  await sleep(250);
  check('报错时出现重试按钮', (await evalJs(`document.querySelectorAll('#err .err-retry').length`)) === 1);
  await evalJs(`document.querySelector('#err .err-retry').click(); true`);
  await sleep(300);
  check('点重试后错误条收起', (await visible('#err')) === false);
  await evalJs(`hideErr(); true`);

  // 附加要求输入框里按 Enter 应直接触发生成（这里清空输入，验证它确实走到了生成逻辑）
  await evalJs(`(() => {
    document.querySelector('#sentence').value = '';
    document.querySelector('#extra').focus();
    document.querySelector('#extra').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
    return true;
  })()`);
  await sleep(500);
  const enterErr = await evalJs(`document.querySelector('#err').hidden ? '' : document.querySelector('#err').textContent`);
  check('附加要求里按 Enter 会触发生成', /一句话/.test(enterErr), enterErr);
  await evalJs(`hideErr(); true`);

  check('控制台无 JS 报错', cdp.consoleErrors.length === 0, cdp.consoleErrors.join(' | '));

  log('');
  log(failures === 0 ? '全部通过 ✓' : `${failures} 项失败 ✗`);
  return failures;
}

main()
  .then((f) => {
    chrome.kill();
    process.exit(f === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('验证脚本异常：', err.message);
    chrome.kill();
    process.exit(2);
  });
