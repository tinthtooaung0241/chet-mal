# Kitchen Co-op

A web co-op cooking game for three friends, won by talking: a **head chef** who runs the pass (sees every order and how each dish is going, but doesn't cook), a **deaf chef** who cooks by sight, and a **mute chef** who cooks and hears everything but talks only with pings, signs and a bell. Nobody has all the information, so the team has to pass it around. A **blind cook** role (the whole game by sound) stays available as an accessibility option. See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

Cooking works like a real kitchen, sped up: one storage corner holds two reach-in fridges (meat and fish; dairy and greens, which go off if left out too long) and two pantry shelves (root vegetables; bread and tomatoes). Every dish is seasoned the way it really is (grilled fish with salt, lemon and herbs; fish & chips with salt and malt vinegar...) from a spice rack by the stoves holding salt, pepper, olive oil, butter, lemon, fresh herbs, soy sauce and malt vinegar. Customers walk in, sit at a table on the terrace, come to the pass for their dish, eat, then pay at the till on the pass, by cash or card as they ask (1 or 2 at the till), or storm off if their order runs out. What they pay is your restaurant's money, kept between shifts. Spend it on equipment upgrades (sharp knives, better fridge seals, copper pans, a tip jar, a neon sign) at the till or from the title screen.

**Restaurants.** The business grows from a **street food stand** to a **Burmese restaurant** in a Yangon tea-shop kitchen (mohinga, tea leaf salad, shan noodles, chicken curry, fried rice, with a topping rack of lime, peanuts, coriander, chili, garlic oil, fish sauce and turmeric). Each restaurant has its own room, stocked storage and shifts. A restaurant opens once your **total sales** (every coin ever taken at the till; spending on upgrades never lowers it) reach its goal and you've cleared the previous restaurant's last shift (its big night). In development (`npm run dev:client`) every restaurant is open so new kitchens can be tried straight away.

New players can open **How to play** or the guided **Tutorial kitchen** from the title screen: a coach shows each step of a salad with an arrow over the next station. Each level adds one new idea, introduced on a briefing card the first time you play it (reopen it with Level tips in the pause menu). Whenever you hold an ingredient or a dish, a checklist shows what that order still needs (Q reads the next step aloud).

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
| `shared/` | Pure game rules (`state.ts`), the ingredient library (`ingredients.ts`: every food and how it chops, cooks, burns, keeps cold or goes in the soup pot), recipes, restaurants and shifts (`rules.ts`), roles and senses (`roles.ts`), each restaurant's kitchen grid and storage (`layout.ts`) and network messages (`protocol.ts`). Used by both client and server. A new restaurant adds ingredients to the library, recipes and shifts to `rules.ts`, a stocked kitchen to `layout.ts`, and a room GLB under `assets/kitchen/environment/`. |
| `server/` | WebSocket game server: rooms of up to three chefs, lobby, 20 Hz authoritative kitchen, WebRTC voice signalling. |
| `client/` | Babylon.js game: view, first-person camera, role-filtered audio/text feedback, HUD, lobby, voice chat. |
| `assets/` | `kitchen_assets.blend` (source) and exported GLBs. The client picks up any GLB under `assets/kitchen/` automatically. `assets/icons/` holds UI icons rendered from the same models (the `IconStudio` scene in the .blend: cartoon outline, transparent background). |
| `assets/vendor/kenney/` | Kenney's CC0 kits (City Kit Commercial, Roads, Suburban, Nature Kit, Mini Characters; www.kenney.nl): the streets around both restaurants and the cast of chefs and customers, dressed for each restaurant in Blender. Each kit's `License.txt` is kept with it. |
| `client/src/ui/icons.ts` | The icon set: rendered model icons plus hand-drawn SVG glyphs for UI symbols. |
| `docs/` | Game design. |

## Controls

W/S walk · A/D step sideways · mouse or ←/→ look · Space/E use · 1–8 at a fridge or spice rack (or scroll / [ ] then Space) · hold F chop · H take a teammate's hand · Q describe surroundings · R recipe book · V first-person/overhead · P pause (solo) · 0–4 switch chef (solo).
Mute chef: G ping · B bell · hold T + 1–6 emotes.
