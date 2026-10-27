# Prompt Forge

[![CI](https://github.com/yu20000505/prompt-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/yu20000505/prompt-forge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-6f7f66.svg)](LICENSE)

**一句话进，可出图的提示词出来。**

Prompt Forge 是一个纯本地的小工具：写一句中文，它帮你调大模型生成
Stable Diffusion / NovelAI / Midjourney / Flux / DALL·E 能直接用的提示词，
还能产出「英文提示词 + 中文对照」的角色设定。

不需要注册、不上传数据，直连你自己配置的 **OpenAI 兼容接口**，Key 只存在本机。

[English](README.en.md) · [下载](../../releases) · [自己构建](#自己构建)

![主界面](docs/screenshots/01-main.png)

---

## 它解决什么问题

想要的画面在脑子里很清楚，但要翻译成
`masterpiece, best quality, cinematic lighting, 85mm, f/1.4 …` 很费劲。
Prompt Forge 负责翻译，然后让你用一句人话继续微调，而不是手工拼接标签。

## 功能

- **五种提示词风格** —— SD/SDXL/Flux 结构化短语、NovelAI 的 danbooru 标签流、
  Midjourney（参数自动放进 `--ar` / `--style`）、写实摄影、自然语言直述。
- **角色设定模式** —— 把画面里有谁、穿什么、在什么场景、做什么动作、什么镜头写清楚，
  直接输出一整段可出图的英文提示词 + 中文对照。
- **微调而不是重新生成** —— 生成后说「改成夜景」「去掉人物」「竖构图」，
  只改你提到的地方，其余逐字保留，可无限撤回。
- **两层互不干扰的「置顶」**
  - 本地置顶词：只在浏览器里拼到输出前面，**永远不会发给模型**；
  - 置顶提示词：你写的一段长期要求，生成 / 微调 / 角色设定时都会注入系统提示词；
    随机灵感默认不注入（省 token），需要的话在设置里打开。
- **随机灵感** —— 让模型现编 6 条场景句，自动避开你刚用过的题材。
- **本地保存库** —— 结果可存成可读的 `.md` 文件，在界面里检索、改名、重新载入、删除。
- **七套莫兰迪皮肤** —— 六套低饱和浅色 + 一套深色，配色都经过 WCAG 对比度校验。
- **运行时零依赖** —— 服务端只用 Node 内置模块，不需要 `npm install`。

![角色设定](docs/screenshots/02-character.png)

## 快速开始

### 方式一：用打包好的 exe

| 版本 | 体积 | 行为 |
| --- | --- | --- |
| `PromptForge-Desktop.exe` | ~105 MB | 真正的桌面窗口（Electron），不开浏览器、没有命令行窗口 |
| `PromptForge.exe` | ~88 MB | 起本地服务并打开浏览器 |

两者都自带运行时，**目标电脑不需要装 Node**。到 [Releases](../../releases) 下载。

> exe 未做代码签名，Windows 可能提示「未知发布者」，点「更多信息 → 仍要运行」即可。

### 方式二：直接跑源码

```bash
git clone https://github.com/yu20000505/prompt-forge.git
cd prompt-forge
node src/server.mjs          # Windows 也可以双击 启动.bat
```

需要 Node.js 20+，运行时不需要装任何依赖。

打开 <http://127.0.0.1:43125>，点右上角「设置」填三样：

| 项目 | 例子 |
| --- | --- |
| BaseURL | `https://api.deepseek.com`（只写域名会自动补 `/v1`） |
| API Key | `sk-…` |
| 模型名 | `deepseek-chat` |

任何 OpenAI 兼容服务都能用：DeepSeek、OpenAI、Kimi、智谱、硅基流动、LM Studio、Ollama、中转站。
填完点「测试连接」确认，再「保存」。

## 自己构建

运行时没有依赖，但打包工具链会在首次运行时自动安装。

```bash
npm run build:exe       # → release/PromptForge.exe            （Node SEA 单文件）
npm run build:desktop   # → release-desktop/PromptForge-Desktop.exe （Electron 桌面版）
```

- `build:exe` 的原理：`esbuild` 把 ESM 服务端打成单个 CJS（SEA 入口只接受 CJS）→
  `node --experimental-sea-config` 把 bundle 和三个前端文件一起塞进 blob →
  以本机 `node.exe` 为底座 → `postject` 注入 blob 并打开 SEA fuse。
- `build:desktop`：除上面的服务端 bundle 外，还会打一个 Electron 主进程，
  在进程内起服务并开原生窗口。

## 测试

```bash
npm run test:static    # id 引用、prompt 模板、主题对比度，不需要浏览器
npm test               # 完整 UI 回归：无头 Chrome 里跑 227 条断言
```

UI 套件会用假接口起一个临时实例，验证真实行为：全部皮肤下每个文字节点的对比度、
布局几何、流式输出、微调与撤回、保存库的写入与回读（连磁盘文件内容一起验）、控制台是否报错。

```
PASS  默认皮肤是莫兰迪浅色
PASS  输入区在结果区左侧（左右分栏）
PASS  微调结果仍带置顶词（只带一次）
PASS  保存的是带置顶词的实际版本
PASS  载入时置顶词没有被二次拼接
...
227 项通过，0 失败
```

`docs/` 里的截图由 `node tests/make-screenshots.mjs` 生成，不是手工裁剪。

## 目录结构

```
src/
  server.mjs         HTTP 服务 + OpenAI 兼容代理（SSE 流式），配置与保存库读写
  styles.mjs         六种场景的 system prompt 模板
  public/            index.html、styles.css（主题 token）、app.js
build/
  build-exe.mjs      SEA 打包
  build-desktop.mjs  Electron 打包
  electron/          主进程与打包配置
tests/               回归套件、假接口、静态检查、截图生成
docs/screenshots/    README 用图
```

## 隐私

- API Key 明文存在本机 `config.json`，**只在你自己的电脑上**；
- 界面永远拿不到 Key 原文，设置里只显示掩码（`sk-…abcd`）；
- 提示词和结果只会发给你配置的那个接口；
- 保存的提示词就是 `saved/` 下的普通 `.md` 文件。

Windows 打包版把数据放在 `%APPDATA%\PromptForge`，源码版放在程序目录。

## 协议

[MIT](LICENSE)
