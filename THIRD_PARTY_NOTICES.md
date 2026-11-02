# 第三方版权声明

本项目自身以 [MIT](LICENSE) 授权。以下第三方内容被内置或改编进了 Prompt Forge，
按原作者要求在此保留版权声明与许可全文。

## dsh-unrestricted

- 项目：<https://github.com/yexi-by/dsh-unrestricted>
- 版本：`v0.2.6`
- 使用方式：**逐字移植，未作任何删改**。上游 `src/rules.js` 的 `EXECUTION_MODE_BLOCK`
  （10,246 字符）完整收录在 `src/unrestricted-block.mjs`，作为系统提示词的一段注入，
  作用于本工具的九条任务链路（生图提示词、微调、导入改写、角色设定与微调、细分标签与微调、
  随机灵感、设定集 AI）。
- 原文指纹（UTF-8 sha256）：
  `69d74c40bede59b272c7a9f6e2b680cf151c603b9c6c9f818161cf1d693e7c61`，
  测试 `tests/check-unrestricted.mjs` 会重新计算并比对。
- 本工具新增的内容只有原文之后的「Prompt Forge 附加约定」（JSON 输出结构、生图标签组织、
  没有联网工具），不改动原文任何一句。

```text
MIT License

Copyright (c) 2026 yexi-by

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## codex-keysmith

- 项目：<https://github.com/Jia-Ethan/codex-keysmith>
- 使用方式：dsh-unrestricted 的破限提示词以其
  [`examples/gpt-unrestricted.md`](https://github.com/Jia-Ethan/codex-keysmith/blob/601a449b05a86576cf0ad93d7b9fffb89da302ca/examples/gpt-unrestricted.md)
  为参考并做了修改；本项目间接继承了这部分结构与任务路由思路。

```text
MIT License

Copyright (c) 2026 Jia-Ethan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
