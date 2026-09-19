// One owner for a modal's input, focus and disposable work. Nested panels
// release in either order without handing movement back too early.
const stacks = new WeakMap();
export function activity(root, el, input = null) {
  input ??= root.gameInput;
  let stack = stacks.get(root);
  if (!stack) { stack = []; stacks.set(root, stack); }
  const previous = document.activeElement;
  const cleanups = [];
  const controller = new AbortController();
  const state = { el, input, wasEnabled: input?.enabled, previous };
  if (!stack.length && input) root._activityInputEnabled = input.enabled;
  stack.push(state);
  root.dataset.modal = 'true';
  input?.setEnabled(false);
  document.exitPointerLock?.();
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.tabIndex = -1;
  let closed = false;
  const controls = () => [...el.querySelectorAll('button, input, select, textarea, [tabindex="0"]')]
    .filter(n => !n.disabled && n.getClientRects().length);
  const onKey = e => {
    if (stack.at(-1) !== state) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const all = controls(), i = all.indexOf(document.activeElement);
      (all[(i + (e.shiftKey ? -1 : 1) + all.length) % all.length] ?? el).focus();
    }
    // World controls and older dialogs must not consume this modal's keys.
    if (['Tab', 'KeyE', 'Space', 'Enter'].includes(e.code) && e.target !== el) e.stopPropagation();
  };
  el.addEventListener('keydown', onKey);
  queueMicrotask(() => { if (!closed && el.isConnected) (controls()[0] ?? el).focus(); });
  return {
    signal: controller.signal,
    cleanup(fn) { cleanups.push(fn); return fn; },
    timeout(fn, ms) { const id = setTimeout(fn, ms); cleanups.push(() => clearTimeout(id)); return id; },
    close() {
      if (closed) return;
      closed = true;
      controller.abort();
      cleanups.splice(0).reverse().forEach(fn => fn());
      el.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(state), 1);
      if (!stack.length) {
        delete root.dataset.modal;
        input?.setEnabled(root._activityInputEnabled ?? state.wasEnabled ?? true);
        input?.clearEdges();
        if (previous?.isConnected) previous.focus?.();
      } else {
        input?.setEnabled(false);
        stack.at(-1).el.focus();
      }
    },
  };
}
