# 破限词：一条置顶的 system 消息

这份文档说明 Prompt Forge 现在怎么发破限词（2026-11 起，2.5.0）：文本放在哪、为什么改成
「独立置顶」而不是「追加在任务规则后面」、开关与留空各是什么意思、怎么核对它真的发出去了。

> **发送形态**（置顶 system、留空回落默认、关闭即整条不发）是方法层面的做法，借鉴自同类
> SillyTavern 扩展的公开实现，如 [ST-BaiBai-Image](https://github.com/baibai-git/ST-BaiBai-Image)
> 的 `src/autoTag/prompt.ts`。**内置默认正文是本项目原创撰写的 FORGE 内核**，
> 没有搬运任何第三方提示词文本；出处说明见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

---

## 1. 和旧「内置破限层」的区别

| | 旧：内置破限层（2.3） | 新：破限词（2.5 起） |
| --- | --- | --- |
| 位置 | 拼进**任务那一条** system，在任务规则之后 | **独立的 messages[0]**，排在任务规则之前 |
| 体量 | 上游执行契约约 10,700 字 | 内置默认约 1,350 字 |
| 改文本 | 不能改（上游逐字移植，只核对哈希） | 设置里直接改，可恢复默认 |
| 关掉 | 从 system 里摘除那一段 | 整条消息不发，消息数少一条 |
| 留空 | 不适用 | **留空 = 用内置默认**，不是关闭 |

旧层里关于工具调用、计划模式、子代理的那一大段对本工具本来就不生效（本工具没有这些能力），
却要每条请求都付一万字的 token。换成置顶短文本后，位置更接近「系统设定」而不是
「任务附注」，模型的服从度也更高——这是同类扩展普遍采用的形态。

---

## 2. 文本放在哪

```
src/jailbreak.mjs
├─ DEFAULT_JAILBREAK_PROMPT   内置默认正文（FORGE 内核：forge_role / forge_scope / forge_output / forge_limits，原创）
├─ JAILBREAK_MARKER           认出「这段是破限词」的稳定标记 <forge_kernel
├─ JAILBREAK_META             内核名与版本（设置卡片上显示）
├─ resolveJailbreakText()     trim 后为空 → 内置默认
├─ isCustomJailbreak()        与设置页「默认 / 已自定义」同口径
└─ withJailbreak()            把破限词插成 messages[0]，幂等
```

用户自定义的正文存在 `config.json` 的 `jailbreakPrompt` 里；`jailbreakOn` 控制发不发。

---

## 3. 拼装与发送

```
[messages[0] 破限词（独立 system，jailbreakOn = true 时才有）]
        │
        ▼
[messages[1] 任务 system：任务规则 → 输出格式确认]
        │
        ▼
[messages[2] user：用户输入 / 原文 / 待改内容]
```

- 九个任务链路（生成 / 微调 / 导入改写 / 角色 / 角色微调 / 细分 / 细分微调 / 灵感 / 设定集）
  都从 `src/server.mjs` 的两个出口出去：`proxyChatStream`（流式）与 `callModelJson`（内联 JSON）。
  破限词**只在这两个出口插一次**，所以不会有哪个模式漏带或重复带。
- 预览接口（`POST /api/prompt-preview`）按同样的顺序摊平给人看：破限词 → 任务 system → user。

---

## 4. 三个开关语义

| 状态 | 结果 |
| --- | --- |
| `jailbreakOn: true` + `jailbreakPrompt: ""` | 发**内置默认**（约 1,350 字） |
| `jailbreakOn: true` + `jailbreakPrompt: "你的文本"` | 发你的文本（首尾空白自动去掉） |
| `jailbreakOn: false` | **整条不发**，消息数与未接入前一致 |

设置页里「清空（用默认）」= 把 `jailbreakPrompt` 存成空串，回到第一行；
「保存为与内置默认逐字相同」也存空串——以后内置文本更新时能跟着变。

---

## 5. 怎么核对

1. 设置 → 破限词 → 「编辑破限词」：看到的就是这次要发的原文。
2. 设置 → 破限词 → 「预览最终提示词」：破限词在第一段，任务那段以「输出格式（强制）」收尾。
3. 设置 → 破限词 → 「测试破限是否生效」：用当前配置真发一次请求，按
   「通过 / 敷衍 / 被拒 / 空回复 / 异常」给结论。
4. 抓包：`POST /api/generate` 到上游的 body 里，`messages[0].role === 'system'` 且内容等于破限词。
   回归测试（`npm test`）里的假接口就是这么断言的：`jailbreakFirst === true`。

---

## 6. 改默认文本时注意

- 只改 `DEFAULT_JAILBREAK_PROMPT`。用户已经自定义过的不受影响（他们的正文优先）。
- 保持四个分段：`forge_role`（身份与不扮演角色）→ `forge_scope`（尺度与写作口径）→
  `forge_output`（输出形态）→ `forge_limits`（四类不写 + 冲突优先级）。删掉 `forge_output`，
  模型可能开始写散文；删掉 `forge_limits`，某些网关会直接拦整条请求。
- 首行 `<forge_kernel version="1">` 与 `JAILBREAK_MARKER` 保持一致：假接口、回归测试、
  调试工具都靠这个标记认出「这段是破限词」，换正文时不要动它。
- 改完跑 `npm run test:static`：`tests/check-jailbreak.mjs` 会校验结构、长度、原创性
  （不能出现第三方内核的标识与句式）、留空语义与置顶顺序。内置文本超过 4,000 字会红——
  那说明又走回「一万字执行契约」的老路。
