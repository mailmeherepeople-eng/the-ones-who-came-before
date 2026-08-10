# The elder's voice

Drop the elder's `.m4a` noises in this folder, then run:

```
node game/tools/sync-audio-manifest.mjs
```

That is the whole job. No code changes, no act script changes. The folder IS
the voice: the game picks one file from here at random every time you talk to
her, and never the same one twice running.

**Until this folder has a file in it, the elder borrows `../tribe/`.** That is
deliberate, so she is never silent mid-recording-session, and she switches to
her own the moment the first file lands.

Name files lowercase with dashes (`slow-hum.m4a`, `grave-ooga-2.m4a`). Anything
needing URL-encoding is rejected by the sync tool. AAC in `.m4a`, mono, 48 kbps,
same as everything else in `game/audio/README.md`.

Any character can be pointed at any folder: `new Npc(..., { voice: 'npc/elder' })`.
By default a character created with `elder: true` uses this one, which includes
the Scene C and D chieftain. Give her `voice: 'npc/tribe'` (or a folder of her
own) if she should not sound like the Act 1 elder.
