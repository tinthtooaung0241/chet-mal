import {
  LEVELS,
  ROLES,
  chefInFront,
  currentSenses,
  levelByNumber,
  starsFor,
  describeItem,
  describeRecipe,
  stationName,
  targetStation,
  type Chef,
  type Game,
  type Role,
} from "@kitchen/shared";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function clock(seconds: number): string {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** DOM overlay: orders, score, clock, role, what the chef holds and faces. */
export class Hud {
  private readonly orders = $<HTMLOListElement>("orders");
  private readonly score = $("score");
  private readonly time = $("time");
  private readonly held = $("held");
  private readonly facing = $("facing");
  private readonly paused = $("paused");
  private readonly gameOver = $<HTMLDialogElement>("game-over");
  private readonly finalText = $("final-score");
  private readonly finalStars = $("final-stars");
  private readonly nextLevel = $<HTMLButtonElement>("next-level");
  private readonly levelNumber = $("level-number");
  private readonly roleName = $("role-name");
  private readonly roleSummary = $("role-summary");
  private readonly blindfold = $("blindfold");
  private readonly signals = $("signals");
  private orderKey = "";
  private bars = new Map<number, HTMLElement>();

  setRole(role: Role) {
    const info = ROLES[role];
    this.roleName.textContent = info.name;
    this.roleSummary.textContent = info.summary;
    this.blindfold.hidden = info.sees;
    this.signals.hidden = !info.signals;
    document.body.dataset.role = role;
    for (const input of document.querySelectorAll<HTMLInputElement>("input[name=role]")) {
      input.checked = input.value === role;
    }
    this.orderKey = ""; // rebuild the order list for the new senses
  }

  update(game: Game, me: Chef, isPaused: boolean) {
    const role = me.role;
    const level = levelByNumber(game.level);
    this.setText(this.levelNumber, String(level.n));
    this.levelNumber.title = level.name;
    this.score.textContent = String(game.score);
    this.time.textContent = clock(game.timeLeft);
    this.time.classList.toggle("urgent", game.timeLeft < 30);
    this.paused.hidden = !isPaused;
    const { sees } = currentSenses(game, me);
    const mouldy = sees && me.held && (me.held.type === "food" ? me.held.spoiled : me.held.contents.some((f) => f.spoiled));
    this.setText(this.held, me.held ? `${describeItem(me.held)}${mouldy ? " (mouldy!)" : ""}` : "nothing");
    const target = targetStation(game, me);
    const mate = target ? undefined : chefInFront(game, me);
    this.setText(
      this.facing,
      target
        ? `${stationName(target)}${target.item ? ` (${describeItem(target.item)})` : ""}`
        : (mate?.name ?? "nothing"),
    );
    this.syncOrders(game, role, sees);
  }

  /** @returns the stars earned */
  showGameOver(game: Game): number {
    const level = levelByNumber(game.level);
    const stars = starsFor(level, game.score);
    const perfect = game.perfects ? ` ${game.perfects} perfect cooks.` : "";
    const next = level.stars.find((s) => game.score < s);
    const goal = next ? ` ${next - game.score} more points for the next star.` : " Top marks!";
    this.finalStars.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    this.finalText.textContent = `${level.name}: ${stars} of 3 stars. You served ${game.served} dishes and scored ${game.score} points.${perfect}${goal}`;
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
  /** @param sees can see right now (a power cut hides the ticket rail) */
  private syncOrders(game: Game, role: Role, sees: boolean) {
    // phone orders are remembered once heard; tickets have to be seen
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
          const tag = document.createElement("small");
          tag.textContent = order.channel === "ticket" ? "🧾 Ticket" : "📞 Phone (heard)";
          const name = document.createElement("strong");
          name.textContent = order.recipe.name;
          const items = document.createElement("span");
          items.textContent = describeRecipe(order.recipe);
          li.append(tag, name, items);
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
