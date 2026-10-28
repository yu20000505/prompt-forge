/* Prompt Forge 前端逻辑 */
const $ = (s) => document.querySelector(s);

/* ============ 界面语言（中文 / English） ============ */
let i18nObserver = null;

function tr(text) {
  const s = String(text ?? '');
  if (S.lang !== 'en' || !s.trim()) return s;
  const key = s.replace(/\s+/g, ' ').trim();
  const dict = (window.PF_I18N && window.PF_I18N.en) || {};
  let out = dict[key];

  if (!out) {
    let m;
    if ((m = key.match(/^(\d+) 字$/))) out = `${m[1]} chars`;
    else if ((m = key.match(/^已微调 (\d+) 次$/))) out = `Refined ×${m[1]}`;
    else if ((m = key.match(/^(\d+) 个标签$/))) out = `${m[1]} tags`;
    else if ((m = key.match(/^(\d+) 词$/))) out = `${m[1]} words`;
    else if ((m = key.match(/^(\d+) \/ (\d+) 类$/))) out = `${m[1]} / ${m[2]} types`;
    else if ((m = key.match(/^(\d+) 类$/))) out = `${m[1]} types`;
    else if ((m = key.match(/^(\d+) 秒$/))) out = `${m[1]}s`;
    else if ((m = key.match(/^已选 (\d+) 个$/))) out = `${m[1]} selected`;
    else if ((m = key.match(/^(\d+) \/ (\d+) 条$/))) out = `${m[1]} / ${m[2]} items`;
    else if ((m = key.match(/^(\d+) 条$/))) out = `${m[1]} items`;
    else if ((m = key.match(/^第 (\d+) 次重试…?$/))) out = `Retry #${m[1]}…`;
    else if ((m = key.match(/^接口暂时失败，第 (\d+) 次重试…?$/))) out = `Upstream hiccup, retry #${m[1]}…`;
    else if ((m = key.match(/^正在生成… (\d+) 字（Esc 取消）$/))) out = `Generating… ${m[1]} chars (Esc to cancel)`;
    else if ((m = key.match(/^正在改写… (\d+) 字（Esc 取消）$/))) out = `Rewriting… ${m[1]} chars (Esc to cancel)`;
    else if ((m = key.match(/^正在生成 (\d+)\/(\d+)：(.+?) · (\d+) 字（Esc 取消）$/))) out = `Generating ${m[1]}/${m[2]}: ${tr(m[3])} · ${m[4]} chars (Esc to cancel)`;
    else if ((m = key.match(/^正在生成 (\d+)\/(\d+)：(.+?) · 已用 (\d+) 秒（Esc 取消）$/))) out = `Generating ${m[1]}/${m[2]}: ${tr(m[3])} · ${m[4]}s elapsed (Esc to cancel)`;
    else if ((m = key.match(/^模型思考中… (\d+) 字$/))) out = `Model thinking… ${m[1]} chars`;
    else if ((m = key.match(/^模型现编了 (\d+) 条 · 点一条填进输入框$/))) out = `Model generated ${m[1]} ideas · click one to fill the input`;
    else if ((m = key.match(/^微调中… (\d+) 字$/))) out = `Refining… ${m[1]} chars`;
    else if ((m = key.match(/^已保存：saved\/(.+)$/))) out = `Saved: saved/${m[1]}`;
    else if ((m = key.match(/^已载入：(.+)$/))) out = `Loaded: ${m[1]}`;
    else if ((m = key.match(/^已重命名为：(.+)$/))) out = `Renamed to: ${m[1]}`;
    else if ((m = key.match(/^已删除 (\d+) 个文件（7 天内可撤销）$/))) out = `Deleted ${m[1]} files (undo within 7 days)`;
    else if ((m = key.match(/^已加入拼装板：(.+?)（(\d+) 个标签）$/))) out = `Added to board: ${tr(m[1])} (${m[2]} tags)`;
    else if ((m = key.match(/^已更新拼装板的「(.+?)」$/))) out = `Updated board: ${tr(m[1])}`;
    else if ((m = key.match(/^已从拼装板移除「(.+?)」$/))) out = `Removed from board: ${tr(m[1])}`;
    else if ((m = key.match(/^已清空拼装板的 (\d+) 类标签$/))) out = `Cleared ${m[1]} board categories`;
    else if ((m = key.match(/^已删除 (\d+) 个文件（7 天内可撤销）$/))) out = `Deleted ${m[1]} files (undo within 7 days)`;
    else if ((m = key.match(/^已删除 (\d+) 个，(\d+) 个失败$/))) out = `Deleted ${m[1]}, ${m[2]} failed`;
    else if ((m = key.match(/^已取消，已完成 (\d+) 类并加入拼装板$/))) out = `Canceled; ${m[1]} categories finished and added to the board`;
    else if ((m = key.match(/^第 (\d+) 类生成失败：(.*)$/))) out = `Category ${m[1]} failed: ${tr(m[2])}`;
    else if ((m = key.match(/^接口返回 (\d+)（(.*?)）：(.*)$/))) {
      const hints = {
        'API Key 无效或没有权限': 'invalid key or permission',
        'API Key 无效或已过期': 'invalid or expired key',
        'BaseURL 或模型名不对': 'wrong base URL or model',
        '请求太频繁或余额不足': 'rate limited or out of quota',
        '上游服务端暂时不可用': 'upstream unavailable',
      };
      out = `API returned ${m[1]} (${hints[m[2]] || m[2]}): ${tr(m[3])}`;
    } else if ((m = key.match(/^无法连接到 (.+?)，请检查 BaseURL 和网络：(.*)$/))) {
      out = `Cannot connect to ${m[1]}. Check the base URL and network: ${tr(m[2])}`;
    } else if ((m = key.match(/^接口 (\d+) 秒没有返回任何数据，已自动中止。请重试，或在设置里换一个模型。$/))) {
      out = `No data from the API for ${m[1]}s; aborted. Retry or choose another model in Settings.`;
    } else if ((m = key.match(/^备份包含 (\d+) 个文件、(\d+) 条历史、(\d+) 类拼装板(?:；其中 (\d+) 个文件与现有同名)?。$/))) {
      out = `Backup: ${m[1]} files, ${m[2]} history entries, ${m[3]} board categories${m[4] ? `; ${m[4]} name conflicts` : ''}.`;
    }
  }

  if (!out) return s;
  const lead = s.match(/^\s*/)[0];
  const trail = s.match(/\s*$/)[0];
  return `${lead}${out}${trail}`;
}

function i18nSkip(el) {
  if (!el || el.nodeType !== 1) return false;
  return !!el.closest('script,style,textarea,input,pre,[data-no-i18n],.card-body,.lib-title,.lib-summary,.h-sentence,.h-prompt,.batch-tags,.board-slot-tags,.board-preview-text,.keywords,#outTitle,#btnLang');
}

function translateTextNode(node) {
  if (!node || node.nodeType !== 3) return;
  const parent = node.parentElement;
  if (!parent || i18nSkip(parent)) return;
  const next = tr(node.nodeValue);
  if (next !== node.nodeValue) node.nodeValue = next;
}

function translateAttrs(el) {
  if (!el || el.nodeType !== 1) return;
  const formControl = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  if (!formControl && i18nSkip(el)) return;
  for (const name of ['placeholder', 'title', 'aria-label']) {
    const v = el.getAttribute(name);
    if (!v) continue;
    const next = tr(v);
    if (next !== v) el.setAttribute(name, next);
  }
}

function walkI18n(root) {
  if (!root) return;
  if (root.nodeType === 3) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== 1) return;
  translateAttrs(root);
  if (i18nSkip(root)) return;
  for (const child of root.childNodes) walkI18n(child);
}

function applyI18nDom(root = document.body) {
  if (S.lang !== 'en') return;
  walkI18n(root);
}

function startI18nObserver() {
  if (S.lang !== 'en' || i18nObserver) return;
  i18nObserver = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') translateTextNode(m.target);
      else if (m.type === 'attributes') translateAttrs(m.target);
      else for (const n of m.addedNodes) walkI18n(n);
    }
  });
  i18nObserver.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'aria-label'],
  });
}

function initLanguage() {
  try {
    const v = localStorage.getItem('pf-lang');
    if (v === 'en' || v === 'zh') S.lang = v;
  } catch {
    /* 默认中文 */
  }
  document.documentElement.lang = S.lang === 'en' ? 'en' : 'zh-CN';
  const btn = $('#btnLang');
  if (btn) {
    btn.textContent = S.lang === 'en' ? '中文' : 'EN';
    btn.title = S.lang === 'en' ? '切换到中文' : 'Switch to English';
  }
  if (S.lang === 'en') {
    document.title = 'Prompt Forge · One sentence to image prompt';
    applyI18nDom(document.body);
    startI18nObserver();
  }
}

function toggleLanguage() {
  try {
    localStorage.setItem('pf-lang', S.lang === 'en' ? 'zh' : 'en');
  } catch {
    /* 存不下就只本次生效 */
  }
  location.reload();
}


const STYLES = [
  { id: 'sd', label: 'SD / SDXL / Flux', desc: '结构化英文短语', descEn: 'Structured English phrases' },
  { id: 'anime', label: 'NovelAI 动漫', desc: 'Danbooru 标签流', descEn: 'Danbooru tag flow' },
  { id: 'mj', label: 'Midjourney', desc: '自然语言 + 参数', descEn: 'Natural language + parameters' },
  { id: 'photo', label: '写实摄影', desc: '镜头 / 光线 / 胶片', descEn: 'Lens / light / film' },
  { id: 'natural', label: '自然语言', desc: 'Flux / DALL·E', descEn: 'Flux / DALL·E' },
];

// 细分标签类型，和 src/styles.mjs 里的 SEGMENT_LIST 保持一致
const SEG_TYPES = [
  { id: 'outfit', label: '服饰穿搭', desc: '衣服 / 材质 / 配饰' },
  { id: 'character', label: '人物形象', desc: '脸 / 发型 / 体型' },
  { id: 'scene', label: '场景环境', desc: '地点 / 天气 / 背景' },
  { id: 'pose', label: '动作表情', desc: '姿态 / 手势 / 神情' },
  { id: 'props', label: '道具物件', desc: '手持 / 陈设 / 关键物' },
  { id: 'lighting', label: '光影氛围', desc: '光线 / 色调 / 空气感' },
  { id: 'style', label: '画风质感', desc: '媒介 / 镜头 / 画质' },
];

// 后端改了但没重启时，/api/segment 会 404；给一个能照做的提示，而不是裸的 not found
const STALE_SERVER_MSG = '检测到服务端还是旧进程：没有 /api/segment。请关闭运行 Prompt Forge 的命令行窗口后重新运行 node src/server.mjs，再刷新本页；exe 版需要重新打包。';
const STALE_SERVER_GENERAL = '检测到服务端还是旧进程：保存库收藏、历史落盘等新接口不可用。请关闭运行 Prompt Forge 的命令行窗口后重新运行 node src/server.mjs，再刷新本页；exe 版需要重新打包。';

const SEG_REFINE_CHIPS = [
  '更华丽', '更日常', '去掉配饰', '换成冬季', '更赛博朋克',
  '颜色更暗', '材质更具体', '精简一些', '更写实', '细节更多',
];

// 拼装板：把不同细分类型的结果攒起来，按固定顺序拼成一条完整 tag 串。
// 只存 localStorage，不写磁盘；每个类型最多留一条（加入同一类型会替换旧的）。
const BOARD_KEY = 'pf-board-v1';

// 本地兜底词库：只在接口不可用（没配 Key / 连不上）时用
const IDEAS = [
  '雨夜的霓虹街头，一位赛博朋克女剑客回头看向镜头',
  '清晨薄雾中的古镇石桥，一位撑伞的老人缓缓走过',
  '宇宙空间站内部，宇航员透过舷窗看着地球升起',
  '森林深处的发光蘑菇小屋，一只猫守在门口',
  '未来都市的空中列车，车厢里坐满了各色乘客',
  '夏日午后的图书馆，阳光穿过百叶窗落在地板上',
  '雪原上的孤狼，极光在它背后的天空流动',
  '赛博朋克风格的菜市场，机器人在摊位前讨价还价',
  '漂浮在云海之上的最后一座灯塔',
  '老式胶片相机静物特写，桌上散落着未冲洗的底片',
  '海底废墟中的一尊青铜雕像，鱼群从它身边游过',
  '黄昏的天台，两个少年并肩坐着看城市灯火亮起',
  '机械朋克风格的钟表匠工作室，满地齿轮和图纸',
  '沙漠中行驶的一辆复古房车，尾灯在夜色里发红',
  '玻璃温室里的热带雨林，一只蓝色蝴蝶停在叶片上',
  '唐朝风格的宫殿夜景，宫中灯火与烟花齐放',
  '一座被藤蔓吞没的废弃教堂，光柱从穹顶破洞洒下',
  '黑猫蹲在窗台上，窗外是暴雨中的城市',
];

const S = {
  lang: 'zh',
  style: 'sd',
  busy: false,
  config: null,
  current: null,       // { sentence, style, targetModel, language, detail, extra, result, raw }
  history: [],
  histFilter: 'all',
  historyLoaded: false,
  abort: null,
  modelOptions: [],    // 「拉取列表」拿到的模型
  modelFetched: false,
  combos: {},          // 两个下拉框实例
  ideaBusy: false,
  view: 'prompt',
  charBusy: false,
  charAbort: null,
  charData: null,
  charText: '',
  charSentence: '',
  charStack: [],
  charOriginal: null,
  charEdited: false,
  charHistoryAt: null,
  charVIndex: 0,
  segType: 'outfit',
  segBusy: false,
  segAbort: null,
  segData: null,
  segMeta: null,
  segText: '',
  segSentence: '',
  segStack: [],
  segOriginal: null,
  segEdited: false,
  segVIndex: 0,
  segBatch: null,
  segBatchMode: false,
  editorMode: null,
  serverStale: false,
  staleNotified: false,
  lib: [],
  libDir: '',
  libEditing: null,
  libTotal: 0,
  libSelected: new Set(),
  libSort: 'new',
  pendingBackup: null,
  board: [],           // [{ type, tags, title, sentence, at }]
  boardTitle: '',
  boardLoaded: false,
  customTemplates: [],
  draftsSuppressed: false,
  trashItems: [],
  variantBusy: false,
  variantAbort: null,
  variantResults: [],
  variantPayload: null,
};

// 没拉取过列表时先给几个常用的，避免下拉框一开始是空的
const MODEL_PRESETS = [
  'deepseek-chat',
  'deepseek-reasoner',
  'gpt-4o-mini',
  'gpt-4.1-mini',
  'qwen-plus',
  'moonshot-v1-8k',
  'glm-4-flash',
  'llama3.1',
];

// 提示词模板：只填输入区，不自动生成
const PROMPT_TEMPLATES = [
  {
    id: 'portrait', name: '人物肖像', nameEn: 'Portrait',
    desc: '半身人像 / 情绪与皮肤质感',
    sentence: '雨后的旧公寓里，一位银发少女靠在窗边看向镜头，神情安静',
    style: 'sd', detail: 'standard', aspect: '2:3', shot: 'medium shot',
    extra: '柔和的侧窗光，浅景深，真实的皮肤纹理',
  },
  {
    id: 'cinematic', name: '电影场景', nameEn: 'Cinematic scene',
    desc: '宽银幕 / 叙事感光影',
    sentence: '深夜的加油站，一名货车司机靠在车头抽烟，远处公路被车灯照亮',
    style: 'photo', detail: 'rich', aspect: '16:9', shot: 'wide shot',
    extra: '电影感色彩，体积光，35mm 变形宽银幕',
  },
  {
    id: 'mecha', name: '机甲科幻', nameEn: 'Mecha sci-fi',
    desc: '巨大机械 / 工业细节',
    sentence: '废弃的发射井里，一台伤痕累累的重型机甲半跪着，驾驶舱还亮着微光',
    style: 'sd', detail: 'rich', aspect: '16:9', shot: 'from below',
    extra: '冷色调工业光，金属磨损与油污，雾气',
  },
  {
    id: 'guofeng', name: '国风古韵', nameEn: 'Chinese classical',
    desc: '山水 / 留白 / 工笔',
    sentence: '薄雾笼罩的江南水乡，一位执伞女子走在石桥上，远处白墙黛瓦若隐若现',
    style: 'sd', detail: 'rich', aspect: '3:4', shot: 'wide shot',
    extra: '水墨留白，低饱和青灰色，柔和晨雾',
  },
  {
    id: 'product', name: '产品静物', nameEn: 'Product still life',
    desc: '商业摄影 / 材质与反光',
    sentence: '黑色磨砂玻璃香水瓶放在湿润的黑色石板上，水面倒映着暖色轮廓光',
    style: 'photo', detail: 'standard', aspect: '1:1', shot: 'close-up',
    extra: '商业静物光，边缘轮廓光，微距细节',
  },
  {
    id: 'wildlife', name: '自然动物', nameEn: 'Wildlife',
    desc: '野生动物 / 长焦',
    sentence: '清晨的雪原上，一只赤狐停下脚步回头张望，呼吸在冷空气里凝成白雾',
    style: 'photo', detail: 'standard', aspect: '3:4', shot: 'close-up',
    extra: '长焦压缩感，自然晨光，浅景深',
  },
  {
    id: 'cyberpunk', name: '赛博朋克', nameEn: 'Cyberpunk',
    desc: '霓虹 / 雨夜 / 高密度城市',
    sentence: '雨夜的赛博朋克夜市，霓虹灯牌和全息广告映在积水里，行人撑着透明伞',
    style: 'sd', detail: 'rich', aspect: '16:9', shot: 'wide shot',
    extra: '青色与品红霓虹，湿润反光，体积雾',
  },
  {
    id: 'fantasy', name: '奇幻风景', nameEn: 'Fantasy landscape',
    desc: '世界感 / 大气透视',
    sentence: '漂浮在云海上的古老神殿，瀑布从断裂的台阶落入云层，飞鸟绕柱盘旋',
    style: 'sd', detail: 'rich', aspect: '16:9', shot: 'wide shot',
    extra: '史诗感，大气透视，金色夕阳',
  },
  {
    id: 'food', name: '美食特写', nameEn: 'Food close-up',
    desc: '暖色 / 食欲 / 质感',
    sentence: '刚出锅的牛肉面放在旧木桌上，热气升起，汤面浮着葱花和辣椒油',
    style: 'photo', detail: 'standard', aspect: '4:3', shot: 'close-up',
    extra: '暖色侧逆光，蒸汽，浅景深',
  },
  {
    id: 'interior', name: '建筑室内', nameEn: 'Architecture interior',
    desc: '空间 / 材质 / 自然光',
    sentence: '午后阳光穿过落地窗，照亮一间极简混凝土客厅，长桌上放着陶器和干枝',
    style: 'photo', detail: 'standard', aspect: '16:9', shot: 'wide shot',
    extra: '自然光，建筑摄影，真实材质',
  },
];

const NEG_PRESETS = [
  { id: 'general', name: '通用', nameEn: 'General', text: 'lowres, worst quality, low quality, blurry, jpeg artifacts, watermark, signature, text' },
  { id: 'anime', name: '动漫', nameEn: 'Anime', text: 'lowres, bad anatomy, bad hands, extra digits, fewer digits, worst quality, watermark, username' },
  { id: 'photo', name: '写实', nameEn: 'Photo', text: 'cartoon, illustration, anime, 3d render, cgi, plastic skin, waxy skin, extra fingers, deformed hands, watermark' },
];

const TEMPLATE_KEY = 'pf-templates-v1';

// 主页「目标模型」的可选值：只是提示，随便填
const TARGET_PRESETS = [  'SDXL',
  'Stable Diffusion 1.5',
  'Flux.1',
  'NovelAI V4',
  'Midjourney v6.1',
  'DALL·E 3',
  '即梦 / Seedream',
  '通用',
];

/* ============ 启动 ============ */
document.addEventListener('DOMContentLoaded', () => {
  initLanguage();
  loadCustomTemplates();
  renderNegPresets();
  renderStyleOptions();
  renderRefineChips();
  renderCharRefineChips();
  renderSegTypeChips();
  renderSegRefineChips();
  renderThemeSwatches();
  loadBoard();
  initLibraryPrefs();
  bind();
  loadHistory();
  loadConfig().then(() => loadDrafts());
  refreshCounter();
  refreshLibraryCount();
});

function renderStyleOptions() {
  const sel = $('#styleSelect');
  if (!sel) return;
  if (!STYLES.some((x) => x.id === S.style)) S.style = 'sd';
  sel.innerHTML = '';
  for (const st of STYLES) {
    const o = document.createElement('option');
    o.value = st.id;
    o.textContent = S.lang === 'en'
      ? `${st.label} — ${st.descEn}`
      : `${st.label} — ${st.desc}`;
    sel.appendChild(o);
  }
  sel.value = S.style;
  sel.addEventListener('change', () => {
    S.style = sel.value;
  });
}

function loadCustomTemplates() {
  try {
    const v = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]');
    S.customTemplates = (Array.isArray(v) ? v : [])
      .filter((t) => t && typeof t === 'object' && t.sentence)
      .slice(0, 30);
  } catch {
    S.customTemplates = [];
  }
}

function saveCustomTemplates() {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(S.customTemplates.slice(0, 30)));
  } catch {
    /* 存不下就只在本次生效 */
  }
}

function templateLabel(t) {
  return S.lang === 'en' ? (t.nameEn || t.name) : t.name;
}

function applyPromptTemplate(t) {
  if (!t) return;
  $('#sentence').value = t.sentence || '';
  $('#extra').value = t.extra || '';
  if (['short', 'standard', 'rich'].includes(t.detail)) $('#detail').value = t.detail;
  if (STYLES.some((x) => x.id === t.style)) {
    S.style = t.style;
    $('#styleSelect').value = t.style;
  }
  $('#promptAspect').value = t.aspect || 'auto';
  $('#promptShot').value = t.shot || 'auto';
  refreshCounter();
  scheduleDraftSave(true);
  closeTemplateDialog();
  toast(`已填入模板：${templateLabel(t)}`);
}

function closeTemplateDialog() {
  $('#templateDialog').close();
}

function renderTemplateDialog() {
  const box = $('#templateGrid');
  box.innerHTML = '';
  for (const t of PROMPT_TEMPLATES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'template-card';
    const title = document.createElement('b');
    title.textContent = templateLabel(t);
    const desc = document.createElement('small');
    desc.textContent = t.desc || t.sentence;
    b.append(title, desc);
    b.addEventListener('click', () => applyPromptTemplate(t));
    box.appendChild(b);
  }

  const list = $('#customTemplateList');
  list.innerHTML = '';
  if (!S.customTemplates.length) {
    const p = document.createElement('p');
    p.className = 'dim small';
    p.textContent = '还没有自定义模板。';
    list.appendChild(p);
    return;
  }
  for (const t of S.customTemplates) {
    const row = document.createElement('div');
    row.className = 'custom-template-row';
    const name = document.createElement('span');
    name.textContent = t.name || '未命名';
    row.appendChild(name);
    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'btn tiny';
    use.textContent = '应用';
    use.addEventListener('click', () => applyPromptTemplate(t));
    row.appendChild(use);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn tiny ghost';
    del.textContent = '删除';
    del.addEventListener('click', () => {
      S.customTemplates = S.customTemplates.filter((x) => x.id !== t.id);
      saveCustomTemplates();
      renderTemplateDialog();
    });
    row.appendChild(del);
    list.appendChild(row);
  }
}

function openTemplateDialog() {
  renderTemplateDialog();
  $('#templateName').value = '';
  $('#templateDialog').showModal();
}

function saveCurrentTemplate() {
  const name = $('#templateName').value.trim();
  const sentence = $('#sentence').value.trim();
  if (!name) return toast('先给模板起个名字', true);
  if (!sentence) return toast('先写一句话，再保存为模板', true);
  S.customTemplates.unshift({
    id: `custom-${Date.now()}`,
    name: name.slice(0, 40),
    sentence,
    extra: $('#extra').value.trim(),
    style: S.style,
    detail: $('#detail').value,
    aspect: $('#promptAspect').value,
    shot: $('#promptShot').value,
    custom: true,
    at: Date.now(),
  });
  S.customTemplates = S.customTemplates.slice(0, 30);
  saveCustomTemplates();
  renderTemplateDialog();
  $('#templateName').value = '';
  toast(`已保存模板：${name}`);
}

function renderNegPresets() {
  const box = $('#negPresets');
  if (!box) return;
  box.innerHTML = '';
  for (const p of NEG_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'neg-preset';
    b.textContent = S.lang === 'en' ? p.nameEn : p.name;
    b.title = p.text;
    b.addEventListener('click', () => {
      $('#pinNegative').value = p.text;
      $('#pinNegative').dispatchEvent(new Event('input', { bubbles: true }));
      toast(`已填入${b.textContent}负面词`);
    });
    box.appendChild(b);
  }
}

function renderSegTypeChips() {
  const box = $('#segTypeChips');
  if (!box) return;
  box.innerHTML = '';
  for (const t of SEG_TYPES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (t.id === S.segType ? ' active' : '');
    b.dataset.id = t.id;
    b.innerHTML = `<b>${segTypeLabel(t.id)}</b><small>${segTypeDesc(t.id)}</small>`;
    b.addEventListener('click', () => {
      S.segType = t.id;
      box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.id === t.id));
    });
    box.appendChild(b);
  }
}

function segTypeLabel(id) {
  const t = SEG_TYPES.find((x) => x.id === id) || SEG_TYPES[0];
  return S.lang === 'en' ? (SEG_EN_LABELS[t.id] || t.label) : t.label;
}

function segTypeDesc(id) {
  const t = SEG_TYPES.find((x) => x.id === id) || SEG_TYPES[0];
  return S.lang === 'en' ? (SEG_EN_DESCS[t.id] || t.desc) : t.desc;
}

const SEG_EN_LABELS = {
  outfit: 'Outfit',
  character: 'Character look',
  scene: 'Scene',
  pose: 'Pose & expression',
  props: 'Props',
  lighting: 'Lighting',
  style: 'Style & texture',
};
const SEG_EN_DESCS = {
  outfit: 'Clothes / materials / accessories',
  character: 'Face / hair / build',
  scene: 'Place / weather / background',
  pose: 'Pose / hands / expression',
  props: 'Held / placed / key objects',
  lighting: 'Light / color / atmosphere',
  style: 'Medium / lens / quality',
};

function renderSegRefineChips() {
  const box = $('#segRefineChips');
  if (!box) return;
  box.innerHTML = '';
  for (const text of SEG_REFINE_CHIPS) {
    const label = S.lang === 'en' ? tr(text) : text;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => {
      $('#segRefineInput').value = label;
      refineSegment(label);
    });
    box.appendChild(b);
  }
}

/* ============ 操作体验小工具 ============ */
// 结果不在视野里时才滚过去，桌面端两栏并列时不会乱跳
function revealResult(sel) {
  const el = document.querySelector(sel);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const outOfView = r.top < 0 || r.top > window.innerHeight - 80;
  if (outOfView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
/* ============ 皮肤（主题） ============ */
const THEMES = [
  { id: 'sage', name: '雾灰绿', bg: '#e3e5de', panel: '#edefe8', accent: '#63725a', dark: false },
  { id: 'haze', name: '雾霾蓝', bg: '#e2e6ea', panel: '#ecf0f3', accent: '#65778a', dark: false },
  { id: 'mauve', name: '藕荷', bg: '#eae4e6', panel: '#f2ecee', accent: '#886c7e', dark: false },
  { id: 'bean', name: '豆沙', bg: '#ebe4df', panel: '#f3ece7', accent: '#8e6d5d', dark: false },
  { id: 'sand', name: '暖砂', bg: '#e8e3d9', panel: '#f1ece2', accent: '#837153', dark: false },
  { id: 'steel', name: '冷月灰', bg: '#e4e5e8', panel: '#eef0f2', accent: '#696f7e', dark: false },
  { id: 'night', name: '暗夜', bg: '#0a0b10', panel: '#14161f', accent: '#7759f5', dark: true },
];

const THEME_KEY = 'pf-theme';
let themeName = null;

function currentThemeId() {
  const id = document.documentElement.getAttribute('data-theme') || 'sage';
  return THEMES.some((t) => t.id === id) ? id : 'sage';
}

function renderThemeSwatches() {
  const box = $('#themeSwatches');
  if (!box) return;
  const cur = currentThemeId();
  box.innerHTML = '';
  for (const t of THEMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-chip' + (t.id === cur ? ' active' : '');
    b.dataset.theme = t.id;
    b.setAttribute('aria-pressed', t.id === cur ? 'true' : 'false');

    const dots = document.createElement('span');
    dots.className = 'theme-dots';
    for (const c of [t.bg, t.panel, t.accent]) {
      const i = document.createElement('i');
      i.style.background = c;
      dots.appendChild(i);
    }
    b.appendChild(dots);

    const name = document.createElement('span');
    name.className = 'theme-name';
    name.textContent = tr(t.name);
    b.appendChild(name);

    const check = document.createElement('span');
    check.className = 'theme-check';
    check.textContent = '✓';
    b.appendChild(check);

    b.addEventListener('click', () => applyTheme(t.id));
    box.appendChild(b);
  }
}

function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  document.documentElement.setAttribute('data-theme', t.id);
  try {
    localStorage.setItem(THEME_KEY, t.id);
  } catch {
    /* 存不了就只在本次生效 */
  }
  themeName = t.name;
  renderThemeSwatches();
  toast(`已切换皮肤：${tr(t.name)}`);
}

function openThemePop() {
  renderThemeSwatches();
  $('#themePop').hidden = false;
  $('#btnTheme').setAttribute('aria-expanded', 'true');
}

function closeThemePop() {
  const pop = $('#themePop');
  if (!pop) return;
  pop.hidden = true;
  $('#btnTheme').setAttribute('aria-expanded', 'false');
}

function toggleThemePop() {
  if ($('#themePop').hidden) openThemePop();
  else closeThemePop();
}

async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    const cfg = await r.json();
    applyConfig(cfg);
  } catch {
    setStatus(false, '服务未连接');
  }
}

function updateApiPinnedCount() {
  const n = $('#cfgApiPinned').value.trim().length;
  const el = $('#apiPinnedCount');
  if (!n) {
    el.textContent = '';
    el.style.color = '';
    return;
  }
  // 太长的时候变个色，提醒它每次都要发一遍
  el.textContent = `· ${n} 字，生成和微调时发送`;
  el.style.color = n > 2000 ? 'var(--warn)' : '';
}

function applyConfig(cfg, opts = {}) {
  S.config = cfg;
  // 只有首次加载时才回写这些可编辑输入框；
  // 保存接口回包一律跳过，避免把正在编辑的内容冲掉。
  if (!opts.skipPinInputs) {
    $('#pinPositive').value = cfg.pinnedPositive || '';
    $('#pinNegative').value = cfg.pinnedNegative || '';
    $('#cfgApiPinned').value = cfg.apiPinnedPrompt || '';
  }
  $('#pinEnabled').checked = cfg.pinEnabled !== false;
  $('#pinbox').classList.toggle('off', !$('#pinEnabled').checked);
  $('#cfgApiPinnedIdea').checked = !!cfg.apiPinnedForIdea;
  $('#modelBadge').textContent = cfg.model ? cfg.model : '未设置模型';
  $('#charModelBadge').textContent = cfg.model ? cfg.model : '未设置模型';
  $('#segModelBadge').textContent = cfg.model ? cfg.model : '未设置模型';
  if ($('#appVersion')) $('#appVersion').textContent = cfg.version ? `v${cfg.version}` : '';
  // 旧进程没有 segment / import / state / favorite / backup 等接口；缺一个就提示重启
  const features = cfg.features || {};
  S.serverStale = !(features.segment && features.import && features.state
    && features.favorite && features.savedSearch && features.backup
    && features.trash && features.profiles && features.variants);
  if (S.serverStale) {
    if (!S.staleNotified) {
      S.staleNotified = true;
      toast(STALE_SERVER_GENERAL, true);
    }
    setStatus(false, '服务端是旧进程');
    if (S.view === 'segment') showSegErr(STALE_SERVER_MSG);
  } else {
    setStatus(cfg.hasKey, cfg.hasKey ? (cfg.model || '已配置') : '未配置 API Key');
  }
}

function setStatus(ok, text) {
  const el = $('#status');
  el.classList.toggle('ok', !!ok);
  $('#statusText').textContent = text;
}

async function saveConfigPatch(patch) {
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const cfg = await r.json();
  if (!r.ok) throw new Error(cfg.error || '保存失败');
  // 保存回包里的置顶词可能是旧值（比如刚触发了一次其它字段的保存），
  // 不能拿它回写输入框，否则会把用户正在填/刚填的内容擦掉。
  applyConfig(cfg, { skipPinInputs: true });
  return cfg;
}

// 生成失败或被取消时，把上一次的结果放回视野里，而不是留一片空白
function restorePromptResult() {
  if (S.current?.parsed) {
    renderResult(S.current.parsed, { sentence: S.current.sentence, language: S.current.language });
  } else if (S.current?.raw) {
    renderRaw(S.current.raw);
  } else {
    $('#empty').hidden = false;
  }
}

// 所有流式请求共用的状态事件：重试/思考/截断提示
function handleStreamMetaEvent(evt) {
  if (evt.type === 'warning') {
    toast(evt.message, true);
    return true;
  }
  if (evt.type === 'thinking') {
    const targets = ['#streamLabel', '#charStreamLabel', '#segStreamLabel', '#refineStatus', '#charRefineStatus', '#segRefineStatus'];
    const el = targets.map((sel) => $(sel)).find((e) => e && e.offsetParent !== null);
    if (el) el.textContent = `模型思考中… ${evt.chars || 0} 字`;
    return true;
  }
  return false;
}

function showImportErr(msg) {  const el = $('#importErr');
  el.textContent = msg;
  el.hidden = false;
}

function openImportDialog() {
  if (S.busy) return toast('正在生成，稍等一下再导入', true);
  $('#importErr').hidden = true;
  $('#importDialog').showModal();
  setTimeout(() => $('#importText').focus(), 40);
}

function runImport() {
  const prompt = $('#importText').value.trim();
  if (!prompt) {
    showImportErr('先粘贴一段已有的提示词');
    $('#importText').focus();
    return;
  }
  const extra = $('#importExtra').value.trim();
  $('#importDialog').close();
  generate({ imported: true, prompt, extra });
}

/* ============ 本机草稿 ============ */
const DRAFT_KEY = 'pf-drafts-v1';
let draftTimer = null;
function draftStack(stack) {
  return (Array.isArray(stack) ? stack : []).slice(-20).map((x) => cloneData(x));
}

function collectDraftSnapshot() {
  const prompt = {
    sentence: $('#sentence')?.value || '',
    extra: $('#extra')?.value || '',
    style: S.style,
    targetModel: $('#targetModel')?.value || '',
    language: $('#language')?.value || 'en',
    detail: $('#detail')?.value || 'standard',
    aspect: $('#promptAspect')?.value || 'auto',
    shot: $('#promptShot')?.value || 'auto',
  };
  if (S.current) {
    prompt.result = {
      stack: draftStack(S.current.stack),
      vIndex: Number(S.current.vIndex) || 0,
      original: cloneData(S.current.original),
      edited: !!S.current.edited,
      historyAt: S.current.historyAt || null,
      pinsBaked: !!S.current.pinsBaked,
      imported: !!S.current.imported,
      importPrompt: S.current.importPrompt || '',
      importExtra: S.current.importExtra || '',
      sentence: S.current.sentence || '',
      language: S.current.language || prompt.language,
    };
  }

  const character = {
    sentence: $('#charSentence')?.value || '',
    extra: $('#charExtra')?.value || '',
    count: $('#charCount')?.value || 'auto',
    aspect: $('#charAspect')?.value || 'auto',
  };
  if (S.charData) {
    character.result = {
      stack: draftStack(S.charStack),
      vIndex: Number(S.charVIndex) || 0,
      original: cloneData(S.charOriginal),
      edited: !!S.charEdited,
      historyAt: S.charHistoryAt || null,
    };
  }

  const segment = {
    sentence: $('#segSentence')?.value || '',
    extra: $('#segExtra')?.value || '',
    type: S.segType,
  };
  if (S.segData) {
    segment.result = {
      stack: draftStack(S.segStack),
      vIndex: Number(S.segVIndex) || 0,
      original: cloneData(S.segOriginal),
      edited: !!S.segEdited,
      historyAt: S.segMeta?.historyAt || null,
      targetModel: S.segMeta?.targetModel || '',
      style: S.segMeta?.style || S.style,
    };
  }
  if (S.segBatch?.results && Object.keys(S.segBatch.results).length) {
    segment.batch = {
      sentence: S.segBatch.sentence || '',
      results: cloneData(S.segBatch.results),
      startedAt: S.segBatch.startedAt || Date.now(),
    };
  }

  return { at: Date.now(), prompt, character, segment };
}

function saveDraftsNow() {
  if (S.draftsSuppressed) return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraftSnapshot()));
  } catch {
    /* 存不下就算了 */
  }
}

function scheduleDraftSave(force = false) {
  if (force) S.draftsSuppressed = false;
  if (S.draftsSuppressed) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraftsNow, 400);
}

function restoreDraftStack(raw, fallback) {
  const stack = Array.isArray(raw?.stack) && raw.stack.length ? raw.stack.map(cloneData) : (fallback ? [cloneData(fallback)] : []);
  const vIndex = Math.min(Math.max(0, Number(raw?.vIndex) || 0), Math.max(0, stack.length - 1));
  return { stack, vIndex, current: stack[vIndex] || fallback || null };
}

function loadDrafts() {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  } catch {
    return;
  }
  if (!d || typeof d !== 'object') return;

  const p = d.prompt || {};
  if (p.sentence) {
    $('#sentence').value = p.sentence;
    refreshCounter();
  }
  if (p.extra) $('#extra').value = p.extra;
  if (STYLES.some((x) => x.id === p.style)) {
    S.style = p.style;
    $('#styleSelect').value = p.style;
  }
  if (p.targetModel) $('#targetModel').value = p.targetModel;
  if (['en', 'zh'].includes(p.language)) $('#language').value = p.language;
  if (['short', 'standard', 'rich'].includes(p.detail)) $('#detail').value = p.detail;
  if (p.aspect) $('#promptAspect').value = p.aspect;
  if (p.shot) $('#promptShot').value = p.shot;
  if (p.result) {
    const stack = restoreDraftStack(p.result);
    if (stack.current) {
      S.current = {
        sentence: p.result.sentence || p.sentence || '',
        style: S.style,
        targetModel: p.targetModel || '',
        language: p.result.language || $('#language').value,
        detail: p.detail || 'standard',
        parsed: stack.current,
        raw: '',
        at: Date.now(),
        ms: 0,
        stack: stack.stack,
        vIndex: stack.vIndex,
        historyAt: p.result.historyAt || null,
        original: p.result.original ? cloneData(p.result.original) : cloneData(stack.current),
        edited: !!p.result.edited,
        pinsBaked: !!p.result.pinsBaked,
        imported: !!p.result.imported,
        importPrompt: p.result.importPrompt || '',
        importExtra: p.result.importExtra || '',
      };
      renderResult(S.current.parsed, { sentence: S.current.sentence, language: S.current.language });
      $('#btnCopyAll').disabled = false;
      $('#btnSavePrompt').disabled = false;
      $('#btnRegen').disabled = false;
    }
  }

  const c = d.character || {};
  if (c.sentence) {
    $('#charSentence').value = c.sentence;
    refreshCounter();
  }
  if (c.extra) $('#charExtra').value = c.extra;
  if (c.count) $('#charCount').value = c.count;
  if (c.aspect) $('#charAspect').value = c.aspect;
  S.charSentence = c.sentence || '';
  if (c.result) {
    const stack = restoreDraftStack(c.result);
    if (stack.current) {
      S.charStack = stack.stack;
      S.charVIndex = stack.vIndex;
      S.charData = stack.current;
      S.charOriginal = c.result.original ? cloneData(c.result.original) : cloneData(stack.current);
      S.charEdited = !!c.result.edited;
      S.charHistoryAt = c.result.historyAt || null;
      renderCharacters(S.charData);
      $('#btnCharSave').disabled = false;
      $('#btnCharCopyAll').disabled = false;
      $('#btnCharRegen').disabled = false;
    }
  }

  const s = d.segment || {};
  if (s.sentence) {
    $('#segSentence').value = s.sentence;
    refreshCounter();
  }
  if (s.extra) $('#segExtra').value = s.extra;
  if (SEG_TYPES.some((t) => t.id === s.type)) {
    S.segType = s.type;
    document.querySelectorAll('#segTypeChips .chip').forEach((c2) => c2.classList.toggle('active', c2.dataset.id === s.type));
  }
  S.segSentence = s.sentence || '';
  if (s.result) {
    const stack = restoreDraftStack(s.result);
    if (stack.current) {
      S.segStack = stack.stack;
      S.segVIndex = stack.vIndex;
      S.segData = stack.current;
      S.segText = stack.current.tags || '';
      S.segOriginal = s.result.original ? cloneData(s.result.original) : cloneData(stack.current);
      S.segEdited = !!s.result.edited;
      S.segMeta = {
        sentence: s.sentence || '',
        type: S.segType,
        targetModel: s.result.targetModel || '',
        style: s.result.style || S.style,
        at: Date.now(),
        historyAt: s.result.historyAt || null,
      };
      renderSegment(S.segData);
      $('#btnSegSave').disabled = false;
      $('#btnSegCopyAll').disabled = false;
      $('#btnSegRegen').disabled = false;
      $('#btnSegAddBoard').disabled = false;
    }
  } else if (s.batch?.results && Object.keys(s.batch.results).length) {
    S.segBatch = {
      sentence: s.batch.sentence || s.sentence || '',
      results: s.batch.results,
      startedAt: s.batch.startedAt || Date.now(),
    };
    S.segBatchMode = true;
    renderSegmentBatch({});
  }
}

function clearDrafts() {
  clearTimeout(draftTimer);
  draftTimer = null;
  S.draftsSuppressed = true;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* 忽略 */
  }
  toast('已清空本机草稿；继续编辑会重新开始保存');
}

/* ============ 多方案生成 ============ */
function variantPayload() {
  return {
    sentence: $('#sentence').value.trim(),
    style: S.style,
    targetModel: $('#targetModel').value.trim(),
    language: $('#language').value,
    detail: $('#detail').value,
    extra: $('#extra').value.trim(),
    aspect: $('#promptAspect').value,
    shot: $('#promptShot').value,
  };
}

function openVariants() {
  const payload = variantPayload();
  if (!payload.sentence) {
    showErr('先写一句话描述你想要的画面');
    $('#sentence').focus();
    return;
  }
  S.variantPayload = payload;
  $('#variantDialog').showModal();
  runVariantBatch();
}

function closeVariantsDialog() {
  if (S.variantAbort) {
    try { S.variantAbort.abort(); } catch { /* 已结束 */ }
  }
  S.variantBusy = false;
  if ($('#variantDialog').open) $('#variantDialog').close();
}

function buildVariantCards() {
  const box = $('#variantGrid');
  box.innerHTML = '';
  S.variantCards = [];
  for (let i = 0; i < 3; i++) {
    const card = document.createElement('div');
    card.className = 'variant-card';
    const title = document.createElement('div');
    title.className = 'variant-card-title';
    title.textContent = `方案 ${i + 1}`;
    const meta = document.createElement('div');
    meta.className = 'variant-meta';
    meta.textContent = '排队中…';
    const text = document.createElement('div');
    text.className = 'variant-text';
    text.textContent = '';
    const translation = document.createElement('div');
    translation.className = 'variant-translation';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn tiny primary';
    btn.textContent = '选用这个方案';
    btn.disabled = true;
    btn.addEventListener('click', () => selectVariant(i));
    card.append(title, meta, text, translation, btn);
    box.appendChild(card);
    S.variantCards.push({ card, title, meta, text, translation, btn });
  }
}

function updateVariantStatus() {
  const results = S.variantResults || [];
  const done = results.filter((r) => r && (r.parsed || r.error)).length;
  const ok = results.filter((r) => r?.parsed).length;
  $('#variantStatus').textContent = S.variantBusy
    ? `正在生成 ${done} / 3…`
    : `完成 ${ok} / 3`;
}

function renderVariantCard(i) {
  const el = S.variantCards?.[i];
  if (!el) return;
  const r = S.variantResults[i];
  if (!r) {
    el.meta.textContent = '排队中…';
    return;
  }
  if (r.parsed) {
    const p = r.parsed;
    el.card.classList.remove('error');
    el.title.textContent = p.title || `方案 ${i + 1}`;
    el.meta.textContent = '已生成';
    el.text.textContent = p.positive || '';
    el.translation.textContent = p.translation || '';
    el.btn.disabled = false;
  } else if (r.error) {
    el.card.classList.add('error');
    el.title.textContent = `方案 ${i + 1}`;
    el.meta.textContent = '失败';
    el.text.textContent = r.error;
    el.translation.textContent = '';
    el.btn.disabled = true;
  } else {
    el.meta.textContent = `生成中… ${r.progress || 0} 字`;
  }
}

async function readVariantStream(res, index) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let acc = '';
  let gotError = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      let evt;
      try {
        evt = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (evt.type === 'delta') {
        acc += evt.text;
        S.variantResults[index] = { progress: acc.length };
        renderVariantCard(index);
      } else if (evt.type === 'warning') {
        toast(evt.message, true);
      } else if (evt.type === 'error') {
        gotError = evt.message;
      }
    }
  }
  if (gotError) throw new Error(gotError);
  if (!acc.trim()) throw new Error('模型没有返回内容');
  return acc;
}

async function runVariantBatch() {
  if (!S.variantPayload) return;
  if (S.variantAbort) {
    try { S.variantAbort.abort(); } catch { /* 忽略 */ }
  }
  S.variantBusy = true;
  S.variantResults = new Array(3).fill(null);
  $('#btnVariantCancel').disabled = false;
  $('#btnVariantAgain').disabled = true;
  buildVariantCards();
  updateVariantStatus();
  const ac = new AbortController();
  S.variantAbort = ac;

  const jobs = [0, 1, 2].map(async (i) => {
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(S.variantPayload),
        signal: ac.signal,
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error(STALE_SERVER_MSG);
        const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const raw = await readVariantStream(res, i);
      const parsed = parseResult(raw);
      if (!parsed || !parsed.positive) throw new Error('模型返回的不是标准 JSON');
      S.variantResults[i] = { parsed, raw };
    } catch (err) {
      S.variantResults[i] = {
        error: err.name === 'AbortError' ? '已取消' : (err.message || String(err)),
      };
    } finally {
      renderVariantCard(i);
      updateVariantStatus();
    }
  });

  await Promise.all(jobs);
  if (S.variantAbort === ac) {
    S.variantAbort = null;
    S.variantBusy = false;
    $('#btnVariantCancel').disabled = true;
    $('#btnVariantAgain').disabled = false;
    updateVariantStatus();
  }
}

function selectVariant(i) {
  const r = S.variantResults[i];
  if (!r?.parsed) return;
  const payload = S.variantPayload || variantPayload();
  const parsed = cloneData(r.parsed);
  S.style = payload.style;
  $('#styleSelect').value = payload.style;
  S.current = {
    sentence: payload.sentence,
    style: payload.style,
    targetModel: payload.targetModel,
    language: payload.language,
    detail: payload.detail,
    parsed,
    raw: r.raw || '',
    at: Date.now(),
    ms: 0,
    stack: [parsed],
    vIndex: 0,
    historyAt: null,
    original: cloneData(parsed),
    edited: false,
    imported: false,
    importPrompt: '',
    importExtra: '',
  };
  closeVariantsDialog();
  renderResult(parsed, { sentence: payload.sentence, language: payload.language });
  pushHistory(S.current);
  S.current.historyAt = S.current.at;
  $('#btnCopyAll').disabled = false;
  $('#btnSavePrompt').disabled = false;
  $('#btnRegen').disabled = false;
  updateRefineUi();
  revealResult('#viewPrompt .result');
  toast('已选用方案，可继续微调');
}

/* ============ 生成 ============ */
async function generate(opts = {}) {
  if (S.busy) return;
  S.draftsSuppressed = false;
  const imported = !!opts.imported;
  const importPrompt = imported ? String(opts.prompt || $('#importText').value || '').trim() : '';
  const importExtra = imported
    ? String(opts.extra ?? $('#importExtra').value ?? '').trim()
    : '';
  const sentence = imported
    ? `导入改写：${importPrompt.replace(/\s+/g, ' ').slice(0, 42)}${importPrompt.length > 42 ? '…' : ''}`
    : $('#sentence').value.trim();

  if (imported && !importPrompt) {
    showImportErr('先粘贴一段已有的提示词');
    return;
  }
  if (!imported && !sentence) {
    showErr('先写一句话描述你想要的画面');
    $('#sentence').focus();
    return;
  }
  hideErr();

  S.busy = true;
  const btn = $('#btnGenerate');
  btn.disabled = true;
  $('#btnGenerateText').textContent = imported ? '改写中…' : '生成中…';
  $('#empty').hidden = true;
  $('#cards').hidden = true;
  $('#stream').hidden = false;
  $('#streamText').textContent = '';
  $('#streamLabel').textContent = imported ? '正在改写…（Esc 取消）' : '正在生成…（Esc 取消）';
  $('#btnCancel').hidden = false;
  $('#btnRegen').disabled = true;

  S.abort = new AbortController();
  const started = Date.now();
  let acc = '';
  let gotError = null;

  try {
    const res = await fetch(imported ? '/api/import' : '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imported
        ? {
          prompt: importPrompt,
          style: S.style,
          targetModel: $('#targetModel').value.trim(),
          language: $('#language').value,
          detail: $('#detail').value,
          extra: importExtra,
          aspect: $('#promptAspect').value,
          shot: $('#promptShot').value,
        }
        : {
          sentence,
          style: S.style,
          targetModel: $('#targetModel').value.trim(),
          language: $('#language').value,
          detail: $('#detail').value,
          extra: $('#extra').value.trim(),
          aspect: $('#promptAspect').value,
          shot: $('#promptShot').value,
        }),
      signal: S.abort.signal,
    });

    if (!res.ok) {
      if (imported && res.status === 404) {
        throw new Error('检测到服务端还是旧进程：没有 /api/import。请重启服务后再试。');
      }
      const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(e.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let evt;
        try {
          evt = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (handleStreamMetaEvent(evt)) continue;
        if (evt.type === 'delta') {
          acc += evt.text;
          $('#streamText').textContent = acc;
          $('#streamText').scrollTop = $('#streamText').scrollHeight;
          $('#streamLabel').textContent = `${imported ? '正在改写' : '正在生成'}… ${acc.length} 字（Esc 取消）`;
        } else if (evt.type === 'retry') {
          $('#streamLabel').textContent = `接口暂时失败，第 ${evt.attempt} 次重试…`;
        } else if (evt.type === 'error') {
          gotError = evt.message;
        }
      }
    }

    if (gotError) throw new Error(gotError);
    if (!acc.trim()) throw new Error('模型没有返回内容，试试换个模型或稍后重试');

    const parsed = parseResult(acc);
    S.current = {
      sentence,
      style: S.style,
      targetModel: $('#targetModel').value.trim(),
      language: $('#language').value,
      detail: $('#detail').value,
      parsed,
      raw: acc,
      at: Date.now(),
      ms: Date.now() - started,
      stack: parsed && parsed.positive ? [parsed] : [],  // 微调版本栈，用来撤回
      vIndex: 0,
      historyAt: null,
      original: parsed ? cloneData(parsed) : null,
      edited: false,
      imported,
      importPrompt: imported ? importPrompt : '',
      importExtra: imported ? importExtra : '',
    };
    if (!parsed) {
      // 解析失败就原样展示，别让用户白等
      renderRaw(acc);
      showErr('模型返回的不是标准 JSON，已按原文展示。可以点「重新生成」再试一次。');
    } else {
      renderResult(parsed, { sentence, raw: acc, language: $('#language').value });
    }

    if (parsed && parsed.positive) {
      pushHistory(S.current);
      S.current.historyAt = S.current.at;
    }
    updateRefineUi();
    updatePromptEditUi();
    $('#stream').hidden = true;
    revealResult('#viewPrompt .result');
  } catch (err) {
    $('#stream').hidden = true;
    if (err.name === 'AbortError') {
      showErr('已取消本次生成');
    } else {
      showErr(err.message || String(err), imported
        ? () => generate({ imported: true, prompt: importPrompt, extra: importExtra })
        : generate);
    }
    restorePromptResult();
  } finally {
    S.busy = false;
    S.abort = null;
    $('#btnCancel').hidden = true;
    btn.disabled = false;
    $('#btnGenerateText').textContent = '生成提示词';
    $('#btnRegen').disabled = !S.current;
    $('#btnCopyAll').disabled = !S.current;
    $('#btnSavePrompt').disabled = !S.current;
    updateRefineUi();
  }
}

/* ============ 结果解析与渲染 ============ */
function parseJsonLoose(raw) {
  let t = String(raw).trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try {
    return JSON.parse(t);
  } catch {
    /* 再试一次：去掉多余的尾逗号 */
  }
  try {
    return JSON.parse(t.replace(/,\s*([}\]])/g, '$1'));
  } catch {
    return null;
  }
}

function parseResult(raw) {
  const o = parseJsonLoose(raw);
  return o ? normalize(o) : null;
}

function normalize(o) {
  if (!o || typeof o !== 'object') return null;
  const p = o.params && typeof o.params === 'object' ? o.params : {};
  return {
    title: str(o.title),
    positive: str(o.positive || o.prompt),
    negative: str(o.negative || o.negative_prompt),
    translation: str(o.translation || o.interpretation || o.description_zh),
    params: {
      aspect_ratio: str(p.aspect_ratio),
      suggested_model: str(p.suggested_model),
      extra: str(p.extra),
    },
    keywords: Array.isArray(o.keywords) ? o.keywords.map(str).filter(Boolean).slice(0, 8) : [],
  };
}

function str(v) {
  if (v === undefined || v === null) return '';
  return typeof v === 'string' ? v.trim() : String(v);
}

// 编辑结果前先留一份模型原版；只处理纯 JSON 数据
function cloneData(v) {
  return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v));
}

/* 置顶词拼接：原样放在最前面 */
function pinOn() {
  return $('#pinEnabled').checked;
}

// 只有标签流风格才做去重；自然语言风格直接拼，避免把句子切坏
function isTagStyle(style) {
  return style === 'sd' || style === 'anime';
}

// 判断正文实际是中文还是英文。结果徽章要反映「生成时」的语言，
// 不能读当前下拉框——否则生成后再改下拉框，旧结果的徽章会跟着变。
function textLanguage(text) {
  return /[\u3400-\u9fff]/.test(String(text || '')) ? 'zh' : 'en';
}

function joinPin(pin, body, taggy) {
  const p = String(pin || '').trim();
  let b = String(body || '').trim();
  if (!p) return b;
  if (!b) return p;

  if (taggy) {
    // 去掉正文里与置顶词完全重复的标签，避免出现 "lowres, lowres" 这种
    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const seen = new Set(p.split(/[,，]/).map(norm).filter(Boolean));
    const parts = b.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const kept = parts.filter((part) => !seen.has(norm(part)));
    if (kept.length !== parts.length) b = kept.join(', ');
    if (!b) return p;
  }

  return /[,，、;\n]$/.test(p) ? `${p} ${b}` : `${p}, ${b}`;
}

function withPins(parsed) {
  // 从保存库载入的内容里置顶词已经拼好了，再拼一次会重复
  if (S.current?.pinsBaked) {
    return { positive: parsed.positive, negative: parsed.negative, pinP: false, pinN: false };
  }
  const taggy = isTagStyle(S.style);
  if (!pinOn()) return { positive: parsed.positive, negative: parsed.negative, pinP: false, pinN: false };
  const pinP = $('#pinPositive').value.trim();
  const pinN = $('#pinNegative').value.trim();
  return {
    positive: joinPin(pinP, parsed.positive, taggy),
    negative: joinPin(pinN, parsed.negative, taggy),
    pinP: !!pinP,
    pinN: !!pinN,
  };
}

function renderResult(parsed, meta = {}) {
  const p = withPins(parsed);

  $('#empty').hidden = true;
  $('#cards').hidden = false;

  $('#outTitle').textContent = parsed.title || meta.sentence || '生成结果';

  const badges = $('#outBadges');
  badges.innerHTML = '';
  if (parsed.params.aspect_ratio) badges.appendChild(badge(parsed.params.aspect_ratio, true));
  if (parsed.params.suggested_model) badges.appendChild(badge(parsed.params.suggested_model, false));
  const st = STYLES.find((x) => x.id === S.style);
  if (st) badges.appendChild(badge(st.label, false));
  const lang = meta.language || S.current?.language || textLanguage(parsed.positive);
  badges.appendChild(badge(lang === 'zh' ? '中文' : '英文', false));
  if (S.current?.edited) badges.appendChild(badge('已手改', true));

  $('#outPositive').textContent = p.positive || '（无）';
  $('#outNegative').textContent = p.negative || '（无）';
  $('#pinBadgeP').hidden = !p.pinP;
  $('#pinBadgeN').hidden = !p.pinN;

  $('#outTranslation').textContent = parsed.translation || '（模型未提供解读）';

  const extra = parsed.params.extra || '';
  $('#cardExtra').hidden = !extra;
  $('#outExtra').textContent = extra;

  const kw = $('#outKeywords');
  kw.innerHTML = '';
  for (const k of parsed.keywords) {
    const s = document.createElement('span');
    s.className = 'kw';
    s.textContent = k;
    kw.appendChild(s);
  }

  S.rendered = { positive: p.positive, negative: p.negative, extra };
  $('#refineBar').hidden = false;
  updateRefineUi();
  updatePromptEditUi();
  scheduleDraftSave();
}

function renderRaw(raw) {
  $('#empty').hidden = true;
  $('#cards').hidden = false;
  $('#refineBar').hidden = true;
  $('#outTitle').textContent = '原始输出';
  $('#outBadges').innerHTML = '';
  $('#outPositive').textContent = String(raw).trim();
  $('#outNegative').textContent = '（无）';
  $('#outTranslation').textContent = '（无）';
  $('#cardExtra').hidden = true;
  $('#outKeywords').innerHTML = '';
  $('#pinBadgeP').hidden = true;
  $('#pinBadgeN').hidden = true;
  S.rendered = { positive: String(raw).trim(), negative: '', extra: '' };
}

function badge(text, accent) {
  const s = document.createElement('span');
  s.className = 'badge' + (accent ? ' accent' : '');
  s.textContent = text;
  return s;
}

/* ============ 复制 ============ */
async function copyText(text, btn) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (btn) {
    const old = btn.textContent;
    btn.textContent = '已复制 ✓';
    btn.classList.add('done');
    setTimeout(() => {
      btn.textContent = old;
      btn.classList.remove('done');
    }, 1400);
  }
}

/* ============ 保存到本地 ============ */
let toastTimer = null;
let toastHideTimer = null;

function hideToast() {
  const el = $('#toast');
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  el.classList.remove('show', 'with-action');
  toastHideTimer = setTimeout(() => {
    el.hidden = true;
    el.textContent = '';
  }, 200);
}

function showToast(msg, isErr, ms, onUndo) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);

  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
  el.classList.toggle('with-action', typeof onUndo === 'function');
  if (typeof onUndo === 'function') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn tiny toast-undo';
    b.textContent = '撤销';
    b.addEventListener('click', async () => {
      hideToast();
      try {
        await onUndo();
      } catch (err) {
        toast(`撤销失败：${err.message || err}`, true);
      }
    });
    el.appendChild(b);
  }

  el.hidden = false;
  void el.offsetWidth;   // 强制 reflow，让过渡生效
  el.classList.add('show');
  toastTimer = setTimeout(hideToast, ms);
}

function toast(msg, isErr) {
  showToast(msg, isErr, 2800, null);
}

// 删除类操作给 8 秒反悔时间
function toastUndo(msg, onUndo) {
  showToast(msg, false, 8000, onUndo);
}

function promptMarkdown() {
  const cur = S.current;
  const p = cur?.parsed || {};
  const r = S.rendered || {};
  const lines = [];

  if (cur?.imported && cur.importPrompt) lines.push(`> 原始提示词：${cur.importPrompt}`);
  else if (cur?.sentence) lines.push(`> 原始描述：${cur.sentence}`);
  const st = STYLES.find((x) => x.id === (cur?.style || S.style));
  if (st) lines.push(`> 风格：${st.label}`);
  if (cur?.targetModel) lines.push(`> 目标模型：${cur.targetModel}`);

  lines.push('', '## 正向提示词', '', r.positive || '');
  lines.push('', '## 负向提示词', '', r.negative || '');
  if (p.translation) lines.push('', '## 画面解读', '', p.translation);

  const params = p.params || {};
  const prm = [];
  if (params.aspect_ratio) prm.push(`- 画幅：${params.aspect_ratio}`);
  if (params.suggested_model) prm.push(`- 建议模型：${params.suggested_model}`);
  if (params.extra) prm.push(`- 参数建议：${params.extra}`);
  if (prm.length) lines.push('', '## 参数建议', '', ...prm);

  return lines.join('\n').trim();
}

function characterMarkdown() {
  const d = S.charData || {};
  const lines = [];
  if (S.charSentence) lines.push(`> 原始描述：${S.charSentence}`);
  if (d.aspect) lines.push(`> 画幅：${d.aspect}`);
  lines.push('', '## 英文提示词', '', d.en || '');
  lines.push('', '## 中文对照', '', d.zh || '');
  return lines.join('\n').trim();
}

async function saveToLocal(kind, title, content, meta, btn) {
  if (!content) return;
  const oldLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '保存中…';
  try {
    const r = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, title, content, meta }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    btn.textContent = '已保存 ✓';
    toast(`已保存：saved/${j.file}`);
    refreshLibraryCount();
    setTimeout(() => { btn.textContent = oldLabel; }, 1800);
  } catch (err) {
    btn.textContent = oldLabel;
    toast(`保存失败：${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

async function openSavedDir() {
  try {
    const r = await fetch('/api/saved/open', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    toast(`已打开：${j.dir}`);
  } catch (err) {
    toast(`打不开目录：${err.message}`, true);
  }
}

/* ============ 保存库（可视化浏览 saved/ 目录） ============ */
function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  const md = `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  // 不是今年的就带上年份，免得看混
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}-${md}`;
}

async function refreshLibraryCount() {
  try {
    const r = await fetch('/api/saved');
    const j = await r.json();
    if (r.ok) {
      S.libTotal = Number(j.count) || 0;
      $('#libBtnCount').textContent = String(S.libTotal);
    }
  } catch {
    /* 计数失败不影响使用 */
  }
}

function initLibraryPrefs() {
  try {
    const v = localStorage.getItem('pf-lib-sort');
    if (['new', 'old', 'title'].includes(v)) S.libSort = v;
  } catch {
    /* 用默认 */
  }
  const sel = $('#libSort');
  if (sel) sel.value = S.libSort;
}

function setLibrarySort(v) {
  if (!['new', 'old', 'title'].includes(v)) return;
  S.libSort = v;
  try {
    localStorage.setItem('pf-lib-sort', v);
  } catch {
    /* 本次生效 */
  }
  renderLibrary();
}

async function openLibrary() {
  closeDrawer();
  closeBoard();
  $('#libMask').hidden = false;
  $('#libDrawer').hidden = false;
  $('#libFilter').value = '';
  S.libEditing = null;
  S.libSelected.clear();
  trapFocus($('#libDrawer'), $('#libFilter'));
  await loadLibrary();
  $('#libFilter').focus();
}

function closeLibrary() {
  S.libEditing = null;
  $('#libMask').hidden = true;
  $('#libDrawer').hidden = true;
  releaseFocusTrap();
}

async function loadLibrary() {
  const box = $('#libList');
  box.innerHTML = '<p class="dim small" style="text-align:center;padding:24px 0">读取中…</p>';
  try {
    const q = $('#libFilter').value.trim();
    const r = await fetch(q ? `/api/saved?q=${encodeURIComponent(q)}` : '/api/saved');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    S.lib = Array.isArray(j.items) ? j.items : [];
    S.libDir = j.dir || '';
    S.libTotal = Number(j.count) || S.lib.length;
    // 搜索会换掉可见条目，选中项只保留仍然可见的
    S.libSelected = new Set([...S.libSelected].filter((name) => S.lib.some((it) => it.name === name)));
    $('#libBtnCount').textContent = String(S.libTotal);
    renderLibrary();
  } catch (err) {
    box.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'dim small';
    p.style.cssText = 'text-align:center;padding:24px 0';
    p.textContent = `读取失败：${err.message}`;
    box.appendChild(p);
  }
}

// 保存库分类的收起状态记在 localStorage，下次打开还保持
const LIB_COLLAPSE_KEY = 'pf-lib-collapsed';

function readCollapsedGroups() {
  try {
    const v = JSON.parse(localStorage.getItem(LIB_COLLAPSE_KEY) || '[]');
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}

function writeCollapsedGroup(kind, collapsed) {
  const set = readCollapsedGroups();
  if (collapsed) set.add(kind);
  else set.delete(kind);
  try {
    localStorage.setItem(LIB_COLLAPSE_KEY, JSON.stringify([...set]));
  } catch {
    /* 存不下就只在本次生效 */
  }
}

function highlightInto(el, text, q) {
  const raw = String(text || '');
  if (!q) {
    el.textContent = raw;
    return;
  }
  const lower = raw.toLowerCase();
  let from = 0;
  let idx;
  while ((idx = lower.indexOf(q, from)) !== -1) {
    if (idx > from) el.appendChild(document.createTextNode(raw.slice(from, idx)));
    const mark = document.createElement('mark');
    mark.textContent = raw.slice(idx, idx + q.length);
    el.appendChild(mark);
    from = idx + q.length;
  }
  if (from < raw.length) el.appendChild(document.createTextNode(raw.slice(from)));
}

function updateLibBulkUi() {
  const n = S.libSelected.size;
  const count = $('#libSelectedCount');
  if (count) count.textContent = n ? `已选 ${n} 个` : '未选择';
  const del = $('#btnLibDeleteSelected');
  if (del) del.disabled = n === 0;
  const boxes = [...document.querySelectorAll('#libList .lib-check')];
  const all = $('#libSelectAll');
  if (all) {
    all.checked = boxes.length > 0 && boxes.every((b) => b.checked);
    all.indeterminate = n > 0 && !all.checked;
  }
}

function renderLibrary() {
  const box = $('#libList');
  const q = ($('#libFilter').value || '').trim().toLowerCase();
  S.libQuery = q;
  const all = S.lib || [];
  const list = [...all].sort((a, b) => {
    if (!!b.favorite !== !!a.favorite) return b.favorite ? 1 : -1;
    if (S.libSort === 'title') return String(a.title).localeCompare(String(b.title), 'zh');
    const ta = new Date(a.mtime).getTime() || 0;
    const tb = new Date(b.mtime).getTime() || 0;
    return S.libSort === 'old' ? ta - tb : tb - ta;
  });

  $('#libCount').textContent = (S.libTotal || all.length)
    ? (q ? `${list.length} / ${S.libTotal} 条` : `${S.libTotal || list.length} 条`)
    : '';
  box.innerHTML = '';

  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'dim small';
    p.style.cssText = 'text-align:center;padding:26px 10px;line-height:1.8';
    p.textContent = q
      ? '没有匹配的内容'
      : '还没有保存过内容。生成结果后点右上角「💾 保存」，就会出现在这里。';
    box.appendChild(p);
    updateLibBulkUi();
    return;
  }

  // 收藏单独置顶；其余按三个大分类固定顺序，未知类型排最后
  const groups = new Map([['收藏', []], ['提示词', []], ['角色设定', []], ['细分提示词', []]]);
  for (const it of list) {
    if (it.favorite) {
      groups.get('收藏').push(it);
      continue;
    }
    if (!groups.has(it.kind)) groups.set(it.kind, []);
    groups.get(it.kind).push(it);
  }
  const collapsed = readCollapsedGroups();

  for (const [kind, items] of groups) {
    if (!items.length) continue;

    const isCollapsed = collapsed.has(kind);
    const section = document.createElement('section');
    section.className = 'lib-group' + (isCollapsed ? ' collapsed' : '');
    section.dataset.kind = kind;

    // 标题本身是按钮：鼠标点、键盘 Enter / Space 都能收起展开
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'lib-group-head';
    head.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    head.title = isCollapsed ? `展开「${kind}」` : `收起「${kind}」`;

    const name = document.createElement('span');
    name.className = 'lib-group-title';
    name.textContent = kind;

    const count = document.createElement('span');
    count.className = 'dim small';
    count.textContent = `${items.length} 条`;

    const caret = document.createElement('span');
    caret.className = 'lib-group-caret';
    caret.textContent = '▾';

    head.appendChild(name);
    head.appendChild(count);
    head.appendChild(caret);
    head.addEventListener('click', () => {
      // 直接改 DOM，不整块重渲染，避免长列表收起时滚动位置跳回顶部
      const nowCollapsed = !section.classList.contains('collapsed');
      section.classList.toggle('collapsed', nowCollapsed);
      groupBody.hidden = nowCollapsed;
      head.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
      head.title = nowCollapsed ? `展开「${kind}」` : `收起「${kind}」`;
      writeCollapsedGroup(kind, nowCollapsed);
    });
    section.appendChild(head);

    const groupBody = document.createElement('div');
    groupBody.className = 'lib-group-body';
    groupBody.hidden = isCollapsed;
    for (const it of items) groupBody.appendChild(libraryItemEl(it));
    section.appendChild(groupBody);

    box.appendChild(section);
  }
  updateLibBulkUi();
}

async function openTrash() {
  $('#trashDialog').showModal();
  await loadTrash();
}

async function loadTrash() {
  const box = $('#trashList');
  box.innerHTML = '<p class="trash-empty">读取中…</p>';
  try {
    const r = await fetch('/api/trash');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    S.trashItems = Array.isArray(j.items) ? j.items : [];
    $('#trashHint').textContent = `删除的文件会先放在这里，${j.retentionDays || 7} 天后自动清理。`;
    renderTrash();
  } catch (err) {
    box.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'trash-empty';
    p.textContent = `读取失败：${err.message}`;
    box.appendChild(p);
  }
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function renderTrash() {
  const box = $('#trashList');
  box.innerHTML = '';
  $('#trashCount').textContent = S.trashItems.length ? `${S.trashItems.length} 个` : '';
  if (!S.trashItems.length) {
    const p = document.createElement('p');
    p.className = 'trash-empty';
    p.textContent = '回收站是空的。';
    box.appendChild(p);
    return;
  }

  for (const it of S.trashItems) {
    const row = document.createElement('div');
    row.className = 'trash-item';
    const name = document.createElement('span');
    name.className = 'trash-name';
    name.textContent = it.name;
    name.title = it.name;
    row.appendChild(name);

    const meta = document.createElement('span');
    meta.className = 'trash-meta';
    meta.textContent = `${fmtTime(it.mtime)} · ${formatSize(it.size)} · 剩 ${it.daysLeft} 天`;
    row.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'trash-actions';
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'btn tiny';
    restore.textContent = '恢复';
    restore.addEventListener('click', () => restoreTrash(it));
    actions.appendChild(restore);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn tiny ghost';
    del.textContent = '彻底删除';
    del.addEventListener('click', () => deleteTrash(it));
    actions.appendChild(del);
    row.appendChild(actions);
    box.appendChild(row);
  }
}

async function restoreTrash(it) {
  try {
    const r = await fetch('/api/saved/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trash: it.name, original: it.name }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    toast(`已恢复：${j.file || it.name}`);
    await loadTrash();
    await loadLibrary();
    refreshLibraryCount();
  } catch (err) {
    toast(`恢复失败：${err.message}`, true);
  }
}

async function deleteTrash(it) {
  if (!confirm(`彻底删除「${it.name}」？\n删除后无法恢复。`)) return;
  try {
    const r = await fetch('/api/trash/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trash: it.name }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    toast('已彻底删除');
    await loadTrash();
  } catch (err) {
    toast(`删除失败：${err.message}`, true);
  }
}

async function emptyTrash() {
  if (!S.trashItems.length) return;
  if (!confirm(`彻底删除回收站里的 ${S.trashItems.length} 个文件？\n删除后无法恢复。`)) return;
  let n = 0;
  for (const it of S.trashItems.slice()) {
    try {
      const r = await fetch('/api/trash/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trash: it.name }),
      });
      if (r.ok) n++;
    } catch {
      /* 单个失败继续 */
    }
  }
  await loadTrash();
  toast(`已彻底删除 ${n} 个文件`);
}

async function toggleLibraryFavorite(it) {  const next = !it.favorite;
  try {
    const r = await fetch('/api/saved/favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: it.name, favorite: next }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 404) throw new Error('服务端还是旧进程，请重启 Prompt Forge 后再试');
      throw new Error(j.error || `HTTP ${r.status}`);
    }
    it.favorite = next;
    renderLibrary();
    toast(next ? '已收藏并置顶' : '已取消收藏');
  } catch (err) {
    toast(`收藏失败：${err.message}`, true);
  }
}

function selectAllLibrary(checked) {
  if (checked) S.lib.forEach((it) => S.libSelected.add(it.name));
  else S.lib.forEach((it) => S.libSelected.delete(it.name));
  renderLibrary();
}

async function deleteSelectedSaved() {
  const names = [...S.libSelected];
  if (!names.length) return;
  if (!confirm(`删除选中的 ${names.length} 个文件？\n文件会先移到回收站，提示条上可以撤销。`)) return;

  const backups = [];
  let failed = 0;
  for (const name of names) {
    try {
      const r = await fetch('/api/saved/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: name }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      backups.push({ trash: j.trash, original: j.original });
    } catch {
      failed++;
    }
  }

  S.libSelected.clear();
  await loadLibrary();
  refreshLibraryCount();
  if (!backups.length) {
    toast('删除失败，文件没有变动', true);
    return;
  }
  const msg = failed
    ? `已删除 ${backups.length} 个，${failed} 个失败`
    : `已删除 ${backups.length} 个文件（7 天内可撤销）`;
  toastUndo(msg, async () => {
    for (const b of backups) {
      await fetch('/api/saved/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trash: b.trash, original: b.original }),
      });
    }
    await loadLibrary();
    refreshLibraryCount();
    toast('已恢复删除的文件');
  });
}

async function buildBackupPackage() {
  const r = await fetch('/api/backup/export');
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  const cfg = S.config || {};
  return {
    app: 'prompt-forge',
    version: 1,
    exportedAt: j.exportedAt || new Date().toISOString(),
    files: Array.isArray(j.files) ? j.files : [],
    favorites: j.favorites && typeof j.favorites === 'object' ? j.favorites : {},
    history: cloneData(S.history || []),
    board: cloneData(S.board || []),
    boardTitle: S.boardTitle || '',
    settings: {
      baseURL: cfg.baseURL || '',
      model: cfg.model || '',
      temperature: cfg.temperature ?? 0.85,
      maxTokens: cfg.maxTokens ?? 0,
      timeoutSec: cfg.timeoutSec ?? 120,
      topP: cfg.topP ?? 1,
      stream: cfg.stream !== false,
      jsonMode: !!cfg.jsonMode,
      pinnedPositive: cfg.pinnedPositive || '',
      pinnedNegative: cfg.pinnedNegative || '',
      pinEnabled: cfg.pinEnabled !== false,
      apiPinnedPrompt: cfg.apiPinnedPrompt || '',
      apiPinnedForIdea: !!cfg.apiPinnedForIdea,
    },
  };
}

async function downloadBackup() {
  try {
    const pkg = await buildBackupPackage();
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    a.href = url;
    a.download = `promptforge-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`已导出备份：${pkg.files.length} 个文件`);
  } catch (err) {
    toast(`导出失败：${err.message}`, true);
  }
}

function validateBackupPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') return '备份内容不是对象';
  if (pkg.app && pkg.app !== 'prompt-forge') return '这不是 Prompt Forge 的备份';
  if (!Array.isArray(pkg.files)) return '备份里没有文件列表';
  if (pkg.files.length > 2000) return '备份文件数量过多';
  if (pkg.history && !Array.isArray(pkg.history)) return '备份里的历史格式不对';
  if (pkg.board && !Array.isArray(pkg.board)) return '备份里的拼装板格式不对';
  return '';
}

async function openBackupDialog(pkg) {
  let conflicts = 0;
  try {
    const r = await fetch('/api/saved');
    const j = await r.json();
    const names = new Set((j.items || []).map((it) => it.name));
    conflicts = pkg.files.filter((f) => names.has(String(f?.name || ''))).length;
  } catch {
    /* 统计不到冲突就按 0 显示 */
  }
  S.pendingBackup = pkg;
  $('#backupSummary').textContent = `备份包含 ${pkg.files.length} 个文件、${(pkg.history || []).length} 条历史、`
    + `${(pkg.board || []).length} 类拼装板${conflicts ? `；其中 ${conflicts} 个文件与现有同名` : ''}。`;
  $('#backupMode').value = 'merge';
  $('#backupApplySettings').checked = false;
  $('#backupDialog').showModal();
}

async function handleBackupFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const pkg = JSON.parse(text);
    const err = validateBackupPackage(pkg);
    if (err) throw new Error(err);
    await openBackupDialog(pkg);
  } catch (e) {
    toast(`读取备份失败：${e.message}`, true);
  }
}

function mergeHistoryLists(current, incoming) {
  const seen = new Set(current.map((h) => `${h.kind || 'prompt'}:${h.at}`));
  const out = [...current];
  for (const h of incoming) {
    if (!h || typeof h !== 'object' || !Number.isFinite(Number(h.at))) continue;
    const key = `${h.kind || 'prompt'}:${h.at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 60);
}

function mergeBoardLists(current, incoming) {
  const out = [...current];
  for (const it of incoming) {
    if (!it || !SEG_TYPES.some((t) => t.id === it.type)) continue;
    if (out.some((x) => x.type === it.type)) continue;
    out.push({ type: it.type, tags: str(it.tags), title: str(it.title), sentence: str(it.sentence), at: Number(it.at) || Date.now() });
  }
  return out.filter((x) => x.tags).slice(0, SEG_TYPES.length);
}

async function applyBackupPackage(pkg, mode, opts = {}) {
  const err = validateBackupPackage(pkg);
  if (err) throw new Error(err);
  const r = await fetch('/api/backup/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, files: pkg.files, favorites: pkg.favorites || {} }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);

  const incomingHistory = Array.isArray(pkg.history) ? pkg.history : [];
  S.history = mode === 'replace'
    ? incomingHistory.filter((h) => h && typeof h === 'object' && Number.isFinite(Number(h.at))).sort((a, b) => b.at - a.at).slice(0, 60)
    : mergeHistoryLists(S.history, incomingHistory);
  saveHistory();

  const incomingBoard = Array.isArray(pkg.board) ? pkg.board : [];
  S.board = mode === 'replace' ? mergeBoardLists([], incomingBoard) : mergeBoardLists(S.board, incomingBoard);
  if (pkg.boardTitle && (mode === 'replace' || !S.boardTitle)) S.boardTitle = String(pkg.boardTitle).slice(0, 60);
  saveBoard();
  if (!$('#boardDrawer').hidden) renderBoard();

  if (opts.applySettings && pkg.settings && typeof pkg.settings === 'object') {
    const allowed = ['baseURL', 'model', 'temperature', 'maxTokens', 'timeoutSec', 'topP', 'stream', 'jsonMode',
      'pinnedPositive', 'pinnedNegative', 'pinEnabled', 'apiPinnedPrompt', 'apiPinnedForIdea'];
    const patch = {};
    for (const k of allowed) if (k in pkg.settings) patch[k] = pkg.settings[k];
    await saveConfigPatch(patch);
    await loadConfig();
  }

  await loadLibrary();
  refreshLibraryCount();
  return j;
}

async function confirmBackupImport(btn) {
  const pkg = S.pendingBackup;
  if (!pkg) return;
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '导入中…';
  try {
    const j = await applyBackupPackage(pkg, $('#backupMode').value, {
      applySettings: $('#backupApplySettings').checked,
    });
    $('#backupDialog').close();
    S.pendingBackup = null;
    toast(`已导入 ${j.imported} 个文件${j.skipped ? `，跳过 ${j.skipped} 个` : ''}`);
  } catch (e) {
    toast(`导入失败：${e.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

// 保存库的「复制」只给能直接出图的英文内容，不把中文对照一起塞进剪贴板。
// kind 用列表项的判定结果，手写文件没有 meta.kind 时也能正确按类型取内容。
function savedCopyText(loaded, fallback, kind) {
  const meta = loaded && loaded.meta && typeof loaded.meta === 'object' ? loaded.meta : {};
  const k = kind || (meta.kind === 'character' ? '角色设定' : meta.kind === 'segment' ? '细分提示词' : '提示词');
  if (k === '角色设定') return meta.prompt_en || fallback || '';
  if (k === '细分提示词') return meta.tags || fallback || '';
  return [meta.positive, meta.negative].filter(Boolean).join('\n\n') || fallback || '';
}

function libraryItemEl(it) {
  const editing = S.libEditing === it.name;
  const selected = S.libSelected.has(it.name);
  const wrap = document.createElement('div');
  wrap.className = 'lib-item' + (editing ? ' editing' : '') + (selected ? ' selected' : '');
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'button');

  const top = document.createElement('div');
  top.className = 'lib-top';

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'lib-check';
  check.checked = selected;
  check.title = selected ? '取消选择' : '选择这个文件';
  check.addEventListener('click', (e) => e.stopPropagation());
  check.addEventListener('change', () => {
    if (check.checked) S.libSelected.add(it.name);
    else S.libSelected.delete(it.name);
    wrap.classList.toggle('selected', check.checked);
    updateLibBulkUi();
  });
  top.appendChild(check);

  const kind = document.createElement('span');
  kind.className = 'lib-kind'
    + (it.kind === '角色设定' ? ' character' : it.kind === '细分提示词' ? ' segment' : '');
  kind.textContent = it.kind;
  top.appendChild(kind);

  const title = document.createElement('span');
  title.className = 'lib-title';
  title.title = it.name;

  let input = null;
  if (editing) {
    input = document.createElement('input');
    input.className = 'lib-rename';
    input.value = it.title;
    input.maxLength = 60;
    input.spellcheck = false;
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        submitRename(it, input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRename();
      }
    });
    title.appendChild(input);
  } else {
    highlightInto(title, it.title, S.libQuery || '');
  }
  top.appendChild(title);

  const fav = document.createElement('button');
  fav.type = 'button';
  fav.className = 'lib-fav' + (it.favorite ? ' active' : '');
  fav.title = it.favorite ? '取消收藏' : '收藏并置顶';
  fav.setAttribute('aria-pressed', it.favorite ? 'true' : 'false');
  fav.textContent = it.favorite ? '★' : '☆';
  fav.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLibraryFavorite(it);
  });
  top.appendChild(fav);

  const time = document.createElement('span');
  time.className = 'lib-time';
  time.textContent = fmtTime(it.mtime);
  top.appendChild(time);

  wrap.appendChild(top);

  const summary = document.createElement('div');
  summary.className = 'lib-summary';
  highlightInto(summary, it.summary || '（无摘要）', S.libQuery || '');
  wrap.appendChild(summary);

  const actions = document.createElement('div');
  actions.className = 'lib-actions';

  const mkBtn = (label, fn, cls) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn tiny ${cls || ''}`.trim();
    b.textContent = label;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn(b);
    });
    actions.appendChild(b);
    return b;
  };

  if (editing) {
    mkBtn('保存', () => submitRename(it, input.value), 'primary');
    mkBtn('取消', () => cancelRename(), 'ghost');
  } else {
    mkBtn('载入', () => openSavedEntry(it), 'primary');
    const copyBtn = mkBtn('复制', async (b) => {
      const loaded = await fetchSavedMeta(it);
      if (!loaded) return;
      const text = savedCopyText(loaded, it.summary, it.kind);
      copyText(text, b);
    });
    copyBtn.title = '复制英文内容（角色设定只复制英文提示词）';
    if (it.kind === '细分提示词') {
      const addBtn = mkBtn('拼装', async (b) => {
        const loaded = await fetchSavedMeta(it);
        if (!loaded) return;
        const meta = loaded.meta && typeof loaded.meta === 'object' ? loaded.meta : {};
        const type = SEG_TYPES.some((t) => t.id === meta.segmentType) ? meta.segmentType : '';
        if (!type) {
          toast('这个文件没有记录细分类型，先载入后再点「＋ 拼装板」', true);
          return;
        }
        if (!addToBoard({
          type,
          tags: meta.tags || it.summary,
          title: loaded.title || it.title,
          sentence: meta.sentence || '',
        })) return;
        b.textContent = '已加入 ✓';
        setTimeout(() => { b.textContent = '拼装'; }, 1400);
      });
      addBtn.title = '把这条细分标签加入拼装板';
    }
    mkBtn('重命名', () => {
      S.libEditing = it.name;
      renderLibrary();
    });
    mkBtn('删除', () => deleteSavedEntry(it), 'ghost');
  }

  wrap.appendChild(actions);
  wrap.addEventListener('click', () => {
    if (S.libEditing === it.name) return;   // 正在改名时点条目不要载入
    openSavedEntry(it);
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.target !== wrap) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (S.libEditing !== it.name) openSavedEntry(it);
    }
  });

  if (editing) {
    setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  }
  return wrap;
}

function cancelRename() {
  S.libEditing = null;
  renderLibrary();
}

async function submitRename(it, value) {
  const title = String(value || '').trim();
  if (!title) {
    toast('名称不能为空', true);
    return;
  }
  if (title === it.title) {
    cancelRename();
    return;
  }
  try {
    const r = await fetch('/api/saved/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: it.name, title }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    S.libEditing = null;
    toast(`已重命名为：${title}`);
    await loadLibrary();
  } catch (err) {
    toast(`重命名失败：${err.message}`, true);
  }
}


async function fetchSavedMeta(it) {
  try {
    const r = await fetch(`/api/saved/item?file=${encodeURIComponent(it.name)}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  } catch (err) {
    toast(`读取失败：${err.message}`, true);
    return null;
  }
}

async function openSavedEntry(it) {
  const loaded = await fetchSavedMeta(it);
  if (!loaded) return;
  const meta = loaded.meta && typeof loaded.meta === 'object' ? loaded.meta : {};

  if (it.kind === '角色设定') loadSavedCharacter(meta, loaded.title);
  else if (it.kind === '细分提示词') loadSavedSegment(meta, loaded.title);
  else loadSavedPrompt(meta, loaded.title);
}

function loadSavedPrompt(meta, fallbackTitle) {
  const parsed = {
    title: meta.title || fallbackTitle || '已保存的提示词',
    positive: str(meta.positive),
    negative: str(meta.negative),
    translation: str(meta.translation),
    params: meta.params && typeof meta.params === 'object' ? meta.params : {},
    keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
  };
  if (!parsed.positive && !parsed.negative) {
    toast('这个文件里没有可载入的提示词内容', true);
    return;
  }

  S.current = {
    sentence: str(meta.sentence),
    style: meta.style || 'sd',
    targetModel: str(meta.targetModel),
    language: textLanguage(parsed.positive),
    parsed,
    at: Date.now(),
    stack: [parsed],
    vIndex: 0,
    historyAt: null,
    original: cloneData(parsed),
    edited: false,
    pinsBaked: true,   // 保存时置顶词已经拼进去了，别再拼一次
  };
  S.style = STYLES.some((x) => x.id === meta.style) ? meta.style : 'sd';
  $('#styleSelect').value = S.style;
  if (meta.targetModel) $('#targetModel').value = meta.targetModel;
  if (meta.sentence) {
    $('#sentence').value = meta.sentence;
    refreshCounter();
  }

  switchView('prompt');
  $('#empty').hidden = true;
  renderResult(parsed, { sentence: meta.sentence, language: textLanguage(parsed.positive) });
  $('#btnCopyAll').disabled = false;
  $('#btnSavePrompt').disabled = false;
  $('#btnRegen').disabled = false;
  closeLibrary();
  toast(`已载入：${parsed.title}`);
}

function loadSavedCharacter(meta, fallbackTitle) {
  const d = normalizeChar({
    title: meta.title || fallbackTitle,
    prompt_en: meta.prompt_en,
    prompt_zh: meta.prompt_zh,
    aspect_ratio: meta.aspect_ratio,
  });
  if (!d) {
    toast('这个文件里没有可载入的角色提示词', true);
    return;
  }

  S.charData = d;
  S.charStack = [d];
  S.charVIndex = 0;
  S.charOriginal = cloneData(d);
  S.charEdited = false;
  S.charHistoryAt = null;
  S.charSentence = str(meta.sentence);
  if (meta.sentence) {
    $('#charSentence').value = meta.sentence;
    refreshCounter();
  }

  switchView('character');
  renderCharacters(d);
  $('#btnCharSave').disabled = false;
  $('#btnCharCopyAll').disabled = false;
  $('#btnCharRegen').disabled = false;
  closeLibrary();
  toast(`已载入：${d.title || fallbackTitle}`);
}

function loadSavedSegment(meta, fallbackTitle) {
  const d = normalizeSegment({
    title: meta.title || fallbackTitle,
    tags: meta.tags,
    translation: meta.translation,
    keywords: meta.keywords,
  });
  if (!d) {
    toast('这个文件里没有可载入的细分标签', true);
    return;
  }

  const type = SEG_TYPES.some((t) => t.id === meta.segmentType) ? meta.segmentType : 'outfit';
  S.segType = type;
  document.querySelectorAll('#segTypeChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.id === type));

  const savedStyle = STYLES.some((x) => x.id === meta.style) ? meta.style : S.style;
  S.style = savedStyle;
  $('#styleSelect').value = savedStyle;
  S.segData = d;
  S.segSentence = str(meta.sentence);
  S.segStack = [d];
  S.segVIndex = 0;
  S.segMeta = {
    sentence: S.segSentence,
    type,
    targetModel: str(meta.targetModel),
    style: savedStyle,
    at: Date.now(),
    historyAt: null,
  };
  S.segText = d.tags;
  S.segOriginal = cloneData(d);
  S.segEdited = false;

  if (S.segSentence) {
    $('#segSentence').value = S.segSentence;
    refreshCounter();
  }
  if (meta.targetModel) {
    $('#targetModel').value = meta.targetModel;
  }

  switchView('segment');
  renderSegment(d);
  $('#btnSegSave').disabled = false;
  $('#btnSegCopyAll').disabled = false;
  $('#btnSegRegen').disabled = false;
  closeLibrary();
  toast(`已载入：${d.title || fallbackTitle}`);
}

async function deleteSavedEntry(it) {
  if (!confirm(`删除「${it.title}」？\n文件会先移到回收站，提示条上可以撤销。`)) return;
  try {
    const r = await fetch('/api/saved/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: it.name }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);

    S.libSelected.delete(it.name);
    await loadLibrary();
    refreshLibraryCount();
    toastUndo(`已删除「${it.title}」（${j.retentionDays || 7} 天内可撤销）`, async () => {
      const rr = await fetch('/api/saved/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trash: j.trash, original: j.original }),
      });
      const jj = await rr.json().catch(() => ({}));
      if (!rr.ok) throw new Error(jj.error || `HTTP ${rr.status}`);
      await loadLibrary();
      refreshLibraryCount();
      toast(`已恢复「${it.title}」`);
    });
  } catch (err) {
    toast(`删除失败：${err.message}`, true);
  }
}

/* ============ 历史 ============ */
const HISTORY_KEY = 'prompt-forge-history-v1';
let historySaveTimer = null;

function readLocalHistory() {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function persistHistoryNow() {
  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: S.history.slice(0, 60) }),
    });
  } catch {
    /* 服务端不可用时继续用 localStorage */
  }
}

function scheduleHistorySave() {
  clearTimeout(historySaveTimer);
  historySaveTimer = setTimeout(persistHistoryNow, 300);
}

async function loadHistory() {
  const local = readLocalHistory();
  try {
    const r = await fetch('/api/history');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    const server = Array.isArray(j.history) ? j.history : [];
    S.history = mergeHistoryLists(server, local);
    // 服务端还没数据，或本地有更新的条目时，把合并后的结果写回
    if (S.history.length !== server.length) persistHistoryNow();
  } catch {
    S.history = local;
  }
  S.historyLoaded = true;
  renderHistory();
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(S.history.slice(0, 60)));
  } catch { /* 存不下就算了 */ }
  renderHistory();
  scheduleHistorySave();
}

function pushHistory(item) {
  S.history.unshift({
    kind: 'prompt',
    sentence: item.sentence,
    style: item.style,
    positive: item.parsed.positive,
    negative: item.parsed.negative,
    title: item.parsed.title,
    translation: item.parsed.translation,
    params: item.parsed.params,
    keywords: item.parsed.keywords,
    targetModel: item.targetModel,
    language: item.language,
    favorite: false,
    imported: !!item.imported,
    importPrompt: item.importPrompt || '',
    importExtra: item.importExtra || '',
    at: item.at,
  });
  S.history = S.history.slice(0, 60);
  saveHistory();
}

// 角色结果也进历史；恢复时按 kind 回到角色页
function pushCharacterHistory() {
  const d = S.charData || {};
  if (!d.en) return;
  const at = Date.now();
  S.history.unshift({
    kind: 'character',
    sentence: S.charSentence || '',
    title: d.title || '角色提示词',
    prompt_en: d.en,
    prompt_zh: d.zh || '',
    aspect_ratio: d.aspect || '',
    targetModel: $('#targetModel').value.trim(),
    style: S.style,
    favorite: false,
    at,
  });
  S.history = S.history.slice(0, 60);
  S.charHistoryAt = at;
  saveHistory();
}

// 角色微调/手改不新增历史，就地更新同一次生成
function updateCharacterHistoryEntry() {
  const at = S.charHistoryAt;
  if (!at) return;
  const h = S.history.find((x) => x.kind === 'character' && x.at === at);
  if (!h) return;
  const d = S.charData || {};
  h.title = d.title || h.title;
  h.prompt_en = d.en || h.prompt_en;
  h.prompt_zh = d.zh || '';
  h.aspect_ratio = d.aspect || '';
  saveHistory();
}

function historyKind(h) {
  return h.kind === 'character' ? 'character' : h.kind === 'segment' ? 'segment' : 'prompt';
}

function renderHistory() {
  $('#historyCount').textContent = S.history.length;
  const box = $('#historyList');
  const q = ($('#histFilter')?.value || '').trim().toLowerCase();
  const all = S.history || [];
  const filter = S.histFilter || 'all';
  const inFilter = filter === 'all' ? all : all.filter((h) => historyKind(h) === filter);
  const list = q
    ? inFilter.filter((h) => `${h.title || ''} ${h.sentence || ''} ${h.positive || ''} ${h.tags || ''} ${h.prompt_en || ''} ${h.prompt_zh || ''} ${h.importPrompt || ''}`
      .toLowerCase().includes(q))
    : inFilter;
  // 收藏的永远排在最前，其余按时间倒序
  const sorted = [...list].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.at || 0) - (a.at || 0));

  document.querySelectorAll('#histFilterChips .hist-filter-btn').forEach((b) => {
    const active = b.dataset.kind === filter;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  box.innerHTML = '';

  if (!all.length) {
    box.innerHTML = '<p class="dim small" style="text-align:center;padding:30px 0">还没有记录</p>';
    return;
  }
  if (!inFilter.length) {
    box.innerHTML = `<p class="dim small" style="text-align:center;padding:30px 0">${filter === 'all' ? '还没有记录' : '这个分类还没有记录'}</p>`;
    return;
  }
  if (!sorted.length) {
    box.innerHTML = '<p class="dim small" style="text-align:center;padding:30px 0">没有匹配的记录</p>';
    return;
  }

  for (const h of sorted) {
    const d = document.createElement('div');
    d.className = 'hist-item';
    d.tabIndex = 0;
    d.setAttribute('role', 'button');

    const top = document.createElement('div');
    top.className = 'h-top';

    const name = document.createElement('span');
    name.textContent = h.title || '未命名';
    top.appendChild(name);

    const time = document.createElement('span');
    time.textContent = fmtTime(new Date(h.at || Date.now()).toISOString());
    top.appendChild(time);

    // 收藏：只改排序，不触发恢复
    const fav = document.createElement('button');
    fav.type = 'button';
    fav.className = 'h-star' + (h.favorite ? ' active' : '');
    fav.title = h.favorite ? '取消收藏' : '收藏并置顶';
    fav.setAttribute('aria-pressed', h.favorite ? 'true' : 'false');
    fav.textContent = h.favorite ? '★' : '☆';
    fav.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHistoryFavorite(h.at);
    });
    top.appendChild(fav);

    // 单条删除
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'h-del';
    del.title = '从历史中删除这条';
    del.textContent = '×';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryEntry(h.at);
    });
    top.appendChild(del);

    d.appendChild(top);

    const sentence = document.createElement('div');
    sentence.className = 'h-sentence';
    sentence.textContent = h.sentence || '';
    d.appendChild(sentence);

    const prompt = document.createElement('div');
    prompt.className = 'h-prompt';
    prompt.textContent = h.kind === 'segment'
      ? (h.tags || '')
      : h.kind === 'character'
        ? (h.prompt_en || '')
        : (h.positive || '');
    d.appendChild(prompt);

    d.addEventListener('click', () => restoreHistoryEntry(h));
    d.addEventListener('keydown', (e) => {
      if (e.target !== d) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        restoreHistoryEntry(h);
      }
    });
    box.appendChild(d);
  }
}

function setHistoryFilter(kind) {
  S.histFilter = ['all', 'prompt', 'character', 'segment'].includes(kind) ? kind : 'all';
  renderHistory();
}

function toggleHistoryFavorite(at) {
  const h = S.history.find((x) => x.at === at);
  if (!h) return;
  h.favorite = !h.favorite;
  saveHistory();
  toast(h.favorite ? '已收藏并置顶' : '已取消收藏');
}

function deleteHistoryEntry(at) {
  const idx = S.history.findIndex((h) => h.at === at);
  if (idx < 0) return;
  const removed = S.history[idx];
  S.history.splice(idx, 1);
  saveHistory();
  toastUndo(`已删除历史「${removed.title || '未命名'}」`, () => {
    // 放回原来的位置，时间线不会乱
    S.history.splice(Math.min(idx, S.history.length), 0, removed);
    saveHistory();
    toast('已恢复这条历史记录');
  });
}

function restoreHistoryEntry(h) {
  // 角色设定有自己的状态，恢复到角色页
  if (h.kind === 'character') {
    const d = normalizeChar({
      title: h.title,
      prompt_en: h.prompt_en,
      prompt_zh: h.prompt_zh,
      aspect_ratio: h.aspect_ratio,
    });
    if (!d) {
      toast('这条历史缺少角色提示词内容', true);
      return;
    }
    S.charData = d;
    S.charStack = [d];
    S.charVIndex = 0;
    S.charOriginal = cloneData(d);
    S.charEdited = false;
    S.charSentence = h.sentence || '';
    S.charHistoryAt = h.at;
    if (h.sentence) {
      $('#charSentence').value = h.sentence;
      refreshCounter();
    }
    const aspects = ['auto', '1:1', '3:4', '2:3', '16:9', '9:16'];
    $('#charAspect').value = aspects.includes(h.aspect_ratio) ? h.aspect_ratio : 'auto';
    if (h.targetModel) $('#targetModel').value = h.targetModel;
    if (STYLES.some((x) => x.id === h.style)) {
      S.style = h.style;
      $('#styleSelect').value = h.style;
    }
    switchView('character');
    renderCharacters(d);
    $('#btnCharSave').disabled = false;
    $('#btnCharCopyAll').disabled = false;
    $('#btnCharRegen').disabled = false;
    closeDrawer();
    return;
  }

  // 细分标签有自己的一套状态，直接恢复回细分页面
  if (h.kind === 'segment') {
    const d = normalizeSegment({
      title: h.title, tags: h.tags, translation: h.translation, keywords: h.keywords,
    });
    if (!d) {
      toast('这条历史缺少标签内容', true);
      return;
    }
    const type = SEG_TYPES.some((t) => t.id === h.segmentType) ? h.segmentType : 'outfit';
    S.segType = type;
    document.querySelectorAll('#segTypeChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.id === type));
    const savedStyle = STYLES.some((x) => x.id === h.style) ? h.style : S.style;
    S.style = savedStyle;
    $('#styleSelect').value = savedStyle;
    S.segData = d;
    S.segSentence = h.sentence || '';
    S.segStack = [d];
    S.segVIndex = 0;
    S.segMeta = {
      sentence: S.segSentence,
      type,
      targetModel: h.targetModel || '',
      style: savedStyle,
      at: h.at,
      historyAt: h.at,
    };
    S.segText = d.tags;
    S.segOriginal = cloneData(d);
    S.segEdited = false;
    if (S.segSentence) {
      $('#segSentence').value = S.segSentence;
      refreshCounter();
    }
    if (h.targetModel) $('#targetModel').value = h.targetModel;
    switchView('segment');
    renderSegment(d);
    closeDrawer();
    return;
  }

  const parsed = {
    title: h.title, positive: h.positive, negative: h.negative,
    translation: h.translation, params: h.params || {}, keywords: h.keywords || [],
  };
  // 旧版本存的历史没有 language 字段，按正文内容兜底判断
  const lang = h.language || textLanguage(h.positive);
  S.current = {
    sentence: h.sentence,
    style: h.style || 'sd',
    targetModel: h.targetModel || '',
    language: lang,
    parsed,
    at: h.at,
    stack: [parsed],
    vIndex: 0,
    historyAt: h.at,
    original: cloneData(parsed),
    edited: false,
    imported: !!h.imported,
    importPrompt: h.importPrompt || '',
    importExtra: h.importExtra || '',
  };
  S.style = STYLES.some((x) => x.id === h.style) ? h.style : 'sd';
  $('#styleSelect').value = S.style;
  switchView('prompt');
  $('#empty').hidden = true;
  renderResult(parsed, { sentence: h.sentence, language: lang });
  $('#btnRegen').disabled = false;
  $('#btnCopyAll').disabled = false;
  $('#btnSavePrompt').disabled = false;
  closeDrawer();
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ============ 随机灵感（让模型现编几条） ============ */
// 两个界面各有一套输入框/候选区，用 ui 描述操作哪一组
const IDEA_UI = {
  prompt: {
    input: '#sentence', bar: '#ideaBar', chips: '#ideaChips',
    hint: '#ideaHint', btn: '#btnRandom', counter: '#counter',
  },
  character: {
    input: '#charSentence', bar: '#charIdeaBar', chips: '#charIdeaChips',
    hint: '#charIdeaHint', btn: '#btnCharIdea', counter: '#charCounter',
  },
};

async function requestIdeas(ui) {
  if (S.ideaBusy) return;
  const btn = $(ui.btn);
  S.ideaBusy = true;
  btn.disabled = true;
  const oldLabel = btn.textContent;
  btn.textContent = '想点子…';

  try {
    // 带上输入框里已有的句子 + 最近生成过的，让模型避开，别给重复题材
    const avoid = [$(ui.input).value.trim(), ...S.history.slice(0, 8).map((h) => h.sentence)]
      .map((s) => String(s || '').trim())
      .filter(Boolean);

    const r = await fetch('/api/idea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avoid }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);

    const ideas = (Array.isArray(j.ideas) ? j.ideas : []).filter(Boolean).slice(0, 8);
    if (!ideas.length) throw new Error('模型没给出可用的句子');

    renderIdeas(ui, ideas);
    $(ui.hint).textContent = `模型现编了 ${ideas.length} 条 · 点一条填进输入框`;
  } catch (err) {
    // 兜底：接口不可用时退回本地词库，这个按钮不能变成死键
    const cur = $(ui.input).value.trim();
    let next = cur;
    while (next === cur) next = IDEAS[Math.floor(Math.random() * IDEAS.length)];
    $(ui.input).value = next;
    refreshCounter();
    renderIdeas(ui, [next]);
    $(ui.hint).textContent = '接口没通，已改用本地词库';
    // 没配 Key 属于预期情况，不弹红色报错打扰
    if (!/API Key|模型名称/.test(err.message)) {
      const msg = `生成灵感失败：${err.message}（已改用本地词库）`;
      if (ui === IDEA_UI.character) showCharErr(msg);
      else showErr(msg);
    }
  } finally {
    S.ideaBusy = false;
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
}

function renderIdeas(ui, ideas) {
  const box = $(ui.chips);
  box.innerHTML = '';
  for (const text of ideas) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'idea-chip';
    b.textContent = text;
    b.title = '点一下填进输入框';
    b.addEventListener('click', () => {
      $(ui.input).value = text;
      refreshCounter();
      box.querySelectorAll('.idea-chip').forEach((x) => x.classList.toggle('picked', x === b));
      $(ui.input).focus();
    });
    box.appendChild(b);
  }
  $(ui.bar).hidden = false;
}

/* ============ 角色设定（另一个界面：直接出一整段英文提示词 + 中文对照） ============ */
function switchView(view) {
  S.view = view;
  $('#viewPrompt').hidden = view !== 'prompt';
  $('#viewCharacter').hidden = view !== 'character';
  $('#viewSegment').hidden = view !== 'segment';
  document.querySelectorAll('#mainTabs .tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.view === view);
  });

  if (view === 'segment' && S.serverStale) showSegErr(STALE_SERVER_MSG);

}

function showCharErr(msg, retry) {
  renderErr($('#charErr'), msg, retry);
}

function hideCharErr() {
  $('#charErr').hidden = true;
}

function normalizeChar(o) {
  if (!o || typeof o !== 'object') return null;
  const en = str(o.prompt_en || o.promptEn || o.prompt || o.english || o.prompt_english);
  const zh = str(o.prompt_zh || o.promptZh || o.chinese || o.prompt_chinese || o.translation);
  if (!en && !zh) return null;
  return {
    title: str(o.title),
    en,
    zh,
    aspect: str(o.aspect_ratio || o.aspect || o.aspectRatio),
  };
}

function promptCard(label, text, mono) {
  const card = document.createElement('div');
  card.className = 'card';

  const head = document.createElement('div');
  head.className = 'card-head';
  const span = document.createElement('span');
  span.textContent = label;
  head.appendChild(span);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn tiny copy';
  btn.textContent = '复制';
  btn.addEventListener('click', () => copyText(text, btn));
  head.appendChild(btn);
  card.appendChild(head);

  const body = document.createElement('div');
  body.className = 'card-body' + (mono ? ' mono' : '');
  body.textContent = text || '（无）';
  card.appendChild(body);

  return card;
}

function renderCharacters(d) {
  const wrap = $('#charCards');
  wrap.innerHTML = '';
  $('#charEmpty').hidden = true;
  $('#charStream').hidden = true;
  wrap.hidden = false;

  const head = document.createElement('div');
  head.className = 'result-title-row';
  const h3 = document.createElement('h3');
  h3.textContent = d.title || '角色提示词';
  h3.dataset.noI18n = '1';
  head.appendChild(h3);

  const badges = document.createElement('div');
  badges.className = 'badges';
  if (d.en) badges.appendChild(badge(`${d.en.split(/\s+/).filter(Boolean).length} 词`, true));
  if (d.aspect) badges.appendChild(badge(d.aspect, false));
  badges.appendChild(badge('英文 + 中文对照', false));
  if (S.charEdited) badges.appendChild(badge('已手改', true));
  head.appendChild(badges);
  wrap.appendChild(head);

  wrap.appendChild(promptCard('英文提示词（可直接出图）', d.en, true));
  wrap.appendChild(promptCard('中文对照', d.zh, false));

  S.charData = d;
  // 「复制英文」按钮只给英文提示词；中文对照在单独的卡片里
  S.charText = d.en || '';
  $('#charRefineBar').hidden = false;
  updateCharRefineUi();
  updateCharEditUi();
  scheduleDraftSave();
}

/* ============ 角色提示词的微调 ============ */
const CHAR_REFINE_CHIPS = [
  '改成夜景', '换到室内', '去掉一个角色', '再加一个角色',
  '服装换成现代装', '更写实一些', '改成全身远景', '镜头拉近成特写',
  '细节再多些', '简化一点',
];

function renderCharRefineChips() {
  const box = $('#charRefineChips');
  box.innerHTML = '';
  for (const text of CHAR_REFINE_CHIPS) {
    const label = S.lang === 'en' ? tr(text) : text;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => {
      $('#charRefineInput').value = label;
      refineCharacter(label);
    });
    box.appendChild(b);
  }
}

function updateCharVersionUi() {
  const stack = S.charStack || [];
  const bar = $('#charVersionBar');
  if (!bar) return;
  bar.hidden = stack.length <= 1;
  if (bar.hidden) return;
  const chips = $('#charVersionChips');
  chips.innerHTML = '';
  stack.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'version-chip' + (i === S.charVIndex ? ' active' : '');
    b.textContent = `v${i + 1}`;
    b.title = i === 0 ? '模型原版' : `第 ${i + 1} 版`;
    b.addEventListener('click', () => selectCharVersion(i));
    chips.appendChild(b);
  });
}

function selectCharVersion(i) {
  if (!S.charStack?.[i]) return;
  S.charVIndex = i;
  S.charData = cloneData(S.charStack[i]);
  S.charEdited = false;
  renderCharacters(S.charData);
  updateCharacterHistoryEntry();
}

function updateCharRefineUi() {
  const n = Math.max(0, Number(S.charVIndex) || 0);
  if (!S.charBusy) {
    $('#charRefineStatus').textContent = n > 0 ? `已微调 ${n} 次` : '';
  }
  $('#btnCharUndoRefine').disabled = n <= 0 || S.charBusy;
  $('#btnCharRefine').disabled = S.charBusy;
  $('#charRefineInput').disabled = S.charBusy;
  $('#charRefineChips').querySelectorAll('button').forEach((b) => { b.disabled = S.charBusy; });
  updateCharVersionUi();
}

async function refineCharacter(instructionArg) {
  if (S.charBusy) return;
  S.draftsSuppressed = false;
  const instruction = String(instructionArg ?? $('#charRefineInput').value).trim();
  if (!instruction) {
    showCharErr('先写一句要改什么，比如「改成夜景」');
    $('#charRefineInput').focus();
    return;
  }
  const cur = S.charData;
  if (!cur?.en) {
    showCharErr('还没有可以微调的提示词，先生成一条');
    return;
  }

  hideCharErr();
  S.charBusy = true;
  const btn = $('#btnCharRefine');
  const oldLabel = btn.textContent;
  btn.textContent = '微调中…';
  $('#charRefineStatus').textContent = '微调中…';
  updateCharRefineUi();

  S.charAbort = new AbortController();
  let acc = '';
  let gotError = null;

  try {
    const res = await fetch('/api/characters/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        previous: { prompt_en: cur.en, prompt_zh: cur.zh, aspect: cur.aspect },
        style: S.style,
        targetModel: $('#targetModel').value.trim(),
        detail: $('#detail').value,
      }),
      signal: S.charAbort.signal,
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(e.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let evt;
        try {
          evt = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (handleStreamMetaEvent(evt)) continue;
        if (evt.type === 'delta') {
          acc += evt.text;
          $('#charRefineStatus').textContent = `微调中… ${acc.length} 字`;
        } else if (evt.type === 'retry') {
          $('#charRefineStatus').textContent = `接口暂时失败，第 ${evt.attempt} 次重试…`;
        } else if (evt.type === 'error') {
          gotError = evt.message;
        }
      }
    }

    if (gotError) throw new Error(gotError);
    if (!acc.trim()) throw new Error('模型没有返回内容，再试一次');

    const parsed = normalizeChar(parseJsonLoose(acc));
    if (!parsed) throw new Error('模型返回的不是标准 JSON，再试一次或换个模型');

    if (S.charVIndex < S.charStack.length - 1) S.charStack = S.charStack.slice(0, S.charVIndex + 1);
    S.charStack.push(parsed);
    S.charVIndex = S.charStack.length - 1;
    S.charOriginal = cloneData(parsed);
    S.charEdited = false;
    renderCharacters(parsed);
    updateCharacterHistoryEntry();
    $('#charRefineInput').value = '';
    revealResult('#viewCharacter .result');
    $('#charRefineInput').focus();
  } catch (err) {
    if (err.name === 'AbortError') {
      showCharErr('已取消本次微调');
    } else {
      showCharErr(err.message || String(err), () => refineCharacter(instruction));
    }
  } finally {
    S.charBusy = false;
    S.charAbort = null;
    btn.textContent = oldLabel;
    updateCharRefineUi();
  }
}

function undoCharRefine() {
  if (!S.charStack || S.charVIndex <= 0) return;
  S.charVIndex--;
  const d = cloneData(S.charStack[S.charVIndex]);
  S.charData = d;
  S.charEdited = false;
  renderCharacters(d);
  updateCharacterHistoryEntry();
  hideCharErr();
}

async function generateCharacters() {
  if (S.charBusy) return;
  S.draftsSuppressed = false;
  const sentence = $('#charSentence').value.trim();
  if (!sentence) {
    showCharErr('先写一句话描述你想要的这组角色');
    $('#charSentence').focus();
    return;
  }
  hideCharErr();

  S.charBusy = true;
  const btn = $('#btnCharGenerate');
  btn.disabled = true;
  $('#btnCharGenerateText').textContent = '生成中…';
  $('#charEmpty').hidden = true;
  $('#charCards').hidden = true;
  $('#charStream').hidden = false;
  $('#charStreamText').textContent = '';
  $('#charStreamLabel').textContent = '正在生成…（Esc 取消）';
  $('#btnCharCancel').hidden = false;
  $('#btnCharRegen').disabled = true;

  S.charAbort = new AbortController();
  let acc = '';
  let gotError = null;

  try {
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence,
        extra: $('#charExtra').value.trim(),
        count: $('#charCount').value,
        aspect: $('#charAspect').value,
        style: S.style,
        targetModel: $('#targetModel').value.trim(),
        detail: $('#detail').value,
      }),
      signal: S.charAbort.signal,
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(e.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let evt;
        try {
          evt = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (handleStreamMetaEvent(evt)) continue;
        if (evt.type === 'delta') {
          acc += evt.text;
          $('#charStreamText').textContent = acc;
          $('#charStreamText').scrollTop = $('#charStreamText').scrollHeight;
          $('#charStreamLabel').textContent = `正在生成… ${acc.length} 字（Esc 取消）`;
        } else if (evt.type === 'retry') {
          $('#charStreamLabel').textContent = `接口暂时失败，第 ${evt.attempt} 次重试…`;
        } else if (evt.type === 'error') {
          gotError = evt.message;
        }
      }
    }

    if (gotError) throw new Error(gotError);
    if (!acc.trim()) throw new Error('模型没有返回内容，再试一次');

    const parsed = normalizeChar(parseJsonLoose(acc));
    if (!parsed) {
      // 解析失败就把原文露出来，别让用户白等
      $('#charStream').hidden = false;
      $('#charStreamText').textContent = acc;
      $('#charRefineBar').hidden = true;
      showCharErr('模型返回的不是标准 JSON，已按原文显示。可以点「重新生成」再试一次。');
      return;
    }

    S.charStack = [parsed];
    S.charVIndex = 0;
    S.charOriginal = cloneData(parsed);
    S.charEdited = false;
    renderCharacters(parsed);
    S.charSentence = sentence;
    pushCharacterHistory();
    revealResult('#viewCharacter .result');
    $('#btnCharSave').disabled = false;
    $('#btnCharCopyAll').disabled = false;
    $('#btnCharRegen').disabled = false;
  } catch (err) {
    $('#charStream').hidden = true;
    $('#charRefineBar').hidden = true;
    if (err.name === 'AbortError') {
      showCharErr('已取消本次生成');
      if (S.charData) renderCharacters(S.charData);
      else $('#charEmpty').hidden = false;
    } else {
      showCharErr(err.message || String(err), generateCharacters);
      if (S.charData) renderCharacters(S.charData);
      else $('#charEmpty').hidden = false;
    }
  } finally {
    S.charBusy = false;
    S.charAbort = null;
    $('#btnCharCancel').hidden = true;
    btn.disabled = false;
    $('#btnCharGenerateText').textContent = '生成角色提示词';
    updateCharRefineUi();
  }
}

/* ============ 细分提示词（单独生成某一维度的 tag 组合） ============ */
function showSegErr(msg, retry) {
  renderErr($('#segErr'), msg, retry);
}

function hideSegErr() {
  $('#segErr').hidden = true;
}

function normalizeSegment(o) {
  if (!o || typeof o !== 'object') return null;
  const tags = str(o.tags || o.tag || o.positive || o.prompt);
  if (!tags) return null;
  return {
    title: str(o.title),
    tags,
    translation: str(o.translation || o.description_zh || o.zh),
    keywords: Array.isArray(o.keywords) ? o.keywords.map(str).filter(Boolean).slice(0, 8) : [],
  };
}

function countTags(tags) {
  return String(tags || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean).length;
}

async function generateSegment() {
  if (S.segBusy) return;
  S.draftsSuppressed = false;
  if (S.serverStale) {
    showSegErr(STALE_SERVER_MSG);
    return;
  }
  const sentence = $('#segSentence').value.trim();
  if (!sentence) {
    showSegErr('先写一句话描述要生成的对象');
    $('#segSentence').focus();
    return;
  }
  hideSegErr();

  S.segBusy = true;
  S.segBatchMode = false;
  S.segBatch = null;
  const btn = $('#btnSegGenerate');
  btn.disabled = true;
  $('#btnSegAll').disabled = true;
  $('#btnSegGenerateText').textContent = '生成中…';
  $('#segEmpty').hidden = true;
  $('#segCards').hidden = true;
  $('#segRefineBar').hidden = true;
  $('#segStream').hidden = false;
  $('#segStreamText').textContent = '';
  $('#segStreamLabel').textContent = '正在生成…（按 Esc 取消）';
  $('#btnSegCancel').hidden = false;
  $('#btnSegRegen').disabled = true;
  $('#btnSegCopyAll').disabled = true;
  $('#btnSegSave').disabled = true;
  $('#btnSegAddBoard').disabled = true;

  S.segAbort = new AbortController();
  // 服务端 120 秒没数据会自己中止；这里再兜一层，防止网络层完全卡死
  let timedOut = false;
  const watchdog = setTimeout(() => {
    timedOut = true;
    if (S.segAbort) S.segAbort.abort();
  }, 180000);
  let acc = '';
  let gotError = null;

  try {
    const res = await fetch('/api/segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence,
        segmentType: S.segType,
        targetModel: $('#targetModel').value.trim(),
        detail: $('#detail').value,
        style: S.style,
        extra: $('#segExtra').value.trim(),
      }),
      signal: S.segAbort.signal,
    });

    if (!res.ok) {
      if (res.status === 404) throw new Error(STALE_SERVER_MSG);
      const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(e.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let evt;
        try {
          evt = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (handleStreamMetaEvent(evt)) continue;
        if (evt.type === 'delta') {
          acc += evt.text;
          $('#segStreamText').textContent = acc;
          $('#segStreamText').scrollTop = $('#segStreamText').scrollHeight;
          $('#segStreamLabel').textContent = `正在生成… ${acc.length} 字（Esc 取消）`;
        } else if (evt.type === 'retry') {
          $('#segStreamLabel').textContent = `接口暂时失败，第 ${evt.attempt} 次重试…`;
        } else if (evt.type === 'error') {
          gotError = evt.message;
        }
      }
    }

    if (gotError) throw new Error(gotError);
    if (!acc.trim()) throw new Error('模型没有返回内容，再试一次');

    const parsed = normalizeSegment(parseJsonLoose(acc));
    if (!parsed) throw new Error('模型返回的不是标准 JSON，再试一次或换个模型');

    S.segData = parsed;
    S.segSentence = sentence;
    S.segStack = [parsed];
    S.segVIndex = 0;
    S.segOriginal = cloneData(parsed);
    S.segEdited = false;
    S.segMeta = {
      sentence,
      type: S.segType,
      targetModel: $('#targetModel').value.trim(),
      style: S.style,
      at: Date.now(),
      historyAt: null,
    };
    renderSegment(parsed);
    pushSegmentHistory();
    S.segMeta.historyAt = S.segMeta.at;
    revealResult('#viewSegment .result');
  } catch (err) {
    $('#segStream').hidden = true;
    // 取消或失败时，如果之前已经有结果，把它放回来，别让旧结果跟着一起消失
    if (S.segData) renderSegment(S.segData);
    else $('#segEmpty').hidden = false;
    if (err.name === 'AbortError') {
      if (timedOut) {
        showSegErr('生成超过 3 分钟仍未完成，已自动中止。请重试，或在设置里换一个模型。', generateSegment);
      } else {
        showSegErr('已取消本次生成');
      }
    } else {
      showSegErr(err.message || String(err), generateSegment);
    }
  } finally {
    clearTimeout(watchdog);
    $('#btnSegCancel').hidden = true;
    S.segBusy = false;
    S.segAbort = null;
    btn.disabled = false;
    $('#btnSegAll').disabled = false;
    $('#btnSegGenerateText').textContent = '生成标签组合';
    $('#btnSegRegen').disabled = !S.segData;
    $('#btnSegCopyAll').disabled = !S.segData;
    $('#btnSegSave').disabled = !S.segData;
    $('#btnSegAddBoard').disabled = !S.segData;
    updateSegRefineUi();
  }
}

function renderSegment(d) {
  hideSegErr();
  S.segBatchMode = false;
  const wrap = $('#segCards');
  wrap.innerHTML = '';
  $('#segEmpty').hidden = true;
  $('#segStream').hidden = true;
  wrap.hidden = false;

  const meta = S.segMeta || { type: S.segType, targetModel: $('#targetModel').value.trim(), style: S.style };
  const type = SEG_TYPES.some((t) => t.id === meta.type) ? meta.type : 'outfit';

  const head = document.createElement('div');
  head.className = 'result-title-row';
  const h3 = document.createElement('h3');
  h3.textContent = d.title || '细分标签';
  h3.dataset.noI18n = '1';
  head.appendChild(h3);

  const badges = document.createElement('div');
  badges.className = 'badges';
  badges.appendChild(badge(segTypeLabel(type), true));
  badges.appendChild(badge(`${countTags(d.tags)} 个标签`, false));
  if (meta.targetModel && meta.targetModel !== '通用') badges.appendChild(badge(meta.targetModel, false));
  if (S.segEdited) badges.appendChild(badge('已手改', true));
  head.appendChild(badges);
  wrap.appendChild(head);

  wrap.appendChild(promptCard('标签组合（可直接粘贴）', d.tags, true));
  if (d.translation) wrap.appendChild(promptCard('中文对照', d.translation, false));

  if (d.keywords.length) {
    const kw = document.createElement('div');
    kw.className = 'keywords';
    for (const k of d.keywords) {
      const s = document.createElement('span');
      s.className = 'kw';
      s.textContent = k;
      kw.appendChild(s);
    }
    wrap.appendChild(kw);
  }

  $('#segNote').hidden = false;
  $('#segRefineBar').hidden = false;
  S.segData = d;
  S.segText = d.tags;
  $('#btnSegSave').disabled = false;
  $('#btnSegCopyAll').disabled = false;
  $('#btnSegRegen').disabled = false;
  $('#btnSegAddBoard').disabled = false;
  updateSegRefineUi();
  updateSegEditUi();
  scheduleDraftSave();
}

function segmentMarkdown() {
  const d = S.segData || {};
  const meta = S.segMeta || {};
  const lines = [];
  if (meta.sentence) lines.push(`> 原始描述：${meta.sentence}`);
  lines.push(`> 细分类型：${segTypeLabel(meta.type)}`);
  const style = STYLES.find((x) => x.id === meta.style);
  if (style) lines.push(`> 提示词风格：${style.label}`);
  if (meta.targetModel && meta.targetModel !== '通用') lines.push(`> 目标模型：${meta.targetModel}`);

  lines.push('', '## 标签组合', '', d.tags || '');
  if (d.translation) lines.push('', '## 中文对照', '', d.translation);
  return lines.join('\n').trim();
}

// 细分结果也进历史，和完整提示词混排；恢复时按 kind 回到对应的界面
function pushSegmentHistory() {
  const d = S.segData || {};
  const meta = S.segMeta || {};
  S.history.unshift({
    kind: 'segment',
    sentence: meta.sentence || S.segSentence || '',
    segmentType: meta.type || S.segType,
    targetModel: meta.targetModel || '',
    style: meta.style || S.style,
    title: d.title || '细分标签',
    tags: d.tags || '',
    translation: d.translation || '',
    keywords: d.keywords || [],
    favorite: false,
    at: meta.at || Date.now(),
  });
  S.history = S.history.slice(0, 60);
  saveHistory();
}

// 微调不新增历史，而是就地更新同一次细分生成的那条
function updateSegmentHistoryEntry() {
  const at = S.segMeta?.historyAt;
  if (!at) return;
  const h = S.history.find((x) => x.kind === 'segment' && x.at === at);
  if (!h) return;
  const d = S.segData || {};
  h.title = d.title || h.title;
  h.tags = d.tags || h.tags;
  h.translation = d.translation || '';
  h.keywords = d.keywords || [];
  h.style = S.segMeta?.style || h.style;
  saveHistory();
}

function updateSegVersionUi() {
  const stack = S.segStack || [];
  const bar = $('#segVersionBar');
  if (!bar) return;
  bar.hidden = stack.length <= 1 || S.segBatchMode;
  if (bar.hidden) return;
  const chips = $('#segVersionChips');
  chips.innerHTML = '';
  stack.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'version-chip' + (i === S.segVIndex ? ' active' : '');
    b.textContent = `v${i + 1}`;
    b.title = i === 0 ? '模型原版' : `第 ${i + 1} 版`;
    b.addEventListener('click', () => selectSegVersion(i));
    chips.appendChild(b);
  });
}

function selectSegVersion(i) {
  if (!S.segStack?.[i]) return;
  S.segVIndex = i;
  S.segData = cloneData(S.segStack[i]);
  S.segText = S.segData.tags || '';
  S.segEdited = false;
  renderSegment(S.segData);
  updateSegmentHistoryEntry();
}

function updateSegRefineUi() {
  const n = Math.max(0, Number(S.segVIndex) || 0);
  if (!S.segBusy) {
    $('#segRefineStatus').textContent = n > 0 ? `已微调 ${n} 次` : '';
  }
  $('#btnSegUndoRefine').disabled = n <= 0 || S.segBusy;
  $('#btnSegRefine').disabled = S.segBusy;
  $('#segRefineInput').disabled = S.segBusy;
  $('#segRefineChips').querySelectorAll('button').forEach((b) => { b.disabled = S.segBusy; });
  updateSegVersionUi();
}

async function refineSegment(instructionArg) {
  if (S.segBusy) return;
  S.draftsSuppressed = false;
  const instruction = String(instructionArg ?? $('#segRefineInput').value).trim();
  if (!instruction) {
    showSegErr('先写一句要改什么，比如「更华丽」');
    $('#segRefineInput').focus();
    return;
  }
  const cur = S.segData;
  if (!cur?.tags) {
    showSegErr('还没有可以微调的标签，先生成一条');
    return;
  }

  hideSegErr();
  S.segBusy = true;
  const btn = $('#btnSegRefine');
  const oldLabel = btn.textContent;
  btn.textContent = '微调中…';
  $('#segRefineStatus').textContent = '微调中…';
  $('#btnSegGenerate').disabled = true;
  $('#btnSegRegen').disabled = true;
  updateSegRefineUi();

  S.segAbort = new AbortController();
  let acc = '';
  let gotError = null;

  try {
    const res = await fetch('/api/segment/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        previous: { tags: cur.tags, translation: cur.translation },
        segmentType: S.segMeta?.type || S.segType,
        targetModel: S.segMeta?.targetModel || $('#targetModel').value.trim(),
        style: S.segMeta?.style || S.style,
      }),
      signal: S.segAbort.signal,
    });

    if (!res.ok) {
      if (res.status === 404) throw new Error(STALE_SERVER_MSG);
      const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(e.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let evt;
        try {
          evt = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (handleStreamMetaEvent(evt)) continue;
        if (evt.type === 'delta') {
          acc += evt.text;
          $('#segRefineStatus').textContent = `微调中… ${acc.length} 字`;
        } else if (evt.type === 'retry') {
          $('#segRefineStatus').textContent = `接口暂时失败，第 ${evt.attempt} 次重试…`;
        } else if (evt.type === 'error') {
          gotError = evt.message;
        }
      }
    }

    if (gotError) throw new Error(gotError);
    if (!acc.trim()) throw new Error('模型没有返回内容，再试一次');

    const parsed = normalizeSegment(parseJsonLoose(acc));
    if (!parsed) throw new Error('模型返回的不是标准 JSON，再试一次或换个模型');

    if (S.segVIndex < S.segStack.length - 1) S.segStack = S.segStack.slice(0, S.segVIndex + 1);
    S.segStack.push(parsed);
    S.segVIndex = S.segStack.length - 1;
    S.segData = parsed;
    S.segOriginal = cloneData(parsed);
    S.segEdited = false;
    renderSegment(parsed);
    updateSegmentHistoryEntry();
    $('#segRefineInput').value = '';
    revealResult('#viewSegment .result');
    $('#segRefineInput').focus();
  } catch (err) {
    if (err.name === 'AbortError') {
      showSegErr('已取消本次微调');
    } else {
      showSegErr(err.message || String(err), () => refineSegment(instruction));
    }
  } finally {
    S.segBusy = false;
    S.segAbort = null;
    btn.textContent = oldLabel;
    $('#btnSegGenerate').disabled = false;
    $('#btnSegRegen').disabled = !S.segData;
    updateSegRefineUi();
  }
}

function undoSegmentRefine() {
  const stack = S.segStack || [];
  if (S.segVIndex <= 0) return;
  S.segVIndex--;
  const d = cloneData(stack[S.segVIndex]);
  S.segData = d;
  S.segEdited = false;
  renderSegment(d);
  updateSegmentHistoryEntry();
  hideSegErr();
}

/* ============ 一键生成七类标签 ============ */

async function requestSegmentOnce(type, sentence, extra, onDelta) {
  const res = await fetch('/api/segment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sentence,
      segmentType: type,
      targetModel: $('#targetModel').value.trim(),
      detail: $('#detail').value,
      style: S.style,
      extra,
    }),
    signal: S.segAbort.signal,
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error(STALE_SERVER_MSG);
    const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let acc = '';
  let gotError = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      let evt;
      try {
        evt = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (handleStreamMetaEvent(evt)) continue;
      if (evt.type === 'delta') {
        acc += evt.text;
        if (onDelta) onDelta(acc);
      } else if (evt.type === 'retry') {
        $('#segStreamLabel').textContent = `第 ${evt.attempt} 次重试：接口暂时失败…`;
      } else if (evt.type === 'error') {
        gotError = evt.message;
      }
    }
  }

  if (gotError) throw new Error(gotError);
  if (!acc.trim()) throw new Error('模型没有返回内容，再试一次');
  const parsed = normalizeSegment(parseJsonLoose(acc));
  if (!parsed) throw new Error('模型返回的不是标准 JSON，再试一次或换个模型');
  return parsed;
}

async function generateAllSegments(resume = false) {
  if (S.segBusy) return;
  if (S.serverStale) {
    showSegErr(STALE_SERVER_MSG);
    return;
  }
  const sentence = $('#segSentence').value.trim();
  if (!sentence) {
    showSegErr('先写一句话描述要生成的对象');
    $('#segSentence').focus();
    return;
  }

  if (!resume || !S.segBatch || S.segBatch.sentence !== sentence) {
    S.segBatch = { sentence, results: {}, startedAt: Date.now() };
  }
  S.segBatchMode = true;
  S.segBusy = true;
  S.segData = null;
  S.segText = '';
  S.segSentence = sentence;
  hideSegErr();

  const btnAll = $('#btnSegAll');
  btnAll.disabled = true;
  $('#btnSegGenerate').disabled = true;
  $('#btnSegGenerateText').textContent = '批量生成中…';
  $('#segEmpty').hidden = true;
  $('#segCards').hidden = true;
  $('#segRefineBar').hidden = true;
  $('#segStream').hidden = false;
  $('#segStreamText').textContent = '';
  $('#segStreamLabel').textContent = '准备生成七类标签…';
  $('#btnSegCancel').hidden = false;
  ['#btnSegRegen', '#btnSegCopyAll', '#btnSegSave', '#btnSegAddBoard', '#btnEditSeg', '#btnRestoreSeg']
    .forEach((sel) => { $(sel).disabled = true; });
  updateSegRefineUi();
  updateSegEditUi();

  S.segAbort = new AbortController();
  const started = Date.now();
  let failed = null;

  try {
    const types = resume
      ? SEG_TYPES.filter((t) => !S.segBatch.results[t.id])
      : SEG_TYPES;

    for (const t of types) {
      const done = Object.keys(S.segBatch.results).length;
      const elapsed = Math.round((Date.now() - started) / 1000);
      $('#segStreamLabel').textContent = `正在生成 ${done + 1}/7：${t.label} · 已用 ${elapsed} 秒（Esc 取消）`;
      $('#segStreamText').textContent = '';
      const parsed = await requestSegmentOnce(t.id, sentence, $('#segExtra').value.trim(), (acc) => {
        $('#segStreamText').textContent = acc;
        $('#segStreamText').scrollTop = $('#segStreamText').scrollHeight;
        $('#segStreamLabel').textContent = `正在生成 ${done + 1}/7：${t.label} · ${acc.length} 字（Esc 取消）`;
      });
      S.segBatch.results[t.id] = parsed;
      addToBoard({ type: t.id, tags: parsed.tags, title: parsed.title, sentence }, { silent: true });
      $('#segStreamText').textContent = parsed.tags || '';
    }
  } catch (err) {
    if (err.name !== 'AbortError') failed = err.message || String(err);
  } finally {
    S.segBusy = false;
    S.segAbort = null;
    $('#btnSegCancel').hidden = true;
    $('#btnSegGenerate').disabled = false;
    $('#btnSegGenerateText').textContent = '生成标签组合';
    btnAll.disabled = false;
    $('#segStream').hidden = true;
    renderSegmentBatch({ failed, elapsed: Math.round((Date.now() - started) / 1000) });
    revealResult('#viewSegment .result');

    const done = Object.keys(S.segBatch?.results || {}).length;
    if (failed) {
      showSegErr(`第 ${done + 1} 类生成失败：${failed}`, () => generateAllSegments(true));
    } else if (done < SEG_TYPES.length) {
      showSegErr(`已取消，已完成 ${done} 类并加入拼装板`, () => generateAllSegments(true));
    }
  }
}

function renderSegmentBatch(meta = {}) {
  const results = S.segBatch?.results || {};
  const done = Object.keys(results).length;
  const totalTags = Object.values(results).reduce((n, d) => n + countTags(d.tags), 0);

  const wrap = $('#segCards');
  wrap.innerHTML = '';
  wrap.hidden = false;
  $('#segEmpty').hidden = true;
  $('#segStream').hidden = true;
  $('#segNote').hidden = true;
  $('#segRefineBar').hidden = true;
  $('#segVersionBar').hidden = true;

  const head = document.createElement('div');
  head.className = 'result-title-row';
  const h3 = document.createElement('h3');
  h3.textContent = '七类标签';
  head.appendChild(h3);

  const badges = document.createElement('div');
  badges.className = 'badges';
  badges.appendChild(badge(`${done} / ${SEG_TYPES.length} 类`, true));
  badges.appendChild(badge(`${totalTags} 个标签`, false));
  if (meta.elapsed) badges.appendChild(badge(`${meta.elapsed} 秒`, false));
  if (meta.failed) badges.appendChild(badge('有失败', false));
  if (S.segEdited) badges.appendChild(badge('已手改', true));
  head.appendChild(badges);
  wrap.appendChild(head);

  const list = document.createElement('div');
  list.className = 'batch-list';
  for (const t of SEG_TYPES) {
    const d = results[t.id];
    const row = document.createElement('div');
    row.className = 'batch-row';
    row.dataset.type = t.id;

    const rh = document.createElement('div');
    rh.className = 'batch-head';
    const label = document.createElement('span');
    label.className = 'batch-type';
    label.textContent = t.label;
    rh.appendChild(label);

    const cnt = document.createElement('span');
    cnt.className = 'dim small';
    cnt.textContent = d ? `${countTags(d.tags)} 个标签` : '未生成';
    rh.appendChild(cnt);

    const grow = document.createElement('span');
    grow.className = 'grow';
    rh.appendChild(grow);

    if (d) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn tiny copy';
      b.textContent = '复制';
      b.addEventListener('click', () => copyText(d.tags, b));
      rh.appendChild(b);
    }
    row.appendChild(rh);

    if (d) {
      const tags = document.createElement('p');
      tags.className = 'batch-tags mono';
      tags.textContent = d.tags;
      row.appendChild(tags);
    } else {
      const miss = document.createElement('p');
      miss.className = 'batch-missing';
      miss.textContent = '这一类还没生成，可以点「补齐剩余」继续。';
      row.appendChild(miss);
    }
    list.appendChild(row);
  }
  wrap.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'batch-actions';
  if (done < SEG_TYPES.length) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn tiny';
    more.textContent = '补齐剩余';
    more.addEventListener('click', () => generateAllSegments(true));
    actions.appendChild(more);
  }
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'btn tiny primary';
  open.textContent = '打开拼装板';
  open.addEventListener('click', openBoard);
  actions.appendChild(open);
  wrap.appendChild(actions);

  S.segData = null;
  S.segText = '';
  S.segBatchMode = true;
  ['#btnSegRegen', '#btnSegCopyAll', '#btnSegSave', '#btnSegAddBoard', '#btnEditSeg', '#btnRestoreSeg']
    .forEach((sel) => { $(sel).disabled = true; });
  updateSegRefineUi();
  updateSegEditUi();
  scheduleDraftSave();
}

/* ============ 拼装板（把多次生成的细分标签拼成一条完整提示词） ============ */

// 固定顺序：不管先加入哪一类，拼出来的 tag 串顺序都稳定
function boardSorted() {
  const order = new Map(SEG_TYPES.map((t, i) => [t.id, i]));
  return [...S.board].sort((a, b) => (order.get(a.type) ?? 99) - (order.get(b.type) ?? 99));
}

function renderBoardCount() {
  const n = S.board.length;
  const badge = $('#boardBtnCount');
  if (badge) badge.textContent = String(n);
  const count = $('#boardCount');
  if (count) count.textContent = n ? `${n} / ${SEG_TYPES.length} 类` : '空';
}

function normalizeBoardItems(items) {
  const seen = new Set();
  const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    const type = SEG_TYPES.some((t) => t.id === it?.type) ? it.type : '';
    const tags = str(it?.tags).trim();
    if (!type || !tags || seen.has(type)) continue;
    seen.add(type);
    out.push({
      type,
      tags,
      title: str(it.title),
      sentence: str(it.sentence),
      at: Number(it.at) || Date.now(),
    });
  }
  return out;
}

function readLocalBoard() {
  try {
    const raw = JSON.parse(localStorage.getItem(BOARD_KEY) || 'null');
    return {
      items: normalizeBoardItems(raw?.items),
      title: str(raw?.title),
    };
  } catch {
    return { items: [], title: '' };
  }
}

let boardSaveTimer = null;

async function persistBoardNow() {
  try {
    await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: S.board, title: S.boardTitle || '' }),
    });
  } catch {
    /* 服务端不可用时继续用 localStorage */
  }
}

function scheduleBoardSave() {
  clearTimeout(boardSaveTimer);
  boardSaveTimer = setTimeout(persistBoardNow, 300);
}

// 关页面/切后台时，把还没到防抖时间的状态用 sendBeacon 补发一次
function flushStateBeacons() {
  if (draftTimer) {
    clearTimeout(draftTimer);
    draftTimer = null;
    saveDraftsNow();
  }  if (historySaveTimer) {
    clearTimeout(historySaveTimer);
    historySaveTimer = null;
    try {
      navigator.sendBeacon('/api/history', new Blob([JSON.stringify({ history: S.history.slice(0, 60) })], { type: 'application/json' }));
    } catch { /* 忽略 */ }
  }
  if (boardSaveTimer) {
    clearTimeout(boardSaveTimer);
    boardSaveTimer = null;
    try {
      navigator.sendBeacon('/api/board', new Blob([JSON.stringify({ board: S.board, title: S.boardTitle || '' })], { type: 'application/json' }));
    } catch { /* 忽略 */ }
  }
}

async function loadBoard() {
  const local = readLocalBoard();
  try {
    const r = await fetch('/api/board');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    const server = normalizeBoardItems(j.board);
    const serverTitle = str(j.title);
    if (server.length === 0 && local.items.length) {
      S.board = local.items;
      S.boardTitle = local.title;
      persistBoardNow();
    } else {
      S.board = server;
      S.boardTitle = serverTitle;
    }
  } catch {
    S.board = local.items;
    S.boardTitle = local.title;
  }
  S.boardLoaded = true;
  renderBoardCount();
  if (!$('#boardDrawer').hidden) renderBoard();
}

function saveBoard() {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify({ title: S.boardTitle || '', items: S.board }));
  } catch {
    /* 存不下就只在本次生效 */
  }
  renderBoardCount();
  scheduleBoardSave();
}

// 按类型顺序拼接，去掉完全相同的标签（大小写不敏感）
function boardCombined() {
  const seen = new Set();
  const out = [];
  for (const it of boardSorted()) {
    for (const piece of String(it.tags || '').split(/[,，]/)) {
      const tag = piece.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out.join(', ');
}

function addToBoard({ type, tags, title, sentence } = {}, opts = {}) {
  const id = SEG_TYPES.some((t) => t.id === type) ? type : '';
  const body = str(tags).trim();
  if (!id) {
    toast('这组标签缺少类型信息，先载入到细分页再加进拼装板', true);
    return false;
  }
  if (!body) {
    toast('这组标签是空的，没法加入拼装板', true);
    return false;
  }

  const entry = {
    type: id,
    tags: body,
    title: str(title),
    sentence: str(sentence),
    at: Date.now(),
  };
  const i = S.board.findIndex((x) => x.type === id);
  const replaced = i >= 0;
  if (replaced) S.board[i] = entry;
  else S.board.push(entry);
  saveBoard();
  if (!$('#boardDrawer').hidden) renderBoard();

  if (!opts.silent) {
    toast(replaced
      ? `已更新拼装板的「${segTypeLabel(id)}」`
      : `已加入拼装板：${segTypeLabel(id)}（${countTags(body)} 个标签）`);
  }
  return true;
}

function removeFromBoard(type) {
  const item = S.board.find((x) => x.type === type);
  if (!item) return;
  S.board = S.board.filter((x) => x.type !== type);
  saveBoard();
  renderBoard();
  toastUndo(`已从拼装板移除「${segTypeLabel(type)}」`, () => {
    S.board.push(item);
    saveBoard();
    renderBoard();
    toast('已恢复到拼装板');
  });
}

function clearBoard() {
  if (!S.board.length) return;
  const backup = S.board.slice();
  S.board = [];
  saveBoard();
  renderBoard();
  toastUndo(`已清空拼装板的 ${backup.length} 类标签`, () => {
    S.board = backup;
    saveBoard();
    renderBoard();
    toast('拼装板已恢复');
  });
}

function gotoSegmentType(type) {
  closeBoard();
  switchView('segment');
  const id = SEG_TYPES.some((t) => t.id === type) ? type : S.segType;
  S.segType = id;
  document.querySelectorAll('#segTypeChips .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.id === id);
  });
  // 拼装板里已有别的类型时，顺手把当时那句话填过去，省得重新打一遍
  const first = boardSorted()[0];
  if (!$('#segSentence').value.trim() && first?.sentence) {
    $('#segSentence').value = first.sentence;
    refreshCounter();
  }
  setTimeout(() => $('#segSentence').focus(), 60);
}

function openBoard() {
  closeLibrary();
  closeDrawer();
  closeThemePop();
  $('#boardMask').hidden = false;
  $('#boardDrawer').hidden = false;
  renderBoard();
  trapFocus($('#boardDrawer'), $('#btnBoardClose'));
}

function closeBoard() {
  $('#boardMask').hidden = true;
  $('#boardDrawer').hidden = true;
  releaseFocusTrap();
}

function boardMarkdown(tags) {
  const list = boardSorted();
  const lines = [];
  lines.push(`> 来源：拼装板（${list.length} 类细分标签）`);
  lines.push(`> 组成：${list.map((x) => segTypeLabel(x.type)).join(' / ')}`);
  const first = list[0];
  if (first?.sentence) lines.push(`> 原始描述：${first.sentence}`);
  const target = $('#targetModel').value.trim();
  if (target && target !== '通用') lines.push(`> 目标模型：${target}`);

  lines.push('', '## 正向提示词', '', tags);
  lines.push('', '## 标签明细', '');
  for (const it of list) lines.push(`- ${segTypeLabel(it.type)}：${it.tags}`);
  return lines.join('\n').trim();
}

function renderBoard() {
  const box = $('#boardList');
  if (!box) return;
  const list = boardSorted();
  const byType = new Map(list.map((x) => [x.type, x]));
  box.innerHTML = '';

  const intro = document.createElement('p');
  intro.className = 'board-intro dim small';
  intro.textContent = list.length
    ? '每个类型保留一组标签；加入同一类型会替换旧的，点「去生成」补齐缺的类型。'
    : '还没有加入任何标签。在细分页生成结果后点「＋ 拼装板」，或从保存库的细分条目点「拼装」。';
  box.appendChild(intro);

  for (const t of SEG_TYPES) {
    const item = byType.get(t.id);
    const row = document.createElement('div');
    row.className = 'board-slot' + (item ? '' : ' empty');
    row.dataset.type = t.id;

    const head = document.createElement('div');
    head.className = 'board-slot-head';

    const label = document.createElement('span');
    label.className = 'board-slot-label';
    label.textContent = t.label;
    head.appendChild(label);

    const meta = document.createElement('span');
    meta.className = 'dim small';
    meta.textContent = item ? `${countTags(item.tags)} 个标签` : '未添加';
    head.appendChild(meta);

    const grow = document.createElement('span');
    grow.className = 'grow';
    head.appendChild(grow);

    if (item) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn tiny ghost board-remove';
      rm.textContent = '移除';
      rm.title = `从拼装板移除「${t.label}」`;
      rm.addEventListener('click', () => removeFromBoard(t.id));
      head.appendChild(rm);
    } else {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'btn tiny ghost';
      go.textContent = '去生成';
      go.addEventListener('click', () => gotoSegmentType(t.id));
      head.appendChild(go);
    }
    row.appendChild(head);

    if (item) {
      const tags = document.createElement('p');
      tags.className = 'board-slot-tags mono';
      tags.textContent = item.tags;
      row.appendChild(tags);
      if (item.title) {
        const from = document.createElement('div');
        from.className = 'board-slot-from dim small';
        from.textContent = `来自：${item.title}`;
        row.appendChild(from);
      }
    } else {
      const hint = document.createElement('p');
      hint.className = 'board-slot-hint dim small';
      hint.textContent = `还没有「${t.label}」标签，生成后会自动补齐成完整提示词。`;
      row.appendChild(hint);
    }
    box.appendChild(row);
  }

  const tags = boardCombined();
  const preview = document.createElement('section');
  preview.className = 'board-preview';
  const previewHead = document.createElement('div');
  previewHead.className = 'board-preview-head';
  const previewTitle = document.createElement('strong');
  previewTitle.textContent = '组合结果';
  const previewCount = document.createElement('span');
  previewCount.className = 'dim small';
  previewCount.textContent = tags ? `${countTags(tags)} 个标签` : '还没有内容';
  previewHead.append(previewTitle, previewCount);
  preview.appendChild(previewHead);

  const previewText = document.createElement('p');
  previewText.className = 'board-preview-text mono';
  previewText.id = 'boardPreviewText';
  previewText.textContent = tags || '把任意一类标签加入拼装板后，这里会显示可直接粘贴的组合结果。';
  preview.appendChild(previewText);
  box.appendChild(preview);

  const titleInput = $('#boardTitle');
  if (titleInput && document.activeElement !== titleInput) titleInput.value = S.boardTitle;
  $('#btnBoardCopy').disabled = !tags;
  $('#btnBoardSave').disabled = !tags;
  renderBoardCount();
}

async function saveBoardToLibrary(btn) {
  const tags = boardCombined();
  if (!tags) {
    toast('拼装板还是空的，先加入至少一类标签', true);
    return;
  }
  const list = boardSorted();
  const first = list[0] || {};
  const title = (S.boardTitle.trim() || first.title || '拼装标签').slice(0, 60);
  await saveToLocal('prompt', title, boardMarkdown(tags), {
    sentence: first.sentence || '',
    style: S.style,
    targetModel: $('#targetModel').value.trim(),
    positive: tags,
    negative: '',
    translation: '',
    params: {},
    keywords: list.map((x) => segTypeLabel(x.type)),
    assembly: true,
    board: list.map((x) => ({ type: x.type, tags: x.tags })),
  }, btn);
}

/* ============ 结果编辑（直接改，不重新请求模型） ============ */

function updatePromptEditUi() {
  const can = !!S.current?.parsed?.positive;
  $('#btnEditPrompt').disabled = !can;
  $('#btnRestorePrompt').disabled = !can || !S.current?.edited;
}

function updateCharEditUi() {
  const can = !!S.charData?.en;
  $('#btnEditChar').disabled = !can;
  $('#btnRestoreChar').disabled = !can || !S.charEdited;
}

function updateSegEditUi() {
  const can = !!S.segData?.tags;
  $('#btnEditSeg').disabled = !can;
  $('#btnRestoreSeg').disabled = !can || !S.segEdited;
}

function editorField(labelText, control, extraClass) {
  const wrap = document.createElement('label');
  wrap.className = 'editor-field' + (extraClass ? ` ${extraClass}` : '');
  const name = document.createElement('span');
  name.textContent = labelText;
  wrap.appendChild(name);
  wrap.appendChild(control);
  return wrap;
}

function editorTextarea(id, value, rows, mono) {
  const ta = document.createElement('textarea');
  ta.id = id;
  ta.rows = rows;
  ta.value = value || '';
  ta.spellcheck = false;
  if (mono) ta.className = 'mono';
  return ta;
}

function editorInput(id, value, placeholder) {
  const inp = document.createElement('input');
  inp.id = id;
  inp.value = value || '';
  inp.autocomplete = 'off';
  if (placeholder) inp.placeholder = placeholder;
  return inp;
}

function openEditor(mode) {
  let title = '';
  let hint = '';
  const box = $('#editorFields');
  box.innerHTML = '';

  if (mode === 'prompt') {
    if (S.busy) return toast('正在生成，稍等一下再编辑', true);
    const p = S.current?.parsed;
    if (!p?.positive) return toast('还没有可以编辑的提示词', true);
    title = '编辑提示词';
    hint = S.current.pinsBaked
      ? '这条内容来自保存库，正文已经包含置顶词，保存后不会再重复拼接。'
      : '编辑的是不含置顶词的原文，保存后会自动重新拼接置顶词。';
    box.appendChild(editorField('正向提示词', editorTextarea('editPositive', p.positive, 6, true), 'mono'));
    box.appendChild(editorField('负向提示词', editorTextarea('editNegative', p.negative, 4, true), 'mono'));
    box.appendChild(editorField('画面解读', editorTextarea('editTranslation', p.translation, 3, false)));
    const grid = document.createElement('div');
    grid.className = 'editor-grid';
    grid.appendChild(editorField('画幅', editorInput('editAspect', p.params?.aspect_ratio, '如 2:3')));
    grid.appendChild(editorField('建议模型', editorInput('editModel', p.params?.suggested_model, '如 SDXL / Flux.1')));
    box.appendChild(grid);
    box.appendChild(editorField('参数建议', editorTextarea('editExtra', p.params?.extra, 2, true), 'mono'));
  } else if (mode === 'character') {
    if (S.charBusy) return toast('正在生成，稍等一下再编辑', true);
    const d = S.charData;
    if (!d?.en) return toast('还没有可以编辑的角色提示词', true);
    title = '编辑角色提示词';
    hint = '英文和中文会一起更新；保存后直接替换当前结果，不会重新请求模型。';
    box.appendChild(editorField('英文提示词', editorTextarea('editCharEn', d.en, 8, true), 'mono'));
    box.appendChild(editorField('中文对照', editorTextarea('editCharZh', d.zh, 6, false)));
    box.appendChild(editorField('画幅', editorInput('editCharAspect', d.aspect, '如 16:9')));
  } else if (mode === 'segment') {
    if (S.segBusy) return toast('正在生成，稍等一下再编辑', true);
    const d = S.segData;
    if (!d?.tags) return toast('还没有可以编辑的标签', true);
    title = '编辑细分标签';
    hint = '标签和中文对照会一起更新；保存后同步当前结果和历史。';
    box.appendChild(editorField('标签组合', editorTextarea('editSegTags', d.tags, 6, true), 'mono'));
    box.appendChild(editorField('中文对照', editorTextarea('editSegTranslation', d.translation, 3, false)));
  } else {
    return;
  }

  S.editorMode = mode;
  $('#editorTitle').textContent = title;
  $('#editorHint').textContent = hint;
  $('#editorErr').hidden = true;
  $('#editor').showModal();
  const first = box.querySelector('textarea, input');
  if (first) setTimeout(() => first.focus(), 40);
}

function closeEditor() {
  S.editorMode = null;
  if ($('#editor').open) $('#editor').close();
}

function saveEditor() {
  const mode = S.editorMode;
  if (!mode) return;
  S.draftsSuppressed = false;
  const val = (sel) => ($(sel)?.value ?? '').trim();

  try {
    if (mode === 'prompt') {
      const cur = S.current;
      if (!cur?.parsed) throw new Error('没有可编辑的提示词');
      const positive = val('#editPositive');
      if (!positive) throw new Error('正向提示词不能为空');
      const next = {
        ...cur.parsed,
        positive,
        negative: val('#editNegative'),
        translation: val('#editTranslation'),
        params: {
          ...(cur.parsed.params || {}),
          aspect_ratio: val('#editAspect'),
          suggested_model: val('#editModel'),
          extra: val('#editExtra'),
        },
      };
      if (!cur.original) cur.original = cloneData(cur.parsed);
      cur.parsed = next;
      cur.edited = JSON.stringify(next) !== JSON.stringify(cur.original);
      updateHistoryEntry(cur);
      renderResult(next, { sentence: cur.sentence, language: cur.language });
    } else if (mode === 'character') {
      const en = val('#editCharEn');
      if (!en) throw new Error('英文提示词不能为空');
      const next = {
        ...S.charData,
        en,
        zh: val('#editCharZh'),
        aspect: val('#editCharAspect'),
      };
      if (!S.charOriginal) S.charOriginal = cloneData(S.charData);
      S.charData = next;
      S.charEdited = JSON.stringify(next) !== JSON.stringify(S.charOriginal);
      renderCharacters(next);
      updateCharacterHistoryEntry();
    } else if (mode === 'segment') {
      const tags = val('#editSegTags');
      if (!tags) throw new Error('标签组合不能为空');
      const next = {
        ...S.segData,
        tags,
        translation: val('#editSegTranslation'),
      };
      if (!S.segOriginal) S.segOriginal = cloneData(S.segData);
      S.segData = next;
      S.segText = tags;
      S.segEdited = JSON.stringify(next) !== JSON.stringify(S.segOriginal);
      updateSegmentHistoryEntry();
      renderSegment(next);
    } else {
      return;
    }

    closeEditor();
    toast('已保存修改');
  } catch (err) {
    const el = $('#editorErr');
    el.textContent = err.message || String(err);
    el.hidden = false;
  }
}

function restorePromptOriginal() {
  const cur = S.current;
  if (!cur?.original) return;
  cur.parsed = cloneData(cur.original);
  if (cur.stack?.length) {
    cur.vIndex = cur.stack.length - 1;
    cur.stack[cur.vIndex] = cloneData(cur.original);
  }
  cur.edited = false;
  updateHistoryEntry(cur);
  renderResult(cur.parsed, { sentence: cur.sentence, language: cur.language });
  toast('已恢复模型原版');
}

function restoreCharOriginal() {
  if (!S.charOriginal) return;
  S.charData = cloneData(S.charOriginal);
  if (S.charStack?.length) {
    S.charVIndex = S.charStack.length - 1;
    S.charStack[S.charVIndex] = cloneData(S.charOriginal);
  }
  S.charEdited = false;
  renderCharacters(S.charData);
  updateCharacterHistoryEntry();
  toast('已恢复模型原版');
}

function restoreSegOriginal() {
  if (!S.segOriginal) return;
  S.segData = cloneData(S.segOriginal);
  if (S.segStack?.length) {
    S.segVIndex = S.segStack.length - 1;
    S.segStack[S.segVIndex] = cloneData(S.segOriginal);
  }
  S.segText = S.segData.tags || '';
  S.segEdited = false;
  updateSegmentHistoryEntry();
  renderSegment(S.segData);
  toast('已恢复模型原版');
}

/* ============ 微调 ============ */
const REFINE_CHIPS = [
  '更暗一点', '更亮一点', '改成竖构图', '改成横构图', '去掉人物',
  '加一场雨', '更写实', '更二次元', '细节更多', '精简一些',
];

function renderRefineChips() {
  const box = $('#refineChips');
  box.innerHTML = '';
  for (const text of REFINE_CHIPS) {
    const label = S.lang === 'en' ? tr(text) : text;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => {
      $('#refineInput').value = label;
      refine(label);
    });
    box.appendChild(b);
  }
}

function updatePromptVersionUi() {
  const cur = S.current;
  const stack = cur?.stack || [];
  const bar = $('#versionBar');
  if (!bar) return;
  const show = stack.length > 1;
  bar.hidden = !show;
  if (!show) {
    $('#versionDiff').hidden = true;
    return;
  }

  const chips = $('#versionChips');
  chips.innerHTML = '';
  stack.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'version-chip' + (i === cur.vIndex ? ' active' : '');
    b.textContent = `v${i + 1}`;
    b.title = i === 0 ? '模型原版' : `第 ${i + 1} 版`;
    b.addEventListener('click', () => selectPromptVersion(i));
    chips.appendChild(b);
  });

  const btn = $('#btnVersionDiff');
  btn.disabled = (Number(cur.vIndex) || 0) <= 0;
  btn.textContent = $('#versionDiff').hidden ? '对比上一版' : '收起对比';
  if (!$('#versionDiff').hidden) renderPromptDiff();
}

function selectPromptVersion(i) {
  const cur = S.current;
  if (!cur?.stack?.[i]) return;
  cur.vIndex = i;
  cur.parsed = cloneData(cur.stack[i]);
  cur.edited = false;
  renderResult(cur.parsed, { sentence: cur.sentence, language: cur.language });
  updateHistoryEntry(cur);
  hideErr();
}

function tokenizeDiff(text) {
  return String(text || '').split(/(\s+|[，,;；])/).filter((x) => x !== '');
}

function diffParts(oldText, newText) {
  const a = tokenizeDiff(oldText);
  const b = tokenizeDiff(newText);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const removed = [];
  const added = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      removed.unshift(a[i - 1]);
      i--;
    } else {
      added.unshift(b[j - 1]);
      j--;
    }
  }
  while (i > 0) removed.unshift(a[--i]);
  while (j > 0) added.unshift(b[--j]);
  return { removed: removed.join('').trim(), added: added.join('').trim() };
}

function appendDiffBlock(container, label, oldText, newText) {
  const diff = diffParts(oldText, newText);
  const title = document.createElement('div');
  title.className = 'diff-empty';
  title.textContent = label;
  container.appendChild(title);
  if (!diff.removed && !diff.added) {
    const same = document.createElement('div');
    same.className = 'diff-empty';
    same.textContent = '内容没有变化';
    container.appendChild(same);
    return;
  }
  if (diff.removed) {
    const line = document.createElement('div');
    const minus = document.createElement('span');
    minus.className = 'diff-del';
    minus.textContent = `− ${diff.removed}`;
    line.appendChild(minus);
    container.appendChild(line);
  }
  if (diff.added) {
    const line = document.createElement('div');
    const plus = document.createElement('span');
    plus.className = 'diff-add';
    plus.textContent = `+ ${diff.added}`;
    line.appendChild(plus);
    container.appendChild(line);
  }
}

function renderPromptDiff() {
  const cur = S.current;
  const box = $('#versionDiff');
  if (!cur?.stack || cur.vIndex <= 0) {
    box.hidden = true;
    return;
  }
  const prev = cur.stack[cur.vIndex - 1];
  const next = cur.stack[cur.vIndex];
  box.innerHTML = '';
  appendDiffBlock(box, `正向 · v${cur.vIndex} → v${cur.vIndex + 1}`, prev.positive, next.positive);
  if (prev.negative !== next.negative) {
    const split = document.createElement('div');
    split.style.height = '6px';
    box.appendChild(split);
    appendDiffBlock(box, '负向', prev.negative, next.negative);
  }
  box.hidden = false;
}

function promptCopyText() {
  const r = S.rendered || {};
  const p = S.current?.parsed || {};
  const mode = $('#copyFormat').value;
  if (mode === 'positive') return r.positive || '';
  if (mode === 'negative') return r.negative || '';
  if (mode === 'plain') return [r.positive, r.negative].filter(Boolean).join('\n\n');
  if (mode === 'json') {
    return JSON.stringify({
      title: p.title || '',
      positive: r.positive || '',
      negative: r.negative || '',
      translation: p.translation || '',
      params: p.params || {},
      keywords: p.keywords || [],
    }, null, 2);
  }
  if (mode === 'mj') {
    const params = p.params || {};
    const extra = String(params.extra || '').trim();
    let text = r.positive || '';
    if (params.aspect_ratio && !/--ar\b/.test(extra) && !/--ar\b/.test(text)) {
      text += ` --ar ${params.aspect_ratio}`;
    }
    if (extra) text += ` ${extra}`;
    if (r.negative && !/--no\b/.test(extra) && !/--no\b/.test(text)) {
      text += ` --no ${r.negative}`;
    }
    return text.trim();
  }
  return `Positive prompt: ${r.positive || ''}\n\nNegative prompt: ${r.negative || ''}`;
}

function updateRefineUi() {
  const stack = S.current?.stack || [];
  const n = Math.max(0, Number(S.current?.vIndex) || 0);
  if (!S.busy) {
    $('#refineStatus').textContent = n > 0 ? `已微调 ${n} 次` : '';
  }
  $('#btnUndoRefine').disabled = n <= 0 || S.busy;
  $('#btnRefine').disabled = S.busy;
  $('#refineInput').disabled = S.busy;
  $('#refineChips').querySelectorAll('button').forEach((b) => { b.disabled = S.busy; });
  updatePromptVersionUi();
}

// 微调只把「没拼置顶词的原始提示词」发给模型，避免置顶词被改写或重复拼接
async function refine(instructionArg) {
  if (S.busy) return;
  S.draftsSuppressed = false;
  const instruction = String(instructionArg ?? $('#refineInput').value).trim();
  if (!instruction) {
    showErr('先写一句要改什么，比如「改成竖构图」');
    $('#refineInput').focus();
    return;
  }
  const cur = S.current;
  if (!cur?.parsed?.positive) {
    showErr('还没有可以微调的提示词，先生成一条');
    return;
  }

  hideErr();
  S.busy = true;
  const btn = $('#btnRefine');
  const oldLabel = btn.textContent;
  btn.textContent = '微调中…';
  $('#refineStatus').textContent = '微调中…';
  updateRefineUi();

  S.abort = new AbortController();
  let acc = '';
  let gotError = null;

  try {
    const res = await fetch('/api/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        previous: {
          positive: cur.parsed.positive,
          negative: cur.parsed.negative,
          translation: cur.parsed.translation,
          params: cur.parsed.params,
        },
        style: cur.style || S.style,
        targetModel: cur.targetModel || $('#targetModel').value.trim(),
        language: cur.language || $('#language').value,
      }),
      signal: S.abort.signal,
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(e.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let evt;
        try {
          evt = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (handleStreamMetaEvent(evt)) continue;
        if (evt.type === 'delta') {
          acc += evt.text;
          $('#refineStatus').textContent = `微调中… ${acc.length} 字`;
        } else if (evt.type === 'retry') {
          $('#refineStatus').textContent = `接口暂时失败，第 ${evt.attempt} 次重试…`;
        } else if (evt.type === 'error') {
          gotError = evt.message;
        }
      }
    }

    if (gotError) throw new Error(gotError);
    if (!acc.trim()) throw new Error('模型没有返回内容，再试一次');

    const parsed = parseResult(acc);
    if (!parsed || !parsed.positive) throw new Error('模型返回的不是标准 JSON，再试一次或换个模型');

    // 从旧版本继续微调时，丢弃它后面的版本，形成一条线性时间线
    if (cur.vIndex < cur.stack.length - 1) cur.stack = cur.stack.slice(0, cur.vIndex + 1);
    cur.stack.push(parsed);
    cur.vIndex = cur.stack.length - 1;
    cur.parsed = parsed;
    cur.original = cloneData(parsed);
    cur.edited = false;
    cur.raw = acc;
    renderResult(parsed, { sentence: cur.sentence, language: cur.language });
    updateHistoryEntry(cur);
    $('#refineInput').value = '';
    revealResult('#viewPrompt .result');
    $('#refineInput').focus();
  } catch (err) {
    if (err.name === 'AbortError') {
      showErr('已取消本次微调');
    } else {
      showErr(err.message || String(err), () => refine(instruction));
    }
  } finally {
    S.busy = false;
    S.abort = null;
    btn.textContent = oldLabel;
    updateRefineUi();
  }
}

function undoRefine() {
  const cur = S.current;
  if (!cur?.stack || cur.vIndex <= 0) return;
  cur.vIndex--;
  cur.parsed = cloneData(cur.stack[cur.vIndex]);
  cur.edited = false;
  renderResult(cur.parsed, { sentence: cur.sentence, language: cur.language });
  updateHistoryEntry(cur);
  hideErr();
}

// 微调不新增历史条目，而是就地更新同一次生成的那条，避免历史被刷屏
function updateHistoryEntry(cur) {
  if (!cur.historyAt) return;
  const h = S.history.find((x) => x.at === cur.historyAt);
  if (!h) return;
  h.title = cur.parsed.title;
  h.positive = cur.parsed.positive;
  h.negative = cur.parsed.negative;
  h.translation = cur.parsed.translation;
  h.params = cur.parsed.params;
  h.keywords = cur.parsed.keywords;
  saveHistory();
}

/* ============ UI 辅助 ============ */
// 失败时给一个「重试」，省得用户重新点一遍
function renderErr(el, msg, retry) {
  el.textContent = msg;
  if (typeof retry === 'function') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn tiny ghost err-retry';
    b.textContent = '重试';
    b.addEventListener('click', () => {
      el.hidden = true;
      retry();
    });
    el.appendChild(b);
  }
  el.hidden = false;
}

function showErr(msg, retry) {
  renderErr($('#err'), msg, retry);
}

function hideErr() {
  $('#err').hidden = true;
}

function refreshCounter() {
  const n = $('#sentence').value.length;
  $('#counter').textContent = `${n} 字`;
  const cn = $('#charSentence').value.length;
  $('#charCounter').textContent = `${cn} 字`;
  const sn = $('#segSentence').value.length;
  $('#segCounter').textContent = `${sn} 字`;
}

let focusTrap = null;

function focusableIn(el) {
  return [...el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((x) => x.offsetParent !== null);
}

function trapFocus(el, first) {
  if (focusTrap) releaseFocusTrap(false);
  focusTrap = { el, prev: document.activeElement };
  el.addEventListener('keydown', onTrapKey);
  const target = first || focusableIn(el)[0] || el;
  setTimeout(() => target.focus(), 30);
}

function onTrapKey(e) {
  if (!focusTrap || e.key !== 'Tab') return;
  const list = focusableIn(focusTrap.el);
  if (!list.length) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function releaseFocusTrap(restore = true) {
  if (!focusTrap) return;
  focusTrap.el.removeEventListener('keydown', onTrapKey);
  const prev = focusTrap.prev;
  focusTrap = null;
  if (restore && prev && prev.isConnected) prev.focus();
}

function openShortcuts() {
  $('#shortcuts').showModal();
}

function openDrawer() {
  closeLibrary();
  closeBoard();
  $('#drawerMask').hidden = false;
  $('#drawer').hidden = false;
  trapFocus($('#drawer'), $('#histFilter'));
  const f = $('#histFilter');
  if (f) {
    f.value = '';
    f.focus();
  }
  renderHistory();
}

function closeDrawer() {
  $('#drawerMask').hidden = true;
  $('#drawer').hidden = true;
  releaseFocusTrap();
}

/* ============ 事件绑定 ============ */
function bind() {
  window.addEventListener('pagehide', flushStateBeacons);

  // 三个模式的输入变化都进本机草稿
  ['#sentence', '#extra', '#styleSelect', '#targetModel', '#language', '#detail', '#promptAspect', '#promptShot',
    '#charSentence', '#charExtra', '#charCount', '#charAspect',
    '#segSentence', '#segExtra'].forEach((sel) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('input', () => scheduleDraftSave(true));
    el.addEventListener('change', () => scheduleDraftSave(true));
  });
  $('#segTypeChips').addEventListener('click', () => scheduleDraftSave(true));
  $('#sentence').addEventListener('input', refreshCounter);
  $('#sentence').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      generate();
    }
  });

  $('#btnGenerate').addEventListener('click', generate);
  $('#btnCancel').addEventListener('click', () => {
    if (S.abort) S.abort.abort();
  });
  $('#btnRegen').addEventListener('click', () => {
    if (S.current?.imported) {
      generate({ imported: true, prompt: S.current.importPrompt, extra: S.current.importExtra });
      return;
    }
    if (S.current?.sentence) {
      $('#sentence').value = S.current.sentence;
      refreshCounter();
    }
    generate();
  });

  $('#btnRandom').addEventListener('click', () => requestIdeas(IDEA_UI.prompt));
  $('#btnVariants').addEventListener('click', openVariants);
  $('#btnVariantCancel').addEventListener('click', () => {
    if (S.variantAbort) S.variantAbort.abort();
  });
  $('#btnVariantClose').addEventListener('click', closeVariantsDialog);
  $('#btnVariantAgain').addEventListener('click', () => runVariantBatch());
  $('#variantDialog').addEventListener('cancel', (e) => {
    e.preventDefault();
    closeVariantsDialog();
  });
  $('#btnTemplates').addEventListener('click', openTemplateDialog);
  $('#btnTemplateClose').addEventListener('click', closeTemplateDialog);
  $('#btnTemplateSave').addEventListener('click', saveCurrentTemplate);
  $('#templateName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCurrentTemplate();
    }
  });
  $('#btnImportPrompt').addEventListener('click', openImportDialog);
  $('#btnImportCancel').addEventListener('click', () => $('#importDialog').close());
  $('#btnImportRun').addEventListener('click', runImport);
  $('#importForm').addEventListener('submit', (e) => {
    e.preventDefault();
    runImport();
  });
  $('#btnIdeaClose').addEventListener('click', () => {
    $('#ideaBar').hidden = true;
  });

  /* ---------- 视图切换 ---------- */
  document.querySelectorAll('#mainTabs .tab').forEach((t) => {
    t.addEventListener('click', () => switchView(t.dataset.view));
  });

  /* ---------- 角色设定 ---------- */
  $('#charSentence').addEventListener('input', refreshCounter);
  $('#charSentence').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      generateCharacters();
    }
  });

  $('#btnCharGenerate').addEventListener('click', generateCharacters);
  $('#btnCharCancel').addEventListener('click', () => {
    if (S.charAbort) S.charAbort.abort();
  });
  $('#btnCharRegen').addEventListener('click', () => {
    if (S.charSentence) {
      $('#charSentence').value = S.charSentence;
      refreshCounter();
    }
    generateCharacters();
  });
  $('#btnCharClear').addEventListener('click', () => {
    $('#charSentence').value = '';
    $('#charExtra').value = '';
    refreshCounter();
    hideCharErr();
    $('#charSentence').focus();
  });
  $('#btnCharIdea').addEventListener('click', () => requestIdeas(IDEA_UI.character));
  $('#btnCharIdeaClose').addEventListener('click', () => {
    $('#charIdeaBar').hidden = true;
  });
  $('#btnCharCopyAll').addEventListener('click', (e) => {
    copyText(S.charText || '', e.currentTarget);
  });

  /* 角色提示词的微调 */
  $('#btnCharRefine').addEventListener('click', () => refineCharacter());
  $('#charRefineInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      refineCharacter();
    }
  });
  $('#btnCharUndoRefine').addEventListener('click', undoCharRefine);

  /* ---------- 细分提示词 ---------- */
  $('#segSentence').addEventListener('input', refreshCounter);
  $('#segSentence').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      generateSegment();
    }
  });
  $('#btnSegGenerate').addEventListener('click', generateSegment);
  $('#btnSegAll').addEventListener('click', () => generateAllSegments(false));
  $('#btnSegCancel').addEventListener('click', () => {
    if (S.segAbort) S.segAbort.abort();
  });
  $('#btnSegRegen').addEventListener('click', () => {
    if (S.segSentence) {
      $('#segSentence').value = S.segSentence;
      refreshCounter();
    }
    generateSegment();
  });
  $('#btnSegClear').addEventListener('click', () => {
    $('#segSentence').value = '';
    $('#segExtra').value = '';
    refreshCounter();
    hideSegErr();
    $('#segSentence').focus();
  });
  $('#btnSegCopyAll').addEventListener('click', (e) => {
    copyText(S.segText || '', e.currentTarget);
  });
  $('#btnSegSave').addEventListener('click', () => {
    const d = S.segData || {};
    const meta = S.segMeta || {};
    saveToLocal('segment', d.title || meta.sentence || S.segSentence || '细分提示词', segmentMarkdown(), {
      sentence: meta.sentence || S.segSentence || '',
      segmentType: meta.type || S.segType,
      targetModel: meta.targetModel || '',
      style: meta.style || S.style,
      tags: d.tags || '',
      translation: d.translation || '',
      keywords: d.keywords || [],
    }, $('#btnSegSave'));
  });

  /* 拼装板 */
  $('#btnSegAddBoard').addEventListener('click', () => {
    if (!S.segData) return;
    addToBoard({
      type: S.segMeta?.type || S.segType,
      tags: S.segData.tags,
      title: S.segData.title,
      sentence: S.segMeta?.sentence || S.segSentence,
    });
  });
  $('#btnBoard').addEventListener('click', openBoard);
  $('#btnBoardClose').addEventListener('click', closeBoard);
  $('#boardMask').addEventListener('click', closeBoard);
  $('#btnBoardClear').addEventListener('click', clearBoard);
  $('#btnBoardCopy').addEventListener('click', (e) => {
    copyText(boardCombined(), e.currentTarget);
  });
  $('#btnBoardSave').addEventListener('click', (e) => {
    saveBoardToLibrary(e.currentTarget);
  });
  $('#boardTitle').addEventListener('input', () => {
    S.boardTitle = $('#boardTitle').value;
    saveBoard();
  });

  /* 细分标签的微调 */
  $('#btnSegRefine').addEventListener('click', () => refineSegment());
  $('#segRefineInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      refineSegment();
    }
  });
  $('#btnSegUndoRefine').addEventListener('click', undoSegmentRefine);

  $('#btnClear').addEventListener('click', () => {
    $('#sentence').value = '';
    $('#extra').value = '';
    refreshCounter();
    hideErr();
    $('#sentence').focus();
  });

  /* 复制 */
  $('#cards').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const kind = btn.dataset.copy;
    const r = S.rendered || {};
    const text = kind === 'positive' ? r.positive : kind === 'negative' ? r.negative : r.extra;
    copyText(text, btn);
  });

  $('#btnCopyAll').addEventListener('click', (e) => {
    copyText(promptCopyText(), e.currentTarget);
  });
  $('#btnVersionDiff').addEventListener('click', () => {
    const box = $('#versionDiff');
    box.hidden = !box.hidden;
    if (box.hidden) box.innerHTML = '';
    updatePromptVersionUi();
  });

  $('#btnSavePrompt').addEventListener('click', () => {
    const cur = S.current;
    const p = cur?.parsed || {};
    const r = S.rendered || {};
    saveToLocal('prompt', p.title || cur?.sentence || '提示词', promptMarkdown(), {
      sentence: cur?.sentence || '',
      style: cur?.style || S.style,
      targetModel: cur?.targetModel || '',
      positive: r.positive || '',
      negative: r.negative || '',
      translation: p.translation || '',
      params: p.params || {},
      keywords: p.keywords || [],
    }, $('#btnSavePrompt'));
  });

  $('#btnCharSave').addEventListener('click', () => {
    const d = S.charData || {};
    saveToLocal('character', d.title || S.charSentence || '角色设定', characterMarkdown(), {
      sentence: S.charSentence || '',
      prompt_en: d.en || '',
      prompt_zh: d.zh || '',
      aspect_ratio: d.aspect || '',
    }, $('#btnCharSave'));
  });

  /* 结果编辑 */
  $('#btnEditPrompt').addEventListener('click', () => openEditor('prompt'));
  $('#btnRestorePrompt').addEventListener('click', restorePromptOriginal);
  $('#btnEditChar').addEventListener('click', () => openEditor('character'));
  $('#btnRestoreChar').addEventListener('click', restoreCharOriginal);
  $('#btnEditSeg').addEventListener('click', () => openEditor('segment'));
  $('#btnRestoreSeg').addEventListener('click', restoreSegOriginal);
  $('#btnEditorCancel').addEventListener('click', closeEditor);
  $('#btnEditorSave').addEventListener('click', saveEditor);
  $('#editorForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveEditor();
  });
  $('#editor').addEventListener('close', () => {
    S.editorMode = null;
  });

  /* 保存库 */
  $('#btnLibrary').addEventListener('click', openLibrary);
  $('#btnLibClose').addEventListener('click', closeLibrary);
  $('#libMask').addEventListener('click', closeLibrary);
  const reloadLibraryDebounced = debounce(() => loadLibrary(), 280);
  $('#libFilter').addEventListener('input', reloadLibraryDebounced);
  $('#libSort').addEventListener('change', () => setLibrarySort($('#libSort').value));
  $('#libSelectAll').addEventListener('change', () => selectAllLibrary($('#libSelectAll').checked));
  $('#btnLibDeleteSelected').addEventListener('click', deleteSelectedSaved);
  $('#btnLibBackup').addEventListener('click', downloadBackup);
  $('#btnLibImport').addEventListener('click', () => $('#backupFile').click());
  $('#backupFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    await handleBackupFile(file);
  });
  $('#btnBackupCancel').addEventListener('click', () => $('#backupDialog').close());
  $('#btnBackupApply').addEventListener('click', (e) => confirmBackupImport(e.currentTarget));
  $('#btnLibTrash').addEventListener('click', openTrash);
  $('#btnTrashClose').addEventListener('click', () => $('#trashDialog').close());
  $('#btnTrashEmpty').addEventListener('click', emptyTrash);
  $('#btnLibFolder').addEventListener('click', openSavedDir);

  $('#btnOpenSaved').addEventListener('click', openSavedDir);

  /* 置顶词 */
  const persistPins = debounce(() => {
    saveConfigPatch({
      pinnedPositive: $('#pinPositive').value,
      pinnedNegative: $('#pinNegative').value,
    }).catch(() => { });
  }, 700);

  $('#pinPositive').addEventListener('input', persistPins);
  $('#pinNegative').addEventListener('input', persistPins);

  $('#pinEnabled').addEventListener('change', () => {
    const on = $('#pinEnabled').checked;
    $('#pinbox').classList.toggle('off', !on);
    saveConfigPatch({ pinEnabled: on }).catch(() => { });
    // 置顶词开关变了，如果已有结果就重渲染
    if (S.current?.parsed) renderResult(S.current.parsed, { sentence: S.current.sentence });
  });


  /* 历史抽屉 */
  $('#btnHistory').addEventListener('click', openDrawer);
  $('#histFilter').addEventListener('input', renderHistory);
  document.querySelectorAll('#histFilterChips .hist-filter-btn').forEach((b) => {
    b.addEventListener('click', () => setHistoryFilter(b.dataset.kind));
  });
  $('#btnCloseDrawer').addEventListener('click', closeDrawer);
  $('#drawerMask').addEventListener('click', closeDrawer);
  $('#btnClearHistory').addEventListener('click', () => {
    if (!S.history.length) return;
    if (!confirm('清空全部历史记录？')) return;
    const backup = S.history.slice();
    S.history = [];
    saveHistory();
    toastUndo(`已清空 ${backup.length} 条历史记录`, () => {
      S.history = backup;
      saveHistory();
      toast('历史记录已恢复');
    });
  });

  document.addEventListener('keydown', (e) => {
    // ? 打开快捷键帮助（输入框里不拦截）
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey
      && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')
      && !$('#shortcuts').open) {
      e.preventDefault();
      openShortcuts();
      return;
    }
    // Ctrl/⌘ + 1 / 2 / 3 切页签
    const views = { 1: 'prompt', 2: 'character', 3: 'segment' };
    if ((e.ctrlKey || e.metaKey) && views[e.key]) {
      e.preventDefault();
      switchView(views[e.key]);
      return;
    }
    // Ctrl/⌘ + S：保存当前视图的结果
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (S.view === 'character') {
        if (S.charData) $('#btnCharSave').click();
        else toast('还没有角色提示词可以保存', true);
      } else if (S.view === 'segment') {
        if (S.segData) $('#btnSegSave').click();
        else toast('还没有标签可以保存', true);
      } else if (S.current) {
        $('#btnSavePrompt').click();
      } else {
        toast('还没有结果可以保存', true);
      }
      return;
    }
    if (e.key !== 'Escape') return;
    // 先关最上层的浮层；什么都没开时才用来取消正在跑的请求
    if (!$('#themePop').hidden) {
      closeThemePop();
    } else if (!$('#libDrawer').hidden) {
      closeLibrary();
    } else if (!$('#boardDrawer').hidden) {
      closeBoard();
    } else if (!$('#drawer').hidden) {
      closeDrawer();
    } else {
      if (S.busy && S.abort) S.abort.abort();
      if (S.charBusy && S.charAbort) S.charAbort.abort();
      if (S.segBusy && S.segAbort) S.segAbort.abort();
    }
  });

  // 附加要求里敲回车 = 直接生成，不用再去点按钮
  $('#extra').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generate();
    }
  });
  $('#charExtra').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateCharacters();
    }
  });
  $('#segExtra').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateSegment();
    }
  });

  /* 皮肤 */
  $('#btnTheme').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleThemePop();
  });
  document.addEventListener('click', (e) => {
    if ($('#themePop').hidden) return;
    if (!$('.theme-wrap').contains(e.target)) closeThemePop();
  });
  /* 设置弹窗 */
  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnLang').addEventListener('click', toggleLanguage);
  $('#btnClearDrafts').addEventListener('click', clearDrafts);
  $('#btnProfileActivate').addEventListener('click', activateProfile);
  $('#btnProfileSave').addEventListener('click', saveProfile);
  $('#btnProfileDelete').addEventListener('click', deleteProfile);
  $('#btnDiagnostics').addEventListener('click', downloadDiagnostics);
  $('#btnShortcuts').addEventListener('click', openShortcuts);
  $('#btnShortcutsClose').addEventListener('click', () => $('#shortcuts').close());
  $('#btnCancelSettings').addEventListener('click', () => $('#settings').close());
  $('#btnSaveSettings').addEventListener('click', saveSettings);
  $('#btnTest').addEventListener('click', testConnection);
  $('#btnShowKey').addEventListener('click', () => {
    const inp = $('#cfgKey');
    const showing = inp.type === 'text';
    inp.type = showing ? 'password' : 'text';
    $('#btnShowKey').textContent = showing ? '显示' : '隐藏';
  });
  $('#cfgTemp').addEventListener('input', () => {
    $('#tempVal').textContent = Number($('#cfgTemp').value).toFixed(2);
  });
  $('#cfgTopP').addEventListener('input', () => {
    $('#topPVal').textContent = Number($('#cfgTopP').value).toFixed(2);
  });
  $('#cfgApiPinned').addEventListener('input', updateApiPinnedCount);
  $('#btnLoadModels').addEventListener('click', loadModels);
  initCombos();

  /* 微调 */
  $('#btnRefine').addEventListener('click', () => refine());
  $('#refineInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      refine();
    }
  });
  $('#btnUndoRefine').addEventListener('click', undoRefine);
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/* ============ 设置弹窗逻辑 ============ */
function renderProfileOptions(cfg) {
  const sel = $('#profileSelect');
  if (!sel) return;
  sel.innerHTML = '';
  for (const p of cfg.profiles || []) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.name} · ${p.model || '未设置模型'}${p.hasKey ? '' : ' · 无 Key'}`;
    o.selected = p.active;
    sel.appendChild(o);
  }
  $('#profileHint').textContent = cfg.keyEncrypted
    ? '当前 Key 已用系统凭据加密保存；切换档案不会回显 Key。'
    : '当前 Key 以明文保存在本机 config.json（源码/非 Electron 环境）；打包桌面版会尝试系统凭据加密。';
}

function populateSettings(cfg) {
  $('#cfgBase').value = cfg.baseURL || '';
  $('#cfgModel').value = cfg.model || '';
  $('#cfgKey').value = '';
  $('#cfgKey').placeholder = cfg.hasKey ? `已保存（${cfg.keyMask}），留空表示不修改` : 'sk-...';
  $('#cfgTemp').value = cfg.temperature ?? 0.85;
  $('#tempVal').textContent = Number(cfg.temperature ?? 0.85).toFixed(2);
  $('#cfgMaxTokens').value = cfg.maxTokens ?? 0;
  $('#cfgTimeout').value = cfg.timeoutSec ?? 120;
  $('#cfgTopP').value = cfg.topP ?? 1;
  $('#topPVal').textContent = Number(cfg.topP ?? 1).toFixed(2);
  $('#cfgStream').checked = cfg.stream !== false;
  $('#cfgJsonMode').checked = !!cfg.jsonMode;
  $('#cfgApiPinned').value = cfg.apiPinnedPrompt || '';
  $('#cfgApiPinnedIdea').checked = !!cfg.apiPinnedForIdea;
  updateApiPinnedCount();
  $('#keyHint').textContent = cfg.hasKey
    ? `已保存：${cfg.keyMask}（${cfg.keyEncrypted ? '系统凭据加密' : '明文'}；留空即保持原样）`
    : '还没有保存 Key';
  renderProfileOptions(cfg);
  $('#cfgErr').hidden = true;
  S.combos.model?.close();
  $('#modelHint').textContent = '可以直接手填，也可以点右侧箭头从列表里选';
}

async function openSettings() {
  const cfg = S.config || (await (await fetch('/api/config')).json());
  populateSettings(cfg);
  $('#profileName').value = '';
  $('#settings').showModal();
}

async function saveSettings() {
  const btn = $('#btnSaveSettings');
  btn.disabled = true;
  try {
    const patch = {
      baseURL: $('#cfgBase').value.trim(),
      model: $('#cfgModel').value.trim(),
      temperature: Number($('#cfgTemp').value),
      maxTokens: Number($('#cfgMaxTokens').value) || 0,
      timeoutSec: Number($('#cfgTimeout').value) || 120,
      topP: Number($('#cfgTopP').value),
      stream: $('#cfgStream').checked,
      jsonMode: $('#cfgJsonMode').checked,
      apiPinnedPrompt: $('#cfgApiPinned').value,
      apiPinnedForIdea: $('#cfgApiPinnedIdea').checked,
    };
    const key = $('#cfgKey').value.trim();
    if (key) patch.apiKey = key;
    await saveConfigPatch(patch);
    $('#settings').close();
  } catch (err) {
    const el = $('#cfgErr');
    el.textContent = err.message;
    el.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

async function activateProfile() {
  const id = $('#profileSelect').value;
  if (!id) return;
  try {
    const r = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', id }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    S.config = j.config;
    applyConfig(j.config, { skipPinInputs: true });
    populateSettings(j.config);
    toast('已切换服务商档案');
  } catch (err) {
    toast(`切换失败：${err.message}`, true);
  }
}

async function saveProfile() {
  const name = $('#profileName').value.trim();
  if (!name) {
    $('#profileName').focus();
    return toast('先给档案起个名字', true);
  }
  try {
    const r = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        activate: true,
        profile: {
          name,
          baseURL: $('#cfgBase').value.trim(),
          model: $('#cfgModel').value.trim(),
          apiKey: $('#cfgKey').value.trim(),
        },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    S.config = j.config;
    applyConfig(j.config, { skipPinInputs: true });
    populateSettings(j.config);
    $('#profileName').value = '';
    toast(`已保存档案：${name}`);
  } catch (err) {
    toast(`保存档案失败：${err.message}`, true);
  }
}

async function deleteProfile() {
  const id = $('#profileSelect').value;
  if (!id) return;
  if (!confirm('删除当前选中的服务商档案？')) return;
  try {
    const r = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    S.config = j.config;
    applyConfig(j.config, { skipPinInputs: true });
    populateSettings(j.config);
    toast('已删除服务商档案');
  } catch (err) {
    toast(`删除失败：${err.message}`, true);
  }
}

async function downloadDiagnostics() {
  try {
    const r = await fetch('/api/diagnostics');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    const blob = new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'promptforge-diagnostics.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出诊断信息（不含 Key）');
  } catch (err) {
    toast(`导出诊断失败：${err.message}`, true);
  }
}

async function testConnection() {
  const btn = $('#btnTest');
  const el = $('#cfgErr');
  btn.disabled = true;
  btn.textContent = '测试中…';
  el.hidden = true;
  try {
    const r = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseURL: $('#cfgBase').value.trim(),
        apiKey: $('#cfgKey').value.trim(),
        model: $('#cfgModel').value.trim(),
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || '连接失败');
    el.hidden = false;
    el.style.color = 'var(--ok)';
    el.style.background = 'rgba(var(--ok-rgb), .12)';
    el.style.borderColor = 'rgba(var(--ok-rgb), .35)';
    el.textContent = `连接成功 · ${j.latencyMs} ms · ${j.model}${j.reply ? ` · ${j.reply}` : ''}`;
  } catch (err) {
    el.hidden = false;
    el.style.color = '';
    el.style.background = '';
    el.style.borderColor = '';
    el.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '测试连接';
  }
}

async function loadModels() {
  const btn = $('#btnLoadModels');
  const el = $('#cfgErr');
  btn.disabled = true;
  btn.textContent = '拉取中…';
  try {
    const base = encodeURIComponent($('#cfgBase').value.trim());
    const key = encodeURIComponent($('#cfgKey').value.trim());
    const r = await fetch(`/api/models?base=${base}&key=${key}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || '拉取失败');
    S.modelOptions = j.models;
    S.modelFetched = true;
    el.hidden = false;
    el.style.color = 'var(--ok)';
    el.style.background = 'rgba(var(--ok-rgb), .12)';
    el.style.borderColor = 'rgba(var(--ok-rgb), .35)';
    el.textContent = j.models.length
      ? `已拉取 ${j.models.length} 个模型，下拉框已展开，选一个即可`
      : '接口没有返回任何模型，请手动填写模型名';
    // 拉完直接把下拉框弹出来，省得用户找不到
    S.combos.model.open();
  } catch (err) {
    el.hidden = false;
    el.style.color = '';
    el.style.background = '';
    el.style.borderColor = '';
    el.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '拉取列表';
  }
}

/* ============ 通用下拉框 ============ */
// 输入框 + 可选列表。
// 展开时永远渲染完整列表，不按输入框现有值过滤 ——
// 否则配置里已经填了模型名的情况下，一点开就是「匹配 0 个」，看起来像没有下拉框。
function createCombo(opts) {
  const inp = $(opts.input);
  const lst = $(opts.list);
  const wrap = inp.closest('.combo');
  let index = -1;

  const isOpen = () => !lst.hidden;

  function render(filter) {
    const cur = inp.value.trim();
    const q = String(filter ?? '').trim().toLowerCase();
    const all = opts.source();
    const items = q ? all.filter((m) => m.toLowerCase().includes(q)) : all;

    lst.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'combo-group';
    const baseLabel = opts.labelAll ? opts.labelAll(all.length) : `共 ${all.length} 个`;
    head.textContent = q ? `${baseLabel} · 匹配 ${items.length} 个` : baseLabel;
    lst.appendChild(head);

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'combo-empty';
      empty.textContent = opts.emptyText || '没有匹配的项，直接手填就行';
      lst.appendChild(empty);
      return;
    }

    for (const m of items) {
      const el = document.createElement('div');
      el.className = 'combo-item' + (m === cur ? ' is-current' : '');
      el.dataset.value = m;
      el.setAttribute('role', 'option');
      el.title = m;
      const label = document.createElement('span');
      label.textContent = m;
      el.appendChild(label);
      if (m === cur) {
        const badge = document.createElement('span');
        badge.className = 'cur';
        badge.textContent = '当前';
        el.appendChild(badge);
      }
      // 用 mousedown 而不是 click，避免输入框 blur 先一步把列表关掉
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pick(m);
      });
      lst.appendChild(el);
    }
  }

  function pick(m) {
    inp.value = m;
    close();
    if (opts.onPick) opts.onPick(m);
  }

  function open() {
    render('');
    lst.hidden = false;
    wrap.classList.add('open');
    inp.setAttribute('aria-expanded', 'true');
    if (opts.onOpen) opts.onOpen();

    // 键盘光标定位到当前值所在项
    const els = [...lst.querySelectorAll('.combo-item')];
    const cur = inp.value.trim();
    index = els.findIndex((el) => el.dataset.value === cur);
    els.forEach((el, i) => el.classList.toggle('active', i === index));
    if (index >= 0) els[index].scrollIntoView({ block: 'nearest' });
  }

  function close() {
    lst.hidden = true;
    wrap.classList.remove('open');
    inp.setAttribute('aria-expanded', 'false');
    index = -1;
  }

  inp.addEventListener('click', () => {
    if (isOpen()) render('');
    else open();
  });

  inp.addEventListener('input', () => {
    index = -1;
    render(inp.value);
    lst.hidden = false;
    wrap.classList.add('open');
    inp.setAttribute('aria-expanded', 'true');
  });

  inp.addEventListener('keydown', (e) => {
    const openNow = isOpen();
    const els = () => [...lst.querySelectorAll('.combo-item')];

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!openNow) return open();
      const items = els();
      if (!items.length) return;
      index = e.key === 'ArrowDown'
        ? Math.min(index + 1, items.length - 1)
        : Math.max(index - 1, 0);
      items.forEach((el, i) => el.classList.toggle('active', i === index));
      items[index].scrollIntoView({ block: 'nearest' });
      return;
    }

    if (e.key === 'Enter' && openNow) {
      const items = els();
      const target = items[index] || items[0];
      if (target) {
        e.preventDefault();
        pick(target.dataset.value);
      }
      return;
    }

    if (e.key === 'Escape' && openNow) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });

  if (opts.toggle) {
    $(opts.toggle).addEventListener('click', () => {
      if (isOpen()) close();
      else {
        inp.focus();
        open();
      }
    });
  }

  return { open, close, isOpen, render, input: inp, list: lst, wrap };
}

function modelSource() {
  return S.modelFetched && S.modelOptions.length ? S.modelOptions : MODEL_PRESETS;
}

function initCombos() {
  S.combos.model = createCombo({
    input: '#cfgModel',
    list: '#modelList',
    toggle: '#btnToggleModels',
    source: modelSource,
    labelAll: (n) => (S.modelFetched ? `已拉取 ${n} 个模型` : `常用模型 ${n} 个`),
    emptyText: '没有匹配的模型，直接手填就行',
    onOpen: () => {
      $('#modelHint').textContent = S.modelFetched
        ? `已拉取 ${S.modelOptions.length} 个，可直接输入过滤`
        : '下面是常用模型，点「拉取列表」获取你账号里的全部模型';
    },
    onPick: (m) => {
      $('#modelHint').textContent = `已选择：${m}`;
    },
  });

  S.combos.target = createCombo({
    input: '#targetModel',
    list: '#targetModelList',
    toggle: '#btnToggleTarget',
    source: () => TARGET_PRESETS,
    labelAll: (n) => `常用目标 ${n} 个`,
    emptyText: '没有匹配项，直接手填就行（如 SDXL / Flux.1）',
  });

  // 点别处收起
  document.addEventListener('mousedown', (e) => {
    for (const c of Object.values(S.combos)) {
      if (c.isOpen() && !c.wrap.contains(e.target)) c.close();
    }
  });

  // 弹窗里按 Esc 只收下拉框，不关整个弹窗
  $('#settings').addEventListener('cancel', (e) => {
    if (Object.values(S.combos).some((c) => c.isOpen())) {
      e.preventDefault();
      for (const c of Object.values(S.combos)) c.close();
    }
  });
}
