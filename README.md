# Kitchen Co-op

A web co-op cooking game for three friends: one chef is blind, one is deaf, and one can't speak. Nobody has all the information, so the team has to pass it around. See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

Cooking works like a real kitchen, sped up: one storage corner holds two reach-in fridges (meat and fish; dairy and greens, which go off if left out too long) and two pantry shelves (root vegetables; bread and tomatoes). Every dish is seasoned the way it really is (grilled fish with salt, lemon and herbs; fish & chips with salt and malt vinegar...) from two spice racks holding salt, pepper, olive oil, butter, lemon, fresh herbs, soy sauce and malt vinegar. Customers walk in, sit at a table on the terrace, come to the pass for their dish, eat, and leave (happy, or storming off if their order runs out).

## Run it

```bash
npm install
npm run dev:server   # game server on http://localhost:8787
npm run dev:client   # game on http://localhost:5180
```

Open http://localhost:5180, then either **Practice solo** or **Create a kitchen**, and send the invite link to two friends.

Production (one process serves the game and the server):

```bash
npm run build
npm start            # http://localhost:8787
```

## Layout

| Folder | What's in it |
|---|---|
| `shared/` | Pure game rules (`state.ts`), recipes and timings (`rules.ts`), roles and senses (`roles.ts`), the kitchen grid (`layout.ts`) and network messages (`protocol.ts`). Used by both client and server. |
| `server/` | WebSocket game server: rooms of up to three chefs, lobby, 20 Hz authoritative kitchen, WebRTC voice signalling. |
| `client/` | Babylon.js game: view, first-person camera, role-filtered audio/text feedback, HUD, lobby, voice chat. |
| `assets/` | `kitchen_assets.blend` (source) and exported GLBs. The client picks up any GLB under `assets/kitchen/` automatically. `assets/icons/` holds UI icons rendered from the same models (the `IconStudio` scene in the .blend: cartoon outline, transparent background). |
| `client/src/ui/icons.ts` | The icon set: rendered model icons plus hand-drawn SVG glyphs for UI symbols. |
| `docs/` | Game design. |

## Controls

W/S walk · A/D step sideways · mouse or ←/→ look · Space/E use · 1–8 at a fridge or spice rack (or scroll / [ ] then Space) · hold F chop · H take a teammate's hand · Q describe surroundings · R recipe book (read aloud for the blind chef) · V first-person/overhead · P pause (solo) · 0–3 switch chef (solo).
Mute chef: G ping · B bell · hold T + 1–6 emotes.
