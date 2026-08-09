#!/usr/bin/env node
// Content lint (design doc §2.3, §12; spec addendum §3).
// 1. Blocklist: old-syllabus terms must not appear anywhere in game source.
// 2. Date discipline: numeric year-like literals with era suffixes may appear
//    only in constants.js and strings.js (strings quote verbatim textbook
//    figures, which are protected below).
// 3. Protected strings: qualifiers that a careless copy-edit must not delete.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

const BLOCKLIST = [
  /palaeolithic/i, /paleolithic/i, /mesolithic/i, /neolithic/i,
  /\bdasas?\b/i, /\bdasyus?\b/i,
  /\baryans?\b/i, // as-a-people framing; any use is disallowed in v1 content
  /untouchab/i,
  /\b40,?000 years\b/i, // human-origins figure must be 300,000 — never 40,000
];

const PROTECTED = [
  { file: 'strings.js', needle: 'conventional year' }, // 4.11 qualifier
  { file: 'strings.js', needle: 'Perhaps they believed' }, // 4.37 hedge
  { file: 'strings.js', needle: 'over 100,000 years ago to around 12,000' }, // 4.41 verbatim
  { file: 'strings.js', needle: '560 + 2024 − 1 = 2,583' }, // 4.15 verbatim
  { file: 'strings.js', needle: 'no year zero' }, // 4.13
  { file: 'strings.js', needle: 'about 300,000 years' }, // 4.31
];

// year-with-era literals outside allowed files, e.g. "8000 BCE", "560 BCE"
const DATE_RE = /\b\d[\d,._]*\s*(BCE|CE\b|years? ago|bya|mya)\b/g;
const DATE_ALLOWED = new Set(['constants.js', 'strings.js']);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.js')) files.push(p);
  }
})(root);

let failures = 0;
for (const f of files) {
  const rel = relative(root, f).replace(/\\/g, '/');
  const text = readFileSync(f, 'utf8');
  for (const re of BLOCKLIST) {
    const m = text.match(re);
    if (m) { console.error(`BLOCKLIST ${rel}: "${m[0]}"`); failures++; }
  }
  const base = rel.split('/').pop();
  if (!DATE_ALLOWED.has(base)) {
    for (const line of text.split('\n')) {
      if (line.trimStart().startsWith('//')) continue;
      const m = line.match(DATE_RE);
      if (m) { console.error(`DATE-LITERAL ${rel}: "${m[0]}" — move to constants.js/strings.js`); failures++; }
    }
  }
}
for (const { file, needle } of PROTECTED) {
  const f = files.find((p) => p.endsWith(file));
  if (!f || !readFileSync(f, 'utf8').includes(needle)) {
    console.error(`PROTECTED-MISSING ${file}: "${needle}"`);
    failures++;
  }
}

if (failures) { console.error(`\nlint-strings: ${failures} failure(s)`); process.exit(1); }
console.log(`lint-strings: OK (${files.length} files)`);
