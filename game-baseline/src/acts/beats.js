// Sequential beat runner with scene-level resume. Records are saved the
// moment they exist, so a resumed scene skips beats whose records are present.
import { Save } from '../save.js';

export async function runBeats(act, beats, resumeBeat = null) {
  // a stale/renamed beat id must not silently skip the whole act
  if (resumeBeat && !beats.some((b) => b.id === resumeBeat)) resumeBeat = null;
  let started = !resumeBeat;
  for (const b of beats) {
    if (!started) {
      if (b.id === resumeBeat) started = true;
      else continue;
    }
    Save.checkpoint(act, b.id);
    if (b.skipIf && b.skipIf()) continue;
    await b.run();
  }
}
