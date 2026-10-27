// 一键回归：起一个「临时配置」的实例 + 假接口，跑完自动清理。
// 关键点：服务用 PF_CONFIG 指向临时文件，端口也不与日常使用的 43125 冲突，
// 所以跑测试永远不会碰到用户真正的 config.json。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP_PORT = Number(process.env.PF_TEST_PORT || 43127);
const MOCK_PORT = Number(process.env.PF_MOCK_PORT || 43199);
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')));
const CFG = path.join(os.tmpdir(), `pf-test-config-${process.pid}.json`);
// 保存目录也指向临时位置，别把测试产生的文件写进用户真正的 saved/
const SAVED = path.join(os.tmpdir(), `pf-test-saved-${process.pid}`);
const APP_URL = `http://127.0.0.1:${APP_PORT}/`;
// 这个值会被写进配置，再由服务端拼进系统提示词发给模型；
// verify-ui 里靠它断言「置顶提示词确实发给了 API」
const API_PIN = 'MARKER-固定画风-ABC123';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const children = [];

function start(cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: 'ignore',
    env: { ...process.env, NO_OPEN: '1', ...env },
  });
  children.push(child);
  return child;
}

function stopAll() {
  for (const c of children) {
    try {
      c.kill('SIGKILL');
    } catch { /* 已退出 */ }
  }
  for (const f of [CFG, `${CFG}.bak`, `${CFG}.tmp`]) {
    try {
      fs.unlinkSync(f);
    } catch { /* 不存在 */ }
  }
  try {
    fs.rmSync(SAVED, { recursive: true, force: true });
  } catch { /* 不存在 */ }
}

async function waitHttp(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* 还没起来 */ }
    await sleep(300);
  }
  return false;
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});
process.on('exit', stopAll);

log(`临时配置: ${CFG}`);
log(`启动假接口 :${MOCK_PORT} 与 应用实例 :${APP_PORT} …`);

start(process.execPath, ['tests/mock-openai.mjs', String(MOCK_PORT)]);
start(process.execPath, ['src/server.mjs', String(APP_PORT)], { PF_CONFIG: CFG, PF_SAVED: SAVED });

const okMock = await waitHttp(`http://127.0.0.1:${MOCK_PORT}/v1/models`);
const okApp = await waitHttp(APP_URL);
if (!okMock || !okApp) {
  log(`启动失败 mock=${okMock} app=${okApp}`);
  stopAll();
  process.exit(1);
}

const cfg = {
  baseURL: `http://127.0.0.1:${MOCK_PORT}/v1`,
  apiKey: 'sk-test-1234',
  model: 'mock-prompt-model',
  temperature: 0.85,
  pinnedPositive: '',
  pinnedNegative: '',
  pinEnabled: true,
  apiPinnedPrompt: API_PIN,
};
const r = await fetch(`${APP_URL}api/config`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cfg),
});
if (!r.ok) {
  log('写入测试配置失败:', await r.text());
  stopAll();
  process.exit(1);
}
log('已写入测试配置，开始跑断言…\n');

const code = await new Promise((resolve) => {
  const child = spawn(process.execPath, ['tests/verify-ui.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, APP_URL, NO_OPEN: '1', PF_SAVED_DIR: SAVED },
  });
  children.push(child);
  child.on('exit', (c) => resolve(c ?? 1));
});

stopAll();
log(`\n回归结束，退出码 ${code}`);
process.exit(code);
