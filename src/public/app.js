/* Prompt Forge 前端逻辑 */
const $ = (s) => document.querySelector(s);

const STYLES = [
  { id: 'sd', label: 'SD / SDXL / Flux', desc: '结构化英文短语' },
  { id: 'anime', label: 'NovelAI 动漫', desc: 'Danbooru 标签流' },
  { id: 'mj', label: 'Midjourney', desc: '自然语言 + 参数' },
  { id: 'photo', label: '写实摄影', desc: '镜头 / 光线 / 胶片' },
  { id: 'natural', label: '自然语言', desc: 'Flux / DALL·E' },
];

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
  lib: [],
  libDir: '',
  libEditing: null,
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
  renderStyleChips();
  renderRefineChips();
  renderCharRefineChips();
  renderThemeSwatches();
  bind();
  loadHistory();
  loadConfig();
  refreshCounter();
  refreshLibraryCount();
});

function renderStyleChips() {
  const box = $('#styleChips');
  box.innerHTML = '';
  for (const st of STYLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (st.id === S.style ? ' active' : '');
    b.dataset.id = st.id;
    b.innerHTML = `<b>${st.label}</b><small>${st.desc}</small>`;
    b.addEventListener('click', () => {
      S.style = st.id;
      box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.id === st.id));
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
  // 太长的时候变个色，提醒它每次请求都要发一遍
  el.textContent = `· ${n} 字，每次请求都会发送`;
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
  $('#modelBadge').textContent = cfg.model ? cfg.model : '未设置模型';
  $('#charModelBadge').textContent = cfg.model ? cfg.model : '未设置模型';
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

/* ============ 生成 ============ */
async function generate() {
  if (S.busy) return;
  const sentence = $('#sentence').value.trim();
  if (!sentence) {
    showErr('先写一句话描述你想要的画面');
    $('#sentence').focus();
    return;
  }
  hideErr();

  S.busy = true;
  const btn = $('#btnGenerate');
  btn.disabled = true;
  $('#btnGenerateText').textContent = '生成中…';
  $('#empty').hidden = true;
  $('#cards').hidden = true;
  $('#stream').hidden = false;
  $('#streamText').textContent = '';
  $('#streamLabel').textContent = '正在生成…';
  $('#btnRegen').disabled = true;

  S.abort = new AbortController();
  const started = Date.now();
  let acc = '';
  let gotError = null;

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
          $('#streamLabel').textContent = `正在生成… ${acc.length} 字`;
        } else if (evt.type === 'error') {
          gotError = evt.message;
        }
      }
    }

    if (gotError) throw new Error(gotError);
    if (!acc.trim()) throw new Error('模型没有返回内容，试试换个模型或稍后重试');

    const parsed = parseResult(acc);
    if (!parsed) {
      // 解析失败就原样展示，别让用户白等
      renderRaw(acc);
      showErr('模型返回的不是标准 JSON，已按原文展示。可以点「重新生成」再试一次。');
    } else {
      renderResult(parsed, { sentence, raw: acc });
    }

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
    };
    if (parsed && parsed.positive) {
      pushHistory(S.current);
      S.current.historyAt = S.current.at;
    }
    updateRefineUi();
    $('#stream').hidden = true;
    revealResult('#viewPrompt .result');
  } catch (err) {
    $('#stream').hidden = true;
    if (err.name === 'AbortError') {
      showErr('已取消本次生成');
    } else {
      showErr(err.message || String(err), generate);
      if (!S.current) $('#empty').hidden = false;
    }
  } finally {
    S.busy = false;
    S.abort = null;
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

/* 置顶词拼接：原样放在最前面 */
function pinOn() {
  return $('#pinEnabled').checked;
}

// 只有标签流风格才做去重；自然语言风格直接拼，避免把句子切坏
function isTagStyle(style) {
  return style === 'sd' || style === 'anime';
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
  badges.appendChild(badge($('#language').value === 'zh' ? '中文' : '英文', false));

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

function toast(msg, isErr) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
  el.hidden = false;
  void el.offsetWidth;   // 强制 reflow，让过渡生效
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 200);
  }, 2800);
}

function promptMarkdown() {
  const cur = S.current;
  const p = cur?.parsed || {};
  const r = S.rendered || {};
  const lines = [];

  if (cur?.sentence) lines.push(`> 原始描述：${cur.sentence}`);
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

function renderLibrary() {
  const box = $('#libList');
  const q = $('#libFilter').value.trim().toLowerCase();
  const all = S.lib || [];
  // 搜索范围包含类型和文件名，这样输入「角色」「提示词」也能筛出来
  const haystack = (it) => `${it.title} ${it.summary} ${it.kind} ${it.name}`.toLowerCase();
  const list = q ? all.filter((it) => haystack(it).includes(q)) : all;

  $('#libCount').textContent = all.length ? `${all.length} 条` : '';
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

  for (const it of list) box.appendChild(libraryItemEl(it));
}

function libraryItemEl(it) {
  const editing = S.libEditing === it.name;
  const wrap = document.createElement('div');
  wrap.className = 'lib-item' + (editing ? ' editing' : '');

  const top = document.createElement('div');
  top.className = 'lib-top';

  const kind = document.createElement('span');
  kind.className = 'lib-kind' + (it.kind === '角色设定' ? ' character' : '');
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
    mkBtn('复制', async (b) => {
      const loaded = await fetchSavedMeta(it);
      if (!loaded) return;
      const text = loaded.meta?.kind === 'character'
        ? [loaded.meta.prompt_en, loaded.meta.prompt_zh].filter(Boolean).join('\n\n')
        : [loaded.meta?.positive, loaded.meta?.negative].filter(Boolean).join('\n\n');
      copyText(text || it.summary, b);
    });
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
    language: 'en',
    parsed,
    at: Date.now(),
    stack: [parsed],
    historyAt: null,
    pinsBaked: true,   // 保存时置顶词已经拼进去了，别再拼一次
  };
  if (S.style !== (meta.style || 'sd')) {
    S.style = meta.style || 'sd';
    document.querySelectorAll('#styleChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.id === S.style));
  }
  if (meta.sentence) {
    $('#sentence').value = meta.sentence;
    refreshCounter();
  }

  switchView('prompt');
  $('#empty').hidden = true;
  renderResult(parsed, { sentence: meta.sentence });
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

async function deleteSavedEntry(it) {
  if (!confirm(`删除「${it.title}」？\n对应的文件会被真的删掉，无法恢复。`)) return;
  try {
    const r = await fetch('/api/saved/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: it.name }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    toast('已删除');
    await loadLibrary();
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
    sentence: item.sentence,
    style: item.style,
    positive: item.parsed.positive,
    negative: item.parsed.negative,
    title: item.parsed.title,
    translation: item.parsed.translation,
    params: item.parsed.params,
    keywords: item.parsed.keywords,
    targetModel: item.targetModel,
    at: item.at,
  });
  S.history = S.history.slice(0, 60);
  saveHistory();
}

function renderHistory() {
  $('#historyCount').textContent = S.history.length;
  const box = $('#historyList');
  const q = ($('#histFilter')?.value || '').trim().toLowerCase();
  const all = S.history || [];
  const list = q
    ? all.filter((h) => `${h.title || ''} ${h.sentence || ''} ${h.positive || ''}`.toLowerCase().includes(q))
    : all;

  box.innerHTML = '';

  if (!all.length) {
    box.innerHTML = '<p class="dim small" style="text-align:center;padding:30px 0">还没有记录</p>';
    return;
  }
  if (!list.length) {
    box.innerHTML = '<p class="dim small" style="text-align:center;padding:30px 0">没有匹配的记录</p>';
    return;
  }

  for (const h of list) {
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
    prompt.textContent = h.positive || '';
    d.appendChild(prompt);

    d.addEventListener('click', () => restoreHistoryEntry(h));
    box.appendChild(d);
  }
}

function deleteHistoryEntry(at) {
  S.history = S.history.filter((h) => h.at !== at);
  saveHistory();
  toast('已从历史中删除');
}

function restoreHistoryEntry(h) {
  const parsed = {
    title: h.title, positive: h.positive, negative: h.negative,
    translation: h.translation, params: h.params || {}, keywords: h.keywords || [],
  };
  S.current = {
    sentence: h.sentence,
    style: h.style || 'sd',
    targetModel: h.targetModel || '',
    language: $('#language').value,
    parsed,
    at: h.at,
    stack: [parsed],
    historyAt: h.at,
  };
  S.style = h.style || 'sd';
  document.querySelectorAll('#styleChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.id === S.style));
  switchView('prompt');
  $('#empty').hidden = true;
  renderResult(parsed, { sentence: h.sentence });
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
  document.querySelectorAll('#mainTabs .tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.view === view);
  });

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
  head.appendChild(badges);
  wrap.appendChild(head);

  wrap.appendChild(promptCard('英文提示词（可直接出图）', d.en, true));
  wrap.appendChild(promptCard('中文对照', d.zh, false));

  S.charData = d;
  S.charText = [d.en, d.zh].filter(Boolean).join('\n\n');
  $('#charRefineBar').hidden = false;
  updateCharRefineUi();
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
    renderCharacters(parsed);
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
  renderCharacters(S.charStack[S.charStack.length - 1]);
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
  $('#charStreamLabel').textContent = '正在生成…';
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
          $('#charStreamLabel').textContent = `正在生成… ${acc.length} 字`;
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
    renderCharacters(parsed);
    S.charSentence = sentence;
    revealResult('#viewCharacter .result');
    $('#btnCharSave').disabled = false;
    $('#btnCharCopyAll').disabled = false;
    $('#btnCharRegen').disabled = false;
  } catch (err) {
    $('#charStream').hidden = true;
    $('#charRefineBar').hidden = true;
    if (err.name === 'AbortError') {
      showCharErr('已取消本次生成');
    } else {
      showCharErr(err.message || String(err), generateCharacters);
      if (!S.charData) $('#charEmpty').hidden = false;
    }
  } finally {
    S.charBusy = false;
    S.charAbort = null;
    btn.disabled = false;
    $('#btnCharGenerateText').textContent = '生成角色提示词';
    updateCharRefineUi();
  }
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
    cur.raw = acc;
    renderResult(parsed, { sentence: cur.sentence });
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
  renderResult(cur.parsed, { sentence: cur.sentence });
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
}

function openDrawer() {
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
  $('#btnRegen').addEventListener('click', () => {
    if (S.current?.sentence) {
      $('#sentence').value = S.current.sentence;
      refreshCounter();
    }
    generate();
  });

  $('#btnRandom').addEventListener('click', () => requestIdeas(IDEA_UI.prompt));
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
  $('#btnCloseDrawer').addEventListener('click', closeDrawer);
  $('#drawerMask').addEventListener('click', closeDrawer);
  $('#btnClearHistory').addEventListener('click', () => {
    if (!confirm('清空全部历史记录？')) return;
    S.history = [];
    saveHistory();
  });

  document.addEventListener('keydown', (e) => {
    // Ctrl/⌘ + 1 / 2 切页签
    if ((e.ctrlKey || e.metaKey) && (e.key === '1' || e.key === '2')) {
      e.preventDefault();
      switchView(e.key === '1' ? 'prompt' : 'character');
      return;
    }
    // Ctrl/⌘ + S：保存当前视图的结果
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (S.view === 'character') {
        if (S.charData) $('#btnCharSave').click();
        else toast('还没有角色提示词可以保存', true);
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
    } else if (!$('#drawer').hidden) {
      closeDrawer();
    } else {
      if (S.busy && S.abort) S.abort.abort();
      if (S.charBusy && S.charAbort) S.charAbort.abort();
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
