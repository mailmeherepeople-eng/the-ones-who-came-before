# The Ones Who Came Before: the game

The shipped game. A single-player browser game teaching NCERT Class 6 Social Science, Chapter 4 ("Timeline and
Sources of History") through play. Three acts, one valley, one save file: live as an early human, watch time erase
your life, then excavate your own past as a five-specialist team.

- What the game is: [`../docs/GAME.md`](../docs/GAME.md)
- How it works (code map, controls, beats, debug): [`../docs/REFERENCE.md`](../docs/REFERENCE.md)
- Syllabus coverage, item by item: [`../docs/COVERAGE.md`](../docs/COVERAGE.md)
- Rules for working here: [`../AGENTS.md`](../AGENTS.md)

## Run

Any static file server, no build step, from the repository root:

```
npx serve -l 8321 game
```

Then open http://localhost:8321. Works in desktop and mobile Chrome.

## Layout

| Path | What |
|---|---|
| `index.html`, `css/style.css` | the page and its skin |
| `src/` | the game (ES modules; `src/main.js` boots it; `src/dev/` is the dev-only world editor) |
| `vendor/` | Three.js 0.185 and the glTF loader, vendored |
| `assets/history/` | the twelve Act 2 landmark illustrations (original SVG) |
| `audio/` | narration, music and sound files plus a generated `manifest.json` (see `audio/README.md`) |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | offline service worker and install manifest |
| `tools/` | the gate (`check.mjs`) and the tools it runs; `browser-tests.html` |

## Checks

Run `node game/tools/check.mjs` from the repository root before every commit. With the game served, open
`/tools/browser-tests.html` for browser integration tests; it uses its own save slot and restores the previous one.
