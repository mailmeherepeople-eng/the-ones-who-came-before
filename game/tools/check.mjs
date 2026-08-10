#!/usr/bin/env node
// One command to run before calling anything done.
//
//   node game/tools/check.mjs
//
// Runs every check that a machine can run, in one place, and exits non-zero if
// any of them fail. The point is not to replace reading the diff: it is to stop
// the class of drift that no playthrough will ever surface, because the game
// keeps working while the thing that guards it quietly stops being true.
//
// Each check here exists because something actually went wrong:
//   content lint     the em dash and old-syllabus rules, plus the protected
//                    NCERT phrasings, all of which ship to children
//   audio manifest   a clip on disk but not in the manifest is silent, and
//                    nothing at runtime says so
//   service worker   three modules shipped for a whole pass without ever being
//                    added to ASSETS, which breaks offline boot and which no
//                    online test can see
//   control chars    a stray NUL byte landed inside a spoken line twice in one
//                    day. No lint looked for it; the tell was grep calling a
//                    source file "binary".
//
// What this CANNOT check is the half that matters most: the editor still
// opening, a beat played by tapping at a phone viewport, a deploy verified from
// a purged browser. That list lives in docs/ai/TEST-CHECKLIST.md, which is on
// disk and in the Obsidian vault rather than in this repo (rule 1), so a fresh
// clone will not have it. HANDOFF.md section 11 says where to find it.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = join(here, '..');
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
}

function walk(dir, filter) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const n of readdirSync(dir)) {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

// ---------- 1 + 2: delegate to the tools that already do these ----------
function runTool(name, script, args = []) {
  const r = spawnSync(process.execPath, [join(here, script), ...args], { encoding: 'utf8' });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  record(name, r.status === 0, out.split('\n').slice(-3).join(' | '));
}

runTool('content lint', 'lint-strings.mjs');
runTool('audio manifest in sync', 'sync-audio-manifest.mjs', ['--check']);

// ---------- 3: the service worker precache list ----------
// Nothing at runtime notices a missing entry while you are online, because the
// fetch handler is network-first and caches whatever it fetches. It only shows
// up as a broken boot for someone who loaded once and went offline.
{
  const sw = readFileSync(join(gameDir, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));
  const shipped = walk(join(gameDir, 'src'), (f) => f.endsWith('.js'))
    .map((f) => relative(gameDir, f).replace(/\\/g, '/'))
    .filter((f) => !f.startsWith('src/dev/')); // dev tools are deliberately absent
  const missing = shipped.filter((f) => !listed.has(f));
  const phantom = [...listed].filter((f) => f !== './' && !existsSync(join(gameDir, f)));
  const ok = missing.length === 0 && phantom.length === 0;
  record('service worker precache', ok, ok ? `${listed.size} entries`
    : [missing.length ? `missing: ${missing.join(', ')}` : '',
       phantom.length ? `not on disk: ${phantom.join(', ')}` : ''].filter(Boolean).join(' | '));
}

// ---------- 4: control characters in source ----------
// A NUL inside a string is invisible in an editor, survives a copy/paste, and
// makes grep call the file binary. It has shipped inside a spoken line before.
{
  const files = walk(join(gameDir, 'src'), (f) => f.endsWith('.js'));
  const bad = [];
  for (const f of files) {
    const b = readFileSync(f);
    for (let i = 0; i < b.length; i++) {
      const c = b[i];
      if (c === 0 || (c < 9) || (c > 13 && c < 32)) {
        bad.push(`${relative(gameDir, f).replace(/\\/g, '/')} @${i} (0x${c.toString(16)})`);
        break;
      }
    }
  }
  record('no control characters in src', bad.length === 0, bad.length ? bad.join(', ') : `${files.length} files`);
}

// ---------- report ----------
const width = Math.max(...results.map((r) => r.name.length));
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`);
}
console.log(failed
  ? `\n${failed} check(s) failed.`
  : `\nAll ${results.length} machine checks passed. The human half is in docs/ai/TEST-CHECKLIST.md.`);
process.exit(failed ? 1 : 0);
