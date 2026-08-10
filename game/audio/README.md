# Audio

Drop `.m4a` files in here and list their ids in `manifest.json`. Nothing else
is required. **The game plays exactly as it does today with this folder empty**,
and keeps playing as you add one clip at a time, so there is no all-or-nothing
recording session to get through before you can test.

## Format

**AAC in an `.m4a` container.** Not Opus, deliberately: Opus is about twice as
efficient for speech, but it only decodes on iOS 17.5 and newer, and iPhone
support was a requirement. AAC plays on every phone, tablet and desktop
browser, so one export per line is all you do.

Recommended encodes:

| | Channels | Bitrate | Why |
|---|---|---|---|
| `voice/` | mono | 48 kbps | Speech has no stereo image worth 2x the bytes. |
| `sfx/` | mono | 64 kbps | Short, so size hardly matters; headroom for transients. |
| `music/` | stereo | 96 kbps | The one place stereo earns its keep. |

With ffmpeg:

```
ffmpeg -i line.wav -ac 1 -c:a aac -b:a 48k voice/act1.wake.m4a
ffmpeg -i track.wav -ac 2 -c:a aac -b:a 96k music/act1.camp.m4a
```

A fully voiced Act 1 lands around 2.5 MB of narration plus roughly 1.5 MB for a
90 second music loop. Nothing is fetched at boot, so none of that touches
startup time.

## Naming

### `voice/` — the id IS the strings.js key path

Every narration line is looked up by its own text, so the filename is just
where that string lives in `src/strings.js`:

```
S.act1.wake            ->  voice/act1.wake.m4a
S.act1.storeLesson     ->  voice/act1.storeLesson.m4a
S.act1.returnBowDone   ->  voice/act1.returnBowDone.m4a
```

Nothing in the act scripts changes when you add a clip. Record it, name it,
list it, and that line is narrated.

Two lines cannot be resolved this way and need an explicit id passed at the
call site: strings built from a template (`p3_challenge(a, b)` and similar,
which have no fixed text), and the rarer case of two keys holding the exact
same sentence, where the first one wins.

### `sfx/` and `music/` — you choose the id

Whatever you list in `manifest.json`, e.g. `sfx/bow-loose`, `music/act1.camp`.
Play them with `Sound.playSfx('bow-loose')` and
`Sound.playMusic('act1.camp')`.

## What a voiced line does differently

A narrator box with a clip **narrates and then closes itself**, with a thin
progress line along the bottom edge so the player can see it is running. A tap
still skips ahead at any point. A line with no clip behaves exactly as it
always has: it waits for a tap.

So pacing is set by how you read the line, not by how fast the player taps.

## Notes worth knowing

- **Voice and music stream; only short SFX are decoded.** Decoded audio costs
  about 192 KB per second of RAM, so decoding seven minutes of narration would
  cost ~80 MB on a phone. Streaming keeps that near zero.
- **One volume path.** Both file audio and the synthesised ambience run through
  the same master gain, so the Sound and Music settings cover everything.
- **Offline.** `sw.js` is network-first, so a clip is cached the first time it
  plays and works offline from the second playthrough. That is deliberate: it
  keeps the first load free of a multi-megabyte download.
- **The synth ambience stays.** Wind and birds are generated, cost no bytes,
  and are always there. Music layers over them.
