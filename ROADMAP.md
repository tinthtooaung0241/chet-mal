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
  to the till and leaves it on a pass counter (the till call says so). Someone takes it to the
  sink and washes it; a wasted dish leaves a dirty plate in your hands. Nothing appears in the sink
  by itself. Dirty dishes look grimy, and the coach and the helper bot collect them.
- **The coach handles strays:** a plate or ingredient no order wants any more goes back on its rack
  or shelf, or in the bin; and held food goes to an order it can move on now (not a soup while the
  pot is busy).

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
