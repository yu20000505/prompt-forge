// 打包桌面版（Electron）：单文件 exe，有独立窗口，不开浏览器。
// 用法：node build/build-desktop.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')));
const APP_DIR = path.join(ROOT, 'build', 'electron');
const OUT_DIR = path.join(ROOT, 'release-desktop');

const log = (...a) => console.log(...a);
const shellRun = (cmd, args, opts = {}) => {
  log(`  $ ${[cmd, ...args].join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: APP_DIR, stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`命令失败（退出码 ${r.status}）`);
};

function ensureDeps() {
  const nm = path.join(APP_DIR, 'node_modules');
  const need = ['electron', 'electron-builder'].filter((d) => !fs.existsSync(path.join(nm, d)));
  if (!need.length) {
    log('· 依赖已就绪（electron / electron-builder）');
    return;
  }
  log(`· 安装依赖：${need.join(', ')}（首次较慢，会下载 Electron 运行时）`);
  const args = ['install', ...need, '--no-audit', '--no-fund', '--loglevel=error'];
  if (process.platform === 'win32') shellRun('cmd', ['/c', 'npm', ...args]);
  else shellRun('npm', args);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function main() {
  log('');
  log('打包 Prompt Forge 桌面版（Electron）');
  log('='.repeat(46));

  if (!fs.existsSync(path.join(APP_DIR, 'package.json'))) {
    throw new Error('缺少 build/electron/package.json');
  }

  ensureDeps();

  // 1) 服务端打包成 CJS（Electron 主进程用 require 加载）
  log('\n1/4 打包服务端 → server.cjs');
  const esbuild = path.join(ROOT, 'build', 'node_modules', 'esbuild', 'bin', 'esbuild');
  if (!fs.existsSync(esbuild)) {
    throw new Error('缺少 esbuild，请先运行一次 node build/build-exe.mjs 安装构建依赖');
  }
  const r = spawnSync(process.execPath, [
    esbuild,
    path.join(ROOT, 'src', 'server.mjs'),
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--target=node20',
    `--outfile=${path.join(APP_DIR, 'server.cjs')}`,
    '--log-level=warning',
  ], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('服务端打包失败');
  log(`    server.cjs = ${(fs.statSync(path.join(APP_DIR, 'server.cjs')).size / 1024).toFixed(1)} KB`);

  // 2) 前端资源跟着进去
  log('\n2/4 复制前端资源');
  copyDir(path.join(ROOT, 'src', 'public'), path.join(APP_DIR, 'public'));
  const names = fs.readdirSync(path.join(APP_DIR, 'public'));
  log(`    public/ = ${names.join(', ')}`);

  // 3) electron-builder
  log('\n3/4 调用 electron-builder（首次会下载打包工具链）');
  const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' };
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  if (process.platform === 'win32') {
    shellRun('cmd', ['/c', 'npx', 'electron-builder', '--win', 'portable', '--publish', 'never'], { env });
  } else {
    shellRun('npx', ['electron-builder', '--win', 'portable', '--publish', 'never'], { env });
  }

  // 4) 汇报产物
  log('\n4/4 完成');
  const exe = path.join(OUT_DIR, 'PromptForge-Desktop.exe');
  if (!fs.existsSync(exe)) {
    const found = fs.existsSync(OUT_DIR)
      ? fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.exe'))
      : [];
    if (!found.length) throw new Error('没找到产出的 exe');
    log(`  产物：${path.join(OUT_DIR, found[0])}`);
  } else {
    log(`  产物：${exe}`);
    log(`  大小：${(fs.statSync(exe).size / 1024 / 1024).toFixed(1)} MB`);
  }
  log('');
  log('说明：这是真正的桌面程序 —— 双击弹出独立窗口，不开浏览器、不留命令行窗口。');
  log('      config.json 与 saved/ 在 %APPDATA%\\PromptForge 下。');
  log('');
}

try {
  main();
} catch (err) {
  console.error('\n打包失败：', err.message);
  process.exit(1);
}
