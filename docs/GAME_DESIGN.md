# Chet Mal: game design

Up to three friends run one kitchen. The head chef sees and hears everything but doesn't cook.
The deaf chef cooks by sight. The mute chef sees and hears everything but can only signal. Nobody
has all the information, so the team has to pass it around. What to build next is in
[ROADMAP.md](../ROADMAP.md).

Inspirations: kitchen-chaos co-op games, *Keep Talking and Nobody Explodes* (information that has
to be talked through) and *Spaceteam* (shouting under pressure).

## 1. Design pillars

1. **Every chef is the best at something.** Each role is built around a strength, not a missing
   sense.
2. **Information is split by sense.** Every order, timer and danger reaches the kitchen by sight,
   sound or touch. Whoever perceives it has to get it to whoever needs it.
3. **Limits on talking drive the game.** The tension comes from passing information under time
   pressure, not from fiddly controls.
4. **Each role can be played by someone with that disability.** A deaf player never needs sound,
   and a player who doesn't speak never needs a microphone.
5. **One new idea per level.** A briefing card introduces it before the shift starts.

## 2. The chefs

| | Head chef | Deaf chef | Mute chef | Solo (all senses) |
|---|---|---|---|---|
| **Perceives** | Sight and sound | Sight only | Sight and sound | Sight and sound |
| **Talks with** | Voice and signals | Voice | Signals only: ping (G), signs (T), bell (B) | — |
| **Cooks** | No: plates, finishes and serves | Yes | Yes | Yes |
| **Only they can** | See every ticket and hear every call, and run the pass | Play through a storm unaffected | Charm the tables (B at the pass: +8 s for every order, then 35 s rest) | — |
| **Strength** | Presentation: +5 points on every dish they serve | Chops 30% faster; golden shimmer; eagle eye (early burn and restless-table flashes); plate check (✓ / … / ✗ over dishes) | Walks 15% faster; Shift dash (4s cooldown); a tray for a second dish; washes up 60% faster | — |
| **Pour meter edge** | Flourish: a taller "just right" band | — | Steady hands: a slower pour | — |

Chefs can hand things to each other (use while facing a teammate) and lead each other by the hand
(H). A ping (G) names what you hold or point at. Each ticket shows a little role badge for every
chef working on it, so the team can see who's on what without a word.

**Helper bot (optional):** a porter that puts out fires, mops spills, washes up, and otherwise fetches
and chops what the orders need. It never cooks, plates or serves, and doesn't count towards the
crew size.

## 3. Information by sense

Every `GameEvent` names the senses that carry it (`sight`, `sound`, `touch`). `perceivesEvent()`
decides what reaches each chef, so each client shows only what its chef could know. "Touch" reaches
only the chef who did something.

| Information | Sense |
|---|---|
| Ticket orders | sight |
| Phone orders (said once) | sound |
| Food is cooked, smoking, burnt | sight and sound |
| The perfect sizzle (bonus timing) | sound only |
| An impatient ticket (it turns red) / phone caller (a sigh) | sight / sound |
| Mouldy produce | sight, or sniff it (Z) |
| A customer at the till, the food critic walking in | sight and sound |
| Power cut | nobody sees |
| Storm | nobody hears |

## 4. A shift

1. **The briefing card** shows what's new on this level and a tip for your role. Solo, the kitchen
   waits while any card or menu is open.
2. **Orders arrive.** Each one is a ticket (seen) or a phone call (heard). Each brings a customer
   who sits at a terrace table. A shift starts with two orders; a new one comes every 20 s, with up
   to 4 open at once (3 on the opening levels).
3. **Cook the dish.**
   1. Fetch ingredients from crates, fridges or pantry shelves.
   2. Chop on a board (hold F, 1.8 s).
   3. Season it: take a spice bottle from the rack (keys 1–8) and carry it to the food, wherever
      it is (a board, a counter, a stove, or a teammate's hands). Some spices go on before cooking,
      some straight after. Put the bottle back, or swap it for another, at the rack.
      **The pour meter:** hold Space by the food and the meter rises; let go in the honey "just
      right" band. The mint line in its middle is a **perfect pinch** (+2 points). The meter bounces off the
      top and back down for as long as you hold, so a missed band comes round again. Below the
      band adds nothing yet (try again); above it is **too much** (−3, nothing at a Cozy pace). The band sits somewhere new each time, and the Cozy pace makes it taller.
      Settings can turn the meter off: every pinch is then just right. On a phone, hold the Use
      button (it reads "Hold to season") and let go the same way.
   4. Cook on a stove, or in the soup pot (three chopped ingredients, 10 s).
   5. Plate it, or ladle soup into a bowl.
   6. Add the finishing spices on top: put the dish down and bring each bottle to it.
4. **Serve at the pass.** The customer collects the dish, eats, then queues at the till. Ring them
   up the way they want to pay (1 cash, 2 card). They wait 30 s at the till before leaving
   unpaid.
5. **Time's up** after 170 to 240 s. The end screen shows:
   - stars and the score;
   - a report of where the points came from and went, with one tip;
   - an award for each chef;
   - any stickers earned.

### Cooking timings

- **Food:** cooked after its cook time (4 to 8 s). The perfect window opens 0.8 s later and lasts
  1.6 s. You can only hear it.
- **Burning:** food smokes halfway to burning and burns after its burn time (5 to 7 s more).
- **Soup:** boils dry 12 s after it's ready.
- **Cold food** (from level 4): warns after 35 s out of the fridge, and goes off at 50 s.

## 5. Scoring

**A served dish** is worth `max(5, price + speed + perfect + seasoning)`:

- **price:** 20 to 45 points, set by the recipe;
- **speed:** up to 10, for the share of the customer's patience left;
- **perfect:** +10 for each item taken off at the sizzle's peak;
- **seasoning:** +5 if everything is right; −5 for each missing or extra spice, −3 for each spice
  added at the wrong step.

That total is then multiplied by 1.5 in rush hour, and by the daily twist's pay.

**Combo:** each dish served within 30 s of the last adds +5 per dish in the chain, up to +20.
Combo party doubles this.

**Losing points** (the score never goes below 0):

| What happened | Cost |
|---|---|
| A customer gives up | −10 (a critic: −20) |
| A customer gets sick from spoiled food | −15 |
| A dish nobody ordered | wasted, and the combo ends |

**Coins:** each customer pays their dish's points at the till (+20% with the tip jar). Coins go
into the restaurant's money for upgrades. The all-time total opens new restaurants.

**Stars:** each level sets the points for 1, 2 and 3 stars. A crew of three needs 25% more and gets
orders about 15% more often.

## 6. Pressure

**Pace** (chosen in *Your shift*; online, the host's counts):

| | Cozy (default) | Classic |
|---|---|---|
| Shift length, gap between orders, rush hour, combo window | 1.5× | as below |
| Orders at the start / most open at once | 1 / one fewer (at least 2) | 2 / as below |
| How long customers wait (pass and till) | 1.6× | as below |
| Time before food or soup burns, and cold food goes off | 2× | as below |
| Fires and oil spills | none | as below |
| The coach (checklist, next step and arrow) | every shift | tutorial only |
| Seasoning slips (missing, extra or mistimed) | cost nothing | −5 / −3 each |

The star goals are the same at either pace, so stars come easier at a Cozy pace.

**The coach** (Cozy, and the tutorial) knows the team. It only sends you to orders you can
perceive, so a deaf cook still needs to be told about phone orders.

- Cooks are sent to an order nobody else is working on, and skip anything a teammate is
  already carrying.
- With a head chef in the kitchen, cooks prepare the food and leave the plating to them.
- The head chef is coached through their own job: ask a cook for what's missing, plate what's
  ready, finish, serve and wash up.
- A customer waiting to pay goes first for whoever runs the till: the head chef, or else the
  nearest chef with free hands.

- **Patience:** each recipe sets how long its customer waits (60 to 100 s). That time grows on easy
  levels and in the tutorial, and with the neon sign.
- **Rush hour** (from level 3): once a shift, from 45% of the way in, for 35 s. Orders come twice
  as fast and pay 1.5×.
- **Food critic** (from level 4): once a shift, somewhere between 20% and 70% of the way in.
  - They wait three-quarters as long as other customers.
  - A dish seasoned just right and served before their ticket turns red earns a rave review:
    +25 points, and they pay their bill twice over.
  - If they walk out, it costs 20 points.
- **Spoiled produce** (levels 5, 6 and 10): 10 to 25% of crate produce is mouldy.
- **Power cuts and storms** (levels 6 and 10): power cuts make everyone talk; storms make everyone
  watch the deaf chef.
- **Fires** (from level 2): burnt food left on a stove for 8 s catches fire.
  - It costs 10 points, and spreads to the next stove after 12 s.
  - Hold F at it for 1.5 s to smother it. Anyone can.
- **Oil spills** (from level 6, once a shift): chefs in the puddle move at 45% speed until someone
  holds F on it for 2 s.
- **Washing up** (from level 5, except 7): the racks hold 4 plates and 3 bowls. Nothing washes
  itself: a customer who's eaten carries their dirty dish to the till and leaves it on the
  self-service dirty dish counter beside it, and a wasted dish leaves a dirty plate in your hands. Take each one to the sink (Space),
  then hold F there for 1.5 s to wash it. Dirty dishes can't be filled, served or put back on a
  rack.
- **Kids** (from level 3): one customer in five wants the dish plain, with no seasoning at all.
- **Booster seats** (from level 8): a kid stands by their chair ("Booster seat?") until the head chef, empty-handed at the pass, puts a booster seat out. The kid fetches it, carries it back and sits on it. With no head chef, whoever runs the till does it. Their order timer keeps running while they wait.
- **Layouts:** levels 4 to 6 and 8 to 10 each rearrange the middle of the room: an island,
  a split kitchen, or a corridor behind the stoves.

## 7. Between shifts

- **Levels:**
  - Street food stand: levels 1 to 6.
  - Burmese restaurant: levels 7 to 10. It opens at 500 total sales and a star on Storm night.
  - A tutorial kitchen, which the very first *Let's Play* opens. Online, the host can start it as
    a **warm-up** round for the whole crew before the real shift.
- **Upgrades** (60 to 120 coins), each in place from the next shift:
  - sharp knives;
  - better fridge seals;
  - copper pans;
  - a tip jar;
  - a neon sign.
- **Daily special:** one shift a day with a twist. Friends get the same one, and no twist comes
  two days in a row.
  - The twists are Busy day, Big tippers, Combo party, Stormy night, Power trouble, Critics in
    town, Picky eaters, Phone frenzy and Half the menu.
  - The first finish each day with a star pays 40 coins, plus 10 for each day of streak (up to
    +50).
- **Overtime:** a shift that has three stars when the clock runs out keeps going, busier and
  busier, until a customer gives up (2 minutes at most). Each level keeps its high score.
- **Shop:** besides upgrades, hats for your chef (seen by everyone) and decor for the terrace (seen
  in your own game).
- **Stickers:** 25 stickers in an album in the play menu, for moments and long goals:
  - a perfect sizzle;
  - a 6× combo;
  - cooking in the dark;
  - a rave review;
  - no lost customers;
  - a 7-day streak;
  - three stars at a restaurant.

## 8. Where it lives

| What | Where |
|---|---|
| Rules (recipes, levels, timings, restaurants, upgrades) | `shared/src/rules.ts` |
| Kitchen layouts | `shared/src/layout.ts` |
| Pace (Cozy or Classic) | `PACES` in `shared/src/rules.ts`; the setting in `client/src/pace.ts` |
| Music | `client/src/music.ts` |
| Helper bot | `shared/src/bots.ts` |
| Comfort settings (sound, voices, text, graphics, motion) | `client/src/prefs.ts` |
| Hats | `shared/src/looks.ts`, `client/src/looks.ts`; drawn in `client/src/game/chef.ts` |
| Terrace decor | `client/src/decor.ts`, `client/src/game/terrace.ts` |
| The state, one step of the world, every action | `shared/src/state.ts` |
| Roles and senses | `shared/src/roles.ts` |
| Customers | `shared/src/diners.ts` |
| Daily twists | `shared/src/twists.ts` |
| The coach's checklist | `shared/src/guide.ts` |
| Solo play | the browser runs `LocalSession` |
| Online play | `server/src/index.ts` owns the world at 20 Hz; each client moves its own chef |
| End screen report, awards, stickers | `client/src/game/report.ts`, `client/src/game/awards.ts`, `client/src/stickers.ts` |
| Progress (stars, coins, daily record, stickers) | the browser's localStorage |
