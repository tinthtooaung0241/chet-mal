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
  starsFor,
  stationName,
  targetStation,
  type Chef,
  type Game,
  type Role,
  type Spice,
  type Station,
} from "@kitchen/shared";
import { glyph, img } from "../ui/icons";
import { SPICE_GLYPHS, actionHints, foodIcon, itemIconNode, soupIcon, stationIconNode, stockIconNode, stockName } from "./hints";

/** Tables on the terrace, numbered left to right. */
const TABLES = [...new Set(SEATS.map((s) => s.table.join()))].sort((a, b) => Number(a.split(",")[0]) - Number(b.split(",")[0]));
const tableNumber = (seat: number) => TABLES.indexOf(SEATS[seat].table.join()) + 1;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function clock(seconds: number): string {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const ROLE_LOOK: Record<Role, { avatar: string | null; color: string }> = {
  full: { avatar: null, color: "#3a6ea5" },
  blind: { avatar: "Avatar_Blind", color: "#2a9d8f" },
  deaf: { avatar: "Avatar_Deaf", color: "#e07a3f" },
  mute: { avatar: "Avatar_Mute", color: "#8e6bbf" },
};

export class Hud {
  private readonly orders = $<HTMLOListElement>("orders");
  private readonly score = $("score");
  private readonly scorePops = $("score-pops");
  private readonly starFill = $("star-fill");
  private readonly starMarks = [...document.querySelectorAll<HTMLElement>(".star-mark")];
  private readonly clockChip = $("clock");
  private readonly clockRing = $("clock-ring");
  private readonly time = $("time");
  private readonly levelNumber = $("level-number");
  private readonly levelName = $("level-name");
  private readonly handSlot = $("hand-slot");
  private readonly heldIcon = $("held-icon");
  private readonly held = $("held");
  private readonly facing = $("facing");
  private readonly prompts = $("prompts");
  private readonly targetTag = $("target-tag");
  private readonly crosshair = $("crosshair");
  private readonly gameOver = $<HTMLDialogElement>("game-over");
  private readonly finalText = $("final-score");
  private readonly finalStars = $("final-stars");
  private readonly finalStats = $("final-stats");
  private readonly nextLevel = $<HTMLButtonElement>("next-level");
  private readonly blindfold = $("blindfold");
  private readonly signals = $("signals");
  private readonly picker = $("picker");
  private lastPicker = "";
  private orderKey = "";
  private bars = new Map<number, HTMLElement>();
  private lastScore: number | null = null;
  private lastHeld = "";
  private lastPrompts = "";

  setRole(role: Role) {
    const info = ROLES[role];
    const look = ROLE_LOOK[role];
    $("role-name").textContent = info.name;
    $("role-summary").textContent = info.summary;
    $("role-avatar").replaceChildren(look.avatar ? img(look.avatar) : glyph("chef"));
    $("role-badge").style.setProperty("--role-color", look.color);
    const senses: [string, string, boolean][] = [
      ["eye", "Sight", info.sees],
      ["ear", "Hearing", info.hears],
      role === "mute" ? ["signs", "Signs", true] : ["voice", "Voice", true],
    ];
    $("senses").replaceChildren(
      ...senses.map(([icon, label, on]) => {
        const li = document.createElement("li");
        li.append(glyph(icon), label);
        if (!on) li.classList.add("off");
        return li;
      }),
    );
    this.blindfold.hidden = info.sees;
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

  update(game: Game, me: Chef, firstPerson: boolean) {
    const level = levelByNumber(game.level);
    this.setText(this.levelNumber, String(level.n));
    this.setText(this.levelName, level.name);
    this.syncScore(game.score, level.stars);
    this.setText(this.time, clock(game.timeLeft));
    this.clockRing.style.setProperty("--left", String(Math.max(0, game.timeLeft / level.time)));
    this.clockChip.classList.toggle("urgent", game.timeLeft < 30);

    // hands
    const { sees } = currentSenses(game, me);
    const held = me.held;
    const mouldy =
      sees && !!held && (held.type === "food" ? held.spoiled : held.type === "bowl" ? held.spoiled : held.contents.some((f) => f.spoiled));
    // fridge food you're holding: still cold, or warming up (you can feel it, whatever your senses)
    const coldFood = held?.type === "food" && FOOD_RULES[held.kind]?.cold && !held.spoiled && (held.state === "raw" || held.state === "chopped") ? held : null;
    const temp = coldFood ? (coldFood.warm ? " (getting warm!)" : " (cold)") : "";
    const heldText = held ? `${describeItem(held)}${mouldy ? " (mouldy!)" : temp}` : "nothing";
    if (heldText !== this.lastHeld) {
      this.lastHeld = heldText;
      this.held.textContent = heldText;
      this.held.classList.toggle("mouldy", mouldy);
      this.handSlot.classList.toggle("cold", !!coldFood && !coldFood.warm);
      this.handSlot.classList.toggle("warm", !!coldFood?.warm);
      this.heldIcon.replaceChildren(itemIconNode(held));
      this.handSlot.classList.toggle("empty", !held);
      this.handSlot.classList.remove("changed");
      void this.handSlot.offsetWidth; // restart the little bump animation
      this.handSlot.classList.add("changed");
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
      this.targetTag.replaceChildren(target ? stationIconNode(target) : glyph("chef"), tagText);
    }

    // contextual key prompts
    const hints = actionHints(game, me);
    const key = hints.map((h) => `${h.key}:${h.text}`).join("|");
    if (key !== this.lastPrompts) {
      this.lastPrompts = key;
      this.prompts.replaceChildren(
        ...hints.map((h) => {
          const el = document.createElement("span");
          el.className = h.key ? "prompt" : "prompt info";
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

    this.syncOrders(game, me.role, sees);
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
    const top = stars[2];
    this.starFill.style.width = `${Math.min(100, (score / top) * 100)}%`;
    this.starMarks.forEach((mark, i) => {
      mark.style.left = `${(stars[i] / top) * 100}%`;
      mark.classList.toggle("earned", score >= stars[i]);
    });
  }

  /** @returns the stars earned */
  showGameOver(game: Game): number {
    const level = levelByNumber(game.level);
    const stars = starsFor(level, game.score);
    const next = level.stars.find((s) => game.score < s);
    const goal = next ? `${next - game.score} more points for the next star.` : "Top marks — three stars!";
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
    this.finalStats.replaceChildren(stat("Score", game.score), stat("Dishes", game.served), stat("Perfect", game.perfects));
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
  private syncOrders(game: Game, role: Role, sees: boolean) {
    const { hears } = ROLES[role];
    const known = game.orders.filter((o) => (o.channel === "ticket" ? sees : hears));
    const seated = new Map(game.diners.map((d) => [d.orderId, d.seat]));
    const key = `${role}|${sees}|${known.map((o) => `${o.id}:${seated.get(o.id) ?? ""}`).join(",")}`;
    if (key !== this.orderKey) {
      this.orderKey = key;
      this.bars.clear();
      this.orders.replaceChildren(
        ...known.map((order) => {
          const li = document.createElement("li");
          li.className = `order ${order.channel}`;
          li.style.setProperty("--tilt", `${((order.id * 37) % 5) - 2}deg`);
          const tag = document.createElement("span");
          tag.className = "tag";
          const seat = seated.get(order.id);
          const table = seat === undefined ? "" : ` · Table ${tableNumber(seat)}`;
          tag.textContent = order.channel === "ticket" ? `#${order.id}${table}` : `Phone${table}`;
          const name = document.createElement("strong");
          name.textContent = order.recipe.name;
          if (order.channel === "phone") {
            const badge = document.createElement("span");
            badge.className = "phone-badge";
            badge.append(glyph("phone"));
            li.append(badge);
          }
          // the finished dish, then exactly what goes into it (pictured in the right state)
          const dish = document.createElement("div");
          dish.className = "dish";
          if (order.recipe.vessel === "bowl") dish.append(img(soupIcon(order.recipe.items.map((i) => i.kind))));
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
          li.append(tag, name, dish, icons);
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
    for (const order of known) {
      const fill = this.bars.get(order.id);
      if (!fill) continue;
      const left = order.timeLeft / order.recipe.time;
      fill.style.width = `${(left * 100).toFixed(1)}%`;
      fill.parentElement!.parentElement!.classList.toggle("urgent", left < 0.25);
    }
  }
}
