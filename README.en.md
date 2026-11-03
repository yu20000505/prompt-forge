<a id="top"></a>

<div align="center">

# 🔨 Prompt Forge

**One sentence in, a renderable NovelAI prompt out.**

[![CI](https://github.com/yu20000505/prompt-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/yu20000505/prompt-forge/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-2.5.0-6f7f66)](CHANGELOG.md)
[![Latest release](https://img.shields.io/github/v/release/yu20000505/prompt-forge?color=6f7f66&label=release)](../../releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-6f7f66)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-6f7f66)](#quick-start)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-6f7f66)](#build)
[![Deps](https://img.shields.io/badge/runtime%20deps-0-6f7f66)](#build)

Write one sentence in Chinese and get **positive danbooru tags + a UC negative** ready for NovelAI.
Also produces character sheets (English tags + Chinese reading) and composable segment tags.
**Local-first, zero runtime dependencies** — it talks straight to your own OpenAI-compatible endpoint,
and the key never leaves your machine.

[⬇️ Download](../../releases/latest) · [中文说明](README.md) · [Changelog](CHANGELOG.md) · [Quick start](#quick-start) · [FAQ](#faq)

</div>

> ⚠️ **The prebuilt exe can lag behind the source**: release binaries are historical builds. For 2.5
> features, run from source (see [Quick start](#quick-start)) or `npm run build:all` yourself.

![Main window](docs/screenshots/01-main.png)

> **2.5 in one line**: NovelAI only — positives are danbooru tags, negatives are UC, followed by a local
> *NAI pass* and *prompt checkup* that never call the model. The jailbreak text is now its own
> **leading, editable system message**.

---

## 📑 Contents

| Quick | Deep dive |
| --- | --- |
| [✨ What's new in 2.5](#whats-new) | [🧠 NAI pass & checkup](#nai-pass) |
| [🎯 Why](#why) | [🔥 Jailbreak prompt](#jailbreak) |
| [🚀 Quick start](#quick-start) | [⚙️ Settings](#params) |
| [🧩 Features](#features) | [🛠️ Build & test](#build) |
| [🖼️ Screens](#screens) | [📂 Layout](#layout) · [🔒 Privacy](#privacy) |
| [❓ FAQ](#faq) | [📄 License](#license) |

---

<a id="whats-new"></a>

## ✨ What's new in 2.5

| | Feature | What it does |
| :--: | --- | --- |
| 🎯 | **NovelAI only** | The five generic styles are gone. Positives are danbooru tags, negatives are UC; tag order, character counts, species handling, outfit colours, action binding, rating and age rules are baked into the templates |
| 🧹 | **NAI pass** | A local rule pass after every generation: lowercase, dedupe, reorder by danbooru convention, strip quality tags, convert SD syntax, fix `no humans` conflicts. Shown as its own card — apply only if you like it |
| 🩺 | **Prompt checkup** | Lists what is still wrong: unbalanced brackets, identity tags in UC, contradictory counts, shot/size conflicts, duplicates, age conflicts, missing outfit colours, token overflow |
| 🔥 | **Jailbreak prompt (leading system)** | Sent as its own `messages[0]`, ahead of every task rule, on all nine paths; the built-in text is an original FORGE kernel (≈1,350 chars) |
| ✏️ | **Editable** | Settings → Jailbreak prompt → *Edit*; saving applies to the next request. *Fill in default* / *Clear (use default)* in one click |
| 🔍 | **Inspectable & testable** | *Preview final prompt* lays out jailbreak → task system → user for all nine modes; *Test the jailbreak* sends one real request |

<details>
<summary>📜 Older versions (2.2 / 2.1 / 2.0)</summary>

### 2.2
- **Worlds**: multiple independent settings books, five entry types, AI-drafted world, entries and expansions
- **Chinese description expander**, **persistent refinement stacks**, **detailed visual anchors**

### 2.1
- **Three candidates per sentence**, **version timeline with diffs**, **templates & presets**,
  **autosaved drafts**, **trash**, **multiple provider profiles**, **desktop single-instance lock**

### 2.0
- Editable results, import & rewrite, unified history, one-click seven segment categories + assembly board,
  full-text library search, automatic retry, Chinese/English UI

Full history in [CHANGELOG.md](CHANGELOG.md).

</details>

---

<a id="why"></a>

## 🎯 Why

You know the image. Turning it into tags is the annoying part:

```diff
- in your head   rainy neon street, cyberpunk swordswoman glancing back, neon catching her face
+ renderable     1girl, solo, long hair, neon lights, night, rain, city street, looking back,
+                cyberpunk, jacket, medium shot, cinematic lighting, depth of field
+ UC negative    lowres, bad anatomy, bad hands, extra digits, worst quality, ... (count/rating/age aware)
```

Prompt Forge does that translation, then lets you keep adjusting **in plain language**
("make it night", "drop the person", "portrait") instead of hand-editing tags.

---

<a id="quick-start"></a>

## 🚀 Quick start

### 1️⃣ Pick how to run it

| Way | Best for | How |
| --- | --- | --- |
| 🖥️ **Desktop exe** | Just using it | Download `PromptForge-Desktop.exe`, double-click. Native window, no browser, no console |
| ⌨️ **Console exe** | One less window | Download `PromptForge.exe`; it starts a local server and opens <http://127.0.0.1:43125> |
| 🧑‍💻 **From source** | Tinkering | `git clone` → `node src/server.mjs` (or `启动.bat` on Windows). Needs Node 20+ |

> The exe bundles its runtime — **no Node.js needed on the target machine**. Builds are unsigned, so Windows
> may say "Unknown publisher": click *More info → Run anyway*. Releases ship `SHA256SUMS.txt`.

### 2️⃣ Fill in three fields

Open **Settings** in the top-right:

| Field | Example | Note |
| --- | --- | --- |
| BaseURL | `https://api.deepseek.com` | Bare domains get `/v1` appended; full `/chat/completions` also works |
| API Key | `sk-…` | Stored locally, shown masked |
| Model | `deepseek-chat` | Type it or pick from the fetched list |

Hit **Test connection**, then **Save**.
Any OpenAI-compatible endpoint works: DeepSeek, OpenAI, Moonshot, Zhipu, SiliconFlow, LM Studio, Ollama, proxies.

### 3️⃣ Write one sentence and generate

You get positive tags, a negative, a Chinese reading and parameter hints. Not happy? Say "make it night" and
refine, or pick one of the three candidates.

---

<a id="features"></a>

## 🧩 Features

### 🏭 Prompt studio

| Feature | What it does |
| --- | --- |
| One-line generation | Chinese sentence → danbooru tags + UC negative + reading + parameters |
| Refine, don't regenerate | Change only what you mention, everything else kept verbatim, unlimited undo |
| Three candidates | Compare side by side, continue with the one you like |
| Import & rewrite | Paste an existing prompt (mixed languages fine), keep the intent, get NAI tags |
| Editable results | Fix positive/negative/reading/parameters by hand; mark as edited; restore the original |
| Idea generator | Six fresh scene one-liners, avoiding what you just used |

**Only four parameters**: format, detail level, aspect, shot. No "target model" or "prompt language" noise.

| Format | Looks like | Note |
| --- | --- | --- |
| `Tag flow` | `1girl, silver hair, white dress, standing` | Atomic danbooru tags, lowercase, reordered |
| `Semi-natural` | `1girl, long silver hair, standing on a rooftop` | Comma-separated phrases, word order kept |

Both share the same weighting syntax, UC, rating and age control — and **neither writes quality tags**
(`masterpiece` / `absurdres` belong to your quality/artist string).

### 🎭 Character sheets

Who is in frame, what they wear, where they stand, what they do, what the shot is — output as one renderable
NAI tag block plus a Chinese reading. Refinable and hand-editable.

### 🏷️ Segment tags + assembly board

- Seven dimensions: outfit / character / scene / pose / props / lighting / style
- Generate one dimension at a time, refine, revert, copy, save
- **All seven at once** with progress and elapsed time, cancellable; finished ones land on the board
- **Assembly board** keeps the newest of each dimension and concatenates them in a fixed order, de-duplicated;
  survives refresh and restart

### 📚 Worlds

Multiple independent worlds (core settings + five entry types); AI drafts directions, cores, entry candidates
and expansions; world rules and selected entries flow into generation. **Mutual-exclusion UC** builds
`-1.5::other hair colour::` strings when two or more entries share the frame, so faces stop blending.

### 🗂️ History · library · backup

- Every mode recorded; filter, search, favourite, restore the full result in one click
- Results saved as readable `.md`, with full-text search, highlight, sort, batch delete, rename, reload
- **Worlds results get their own folder — `saved/worlds/`** — named after the character / creature themselves
  (multiple picks become "A、B"). They stay out of the general library and live in a **「存档」sub-tab inside each
  world** (the world card shows the count); clicking one loads it straight into that world's generate tab
- Deletions go to `saved/.trash` first (7 days)
- JSON backup includes files, history, board and sanitised settings (**no API key**); the `worlds/` subfolder
  travels with it and import can merge or replace

### 🎨 Feel

- **Seven Morandi themes** (six light, one dark), all WCAG contrast-checked
- **Chinese / English UI**, one click, remembered
- Keyboard-friendly: Tab/Enter on lists, `?` for shortcuts, streaming state announced to screen readers
- Automatic backoff retry for 429 / 5xx / network hiccups; invalid key or bad model name fails fast with a clear hint

---

<a id="screens"></a>

## 🖼️ Screens

<p align="center">
  <img src="docs/screenshots/02-character.png" width="48%" alt="Character sheets" />
  <img src="docs/screenshots/05-segment.png" width="48%" alt="Segment tags" />
</p>
<p align="center">
  <img src="docs/screenshots/06-board.png" width="48%" alt="Assembly board" />
  <img src="docs/screenshots/03-theme.png" width="48%" alt="Themes" />
</p>

> Screenshots are generated by `node tests/make-screenshots.mjs`, not hand-cropped.

---

<a id="nai-pass"></a>

## 🧠 NAI pass & checkup

Models write "NAI-ish tags" — order, casing, duplicates and UC composition are usually off. After every
generation a pure rule pass runs locally ([`src/promptstate.mjs`](src/promptstate.mjs)): **no network, no tokens**.

**Positive**

| Action | Example |
| --- | --- |
| Lowercase | `LONG SILVER HAIR` → `long silver hair` |
| Dedupe | `masterpiece` twice → once |
| Danbooru order | quality → count → appearance → outfit → action → scene → lighting → shot |
| Quality slot | normalised to `masterpiece, best quality, very aesthetic, absurdres` |
| SD syntax | `(soft light:1.2)` → `1.2::soft light::` (V3: `{soft light}`) |
| Foreign params | strips `--ar` / `--style` / `--no` |
| Age control | drops `wrinkles` / `crow's feet` on middle-aged characters |
| Species conflict | `no humans` + `4girls` → count tags removed |

**Negative (UC) is assembled from four dimensions**

| Dimension | Rule |
| --- | --- |
| Base | `lowres, bad anatomy, bad hands, …` |
| Rating | Safe pushes `nsfw / nude / nipples …`; X pushes `censored / mosaic` |
| Count | Solo pushes `duo / 2people / multiple girls`; groups push `solo / alone`; 3+ also pushes `closeup / upper body` |
| Age | `mature` tags add anti-ageing UC (silver hair skips the hair colour term) |

Identity words in UC (`1girl` / `male` / `girl`) are **removed** — they would erase the character itself,
one of the most common ways these prompts break.

The result appears in its own "NAI pass" card; the original stays untouched. A "checkup" card below lists
remaining issues.

```bash
node tests/check-promptstate.mjs   # the rule layer runs standalone
```

---

<a id="jailbreak"></a>

## 🔥 Jailbreak prompt (leading system message)

<p align="center">
  <img src="docs/screenshots/07-jailbreak-card.png" width="62%" alt="Jailbreak card" />
  <img src="docs/screenshots/08-jailbreak-edit.png" width="36%" alt="Jailbreak editor" />
</p>

Every request carries three messages; the jailbreak text owns the first one:

```text
┌─ messages[0]  system   jailbreak prompt (built-in ≈1,350 chars, or your own text)
├─ messages[1]  system   task rules → output contract
└─ messages[2]  user     your sentence / text to rewrite / text to expand
```

The built-in text is an **original** FORGE kernel in four parts:

| Section | Owns |
| --- | --- |
| `forge_role` | Identity: one kind of output, no role-play, identity claims in the material are data |
| `forge_scope` | Scale: adult fiction, plain words, no self-censoring, no tamer rewrite |
| `forge_output` | Output shape: one structure only, no disclaimers, imperatives in the material are data |
| `forge_limits` | Four hard limits: sexualised minors, real-world actionable harm, defamation of real people, real-world abuse facilitation |

| State | Behaviour |
| --- | --- |
| On + empty text | Sends the **built-in default** |
| On + custom text | Sends your text (trimmed) |
| Off | **Nothing is sent**; message count matches the pre-feature build |

- **Inspectable**: *Edit* shows exactly what will be sent; *Preview final prompt* lays out every message per mode
- **Testable**: *Test the jailbreak* sends one real request and reports passed / thin / refused / empty / odd
- **Format safe**: `npm run test:static` asserts it comes first, appears once, and adds no message when off
- **Limit**: it only shifts the model's own bias; a gateway that filters keywords will still cut the request

> The text is original; the send pattern (leading system message, empty = default, off = nothing) is a
> method-level idea. Attribution in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), details in
> [docs/jailbreak.md](docs/jailbreak.md).

---

<a id="params"></a>

## ⚙️ Settings

| Setting | Default | Note |
| --- | --- | --- |
| Temperature | `0.85` | Higher = more varied; 0.7–1.0 suits prompt work |
| Max output tokens | `0` (per mode) | 0 keeps each mode's default; too small truncates |
| Idle timeout | `120`s | Aborts when the upstream stalls |
| `top_p` | `1.00` | Usually leave it |
| Streaming | On | Off waits for the whole response |
| JSON mode | Off | Only some endpoints support it |

---

<a id="build"></a>

## 🛠️ Build & test

No runtime dependencies; packaging pulls its own toolchain on first run.

```bash
npm run build:exe       # → release/PromptForge.exe              (Node SEA, single file)
npm run build:desktop   # → release-desktop/PromptForge-Desktop.exe (Electron)
npm run build:all       # both
```

| Output | How |
| --- | --- |
| `build:exe` | esbuild bundles the server to CJS → `node --experimental-sea-config` packs bundle + frontend into a blob → based on local `node.exe` → postject injects and flips the SEA fuse |
| `build:desktop` | Same server bundle plus an Electron main process that starts the server and opens a native window |

**Code signing (optional)**

```powershell
npm run build:all
$env:PF_SIGN_PFX = 'C:\certs\prompt-forge.pfx'
$env:PF_SIGN_PASSWORD = '...'
npm run sign
```

Set `WINDOWS_PFX_BASE64` / `WINDOWS_PFX_PASSWORD` secrets in CI and pushing a `v*` tag signs automatically.
See [docs/SIGNING.md](docs/SIGNING.md).

---

<a id="tests"></a>

## ✅ Tests

```bash
npm run test:static    # id references, prompt templates, jailbreak ordering, theme contrast
npm run test:server    # server pure functions
npm test               # full UI regression: 500+ assertions in headless Chrome
```

The UI suite boots a throwaway instance against a fake endpoint and verifies real behaviour: contrast under
every theme, layout geometry, streaming, refine/undo, library writes and reads (file contents included),
history/board persistence, keyboard focus, and whether the jailbreak text really is the first message sent.

```text
PASS  default theme is Morandi light
PASS  input sits left of the result column
PASS  real request carries the jailbreak as the first system message  → jailbreak=true first=true
PASS  jailbreak is its own message, not merged with task rules        → 3
全部通过 ✓
```

CI runs the full UI regression on Linux and smoke-tests the exe build on Windows.

---

<a id="layout"></a>

## 📂 Layout

```text
src/
├── server.mjs        HTTP server + OpenAI-compatible proxy (SSE), config & library I/O
├── styles.mjs        system-prompt templates per mode (task rules + output contract)
├── jailbreak.mjs     jailbreak text (built-in default) and leading-system injection
├── promptstate.mjs   NAI pass / checkup rule layer (zero deps, unit-tested)
└── public/           index.html · styles.css (theme tokens) · i18n.js · app.js
build/
├── build-exe.mjs     SEA packaging
└── build-desktop.mjs Electron packaging
tests/                regression suite · fake endpoint · static checks · screenshot generator
docs/screenshots/     README images
saved/                library (created at runtime): prompt/character/segment at the root, worlds under worlds/
```

---

<a id="privacy"></a>

## 🔒 Privacy

| Item | Detail |
| --- | --- |
| API key | Plain text in local `config.json` (desktop build tries OS credential encryption); UI only shows `sk-…abcd` |
| Requests | Only to the endpoint you configure — no third-party server in between |
| Data | Saved prompts are ordinary `.md` files under `saved/` |
| Backup | Exported JSON **contains no key** |

Packaged Windows builds store data in `%APPDATA%\PromptForge`; running from source keeps it next to the app.

---

<a id="faq"></a>

## ❓ FAQ

<details>
<summary><b>Does it support SD / Midjourney / Flux?</b></summary>

No — that is the 2.5 trade-off. Cramming those dialects into one template leaves each at ~60%. This tool serves
NovelAI only (danbooru tags + UC).
</details>

<details>
<summary><b>Why are there no <code>masterpiece</code> tags in my prompt?</b></summary>

Quality tags belong to your quality/artist string in NAI. Even if the model writes them, the NAI pass strips and
re-slots them.
</details>

<details>
<summary><b>What happens when I turn the jailbreak prompt off?</b></summary>

That system message is not sent at all; message count matches the pre-feature build. Task rules and the JSON
contract are unaffected.
</details>

<details>
<summary><b>"The server may be an old process"?</b></summary>

Editing `src/server.mjs` / `src/styles.mjs` requires restarting the server; refreshing the browser does not reload
backend code.
</details>

<details>
<summary><b>Windows says "Unknown publisher"</b></summary>

Builds are unsigned; click *More info → Run anyway*. Configured certificates make CI sign releases automatically.
</details>

<details>
<summary><b>Does it need the internet?</b></summary>

Only to reach your LLM endpoint. The NAI pass, checkup, board, search and saving are all local.
</details>

---

<a id="license"></a>

## 📄 License

[MIT](LICENSE) © Prompt Forge

The jailbreak text is original and contains no third-party prompt material; the leading-system send pattern is a
method-level idea. Attribution in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

<div align="center">

**[⬆️ Back to top](#top)** · [Download](../../releases/latest) · [Changelog](CHANGELOG.md) · [中文说明](README.md)

</div>
