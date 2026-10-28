/* Prompt Forge 前端逻辑 */
const $ = (s) => document.querySelector(s);

const STYLES = [
  { id: 'sd', label: 'SD / SDXL / Flux', desc: '结构化英文短语' },
  { id: 'anime', label: 'NovelAI 动漫', desc: 'Danbooru 标签流' },
  { id: 'mj', label: 'Midjourney', desc: '自然语言 + 参数' },
  { id: 'photo', label: '写实摄影', desc: '镜头 / 光线 / 胶片' },
  { id: 'natural', label: '自然语言', desc: 'Flux / DALL·E' },
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
  style: 'sd',
  busy: false,
  config: null,
  current: null,       // { sentence, style, targetModel, language, detail, extra, result, raw }
  history: [],
  histFilter: 'all',
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
  segBatch: null,
  segBatchMode: false,
  editorMode: null,
  serverStale: false,
  lib: [],
  libDir: '',
  libEditing: null,
  board: [],           // [{ type, tags, title, sentence, at }]
  boardTitle: '',
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

// 主页「目标模型」的可选值：只是提示，随便填
const TARGET_PRESETS = [
  'SDXL',
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
  renderStyleOptions();
  renderRefineChips();
  renderCharRefineChips();
  renderSegTypeChips();
  renderSegRefineChips();
  renderThemeSwatches();
  loadBoard();
  bind();
  loadHistory();
  loadConfig();
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
    o.textContent = `${st.label} — ${st.desc}`;
    sel.appendChild(o);
  }
  sel.value = S.style;
  sel.addEventListener('change', () => {
    S.style = sel.value;
  });
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
    b.innerHTML = `<b>${t.label}</b><small>${t.desc}</small>`;
    b.addEventListener('click', () => {
      S.segType = t.id;
      box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.id === t.id));
    });
    box.appendChild(b);
  }
}

function segTypeLabel(id) {
  return (SEG_TYPES.find((t) => t.id === id) || SEG_TYPES[0]).label;
}

function renderSegRefineChips() {
  const box = $('#segRefineChips');
  if (!box) return;
  box.innerHTML = '';
  for (const text of SEG_REFINE_CHIPS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => {
      $('#segRefineInput').value = text;
      refineSegment(text);
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
    name.textContent = t.name;
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
  toast(`已切换皮肤：${t.name}`);
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
  // 旧进程没有 features.segment；先记下来，进细分页时直接提示重启
  S.serverStale = !(cfg.features && cfg.features.segment);
  if (S.serverStale && S.view === 'segment') showSegErr(STALE_SERVER_MSG);
  setStatus(cfg.hasKey, cfg.hasKey ? (cfg.model || '已配置') : '未配置 API Key');
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

function showImportErr(msg) {
  const el = $('#importErr');
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

/* ============ 生成 ============ */
async function generate(opts = {}) {
  if (S.busy) return;
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
        }
        : {
          sentence,
          style: S.style,
          targetModel: $('#targetModel').value.trim(),
          language: $('#language').value,
          detail: $('#detail').value,
          extra: $('#extra').value.trim(),
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
    if (r.ok) $('#libBtnCount').textContent = String(j.count ?? 0);
  } catch {
    /* 计数失败不影响使用 */
  }
}

async function openLibrary() {
  closeDrawer();
  closeBoard();
  $('#libMask').hidden = false;
  $('#libDrawer').hidden = false;
  $('#libFilter').value = '';
  S.libEditing = null;
  await loadLibrary();
  $('#libFilter').focus();
}

function closeLibrary() {
  S.libEditing = null;
  $('#libMask').hidden = true;
  $('#libDrawer').hidden = true;
}

async function loadLibrary() {
  const box = $('#libList');
  box.innerHTML = '<p class="dim small" style="text-align:center;padding:24px 0">读取中…</p>';
  try {
    const r = await fetch('/api/saved');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    S.lib = Array.isArray(j.items) ? j.items : [];
    S.libDir = j.dir || '';
    $('#libBtnCount').textContent = String(j.count ?? S.lib.length);
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

function renderLibrary() {
  const box = $('#libList');
  const q = $('#libFilter').value.trim().toLowerCase();
  const all = S.lib || [];
  // 搜索范围包含类型和文件名，这样输入「角色」「提示词」也能筛出来
  const haystack = (it) => `${it.title} ${it.summary} ${it.kind} ${it.name}`.toLowerCase();
  const list = q ? all.filter((it) => haystack(it).includes(q)) : all;

  $('#libCount').textContent = all.length ? (q ? `${list.length} / ${all.length} 条` : `${all.length} 条`) : '';
  box.innerHTML = '';

  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'dim small';
    p.style.cssText = 'text-align:center;padding:26px 10px;line-height:1.8';
    p.textContent = all.length
      ? '没有匹配的内容'
      : '还没有保存过内容。生成结果后点右上角「💾 保存」，就会出现在这里。';
    box.appendChild(p);
    return;
  }

  // 三个大分类固定顺序；未知类型（以后新增的）排在最后，不丢内容
  const groups = new Map([['提示词', []], ['角色设定', []], ['细分提示词', []]]);
  for (const it of list) {
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
  const wrap = document.createElement('div');
  wrap.className = 'lib-item' + (editing ? ' editing' : '');

  const top = document.createElement('div');
  top.className = 'lib-top';

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
    title.textContent = it.title;
  }
  top.appendChild(title);

  const time = document.createElement('span');
  time.className = 'lib-time';
  time.textContent = fmtTime(it.mtime);
  top.appendChild(time);

  wrap.appendChild(top);

  const summary = document.createElement('div');
  summary.className = 'lib-summary';
  summary.textContent = it.summary || '（无摘要）';
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

function loadHistory() {
  try {
    S.history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    S.history = [];
  }
  renderHistory();
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(S.history.slice(0, 60)));
  } catch { /* 存不下就算了 */ }
  renderHistory();
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
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => {
      $('#charRefineInput').value = text;
      refineCharacter(text);
    });
    box.appendChild(b);
  }
}

function updateCharRefineUi() {
  const n = Math.max(0, (S.charStack || []).length - 1);
  if (!S.charBusy) {
    $('#charRefineStatus').textContent = n > 0 ? `已微调 ${n} 次` : '';
  }
  $('#btnCharUndoRefine').disabled = n <= 0 || S.charBusy;
  $('#btnCharRefine').disabled = S.charBusy;
  $('#charRefineInput').disabled = S.charBusy;
  $('#charRefineChips').querySelectorAll('button').forEach((b) => { b.disabled = S.charBusy; });
}

async function refineCharacter(instructionArg) {
  if (S.charBusy) return;
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

    S.charStack.push(parsed);
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
  if (!S.charStack || S.charStack.length <= 1) return;
  S.charStack.pop();
  const d = S.charStack[S.charStack.length - 1];
  S.charData = d;
  S.charOriginal = cloneData(d);
  S.charEdited = false;
  renderCharacters(d);
  updateCharacterHistoryEntry();
  hideCharErr();
}

async function generateCharacters() {
  if (S.charBusy) return;
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

function updateSegRefineUi() {
  const n = Math.max(0, (S.segStack || []).length - 1);
  if (!S.segBusy) {
    $('#segRefineStatus').textContent = n > 0 ? `已微调 ${n} 次` : '';
  }
  $('#btnSegUndoRefine').disabled = n <= 0 || S.segBusy;
  $('#btnSegRefine').disabled = S.segBusy;
  $('#segRefineInput').disabled = S.segBusy;
  $('#segRefineChips').querySelectorAll('button').forEach((b) => { b.disabled = S.segBusy; });
}

async function refineSegment(instructionArg) {
  if (S.segBusy) return;
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

    S.segStack.push(parsed);
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
  if (stack.length <= 1) return;
  stack.pop();
  const d = stack[stack.length - 1];
  S.segData = d;
  S.segOriginal = cloneData(d);
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

function loadBoard() {
  try {
    const raw = JSON.parse(localStorage.getItem(BOARD_KEY) || 'null');
    const items = Array.isArray(raw?.items) ? raw.items : [];
    const seen = new Set();
    S.board = [];
    for (const it of items) {
      const type = SEG_TYPES.some((t) => t.id === it?.type) ? it.type : '';
      const tags = str(it?.tags).trim();
      if (!type || !tags || seen.has(type)) continue;   // 坏数据直接跳过，别让它拖垮界面
      seen.add(type);
      S.board.push({
        type,
        tags,
        title: str(it.title),
        sentence: str(it.sentence),
        at: Number(it.at) || Date.now(),
      });
    }
    S.boardTitle = str(raw?.title);
  } catch {
    S.board = [];
    S.boardTitle = '';
  }
  renderBoardCount();
}

function saveBoard() {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify({ title: S.boardTitle || '', items: S.board }));
  } catch {
    /* 存不下就只在本次生效 */
  }
  renderBoardCount();
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
  setTimeout(() => $('#btnBoardClose').focus(), 40);
}

function closeBoard() {
  $('#boardMask').hidden = true;
  $('#boardDrawer').hidden = true;
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
  cur.edited = false;
  updateHistoryEntry(cur);
  renderResult(cur.parsed, { sentence: cur.sentence, language: cur.language });
  toast('已恢复模型原版');
}

function restoreCharOriginal() {
  if (!S.charOriginal) return;
  S.charData = cloneData(S.charOriginal);
  S.charEdited = false;
  renderCharacters(S.charData);
  updateCharacterHistoryEntry();
  toast('已恢复模型原版');
}

function restoreSegOriginal() {
  if (!S.segOriginal) return;
  S.segData = cloneData(S.segOriginal);
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
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => {
      $('#refineInput').value = text;
      refine(text);
    });
    box.appendChild(b);
  }
}

function updateRefineUi() {
  const stack = S.current?.stack || [];
  const n = Math.max(0, stack.length - 1);
  if (!S.busy) {
    $('#refineStatus').textContent = n > 0 ? `已微调 ${n} 次` : '';
  }
  $('#btnUndoRefine').disabled = n <= 0 || S.busy;
  $('#btnRefine').disabled = S.busy;
  $('#refineInput').disabled = S.busy;
  $('#refineChips').querySelectorAll('button').forEach((b) => { b.disabled = S.busy; });
}

// 微调只把「没拼置顶词的原始提示词」发给模型，避免置顶词被改写或重复拼接
async function refine(instructionArg) {
  if (S.busy) return;
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

    cur.stack.push(parsed);
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
  if (!cur?.stack || cur.stack.length <= 1) return;
  cur.stack.pop();
  cur.parsed = cur.stack[cur.stack.length - 1];
  cur.original = cloneData(cur.parsed);
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

function openDrawer() {
  closeLibrary();
  closeBoard();
  $('#drawerMask').hidden = false;
  $('#drawer').hidden = false;
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
}

/* ============ 事件绑定 ============ */
function bind() {
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
    const r = S.rendered || {};
    const text = `Positive prompt: ${r.positive || ''}\n\nNegative prompt: ${r.negative || ''}`;
    copyText(text, e.currentTarget);
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
  $('#libFilter').addEventListener('input', renderLibrary);
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
async function openSettings() {
  const cfg = S.config || (await (await fetch('/api/config')).json());
  $('#cfgBase').value = cfg.baseURL || '';
  $('#cfgModel').value = cfg.model || '';
  $('#cfgKey').value = '';
  $('#cfgKey').placeholder = cfg.hasKey ? `已保存（${cfg.keyMask}），留空表示不修改` : 'sk-...';
  $('#cfgTemp').value = cfg.temperature ?? 0.85;
  $('#tempVal').textContent = Number(cfg.temperature ?? 0.85).toFixed(2);
  $('#cfgApiPinned').value = cfg.apiPinnedPrompt || '';
  $('#cfgApiPinnedIdea').checked = !!cfg.apiPinnedForIdea;
  updateApiPinnedCount();
  $('#keyHint').textContent = cfg.hasKey
    ? `已保存：${cfg.keyMask}（出于安全不会回显到输入框，留空即保持原样）`
    : '还没有保存 Key';
  $('#cfgErr').hidden = true;
  S.combos.model?.close();
  $('#modelHint').textContent = '可以直接手填，也可以点右侧箭头从列表里选';
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

async function testConnection() {
  const btn = $('#btnTest');
  const el = $('#cfgErr');
  btn.disabled = true;
  btn.textContent = '测试中…';
  el.hidden = true;
  try {
    const base = encodeURIComponent($('#cfgBase').value.trim());
    const key = encodeURIComponent($('#cfgKey').value.trim());
    const r = await fetch(`/api/models?base=${base}&key=${key}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || '连接失败');
    el.hidden = false;
    el.style.color = 'var(--ok)';
    el.style.background = 'rgba(var(--ok-rgb), .12)';
    el.style.borderColor = 'rgba(var(--ok-rgb), .35)';
    el.textContent = `连接成功，可用模型 ${j.models.length} 个`;
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
