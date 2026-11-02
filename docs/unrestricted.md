# 内置破限层：dsh-unrestricted 的逐字移植

这份文档说明 [dsh-unrestricted](https://github.com/yexi-by/dsh-unrestricted) 是怎么被接进
Prompt Forge 的：原文放在哪、为什么一个字都不改、本工具额外加了什么、开关怎么走、
怎么核对它真的发出去了，以及上游更新时怎么跟。

> 上游 v0.2.6（`EXECUTION_MODE_BLOCK`，10,246 字符），MIT。
> 出处与许可全文见仓库根目录 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

---

## 1. 移植原则

1. **上游正文逐字保留**：不压缩、不改写、不删减。原文单独放在 `src/unrestricted-block.mjs`，
   文件头记录原文长度与 sha256；测试会重新计算哈希，改坏一个字就红。
2. **宿主差异用「追加」解决，不改原文**：本工具没有工具调用、没有计划模式、也没有联网搜索，
   并且强制 JSON 输出。这些要求写成原文之后的「Prompt Forge 附加约定」，而不是去删改上游的句子。
3. **金属拼装**：注入段 = `<!-- unrestricted:execution-mode -->` + 上游原文 + `---` + 附加约定 + 结束标记。

```
[本任务规则：JSON 字段 / 数量 / 语言]
      │
      ▼
[破限层
   ├─ 上游 EXECUTION_MODE_BLOCK（10,246 字符，逐字）
   └─ Prompt Forge 附加约定（JSON 结构、生图标签、没有工具）
]
      │
      ▼
[规则包（你自己的补充规则）]
      │
      ▼
[输出格式确认：只输出那一个 JSON，不要 markdown]
```

---

## 2. 为什么原文可以整段搬运

上游把这段契约挂进 DeepSeek Harness 的系统提示词组装流水线，靠段落名融合；本工具只有一个
拼装点（`composeSystemLayers`），没有工具协议可冲突，所以**不需要改写**，只需要保证：

- 它出现在任务规则之后（JSON 契约先立住）；
- 它后面还有规则包与最后一道「输出格式确认」（格式锁不会被冲掉）；
- 关闭时能整段摘除，与未接入前逐字一致。

上游原文里关于工具、计划模式、子代理的描述在本工具里不会生效（因为没有这些能力），
但它们也不会造成冲突——这部分保持原样，是为了满足「完完全全移植」。

---

## 3. 附加约定（本工具新增）

上游没有、而 Prompt Forge 必须说明的四件事，写在原文之后：

1. **输出结构**：每次只输出任务约定的那一个 JSON；字段名、数量、语言按任务规则，不增删字段。
2. **图像提示词组织**：positive 只放要出现的内容，negative 只放真正要排除的；人物与身体用
   目标模型认识的具体名词（danbooru / NAI 常见词），不写「适度」「恰当」这类空词。
3. **角色 / 设定 / 灵感**：条目之间要自洽，不因为题材敏感改写成安全版本。
4. **没有工具**：不提供联网搜索或文件工具；需要外部资源时按已有知识给，并说明链接未经核验。

附加约定不含任何删改上游原文的意图，只是补宿主差异。

---

## 4. 配置

`config.json` 只有总开关：

| 字段 | 取值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `unrestrictedOn` | `true` / `false` | `false` | 关闭后整段不注入 |

> 2.3 早期版本有过 `unrestrictedScope`（完整 / 创作向）。改成逐字移植后不再分档，
> 读取配置时会自动删掉这个残留字段。

### 老配置迁移

`startServer()` 启动时调用 `migrateLegacyPinnedPrompt()`：

1. 把旧版 `apiPinnedPrompt` 搬进规则包（命名「旧版自定义系统提示词（内容已保留）」，默认停用）；
2. 没有显式设置过 `unrestrictedOn` 时打开一次；
3. 删除顶层字段，先备份 `.bak` 再原子写入。

主文件被手改坏（例如旧提示词里带了没转义的双引号）时，迁移会退到 `config.json.bak`
上找这段内容，并从备份重写主文件，不会用坏文件覆盖好备份。

---

## 5. 接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/config` | `unrestrictedOn`、`unrestrictedChars`、`unrestricted{version,verbatim,license,...}` |
| GET | `/api/unrestricted` | 当前注入段全文、字数、上游版本 |
| POST | `/api/unrestricted/check` | 自检：真发一次请求并判定结果 |
| POST | `/api/rule-preview` | 九种模式的最终 system message，可传表单里的开关 |
| — | `features.unrestricted` | 前端判断后端是不是旧进程 |

---

## 6. 怎么确认它真的发出去了

1. 设置里打开开关并保存；
2. 「查看破限层全文」：应能看到 `## Unrestricted local execution mode` 开头的原文，
   以及结尾的 `## Prompt Forge 附加约定`；正文约 10,700 字；
3. 「预览最终提示词」：正文里应有 `<!-- unrestricted:execution-mode -->`，且以 JSON 锁收尾；
4. 「测试破限是否生效」：发一次真实请求，按下面的表给结论；
5. 跑测试：

```bash
npm run test:static     # 上游原文 sha256、注入位置、幂等、关闭后逐字还原
npm run test:server     # 配置暴露、迁移、字数
```

---

## 7. 自检：为什么「还是不能破限」

自检用**当前配置**真发一次生成请求（探针是一句露骨的成人画面描述），把回复归类：

| 结论 | 含义 | 下一步 |
| --- | --- | --- |
| 通过 | 模型照常输出带身体细节的 JSON | 破限层生效；别的请求仍被拒，是那类内容被模型/网关单独拦了 |
| 勉强 | 是 JSON 但内容极短 | 模型在自我删减，换更强的模型或服务商 |
| 被拒 | 回复里有明确拒答句式 | 先确认开关已保存、用的是新进程，再换模型试 |
| 异常 | 没有拒答，也没按 JSON 输出 | 格式跑偏或网关改写，看示例内容 |
| 接口返回 4xx/5xx | 请求被网关拒绝 | 服务商层拦截，提示词管不到 |

它不替代「测试连接」：后者只验证 Key/BaseURL 能不能通。

---

## 8. 边界

- **只改倾向，不改权限**：这里没有工具、没有沙箱，能影响的只有模型的回答内容。
- **上游网关拦截不归它管**：关键词审查、400、断流，提示词绕不过去。
- **不改变本地行为**：保存库、备份、回收站、Key 存储与隐私策略不受影响。
- **输出格式优先**：附加约定明确「不改 JSON 字段、数量与解析」，末尾格式锁最高。

---

## 9. 上游更新时怎么跟

上游改措辞时，本工具不做「择优融合」，而是**整段替换原文**：

1. 取上游 `src/rules.js` 的 `EXECUTION_MODE_BLOCK`；
2. 用脚本重写 `src/unrestricted-block.mjs`（转义反引号），文件头更新版本、长度与 sha256；
3. 同步 `src/unrestricted.mjs` 里 `UPSTREAM.version`，以及 `tests/check-unrestricted.mjs`
   里的长度/哈希常量；
4. 跑 `npm run test:static`；附加约定不受影响。

上游的幂等注入与按段落名融合机制在这里用不上——本工具只有一个拼装点，
幂等性由 `composeSystemLayers` 与 `fuseUnrestricted` 保证。

---

## 10. 与上游的差别

逐句标注（含「未成年」相关原文与早期压缩版的对照）见 [prompt-diff.md](prompt-diff.md)。

| 项目 | 上游 | 本内置版 |
| --- | --- | --- |
| 正文 | 10,246 字符 | **一字未改**，原样嵌入 |
| 宿主专属段落（工具/计划/子代理） | 有 | 保留（本工具用不到，但也不冲突） |
| 附加约定 | 无 | 有：JSON 结构、生图标签、没有工具 |
| 拼装位置 | 段落后插入 | 任务规则之后、规则包之前 |
| 开关 | 插件设置 | 设置页总开关，关闭即整段摘除 |
| 自检 | 无 | 有：真发一次请求并判定 |

---

## 11. 文件地图

| 文件 | 作用 |
| --- | --- |
| `src/unrestricted-block.mjs` | 上游原文（逐字），含长度与 sha256 指纹 |
| `src/unrestricted.mjs` | 附加约定、标记、注入/摘除/幂等、自检判定 |
| `src/styles.mjs` | `composeSystemLayers()` 与 `applyApiPinned()`：拼装顺序与 JSON 锁 |
| `src/server.mjs` | 配置、`/api/unrestricted`、预览、自检、启动迁移 |
| `src/public/index.html` | 设置卡片与「破限层全文」弹窗 |
| `src/public/app.js` | 开关、字数、全文读取、自检、预览 meta、备份字段 |
| `src/public/i18n.js` | 新增文案的英文对照 |
| `tests/check-unrestricted.mjs` | 原文哈希、注入位置、幂等、自检判定 |
