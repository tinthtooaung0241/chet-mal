# Kitchen Co-op roadmap

What to build next, in order. Each item is small enough to ship on its own.

## Where the game stands

**What already works**

- The hook is unique: each chef perceives different things (tickets are seen, phone orders are
  heard, the head chef doesn't cook), so talking to each other *is* the game.
- Dishes take real skill: seasoning before or after cooking, the perfect sizzle you hear,
  cold food, spoiled produce.
- Chaos changes who leads: in a power cut everyone talks; in a storm everyone watches the deaf
  chef.
- Short 3-minute shifts, with stars, coins, upgrades, a second restaurant and a daily special.

**What holds the fun back**, biggest first:

1. **Every kitchen has the same layout.** Both restaurants use one grid. After a few shifts the
   routes are solved and the teamwork stops changing. In a co-op cooking game, the layout is
   the puzzle.
2. **You can't see why you scored what you did.** The end screen shows one score, not what
   earned points or what lost them.
3. **Every customer is the same.** Nothing makes one shift more memorable than another.
4. **Little to chase after three stars.** There are 30 stars, then only the daily special.
   Coins stop mattering once the five upgrades (420 coins) are bought, which takes about three
   shifts.
5. **Solo players never meet the roles.** The best part, teamwork between the deaf, mute and
   head chefs, needs two or three friends online at once. There are no bots and no quick match.
6. **Little juice.** Serving gives a toast and confetti. No points fly out of the pass, combos
   don't build up, there's no music, and mistakes are never funny.
7. **The sink does nothing**, and a dropped connection means refreshing the page.

## Now (this round)

- **Shift report.** The end screen lists where the points came from (dishes, speed, perfect,
  seasoning, combos, rush hour and critics) and what lost them (customers who left, sick
  customers), plus one tip for next time.
- **Food critic.** From level 4, a critic visits once a shift.
  - They wait less than other customers.
  - A dish seasoned just right and served before their ticket turns red gets a rave review:
    +25 points, and they pay their bill twice over.
  - If the critic walks out, it costs 20 points.
  - New daily twist: *Critics in town* (two critics).
- **Sticker album.** 23 stickers (now 25) for moments: a first perfect dish, a 6× combo, cooking
  in the dark, a rave review, no lost customers, a 7-day streak, three stars everywhere. Each one
  pops as a toast and fills the album in the play menu.
- **First run.** The first *Let's Play* starts the tutorial, unless you came from an invite
  link.
- **Docs.** `docs/GAME_DESIGN.md` describes the game as it is now: roles, senses, the shift,
  scoring and pressure, with the real numbers.

## 1. Make every shift feel different (done)

1. **Layouts per level.** Four layouts of the same room:
   - **usual:** levels 1–3 and 7;
   - **island:** the boards on an island (levels 4 and 8);
   - **split:** a wall of counters between prep and cooking (levels 5 and 9);
   - **corridor:** the stoves behind a long counter (levels 6 and 10).

   The briefing card names a new layout.
2. **Dish washing** (from level 5, except 7).
   - The racks start with 4 plates and 3 bowls.
   - Every eaten or wasted dish comes back dirty, and stacks up by the sink.
   - Hold F at the sink to wash (1.5 s each). Anyone can, the head chef too.
3. **Kitchen mishaps.**
   - From level 2: burnt food left on a stove for 8 s catches fire. That costs 10 points, and
     the fire spreads to the next stove after 12 s. Hold F at it to smother it.
   - From level 6: once a shift, oil spills on the floor and slows anyone in it to under half
     speed. Hold F on it to mop.
4. **Kids** (from level 3): one customer in five wants the dish with no seasoning at all. Their
   ticket says "Kid", and they're drawn smaller.
5. **Juice.**
   - Points float up from the pass, in red when something costs points.
   - The clock beats and ticks through the last 10 seconds.
6. **Music.** A cozy loop made in Web Audio. It speeds up in rush hour and in the last 30 s, and
   is silent in storms and for the deaf chef. Settings has Off, Low and On.
7. **Two new stickers**, Firefighter and Squeaky clean, make 25 in all.

Not done from this section: groups and regulars (customer types that need linked orders, or
memory across shifts).

## 2. Things to chase (mostly done)

1. **Chef looks.** Hats are in the shop and everyone in the kitchen sees them:
   - the chef's toque (free, in any colour);
   - a bobble beanie (60 coins);
   - a diner cap (80 coins);
   - a golden crown (12 stickers).

   Hats come in 8 pastel colours. No aprons.
2. **Terrace decor.** Flower boxes, potted palms, paper lanterns and a chalkboard sign, from 40
   to 90 coins. They're built from simple shapes, and you see your own decor.
3. **Overtime.** A 3-star shift keeps going after the bell, getting busier, until a customer gives
   up (or 2 minutes). The clock counts up in mint, and each level keeps its high score.
4. **More daily twists.** Picky eaters (seasoning mistakes cost double), Phone frenzy (three
   orders in four by phone) and Half the menu (two dishes, much busier) make 9 twists. None
   repeats two days running.
5. **Still to do:**
   - a third restaurant (needs a new 3D room in Blender);
   - the weekly board (needs a backend account you'd create, e.g. Supabase).

## 3. Co-op for everyone (done)

1. **Helper bot.** Turn it on in *Restaurant & Shift*. A porter joins your shift, solo or in an
   empty seat of a kitchen you host. It:
   - puts out fires;
   - mops spills;
   - washes up;
   - otherwise fetches and chops what the orders need, leaving it on the boards.

   It never cooks, plates or serves, and it doesn't raise the crew's star goals.
2. **Quick Play.** A button on the play menu puts you in any open kitchen that's waiting for
   chefs, or opens one for others to find.
3. **Auto-reconnect.** A dropped connection retries six times (1 to 8 s apart).
   - In a shift, the server gives you your seat back.
   - In the waiting room, you come back to the same kitchen as a new player.
4. **TURN for voice.** Set `VITE_TURN_URL`, `VITE_TURN_USERNAME` and `VITE_TURN_CREDENTIAL` when
   building. This needs an account you create (Cloudflare Calls, Twilio, metered.ca or coturn).
5. **Pings name a dish.** A ping names what you're holding, or else what's on the station you
   point at. The mute chef can sign "this soup is ready" without a word.

## 4. Polish and access (done)

1. **Settings.** Each is a choice of a few levels, remembered in the browser:
   - music, sounds and voices (Off, Low or On);
   - text size (Normal or Large);
   - graphics (Auto, Fast or Sharp). Fast draws fewer pixels and turns shadows off, and Auto
     picks Fast on phones;
   - motion (Full or Less). Less stills the animations and the title camera, and it starts that
     way when the system asks for reduced motion.
2. **Level map.** *Your shift* shows each restaurant's shifts as cards with their best stars and
   kitchen layout, instead of a dropdown.
3. **Labels on phones.** Short words under the icon-only buttons: Hand, Recipes, Menu, Ping,
   Bell, Signs. The chop button now says Hold, since it also washes, mops and puts out fires.
4. **Production server build.** `npm run build` also bundles the server with esbuild, and
   `npm run start:prod` runs it with plain Node.

## Next ideas

- A third restaurant (a new 3D room in Blender).
- The weekly kitchen board (a small backend; needs an account you create).
- Group and regular customers.
- Smarter bots: a cook bot for two-player kitchens.

## Watch with analytics (PostHog)

`shift_start` and `shift_end` record level, stars, twist and players. Use them to tune:

- Star goals for one, two and three chefs.
- Rush hour pay and length, and the 30 s combo window.
- How often critics rave, and how often they walk out.
- How often each daily twist is finished with a star.
- Which stickers almost nobody gets: too hard, or hidden.

## Done before

- **Refactor.**
  - `main.ts` is split into small modules: title screen, settings, how to play, shift briefing,
    shop, sign wheel, power cut and storm. Every menu follows one pause rule.
  - One storage helper replaces the copied try/catch blocks.
  - `style.css` lost about 1,500 dead lines, with identical computed styles.
- **Combos, rush hour and crew size.**
  - Dishes served within 30 s of each other earn +5 to +20 each.
  - From level 3, rush hour brings twice the orders at 1.5× pay.
  - Three chefs get busier kitchens and higher star goals.
- **Charm rebalance and team awards.**
  - Charm adds 8 s and then rests for 35 s.
  - Each chef gets an award at the end of a shift.
- **Daily special.** One shift a day with a twist. The first finish pays bonus coins, more for a
  streak.
