# 第三方版权声明

本项目自身以 [MIT](LICENSE) 授权。

## 本项目原创的内容

**破限词的默认正文（`src/jailbreak.mjs` 的 `DEFAULT_JAILBREAK_PROMPT`，即 FORGE 内核）由本项目原创撰写**，
随本项目一起以 MIT 授权：

- 分节名为 `forge_role` / `forge_scope` / `forge_output` / `forge_limits`，自称 FORGE，句式与用词均为自写；
- 不包含任何第三方提示词原文，也不含第三方的内核名、品牌名或段落标识；
- 与同类项目共有的只有「身份 / 尺度 / 输出 / 边界」这种通用骨架，以及「破限词置顶一条 system」
  这种发送形态——两者都属于方法层面，不受版权保护。

## 发送形态的灵感来源（仅思路，未复制文本）

- 项目：[ST-BaiBai-Image](https://github.com/baibai-git/ST-BaiBai-Image)（SillyTavern 扩展「柏宝绘」，`manifest.json` 版本 0.3.2）
- 该仓库公开可读，但**未附任何许可证文件**（GitHub 的 License 字段为空，`package.json` 无 `license`），
  因此默认适用「保留所有权利」。本项目据此做了两条自我约束：
  1. **不复制其提示词原文、源码或注释**——只借鉴公开可见的做法：破限词作为独立的置顶 system 消息、
     留空回落内置默认、与内置默认逐字相同则存空串、关闭时整条不发；
  2. **默认正文自己写**——`src/jailbreak.mjs` 的正文为本项目原创（见上一节），设置页里也不使用其名称或标识。
- 上述做法（方法、结构、交互形态）不构成对其作品的复制；如其日后补充许可证，本项目的现有实现也不受影响。

## 已移除的第三方内容（2.6.0 起）

2.3 – 2.5 曾内置 [dsh-unrestricted](https://github.com/yexi-by/dsh-unrestricted) v0.2.6（MIT）的
`EXECUTION_MODE_BLOCK` 原文（10,246 字符，逐字移植；其结构又参考
[Jia-Ethan/codex-keysmith](https://github.com/Jia-Ethan/codex-keysmith) 的 `gpt-unrestricted.md`）。

2.6.0 起这一层整体移除：`src/unrestricted-block.mjs` 不再随本项目分发，上述正文与对应的
MIT 许可声明一并撤销。历史版本（≤ 2.5.x）仍按 MIT 与下列许可分发：

```text
MIT License — Copyright (c) 2026 yexi-by (dsh-unrestricted)
MIT License — Copyright (c) 2026 Jia-Ethan (codex-keysmith)
两段许可正文与 MIT 标准文本相同，见仓库 git 历史中的 THIRD_PARTY_NOTICES.md（v2.5.0）。
```
