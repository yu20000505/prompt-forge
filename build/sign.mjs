// 给打包好的 exe 做 Authenticode 签名（可选步骤）。
// 用法：
//   node build/sign.mjs --pfx cert.pfx --password ***
//   node build/sign.mjs --pfx cert.pfx --password *** release/PromptForge.exe
// 也可以走环境变量：PF_SIGN_PFX / PF_SIGN_PASSWORD / PF_SIGN_TIMESTAMP / SIGNTOOL
//
// 需要本机安装 Windows SDK（signtool.exe）。没有证书时不要运行，打包仍然可用。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_FILES = [
  path.join('release', 'PromptForge.exe'),
  path.join('release-desktop', 'PromptForge-Desktop.exe'),
];

function usage() {
  console.log(`Prompt Forge 代码签名

用法：
  node build/sign.mjs --pfx <证书.pfx> [--password <密码>] [文件...]

参数：
  --pfx <路径>       必填，Authenticode 证书（.pfx）
  --password <密码>  PFX 密码；也可用 PF_SIGN_PASSWORD
  --timestamp <URL>  时间戳服务，默认 http://timestamp.digicert.com
  --no-timestamp     不打时间戳（证书过期后签名会失效，不推荐）
  --no-verify        签完不执行 signtool verify
  --help             显示这段帮助

不给文件时，默认签 release/PromptForge.exe 和 release-desktop/PromptForge-Desktop.exe。
环境变量 SIGNTOOL 可以指定 signtool.exe 的完整路径。
`);
}

function parseArgs(argv) {
  const out = {
    pfx: process.env.PF_SIGN_PFX || '',
    password: process.env.PF_SIGN_PASSWORD || '',
    timestamp: process.env.PF_SIGN_TIMESTAMP || 'http://timestamp.digicert.com',
    verify: true,
    help: false,
    files: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pfx') out.pfx = argv[++i] || '';
    else if (a === '--password') out.password = argv[++i] || '';
    else if (a === '--timestamp') out.timestamp = argv[++i] || '';
    else if (a === '--no-timestamp') out.timestamp = '';
    else if (a === '--no-verify') out.verify = false;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) throw new Error(`未知参数：${a}`);
    else out.files.push(a);
  }
  return out;
}

// signtool 不保证在 PATH 里，常见位置是 Windows Kits\10\bin\<版本>\x64
function findSignTool() {
  const fromEnv = process.env.SIGNTOOL || '';
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const where = spawnSync('where.exe', ['signtool.exe'], { encoding: 'utf8' });
  if (where.status === 0) {
    const hit = String(where.stdout || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    if (hit) return hit;
  }

  const roots = [
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Windows Kits', '10', 'bin'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'App Certification Kit'),
  ];

  for (const root of roots) {
    let entries;
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    const versions = entries
      .filter((v) => /^\d+\.\d+/.test(v))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      .reverse();
    for (const version of versions) {
      for (const arch of ['x64', 'x86']) {
        const candidate = path.join(root, version, arch, 'signtool.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
    // App Certification Kit 目录本身可能直接放 signtool.exe
    const flat = path.join(root, 'signtool.exe');
    if (fs.existsSync(flat)) return flat;
  }

  return '';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  if (process.platform !== 'win32') {
    throw new Error('代码签名只在 Windows 上可用（需要 signtool.exe）');
  }

  if (!args.pfx) {
    usage();
    throw new Error('缺少 --pfx（也可以用环境变量 PF_SIGN_PFX）');
  }

  const pfx = path.resolve(args.pfx);
  if (!fs.existsSync(pfx)) throw new Error(`找不到证书文件：${pfx}`);

  const signTool = findSignTool();
  if (!signTool) {
    throw new Error('找不到 signtool.exe。请安装 Windows SDK，或用环境变量 SIGNTOOL 指定完整路径');
  }

  const targets = (args.files.length ? args.files : DEFAULT_FILES)
    .map((f) => path.resolve(ROOT, f))
    .filter((f) => {
      if (fs.existsSync(f)) return true;
      console.log(`  ! 跳过不存在的文件：${path.relative(ROOT, f)}`);
      return false;
    });

  if (!targets.length) {
    throw new Error('没有可签名的 exe。先运行 npm run build:all，或显式传入文件路径');
  }

  console.log('');
  console.log('签名 Prompt Forge 产物');
  console.log('='.repeat(46));
  console.log(`  signtool：${signTool}`);
  console.log(`  证书：${pfx}`);
  console.log(`  文件：${targets.length} 个`);
  console.log('');

  const signArgs = ['sign', '/fd', 'SHA256', '/f', pfx];
  if (args.password) signArgs.push('/p', args.password);
  else console.log('  ! PFX 密码为空（如果证书有密码，签名会失败）');
  if (args.timestamp) signArgs.push('/tr', args.timestamp, '/td', 'SHA256');

  for (const file of targets) {
    console.log(`  · 签名 ${path.relative(ROOT, file)}`);
    const r = spawnSync(signTool, [...signArgs, file], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`签名失败（退出码 ${r.status}）：${path.basename(file)}`);
  }

  if (args.verify) {
    for (const file of targets) {
      console.log(`  · 验证 ${path.relative(ROOT, file)}`);
      const r = spawnSync(signTool, ['verify', '/pa', file], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error(`签名验证失败（退出码 ${r.status}）：${path.basename(file)}`);
    }
  }

  console.log('');
  console.log('签名完成 ✓');
}

try {
  main();
} catch (err) {
  console.error(`\n签名失败：${err?.message || err}`);
  process.exit(1);
}
