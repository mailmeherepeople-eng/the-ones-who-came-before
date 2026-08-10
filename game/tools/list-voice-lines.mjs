#!/usr/bin/env node
// Lists every line the game actually NARRATES, with the exact filename to
// record it as. Run it instead of keeping a hand-written list, which goes
// stale the moment someone edits a string.
//
//   node game/tools/list-voice-lines.mjs             # every act
//   node game/tools/list-voice-lines.mjs act1        # one act
//   node game/tools/list-voice-lines.mjs --todo      # only what is not recorded yet
//   node game/tools/list-voice-lines.mjs --csv       # id,file,text for a spreadsheet
//
// A voice id IS the strings.js key path, because src/sound.js resolves a line
// by looking its own text back up in S. So S.act1.wake becomes
// audio/voice/act1.wake.m4a, and no code changes when you add the file.
//
// It reports CALL SITES, not every string. S.act1 holds objectives, button
// labels and hints that are never spoken, and listing those as things to record
// would triple the work for no benefit.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = join(here, '..');
const srcDir = join(gameDir, 'src');

// strings.js is an ES module, but the folder has no package.json type:module so
// a plain import would be read as CommonJS. A data: URL import evaluates it as
// the module it actually is.
const stringsSrc = readFileSync(join(srcDir, 'strings.js'), 'utf8');
const { S } = await import('data:text/javascript,' + encodeURIComponent(stringsSrc));

const args = process.argv.slice(2);
const csv = args.includes('--csv');
const todoOnly = args.includes('--todo');
const only = args.find((a) => !a.startsWith('--'));

function lookup(path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), S);
}

// Every file that can speak. narrator() is the voiced one; card() is full-screen
// story text and worth voicing too; toast() is a transient aside that auto-fades
// and is listed separately because a clip would outlive the box.
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) { if (name.name !== 'dev') walk(join(dir, name.name)); }
    else if (name.name.endsWith('.js')) files.push(join(dir, name.name));
  }
})(srcDir);

const found = new Map(); // id -> Set of kinds
const add = (id, kind) => {
  if (!found.has(id)) found.set(id, new Set());
  found.get(id).add(kind);
};

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  // .narrator(S.a.b   /   .narrator(\n  S.a.b
  for (const m of text.matchAll(/\.narrator\(\s*S\.([A-Za-z0-9_.]+)/g)) add(m[1], 'narrator');
  // .card([ ... ]) may hold several, and entries may be { text: S.a.b, big: true }
  for (const m of text.matchAll(/\.card\(\s*\[([\s\S]{0,400}?)\]/g)) {
    for (const s of m[1].matchAll(/S\.([A-Za-z0-9_.]+)/g)) add(s[1], 'card');
  }
  for (const m of text.matchAll(/\.toast\(\s*S\.([A-Za-z0-9_.]+)/g)) add(m[1], 'toast');
}

// What is already recorded
let listed = new Set();
const manifestPath = join(gameDir, 'audio', 'manifest.json');
if (existsSync(manifestPath)) {
  // Strip a UTF-8 BOM before parsing. This is a Windows project and the usual
  // ways of writing a file here (Set-Content, Out-File, a few editors) add one;
  // JSON.parse throws on it, and the shipped manifest had one. Swallowing that
  // silently made the tool report every recorded line as unregistered, which is
  // exactly backwards from what you want a checking tool to do, so a bad
  // manifest is now loud. The game itself is unaffected: Response.json()
  // UTF-8-decodes, which drops a BOM.
  try {
    listed = new Set(JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^﻿/, '')).voice ?? []);
  } catch (e) {
    console.error(`manifest.json could not be parsed (${e.message}) — treating every line as unrecorded.`);
  }
}
const voiceDir = join(gameDir, 'audio', 'voice');
const onDisk = existsSync(voiceDir)
  ? new Set(readdirSync(voiceDir).filter((f) => f.endsWith('.m4a')).map((f) => f.slice(0, -4)))
  : new Set();

// sound.js maps TEXT back to a key, and the first key holding a given string
// wins. So a line whose text is duplicated elsewhere in S may resolve to the
// other key; flag those rather than let someone record a file that never plays.
const firstKeyFor = new Map();
(function index(obj, path) {
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (typeof v === 'string') { if (!firstKeyFor.has(v)) firstKeyFor.set(v, p); }
    else if (v && typeof v === 'object' && !Array.isArray(v)) index(v, p);
  }
})(S, '');

const rows = [];
const problems = [];
for (const [id, kinds] of [...found].sort((a, b) => a[0].localeCompare(b[0]))) {
  const val = lookup(id);
  if (typeof val === 'function') {
    problems.push([id, 'built from a template, pass { voice: "id" } at the call site to voice it']);
    continue;
  }
  if (typeof val !== 'string') continue;
  const owner = firstKeyFor.get(val);
  if (owner !== id) problems.push([id, `identical text to ${owner}, which owns the lookup, so record ${owner} instead`]);
  else rows.push([id, val, [...kinds].join('+')]);
}

let list = rows;
if (only) list = list.filter(([id]) => id.startsWith(only + '.') || id === only);
const scope = list; // every line in scope, recorded or not — the tally counts these
if (todoOnly) list = list.filter(([id]) => !listed.has(id));

if (csv) {
  console.log('id,file,kind,text');
  for (const [id, text, kind] of list) {
    console.log(`${id},voice/${id}.m4a,${kind},"${text.replace(/"/g, '""')}"`);
  }
} else {
  const w = list.reduce((a, [id]) => Math.max(a, id.length), 0);
  let act = null;
  for (const [id, text, kind] of list) {
    const a = id.split('.')[0];
    if (a !== act) { act = a; console.log(`\n--- ${act} ---`); }
    const mark = listed.has(id) ? 'x' : onDisk.has(id) ? '!' : ' ';
    const short = text.length > 66 ? text.slice(0, 63) + '...' : text;
    console.log(`[${mark}] ${id.padEnd(w)}  ${short}`);
  }
  // Tallied over the whole scope, never the printed rows: --todo prints only
  // what is left, so counting those reported "0 done" no matter how much had
  // actually been recorded.
  const done = scope.filter(([id]) => listed.has(id)).length;
  const orphan = scope.filter(([id]) => onDisk.has(id) && !listed.has(id)).length;
  console.log(`\n${scope.length} line(s)${only ? ` in ${only}` : ''}. ${done} recorded, ${scope.length - done} to go.`);
  if (orphan) console.log(`${orphan} file(s) are on disk but NOT in manifest.json, so they will not play.`);
  console.log('[x] recorded and listed   [!] on disk, missing from manifest.json');
  if (problems.length && !todoOnly) {
    console.log(`\n${problems.length} line(s) need attention:`);
    for (const [id, why] of problems) console.log(`    ${id}\n        ${why}`);
  }
}
