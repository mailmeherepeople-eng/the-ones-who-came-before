#!/usr/bin/env node
// Rewrites audio/manifest.json from what is actually on disk.
//
//   node game/tools/sync-audio-manifest.mjs           # write it
//   node game/tools/sync-audio-manifest.mjs --check    # report only, exit 1 if stale
//
// The manifest exists because the game must never 404-spam for clips that were
// never recorded: anything not listed is treated as silent. That is the right
// runtime behaviour and a bad authoring experience, because a file you dropped
// in and forgot to list is silently ignored. So this reads the folders and
// writes the list, and adding a recording becomes: drop the file in, run this.
//
// An id is the path under audio/<kind>/ with the extension off, so
// audio/sfx/npc/tribe/ooga.m4a is the sfx id "npc/tribe/ooga". Folders are
// meaningful for sfx: sound.js treats every id under a prefix as one
// character's voice pool.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const audioDir = join(here, '..', 'audio');
const manifestPath = join(audioDir, 'manifest.json');
const KINDS = ['voice', 'sfx', 'music'];
const check = process.argv.includes('--check');

// ids that would need percent-encoding in a URL. They do work (fetch encodes
// them) but they are a trap in a hand-edited JSON file and in a shell, so the
// convention is lowercase, digits, dash, underscore, dot and slash.
const SAFE = /^[a-zA-Z0-9._/-]+$/;

function walk(dir, base = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, posix.join(base, name)));
    else if (name.endsWith('.m4a')) out.push(posix.join(base, name.slice(0, -4)));
  }
  return out;
}

const found = {};
const unsafe = [];
for (const kind of KINDS) {
  found[kind] = walk(join(audioDir, kind));
  for (const id of found[kind]) if (!SAFE.test(id)) unsafe.push(`${kind}/${id}.m4a`);
}

let previous = { voice: [], sfx: [], music: [] };
let comment = null;
if (existsSync(manifestPath)) {
  try {
    // tolerate a UTF-8 BOM: PowerShell and several editors add one by default
    // on this platform, and JSON.parse throws on it
    const j = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^﻿/, ''));
    comment = j._comment ?? null;
    for (const kind of KINDS) previous[kind] = j[kind] ?? [];
  } catch (e) {
    console.error(`existing manifest.json could not be parsed (${e.message}); rewriting it from disk.`);
  }
}

const out = {};
if (comment) out._comment = comment;
for (const kind of KINDS) out[kind] = found[kind];
const text = JSON.stringify(out, null, 2) + '\n';

let changed = false;
for (const kind of KINDS) {
  const was = new Set(previous[kind]);
  const now = new Set(found[kind]);
  const added = found[kind].filter((id) => !was.has(id));
  const gone = previous[kind].filter((id) => !now.has(id));
  for (const id of added) { changed = true; console.log(`  + ${kind}/${id}`); }
  for (const id of gone) { changed = true; console.log(`  - ${kind}/${id}  (no file on disk)`); }
}

if (unsafe.length) {
  console.error('\nThese filenames need URL-encoding. Rename them to lowercase with dashes:');
  for (const f of unsafe) console.error(`  ${f}`);
}

if (!changed) {
  console.log('manifest.json is already in sync.');
} else if (check) {
  console.error('\nmanifest.json is stale. Run: node game/tools/sync-audio-manifest.mjs');
  process.exit(1);
} else {
  writeFileSync(manifestPath, text, 'utf8'); // no BOM, deliberately
  console.log(`\nmanifest.json written: ${found.voice.length} voice, ${found.sfx.length} sfx, ${found.music.length} music.`);
}
if (unsafe.length) process.exit(1);
