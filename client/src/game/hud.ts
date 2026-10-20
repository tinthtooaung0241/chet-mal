// The in-game HUD drawn over the kitchen: pinned order tickets, coin score with pop-ups and a
// star meter, a round clock, the hand slot with contextual key prompts, what you're looking at,
// and a role badge listing your senses. Text stays real DOM so screen readers can use it.
import {
  LEVELS,
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
} from "@kitchen/shared";
import { FOOD_ICONS, actionHints, itemIcon, stationIcon } from "./hints";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function clock(seconds: number): string {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const ROLE_LOOK: Record<Role, { emoji: string; color: string }> = {
  full: { emoji: "🌟", color: "#3a6ea5" },
  blind: { emoji: "🦯", color: "#2a9d8f" },
  deaf: { emoji: "🧏", color: "#e07a3f" },
  mute: { emoji: "🤐", color: "#8e6bbf" },
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
    $("role-avatar").textContent = look.emoji;
    $("role-badge").style.setProperty("--role-color", look.color);
    const senses: [string, boolean][] = [
      ["👁 Sight", info.sees],
      ["👂 Hearing", info.hears],
      role === "mute" ? ["💬 Signs", true] : ["🗣 Voice", true],
    ];
    $("senses").replaceChildren(
      ...senses.map(([label, on]) => {
        const li = document.createElement("li");
        li.textContent = label;
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
    const heldText = held ? `${describeItem(held)}${mouldy ? " (mouldy!)" : ""}` : "nothing";
    if (heldText !== this.lastHeld) {
      this.lastHeld = heldText;
      this.held.textContent = heldText;
      this.held.classList.toggle("mouldy", mouldy);
      this.heldIcon.textContent = itemIcon(held);
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
    if (showTag) this.setText(this.targetTag, target ? `${stationIcon(target)} ${stationName(target)}${contents}` : `🧑‍🍳 ${mate!.name}`);

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

    this.syncOrders(game, me.role, sees);
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
        s.textContent = "★";
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
    const key = `${role}|${sees}|${known.map((o) => o.id).join(",")}`;
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
          tag.textContent = order.channel === "ticket" ? `Ticket #${order.id}` : "Phone order (heard)";
          const name = document.createElement("strong");
          name.textContent = `${order.recipe.vessel === "bowl" ? "🍲 " : ""}${order.recipe.name}`;
          const icons = document.createElement("div");
          icons.className = "dish-icons";
          for (const item of order.recipe.items) {
            const chip = document.createElement("span");
            chip.className = "ing";
            const icon = document.createElement("b");
            icon.textContent = FOOD_ICONS[item.kind] ?? "🍽️";
            icon.setAttribute("aria-hidden", "true");
            const how = item.state === "chopped" ? "🔪 chopped" : item.state === "cooked" ? "🔥 cooked" : "";
            chip.append(icon, `${how} ${item.kind.toLowerCase()}`.trim());
            icons.append(chip);
          }
          li.append(tag, name, icons);
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
