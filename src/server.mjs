// Prompt Forge —— 本地服务：静态页面 + OpenAI 兼容接口代理（SSE 流式转发）
import http from 'node:http';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import {
  buildMessages,
  buildRefineMessages,
  buildIdeaMessages,
  buildCharacterMessages,
  buildCharacterRefineMessages,
} from './styles.mjs';

// 打包成 exe（Node SEA）后，资源和配置都跟着 exe 走；
// 开发时还是用脚本所在目录。
const sea = typeof process.getBuiltinModule === 'function'
  ? process.getBuiltinModule('node:sea')
  : null;
const IS_SEA = !!(sea && typeof sea.isSea === 'function' && sea.isSea());

const ROOT = process.env.PF_ROOT
  ? path.resolve(process.env.PF_ROOT)
  : (IS_SEA ? path.dirname(process.execPath) : path.dirname(path.resolve(process.argv[1] || '.')));

// exe 里没有 public 目录，静态文件从 SEA 内嵌资源取
const PUBLIC_DIR = path.join(ROOT, 'public');
// 允许用环境变量指定配置路径，方便测试时用临时文件，
// 避免开发/验证过程碰到用户真正的 config.json。
// 数据放哪：优先程序所在目录（绿色版），写不进去就退到 %APPDATA%\PromptForge
function pickDataDir() {
  const candidates = [ROOT];
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'PromptForge'));
  candidates.push(path.join(os.tmpdir(), 'PromptForge'));

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, '.write-test');
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      return dir;
    } catch {
      /* 试下一个 */
    }
  }
  return os.tmpdir();
}

const DATA_DIR = pickDataDir();
const CONFIG_PATH = process.env.PF_CONFIG
  ? path.resolve(process.env.PF_CONFIG)
  : path.join(DATA_DIR, 'config.json');
const CONFIG_BAK = `${CONFIG_PATH}.bak`;
const CONFIG_TMP = `${CONFIG_PATH}.tmp`;
// 保存到本地的目录（同样支持用环境变量改，方便测试时隔离）
const SAVED_DIR = process.env.PF_SAVED
  ? path.resolve(process.env.PF_SAVED)
  : path.join(DATA_DIR, 'saved');
// 删除先进回收站，给用户一个反悔的机会；过期或超过上限再真删
const TRASH_DIR = path.join(SAVED_DIR, '.trash');
const TRASH_RETENTION_DAYS = 7;
const TRASH_MAX_FILES = 100;
const HOST = '127.0.0.1';
const BASE_PORT = Number(process.env.PORT || process.argv[2] || 43125);

const DEFAULT_CONFIG = {
  baseURL: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.85,
  pinnedPositive: '',
  pinnedNegative: '',
  pinEnabled: true,
  // 会真的发给模型的置顶提示词（拼在系统提示词最前面）
  apiPinnedPrompt: '',
  // 灵感请求只要一句中文，默认不再附带整段置顶规范，省 token
  apiPinnedForIdea: false,
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// ---------- 配置 ----------
async function readConfigFile(p) {
  const raw = await fsp.readFile(p, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('配置内容不是对象');
  return { ...DEFAULT_CONFIG, ...parsed };
}

async function loadConfig() {
  // 正常情况读 config.json；文件被误删或写坏时自动从 .bak 恢复
  try {
    return await readConfigFile(CONFIG_PATH);
  } catch {
    /* 主文件不可用，试备份 */
  }

  try {
    const recovered = await readConfigFile(CONFIG_BAK);
    try {
      await fsp.writeFile(CONFIG_PATH, JSON.stringify(recovered, null, 2), 'utf8');
      console.log('  ! config.json 读取失败，已从 config.json.bak 恢复');
    } catch {
      /* 恢复不回去也不影响本次使用 */
    }
    return recovered;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function saveConfig(patch) {
  const cur = await loadConfig();
  const next = { ...cur, ...patch };

  // 先把现有配置备份一份，误改/误删还能退回去
  try {
    await fsp.copyFile(CONFIG_PATH, CONFIG_BAK);
  } catch {
    /* 首次保存还没有旧文件 */
  }

  // 先写临时文件再改名，避免写到一半断电/崩溃留下半个 JSON
  await fsp.writeFile(CONFIG_TMP, JSON.stringify(next, null, 2), 'utf8');
  await fsp.rename(CONFIG_TMP, CONFIG_PATH);
  return next;
}

function publicConfig(cfg) {
  const key = String(cfg.apiKey || '');
  return {
    baseURL: cfg.baseURL,
    model: cfg.model,
    temperature: cfg.temperature,
    hasKey: key.length > 0,
    keyMask: key ? key.slice(0, 4) + '…' + key.slice(-4) : '',
    pinnedPositive: cfg.pinnedPositive,
    pinnedNegative: cfg.pinnedNegative,
    pinEnabled: cfg.pinEnabled,
    apiPinnedPrompt: cfg.apiPinnedPrompt,
    apiPinnedForIdea: !!cfg.apiPinnedForIdea,
  };
}

// 允许用户填 https://api.openai.com 或 https://api.deepseek.com/v1 等
function normalizeBaseURL(input) {
  let s = String(input || '').trim().replace(/\s+/g, '');
  if (!s) return 'https://api.deepseek.com/v1';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  s = s.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
  try {
    const u = new URL(s);
    if (u.pathname === '' || u.pathname === '/') s += '/v1';
  } catch {
    return 'https://api.deepseek.com/v1';
  }
  return s;
}

// ---------- 工具 ----------
function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function extractError(text) {
  try {
    const j = JSON.parse(text);
    const m = j?.error?.message || j?.message || j?.error;
    if (typeof m === 'string') return m;
    if (m) return JSON.stringify(m).slice(0, 300);
  } catch {
    /* 非 JSON */
  }
  return String(text || '').slice(0, 300);
}

// ---------- 路由 ----------
// 读取请求体 + 校验凭证，返回调用上游需要的全部信息
async function resolveUpstream(req, res) {
  const cfg = await loadConfig();

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    json(res, 400, { error: '请求格式错误' });
    return null;
  }

  const apiKey = String(body.apiKey || cfg.apiKey || '').trim();
  if (!apiKey) {
    json(res, 400, { error: '还没有配置 API Key，点右上角「设置」填入后保存' });
    return null;
  }

  const model = String(body.model || cfg.model || '').trim();
  if (!model) {
    json(res, 400, { error: '还没有配置模型名称，点右上角「设置」填入' });
    return null;
  }

  return {
    body,
    apiKey,
    model,
    baseURL: normalizeBaseURL(body.baseURL || cfg.baseURL),
    temperature: Number(body.temperature ?? cfg.temperature),
    apiPinned: String(cfg.apiPinnedPrompt || ''),
    apiPinnedForIdea: !!cfg.apiPinnedForIdea,
  };
}

// 把上游流式响应转发给浏览器；生成和微调共用这一段
async function proxyChatStream(req, res, { messages, baseURL, apiKey, model, temperature, maxTokens }) {
  const ac = new AbortController();
  // 注意：不能用 req.on('close')，请求体读完后它就会触发，会把上游流误杀。
  // 只有响应还没正常结束就 close，才是客户端真的断开了。
  res.on('close', () => {
    if (!res.writableEnded) ac.abort();
  });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (obj) => {
    if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    const upstream = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: Number.isFinite(temperature) ? temperature : 0.85,
        stream: true,
        max_tokens: Number.isFinite(Number(maxTokens)) ? Number(maxTokens) : 2200,
      }),
      signal: ac.signal,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      const hint =
        upstream.status === 401 ? '（API Key 无效或已过期）'
          : upstream.status === 404 ? '（BaseURL 或模型名不对）'
            : upstream.status === 429 ? '（请求太频繁或余额不足）'
              : '';
      throw new Error(`接口返回 ${upstream.status}${hint}：${extractError(text) || '无内容'}`);
    }

    const ctype = String(upstream.headers.get('content-type') || '');

    // 有些不支持流式的兼容接口会直接返回整包 JSON，这里兜底
    if (!ctype.includes('text/event-stream')) {
      const text = await upstream.text();
      let content = '';
      try {
        const j = JSON.parse(text);
        content = j?.choices?.[0]?.message?.content ?? j?.choices?.[0]?.text ?? '';
      } catch {
        content = text;
      }
      if (content) send({ type: 'delta', text: content });
      send({ type: 'done' });
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload);
          const choice = chunk?.choices?.[0];
          const delta = choice?.delta?.content;
          if (typeof delta === 'string' && delta) send({ type: 'delta', text: delta });
        } catch {
          /* 单条脏数据忽略 */
        }
      }
    }

    send({ type: 'done' });
    res.end();
  } catch (err) {
    if (ac.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }
    const msg = err?.message?.includes('fetch failed')
      ? `无法连接到 ${baseURL}，请检查 BaseURL 和网络：${err.cause?.message || ''}`
      : err?.message || String(err);
    send({ type: 'error', message: msg });
    res.end();
  }
}

async function handleGenerate(req, res) {
  const ctx = await resolveUpstream(req, res);
  if (!ctx) return;

  const sentence = String(ctx.body.sentence || '').trim();
  if (!sentence) return json(res, 400, { error: '请先输入一句话描述' });

  const messages = buildMessages({
    sentence,
    style: ctx.body.style,
    targetModel: ctx.body.targetModel,
    language: ctx.body.language,
    detail: ctx.body.detail,
    extra: ctx.body.extra,
    apiPinned: ctx.apiPinned,
  });

  return proxyChatStream(req, res, { ...ctx, messages });
}

// 微调：拿已有提示词 + 一句话修改要求，产出改好的完整提示词
async function handleRefine(req, res) {
  const ctx = await resolveUpstream(req, res);
  if (!ctx) return;

  const instruction = String(ctx.body.instruction || '').trim();
  if (!instruction) return json(res, 400, { error: '请先写一句要改什么' });

  const previous = ctx.body.previous && typeof ctx.body.previous === 'object' ? ctx.body.previous : {};
  const base = String(previous.positive || '').trim();
  if (!base) return json(res, 400, { error: '没有可以微调的原提示词' });

  const messages = buildRefineMessages({
    previous: {
      positive: base,
      negative: String(previous.negative || ''),
      translation: String(previous.translation || ''),
      params: previous.params && typeof previous.params === 'object' ? previous.params : {},
    },
    instruction,
    style: ctx.body.style,
    targetModel: ctx.body.targetModel,
    language: ctx.body.language,
    apiPinned: ctx.apiPinned,
  });

  return proxyChatStream(req, res, { ...ctx, messages });
}

// 把模型返回的内容尽量解析成句子数组，兼容 JSON 数组和逐行两种输出
function parseIdeas(content) {
  let t = String(content || '').trim();
  if (!t) return [];
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  const a = t.indexOf('[');
  const b = t.lastIndexOf(']');
  if (a >= 0 && b > a) {
    try {
      const arr = JSON.parse(t.slice(a, b + 1));
      if (Array.isArray(arr)) {
        const out = arr
          .map((x) => (typeof x === 'string' ? x : x && (x.idea || x.text || x.sentence || x.title) || ''))
          .map((s) => String(s).trim())
          .filter(Boolean);
        if (out.length) return out.slice(0, 8);
      }
    } catch {
      /* 落到按行解析 */
    }
  }

  return t
    .split('\n')
    .map((line) => line
      .replace(/^\s*(?:[-*•·]|\d+[.、)）])\s*/, '')
      .replace(/^["'「『]/, '')
      .replace(/["'」』]\s*$/, '')
      .trim())
    .filter((line) => line.length >= 6 && !/^```/.test(line))
    .slice(0, 8);
}

// 灵感：让模型现编几条中文起始句（非流式，只要一小段文本）
async function handleIdea(req, res) {
  const ctx = await resolveUpstream(req, res);
  if (!ctx) return;

  // 灵感只是用来起个中文句子，默认不注入置顶规范；想要的话在设置里打开
  const messages = buildIdeaMessages({
    avoid: ctx.body.avoid,
    apiPinned: ctx.apiPinnedForIdea ? ctx.apiPinned : '',
  });

  try {
    const upstream = await fetch(`${ctx.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.apiKey}`,
      },
      body: JSON.stringify({
        model: ctx.model,
        messages,
        temperature: 1.0,
        max_tokens: 600,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return json(res, 502, { error: `接口返回 ${upstream.status}：${extractError(text) || '无内容'}` });
    }

    const data = await upstream.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
    const ideas = parseIdeas(content);
    if (!ideas.length) return json(res, 502, { error: '模型没给出可用的句子' });
    return json(res, 200, { ideas });
  } catch (err) {
    const msg = err?.message?.includes('fetch failed') || err?.name === 'TimeoutError'
      ? `连不上 ${ctx.baseURL} 或响应超时`
      : err?.message || String(err);
    return json(res, 502, { error: `生成灵感失败：${msg}` });
  }
}

// 角色设定表：只描述角色/服装/场景/动作/镜头，不出正负提示词
async function handleCharacters(req, res) {
  const ctx = await resolveUpstream(req, res);
  if (!ctx) return;

  const sentence = String(ctx.body.sentence || '').trim();
  if (!sentence) return json(res, 400, { error: '请先输入一句话描述' });

  const messages = buildCharacterMessages({
    sentence,
    extra: ctx.body.extra,
    count: ctx.body.count,
    aspect: ctx.body.aspect,
    apiPinned: ctx.apiPinned,
  });

  return proxyChatStream(req, res, { ...ctx, messages, maxTokens: 2600 });
}

// 角色提示词的微调：英文与中文必须同步改
async function handleCharacterRefine(req, res) {
  const ctx = await resolveUpstream(req, res);
  if (!ctx) return;

  const instruction = String(ctx.body.instruction || '').trim();
  if (!instruction) return json(res, 400, { error: '请先写一句要改什么' });

  const prev = ctx.body.previous && typeof ctx.body.previous === 'object' ? ctx.body.previous : {};
  const en = String(prev.prompt_en || '').trim();
  if (!en) return json(res, 400, { error: '没有可以微调的原文' });

  const messages = buildCharacterRefineMessages({
    previous: {
      prompt_en: en,
      prompt_zh: String(prev.prompt_zh || ''),
      aspect: String(prev.aspect || ''),
    },
    instruction,
    apiPinned: ctx.apiPinned,
  });

  return proxyChatStream(req, res, { ...ctx, messages, maxTokens: 2600 });
}

// ---------- 保存到本地 ----------
function stampNow(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// 文件名里去掉 Windows 不允许的字符
function safeName(s) {
  return String(s || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40) || '未命名';
}

// 文件末尾写一行机器可读的元数据，渲染 Markdown 时看不见，但能把内容原样载回界面
const META_TAG = '<!-- promptforge-meta:';

function buildMetaComment(payload) {
  // 防止内容里出现 --> 提前闭合注释
  const safe = JSON.stringify(payload).replace(/-->/g, '--\\>');
  return `${META_TAG}${safe} -->`;
}

function parseMetaComment(text) {
  const i = text.lastIndexOf(META_TAG);
  if (i < 0) return null;
  const end = text.indexOf('-->', i);
  if (end < 0) return null;
  try {
    return JSON.parse(text.slice(i + META_TAG.length, end).trim().replace(/--\\>/g, '-->'));
  } catch {
    return null;
  }
}

// 只允许取 saved 目录里的 .md，挡住目录穿越
function resolveSavedFile(name) {
  const base = path.basename(String(name || ''));
  if (!base || !base.endsWith('.md')) return null;
  const full = path.join(SAVED_DIR, base);
  if (path.dirname(path.resolve(full)) !== path.resolve(SAVED_DIR)) return null;
  return full;
}

function resolveTrashFile(name) {
  const base = path.basename(String(name || ''));
  if (!base || !base.endsWith('.md')) return null;
  const full = path.join(TRASH_DIR, base);
  if (path.dirname(path.resolve(full)) !== path.resolve(TRASH_DIR)) return null;
  return full;
}

// 回收站只保留最近 7 天、最多 100 个文件，不然会越攒越多
async function purgeTrash() {
  let names;
  try {
    names = await fsp.readdir(TRASH_DIR);
  } catch {
    return;
  }

  const now = Date.now();
  const alive = [];
  for (const name of names) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(TRASH_DIR, name);
    try {
      const stat = await fsp.stat(full);
      if (!stat.isFile()) continue;
      if (now - stat.mtimeMs > TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
        await fsp.unlink(full);
        continue;
      }
      alive.push({ full, mtime: stat.mtimeMs });
    } catch {
      /* 单个文件删不掉/读不到，跳过 */
    }
  }

  if (alive.length > TRASH_MAX_FILES) {
    alive.sort((a, b) => a.mtime - b.mtime);
    for (const item of alive.slice(0, alive.length - TRASH_MAX_FILES)) {
      await fsp.unlink(item.full).catch(() => {});
    }
  }
}

// 按 `## 小标题` 切分正文，用于给没有元数据的 .md（手写的、旧版本的）兜底
function sectionsOf(body) {
  const out = {};
  const parts = String(body).split(/^##\s+/m);
  for (let i = 1; i < parts.length; i++) {
    const nl = parts[i].indexOf('\n');
    if (nl < 0) continue;
    const key = parts[i].slice(0, nl).trim();
    if (key) out[key] = parts[i].slice(nl + 1).trim();
  }
  return out;
}

async function readSavedEntry(name, opts = {}) {
  const full = resolveSavedFile(name);
  if (!full) return null;
  let raw;
  try {
    raw = await fsp.readFile(full, 'utf8');
  } catch {
    return null;
  }
  const stat = await fsp.stat(full).catch(() => ({ size: 0, mtime: new Date() }));
  const meta = parseMetaComment(raw) || {};
  const body = raw.replace(/\n?<!-- promptforge-meta:[\s\S]*?-->\s*$/, '');

  const h1 = (body.match(/^#\s+(.+)$/m) || [])[1] || '';
  const title = String(meta.title || h1 || name.replace(/\.md$/, '')).trim();
  const kind = meta.kind === 'character' ? '角色设定' : (body.includes('## 英文提示词') ? '角色设定' : '提示词');

  // 没有元数据时，从 Markdown 小节里把内容捡回来，这样手写的文件也能载入
  const sec = sectionsOf(body);
  if (!meta.positive && sec['正向提示词']) meta.positive = sec['正向提示词'];
  if (!meta.negative && sec['负向提示词']) meta.negative = sec['负向提示词'];
  if (!meta.translation && sec['画面解读']) meta.translation = sec['画面解读'];
  if (!meta.prompt_en && sec['英文提示词']) meta.prompt_en = sec['英文提示词'];
  if (!meta.prompt_zh && sec['中文对照']) meta.prompt_zh = sec['中文对照'];

  const summarySource = kind === '角色设定'
    ? (meta.prompt_en || (body.split('## 英文提示词')[1] || ''))
    : (meta.positive || (body.split('## 正向提示词')[1] || ''));
  const summary = String(summarySource).split(/\n##/)[0].replace(/\s+/g, ' ').trim().slice(0, 110);

  // 列表接口不需要完整正文，省点带宽
  const outMeta = { ...meta };
  if (opts.light) {
    for (const k of ['positive', 'negative', 'translation', 'prompt_en', 'prompt_zh']) delete outMeta[k];
  }

  return {
    name,
    title,
    kind,
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    summary,
    meta: outMeta,
  };
}

async function handleSave(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: '请求格式错误' });
  }

  const kindKey = body.kind === 'character' ? 'character' : 'prompt';
  const kindLabel = kindKey === 'character' ? '角色设定' : '提示词';
  const title = String(body.title || '').trim() || '未命名';
  const content = String(body.content || '').trim();
  if (!content) return json(res, 400, { error: '没有可保存的内容' });

  try {
    await fsp.mkdir(SAVED_DIR, { recursive: true });

    const base = `${stampNow()}_${kindLabel}_${safeName(title)}`;
    let file = path.join(SAVED_DIR, `${base}.md`);
    let n = 1;
    // 同一秒保存两条同名内容时自动加序号，不覆盖旧的
    while (fs.existsSync(file)) file = path.join(SAVED_DIR, `${base}-${n++}.md`);

    const now = new Date();
    const meta = {
      kind: kindKey,
      title,
      savedAt: now.toISOString(),
      ...(body.meta && typeof body.meta === 'object' ? body.meta : {}),
    };

    const head = `# ${title}\n\n> 保存时间：${now.toLocaleString('zh-CN')}\n> 类型：${kindLabel}\n\n`;
    const text = `${head}${content}\n\n${buildMetaComment(meta)}\n`;
    await fsp.writeFile(file, text, 'utf8');

    return json(res, 200, { ok: true, file: path.basename(file), dir: SAVED_DIR });
  } catch (err) {
    return json(res, 500, { error: `保存失败：${err?.message || err}` });
  }
}

async function handleListSaved(req, res) {
  try {
    await fsp.mkdir(SAVED_DIR, { recursive: true });
    const names = (await fsp.readdir(SAVED_DIR))
      .filter((f) => f.endsWith('.md'))
      .sort()
      .reverse();

    const items = [];
    for (const name of names) {
      const entry = await readSavedEntry(name, { light: true });
      if (entry) items.push(entry);
    }
    return json(res, 200, { dir: SAVED_DIR, count: items.length, items });
  } catch (err) {
    return json(res, 500, { error: String(err?.message || err) });
  }
}

async function handleSavedItem(req, res) {
  const url = new URL(req.url, `http://${HOST}`);
  const entry = await readSavedEntry(url.searchParams.get('file'));
  if (!entry) return json(res, 404, { error: '找不到这个文件' });
  return json(res, 200, entry);
}

// 重命名：文件名里的标题段、正文 H1、以及元数据里的 title 要一起改，否则会不三不四
async function handleRenameSaved(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: '请求格式错误' });
  }

  const full = resolveSavedFile(body.file);
  if (!full) return json(res, 400, { error: '文件名不合法' });

  const newTitle = String(body.title || '').trim();
  if (!newTitle) return json(res, 400, { error: '名称不能为空' });
  if (newTitle.length > 60) return json(res, 400, { error: '名称太长了（最多 60 字）' });

  try {
    const raw = await fsp.readFile(full, 'utf8');
    const meta = parseMetaComment(raw) || {};
    const oldName = path.basename(full);

    // 文件名结构是 时间戳_类型_标题.md，重命名时保留前半段
    const stamp = (oldName.match(/^(\d{8}-\d{6})_/) || [])[1] || stampNow();
    const kindLabel = oldName.includes('_角色设定_') ? '角色设定' : '提示词';
    const base = `${stamp}_${kindLabel}_${safeName(newTitle)}`;

    let target = path.join(SAVED_DIR, `${base}.md`);
    let n = 1;
    // 目标重名就加序号，但不跟自己较劲
    while (fs.existsSync(target) && path.resolve(target) !== path.resolve(full)) {
      target = path.join(SAVED_DIR, `${base}-${n++}.md`);
    }

    // 正文：换掉 H1，再重新生成元数据注释
    const body_ = raw.replace(/\n?<!-- promptforge-meta:[\s\S]*?-->\s*$/, '');
    const newBody = body_.replace(/^#\s+.*$/m, `# ${newTitle}`);
    meta.title = newTitle;
    const text = `${newBody.trimEnd()}\n\n${buildMetaComment(meta)}\n`;
    await fsp.writeFile(full, text, 'utf8');

    if (path.resolve(target) !== path.resolve(full)) {
      await fsp.rename(full, target);
    }

    return json(res, 200, { ok: true, file: path.basename(target), dir: SAVED_DIR });
  } catch (err) {
    return json(res, 500, { error: `重命名失败：${err?.message || err}` });
  }
}

async function handleDeleteSaved(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: '请求格式错误' });
  }
  const full = resolveSavedFile(body.file);
  if (!full) return json(res, 400, { error: '文件名不合法' });
  try {
    await fsp.mkdir(TRASH_DIR, { recursive: true });
    await purgeTrash();

    // 回收站里重名时加序号，恢复时前端会把原名一起带回来
    const original = path.basename(full);
    let trash = original;
    let n = 1;
    while (fs.existsSync(path.join(TRASH_DIR, trash))) {
      trash = original.replace(/\.md$/, `-${n++}.md`);
    }

    await fsp.rename(full, path.join(TRASH_DIR, trash));
    // rename 会保留原文件的修改时间，这里改成「删除时间」，
    // 否则一个很久以前保存的文件一进回收站就会被当成过期清掉。
    const now = new Date();
    await fsp.utimes(path.join(TRASH_DIR, trash), now, now).catch(() => {});

    return json(res, 200, {
      ok: true,
      dir: SAVED_DIR,
      trash,
      original,
      retentionDays: TRASH_RETENTION_DAYS,
    });
  } catch (err) {
    return json(res, 500, { error: `删除失败：${err?.message || err}` });
  }
}

// 撤销删除：把文件从回收站搬回保存目录；同名文件已存在就加序号，不覆盖
async function handleRestoreSaved(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: '请求格式错误' });
  }

  const src = resolveTrashFile(body.trash);
  if (!src) return json(res, 400, { error: '文件名不合法' });
  if (!fs.existsSync(src)) return json(res, 404, { error: '撤销已过期，文件已被清理' });

  try {
    await fsp.mkdir(SAVED_DIR, { recursive: true });
    const wanted = path.basename(String(body.original || ''));
    const original = wanted.endsWith('.md') ? wanted : path.basename(src);

    let target = path.join(SAVED_DIR, original);
    let n = 1;
    while (fs.existsSync(target)) {
      target = path.join(SAVED_DIR, original.replace(/\.md$/, `-${n++}.md`));
    }

    await fsp.rename(src, target);
    return json(res, 200, { ok: true, file: path.basename(target), dir: SAVED_DIR });
  } catch (err) {
    return json(res, 500, { error: `撤销失败：${err?.message || err}` });
  }
}


function openInFileManager(target) {
  const cmd = process.platform === 'win32'
    ? ['explorer.exe', [target]]
    : process.platform === 'darwin'
      ? ['open', [target]]
      : ['xdg-open', [target]];
  try {
    spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* 打不开就算了，界面上会显示路径 */
  }
}

async function handleOpenSaved(req, res) {
  try {
    await fsp.mkdir(SAVED_DIR, { recursive: true });
    openInFileManager(SAVED_DIR);
    return json(res, 200, { ok: true, dir: SAVED_DIR });
  } catch (err) {
    return json(res, 500, { error: String(err?.message || err) });
  }
}

async function handleModels(req, res) {
  const cfg = await loadConfig();
  const url = new URL(req.url, `http://${HOST}`);
  const apiKey = String(url.searchParams.get('key') || cfg.apiKey || '').trim();
  const baseURL = normalizeBaseURL(url.searchParams.get('base') || cfg.baseURL);
  if (!apiKey) return json(res, 400, { error: '请先填写 API Key' });

  try {
    const r = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    if (!r.ok) return json(res, 502, { error: `${r.status}：${extractError(text)}` });
    const j = JSON.parse(text);
    const list = (j?.data || j?.models || [])
      .map((m) => (typeof m === 'string' ? m : m?.id || m?.name))
      .filter(Boolean)
      .sort();
    return json(res, 200, { models: list });
  } catch (err) {
    return json(res, 502, { error: `拉取模型列表失败：${err?.message || err}` });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${HOST}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const rel = pathname.replace(/^\/+/, '');
  const type = MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream';

  // 打包成 exe 后：静态文件来自 SEA 内嵌资源
  if (IS_SEA) {
    try {
      const buf = Buffer.from(sea.getAsset(rel));
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'no-cache' });
      return res.end(buf);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
  }

  const target = path.join(PUBLIC_DIR, pathname);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const stat = await fsp.stat(resolved);
    if (!stat.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    res.end(await fsp.readFile(resolved));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

// ---------- 启动 ----------
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${HOST}`);
  try {
    if (pathname === '/api/generate' && req.method === 'POST') return await handleGenerate(req, res);
    if (pathname === '/api/refine' && req.method === 'POST') return await handleRefine(req, res);
    if (pathname === '/api/idea' && req.method === 'POST') return await handleIdea(req, res);
    if (pathname === '/api/characters' && req.method === 'POST') return await handleCharacters(req, res);
    if (pathname === '/api/characters/refine' && req.method === 'POST') return await handleCharacterRefine(req, res);
    if (pathname === '/api/models' && req.method === 'GET') return await handleModels(req, res);
    if (pathname === '/api/save' && req.method === 'POST') return await handleSave(req, res);
    if (pathname === '/api/saved' && req.method === 'GET') return await handleListSaved(req, res);
    if (pathname === '/api/saved/item' && req.method === 'GET') return await handleSavedItem(req, res);
    if (pathname === '/api/saved/rename' && req.method === 'POST') return await handleRenameSaved(req, res);
    if (pathname === '/api/saved/delete' && req.method === 'POST') return await handleDeleteSaved(req, res);
    if (pathname === '/api/saved/restore' && req.method === 'POST') return await handleRestoreSaved(req, res);
    if (pathname === '/api/saved/open' && req.method === 'POST') return await handleOpenSaved(req, res);

    if (pathname === '/api/config' && req.method === 'GET') {
      return json(res, 200, publicConfig(await loadConfig()));
    }
    if (pathname === '/api/config' && req.method === 'POST') {
      let patch;
      try {
        patch = JSON.parse(await readBody(req));
      } catch {
        return json(res, 400, { error: '请求格式错误' });
      }
      const clean = {};
      for (const k of ['baseURL', 'model', 'pinnedPositive', 'pinnedNegative', 'pinEnabled', 'apiKey', 'apiPinnedPrompt', 'apiPinnedForIdea']) {
        if (k in patch) clean[k] = patch[k];
      }
      if ('temperature' in patch) clean.temperature = Number(patch.temperature) || 0.85;
      if (typeof clean.apiKey === 'string') clean.apiKey = clean.apiKey.trim();
      return json(res, 200, publicConfig(await saveConfig(clean)));
    }

    if (pathname.startsWith('/api/')) return json(res, 404, { error: 'not found' });
    return await serveStatic(req, res);
  } catch (err) {
    if (!res.headersSent) json(res, 500, { error: err?.message || String(err) });
    else res.end();
  }
});

function openBrowser(url) {
  if (process.env.NO_OPEN) return;
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    /* 打不开就让用户手动点链接 */
  }
}

// Windows 控制台默认是 GBK，直接输出 UTF-8 会乱码
function fixConsoleEncoding() {
  if (process.platform !== 'win32') return;
  try {
    spawnSync('cmd', ['/c', 'chcp 65001'], { stdio: 'ignore' });
  } catch {
    /* 改不了就算了，顶多中文显示成方块 */
  }
}

function listen(port, attempt = 0) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener('listening', onListening);
      if (err.code === 'EADDRINUSE' && attempt < 15) {
        resolve(listen(port + 1, attempt + 1));
      } else {
        reject(err);
      }
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });
}

// 起服务；Electron 里也会调用它（quiet + noOpen）
export async function startServer(port = BASE_PORT, opts = {}) {
  // 启动时顺手清理过期/超量的回收站文件
  await purgeTrash().catch(() => {});
  const actual = await listen(port);
  const url = `http://${HOST}:${actual}`;

  if (!opts.quiet) {
    console.log('');
    console.log('  ✦ Prompt Forge 已启动');
    console.log(`  → ${url}`);
    console.log(`  数据目录：${DATA_DIR}`);
    console.log('  关闭此窗口即可停止服务');
    console.log('');
  }
  if (!opts.noOpen) openBrowser(url);

  return { port: actual, url };
}

// 直接 `node server.mjs` 时才自动启动；被 Electron 之类引入时由调用方决定
if (!process.env.PF_NO_AUTOSTART) {
  fixConsoleEncoding();
  startServer(BASE_PORT).catch((err) => {
    console.error('启动失败：', err.message);
    process.exit(1);
  });
}
