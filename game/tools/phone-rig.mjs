// The phone rig: play the game as an iPhone (WebKit, Safari's engine) and as an
// Android phone (Chromium), by touch, and take pictures. 2026-11-01: "create a
// way for you to be able to see how the game looks in a mobile phone ... apple
// phones as well as android phones both. each and everything should be tested
// on both."
//
// Setup, once per machine (outside the repo; the game itself has no npm):
//   mkdir ~/.towcb-rig && cd ~/.towcb-rig && echo {"name":"towcb-rig","private":true} > package.json
//   npm i playwright && npx playwright install webkit chromium
//
// Run, with the game served on 8321 (`npx serve -l 8321 game`):
//   node game/tools/phone-rig.mjs game/tools/rig/smoke.mjs
//   node game/tools/phone-rig.mjs <scenario> --devices=se,a55 --land --out=docs/shots/rig
//
// A scenario is a module whose default export is `async (r) => {}`; `r` is the
// driver below. Pictures land in <out>/<scenario>/<device>-<n>-<name>.png and
// a report (console errors, timings) in <out>/<scenario>/report.json.
// Touch is real for taps (page.touchscreen) and synthetic TouchEvents for
// drags and holds (the joystick, look, the Draw button), the same in both
// engines; the game's handlers do not check isTrusted.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const rigDir = process.env.TOWCB_RIG || join(homedir(), '.towcb-rig');
if (!existsSync(join(rigDir, 'node_modules', 'playwright'))) {
  console.error(`playwright not found in ${rigDir}. See the setup lines at the top of this file.`);
  process.exit(2);
}
const { webkit, chromium, devices } = createRequire(join(rigDir, 'package.json'))('playwright');

// The phones: the smallest and a common iPhone, a small and a midrange Android.
const PHONES = {
  se: { name: 'iPhone SE', engine: 'webkit' },
  i15: { name: 'iPhone 15', engine: 'webkit' },
  s8: { name: 'Galaxy S8', engine: 'chromium' },
  a55: { name: 'Galaxy A55', engine: 'chromium' },
};

const args = Object.fromEntries(process.argv.slice(3).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const scenarioPath = process.argv[2];
if (!scenarioPath) { console.error('usage: node game/tools/phone-rig.mjs <scenario.mjs> [--devices=se,i15,s8,a55] [--land]'); process.exit(2); }
const scenario = (await import(pathToFileURL(resolve(scenarioPath)).href)).default;
const base = args.base || 'http://localhost:8321';
const out = join(resolve(args.out || 'docs/shots/rig'), basename(scenarioPath, '.mjs'));
mkdirSync(out, { recursive: true });
const pick = (args.devices || 'se,i15,s8,a55').split(',');

// Synthetic multi-touch, injected into every page. One finger per id.
const TOUCH_KIT = () => {
  window.__rig = {
    fingers: new Map(),
    send(type, id, x, y) {
      let f = this.fingers.get(id);
      if (type === 'touchstart') {
        const target = document.elementFromPoint(x, y) || document.body;
        f = { id, target, x, y };
        this.fingers.set(id, f);
      }
      if (!f) return;
      f.x = x; f.y = y;
      // WebKit will not construct Touch objects, so every engine gets a plain
      // event carrying touch-shaped lists (the game reads only these fields)
      const mk = (g) => ({ identifier: g.id, target: g.target, clientX: g.x, clientY: g.y, pageX: g.x, pageY: g.y, screenX: g.x, screenY: g.y, force: 1 });
      const all = [...this.fingers.values()];
      const touches = (type === 'touchend' ? all.filter((g) => g !== f) : all).map(mk);
      const targetTouches = touches.filter((t) => t.target === f.target);
      const ev = new Event(type, { bubbles: true, cancelable: true, composed: true });
      Object.defineProperties(ev, { touches: { value: touches }, targetTouches: { value: targetTouches }, changedTouches: { value: [mk(f)] } });
      f.target.dispatchEvent(ev);
      if (type === 'touchend') this.fingers.delete(id);
    },
  };
};

const report = { base, started: new Date().toISOString(), devices: {} };
for (const key of pick) {
  const phone = PHONES[key];
  if (!phone) { console.error('unknown device', key); continue; }
  const desc = devices[phone.name + (args.land ? ' landscape' : '')];
  const browser = await (phone.engine === 'webkit' ? webkit : chromium).launch({
    headless: !args.headed,
    args: phone.engine === 'chromium' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [],
  });
  const ctx = await browser.newContext({ ...desc, serviceWorkers: 'block' });
  await ctx.addInitScript(TOUCH_KIT);
  const page = await ctx.newPage();
  const log = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`));
  let n = 0;
  const t0 = Date.now();
  const vp = page.viewportSize();
  const centre = async (sel) => {
    const box = await page.locator(sel).first().boundingBox({ timeout: 8000 });
    if (!box) throw new Error(`not visible: ${sel}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const touch = (type, id, x, y) => page.evaluate(([t, i, a, b]) => window.__rig.send(t, i, a, b), [type, id, x, y]);
  const r = {
    page, vp, device: key, engine: phone.engine, log,
    wait: (ms) => page.waitForTimeout(ms),
    // write a save before the game boots (fresh context: no IndexedDB copy)
    async save(obj) {
      await ctx.addInitScript((s) => { if (!sessionStorage.getItem('rig-saved')) { localStorage.setItem('towcb-save-v1', JSON.stringify({ ...s, updatedAt: Date.now() })); sessionStorage.setItem('rig-saved', '1'); } }, obj);
    },
    async saveFile(path) { await r.save(JSON.parse(readFileSync(resolve(path), 'utf8'))); },
    async go(path = '/') { await page.goto(base + path, { waitUntil: 'load' }); await page.waitForTimeout(1500); },
    // a real tap on an element (its centre) or a point
    async tap(target) {
      const p = typeof target === 'string' ? await centre(target) : target;
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(250);
    },
    async tapText(text) {
      const box = await page.getByText(text, { exact: false }).first().boundingBox({ timeout: 8000 });
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(250);
    },
    // wait until some visible text appears (narrator, hint, card, button)
    async waitText(text, timeout = 20000) {
      await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
      await page.waitForTimeout(300);
    },
    // wait for a condition in the page (G is exposed with ?dev)
    async until(fn, timeout = 20000, arg) {
      await page.waitForFunction(fn, arg, { timeout, polling: 200 });
    },
    // tap through cards and narrator boxes until none shows for `quiet` ms
    async clearCards(quiet = 2500, max = 30000) {
      const sel = '.card-overlay button:visible, .narrator:visible, .choice-box .btn:visible';
      const end = Date.now() + max;
      let calm = Date.now();
      while (Date.now() < end && Date.now() - calm < quiet) {
        if (await page.locator(sel).count()) { await r.tap(sel); await page.waitForTimeout(600); calm = Date.now(); }
        else await page.waitForTimeout(250);
      }
    },
    async exists(sel) { return (await page.locator(sel).count()) > 0 && page.locator(sel).first().isVisible(); },
    // one finger: down at a, move to b over ms, up (or held when hold=true)
    async drag(a, b, ms = 400, { id = 7, hold = false } = {}) {
      const steps = Math.max(2, Math.round(ms / 33));
      await touch('touchstart', id, a.x, a.y);
      for (let i = 1; i <= steps; i++) {
        await touch('touchmove', id, a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps);
        await page.waitForTimeout(ms / steps);
      }
      if (!hold) await touch('touchend', id, b.x, b.y);
    },
    // the joystick: push (dx, dy in -1..1) for ms
    async joy(dx, dy, ms = 1000) {
      const c = await centre('#joystick');
      const rad = 40;
      await touch('touchstart', 1, c.x, c.y);
      await touch('touchmove', 1, c.x + dx * rad, c.y + dy * rad);
      await page.waitForTimeout(ms);
      await touch('touchend', 1, c.x + dx * rad, c.y + dy * rad);
    },
    // look: a drag across the right side of the world
    async look(dx, dy = 0, ms = 400) {
      const a = { x: vp.width * 0.7, y: vp.height * 0.45 };
      await r.drag(a, { x: a.x + dx, y: a.y + dy }, ms, { id: 3 });
    },
    // press and hold an element, optionally dragging the finger, then let go
    async hold(sel, ms = 800, move = null) {
      const c = await centre(sel);
      await touch('touchstart', 5, c.x, c.y);
      if (move) await r.drag(c, { x: c.x + move.x, y: c.y + move.y }, ms, { id: 5, hold: true });
      else await page.waitForTimeout(ms);
      await touch('touchend', 5, c.x + (move?.x ?? 0), c.y + (move?.y ?? 0));
    },
    // press and hold with pointer events (pointerType touch), for controls
    // that listen to pointers (the bow's Draw button); the finger may move
    async press(sel, ms = 800, move = null) {
      const c = await centre(sel);
      const steps = Math.max(2, Math.round(ms / 33));
      await page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        window.__rigPress = el;
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons: 1 }));
      }, [c.x, c.y]);
      for (let i = 1; i <= steps; i++) {
        const x = c.x + (move?.x ?? 0) * i / steps, y = c.y + (move?.y ?? 0) * i / steps;
        await page.evaluate(([x, y]) => window.__rigPress.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons: 1 })), [x, y]);
        await page.waitForTimeout(ms / steps);
      }
      await page.evaluate(([x, y]) => window.__rigPress.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y })), [c.x + (move?.x ?? 0), c.y + (move?.y ?? 0)]);
    },
    async shot(name) {
      n++;
      const file = join(out, `${key}-${String(n).padStart(2, '0')}-${name}.png`);
      await page.screenshot({ path: file, timeout: 30000 });
      return file;
    },
    eval: (fn, arg) => page.evaluate(fn, arg),
  };
  let error = null;
  try { await scenario(r); } catch (e) { error = String(e?.stack || e); }
  report.devices[key] = { phone: phone.name, engine: phone.engine, viewport: vp, seconds: Math.round((Date.now() - t0) / 1000), error, log };
  console.log(`${key} (${phone.name}, ${phone.engine}) ${error ? 'FAILED: ' + error.split('\n')[0] : 'ok'}, ${log.length} console errors/warnings, ${n} pictures`);
  await browser.close();
}
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log('pictures and report in', out);
