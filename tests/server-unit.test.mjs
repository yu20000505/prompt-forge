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
  migrateLegacyPinnedPromptObject,
  parseJsonContent,
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

test('publicConfig: 破限词默认开启，留空即内置默认', () => {
  const cfg = publicConfig({});
  assert.equal(cfg.jailbreakOn, true);
  assert.equal(cfg.jailbreakCustom, false);
  assert.equal(cfg.jailbreakPrompt, '');
  assert.equal(cfg.jailbreakChars, cfg.jailbreakDefaultChars);
  assert.ok(cfg.jailbreakChars > 800);
  assert.equal(cfg.jailbreak.name, 'FORGE 内核');
  assert.match(cfg.jailbreak.origin, /原创/);
  assert.equal(cfg.features.jailbreak, true);
});

test('publicConfig: 自定义破限词按原文字数计入，并标记为已自定义', () => {
  const cfg = publicConfig({ jailbreakPrompt: '  我的规则  ' });
  assert.equal(cfg.jailbreakCustom, true);
  assert.equal(cfg.jailbreakChars, '我的规则'.length);
  assert.equal(cfg.jailbreakOn, true);
  // 关掉开关不影响正文留存：用户重新打开时内容还在
  assert.equal(publicConfig({ jailbreakPrompt: 'x', jailbreakOn: false }).jailbreakPrompt, 'x');
});

test('迁移：旧配置里的范围字段会被清掉（逐字移植后不再分档）', () => {
  // 迁移只处理旧提示词；范围字段由 readConfigFile 删除，这里验证纯函数不主动加回
  const next = migrateLegacyPinnedPromptObject({ apiPinnedPrompt: 'a' });
  assert.equal('unrestrictedScope' in next, false);
});

test('迁移：旧 apiPinnedPrompt 搬进破限词，并清掉规则包字段', () => {
  const source = {
    model: 'm',
    apiPinnedPrompt: '旧版那段文本',
    rulePacks: [{ id: 'keep', name: '保留', text: 'x', enabled: true }],
    rulePacksOn: false,
  };
  const next = migrateLegacyPinnedPromptObject(source);
  assert.ok(next);
  assert.equal('apiPinnedPrompt' in next, false);
  assert.equal('unrestrictedOn' in next, false);
  assert.equal('rulePacks' in next, false);
  assert.equal('rulePacksOn' in next, false);
  assert.match(next.jailbreakPrompt, /旧版那段文本/);
  // 原对象不被改动
  assert.equal(source.apiPinnedPrompt, '旧版那段文本');
  assert.equal(source.rulePacks.length, 1);
});

test('迁移：已经设置过破限词就不覆盖', () => {
  const next = migrateLegacyPinnedPromptObject({
    apiPinnedPrompt: '旧文本',
    jailbreakPrompt: '我的新破限词',
  });
  assert.equal(next.jailbreakPrompt, '我的新破限词');
  assert.equal('apiPinnedPrompt' in next, false);
});

test('迁移：没有旧字段时返回 null，不写盘', () => {
  assert.equal(migrateLegacyPinnedPromptObject({ model: 'm' }), null);
  assert.equal(migrateLegacyPinnedPromptObject({ apiPinnedPrompt: '   ' }), null);
  assert.equal(migrateLegacyPinnedPromptObject(null), null);
});



// ---------- 模型返回的 JSON 解析（世界 AI 最常见的一处失败） ----------
test('parseJsonContent: 纯 JSON 原样解析', () => {
  assert.deepEqual(parseJsonContent('{"a":1}'), { a: 1 });
});

test('parseJsonContent: 剥掉 ```json 围栏和前后解释', () => {
  const t = '好的，这是结果：\n```json\n{"directions":[{"name":"九霄"}]}\n```\n希望有帮助';
  assert.equal(parseJsonContent(t).directions[0].name, '九霄');
});

test('parseJsonContent: 容忍对象里的尾逗号', () => {
  assert.deepEqual(parseJsonContent('{"a":1,"b":[1,2,],}'), { a: 1, b: [1, 2] });
});

test('parseJsonContent: 字符串里的花括号不干扰配对', () => {
  assert.equal(parseJsonContent('前言 {"s":"a}b{c","n":2} 后缀').s, 'a}b{c');
});

test('parseJsonContent: 顶层数组也能解析', () => {
  assert.deepEqual(parseJsonContent('[{"a":1},{"b":2}]').length, 2);
});

test('parseJsonContent: 被截断的 JSON 抛错（不能当成成功）', () => {
  assert.throws(() => parseJsonContent('{"directions":[{"name":"九霄","genre":"东方玄幻"}'), /./);
});

test('parseJsonContent: 空内容抛错', () => {
  assert.throws(() => parseJsonContent('   '), /./);
});
