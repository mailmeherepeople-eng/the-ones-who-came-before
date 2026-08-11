// Retrieval practice, dressed as conversation.
//
// The game was already good at making things HAPPEN to a player and bad at
// making them produce anything back. Experience encodes; only retrieval
// consolidates, and an exam asks for retrieval. This module is the bridge.
//
// FOUR RULES, all of them load-bearing:
//
//  1. SPACED. Ask about something from fifteen minutes ago, never thirty
//     seconds ago. A question asked immediately after its own narrator box
//     tests short-term memory and teaches nothing. recallBeat() drains the
//     retry queue from an EARLIER slot before asking the current one, so the
//     spacing happens whether or not a caller thinks about it.
//  2. NO PENALTY. Nothing is scored against the player, nothing is locked, and
//     a wrong answer costs only the time it takes to read the correction.
//     Fear of being wrong suppresses the guessing that retrieval depends on.
//  3. CORRECTIVE FEEDBACK ALWAYS. A wrong answer that is not corrected is a
//     wrong answer rehearsed. The right answer is always stated afterwards,
//     and always in the codex's own words so the phrasing the student meets
//     twice is the same phrasing.
//  4. IN FICTION. The elder asks you to explain something to a younger member
//     of the band. Nobody in this game ever says "quiz".
//
// ISOLATION RULE: no imports from src/acts/. Acts call in.

import { S } from './strings.js';
import { Save } from './save.js';
import { SFX } from './audio.js';
import { codexEntry, codexText, master } from './codex.js';

// Missed questions, waiting for a later slot. Deliberately module state and
// deliberately NOT persisted: a re-ask is a within-session affordance, and
// restoring a stale queue after a resume would drop an unexplained question on
// a player who has lost the context that made it fair.
const retryQueue = [];

export function pendingRecallCount() { return retryQueue.length; }

// Fisher-Yates over a copy. Shuffling matters on the RE-ASK: without it a
// student who missed the question can recover the answer from where the button
// sat last time instead of from the fact.
function shuffled(options, answer) {
  const idx = options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { options: idx.map((i) => options[i]), answer: idx.indexOf(answer) };
}

async function ask(G, spec, isRetry) {
  const entry = codexEntry(spec.id);
  if (!entry) { console.warn('recall: unknown codex entry', spec.id); return false; }
  const text = codexText(spec.id);

  const { options, answer } = shuffled(spec.options, spec.answer);
  const title = isRetry ? `${S.recall.again} ${spec.question}` : spec.question;
  const pick = await G.hud.choice(title, options);
  const right = pick === answer;

  Save.recordRecall(entry.syllabus, right);

  if (right) {
    SFX.success?.();
    master(G, spec.id);
    // The restatement rides on the moment of successful retrieval, which is
    // when it sticks hardest. A toast, so a correct answer never costs a tap.
    G.hud.toast(`✓ ${text?.tells ?? ''}`.trim(), 5200);
  } else {
    SFX.trick?.();
    // Blocking, and it should be: this is the one line in the exchange the
    // player has to actually read.
    await G.hud.narrator(`${S.recall.notQuite} ${options[answer]}. ${text?.tells ?? ''}`.trim());
    // One more chance, later, somewhere else. Never twice for the same miss.
    if (!isRetry) retryQueue.push(spec);
  }
  return right;
}

// The only entry point an act should call.
//
// Drains one earlier miss first (that is the spacing), then asks this slot's
// question. Guarded against asking the same entry twice in a row, which would
// turn a spaced re-ask back into an immediate one.
export async function recallBeat(G, spec) {
  const i = retryQueue.findIndex((r) => r.id !== spec.id);
  if (i >= 0) {
    const [retry] = retryQueue.splice(i, 1);
    await ask(G, retry, true);
  }
  return ask(G, spec, false);
}

// Called once at the end of an act: anything still missed gets its second
// chance rather than silently expiring, so "asked" and "correct" in the export
// describe a fair test.
export async function flushRecall(G) {
  while (retryQueue.length) {
    const spec = retryQueue.shift();
    await ask(G, spec, true);
  }
}
