import test from 'node:test';
import assert from 'node:assert/strict';

// 引入 server.mjs 时不要真的启动 HTTP 服务
process.env.PF_NO_AUTOSTART = '1';
const {
  normalizeBaseURL,
  safeName,
  parseIdeas,
  sectionsOf,
  buildMetaComment,
  parseMetaComment,
  publicConfig,
} = await import('../src/server.mjs');
const { buildMessages } = await import('../src/styles.mjs');

test('normalizeBaseURL: 补协议、补 /v1、去掉尾部斜杠', () => {
  assert.equal(normalizeBaseURL('api.deepseek.com'), 'https://api.deepseek.com/v1');
  assert.equal(normalizeBaseURL('https://api.openai.com/'), 'https://api.openai.com/v1');
  assert.equal(normalizeBaseURL('https://x.example/v1/'), 'https://x.example/v1');
  assert.equal(normalizeBaseURL(' https://x.example/v1/chat/completions '), 'https://x.example/v1');
});

test('normalizeBaseURL: 空值和坏 URL 回退到默认地址', () => {
  assert.equal(normalizeBaseURL(''), 'https://api.deepseek.com/v1');
  assert.equal(normalizeBaseURL('http://[bad'), 'https://api.deepseek.com/v1');
});

test('publicConfig: 不泄露 Key，只返回掩码', () => {
  const cfg = publicConfig({
    baseURL: 'https://api.example/v1',
    apiKey: 'sk-1234567890abcd',
    model: 'demo-model',
    temperature: 0.7,
    maxTokens: 1234,
    timeoutSec: 30,
    topP: 0.55,
    stream: false,
    jsonMode: true,
  });
  assert.equal(cfg.hasKey, true);
  assert.equal(cfg.keyMask, 'sk-1…abcd');
  assert.equal('apiKey' in cfg, false);
  assert.equal(cfg.model, 'demo-model');
  assert.equal(cfg.maxTokens, 1234);
  assert.equal(cfg.timeoutSec, 30);
  assert.equal(cfg.topP, 0.55);
  assert.equal(cfg.stream, false);
  assert.equal(cfg.jsonMode, true);
});

test('safeName: 过滤 Windows 非法字符并截断', () => {
  assert.equal(safeName('a/b:c*?"<>|d'), 'a b c d');
  assert.equal(safeName('   '), '未命名');
  assert.equal(safeName('x'.repeat(100)).length, 40);
});

test('parseIdeas: 兼容 JSON 数组、对象数组、围栏和逐行列表', () => {
  assert.deepEqual(parseIdeas('["雨夜的街头","清晨的书店"]'), ['雨夜的街头', '清晨的书店']);
  assert.deepEqual(parseIdeas('[{"text":"甲甲甲甲"},{"idea":"乙乙乙乙"}]'), ['甲甲甲甲', '乙乙乙乙']);
  assert.deepEqual(parseIdeas('```json\n["丙丙丙丙"]\n```'), ['丙丙丙丙']);
  assert.deepEqual(parseIdeas('1. 丁丁丁丁丁丁\n2. 戊戊戊戊戊戊'), ['丁丁丁丁丁丁', '戊戊戊戊戊戊']);
  assert.deepEqual(parseIdeas(''), []);
});

test('sectionsOf: 按 ## 小标题切分正文', () => {
  const out = sectionsOf('## 正向提示词\nalpha\n\n## 负向提示词\nbeta\n');
  assert.equal(out['正向提示词'], 'alpha');
  assert.equal(out['负向提示词'], 'beta');
});

test('buildMessages: 画幅和镜头要求会进入用户消息', () => {
  const messages = buildMessages({
    sentence: '雨夜的街头',
    style: 'sd',
    detail: 'standard',
    language: 'en',
    aspect: '16:9',
    shot: 'close-up',
  });
  const user = messages[1].content;
  assert.match(user, /画幅要求.*16:9/);
  assert.match(user, /镜头要求.*close-up/);
  assert.doesNotMatch(user, /画幅要求.*auto/);
});

test('buildMetaComment / parseMetaComment: 往返一致，且不会被 --> 提前闭合', () => {
  const meta = { title: '测试 --> 标题', positive: 'a, b', nested: { x: 1 } };
  const wrapped = buildMetaComment(meta);
  assert.ok(wrapped.includes('--\\>'));
  assert.deepEqual(parseMetaComment(`# 标题\n\n正文\n\n${wrapped}\n`), meta);
  assert.equal(parseMetaComment('没有元数据'), null);
});
