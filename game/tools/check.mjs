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
//   undeclared names a commit deleted the bow constants while the hunt still
//                    read them; every module parsed, and the live game sat
//                    soft-locked at the Act 1 hunt for five weeks
//                    (undeclared.mjs, docs/CHANGELOG.md section 28)
//   audio manifest   a clip on disk but not in the manifest is silent, and
//                    nothing at runtime says so
//   service worker   three modules shipped for a whole pass without ever being
//                    added to ASSETS, which breaks offline boot and which no
//                    online test can see
//   control chars    a stray NUL byte landed inside a spoken line twice in one
//                    day. No lint looked for it; the tell was grep calling a
//                    source file "binary".
//   sizes            agents start cold and read AGENTS.md and HANDOFF.md first.
//                    By 2026-10-28 HANDOFF was 18 KB and partly stale and the
//                    overview 145 KB, so starting work cost more context than
//                    the work did. The caps keep the start under 14 KB. Source
//                    files past 1,500 lines are where agents lose the thread;
//                    the two already over are frozen so they can only shrink.
//
// What this CANNOT check is the half that matters most: the editor still
// opening, a beat played by tapping at a phone viewport, a deploy verified from
// a purged browser. That list is "Before you say done" in AGENTS.md.
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
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trim();
  record(name, r.status === 0, out.split('\n').slice(-3).join(' | '));
}

runTool('gameplay regressions', 'regression.mjs');
runTool('content lint', 'lint-strings.mjs');
runTool('undeclared names, imports', 'undeclared.mjs');
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

// ---------- 5: sizes ----------
// Doc bytes are counted with LF line endings, the way git stores them, so a
// Windows checkout (autocrlf, CRLF on disk) and any other agree on the number.
// Lines are counted the way `wc -l` does. A frozen file may shrink, never grow;
// once it is at or under the cap, take it off FROZEN.
{
  const repo = join(gameDir, '..');
  const DOC_CAPS = { 'AGENTS.md': 8192, 'HANDOFF.md': 6144, 'CLAUDE.md': 512 };
  const LINE_CAP = 1500;
  const FROZEN = { 'src/acts/act1.js': 1673, 'src/dev/editor.js': 1615 };
  const bad = [];
  const notes = [];
  for (const [doc, cap] of Object.entries(DOC_CAPS)) {
    const p = join(repo, doc);
    if (!existsSync(p)) { bad.push(`${doc} missing`); continue; }
    const bytes = Buffer.byteLength(readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
    if (bytes > cap) bad.push(`${doc} ${bytes} > ${cap} bytes`);
    else notes.push(`${doc} ${bytes}/${cap}`);
  }
  const files = walk(join(gameDir, 'src'), (f) => f.endsWith('.js'))
    .map((f) => relative(gameDir, f).replace(/\\/g, '/'));
  for (const rel of files) {
    const text = readFileSync(join(gameDir, rel), 'utf8');
    const lines = (text.match(/\n/g) ?? []).length + (text && !text.endsWith('\n') ? 1 : 0);
    const frozen = FROZEN[rel];
    if (frozen !== undefined) {
      if (lines > frozen) bad.push(`${rel} grew to ${lines} lines (frozen at ${frozen}): split it`);
      else if (lines <= LINE_CAP) notes.push(`${rel} is under the cap now: unfreeze it`);
    } else if (lines > LINE_CAP) {
      bad.push(`${rel} ${lines} > ${LINE_CAP} lines: split it`);
    }
  }
  for (const rel of Object.keys(FROZEN)) {
    if (!files.includes(rel)) notes.push(`${rel} is gone: drop it from FROZEN`);
  }
  record('sizes', bad.length === 0, bad.length ? bad.join(', ')
    : `${notes.join(', ')}; ${files.length} src files within ${LINE_CAP} lines or frozen`);
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
  : `\nAll ${results.length} machine checks passed. The human half is "Before you say done" in AGENTS.md.`);
process.exit(failed ? 1 : 0);
