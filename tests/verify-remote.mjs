// 验证 GitHub 上仓库的默认展示是否已经是中文。
// 只打印 ASCII 布尔值，避免控制台编码干扰判断。
const REPO = 'yu20000505/prompt-forge';

const get = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'pf-verify' } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.text();
};

const EXPECT_DESC_START = '一句话生成生图提示词';
const ZH_MARKERS = ['一句话进', '它解决什么问题', '快速开始'];
const EN_MARKERS = ['One sentence in', 'Why', 'Quick start'];

const results = [];
const check = (name, ok, extra = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const meta = JSON.parse(await get(`https://api.github.com/repos/${REPO}`));
check(
  'repo description starts with the Chinese summary',
  typeof meta.description === 'string' && meta.description.startsWith(EXPECT_DESC_START),
  `bytes=${Buffer.byteLength(meta.description || '', 'utf8')}`,
);
check('repo is public', meta.visibility === 'public', meta.visibility);

const readme = await get(`https://raw.githubusercontent.com/${REPO}/main/README.md`);
check('default README.md is Chinese', ZH_MARKERS.every((m) => readme.includes(m)));
check('default README.md is not the English one', !EN_MARKERS.some((m) => readme.includes(m)));
check('Chinese README links to English', readme.includes('README.en.md'));

const en = await get(`https://raw.githubusercontent.com/${REPO}/main/README.en.md`);
check('README.en.md is English', EN_MARKERS.every((m) => en.includes(m)));
check('README.en.md has no Chinese section headers', !ZH_MARKERS.some((m) => en.includes(m)));
check('English README links to Chinese', en.includes('README.en.md') === false && en.includes('README.md'));
check('both READMEs reference the screenshots',
  readme.includes('docs/screenshots/01-main.png') && en.includes('docs/screenshots/01-main.png'));

const pkgFile = JSON.parse(await get(`https://api.github.com/repos/${REPO}/contents/package.json`));
const pkg = JSON.parse(Buffer.from(pkgFile.content, 'base64').toString('utf8'));
check('package.json description is Chinese', pkg.description.startsWith(EXPECT_DESC_START),
  `bytes=${Buffer.byteLength(pkg.description, 'utf8')}`);

const commits = JSON.parse(await get(`https://api.github.com/repos/${REPO}/commits?per_page=5`));
check('commits are on the remote', Array.isArray(commits) && commits.length >= 2, `${commits.length} commits`);

const release = JSON.parse(await get(`https://api.github.com/repos/${REPO}/releases/latest`));
check('latest release has both binaries',
  release.assets.length === 2 && release.assets.every((a) => a.size > 60 * 1024 * 1024),
  release.assets.map((a) => `${a.name}=${(a.size / 1048576).toFixed(1)}MB`).join(', '));

console.log('');
const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
