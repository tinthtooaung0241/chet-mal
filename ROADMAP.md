# Chet Mal roadmap

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

## 5. Cozy pace (done)

*Your shift* has a **Pace** choice: **Cozy** (the default) or **Classic** (the original rush).
Online, the host's choice counts. A Cozy shift:

- lasts 1.5× as long, with orders coming 1.5× less often; rush hour, the combo window and the
  level's power cuts and storms stretch to match;
- starts with one order, and keeps one fewer open at once (never under two);
- gives customers 1.6× as long to wait, at the pass and at the till;
- gives food and soup twice as long to burn, and cold food twice as long to go off;
- has no fires or oil spills;
- shows the tutorial's coach on every shift: the most urgent order's checklist, a "Next" line and
  an arrow over the station to go to, even with empty hands.

The star goals stay the same, so stars come easier at a Cozy pace. The tutorial keeps its own
pace. `shift_start` and `shift_end` record the pace, so analytics can compare the two.

## 6. Easy to understand, still fun with friends

**The goal:** a new player understands what to do in their first minute, and a group of friends
still has to talk to win. Help should teach the job, not play the game for you.

**What already helps:** the tutorial kitchen, one new idea per level, briefing cards with a tip
for your role, the contextual key prompts (Space, F, 1–8), the dish checklist, the recipe icons on
tickets, the recipe book, the helper bot, and the Cozy pace with its coach.

**What still confuses people**, biggest first:

1. **The coach doesn't know about teammates.** At a Cozy pace it sends everyone to the most
   urgent order, so two cooks fetch the same tomato and make the same dish twice. It also gives
   the head chef steps they can't do (fetch, chop, cook).
2. **Nobody can see who's doing what.** Friends talk over each other and double up on a ticket,
   and a deaf or mute player has no quiet way to say "I've got this one".
3. **The till is a hidden job.** After eating, customers queue to pay, but nothing teaches it:
   players find out when a table leaves without paying. The head chef's description doesn't
   mention it either.
4. **Seasoning has two timings** (before or after cooking), and each slip costs 3 to 5 points.
   On a Classic shift you have to remember it from the book.
5. **What each role can't do** is in long sentences, so players learn it by being refused.
6. **Level 1 teaches two things at once** (the stove, and seasoning before cooking).

**What keeps it fun with friends** (don't lose these): information split by sense, so someone
always has to tell someone; every role has a job only they can do; short shifts with a clear team
score; mistakes that are funny rather than punishing.

**Plan**

Now (built):

- **A coach that knows the team** (Cozy, and the tutorial):
  - cooks are sent to an order nobody else is on, and skip anything a teammate is already
    carrying;
  - with a head chef in the kitchen, cooks prepare the food and leave the plating to them;
  - the head chef is coached through their own job: tell a cook what's needed, plate what's
    ready, finish and serve, wash up.
  - The coach still only knows the orders you can perceive: a deaf cook is never sent to a phone
    order, so the team still has to talk.
- **The till in the coach:** when a customer is waiting to pay, the head chef (or, without one, the
  nearest chef with free hands) is told which table, how they pay, and which key to press.
- **"Who's on it" badges:** each ticket shows a little role badge for every chef working on it,
  so friends see the split at a glance without saying a word.
- **Clearer role words:** the head chef's description and briefing now mention the till.

Also built:

- **Cozy forgives seasoning slips:** a missing, extra or mistimed spice costs no points at a Cozy
  pace; getting it right still earns the bonus (and a critic's rave still needs it right).
- **Role cards with icons** in the chef picker: sees, hears, cooks and talks, with the one a role
  can't do crossed out.
- **Level 1 teaches the stove only:** salad and a new dish, fried mushrooms (chop, fry, finish).
  Seasoning before cooking now starts on level 2, with the grilled fish and steaks.
- **Warm-up for crews:** the host of an online kitchen can start a warm-up round in the tutorial
  kitchen (one salad at a time, the coach on), where each chef does their job once. The shift
  they chose stays chosen for after.

Later:

- **Team moments:** a shared combo cheer, and a "best teamwork" line on the end screen.
- **Funny failures:** a burnt dish gets a silly face on the pass instead of only a red toast.

## 7. Polish pass: every shift plays through

**How it was checked:** a simulated player that does whatever the coach says (stepping straight
to each station) played every level, at both paces, solo, as two cooks, and as a head chef with
two cooks. Every "you can't do that" message and every loop it ran into is a gap in the rules or
the coach. `npm run test:coach` runs it again.

**Found and fixed (the coach led players into dead ends):**

1. Half-done food lying around (chopped but still to fry, raw food on a board for the soup) wasn't
   recognised. The coach sent players for a fresh one, then told them to use a board that was
   already full. Most levels stalled after the first dish.
2. Spoiled or burnt food in your hands made the coach go quiet, so nobody was told to bin it, and
   customers left the till unpaid meanwhile.
3. "Add it to the plate" pointed at any plate, even a full one or one for another dish.
4. At a Cozy pace (no fires), burnt food was never cleared, so the stoves filled up for good.
5. With a head chef, cooks left chopped food on the boards, and the boards ran out.
6. "Put it in the soup pot" was said while the pot was full, boiling or burnt; and a cook holding
   a bowl was sent to fetch vegetables with full hands.
7. Holding an empty bowl while the soup boiled, the coach said to fetch a bowl, so players put it
   back and took it again.
8. With a head chef, finished food waiting on counters filled every counter when the head chef fell
   behind. Now, when no counter is free, the pass is backed up and the cooks plate too; empty
   bowls and plates go back on their racks; and when there's truly no space, the coach says so.

Now every level plays through with no refused actions and no loops, solo and in teams.

**Flow fixes (built):**

- After an online warm-up, the end screen offers **Start the shift** (the one the host chose)
  instead of a "Play again" that started the real shift and a "Next level" that skipped to
  level 1.
- Practising as the head chef alone, the coach explains that the head chef doesn't cook, and how to
  get cooks (switch chef, or the helper bot), instead of "ask a cook" with nobody to ask.
- Plural foods read right: "The noodles are cooked. Take them off the stove!"
- **Next level** comes back on the end screen. Once a daily special, a locked restaurant or a
  0-star shift hid it, it stayed hidden for every later shift until the page was reloaded.

**Also built:**

- **The till without a dish to guide:** whoever runs the till hears about a customer waiting to
  pay even when the coach has no dish for them (a deaf cook with only phone orders, a head chef
  between dishes).
- **Idle chefs:** with free hands and nothing for them on the tickets, the coach suggests washing
  up (when there's washing), or says everything's on the go. It only counts orders that chef can
  perceive, so it never gives a phone order away to a deaf cook.
- **Online, the host picks what's next:** Play again, Next level and Start the shift are the
  host's; guests see "Waiting for the host to pick the next shift", and the server ignores a
  restart from anyone else.

**Still to do:**

- **Balance with real play:** the simulated player steps straight to stations, so its scores are
  far too high to tune star goals with. Once analytics is on (a PostHog key), compare `shift_end`
  stars by level and pace, and tune each level's goals.

## 8. A kitchen that feels real (done)

- **Seasoning goes to the food.** Take a spice bottle from the rack (keys 1–8), carry it to the
  food or dish wherever it is (a board, a counter, a stove, or a teammate's hands) and season it
  there. Swap it for another or put it back at the rack. The head chef finishes plated dishes but
  doesn't season raw ingredients. The coach and the key prompts teach the new way, and the rack's
  slot stands empty while its bottle is out.
- **Customers eat for real:** the dish they ordered goes from the pass to their hands to the table,
  then gets eaten bite by bite with a fork (or a spoon for soups and noodles): scoop, lift, chew.
  The soup goes down in the bowl, and the empty dish stays at their place while they pay and go.
  Each one gets a glass of water, and they look around while they wait (fidgeting once hungry).
- **Grabbing looks like grabbing:** things glide in a little arc between a station and the hands
  (in first person too), and the chef reaches, grasps and draws back, right hand first.
- **Dirty dishes come back by hand:** after eating, a customer carries their dirty plate or bowl
  to the till and leaves it on the self-service dirty dish counter beside it (the till call says
  so); collect from the pile there. Someone takes it to the
  sink and washes it; a wasted dish leaves a dirty plate in your hands. Nothing appears in the sink
  by itself. Dirty dishes look grimy, and the coach and the helper bot collect them.
- **The coach handles strays:** a plate or ingredient no order wants any more goes back on its rack
  or shelf, or in the bin; and held food goes to an order it can move on now (not a soup while the
  pot is busy).

## 9. Reloads don't lose the game (done)

**The decision:** the URL only carries what's worth sharing: the kitchen code (`?room=ABCD`).
Menus, dialogs and solo shifts stay out of it, so a link never opens a half-shown dialog or skips to
a locked level. Everything else lives in the tab's sessionStorage (`client/src/resume.ts`), so a
reload carries on and a new tab starts fresh.

- **Solo:** the shift is saved every 2 seconds and as the page goes away; a reload brings it back
  paused ("Welcome back! Your shift is just as you left it."). Finishing or quitting clears it.
- **Online:** the tab remembers the kitchen it has a seat in. Reloading with `?room=` rejoins
  straight away (no Join click); mid-shift the server gives back the same chef. A plain invite
  link (no seat yet) still opens the play menu with the code filled in.
- A `?room=` link beats an old solo save, and going online clears the solo save.

## 10. Balanced roles (done)

Each role now has a strength that matters every shift, not just its limit. Before, the deaf chef
only shone in storms (levels 6 and 10) and missed the perfect sizzle.

- **Head chef:** +5 points on every dish they serve (a "Presentation" line on the report).
- **Deaf chef:** chops 30% faster, and the perfect moment shimmers golden for them.
- **Mute chef:** walks 15% faster, and still charms the tables.

The chef cards, the briefing and the role badge show each strength. Watch `shift_end` by role to
tune the numbers.

## 11. The pour meter (done)

Seasoning has a skill moment. With a spice bottle by the food or a dish, hold Space (or the Use
button): the meter rises, quicker as it goes, like a shaker tipping, then bounces off the top and
back down for as long as it's held, so a missed band comes round again. Let go in the honey band for
a good pinch, on its mint line for a perfect pinch (+2 points), below it to try again, or above it
for too much (−3; free at a Cozy pace). The band moves every time, and each pinch takes about a second.

Every role gets an edge of the same size, tied to who they are:

- **Head chef, Flourish:** a 35% taller band (their seasoning is the finishing touches).
- **Mute chef, Steady hands:** a 30% slower pour.

It's visual first, so a deaf player gets all of it; hearing players also get a chime for a perfect
pinch. The client runs the meter and sends how it went with the action (`pinch` on `act`), and the
server checks it's one of the three. Settings → Seasoning meter: Off makes every pinch just right.
On phones the Use button reads "Hold to season" and works the same way (hold, let go); the meter
is a little bigger there and sits right of centre, clear of the thumbs and the top bar.

## 12. Ideas: a signature mini-game for each role (parked)

Same rules as the pour meter, so it stays fair: each is short (1–2 seconds), optional (doing it the
plain way still works at the usual level), shown on screen first with sound as a bonus (so the deaf
chef can play it), never needs talking (so the mute chef can), and pays about the same.

1. **Head chef, the plating swirl.** At the pass, a quick sauce swirl or garnish tap: stop a dot
   going round the plate rim in the honey arc. Earns presentation from +0 to +8, in place of the
   flat +5 (about the same on average, but now it's skill).
2. **Deaf chef, knife rhythm.** Tap F to a pulse ring on the board instead of holding it. Taps on
   the beat chop faster (up to their 30% edge); holding F still chops at the usual speed. All
   visual, made for the chef who can't hear.
3. **Mute chef, charm signs.** Charming the tables shows three signs over a table (say Yes, Here,
   Done); repeat them on the sign wheel. Right: +8 s for every order; quick and right: +12 s. Their
   way of talking becomes their way of winning hearts.

Built once, then taken out to keep the game easy to pick up on phones and laptops: for now the pour
meter is the only mini-game, and every role keeps its plain strength (+5 a dish, 30% faster
chopping, 15% faster walking). The rules still take a plating and charm quality
(`PLATING_POINTS`, `CHARM_SECONDS`), always "good" for now, so either can come back later.

Shared ones for later:

- **Pan toss:** a timing ring around a pan at the perfect moment, so taking food off on time is a
  visible skill for everyone (the sizzle and the shimmer still help).
- **Scrub:** at the sink, alternate A and D to wash faster than holding F.
- **Make change:** at the till, pick the right coins for a tip.

## 13. Audit: game flow and touch (planned, Nov 2026)

A full play-through on desktop (1280×800) and phones: upright (375×812), landscape (844×390) and
small landscape (667×375, iPhone SE), plus a code review of the client, rules and server. Types,
the coach check and the build all pass. Fix in this order; each step ships on its own.

### Step 1: broken things (done)

All four fixed: Shift is a game key and the touch Dash button always shows with a recharge ring;
the book shows only when open; the end screen has Menu (Solo) / Leave (online); the server checks
every message, catches errors, drops broken or oversized frames (64 KB) and ignores a second hello.

1. **The mute chef's dash never fires.** Shift isn't in the game's key list
   (`GAME_KEYS`, `client/src/main.ts:494`), so the key never counts as held. On phones the Dash
   button is also invisible and can't be tapped: side buttons only show when "ready"
   (`style.css:3586`), and nothing ever marks Dash ready.
   *Fix:* add `ShiftLeft`/`ShiftRight` to `GAME_KEYS`. Always show Dash for the mute chef, with a
   cooldown ring.
2. **On upright phones and narrow windows, the closed recipe book covers the screen.** A rule for
   screens ≤640px wide and ≥521px tall sets `#recipe-book { display: flex }` without `[open]`
   (`style.css:7101`). The title screen and menus sit on top of an empty book.
   *Fix:* `#recipe-book[open]`.
3. **No way out of the end screen.** It only offers Play again / Next level, and the menu won't
   open once the shift is over (`openMenu` needs `phase === "playing"`, `main.ts:224`). Online
   guests are stuck on "Waiting for the host". The only way back is reloading the page.
   *Fix:* add a **Menu** button (back to the play menu; online, back to the room).
4. **One bad message crashes the whole server.** `{"t":"hello"}` with no room throws in
   `msg.room.trim()` (`server/src/index.ts:191`), and nothing catches it, so every kitchen drops.
   I checked this on a test server. Also: `move` takes any value (`NaN` positions), and
   `msg.role in ROLES` accepts `"constructor"`.
   *Fix:* try/catch around the handler, check each message's fields, use `Object.hasOwn(ROLES, …)`,
   and set the WebSocket `maxPayload` to about 64 KB.

### Step 2: game flow (done)

All six fixed: chef switching is Alt + 0–3 or the menu; Leave asks for a second tap; a 0-star end
screen says "Get 1 star to open the next shift"; a chef who did nothing is "Warming up"; the asset
gallery link is dev-only; on screens 521–900px tall the logo shrinks into the corner and the play
menu sits a little lower.

5. **Number keys switch your chef in Solo.** Keys 1–3 change role when you're not quite facing a
   fridge (`main.ts:700`). The coach says "(key 2)" for a tomato, so pressing 2 slightly off-aim
   turns you into the deaf chef. *Fix:* switch chefs only from the pause menu (or with Alt).
6. **"Leave kitchen" has no confirm.** In Solo it ends the shift at once and the save is gone.
   That's easy to tap by accident on a phone. *Fix:* "Leave this shift?" confirm.
7. **0 stars hides Next level with no reason.** *Fix:* say "Get 1 star to open the next shift".
8. **"Kitchen spirit – kept everyone smiling"** goes to a chef who did nothing (`awards.ts:38`).
   *Fix:* "First shift" / "Warming up" for a chef with no stats.
9. **"Asset gallery" link in the pause menu** (`index.html:210`) is a dev tool shown to players.
   *Fix:* only in dev.
10. **The play menu card covers the logo** on 1280×800 (the Burmese subtitle and the pot are cut).
    *Fix:* move the card down or shrink the logo when the screen is short.

### Step 3: touch (done)

All twelve done. On touch, texts name the buttons (`client/src/ui/words.ts`); the coach sits in the
top strip and steps aside for the Signs wheel; a Sniff button shows up near food. Settings, Your
shift and the end screen go two columns on landscape phones, with their main button always in
reach, and the room keeps Start on screen. Play-menu buttons are at least 40–44px. How to Play and
the Controls tab have touch versions. The full-screen button moved bottom-left. iPhones get a
one-time Add to Home Screen tip. An online kitchen tries again as soon as the phone wakes or the
network returns.

11. **Keyboard words on touch.** The coach, toasts, briefing and voice say "hold F", "(key 2)",
    "Press R", "Keys 0–3 switch chefs" (`shared/src/guide.ts`, `state.ts`, `rules.ts` teach lines,
    `main.ts:426`). *Fix:* one `forTouch(text)` pass in the HUD and feedback. "hold F" becomes "hold
    the Hold button", "(key 2)" goes (the tile is tappable), "Press R" becomes "tap the book".
12. **The coach covers the middle of the screen** on landscape phones: over the crosshair and the
    floor right in front of the chef. *Fix:* on touch, put it top-centre under the score pill in
    one short line.
13. **The Signs wheel opens under the coach.** Its top row (Ping, Bell, Yes, No) is hidden.
    *Fix:* hide the coach while the wheel is open.
14. **No Sniff on touch.** Smelling food (Z) is the only way to find spoiled food in a power cut.
    *Fix:* a Sniff side button, ready when you hold or face food.
15. **"Start cooking" is off-screen in the room on landscape phones.** It sits at y≈527 on a 390px
    screen, below the chef cards and the detail panel. *Fix:* a sticky action bar (Shift ·
    Warm-up · Start) and shorter cards when the screen is short.
16. **Settings and "Your shift" need two screens of scrolling** on landscape phones (content
    ~715px in ~360px; Done is off-screen). *Fix:* two columns in landscape, sticky Done.
17. **The end screen on landscape phones:** Play again floats over the awards and it's one narrow
    column on a wide screen. *Fix:* two columns (score and report | tip and awards), buttons in a
    footer row.
18. **Tap targets under 44px.** Play-menu rows are 30–38px tall (Quick Play 30, tools 32).
    *Fix:* min 44px on touch; the tools row as icon-over-label tiles.
19. **How to Play, page 3 shows keyboard keys** that touch hides, so it shows just four words.
    The Controls tab's touch list says "Chop"/"Talk", but the buttons say "Hold"/"Signs".
    *Fix:* a touch version of the page (stick, Use, Hold, Signs) with matching words.
20. **The full-screen button sits on the logo** in landscape menus. *Fix:* nudge it, or tuck it
    into the top bar.
21. **iPhone Safari can't go full screen,** so the browser bars eat the landscape height. *Fix:*
    a one-time "Add to Home Screen to play full screen" tip on iOS.
22. **Coming back after the phone sleeps fails.** After 6 tries (~30 s) online gives up with
    "Refresh to try again" (`session.ts:143`). *Fix:* try again when the page becomes visible or
    the network comes back.

### Step 4: speed on phones (done, partly)

Done: Fast graphics (the phone default) turns off ambient occlusion, multisampling and bloom; the
room's meshes are frozen in place and Babylon no longer picks meshes on every pointer event; only
the first restaurant's room loads at the start (the other follows ~3 s after the title, or with a
"Setting up the restaurant" screen if you get there first) and the loading screen shows a
percentage; snapshots are compressed (`permessage-deflate`, about 4× smaller). Repeat visits were
already fast: built files are cached for a year. Still to do: merge the room's static meshes,
deep Babylon imports, compressed models, and sending only what changed.

23. **Fast graphics still runs the heavy effects.** SSAO (16 samples, expensive blur), 4× MSAA and
    bloom are always on (`client/src/game/look.ts:69-92`). "Fast" only lowers resolution and
    shadows (`main.ts:534`). *Fix:* in Fast (the phone default), turn SSAO off, MSAA to 1 and bloom
    off.
24. **Too many draw calls:** about 620 active meshes and 280 materials in a shift. *Fix:* freeze
    static meshes (`freezeWorldMatrix`), merge the room's static parts by material, freeze
    materials.
25. **Big first load:** about 1.2 MB of gzipped JS (a 5.8 MB Babylon chunk) plus 14 MB of models,
    loaded all at once (`client/src/assets.ts:64`). That includes both restaurants' rooms
    (4.6 MB each). *Fix:* deep Babylon imports; load a restaurant's room when it's needed;
    compress models (meshopt + WebP/KTX2 textures); show a loading percentage; cache with a
    service worker so the second visit is instant.
26. **Network:** full snapshots at 15/s are about 8 KB each, ~116 KB/s per player (~400 MB an hour
    on mobile data). *Fix:* turn on `perMessageDeflate`, and later send only what changed.

### Step 5: add

27. **Mic control.** Voice chat turns the mic on for everyone who talks, strangers from Quick Play
    too (`client/src/voice.ts:56`), and there's no mute. *Add:* a mic button in the HUD and pause
    menu, off by default in Quick Play.
28. **Dev test menu** (`?debug`, dev builds only): jump to any shift, spawn a kid or critic, end the
    shift, set the time. Booster seats and late-level features are slow to reach by hand.
29. **Rule tests** beside the coach check: booster seats, tray, dash, plate check, and a server
    test that sends bad messages.
30. **Tidy the stylesheet** (9,269 lines). The same elements are restyled over and over (the
    picker 3×, the Signs wheel 3×, the recipe book in 6 stacked phone blocks). That's how bugs like
    #2 slip in. Merge each component's rules into one place.

## 14. Audit: menus, settings and help (planned, Nov 2026)

Walked every menu at desktop and phone size. The game itself reads well; the menus around it grew
one button at a time, so the same thing has several names and some things are hard to find.

### Step 1: broken or missing (done)

1. **A friend who joins by invite link can't reach Settings, Help or the language.** The room
   screen has only Copy link, the chefs, Restaurant & Shift and Start. *Fix:* a small Settings and
   Help button on the room screen.
2. **Your name is hidden** inside "Restaurant & Shift" (the dialog is titled "Your shift"), and a
   guest has no reason to open it, so rooms fill with "Chef". *Fix:* name field on the room screen
   itself, next to the kitchen code.
3. **Controls tab: "Alt 0–3" is drawn over its label** "Switch chef (Solo)" (`index.html:353`).
4. **Read aloud isn't in Settings and isn't remembered.** It's a checkbox in the pause menu only
   (`main.ts:94`), off again after every reload. *Fix:* a `speak` pref in Settings.
5. **Settings doesn't fit.** 10 rows: at 768px tall the Done button is below the fold; on a phone
   in portrait each row stacks and the list is 1,195px in a 796px card. *Fix:* groups (below),
   label and choice on one line on phones, Done pinned to the bottom of the card.
6. **No mic control** (already #27 in section 13): belongs in Settings and the pause menu.

### Step 2: one name for each thing (done)

The one name is **How to play** (title, play menu, pause, room).

7. **Help has five names:** "How to Play" (title), "Help" (play menu), "Keys" (pause, which opens
   a dialog called "How to cook" on its Cooking tab), "Tips" (pause, the level card) and
   "Tutorial". *Fix:* one **Help** everywhere, with three tabs: Basics (the 3 how-to pages),
   Cooking, Controls; "Try the tutorial" at the bottom. Pause keeps **Level tips** as its own
   button, named in full.
8. **"Restaurant & Shift" opens "Your shift".** Same title on the button and the dialog.
9. **Daily special is in two places** (a tile on the play menu, and a switch inside Your shift).
   Keep the tile; drop the switch for solo (the host still needs it in a room).
10. **Camera: "First / Third"** means nothing to a new player. *Fix:* "Chef's eyes / From above".
11. **"Practice as" with All / Head / Deaf / Mute** in the pause menu: say what it does
    ("Try a chef" + one line: "Feel what each chef can and can't do").
12. **Solo Mode looks selected, not clickable** (it has the "on" style as keyboard focus). Make
    the focus style a ring, not the filled look.

### Step 3: Settings, grouped (done, but for the left-handed layout)

Added: Look speed, Colours (high contrast timers), Reset progress, Microphone, Read aloud.
Not done: the left-handed touch layout (the action arc and the landscape layouts all need
mirroring), and the mic is not yet off by default in Quick Play.

| Group | Settings |
|---|---|
| Game | Language · Camera · Seasoning meter |
| Sound | Music · Sounds · Voices · Read aloud · Microphone (new) |
| Screen | Text size · Graphics · Motion |
| Privacy | Share play stats (one line: "Counts shifts and stars. No names.") |

13. **One line of help under the unclear ones:** Voices ("teammates' voice chat"), Graphics
    ("Fast for older phones"), Motion ("less shake and bounce"), Seasoning meter.
14. **Missing settings worth adding:** look speed (mouse / drag), left-handed touch layout
    (stick on the right), colour-blind safe tints for the order timers, "Reset progress" (with a
    confirm) at the very bottom.
15. **Changing language reloads the page:** say so on the row, and don't offer it mid-shift
    online (it would drop the player from the room) — show it greyed with "from the menu".

### Step 4: flow (done)

The end screen's Shop button and its "can afford" check were not seen in a real finished shift.

16. **Pause menu has no "Restart shift"** (solo): the only way is Leave kitchen, then pick the
    shift again.
17. **Pause menu online says "Paused"** though the kitchen keeps running. Title it "Menu" and add
    "The kitchen is still cooking".
18. **Play menu has 10 buttons of equal weight.** Order by what people come to do: Solo and
    Create/Join big; Quick Play, Daily, Restaurant & Shift second; Tutorial, Help, Shop,
    Stickers, Settings as the small row (already so) — but move Tutorial into Help to cut one.
19. **Title screen:** add a "Continue" first when there's progress ("Continue · Shift 4"), so a
    returning player is one tap from cooking.
20. **End screen:** Menu / Play again / Next level is good. Add "Shop" when the coins just earned
    can buy something (a dot on the button), since that's the moment players want to spend.
21. **First visit goes straight into the tutorial** (good), but with no way to say "I've played
    this kind of game": add "Skip" on the tutorial's first coach line.

## 15. Audit: touch controls (planned, Nov 2026)

Read `client/src/touch.ts` and played at phone size (812×375 sideways, 375×812 upright), in both
camera views. Emulated only: no real phone was used. The base is sound: buttons act on touch-down,
fingers are captured, everything lets go when the phone rotates or the app is left, the picker
tiles are 64px, and safe areas are respected.

### Step 1: broken (done)

The cause of 1 and 2 was one rule: the "label under the button" style put Hand, Sniff and Dash
back in the page flow, so each sat lower than the arc said.

1. **Dash sits on top of Use and runs off the screen.** The mute chef's Dash is at x 765–815 on an
   812px screen, over Use's corner, its label cut off. *Fix:* move it up the arc (between Hand and
   the edge) and keep it inside the safe area.
2. **Sniff is 30px and half under Hold** (Sniff x 603–633, Hold x 621–683). *Fix:* 48px, in its own
   place on the arc.
3. **Upright, the "turn your phone" card covers a shift that keeps running.** The clock ticks and
   orders expire behind it. *Fix:* solo pauses while the card shows.
4. **The same card covers the title and play menu.** Menus fit an upright phone fine. *Fix:* show
   the card only during a shift.
5. **iPhones zoom in when you tap the name field** (its text is 14.4px; under 16px Safari zooms and
   stays zoomed). *Fix:* 16px on inputs.
6. **The screen can dim or lock mid-shift.** A head chef watching, or a crew waiting in the room,
   doesn't touch the screen. *Fix:* a screen wake lock while in a room or a shift.
7. **The stick can land where it can't be pushed.** It centres under the thumb even at the very
   edge, so there's no room to push left or down. *Fix:* keep its centre 62px from the edges.

### Step 2: size and reach (done)

8. **Menu is 32px and Full screen 37px,** in the top-right corner (the hardest place to reach, and
   next to the notch). *Fix:* 44px.
9. **Pause menu on a sideways phone:** chef chips are 28px tall, Restart and Leave 29px, the
   Read aloud tick 23px. *Fix:* 40px+ rows; the ticks become switches.
10. **Button words are 9.6px** (Hold, Hand, Dash; Use is 10.9px). *Fix:* 12px.
11. **Hold is 62px, Hand 50px.** Hold is the button pressed longest (chop, wash, mop). *Fix:* 70px.
12. **Side buttons vanish when they'd do nothing** (opacity 0), then pop in. Thumbs can't learn
    where they are. *Fix:* keep them in place at 30%.
13. **Hold never says what it will do.** Use shows "Pick up", "Serve"; Hold always says "Hold".
    *Fix:* "Chop", "Wash", "Mop", "Put out".

### Step 3: feel (done)

Settings has a Touch buttons group (shown on touch): Button size, Walk with (left or right thumb)
and Hold button. Not tried on a real phone: the buzzes, the wake lock, and tap-versus-hold on Use
at a cutting board with food on it.

14. **One button instead of two.** Tap Use to use, hold Use to chop or wash: the game already knows
    which one applies. Hold stays as an option in Settings for players who like it.
15. **New phone players start in first person,** which needs two thumbs and the buttons at once.
    *Fix:* phones default to From above; a choice already made is kept.
16. **No camera switch on touch** except deep in Settings. *Fix:* a view button in the pause menu.
17. **Only one kind of buzz** (8ms on every press). *Add:* served, burnt, fire and "can't do that"
    each feel different. Android only: iPhone browsers can't vibrate.
18. **Button size and left-handed layout** in Settings (the second carried over from section 14).

### Second look: what's left

Fixed on the spot: the mute chef's tag said "Shift to dash" on phones (now "Tap Dash to run"), and
a quick double tap could zoom the browser in on a menu.

19. **Try it on a real phone.** Everything in this section was checked at phone size on a
    computer. Three things can only be judged in the hand: whether the 220ms tap-or-hold wait on
    Use feels late at a cutting board, the buzzes, and whether the screen stays awake.
20. **Done:** the open ticket's Recipe chip opens the book at that dish. **Recipes are two taps away** (Menu, then Recipes), and tapping a ticket only unfolds it.
    *Fix:* the open ticket's Recipe chip opens the book at that dish.
21. **Done:** tap the checklist to hear where you are and the next step. **No "what's next" on touch.** The keyboard has Q (reads what's around you and the next step).
    At Classic pace there's no coach line, so phone players get no hint at all. *Fix:* tap the dish
    checklist to hear and see the next step.
22. **Done:** pinch zooms the view from above (0.7× to 1.6×, remembered). **From above, a drag on the kitchen does nothing.** *Add:* pinch to zoom in and out a little.
23. **The stick has one speed curve.** Fine for walking; worth a look on a real phone for small
    moves next to a station (the dead zone is 15%).

## Next ideas

- A third restaurant (a new 3D room in Blender).
- The weekly kitchen board (a small backend; needs an account you create).
- Group and regular customers.
- Smarter bots: a cook bot for two-player kitchens.
- Booster seat (built, level 8 on): kids wait standing until the head chef sets a booster seat out on the pass; the kid carries it to the chair and sits on it. Could later add a tip for fast seating.

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
