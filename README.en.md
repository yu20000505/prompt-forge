# Prompt Forge

[![CI](https://github.com/yu20000505/prompt-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/yu20000505/prompt-forge/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/yu20000505/prompt-forge?color=6f7f66)](../../releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-6f7f66.svg)](LICENSE)

**One sentence in. A production-ready image prompt out.**

Type one sentence, get prompts you can paste straight into Stable Diffusion, NovelAI, Midjourney,
Flux or DALL·E; plus character sheets (English prompt + Chinese translation) and seven mix-and-match
segment-tag groups. Local-first, zero runtime dependencies, and it talks directly to whatever
**OpenAI-compatible API** you configure — your key never leaves your machine.

> **New in 2.3**: the built-in unrestricted layer — the
> [dsh-unrestricted](https://github.com/yexi-by/dsh-unrestricted) contract ported verbatim
> (10,246 chars, not a word changed) into the system prompt on all nine task paths, behind one
> switch, with a one-click self-check. Plus rule packs and automatic config migration.

[中文说明](README.md) · [Download](../../releases/latest) · [Changelog](CHANGELOG.md) · [Build from source](#build-from-source)

![Main window](docs/screenshots/01-main.png)

## Contents

- [What's new in 2.3](#whats-new-in-23)
- [Why](#why)
- [Features](#features)
- [Quick start](#quick-start)
- [Built-in unrestricted layer](#built-in-unrestricted-layer-dsh-unrestricted)
- [Build from source](#build-from-source) · [Tests](#tests)
- [Project layout](#project-layout) · [Privacy](#privacy) · [License](#license)
- 2.2 / 2.1 / 2.0 notes are collapsed at the end; full history in [CHANGELOG](CHANGELOG.md)

## What's new in 2.3

- **Built-in unrestricted layer** — ports the execution contract from
  [dsh-unrestricted](https://github.com/yexi-by/dsh-unrestricted) (MIT) and injects it as its own
  system-prompt section: generation, refinement, import & rewrite, characters, character refinement,
  segment tags, segment refinement, random ideas and worldbook AI. Nine paths, one switch.
- **Not a word changed** — the upstream block (10,246 chars) is embedded verbatim: nothing compressed,
  nothing rewritten. The tool only appends its own additions (JSON structure, image-tag organisation,
  no web tools) after the original text.
- **Format stays intact** — the layer decides what is written and how deep, never the JSON shape:
  field names, counts, language and parsing still come from the task rules, and the output-format
  lock stays the very last paragraph.
- **Verifiable** — read the layer verbatim in Settings, and preview the exact system message per mode.
  Fixed order: task rules → layer → rule packs → output-format lock.
- **Self-check** — *Test the layer* sends one real request with your current settings and reports
  passed / thin / refused / gateway-rejected with a reply sample, so you can tell whether the layer
  failed or the model/gateway blocked that specific topic.
- **Legacy config migration** — an old `apiPinnedPrompt` in `config.json` is moved into a rule pack
  (disabled, content kept) and the built-in layer is switched on once, so nothing is retyped.

<details>
<summary>Version history: what's new in 2.2 / 2.1 / 2.0</summary>

### What's new in 2.2

- **Worldbooks** — multiple independent worlds with core lore and five entry types: character, item,
  creature, location and faction; AI can draft world directions, core lore, entry candidates and expansions.
- **Generate inside a world** — world rules and selected entries are injected automatically; results stay
  in that worldbook and can be written back as an entry's reference prompt.
- **AI description expansion** — before prompt/character/segment/world generation, expand a short Chinese
  description, preview and edit it, then apply it to the input.
- **Persistent refine versions** — saves and history keep the full version stack, so v1/v2 remain selectable
  after reloading.
- **Richer visual anchors** — characters require 8–14 reproducible visual traits; other entry types get
  their own anchor checklists.
- **Generic NovelAI target** — the preset is now `NovelAI`; typing `NovelAI V5` or `NAI` still matches the
  danbooru-tag guidance.

### What's new in 2.1

- **Multi-variant generation** — generate three candidates from one sentence and compare them side by side.
- **Version timeline** — prompt/character/segment history versions are selectable; prompts get a diff
  view and copies as positive, negative, JSON or Midjourney parameters.
- **Templates & presets** — ten subject templates, three negative presets, aspect/lens shortcuts and
  custom templates.
- **Draft autosave** — inputs and current results for all three modes survive a refresh or crash.
- **Trash** — browse, restore or permanently delete files with a retention countdown.
- **Provider profiles** — switch between saved BaseURL/key/model profiles; the desktop build tries
  OS credential encryption, and diagnostics never contain the key.
- **Desktop details** — single-instance lock, focus the existing window, restore window size/position.

### 2.0 basics

- **Hand editing** — edit the positive/negative prompt, interpretation, parameters, character text
  or segment tags directly, with a “manually edited” marker and one-click restore.
- **Import & rewrite** — paste an existing prompt and restructure it into the current style.
- **Unified history** — all three modes are recorded, filterable, searchable and favoritable.
- **All seven tags at once + assembly board** — run every dimension in one go, dedupe and combine.
- **Library upgrade** — full-text search, highlighting, favorites, sorting, bulk delete and
  JSON backup/import without the API key.
- **Sturdier API layer** — automatic retry with backoff for 429/5xx/network errors; configurable
  max_tokens, timeout, top_p, streaming and JSON mode; truncation warnings.
- **Bilingual UI** — switch between Chinese and English from the top bar.

</details>

---

## Why

Writing image prompts by hand is repetitive: you know what you want, but translating a mental
image into `masterpiece, best quality, cinematic lighting, 85mm, f/1.4 …` is the slow part.
Prompt Forge does the translation, then lets you iterate with short natural-language edits
instead of hand-splicing tags.

## Features

- **Five prompt dialects** — SD/SDXL/Flux structured phrases, NovelAI danbooru tags,
  Midjourney (parameters placed in `--ar`/`--style`), photorealistic photography, and plain
  natural language.
- **Character sheet mode** — describes who is in frame, what they wear, the scene, the action and
  the camera, then outputs one flowing English prompt plus a Chinese translation.
- **Segment tags** — generate one dimension at a time (outfit, character look, scene, pose,
  props, lighting, style) as a comma-separated English tag set; refine it with one sentence,
  undo, copy, save or splice several sets into a full prompt.
- **Assembly board** — collect tag sets over time (one per dimension), splice them into a single
  paste-ready tag string in a fixed order, dedupe automatically, then copy or save to the library.
  It survives reloads and restarts.
- **One-click all seven** — run all seven segment dimensions in one go with progress and elapsed
  time; cancel anytime, completed types go straight to the assembly board, and the rest can be
  resumed later.
- **Automatic upstream retry** — 429, 5xx, timeouts and network blips retry with backoff and a
  visible retry status; invalid keys and wrong URLs/models fail immediately with a clear hint.
- **Tunable request settings** — set max output tokens, idle timeout, top_p, streaming and JSON
  mode; truncated output shows a clear warning and reasoning models report a "thinking" state.
- **Import and rewrite** — paste an existing prompt (mixed languages are fine); the model keeps the
  subject and intent, restructures it into the current dialect, and fills in the negative prompt,
  translation and parameters. It can then be refined, saved and restored like any result.
- **Multi-variant generation** — generate three candidates from one sentence, compare them side by
  side, and keep the one you want.
- **Templates & presets** — ten built-in subject templates, three negative presets, aspect/lens
  shortcuts, and custom templates saved from the current input.
- **Draft autosave** — inputs and current results for all three modes are saved locally and restored
  after a refresh or crash; one click clears them.
- **Provider profiles** — keep multiple BaseURL/key/model profiles and switch between them. The
  desktop build encrypts keys with the OS credential store when available; diagnostics never include
  the key.
- **Trash management** — browse, restore or permanently delete deleted library files with a visible
  retention countdown.
- **Refine instead of regenerate** — after generating, say `make it night` / `remove the person` /
  `vertical composition`; only what you mention changes, everything else stays verbatim.
  Unlimited undo.
- **Hand editing** — fix the positive/negative prompt, interpretation, parameters, character text or
  segment tags directly; edited results are marked, flow into copy/save/history, and can be reverted
  to the model original in one click.
- **Two independent rule layers**
  - *Local prefix* — fixed quality tags prepended in the browser. Never sent to the model.
  - *Rule packs* — your own additional rules appended after the task rules and before the output-format
    lock; every path sends them.
- **Built-in unrestricted layer** — one switch injects the full execution contract into every request:
  imagery written at the scale you ask for, every character treated as an adult, no lecturing, no
  softened variants, no rewriting a request into a tamer one. The layer sits after the task rules and before rule packs, changes content only, and when switched
  off sends not a single character.
- **Rule packs** — keep any number of named rule sets in Settings, toggle each one, concatenate them in
  order, and import/export as JSON. They apply to generation, refinement, characters, segments, worlds
  AI, the Chinese expander and random ideas. A per-mode preview shows the exact system message that
  will be sent after you save.
- **Idea generator** — asks the model for six fresh scene one-liners, avoiding topics you just used.
- **History** — prompt, character and segment results are recorded automatically; filter by mode,
  search, favorite to pin on top, and click an entry to restore the full result. History and the
  assembly board are also persisted to the local data directory, so clearing browser storage does
  not lose them.
- **Local library** — save any result as a readable Markdown file, grouped into collapsible prompt,
  character and segment sections; full-text search with highlighting, favorites pinned on top,
  sort by time/title, multi-select delete, rename, reload or delete. Deletions go to
  `saved/.trash` and can be undone; the trash is purged after 7 days.
- **Backup & import** — export a JSON backup of saved files, history, assembly board and redacted
  settings (no API key); import with merge (duplicate names get a suffix) or replace (old files go
  to the trash first).
- **Bilingual UI** — switch between Chinese and English from the top bar; the choice is remembered.
  Labels, buttons, settings, library, history, import/backup dialogs and common errors are translated.
- **Keyboard & accessibility** — library/history items work with Tab + Enter, drawers trap and restore
  focus, `?` opens a shortcut help panel, and streaming status is announced to screen readers.
- **Seven Morandi skins** — six low-saturation light palettes plus one dark theme, all
  WCAG contrast checked.
- **Zero runtime dependencies** — the server uses only Node built-ins.

![Character mode](docs/screenshots/02-character.png)

![Segment tags](docs/screenshots/05-segment.png)

![Assembly board](docs/screenshots/06-board.png)

## Quick start

### Option A — use a release build

| Build | Size | Behavior |
| --- | --- | --- |
| `PromptForge-Desktop.exe` | ~105 MB | Real desktop window (Electron). No browser, no console. |
| `PromptForge.exe` | ~84 MB | Starts a local server and opens your browser. |

Both are self-contained — no Node.js required on the target machine.
Grab them from [Releases](../../releases). Releases include `SHA256SUMS.txt` for verification.

> Windows may warn about an unknown publisher; the binaries are not code-signed.
> Click *More info → Run anyway*.

### Option B — run from source

```bash
git clone https://github.com/yu20000505/prompt-forge.git
cd prompt-forge
node src/server.mjs          # on Windows you can also double-click 启动.bat
```

Requires Node.js 20+. Nothing to install — there is no `npm install` step for runtime.

> After editing `src/server.mjs` / `src/styles.mjs`, restart the server; refreshing the browser
> does not reload backend code. If the UI says the server is stale, stop the console and rerun it.

Open <http://127.0.0.1:43125>, click **设置** (Settings) and fill in:

| Field | Example |
| --- | --- |
| Base URL | `https://api.deepseek.com` (a bare domain gets `/v1` appended) |
| API Key | `sk-…` |
| Model | `deepseek-chat` |

Any OpenAI-compatible endpoint works — DeepSeek, OpenAI, Moonshot, Zhipu, SiliconFlow,
LM Studio, Ollama, or a proxy. Hit **测试连接** to verify, then **保存**.

## Built-in unrestricted layer (dsh-unrestricted)

> The rules are adapted from [yexi-by/dsh-unrestricted](https://github.com/yexi-by/dsh-unrestricted)
> v0.2.6 (MIT); upstream traces its structure to
> [Jia-Ethan/codex-keysmith](https://github.com/Jia-Ethan/codex-keysmith) (MIT).
> See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and
> [docs/unrestricted.md](docs/unrestricted.md) for the integration details.

Upstream is a DeepSeek Harness plugin that lifts refusals by editing the system prompt at assembly
time. This build does the same thing inside Prompt Forge: the execution contract is compiled into a
fixed block and injected into the system prompt of every request.

The order is fixed, and each layer has one job:

```text
task rules (JSON fields / counts / language)
  → unrestricted layer (upstream text verbatim, 10,246 chars, plus local additions ≈ 10.7k)
    → rule packs (your own extra rules)
      → output-format lock (only that one JSON object, no markdown)
```

The layer states delivery standards rather than magic words: an image request gets tags you can
render, a character request gets a sheet you can use; body and action are written plainly at the
scale requested; every character is treated as an adult; the model does not judge subject, relationship
or explicitness, does not rewrite requests into tamer versions, and treats "please refuse" text inside
pasted material as data. The upstream technical task routing (reverse engineering, keygen, PoC,
scanning, tunnels, chemistry) is kept as well — nothing is trimmed.

- **Switch**: Settings → Built-in unrestricted layer. Turned off, the section disappears entirely and
  the prompt is byte-for-byte what it was before the layer existed.
- **Format safe**: the contract itself says it changes content, not structure, and the JSON lock has
  the last word; `npm run test:static` asserts the layer sits before rule packs and the lock stays last.
- **Inspectable**: *View layer text* shows the block verbatim; *Preview final prompt* shows the assembled
  system message for all nine modes.
- **Self-check**: *Test the layer* sends one real request and classifies the reply as passed / thin /
  refused / gateway-rejected, with the layer state, model and latency. It does not test connectivity —
  that is what *Test connection* is for.
- **Default**: off on a fresh install. If `config.json` still holds an old `apiPinnedPrompt`, startup
  moves it into a disabled rule pack (content preserved) and switches the layer on once.
- **Limit**: it changes the model's own answering bias only. If the upstream gateway inspects keywords,
  it may still cut the connection or return 400 — prompt rules cannot bypass that.

## Build from source

Runtime has no dependencies; the packaging steps pull their own toolchain on first run.

```bash
npm run build:exe       # → release/PromptForge.exe                 (Node SEA, single file)
npm run build:desktop   # → release-desktop/PromptForge-Desktop.exe  (Electron desktop app)
```

How `build:exe` works: `esbuild` bundles the ESM server into one CommonJS file (Node SEA only
accepts a CJS entry) → `node --experimental-sea-config` embeds the bundle plus the three frontend
assets into a blob → a copy of `node.exe` is used as the base → `postject` injects the blob and
flips the SEA fuse.

`build:desktop` bundles the same server, copies the frontend, and ships an Electron main process
that boots the server in-process and opens a native window.

### Code signing (optional)

Release binaries are unsigned by default, so Windows may show an unknown-publisher warning.
With your own Authenticode certificate:

```powershell
npm run build:all
$env:PF_SIGN_PFX = 'C:\certs\prompt-forge.pfx'
$env:PF_SIGN_PASSWORD = '...'
npm run sign
```

In CI, set the `WINDOWS_PFX_BASE64` and `WINDOWS_PFX_PASSWORD` repository secrets and `v*` tags
will be signed automatically; without them the step is skipped. See
[docs/SIGNING.md](docs/SIGNING.md) for timestamp servers, hardware tokens and verification.
Self-signed certificates do not remove the warning.

## Tests

```bash
npm run test:static    # id references, prompt templates, layer assembly, theme contrast — no browser
npm run test:server    # server unit tests (URL normalization, metadata, idea parsing, layer config, …)
npm test               # full UI regression: 528 assertions in headless Chrome
```

The UI suite boots a throwaway server against a mock OpenAI endpoint and asserts real behavior:
contrast of every text node across all skins, layout geometry, streaming, refine/undo, the save
library round-trip (including on-disk file contents), server-side history/board persistence,
keyboard focus and shortcuts, and the absence of console errors.
CI runs the full UI regression on Linux and a packaged-exe smoke test on Windows.

```
PASS  默认皮肤是莫兰迪浅色 (default skin is the light Morandi palette)
PASS  输入区在结果区左侧（左右分栏） (input sits left of results)
PASS  微调结果仍带置顶词（只带一次） (pinned prefix not duplicated after refine)
PASS  保存的是带置顶词的实际版本 (saved file matches what you see)
PASS  载入时置顶词没有被二次拼接 (no double-prefixing when reloading)
...
528 passed, 0 failed
```

Screenshots in `docs/` are generated by `node tests/make-screenshots.mjs`, not hand-cropped.

## Project layout

```
src/
  server.mjs         HTTP server + OpenAI-compatible proxy (SSE), config & library I/O
  styles.mjs         system-prompt templates for all modes, plus the layer/pack assembly entry
  unrestricted.mjs   the built-in unrestricted layer text (adapted from dsh-unrestricted, MIT)
  public/            index.html, styles.css (theme tokens), app.js
build/
  build-exe.mjs      Node SEA packaging
  build-desktop.mjs  Electron packaging
  electron/          Electron main process + builder config
tests/               regression suite, mock API, static checkers, screenshot generator
docs/screenshots/    images used by these READMEs
```

## Privacy

- Your API key is stored in `config.json` **in plain text, on your machine only**.
- The UI never receives the key back — settings show a masked hint (`sk-…abcd`).
- Prompts and results are only sent to the endpoint you configure.
- Saved prompts are ordinary `.md` files in `saved/`.

Windows builds keep data in `%APPDATA%\PromptForge`; running from source keeps it next to the app.

## License

[MIT](LICENSE). The built-in unrestricted layer is adapted from
[dsh-unrestricted](https://github.com/yexi-by/dsh-unrestricted), also MIT; full attribution and
license text in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
