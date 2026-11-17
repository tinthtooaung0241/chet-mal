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

## 16. Audit: graphics (planned, Nov 2026)

Measured in a solo shift at the street food stand, High graphics: **721 meshes drawn, 278
materials, about 730,000 triangles, 702 shadow casters**, shadow map redrawn every frame. The
look itself (pastel sky, warm sun, string lights, toy-like room) is good. What's wrong is
sharpness, cost, and how easy it is to read what matters.

### Step 1: sharpness and cost (done, but for sharing meshes)

Done: High draws at the screen's own sharpness (up to 2×) and Fast at one pixel per CSS pixel,
with a Fastest step below it (what phones used to get). Auto watches the frame rate a few seconds
into a shift and steps down if it's under 40 (32 on Fast); a tablet running smoothly gets one try
at High. The room's shadows are drawn once per kitchen (695 meshes); only the movers' shadows
(about 7 meshes) are redrawn each frame. Characters get a soft disc on the floor when shadows are
off. Ambient occlusion is 8 samples with the cheap blur. Models were simplified
(`client/scripts/slim-models.mjs`): a shift went from about 730,000 triangles to about 239,000,
and the models folder from 14 MB to 9.5 MB. Station parts that never move no longer have their
position worked out every frame.

Not done: station models were left as they were (simplifying them made the steel tops blotchy).
Materials are not frozen (power cuts change the lights, and frozen materials can miss that), and
stations are not merged or instanced, because each station lights up on its own when you face it.
So the kitchen is still about 720 draws a frame. Frame rate was not measured on a real device.


1. **The game renders at half the screen's sharpness.** The engine ignores the device pixel ratio
   (`client/src/main.ts:71`), so a Retina laptop draws 1 pixel where it has 4. Phones on Fast
   also scale down 1.5× (`main.ts:682`): an 844×390 phone draws about 563×260, then stretches it.
   This is the main reason the kitchen looks soft next to the crisp HUD. *Fix:* render at
   `min(devicePixelRatio, 2)` on High, and about 1.25× the CSS size on Fast, paid for by items 2–4.
2. **Shadows are drawn from scratch every frame for 702 objects**, most of which never move
   (walls, shelves, decor: `main.ts:1199`, `view.ts:361`). That's a second full pass over the
   scene. *Fix:* two shadow maps: one for the room, drawn once per kitchen; one small one for
   chefs, customers and carried things.
3. **Phones get no shadows at all** (`main.ts:683`), so chefs and plates float. *Fix:* a soft dark
   disc under each chef and customer on Fast. Almost free, and it grounds everything.
4. **Small props are heavy.** A bowl is about 4,000 triangles, a plate 3,000, lettuce and carrots
   more; together props outweigh the whole room. They're a few centimetres on screen. *Fix:*
   decimate props in Blender to 300–600 triangles each. Target under 250,000 triangles a shift.
5. **Nothing is shared.** Only 30 of 859 meshes are instances, and no material is frozen. Still
   open from §13: merge the room's static meshes by material, freeze materials, instance repeated
   props (plates, chairs, string-light bulbs).
6. **Ambient occlusion is the most expensive effect on High** (16 samples, expensive blur,
   `look.ts:88-92`). *Fix:* 8 samples and the cheap blur; nobody will see the difference from above.
7. **One graphics switch for everything.** Auto means "Fast on touch, High otherwise", so a new
   iPad gets Fast and an old laptop gets High. *Fix:* start on High, watch the frame rate for the
   first few seconds of a shift, and drop to Fast if it's under about 40.

### Step 2: reading the kitchen

8. **Your chef is small and looks like the others.** From above on a laptop the whole island is
   framed and the chef is about 40 pixels tall. *Fix:* a coloured ring under your own chef, and
   each teammate's colour on their ring and name tag. On laptops, frame the kitchen a little
   tighter.
9. **The lit-up station is faint.** The station in front of you gets a white wash at 22%
   (`view.ts`, `syncHighlight`), easy to miss from above on pale counters. *Fix:* a brighter rim
   or a small lift, in your chef's colour.
10. **Food states look alike from above.** Raw, chopped, cooked and burnt differ by a small model
    swap. *Fix:* a small state badge over food on counters and in hand (knife, flame, burnt), and
    darker, smoking burnt food.
11. **Danger has no colour.** A stove about to burn, cold food warming up and an order about to
    expire all rely on small bars. *Fix:* the stove's flame turns from orange to red and the pan
    shakes in the last seconds; a ticket's table gets a pulsing marker when its order turns red.
### Step 3: life and mood

13. **Both restaurants share one sky and one time of day.** *Fix:* a light preset per shift
    (morning, noon, golden hour, night with the string lights carrying the scene). It's only the
    sun colour, sky gradient and exposure in `look.ts`, and it makes ten shifts feel like ten days.
14. **A power cut is just dark.** Storms have lightning and rain on the screen; a power cut only
    fades the lights (`look.ts:95-100`). *Fix:* a small warm light on the pass and on each chef,
    so the dark is tense, not blind. In a storm, wet highlights on the terrace floor.
15. **Cooking effects are there but small.** Steam, smoke, flying bits and fire exist
    (`client/src/game/effects.ts`), sized for a close camera; from above they're specks. *Fix:*
    scale them with camera distance, and make steam thicken as food nears done. (The perfect
    moment stays sound-only, as designed.)
16. **A big combo looks like a first dish.** Points float up from the pass and the score pops,
    the same way every time. *Fix:* the burst and the number grow with the combo, and coins
    burst at the till when a customer pays.
17. **Customer moods are easy to miss.** Happy, angry and sick customers animate, and a "Hungry!"
    bubble shows, but from above an angry table looks like a calm one. *Fix:* tint the table's
    marker by mood, and make the walk-out bigger.

## 17. Audit: gameplay systems (planned, Nov 2026)

Read from `shared/src/rules.ts` and `shared/src/state.ts`. The core loop and the roles are sound.
The issues are in balance, order flow and how little of the best idea gets used.

### Step 1: balance (done)

Built with Step 4's tests first (`pnpm test:rules`, `shared/test/rules.ts`):

- **Crew size:** a level's pace and stars are set for two chefs. Solo gets orders 15% less often
  and star goals at 85% (`CREW_PACE`, `CREW_GOALS` in `rules.ts`). Solo with the helper bot counts as two.
- **Lost customers:** half the dish's price, at least 10 (a critic: at least 20) — `expiredPenalty`.
- **Combo and speed:** combo capped at 10 a dish (was 20); speed pays up to 15 (was 10) —
  `comboBonus`, `speedBonus`.
- **Upgrades:** a second tier of each (knife set, walk-in chiller, cast-iron range, card reader,
  rooftop billboard; 1,140 coins in all), on sale once the first is owned (`upgradesOnSale`).
- **Star goals:** shifts 3 and 6–10 rescaled by how much their menus' average price moved in §18–19
  (3: 65/130/190, 6: 60/125/190, 7: 40/85/125, 8: 50/100/150, 9: 55/115/170, 10: 60/120/180).
- **Still to do:** these are sums, not play data. Tune against `shift_end` in PostHog once people play.

The findings this step answered:


1. **One chef and two chefs get the same shift.** Order pace and star goals are identical for a
   crew of one and two; only three chefs change anything (`rules.ts:667-668`). So either solo is
   too hard or a pair cruises. *Fix:* solo gets about 15% fewer orders and lower star goals, and
   tune with the `shift_end` numbers in PostHog.
2. **Letting an order expire is cheap.** It costs 10 points whatever the dish (`rules.ts:14`),
   while a steak plate pays 35–45. The best play is to cook only easy dishes and let hard ones
   time out. *Fix:* the penalty is half the dish's reward, at least 10.
3. **Combos outweigh cooking well.** By the fifth dish in a row each serve adds 20, as much as a
   whole salad, while serving fast adds at most 10 and a perfect sizzle 10. *Fix:* cap the combo
   at 10–12 a dish, and let speed pay up to 15.
4. **Upgrades run out fast.** Five upgrades, 420 coins, then coins only buy hats. *Fix:* a second
   tier of each upgrade, or a per-restaurant set, priced so they last through all the shifts.

### Step 2: order flow

5. **Orders are picked at random with no memory** (`state.ts:1384`). You can get three salads in
   a row, or never see the dish the shift is teaching. *Fix:* deal dishes like a shuffled deck,
   and make the first order the shift's new dish.
6. **Done (§18):** menus are now 2, 4, 4, 4, 6, 6 dishes. **Menus jump in size.** Shift 1 has one dish, shift 2 has two, shift 3 has five new ones at
   once, and shifts 5 and 6 draw from every dish in the restaurant. *Fix:* three or four dishes
   in shift 3; in shifts 5 and 6, six dishes that rotate, not all of them.
7. **Shift 2 teaches four things at once**: seasoning before or after the flame, the perfect
   sizzle, combos and fires. *Fix:* move fires to shift 3 and combos to shift 4, one new idea a
   shift.
8. **Kids and critics arrive by dice roll** (20% of orders are kids). Some shifts get none, some
   get four. *Fix:* a set number per shift, at random times.

### Step 3: use the best idea more

9. **Power cuts and storms happen in one shift out of ten** (shift 6 only, `rules.ts:546`). They
   are the moments when who leads changes, which is the game's hook. *Fix:* a short one in shifts
   4 and 5 and in each Burmese shift from 8 on, and a third event kind (below).
10. **The Burmese restaurant never loses its lights or hearing.** Its four shifts add dishes and
    booster seats, but no event. *Fix:* give it its own event, such as a generator that must be
    restarted by one chef while another calls the orders.
11. **Only two events exist.** *Add:* "smoke" (the kitchen fills, only chefs near the floor of the
    pass can read tickets), or "loud table" (a party drowns out phone orders for 20 seconds).
12. **Ten shifts is about forty minutes of new things.** After that there's the daily special and
    overtime. *Add:* a third restaurant (already under Next ideas), and an endless shift with a
    best-score board per restaurant.

### Step 4: safety net (done: `pnpm test:rules`)

13. **The rules have one test**, the autoplay run (`shared/test/autoplay.ts`). Scoring, expiry,
    combos, seasoning and star goals are untested, and Steps 1–2 change all of them. *Fix:* small
    rule tests first (still open from §13, item 29), then change the numbers.

## 18. Audit: recipes (done, Nov 2026)

Every dish was checked three ways: would a real kitchen make it like this, can it be made in the
kitchen that orders it, and does it pay for the work in it. `npm run test:recipes` now checks the
last two on every run and prints work against pay for each dish.

**What was wrong, and what changed**

- **Two dishes were the same plate.** Grilled fish and soy-glazed fish were both "one cooked
  fish", on the same menu. With both ordered, your fish went to whichever ticket was older, and
  the other customer complained about the seasoning. *Now:* soy fish comes with fried mushrooms
  ("Soy fish & mushrooms"), and a dish that fits two tickets goes to the one it was seasoned for
  (`state.ts`, `serve`). That also sends a plain plate to the kid who ordered it.
- **The first dish was the worst deal.** Salad needed three finishing touches (oil, lemon, salt)
  for 20 points: three trips to the rack in the tutorial. *Now:* oil and lemon. No dish asks
  for more than two finishing touches, but for mohinga and tea leaf salad, which are known for
  their toppings.
- **A toastie with cold cheese.** *Now:* "Cheese & tomato sandwich": buttered toast, sliced
  cheese, tomato.
- **A steak salad that was steak on lettuce.** *Now:* steak, lettuce and tomato.
- **Tomato soup was three tomatoes.** *Now:* two tomatoes and an onion, salt and herbs.
- **Stir-fry was seasoned on the plate.** *Now:* soy goes on the mushrooms before the pan,
  pepper on top.
- **Shan noodles had no sauce.** *Now:* rice noodles, turmeric chicken and tomato, with peanuts
  and coriander.
- **Pay didn't follow the work.** Soy fish paid 11.4 points per 10 seconds of work, salad 6.5.
  *Now:* every dish is between 7 and 11, starters lowest, and customers wait about twice as long
  as a dish takes one chef.
- **Menus jumped in size** (§17 item 6). *Now:* shifts have 2, 4, 4, 4, 6, 6 dishes. Shifts 5
  and 6 draw from six set dishes, not all fourteen, and each brings back dishes from earlier.

**The menu now**

| Dish | On the plate | Seasoned | Pays |
|---|---|---|---|
| Salad | chopped tomato, chopped lettuce | finish: olive oil, lemon | 20 |
| Fried mushrooms | fried mushrooms | finish: salt, herbs | 20 |
| Grilled fish | fish | salt before; finish: lemon, herbs | 25 |
| Cheese & tomato sandwich | toast, sliced cheese, chopped tomato | butter on the bread before | 35 |
| Steak & fries | steak, fries | salt and pepper before; salt on fries after | 35 |
| Steak & onions | steak, fried onions | salt and pepper before; finish: butter | 35 |
| Steak salad | steak, lettuce, tomato | salt and pepper before; finish: olive oil | 40 |
| Fish & chips | fish, fries | salt before; salt on fries after; finish: vinegar | 35 |
| Full breakfast | fried egg, toast, mushrooms | butter before; salt and pepper on the egg after | 50 |
| Soy fish & mushrooms | fish, fried mushrooms | soy before; finish: lemon | 35 |
| Mushroom stir-fry | mushrooms, onions | soy before; finish: pepper | 35 |
| Tomato soup | tomato, tomato, onion | finish: salt, herbs | 40 |
| Vegetable soup | carrot, onion, potato | finish: salt, pepper | 40 |
| Mushroom soup | mushroom, mushroom, onion | finish: butter, herbs | 40 |
| Mohinga | fish, onion, rice noodles (pot) | finish: fish sauce, lime, coriander | 45 |
| Tea leaf salad | tea leaves, cabbage, tomato | finish: peanuts, garlic oil, lime | 35 |
| Shan noodles | noodles, chicken, tomato | turmeric before; finish: peanuts, coriander | 45 |
| Chicken curry & rice | chicken, rice, fried onions | turmeric and chili before; finish: coriander | 50 |
| Burmese fried rice | rice, fried egg, fried onions | salt on the egg after; finish: fish sauce | 40 |

**Still not like a real kitchen** (each needs a new model or station, so they're left for later)

1. **Everything cooks in a frying pan.** Rice is "steamed" and noodles "boiled" in it. *Add:* a
   second pot on the stove that boils (rice, noodles, eggs), so pan and pot are two skills.
2. **Cheese never melts, tomatoes never grill.** *Add:* a cooked state for cheese and tomato
   (two models), then the sandwich becomes a real toastie and breakfast gets its grilled tomato.
3. **Carrots only go in soup.** One more use (a raw side, or fried rice) would make the crate
   worth walking to.
4. **Star goals were set for the old menus.** Average pay per dish moved by a few points on
   shifts 2, 4, 5 and 6. Check with the `shift_end` numbers before changing them.

## 19. More Burmese dishes (done)

Five dishes added to the Burmese restaurant, each a real one, cooked the way it is as far as the
kitchen's rules allow. The restaurant now has ten.

| Dish | Burmese name | In the game | Pays |
|---|---|---|---|
| Tomato salad | khayan chin thi thoke | chopped tomato and raw onion; peanuts, coriander | 25 |
| Shan tofu fritters | tohu kyaw | Shan tofu sliced and fried; chili, coriander | 25 |
| Coconut chicken noodles | ohn no khao swè | pot: chopped chicken, coconut milk, noodles; lime, chili | 35 |
| Egg curry & rice | kyet u hin | egg with turmeric, fried; chopped tomato; rice; chili | 35 |
| Nan gyi thoke | nan gyi thoke | boiled noodles, turmeric chicken, raw onion; garlic oil, lime | 45 |

- **New ingredients:** Shan tofu (greens fridge; raw, sliced, fried, burnt) and coconut milk
  (noodle shelf; goes in the pot as it is). Chicken can now go in the pot once chopped.
- **Menus:** shift 7 tomato salad, tofu fritters, tea leaf salad, shan noodles; shift 8 mohinga,
  coconut chicken noodles, tofu fritters, tea leaf salad; shift 9 chicken curry, egg curry, fried
  rice, nan gyi thoke, tomato salad; shift 10 eight dishes (all but tomato salad and fried rice).
- **Art:** models, icons and dish pictures are built by scripts kept inside
  `assets/kitchen_assets.blend` (texts `burmese_models.py`, `icon_shots.py`, `burmese_dishes.py`).
  `icon_shots.py` also recreates the outline ink material, which the file had lost.
- **Recipe book:** a soup page now says "Take the noodles as it is" for things that aren't
  chopped, and its tip names what to chop.

Where it bends the real dish (kept honest here, not hidden):
- Ohn no khao swè is made with wheat or egg noodles; the kitchen only stocks rice noodles.
- Egg curry uses boiled eggs fried golden, in a cooked tomato and onion gravy. Here the egg is
  fried from raw and the tomato is only chopped (tomato can't be cooked in this kitchen yet).
- Nan gyi thoke also has boiled egg, fish cake and toasted chickpea flour.
- The star goals for shifts 7 to 10 were not retuned for the new menus.

## 20. Audit: buttons, icons and alignment (Nov 2026)

Every dialog was measured in the page (buttons with no icon, rows whose items differ in height or
centre, targets under 36 px), then the pause menu was checked by eye.

**Fixed**

| Where | Was | Now |
|---|---|---|
| Pause: Restart shift / Leave kitchen | text only, 34 px and unequal | restart and door icons, "Restart" / "Leave", both 44 px |
| Pause: Read aloud / view / microphone | a bare checkbox next to a pill, 5 px off centre, 23 and 27 px tall | three equal 40 px chips, each with its icon; the view chip reads "From above" / "Chef's eyes" |
| Pause: Asset gallery link | pushed Restart and Leave off centre | on its own line under them |
| Back buttons (shop, stickers, play menu) | text, or a "‹" character | a back-arrow icon |
| Done / Got it! (settings, shift setup, How to play) | text only | a tick icon |
| Let's cook! and Next level | text only | a play icon |
| Play again (end screen) | a play icon, same as Next level | a restart icon |
| Reset progress | text only, 34 px | bin icon, 40 px |
| End screen buttons | 36 and 44 px in one row | all 44 px |
| Shop and stickers Back | 35–36 px tall | 44 px |

New glyphs in `client/src/ui/icons.ts`: `back`, `restart`, `exit`.

**Left as they are, on purpose**

- Title menu (Let's Play, How to Play, Settings): three large words picked with the keyboard; icons add nothing.
- Join (room code) and the restaurant cards: the field and the star count already say what they are.
- Leave and Restart keep a word beside the icon: both throw a shift away, and an icon alone is a guess.

**Still open**

1. **Done:** asking first no longer moves anything. Tapping Leave or Restart turns the pair into Yes (tick) and No (cross) in place, each button keeping its width, with the question in the card's bottom padding. No sits where Leave was, Yes ignores taps for 0.4 s, and it reverts after 5 s (`main.ts`).
2. The in-game HUD chips (ping, bell, chat) are icon-only with a key letter; a first-time tooltip would help.
3. Settings rows mix two- and three-choice pills of different widths; a fixed pill width would line them up.
4. Not rechecked at phone size or in Burmese after these changes beyond the pause menu.

## 21. Audit: type and spacing structure (Nov 2026)

Counted from `client/src/style.css` (10,478 lines, 1,918 rules, 105 media queries).

| Part | Has a structure? | What's there |
|---|---|---|
| Colours | Yes | paper, ink and pastel tokens in `:root` |
| Corner radius | Mostly | `--r-sm/md/lg`, `--pill`; 123 of 197 uses go through a token |
| Fonts | Yes | Fredoka for display (`--font-display`), Nunito for text |
| Font sizes | **No** | 50 different sizes in 256 places, none from a token. Seven sizes sit between 0.8 and 0.9rem alone |
| Font weights | Loosely | 600, 700 and 800 carry almost everything |
| Line heights | **No** | 15 different values |
| Spacing | **No** | 40 different pixel values across gap, padding and margin; `--gap` exists but is used 4 times. 129 different padding declarations |
| Layering | Weak | later blocks override earlier ones by selector weight (the 38px icon bug in §20 came from this); 29 `!important` |

**Proposed scale** (taken from the values already used most, so the look barely changes):

- Type: `--t-micro 0.62rem`, `--t-caption 0.72rem`, `--t-small 0.8rem`, `--t-body 0.88rem`,
  `--t-label 1rem`, `--t-title 1.1rem`, `--t-head 1.3rem`, `--t-big 1.6rem`, plus the title's clamp.
- Line height: `--lh-tight 1.1`, `--lh-label 1.25`, `--lh-text 1.4`.
- Spacing: `--s-1 2px`, `--s-2 4px`, `--s-3 6px`, `--s-4 8px`, `--s-5 10px`, `--s-6 12px`,
  `--s-7 16px`, `--s-8 20px`, `--s-9 24px`, `--s-10 32px`.

**Built (steps 1–3)**

- Tokens are in `:root`: nine type steps (`--t-micro` 0.62, `--t-caption` 0.7, `--t-small` 0.8,
  `--t-body` 0.86, `--t-label` 0.95, `--t-title` 1.05, `--t-head` 1.25, `--t-big` 1.4,
  `--t-huge` 1.6rem), three line heights, and eleven spacing steps (`--s-1`…`--s-11`: 2, 4, 6, 8,
  10, 12, 14, 16, 20, 24, 32px). The steps differ a little from the proposal above: they follow
  the values used most, so less moved.
- Every font size from 0.5 to 1.65rem (242 of 256 declarations) now uses a type token. Left alone: the
  title's clamps, the 1.7–2.6rem display sizes and `em` sizes.
- Every gap, padding and margin from 2 to 32px (865 values) uses a spacing token; 3, 5, 7, 9, 11,
  18, 22, 26, 28 and 30px went to their neighbour (ties to the smaller). 1px hairlines, negative
  offsets and sizes over 32px are left as written.
- Checked by measuring all ten dialogs before and after at 1280×800, 667×375 and 360×640, in
  English and Burmese: every dialog is the same height or a few pixels shorter, and none gained a
  scrollbar. Settings, the play menu and the HUD were looked at by eye at desktop size only.
- **Line heights (done):** every line height from 1.05 to 1.5 (37 declarations) is `--lh-tight`
  (1.1), `--lh-label` (1.25) or `--lh-text` (1.4). `1` and below, and `normal`, are left.
- **Folding the override blocks (step 4, done as far as it is provably safe):**
  `client/scripts/fold-css.mjs` removed 68 declarations that a later block of the same selector
  always overrode, and merged 91 earlier blocks into the later block of the same selector. It only
  moves a block when no rule in between has the same selector weight and touches the same kind of
  property, so the result cannot change. Checked: 69 computed properties on all 1,310 elements of
  the ten dialogs and the title screen were identical before and after, at 1280×800, 667×375 and
  360×640 in English and 360×640 in Burmese. The stylesheet went from 10,586 to 10,262
  lines. 109 pairs of duplicate blocks remain, because something between them could change the
  result; untangling those needs a person reading each one.
- **Not done:** font weights (600, 700 and 800 are used loosely).
- New CSS should use the tokens; a raw `rem` font size or odd pixel gap is now the exception.

**How to get there**

1. Add the tokens to `:root` (no visual change).
2. Snap font sizes to the nearest step, one screen at a time, checking each at desktop and phone size, English and Burmese.
3. Snap spacing the same way; odd values (5, 7, 9, 11 px) go to their neighbour.
4. Fold the stacked override blocks for each dialog into one block per component, so a rule is written once.

Also done here: the "Feel what each chef can and can't do" line under Try a chef is removed.

## 22. Layout rhythm inside cards (Nov 2026)

The scale in §21 says which sizes exist; this says which one goes where. Tokens in `:root`:

| Token | Value | Use |
|---|---|---|
| `--stack` | 16px (`--s-8`) | between the groups of a card: title, a button group, the footer |
| `--group` | 8px (`--s-4`) | between the controls of one group: tiles, chips, a button pair |
| `--group-lg` | 12px (`--s-6`) | the same, in a grid of large buttons (the play menu) |
| `--inline` | 8px (`--s-4`) | between an icon and its label |
| `--control` | 44px | a button's height |
| `--control-sm` | 40px | a chip's height |

Card padding is already one value everywhere (32 / 32 / 24px; 24 / 24 / 20px for the wide cards).

**Applied** (the "layout rhythm" block at the end of `style.css`, laptop and tablet sizes):

- Pause menu: every group is `--stack` from the next (was 12–16px), every group's own gap is
  `--group` (tiles 8, chef picker 6, chips 10 and Restart/Leave 14 are all 8 now), the legend sits
  `--group` above the chef picker, and the chips and Restart/Leave share one text style
  (Nunito 800, `--t-body`; they were three different fonts and weights).
- Footers: Done, Got it!, Back and Let's cook! sit `--stack` under the content in Settings,
  How to play, Stickers and the briefing (were 13, 19, 15 and 19px). How to play's tabs too.
- End screen and How to play button rows use `--group`.

- End screen: title, stars and verdict sit `--group` apart; the score table starts a new group at
  `--stack`; losses, tip and awards follow at `--group`; the buttons at `--stack` (were 16, 12, 12,
  20, 12, 12, 14px).
- Shop: blurb, coins and each section heading at `--stack`; a heading to its list, and the hat
  colours, at `--group` (were 16, 16, 10, 20, 8, 14, 20, 8px).
- Play menu: the button grid uses `--group-lg` (12px; was 14 × 16px), the tile row `--group`
  (was 10px), and the divider sits 12px from both.

**Not applied**

- Phone layouts (under 700px wide or 560px tall) keep their tighter, hand-fitted values; they
  were measured unchanged.
- Shift setup (Restaurant & Shift) and the recipe book are not restacked yet.

## 23. Small UI fixes (Nov 2026)

- Settings: notes sit under their label, every choice pill is 32px tall (Burmese too), group
  headings are small left-aligned labels, Reset progress is a flat text button.
- Scrollbars inside cards are our own slim pill; the recipe book scrolls with no bar, which gives
  long dish names their full width.
- Picker: the chosen item is a filled chip (no border), the others fade a little.
- Recipe book menu: a dish name is always one line, so rows never change height between pages.
- About page: a Burmese version, a language switch and a Back to the game button.
- Title screen pills (language, About the game) are one height with centred text.

## 24. Audit: Burmese letters being cut (Nov 2026)

Burmese stacks marks above and below the line, so a line of it is about 1.4 times the font size
tall. Text set with a Latin-sized line height gets its top or bottom cut wherever it is also
clipped to one line (`overflow: hidden` with "…").

**How it was checked:** in Burmese, every piece of text on the HUD and in all ten dialogs was
measured (the letters' own box against the nearest box that clips it), at 1280×800, 667×375 and
360×640.

**Found:** the dish name on an order ticket lost 3px at the top and 2px at the bottom (line height
1.1). The same pattern, one-line clipping with a tight line, exists in ten places in the CSS.

**Fixed** (the "Burmese: room for taller letters" block in `style.css`):

- In Burmese the three line-height steps are taller: tight 1.1 → 1.4, label 1.25 → 1.5,
  text 1.4 → 1.6. Because line heights are tokens (§21), this reaches every place at once.
- Every element that cuts text to one line or clamps lines gets a 1.5 line in Burmese: ticket
  names, the book's menu, toasts, the shift report, lobby chef cards, the coach line on phones,
  the picker's labels and the phone Use button.
- After the fix the measurement finds no cut text at any of the three sizes.

**Cost:** Burmese dialogs are 5–10px taller. None gained a scrollbar.

**Still open**

- The pause menu in Burmese at 360×640 scrolls (it did before: 104px, now 122px). It needs its own
  compact layout.
- Only one system font was measured (this Mac's). Android's Noto Sans Myanmar is a little taller;
  a real phone check is still owed.
- States not on screen during the check: an online lobby with chef cards, the shift report with
  losses, toasts.

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

### Phone sizes pass (every screen at 667×375 sideways and 360×640 upright)

Checked in a phone-sized preview: title, play menu, Restaurant & Shift, How to play (3 pages),
Settings, Shop, Stickers, the room, the HUD, pause menu, level tips, end screen, rotate card.

Fixed:
- **Settings sideways:** group names sat in a column cell and the card was 500px wide; now two
  columns at full width with each group's name across both.
- **How to play upright:** pages were wider than the card and the buttons were off screen; now
  only the open page takes room. Cooking page: steps three across, reminders as short rows.
- **How to play > Cooking sideways:** reminder icons sat above the wrong line.
- **Pause menu sideways:** squeezed into half the card with a blank gap; now full-width rows, no scroll.
- **End screen sideways:** a tall tip pushed the score off the card; now fits with no scroll.
- **The room:** shorter chef cards sideways; Shift / Warm-up / Start pinned upright too.
- **Restaurant & Shift:** Done pinned on phones; the blank gap upright is gone.
- **Shop:** opened scrolled halfway down; now opens at the top.
- **Stickers upright:** two across. Cards use 16px side padding on narrow phones.
- **Rows of choices** are 36px tall on touch.

Not checked: Burmese at these sizes (longer words), real devices with notches, tablets.

Burmese at the same two sizes, checked after: fixed the How to play tabs running off the card
upright, the end screen's score hiding under its buttons sideways, the room's chef names squeezed
into thirds upright (now one chef per row, both languages), the word "Shift" staying English in
Restaurant & Shift, and a hidden radio that let that card slide sideways (both languages).
Still not checked: real devices with notches, tablets.
