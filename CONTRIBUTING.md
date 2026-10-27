# Contributing

Thanks for taking a look. This is a small, dependency-free project — issues and pull requests
are both welcome.

## Before you start

- **Runtime must stay dependency-free.** `src/` may only use Node built-in modules.
  Anything from npm belongs in `build/` (packaging) or `tests/` (tooling).
- **No secrets in commits.** `config.json`, `saved/` and build outputs are git-ignored — keep it
  that way. If you accidentally commit a key, treat it as leaked and rotate it.

## Local setup

```bash
git clone https://github.com/<you>/prompt-forge.git
cd prompt-forge
node src/server.mjs            # http://127.0.0.1:43125
```

No install step. Node.js 20+.

## Making changes

```bash
npm run test:static    # fast: id references, prompt templates, theme contrast
npm test               # full UI regression in headless Chrome (needs Chrome installed)
```

Both must pass before a PR. `npm test` boots a throwaway server against a mock API endpoint —
it never touches your real `config.json`.

Useful focused checkers while iterating:

| Script | What it checks |
| --- | --- |
| `tests/check-ids.mjs` | every `#id` referenced by `app.js` exists in `index.html` |
| `tests/check-prompts.mjs` | prompt templates contain the required instructions |
| `tests/check-themes.mjs` | WCAG contrast for all seven skins (pure math, no browser) |
| `tests/check-contrast-dom.mjs` | contrast of every rendered text node, all skins, both views |

## Where things live

| Path | Purpose |
| --- | --- |
| `src/server.mjs` | HTTP server, OpenAI-compatible proxy with SSE relay, config + library I/O |
| `src/styles.mjs` | system prompts for each mode (prompt / character / refine / idea) |
| `src/public/app.js` | all UI logic; no framework |
| `src/public/styles.css` | theme tokens first, then rules that only use tokens |
| `src/public/index.html` | markup; keep element ids stable, tests rely on them |

### Adding a new prompt style

1. Add an entry to `STYLE_PROMPTS` in `src/styles.mjs` and to `STYLE_LIST`.
2. Add the id to `STYLES` in `src/public/app.js` (chips are generated from it).
3. Run `npm run test:static` then `npm test`.

### Adding a new skin

1. Add a `[data-theme="..."]` block in `src/public/styles.css` overriding the tokens.
2. Add it to `THEMES` in `src/public/app.js` (used for the swatch preview).
3. Run `node tests/check-themes.mjs` — it will tell you exactly which pairs miss contrast,
   and `node tests/tune-themes.mjs` suggests darker/lighter values.

## Code style

- 2-space indent, single quotes, semicolons.
- Comments in Chinese are fine (the project is bilingual); user-facing strings are Chinese.
- Prefer small functions over clever ones; the whole UI is one plain script on purpose.

## Reporting bugs

Please include: what you did, what happened, what you expected, and the exact error text from the
UI error bar or the browser console. For layout bugs, a screenshot plus window width helps a lot.
