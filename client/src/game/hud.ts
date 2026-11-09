// The in-game HUD drawn over the kitchen: pinned order tickets, coin score with pop-ups and a
// star meter, a round clock, the hand slot with contextual key prompts, what you're looking at,
// and a role badge listing your senses. Text stays real DOM so screen readers can use it.
import {
  FOOD_RULES,
  LEVELS,
  SEATS,
  SPICE_NAMES,
  spiceList,
  ROLES,
  chefInFront,
  currentSenses,
  describeItem,
  describePot,
  levelByNumber,
  shiftTime,
  levelsAt,
  venueById,
  comboWindow,
  starGoals,
  starsFor,
  stationName,
  targetStation,
  type Chef,
  type Game,
  type Role,
  type Spice,
  type Station,
  type Guide,
  guideFor,
  orderProgress,
} from "@kitchen/shared";
import { glyph, img, renderedIcon } from "../ui/icons";
import { SPICE_GLYPHS, actionHints, foodIcon, itemIconNode, soupIcon, stationIconNode, stockIconNode, stockName } from "./hints";
import { $ } from "../ui/dom";
import { teamAwards } from "./awards";
import { nextTimeTip, shiftReport } from "./report";

/** Tables on the terrace, numbered left to right. */
const TABLES = [...new Set(SEATS.map((s) => s.table.join()))].sort((a, b) => Number(a.split(",")[0]) - Number(b.split(",")[0]));
const tableNumber = (seat: number) => TABLES.indexOf(SEATS[seat].table.join()) + 1;

function clock(seconds: number): string {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const ROLE_LOOK: Record<Role, { icon: string; color: string }> = {
  full: { icon: "star", color: "#dce8f7" },
  head: { icon: "chef", color: "#fbe9b7" },
  deaf: { icon: "ear", color: "#fbdfd6" },
  mute: { icon: "voice", color: "#e7dcf6" },
};

/** Each role's one limit (icon, words) and a short hint on working around it. */
const ROLE_LIMITS: Record<Role, [string, string, string]> = {
  full: ["star", "No limits", "Practice every job"],
  head: ["cross", "Can't cook", "Call orders, plate, serve, run the till"],
  deaf: ["ear", "Can't hear", "Watch for pings and signs"],
  mute: ["voice", "Can't speak", "Point and sign. Only you can charm customers"],
};

export class Hud {
  private readonly orders = $<HTMLOListElement>("orders");
  private readonly score = $("score");
  private readonly scorePops = $("score-pops");
  private readonly starFill = $("star-fill");
  private readonly starGoal = $("star-goal");
  private readonly starMarks = [...document.querySelectorAll<HTMLElement>(".star-mark")];
  private readonly clockChip = $("clock");
  private readonly clockRing = $("clock-ring");
  private readonly time = $("time");
  private readonly levelNumber = $("level-number");
  private readonly levelName = $("level-name");
  private readonly handSlot = $("hand-slot");
  private readonly heldIcon = $("held-icon");
  /** phones: what you hold, as an icon bubble on the Use button */
  private readonly touchHeld = document.getElementById("touch-held");
  private readonly held = $("held");
  private readonly facing = $("facing");
  private readonly prompts = $("prompts");
  /** tickets tapped open on a phone (folded into small chips otherwise) */
  private readonly openOrders = new Set<number>();
  /** told whenever the action hints change (the touch buttons follow them) */
  onHints?: (hints: { key?: string; text: string }[]) => void;

  constructor() {
    // on a phone, tap a ticket chip to open the full ticket, tap again to fold it
    this.orders.addEventListener("click", (e) => {
      const li = (e.target as Element).closest<HTMLElement>(".order");
      if (!li?.dataset.id) return;
      const id = Number(li.dataset.id);
      if (!this.openOrders.delete(id)) this.openOrders.add(id);
      li.classList.toggle("open", this.openOrders.has(id));
    });
  }
  private readonly targetTag = $("target-tag");
  private readonly crosshair = $("crosshair");
  private readonly gameOver = $<HTMLDialogElement>("game-over");
  private readonly finalText = $("final-score");
  private readonly finalStars = $("final-stars");
  private readonly overChet = $<HTMLImageElement>("over-chet");
  private readonly finalStats = $("final-stats");
  private readonly finalAwards = $("final-awards");
  private readonly finalReport = $("final-report");
  private readonly finalTip = $("final-tip");
  private readonly combo = $("combo");
  private readonly comboCount = $("combo-count");
  private readonly comboFill = $("combo-fill");
  private readonly rushTag = $("rush-tag");
  private readonly rushTime = $("rush-time");
  private lastCombo = 0;
  private readonly nextLevel = $<HTMLButtonElement>("next-level");
  private readonly signals = $("signals");
  private readonly picker = $("picker");
  private readonly tillCoins = $("till-coins");
  private readonly tagBar = Object.assign(document.createElement("span"), { className: "tag-bar", hidden: true });
  private readonly tagFill = document.createElement("i");
  private readonly checklist = $("checklist");
  private readonly checklistSteps = $<HTMLOListElement>("checklist-steps");
  private readonly coach = $("coach");
  private lastGuide = "";
  private lastPicker = "";
  private orderKey = "";
  private bars = new Map<number, HTMLElement>();
  /** ingredient chips of each ticket, in recipe order */
  private ingChips = new Map<number, HTMLElement[]>();
  /** the "who's on it" badges of each ticket, and who they showed last */
  private crewEls = new Map<number, HTMLElement>();
  private crewKeys = new Map<number, string>();
  private lastScore: number | null = null;
  private lastHeld = "";
  private lastPrompts = "";

  setRole(role: Role) {
    const info = ROLES[role];
    const look = ROLE_LOOK[role];
    $("role-name").textContent = info.name;
    $("role-summary").textContent = info.summary;
    $("role-avatar").replaceChildren(glyph(look.icon));
    $("role-badge").style.setProperty("--role-color", look.color);
    // what matters is your limit (it's why you need your friends), and what to do about it
    const [limitIcon, limit, tip] = ROLE_LIMITS[role];
    const limitEl = $("role-limit");
    limitEl.replaceChildren(glyph(limitIcon), limit);
    limitEl.classList.toggle("none", role === "full");
    $("role-tip").textContent = tip;
    $("role-badge").title = `${info.name}: ${limit.toLowerCase()}. ${tip}.`;
    this.signals.hidden = !info.signals;
    document.body.dataset.role = role;
    for (const input of document.querySelectorAll<HTMLInputElement>("input[name=role]")) input.checked = input.value === role;
    this.orderKey = ""; // rebuild the order list for the new senses
  }

  /** New round: forget the last score so it doesn't pop "-120". */
  reset() {
    this.lastScore = null;
    this.lastHeld = "";
    this.lastPrompts = "";
    this.orderKey = "";
  }

  /** @param bar the progress bar of the station you're facing (shown in the target tag in first person) */
  update(game: Game, me: Chef, firstPerson: boolean, bar: { progress: number; color: string } | null = null) {
    const level = levelByNumber(game.level);
    // shifts count within each restaurant; the pill's tooltip says which restaurant it is
    const shift = levelsAt(level.venue).indexOf(level) + 1;
    this.setText(this.levelNumber, level.tutorial ? "T" : String(shift || level.n));
    this.setText(this.levelName, level.name);
    this.setText($("venue-short"), level.tutorial ? "Tutorial" : venueById(level.venue).short);
    // the restaurant's logo stands in for its name; the shift number sits on it
    const logo = $("venue-logo");
    if (logo.dataset.venue !== level.venue) {
      logo.dataset.venue = level.venue;
      logo.replaceChildren(glyph(`logo-${level.venue}`));
    }
    this.levelNumber.closest<HTMLElement>("#level-chip")!.title = `${venueById(level.venue).name}: ${level.name}`;
    this.syncScore(game.score, starGoals(level, game.crew));
    this.syncCombo(game);
    this.setText(this.tillCoins, `Till ${game.coins ?? 0}`);
    this.tillCoins.hidden = !game.coins; // nothing to show until someone has paid
    // overtime counts up instead of down
    this.setText(this.time, game.overtime > 0 ? `+${clock(game.overtime)}` : clock(game.timeLeft));
    this.clockChip.classList.toggle("overtime", game.overtime > 0);
    this.clockRing.style.setProperty("--left", String(Math.max(0, game.timeLeft / shiftTime(game))));
    this.clockChip.classList.toggle("urgent", game.timeLeft < 30);
    // rush hour and combos only while the shift is on
    const rushing = game.phase === "playing" && game.rush > 0;
    this.clockChip.classList.toggle("rush", rushing);
    // the last ten seconds: the clock pulses (and ticks, for anyone who can hear)
    this.clockChip.classList.toggle("ending", game.phase === "playing" && game.timeLeft <= 10 && game.overtime === 0);
    this.rushTag.hidden = !rushing;
    if (rushing) this.setText(this.rushTime, `${Math.ceil(game.rush)}s`);

    // hands
    const { sees } = currentSenses(game, me);
    const held = me.held;
    const mouldy =
      sees && !!held && (held.type === "food" ? held.spoiled : held.type === "bowl" ? held.spoiled : held.contents.some((f) => f.spoiled));
    // fridge food you're holding: still cold, or warming up (you can feel it, whatever your senses)
    const coldFood = held?.type === "food" && FOOD_RULES[held.kind]?.cold && !held.spoiled && (held.state === "raw" || held.state === "chopped") ? held : null;
    const temp = coldFood ? (coldFood.warm ? " (getting warm!)" : " (cold)") : "";
    const bottle = me.spice ? SPICE_NAMES[me.spice.spice] : null;
    const heldText = bottle ? `the ${bottle}` : held ? `${describeItem(held)}${mouldy ? " (mouldy!)" : temp}` : "nothing";
    if (heldText !== this.lastHeld) {
      this.lastHeld = heldText;
      this.held.textContent = heldText;
      this.held.classList.toggle("mouldy", mouldy);
      this.handSlot.classList.toggle("cold", !!coldFood && !coldFood.warm);
      this.handSlot.classList.toggle("warm", !!coldFood?.warm);
      this.heldIcon.replaceChildren(me.spice ? glyph(SPICE_GLYPHS[me.spice.spice]) : itemIconNode(held));
      this.handSlot.classList.toggle("empty", !held && !me.spice);
      this.handSlot.classList.remove("changed");
      void this.handSlot.offsetWidth; // restart the little bump animation
      this.handSlot.classList.add("changed");
      if (this.touchHeld) {
        this.touchHeld.hidden = !held && !me.spice;
        this.touchHeld.replaceChildren(me.spice ? glyph(SPICE_GLYPHS[me.spice.spice]) : itemIconNode(held));
        this.touchHeld.title = heldText;
        this.touchHeld.classList.toggle("mouldy", mouldy);
        this.touchHeld.classList.toggle("cold", !!coldFood && !coldFood.warm);
        this.touchHeld.classList.toggle("warm", !!coldFood?.warm);
        this.touchHeld.classList.remove("changed");
        void this.touchHeld.offsetWidth;
        this.touchHeld.classList.add("changed");
      }
    }

    // what you're facing (text for screen readers; a tag under the crosshair for sighted players)
    const target = targetStation(game, me);
    const mate = target ? undefined : chefInFront(game, me);
    const contents = target?.pot ? ` (${describePot(target.pot)})` : target?.item ? ` (${describeItem(target.item)})` : "";
    this.setText(this.facing, target ? `${stationName(target)}${contents}` : (mate?.name ?? "nothing"));
    const showTag = firstPerson && sees && !!(target || mate);
    this.targetTag.hidden = !showTag;
    const tagText = target ? `${stationName(target)}${contents}` : (mate?.name ?? "");
    if (showTag && this.targetTag.dataset.text !== tagText) {
      this.targetTag.dataset.text = tagText;
      const label = document.createElement("span");
      label.textContent = tagText;
      this.tagBar.replaceChildren(this.tagFill);
      this.targetTag.replaceChildren(target ? stationIconNode(target) : glyph("chef"), label, this.tagBar);
    }
    // chopping / cooking progress for what you're facing, right under the crosshair
    this.tagBar.hidden = !bar;
    if (bar) {
      this.tagFill.style.width = `${(bar.progress * 100).toFixed(1)}%`;
      this.tagFill.style.background = bar.color;
    }

    // contextual key prompts
    const hints = actionHints(game, me);
    const key = hints.map((h) => `${h.key}:${h.text}`).join("|");
    if (key !== this.lastPrompts) {
      this.lastPrompts = key;
      this.onHints?.(hints);
      this.prompts.replaceChildren(
        ...hints.map((h) => {
          const el = document.createElement("span");
          el.className = h.key ? "prompt" : "prompt info";
          el.dataset.key = h.key ?? "";
          if (h.key) {
            const k = document.createElement("kbd");
            k.textContent = h.key;
            el.append(k);
          }
          el.append(h.text);
          return el;
        }),
      );
    }
    this.crosshair.classList.toggle("active", hints.some((h) => h.key));
    this.syncPicker(target?.stock?.length && game.phase === "playing" ? target : null, me);

    this.syncOrders(game, me.role, sees, me.id);
  }

  /**
   * The checklist for the dish in hand (or, in the guided shift and at a cozy pace, the most
   * urgent order), and the coach line with the next step.
   */
  syncGuide(game: Game, guide: Guide | null, coach: boolean) {
    const order = guide?.order ?? null;
    const seat = order ? game.diners.find((d) => d.orderId === order.id)?.seat : undefined;
    const key = guide ? `${order?.id}|${seat}|${guide.next}|${guide.steps.map((s) => `${s.text}${s.done}${s.wrong}${s.current}`).join()}` : "";
    if (key === this.lastGuide) return;
    this.lastGuide = key;
    this.checklist.hidden = !order;
    this.coach.hidden = !(coach && guide?.next);
    if (!guide) return;
    $("checklist-title").textContent = order?.recipe.name ?? "";
    $("checklist-table").textContent = seat === undefined ? "" : `Table ${tableNumber(seat)}`;
    this.checklistSteps.replaceChildren(
      ...guide.steps.map((step) => {
        const li = document.createElement("li");
        li.className = step.done ? "done" : step.wrong ? "wrong" : step.current ? "current" : "";
        const mark = document.createElement("span");
        mark.className = "mark";
        mark.textContent = step.done ? "✓" : step.wrong ? "✗" : step.current ? "▸" : "";
        li.append(mark, step.text);
        return li;
      }),
    );
    $("coach-text").textContent = guide.next ?? "";
    this.coach.classList.remove("changed");
    void this.coach.offsetWidth; // replay the little bounce for each new step
    this.coach.classList.add("changed");
  }

  /** Facing a fridge or spice rack: what's in it, with number keys, and what you've chosen. */
  private syncPicker(st: Station | null, me: Chef) {
    const dish = me.held && me.held.type !== "food" ? me.held : null;
    const pick = st ? Math.min(Math.max(0, me.pick || 0), st.stock!.length - 1) : -1;
    const key = st ? `${st.id}|${pick}|${dish?.season.join() ?? ""}` : "";
    if (key === this.lastPicker) return;
    this.lastPicker = key;
    this.picker.hidden = !st;
    if (!st) return;
    this.picker.className = st.kind;
    this.picker.replaceChildren(
      ...st.stock!.map((item, i) => {
        const chip = document.createElement("span");
        chip.className = "pick";
        chip.dataset.index = String(i); // tappable on touch screens
        if (i === pick) chip.classList.add("on");
        if (st.kind === "spice" && dish?.season.includes(item as Spice)) chip.classList.add("done");
        const k = document.createElement("kbd");
        k.textContent = String(i + 1);
        const label = document.createElement("span");
        label.textContent = stockName(st, item);
        chip.append(k, stockIconNode(st, item), label);
        return chip;
      }),
    );
  }

  private syncScore(score: number, stars: [number, number, number]) {
    if (this.lastScore !== null && score !== this.lastScore) {
      const diff = score - this.lastScore;
      const pop = document.createElement("span");
      pop.className = diff > 0 ? "score-pop" : "score-pop minus";
      pop.textContent = diff > 0 ? `+${diff}` : String(diff);
      this.scorePops.append(pop);
      setTimeout(() => pop.remove(), 1300);
      this.score.classList.remove("bump");
      void this.score.offsetWidth;
      this.score.classList.add("bump");
    }
    this.lastScore = score;
    this.setText(this.score, String(score));
    const next = stars.find((s) => score < s);
    this.setText(this.starGoal, next === undefined ? "★★★" : `/ ${next}`);
    const top = stars[2];
    this.starFill.style.width = `${Math.min(100, (score / top) * 100)}%`;
    this.starMarks.forEach((mark, i) => {
      mark.style.left = `${(stars[i] / top) * 100}%`;
      mark.classList.toggle("earned", score >= stars[i]);
    });
  }

  /** A combo of two or more: its count, and a bar that drains until the next dish must go out. */
  private syncCombo(game: Game) {
    const on = game.phase === "playing" && game.combo >= 2 && game.comboLeft > 0;
    this.combo.hidden = !on;
    if (on) {
      this.setText(this.comboCount, `×${game.combo}`);
      this.comboFill.style.setProperty("--left", Math.min(1, game.comboLeft / comboWindow(game)).toFixed(3));
      if (game.combo !== this.lastCombo) {
        // each new step pops the tag again
        this.combo.classList.remove("pop");
        void this.combo.offsetWidth;
        this.combo.classList.add("pop");
      }
    }
    this.lastCombo = on ? game.combo : 0;
  }

  /** @param meId your chef, whose award says "You" @returns the stars earned */
  showGameOver(game: Game, meId?: string): number {
    const level = levelByNumber(game.level);
    const goals = starGoals(level, game.crew);
    const stars = starsFor(level, game.score, game.crew);
    const next = goals.find((s) => game.score < s);
    const overtime = game.overtime > 0 ? ` Overtime added ${game.score - game.overtimeFrom} points.` : "";
    const goal = (next ? `${next - game.score} more points for the next star.` : "Top marks — three stars!") + overtime;
    this.overChet.src = stars > 0 ? "/chet.svg" : "/chet-oops.svg";
    this.finalStars.replaceChildren(
      ...[0, 1, 2].map((i) => {
        const s = document.createElement("span");
        s.className = i < stars ? "star on" : "star";
        s.style.animationDelay = `${0.25 + i * 0.25}s`;
        s.append(glyph("star"));
        return s;
      }),
    );
    this.finalText.textContent = `${level.name}: ${stars} of 3 stars. ${goal}`;
    const stat = (label: string, value: string | number) => {
      const div = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = String(value);
      div.append(dt, dd);
      return div;
    };
    this.finalStats.replaceChildren(stat("Score", game.score), stat("Dishes", game.served), stat("Perfect", game.perfects), stat("Takings", game.coins ?? 0));
    // where the points came from and went: together the lines make the score
    this.finalReport.replaceChildren(
      ...shiftReport(game).map((line) => {
        const li = document.createElement("li");
        if (line.points < 0) li.className = "lost";
        const label = document.createElement("span");
        label.textContent = line.label;
        const points = document.createElement("b");
        points.textContent = line.points > 0 ? `+${line.points}` : `−${-line.points}`;
        li.append(glyph(line.icon), label, points);
        return li;
      }),
    );
    const tip = nextTimeTip(game, game.chefs.find((c) => c.id === meId)?.role ?? "full");
    this.finalTip.hidden = !tip;
    const tipText = document.createElement("span");
    tipText.textContent = `Next time: ${tip ?? ""}`;
    this.finalTip.replaceChildren(glyph("chef"), tipText);
    this.finalAwards.replaceChildren(
      ...teamAwards(game).map((award) => {
        const li = document.createElement("li");
        const who = document.createElement("strong");
        who.textContent = award.chef.id === meId ? "You" : award.chef.name;
        const title = document.createElement("span");
        title.textContent = award.title;
        const detail = document.createElement("small");
        detail.textContent = award.detail;
        const words = document.createElement("span");
        words.className = "award-words";
        words.append(who, title, detail);
        li.append(glyph(award.icon), words);
        return li;
      }),
    );
    this.nextLevel.hidden = stars === 0 || level.n >= LEVELS.length;
    if (!this.gameOver.open) this.gameOver.showModal();
    return stars;
  }

  hideGameOver() {
    if (this.gameOver.open) this.gameOver.close();
  }

  private setText(el: HTMLElement, text: string) {
    if (el.textContent !== text) el.textContent = text;
  }

  /** Only orders this role could know: printed tickets need sight, phone orders need hearing. */
  /** @param me your chef's id, whose badge says "you" */
  private syncOrders(game: Game, role: Role, sees: boolean, me: string) {
    const { hears } = ROLES[role];
    const known = game.orders.filter((o) => (o.channel === "ticket" ? sees : hears));
    const seated = new Map(game.diners.map((d) => [d.orderId, d.seat]));
    const key = `${role}|${sees}|${known.map((o) => `${o.id}:${seated.get(o.id) ?? ""}`).join(",")}`;
    if (key !== this.orderKey) {
      this.orderKey = key;
      this.bars.clear();
      this.ingChips.clear();
      this.crewEls.clear();
      this.crewKeys.clear();
      this.orders.replaceChildren(
        ...known.map((order) => {
          const li = document.createElement("li");
          li.className = `order ${order.channel}`;
          li.dataset.id = String(order.id);
          if (this.openOrders.has(order.id)) li.classList.add("open");
          li.style.setProperty("--tilt", `${((order.id * 37) % 5) - 2}deg`);
          const tag = document.createElement("span");
          tag.className = "tag";
          const seat = seated.get(order.id);
          // what a player needs: which table it's for (the order number is just noise)
          const table = seat === undefined ? "" : `Table ${tableNumber(seat)}`;
          const who = [order.critic ? "Critic" : order.kid ? "Kid" : "", order.channel === "phone" ? "Phone" : ""].filter(Boolean).join(" ");
          tag.textContent = [who, table].filter(Boolean).join(" · ") || "Walk-in";
          const name = document.createElement("strong");
          name.textContent = order.recipe.name;
          if (order.channel === "phone") {
            const badge = document.createElement("span");
            badge.className = "phone-badge";
            badge.append(glyph("phone"));
            li.append(badge);
          }
          // who's working on it: a role badge for every chef carrying or heading for something for it
          const crew = document.createElement("span");
          crew.className = "order-crew";
          this.crewEls.set(order.id, crew);
          li.append(crew);
          if (order.critic) {
            li.classList.add("critic");
            const badge = document.createElement("span");
            badge.className = "critic-badge";
            badge.append(glyph("critic"));
            li.append(badge);
          }
          // the finished dish, then exactly what goes into it (pictured in the right state)
          const dish = document.createElement("div");
          dish.className = "dish";
          if (renderedIcon(`Dish_${order.recipe.id}`)) dish.append(img(`Dish_${order.recipe.id}`));
          else if (order.recipe.vessel === "bowl") dish.append(img(soupIcon(order.recipe.items.map((i) => i.kind))));
          else {
            dish.append(img("Plate"));
            for (const item of order.recipe.items) {
              const food = img(foodIcon(item.kind, item.state));
              food.classList.add("on-plate");
              dish.append(food);
            }
            dish.dataset.count = String(order.recipe.items.length);
          }
          const icons = document.createElement("div");
          icons.className = "dish-icons";
          for (const item of order.recipe.items) {
            const chip = document.createElement("span");
            chip.className = "ing";
            if (!this.ingChips.has(order.id)) this.ingChips.set(order.id, []);
            this.ingChips.get(order.id)!.push(chip);
            // read left to right like the procedure: food, seasoning that goes on first, how it's
            // cooked, then seasoning that goes on straight after
            const spices = (item.season ?? []).map((sp) => {
              const g = glyph(SPICE_GLYPHS[sp]);
              g.classList.add("ing-spice");
              return g;
            });
            const before = item.seasonAt === "before" ? spices : [];
            const after = item.seasonAt === "after" ? spices : [];
            chip.append(img(foodIcon(item.kind, item.state)), ...before, glyph(item.state === "cooked" ? "flame" : item.state === "chopped" ? "knife" : "check"), ...after);
            const seasoned = item.season?.length ? `, ${spiceList(item.season)} ${item.seasonAt === "after" ? "after cooking" : "before cooking"}` : "";
            chip.title = `${item.state} ${item.kind.toLowerCase()}${seasoned}`;
            if (spices.length) chip.classList.add("seasoned");
            const label = document.createElement("span");
            label.className = "visually-hidden";
            label.textContent = chip.title;
            chip.append(label);
            icons.append(chip);
          }
          // finishing touches on the plate, last
          for (const spice of order.recipe.finish ?? []) {
            const chip = document.createElement("span");
            chip.className = "ing spice";
            chip.title = `finish with ${SPICE_NAMES[spice]}`;
            chip.append(glyph(SPICE_GLYPHS[spice]));
            const label = document.createElement("span");
            label.className = "visually-hidden";
            label.textContent = chip.title;
            chip.append(label);
            icons.append(chip);
          }
          // cooks look the method up in the recipe book; the head chef keeps the ingredient row,
          // because its progress dots are how they see each dish coming along
          if (role === "head") li.append(tag, name, dish, icons);
          else {
            const hint = document.createElement("span");
            hint.className = "book-hint";
            hint.append(glyph("book"), "Recipe ", Object.assign(document.createElement("kbd"), { textContent: "R" }));
            li.append(tag, name, dish, hint);
          }
          // a printed ticket shows its timer; a phone order is only what you remember hearing
          if (order.channel === "ticket") {
            const bar = document.createElement("div");
            bar.className = "order-bar";
            bar.setAttribute("aria-hidden", "true");
            const fill = document.createElement("i");
            bar.append(fill);
            this.bars.set(order.id, fill);
            li.append(bar);
          }
          return li;
        }),
      );
    }
    // who's on which ticket: what each chef carries is for one order, and at a cozy pace the coach
    // sends empty hands to one (the same rules on every screen, so everyone sees the same split)
    const on = new Map<number, Chef[]>();
    for (const chef of game.chefs) {
      if (chef.bot) continue;
      const id = guideFor(game, chef)?.order?.id;
      if (id !== undefined) on.set(id, [...(on.get(id) ?? []), chef]);
    }
    for (const order of known) {
      const el = this.crewEls.get(order.id);
      if (!el) continue;
      const crew = on.get(order.id) ?? [];
      const key = crew.map((c) => `${c.id}:${c.role}`).join();
      if (this.crewKeys.get(order.id) === key) continue;
      this.crewKeys.set(order.id, key);
      el.replaceChildren(
        ...crew.map((c) => {
          const chip = document.createElement("span");
          chip.className = c.id === me ? "crew-chip me" : "crew-chip";
          chip.style.setProperty("--role-color", ROLE_LOOK[c.role].color);
          chip.title = c.id === me ? "You're on this one" : `${c.name.split(" (")[0]} (${ROLES[c.role].name.toLowerCase()}) is on this one`;
          chip.append(glyph(ROLE_LOOK[c.role].icon));
          return chip;
        }),
      );
      el.setAttribute("aria-label", crew.length ? crew.map((c) => (c.id === me ? "you" : c.name.split(" (")[0])).join(", ") + " on this order" : "");
    }
    // the head chef sees how each dish is coming along: a dot on every ingredient
    for (const order of known) {
      const chips = this.ingChips.get(order.id);
      if (!chips) continue;
      const progress = role === "head" ? orderProgress(game, order) : null;
      chips.forEach((chip, i) => {
        const state = progress?.[i] ?? "";
        if (chip.dataset.progress !== state) chip.dataset.progress = state;
      });
    }
    for (const order of known) {
      const fill = this.bars.get(order.id);
      if (!fill) continue;
      const left = order.timeLeft / order.recipe.time;
      fill.style.width = `${(left * 100).toFixed(1)}%`;
      fill.parentElement!.parentElement!.classList.toggle("urgent", left < 0.25);
    }
  }
}
