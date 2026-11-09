# Kitchen Co-op: game design

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

Chefs can hand things to each other (use while facing a teammate) and lead each other by the hand
(H). A ping (G) names what you hold or point at.

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
   3. Season at the rack. Some spices go on before cooking, some straight after.
   4. Cook on a stove, or in the soup pot (three chopped ingredients, 10 s).
   5. Plate it, or ladle soup into a bowl.
   6. Add the finishing spices on top.
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
- **Washing up** (from level 5, except 7): the racks hold 4 plates and 3 bowls. Every eaten or
  wasted dish comes back dirty; hold F at the sink for 1.5 s to wash one.
- **Kids** (from level 3): one customer in five wants the dish plain, with no seasoning at all.
- **Layouts:** levels 4 to 6 and 8 to 10 each rearrange the middle of the room: an island,
  a split kitchen, or a corridor behind the stoves.

## 7. Between shifts

- **Levels:**
  - Street food stand: levels 1 to 6.
  - Burmese restaurant: levels 7 to 10. It opens at 500 total sales and a star on Storm night.
  - A tutorial kitchen, which the very first *Let's Play* opens.
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
