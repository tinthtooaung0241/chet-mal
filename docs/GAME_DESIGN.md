# Kitchen Co-op — Game Design

Three friends run one kitchen. One chef is blind, one is deaf, one can't speak. Nobody has all the information, and every chef has something nobody else has. Most of the fun is in passing information between the three of them.

Inspirations: *Overcooked* (kitchen chaos), *Keep Talking and Nobody Explodes* (split information that has to be talked through), *Spaceteam* (shouting under pressure).

---

## 1. Design pillars

1. **Every chef is the best at something.** Each role is built around a strength, not a missing sense. If a role has nothing only it can do, the design is wrong.
2. **Information is split by sense.** Each order, timer and danger reaches the kitchen through sight or sound (sometimes both). Whoever perceives it has to get it to whoever needs it.
3. **Limits on communication drive the gameplay.** The comedy and tension come from relaying information under time pressure. The cooking itself stays simple.
4. **Each role is fully playable by someone who has that disability.** A blind player can play the blind chef by audio alone. A deaf player can play the deaf chef with no sound. A player who doesn't speak never needs a microphone. Players without disabilities get the same experience because the game filters their senses for them.

---

## 2. The three chefs

| | Blind chef — *the Listener* | Deaf chef — *the Watcher* | Mute chef — *the Signaler* |
|---|---|---|---|
| **Perceives** | Sound only (game audio + voice chat) | Sight only (no game audio, no voice) | Sight **and** sound — the only one who gets everything |
| **Can say** | Voice | Voice | No voice: pings, emote wheel, bell, whiteboard |
| **Superpower** | Perfect hearing: hears the *perfect* sizzle, phone orders, hidden pests, impatient customers | Eagle eye: reads tickets and the recipe book, spots mould, judges plating | Fastest hands (chops and plates fastest), and is the team's translator |
| **Natural station** | Stove / grill | Pass: reading tickets, plating, serving | Prep: chopping and running food |
| **Gets help with** | Finding things and knowing what's on the ticket | Anything that only makes a sound | Getting their knowledge across quickly |

### Who can talk to whom

| from ↓ / to → | Blind | Deaf | Mute |
|---|---|---|---|
| **Blind** | — | ✘ (except lip-reading up close, see §6) | ✔ voice |
| **Deaf** | ✔ voice | — | ✔ voice |
| **Mute** | ✔ bell / knocks / hand-lead | ✔ pings / emotes / pointing | — |

Each pair has *some* channel, but no single chef has every channel. The deaf chef can broadcast to everyone but can't receive voice. The mute chef receives everything but can only send signals. The blind chef can't tell the deaf chef anything directly, so the mute chef usually relays between them.

---

## 3. Information is tagged by sense

Every piece of game information has a source:

| Information | Sense | Who gets it directly |
|---|---|---|
| **Ticket orders** (from the printer) | sight | Deaf, Mute |
| **Phone orders** (customer calls in) | sound | Blind, Mute |
| Cooking colour (raw → brown → black) | sight | Deaf, Mute |
| **Perfect sizzle window** (bonus timing) | sound only | Blind (best ear), Mute |
| Oven *ding* (timer done) | sound only | Blind, Mute |
| Smoke / flames | sight + sound | everyone (fire is never single-channel) |
| Mouldy ingredient | sight (spots) | Deaf, Mute |
| Spoiled ingredient (smell) | "sniff" action, sound cue | Blind |
| Customer patience | sound (sighs, tapping) **or** sight (face) | depends on the order |
| Pest in the kitchen | sound (scurrying) | Blind, Mute |
| Plating diagram (presentation bonus) | sight | Deaf, Mute |

This changes the current code. Today `Feedback` delivers **every** event through sound, visuals and text to the local player. Instead, each event carries a `senses` tag, and each client **filters by role** before presenting:

- **Blind client:** perceives `sound` events and presents them as panned audio plus screen-reader text. Sight-only events never arrive.
- **Deaf client:** perceives `sight` events and presents them as visuals plus the text log. Sound-only events never arrive. Its voice chat is muted.
- **Mute client:** perceives everything. Its microphone is disabled and the ping/emote wheel replaces voice.

The text log and screen reader stay, but they only describe what that role could actually perceive.

---

## 4. Core mechanics

### 4.1 Split orders
Orders arrive two ways and the team has to merge them:
- **Ticket printer** (visual): a written ticket with a timer bar. The deaf chef usually reads it out loud.
- **Phone** (audio): the phone rings and a customer reads their order once. The blind chef can ask the mute chef to repeat it with the bell, but the phone never replays it.

Later levels mix both: *"Steak — ticket says medium, phone caller added fries."*

### 4.2 Sound-timed cooking — the blind chef's stage
- Every cookable has a **perfect window** inside "cooked", marked by a distinct sizzle pitch. Taking it off then gives a **Perfect** dish (bonus points and a star toward level rating).
- The window is **audio-only**. Sighted chefs see only cooked vs burnt colour, so they can cook fine, but only by ear can you cook perfectly.
- Burning is visible *and* audible, because danger is never single-channel.

### 4.3 Signals — the mute chef's voice
- **Ping (point):** marks a spot or item with an icon the deaf chef sees. To the blind chef it plays as a *spatial chime* from that spot, so a ping works for both.
- **Emote wheel:** 8 words: *yes, no, here, hurry, stop, done*, plus the item icon in hand. Seen by deaf. Each also has a distinct short sound for blind.
- **Bell:** a counter bell the mute chef rings. Blind and Mute hear it. Teams invent their own codes ("two rings = steak ready").
- **Whiteboard:** draw or write by the pass. The deaf chef reads it. A slow channel, but it holds a lot of detail.

### 4.4 Lead by the hand
Any chef can **take the blind chef's hand** (hold E near them). While holding hands, the blind chef is guided along at walking pace and hears a gentle pull in the guide's direction. It's the fastest way to bring the blind chef to a new station. Either chef can let go.

### 4.5 Hand-offs
Items can be passed **directly** between chefs (face each other, press use). The blind chef hears a clear "received: raw steak" cue with a unique sound per ingredient: crunch for lettuce, squish for tomato, slap for steak. Over time players learn the sounds and stop needing the text.

### 4.6 Touch and smell (blind tools)
- **Feel** (automatic on pickup): identifies the item by sound and screen-reader text.
- **Sniff** (key): tells fresh from spoiled. Spoiled food served is a big penalty. The deaf chef can catch the same problem by spotting mould. Either sense works, and both chefs are useful for it.

### 4.7 Role-reversal events
Mid-shift chaos events flip who leads, so each chef gets a hero moment:
- **Power cut:** the lights go out for 20 seconds. Everyone else is effectively blind, but the blind chef plays exactly as usual and becomes the team's guide.
- **Extractor fan breaks / thunderstorm:** a roar drowns out game sound and voice. Everyone else loses their hearing, but the deaf chef is unaffected and leads by sight.
- **Rush hour:** too many orders to talk through. Teams fall back on the mute chef's quick signals, and their pings become the fastest communication.

---

## 5. A round in practice

> 🔔 *Phone rings.* **Blind** hears: "Two steaks, and fries!" and says it out loud.
> **Mute** heard it too and pings the fridge twice with a steak icon so **Deaf** knows.
> **Deaf** reads the printer: "Salad, no onion" and says it out loud for everyone.
> **Mute** chops lettuce and tomato at double speed; **Deaf** carries steaks to the stove and hands them to **Blind**. *Slap* — "received: raw steak."
> **Blind** listens… the sizzle rises… *now*. "Steaks perfect!" **Mute** rings the bell twice; **Deaf** sees the ping on the pass, plates them to the diagram, and serves.
> *Lights flicker. Power cut.* Everyone freezes except **Blind**: "Follow my voice, I've got the stove."

---

## 6. Later ideas (not in the first build)
- **Lip-reading:** the deaf chef sees live captions of the blind chef's speech only when facing them up close. Needs speech-to-text (Web Speech API, Chrome-only).
- **Guide dog / cane upgrades** for the blind chef (echo pulses, better beacons).
- **Restaurant progression:** stars per level unlock recipes and kitchen layouts.
- **Two-player mode:** pick any two roles; the missing role's information falls back to a shared fallback channel.

---

## 7. Level structure (first five levels)

Each level teaches one mechanic (defined in `shared/src/rules.ts` → `LEVELS`):

1. **Opening day:** salad and grilled fish, tickets only. Learn hand-offs and basic roles.
2. **The grill:** steak and fish dishes. The perfect sizzle makes the blind chef the grill master.
3. **Phone lines:** phone orders appear; the team learns to relay.
4. **Bad batch:** 25% of produce is spoiled. Sighted chefs see mould; anyone can sniff (Z).
5. **Storm night:** a power cut at 0:50 (nobody can see, except the blind chef plays as usual) and a storm at 2:05 (nobody can hear, voices ducked; the deaf chef plays as usual). The role-reversal finale.

Recipes: salad, grilled fish, steak & fries, fish & chips, steak salad.
Scoring: points per dish plus a speed tip, a **Perfect** bonus (+10 per perfectly timed item, sound-only cue), −10 for an expired order, −15 for serving spoiled food. 1–3 stars per level; best stars are saved in the browser.

---

## 8. Build status

All three phases are built and tested in the browser (2026-10-20).

**Phase A — roles ✅**
- Every `GameEvent` has `senses` (sight / sound / touch) and `actors`. `perceivesEvent()` decides what reaches a chef, including the power cut and storm.
- Blind: dark screen, 3D (HRTF) sound placed around the chef, station "signature" sounds when facing them, live stove sizzles. Deaf: no game audio. Mute: ping (G), emotes (T + 1–6), bell (B).
- Perfect sizzle window and phone orders. In solo, keys 0–3 switch chef.

**Phase B — three players ✅** (two deliberate changes from the plan above)
- `shared/` workspace package holds the pure rules; `server/` runs rooms of up to three chefs.
- Server is plain WebSockets (`ws`) instead of Colyseus: with three players per room, a framework adds more to learn than it saves. Each client moves its own chef (instant feel) and the server owns everything else at 20 Hz.
- Voice is peer-to-peer WebRTC signalled through the game server instead of LiveKit: three players don't need a media server and there's no paid service. Mute sends no mic, deaf plays no voices, voices come from each chef's position.
- Lobby with four-letter kitchen codes and invite links, one chef per role, host picks the level. Hand-offs (use on a teammate), lead-by-hand (H).

**Phase C — content ✅**
- Five levels, two new recipes, spoiled food + sniff, power cut, storm with lightning, stars and best scores.

**Art ✅**
- Restaurant kitchen on a floating island (Blender, `Kitchen_Room.glb`), restyled stations, three chef characters (`assets/kitchen/characters/`) with role-coloured aprons and arms that swing for walking, carrying and chopping.

**Next ideas**
- Mute chef's whiteboard; lip-reading (§6); dish washing at the sink.
- Playtest with blind, deaf and non-speaking players, and tune timings from what they say.
- Hosting: one Node process (`npm run build && npm start`) serves the game and the WebSocket server; any host with long-lived WebSockets works (Fly.io, Railway, a VPS).
