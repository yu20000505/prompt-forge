import { fileURLToPath } from 'node:url';
// 把 Prompt Forge 打包成单个 exe（Node SEA + esbuild 打包成 CJS）
// 用法：node build/build-exe.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BUILD = path.join(ROOT, 'build');
const OUT_DIR = path.join(ROOT, 'release');
const EXE_NAME = 'PromptForge.exe';
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const log = (...a) => console.log(...a);
const run = (cmd, args, opts = {}) => {
  log(`  $ ${[cmd, ...args].join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`命令失败（退出码 ${r.status}）：${cmd} ${args.join(' ')}`);
};

const NEEDED = ['esbuild', 'postject'];
const nm = path.join(BUILD, 'node_modules');

function ensureDeps() {
  const missing = NEEDED.filter((d) => !fs.existsSync(path.join(nm, d)));
  if (!missing.length) {
    log('· 依赖已就绪（esbuild / postject）');
    return;
  }
  log(`· 安装依赖：${missing.join(', ')}`);
  fs.mkdirSync(BUILD, { recursive: true });
  fs.writeFileSync(path.join(BUILD, 'package.json'), JSON.stringify({
    name: 'prompt-forge-build',
    private: true,
    type: 'module',
  }, null, 2), 'utf8');
  // Windows 上 npm 是 .cmd，Node 24 不允许直接 spawn，得走 cmd /c
  const args = ['install', ...missing, '--no-audit', '--no-fund', '--loglevel=error'];
  if (process.platform === 'win32') {
    run('cmd', ['/c', 'npm', ...args], { cwd: BUILD });
  } else {
    run('npm', args, { cwd: BUILD });
  }
}

function main() {
  log('');
  log('打包 Prompt Forge 单文件 exe');
  log('='.repeat(46));

  ensureDeps();

  // 1) 把 ESM 服务端打包成单个 CJS（SEA 的入口只支持 CJS）
  log('\n1/4 打包服务端 → app.cjs');
  const esbuild = path.join(nm, 'esbuild', 'bin', 'esbuild');
  run(process.execPath, [
    esbuild,
    'src/server.mjs',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--target=node22',
    `--outfile=${path.join(BUILD, 'app.cjs')}`,
    '--log-level=warning',
  ]);
  const bundleSize = fs.statSync(path.join(BUILD, 'app.cjs')).size;
  log(`    app.cjs = ${(bundleSize / 1024).toFixed(1)} KB`);

  // 2) 生成 SEA 配置并产出 blob（前端三个文件作为内嵌资源）
  log('\n2/4 生成 SEA blob');
  const cfg = {
    main: path.join(BUILD, 'app.cjs'),
    output: path.join(BUILD, 'promptforge.blob'),
    disableExperimentalSEAWarning: true,
    assets: {
      'index.html': path.join(ROOT, 'src', 'public', 'index.html'),
      'styles.css': path.join(ROOT, 'src', 'public', 'styles.css'),
      'app.js': path.join(ROOT, 'src', 'public', 'app.js'),
    },
  };
  const cfgPath = path.join(BUILD, 'sea-config.json');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  run(process.execPath, ['--experimental-sea-config', cfgPath]);
  log(`    blob = ${(fs.statSync(cfg.output).size / 1024).toFixed(1)} KB`);

  // 3) 以当前 node.exe 为底座
  log('\n3/4 复制 Node 运行时作为底座');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const exePath = path.join(OUT_DIR, EXE_NAME);
  fs.copyFileSync(process.execPath, exePath);
  log(`    底座 = ${process.execPath}`);

  // 4) 注入 blob（postject 会顺手把 SEA 的 fuse 打开）
  log('\n4/4 注入 blob');
  const postject = path.join(nm, 'postject', 'dist', 'cli.js');
  run(process.execPath, [
    postject,
    exePath,
    'NODE_SEA_BLOB',
    cfg.output,
    '--sentinel-fuse',
    FUSE,
  ]);

  const mb = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1);
  log('');
  log('='.repeat(46));
  log(`完成：${exePath}`);
  log(`大小：${mb} MB`);
  log('');
  log('说明：');
  log('  · 这是单文件版，内置 Node 运行时，目标机器不需要装 Node；');
  log('  · 双击即可启动，浏览器会自动打开；');
  log('  · config.json 和 saved/ 会生成在 exe 所在目录（需要可写）。');
  log('');
}

try {
  main();
} catch (err) {
  console.error('\n打包失败：', err.message);
  process.exit(1);
}
