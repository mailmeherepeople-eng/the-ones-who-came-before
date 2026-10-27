#!/usr/bin/env node
// Every name the game uses must exist, and every import must point at
// something real.
//
//   node game/tools/undeclared.mjs            scans game/src
//   node game/tools/undeclared.mjs <srcDir>   scans another copy (for testing)
//
// Why this exists: on 19 September 2026 a commit deleted the five bow
// constants in acts/act1.js (ARROW_SPEED and friends) while the hunt still
// read them. Modules parse fine with a missing name, `node --check` is happy,
// and nothing fails until the line actually runs, which here was the first
// press of Fire. The live game sat soft-locked at the Act 1 hunt for five
// weeks with every other check green (docs/CHANGELOG.md section 28).
//
// What it does, per module under the scanned folder:
//   1. Parses it (acorn, vendored in ./vendor/acorn, so no npm install).
//   2. Walks the tree with real scopes: imports, const/let/var (hoisting
//      included), functions and their parameters, classes, catch and loop
//      variables, destructuring. Any identifier that resolves to nothing,
//      and is not a known JavaScript or browser global, is reported.
//   3. Checks every relative import, re-export and dynamic import(): the
//      file must exist, and every named binding must actually be exported
//      (following `export * from`, which is how three.module.js works).
//
// It does NOT know about properties: `S.act1.missingKey` or `G.oops` are
// beyond a scope check. It also ignores `typeof x`, which is safe on an
// undeclared name by design.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from './vendor/acorn/acorn.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(process.argv[2] ?? join(here, '..', 'src'));
const rel = (f) => relative(srcDir, f).replace(/\\/g, '/');

// ---------- globals that are allowed to appear undeclared ----------
const words = (s) => new Set(s.trim().split(/\s+/));

const JS_GLOBALS = words(`
  Object Function Array Number Boolean String Symbol BigInt Date Promise RegExp
  Map Set WeakMap WeakSet WeakRef FinalizationRegistry Proxy Reflect JSON Math
  Intl Iterator Atomics globalThis undefined NaN Infinity
  Error AggregateError EvalError RangeError ReferenceError SyntaxError
  TypeError URIError
  ArrayBuffer SharedArrayBuffer DataView Int8Array Uint8Array Uint8ClampedArray
  Int16Array Uint16Array Int32Array Uint32Array Float16Array Float32Array
  Float64Array BigInt64Array BigUint64Array
  parseInt parseFloat isNaN isFinite encodeURI encodeURIComponent decodeURI
  decodeURIComponent eval console structuredClone queueMicrotask
  setTimeout clearTimeout setInterval clearInterval WebAssembly
`);

const BROWSER_GLOBALS = words(`
  window document navigator location history screen performance localStorage
  sessionStorage indexedDB caches crypto visualViewport customElements
  requestAnimationFrame cancelAnimationFrame requestIdleCallback
  cancelIdleCallback getComputedStyle matchMedia innerWidth innerHeight
  devicePixelRatio scrollTo scrollX scrollY pageXOffset pageYOffset
  addEventListener removeEventListener dispatchEvent alert confirm prompt
  fetch Request Response Headers URL URLSearchParams Blob File FileReader
  TextEncoder TextDecoder btoa atob AbortController AbortSignal EventTarget
  Event CustomEvent KeyboardEvent MouseEvent PointerEvent TouchEvent WheelEvent
  FocusEvent Node Element NodeFilter DocumentFragment DOMParser XMLSerializer
  HTMLElement HTMLCanvasElement HTMLImageElement HTMLAudioElement
  HTMLVideoElement HTMLInputElement HTMLButtonElement Image Audio Option
  AudioContext webkitAudioContext OfflineAudioContext AudioBuffer
  AudioWorkletNode speechSynthesis SpeechSynthesisUtterance
  WebGLRenderingContext WebGL2RenderingContext OffscreenCanvas ImageData
  ImageBitmap createImageBitmap Path2D DOMMatrix DOMRect FontFace CSS
  ResizeObserver IntersectionObserver MutationObserver PerformanceObserver
  Worker BroadcastChannel MessageChannel Notification Gamepad ClipboardItem
  MediaQueryList VideoFrame isSecureContext reportError trustedTypes
`);

// Real browser globals, but an undeclared use of one is nearly always a typo
// that silently reads the wrong thing (window.name, window.event...) instead
// of throwing. Report them like any other unknown name.
const TRAP_GLOBALS = words(`
  name status event top parent self length origin close open stop find print
  scroll closed frames opener external focus blur
`);

const allowed = (n) => (JS_GLOBALS.has(n) || BROWSER_GLOBALS.has(n)) && !TRAP_GLOBALS.has(n);

// ---------- scopes ----------
class Scope {
  constructor(parent) { this.parent = parent; this.names = new Set(); }
  has(n) {
    for (let s = this; s; s = s.parent) if (s.names.has(n)) return true;
    return false;
  }
}

const isNode = (v) => v && typeof v === 'object' && typeof v.type === 'string';
const isFunction = (n) => n.type === 'FunctionDeclaration'
  || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
const isClass = (n) => n.type === 'ClassDeclaration' || n.type === 'ClassExpression';
const SKIP_KEYS = new Set(['type', 'loc', 'start', 'end']);

function children(node, fn) {
  for (const k in node) {
    if (SKIP_KEYS.has(k)) continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (isNode(c)) fn(c); }
    else if (isNode(v)) fn(v);
  }
}

// Names a binding pattern declares: `a`, `{a, b: c}`, `[a, ...rest]`, `a = 1`.
function bound(p, out = []) {
  if (!p) return out;
  switch (p.type) {
    case 'Identifier': out.push(p.name); break;
    case 'ObjectPattern':
      for (const pr of p.properties) bound(pr.type === 'RestElement' ? pr.argument : pr.value, out);
      break;
    case 'ArrayPattern': for (const el of p.elements) bound(el, out); break;
    case 'RestElement': bound(p.argument, out); break;
    case 'AssignmentPattern': bound(p.left, out); break;
  }
  return out;
}

// Expressions hiding inside a pattern: default values and computed keys.
function patternRefs(p, scope, report) {
  if (!p) return;
  switch (p.type) {
    case 'ObjectPattern':
      for (const pr of p.properties) {
        if (pr.type === 'RestElement') { patternRefs(pr.argument, scope, report); continue; }
        if (pr.computed) visit(pr.key, scope, report);
        patternRefs(pr.value, scope, report);
      }
      break;
    case 'ArrayPattern': for (const el of p.elements) patternRefs(el, scope, report); break;
    case 'RestElement': patternRefs(p.argument, scope, report); break;
    case 'AssignmentPattern':
      patternRefs(p.left, scope, report);
      visit(p.right, scope, report);
      break;
    case 'MemberExpression': visit(p, scope, report); break; // ({ a: obj.x } = ...)
    case 'Identifier': if (!scope.has(p.name)) report(p); break; // assignment target
  }
}

// `var` is function-scoped: collect every one in a body without entering
// nested functions or classes.
function hoistVars(node, scope) {
  if (node.type === 'VariableDeclaration' && node.kind === 'var') {
    for (const d of node.declarations) bound(d.id).forEach((n) => scope.names.add(n));
  }
  children(node, (c) => { if (!isFunction(c) && !isClass(c)) hoistVars(c, scope); });
}

// let/const/class/function/import are visible throughout their block.
function hoistBlock(statements, scope) {
  for (let s of statements) {
    if (s.type === 'ExportNamedDeclaration' || s.type === 'ExportDefaultDeclaration') s = s.declaration;
    if (!s) continue;
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') {
      for (const d of s.declarations) bound(d.id).forEach((n) => scope.names.add(n));
    } else if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id) {
      scope.names.add(s.id.name);
    } else if (s.type === 'ImportDeclaration') {
      for (const sp of s.specifiers) scope.names.add(sp.local.name);
    }
  }
}

function visitFunction(fn, outer, report) {
  const scope = new Scope(outer);
  if (fn.type === 'FunctionExpression' && fn.id) scope.names.add(fn.id.name);
  if (fn.type !== 'ArrowFunctionExpression') scope.names.add('arguments');
  for (const p of fn.params) bound(p).forEach((n) => scope.names.add(n));
  for (const p of fn.params) patternRefs(p, scope, report);
  if (fn.body.type === 'BlockStatement') {
    hoistVars(fn.body, scope);
    hoistBlock(fn.body.body, scope);
    for (const s of fn.body.body) visit(s, scope, report);
  } else {
    visit(fn.body, scope, report);
  }
}

function visitBlock(statements, outer, report) {
  const scope = new Scope(outer);
  hoistBlock(statements, scope);
  for (const s of statements) visit(s, scope, report);
}

function visit(node, scope, report) {
  if (!isNode(node)) return;
  switch (node.type) {
    case 'Identifier':
      if (!scope.has(node.name)) report(node);
      return;
    case 'Program':
      hoistVars(node, scope);
      hoistBlock(node.body, scope);
      for (const s of node.body) visit(s, scope, report);
      return;
    case 'ImportDeclaration': case 'ExportAllDeclaration':
    case 'Literal': case 'TemplateElement': case 'ThisExpression': case 'Super':
    case 'MetaProperty': case 'PrivateIdentifier': case 'BreakStatement':
    case 'ContinueStatement': case 'EmptyStatement': case 'DebuggerStatement':
      return;
    case 'ExportNamedDeclaration':
      if (node.declaration) visit(node.declaration, scope, report);
      else if (!node.source) for (const sp of node.specifiers) visit(sp.local, scope, report);
      return;
    case 'ExportDefaultDeclaration':
      visit(node.declaration, scope, report);
      return;
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
      visitFunction(node, scope, report);
      return;
    case 'ClassDeclaration': case 'ClassExpression': {
      const cls = new Scope(scope);
      if (node.id) cls.names.add(node.id.name);
      visit(node.superClass, cls, report);
      for (const m of node.body.body) {
        if (m.type === 'StaticBlock') { visitBlock(m.body, cls, report); continue; }
        if (m.computed) visit(m.key, cls, report);
        visit(m.value, cls, report);
      }
      return;
    }
    case 'VariableDeclaration':
      for (const d of node.declarations) {
        patternRefs(d.id.type === 'Identifier' ? null : d.id, scope, report);
        visit(d.init, scope, report);
      }
      return;
    case 'BlockStatement': case 'StaticBlock':
      visitBlock(node.body, scope, report);
      return;
    case 'ForStatement': {
      const loop = new Scope(scope);
      if (node.init?.type === 'VariableDeclaration') {
        for (const d of node.init.declarations) bound(d.id).forEach((n) => loop.names.add(n));
      }
      visit(node.init, loop, report);
      visit(node.test, loop, report);
      visit(node.update, loop, report);
      visit(node.body, loop, report);
      return;
    }
    case 'ForInStatement': case 'ForOfStatement': {
      const loop = new Scope(scope);
      if (node.left.type === 'VariableDeclaration') {
        for (const d of node.left.declarations) {
          bound(d.id).forEach((n) => loop.names.add(n));
          patternRefs(d.id.type === 'Identifier' ? null : d.id, loop, report);
        }
      } else {
        patternRefs(node.left, loop, report);
      }
      visit(node.right, scope, report);
      visit(node.body, loop, report);
      return;
    }
    case 'SwitchStatement': {
      visit(node.discriminant, scope, report);
      const sw = new Scope(scope);
      for (const c of node.cases) hoistBlock(c.consequent, sw);
      for (const c of node.cases) {
        visit(c.test, sw, report);
        for (const s of c.consequent) visit(s, sw, report);
      }
      return;
    }
    case 'CatchClause': {
      const c = new Scope(scope);
      bound(node.param).forEach((n) => c.names.add(n));
      patternRefs(node.param?.type === 'Identifier' ? null : node.param, c, report);
      visit(node.body, c, report);
      return;
    }
    case 'MemberExpression':
      visit(node.object, scope, report);
      if (node.computed) visit(node.property, scope, report);
      return;
    case 'Property': case 'PropertyDefinition': case 'MethodDefinition':
      if (node.computed) visit(node.key, scope, report);
      visit(node.value, scope, report);
      return;
    case 'LabeledStatement':
      visit(node.body, scope, report);
      return;
    case 'UnaryExpression':
      // `typeof x` never throws on an undeclared x; that is how feature tests work
      if (node.operator === 'typeof' && node.argument.type === 'Identifier') return;
      break;
    case 'AssignmentExpression':
      if (node.left.type === 'ObjectPattern' || node.left.type === 'ArrayPattern') {
        patternRefs(node.left, scope, report);
      } else {
        visit(node.left, scope, report);
      }
      visit(node.right, scope, report);
      return;
  }
  children(node, (c) => visit(c, scope, report));
}

// ---------- modules and their exports ----------
const parsed = new Map(); // absolute path -> AST, or null when the parse failed
const problems = [];

function load(file) {
  if (parsed.has(file)) return parsed.get(file);
  let ast = null;
  try {
    ast = parse(readFileSync(file, 'utf8'), {
      ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true,
    });
  } catch (e) {
    problems.push(`${rel(file)}: does not parse: ${e.message}`);
  }
  parsed.set(file, ast);
  return ast;
}

const exportCache = new Map();
function exportsOf(file, seen = new Set()) {
  if (exportCache.has(file)) return exportCache.get(file);
  const names = new Set();
  if (seen.has(file)) return names;
  seen.add(file);
  const ast = load(file);
  if (!ast) return names;
  for (const s of ast.body) {
    if (s.type === 'ExportNamedDeclaration') {
      const d = s.declaration;
      if (d?.type === 'VariableDeclaration') d.declarations.forEach((x) => bound(x.id).forEach((n) => names.add(n)));
      else if (d?.id) names.add(d.id.name);
      for (const sp of s.specifiers) names.add(sp.exported.name ?? sp.exported.value);
    } else if (s.type === 'ExportDefaultDeclaration') {
      names.add('default');
    } else if (s.type === 'ExportAllDeclaration') {
      if (s.exported) names.add(s.exported.name ?? s.exported.value);
      else {
        const target = join(dirname(file), s.source.value);
        for (const n of exportsOf(target, seen)) if (n !== 'default') names.add(n);
      }
    }
  }
  exportCache.set(file, names);
  return names;
}

function checkImports(file, ast) {
  const where = (n) => `${rel(file)}:${n.loc.start.line}`;
  const target = (spec) => join(dirname(file), spec);

  for (const s of ast.body) {
    const isReexport = (s.type === 'ExportNamedDeclaration' && s.source) || s.type === 'ExportAllDeclaration';
    if (s.type !== 'ImportDeclaration' && !isReexport) continue;
    const spec = s.source.value;
    if (!spec.startsWith('.')) continue;
    const t = target(spec);
    if (!existsSync(t)) { problems.push(`${where(s)}: imports ${spec}, which does not exist`); continue; }
    const have = exportsOf(t);
    for (const sp of s.specifiers ?? []) {
      let want = null;
      if (sp.type === 'ImportSpecifier') want = sp.imported.name ?? sp.imported.value;
      else if (sp.type === 'ImportDefaultSpecifier') want = 'default';
      else if (sp.type === 'ExportSpecifier') want = sp.local.name ?? sp.local.value;
      if (want && !have.has(want)) problems.push(`${where(s)}: imports '${want}' from ${spec}, which does not export it`);
    }
  }

  // dynamic import('./dev/editor.js') and the like
  const walk = (n) => {
    if (n.type === 'ImportExpression' && n.source.type === 'Literal') {
      const spec = String(n.source.value);
      if (spec.startsWith('.') && !existsSync(target(spec))) {
        problems.push(`${where(n)}: import('${spec}') points at a file that does not exist`);
      }
    }
    children(n, walk);
  };
  walk(ast);
}

// ---------- run ----------
function listJs(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) out.push(...listJs(full));
    else if (n.endsWith('.js')) out.push(full);
  }
  return out.sort();
}

const files = listJs(srcDir);
let undeclared = 0;
for (const file of files) {
  const ast = load(file);
  if (!ast) continue;
  const seen = new Set(); // one line per name per file
  visit(ast, new Scope(null), (id) => {
    if (allowed(id.name)) return;
    undeclared++;
    const key = id.name;
    if (seen.has(key)) return;
    seen.add(key);
    problems.push(`${rel(file)}:${id.loc.start.line}: '${id.name}' is used but never declared or imported`);
  });
  checkImports(file, ast);
}

for (const p of problems) console.log(p);
if (problems.length) {
  console.log(`undeclared: ${problems.length} problem(s) in ${files.length} files (${undeclared} undeclared reference(s))`);
  process.exit(1);
}
console.log(`undeclared: OK (${files.length} files, every name declared, every import resolves)`);
