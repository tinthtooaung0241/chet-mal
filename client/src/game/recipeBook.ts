// The recipe book (R): every dish on today's menu and how to make it. Each chef reads it their
// own way — sighted chefs see illustrated pages, the blind chef has it read aloud page by page
// (←/→ to turn, Enter to hear it again), and it's also real text for screen readers.
import { FOOD_RULES, displayKind, ROLES, SOUP_SIZE, SPICE_NAMES, spiceList, levelByNumber, levelsAt, recipeById, type Game, type Recipe, type Role, type Spice } from "@kitchen/shared";
import { glyph, img, renderedIcon } from "../ui/icons";
import { SPICE_GLYPHS, foodIcon, soupIcon } from "./hints";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const lower = (kind: string) => displayKind(kind).toLowerCase();
/** How each food is cooked in the pan, in plain words. */
const COOK_VERBS: Record<string, [string, string]> = {
  Bread: ["toast", "toasted"],
  Noodles: ["boil", "boiled"],
  Rice: ["cook", "cooked"],
};
const cookVerb = (kind: string) => (COOK_VERBS[kind] ?? ["fry", "fried"])[0];
const cookedWord = (kind: string) => (COOK_VERBS[kind] ?? ["fry", "fried"])[1];
const capital = (w: string) => w[0].toUpperCase() + w.slice(1);

function spiceIcons(spices: readonly Spice[]): HTMLElement {
  const box = document.createElement("span");
  box.className = "spice-icons";
  for (const sp of spices) box.append(glyph(SPICE_GLYPHS[sp]));
  return box;
}

/** One sentence per recipe, for speech and screen readers. */
export function recipeSentence(recipe: Recipe): string {
  if (recipe.vessel === "bowl") {
    const veg = recipe.items.map((i) => lower(i.kind));
    const spice = recipe.finish?.length ? ` Finish it with ${spiceList(recipe.finish)}.` : "";
    return `${recipe.name}: chop ${veg.join(", ")}, put all ${SOUP_SIZE} in the soup pot, let it boil, then ladle it into a bowl.${spice}`;
  }
  const parts = recipe.items.map((item) => {
    const rule = FOOD_RULES[item.kind] ?? {};
    const cooked = cookedWord(item.kind);
    const steps: string[] = [];
    if (item.state === "chopped" || (item.state === "cooked" && rule.cookFrom === "chopped")) steps.push("chopped");
    if (item.season?.length && item.seasonAt === "before") steps.push(`seasoned with ${spiceList(item.season)}`);
    if (item.state === "cooked") steps.push(cooked);
    if (item.season?.length && item.seasonAt === "after") steps.push(`seasoned with ${spiceList(item.season)}`);
    const flow = steps.length > 1 ? `${steps.slice(0, -1).join(", ")}, then ${steps.at(-1)}` : (steps[0] ?? "");
    return `${lower(item.kind)}${flow ? ` ${flow}` : ""}`;
  });
  const list = parts.join("; ");
  const spice = recipe.finish?.length ? ` Finish the plate with ${spiceList(recipe.finish)}.` : "";
  return `${recipe.name}: ${list}, on one plate.${spice}`;
}

function dishImage(recipe: Recipe): HTMLElement {
  const dish = document.createElement("div");
  dish.className = "dish";
  // dishes with their own finished-dish picture (rendered from the plated dish) use it
  if (renderedIcon(`Dish_${recipe.id}`)) {
    dish.classList.add("finished");
    dish.append(img(`Dish_${recipe.id}`));
    return dish;
  }
  if (recipe.vessel === "bowl") dish.append(img(soupIcon(recipe.items.map((i) => i.kind))));
  else {
    dish.append(img("Plate"));
    for (const item of recipe.items) {
      const food = img(foodIcon(item.kind, item.state));
      food.classList.add("on-plate");
      dish.append(food);
    }
    dish.dataset.count = String(recipe.items.length);
  }
  return dish;
}

function section(title: string, list: HTMLElement): HTMLElement {
  const box = document.createElement("section");
  const h = document.createElement("h4");
  h.textContent = title;
  box.append(h, list);
  return box;
}

/** Where each ingredient lives, and what happens to it on the stove. */
function ingredients(recipe: Recipe): HTMLElement {
  const list = document.createElement("ul");
  list.className = "book-ingredients";
  const counts = new Map<string, number>();
  for (const i of recipe.items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  for (const [kind, n] of counts) {
    const rule = FOOD_RULES[kind] ?? {};
    const li = document.createElement("li");
    const name = document.createElement("b");
    name.textContent = `${n > 1 ? `${n} × ` : ""}${displayKind(kind)}`;
    const where = document.createElement("span");
    where.className = `where ${rule.cold ? "cold" : ""}`;
    where.append(glyph(rule.cold ? "fridge" : "crate"), rule.cold ? "fridge" : "shelf");
    li.append(img(foodIcon(kind, "raw")), name, where);
    list.append(li);
  }
  return list;
}

/** One instruction: what to do (a short sentence, verb first) and where in the kitchen. */
interface Instruction {
  icon: Element;
  verb: string;
  rest: string;
  where: string;
  kind?: "season" | "serve";
}

/** The method as one plain instruction per action, in the order you'd do them. */
function instructions(recipe: Recipe): Instruction[] {
  const out: Instruction[] = [];
  const spices = (list: readonly Spice[]) => list.map((sp) => SPICE_NAMES[sp]).join(", ");
  if (recipe.vessel === "bowl") {
    const counts = new Map<string, number>();
    for (const i of recipe.items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
    for (const [kind, n] of counts) {
      const name = n > 1 ? `${n} ${lower(kind)}${kind.endsWith("o") ? "es" : "s"}` : `the ${lower(kind)}`;
      out.push({ icon: img(foodIcon(kind, "chopped")), verb: "Chop", rest: name, where: "board" });
    }
    out.push({ icon: img("Pot"), verb: "Boil", rest: `all ${SOUP_SIZE} together`, where: "pot" });
    out.push({ icon: img("Bowl"), verb: "Ladle", rest: "it into a bowl", where: "pot" });
  } else {
    for (const item of recipe.items) {
      const rule = FOOD_RULES[item.kind] ?? {};
      const food = `the ${lower(item.kind)}`;
      const chop = item.state === "chopped" || (item.state === "cooked" && rule.cookFrom === "chopped");
      const season = (when: string): Instruction => ({ icon: spiceIcons(item.season!), verb: "Season", rest: `${food} with ${spices(item.season!)} ${when}`, where: "spice rack", kind: "season" });
      if (chop) out.push({ icon: img(foodIcon(item.kind, "chopped")), verb: "Chop", rest: food, where: "board" });
      if (item.season?.length && item.seasonAt === "before") out.push(season("first"));
      if (item.state === "cooked") {
        const verb = capital(cookVerb(item.kind));
        out.push({ icon: img(foodIcon(item.kind, "cooked")), verb, rest: `${food} for ${rule.cookTime}s`, where: "pan" });
      }
      if (item.season?.length && item.seasonAt === "after") out.push(season("once it's cooked"));
      if (!chop && item.state === "raw") out.push({ icon: img(foodIcon(item.kind, "raw")), verb: "Take", rest: `${food} as it is`, where: rule.cold ? "fridge" : "shelf" });
    }
    out.push({ icon: dishImage(recipe), verb: "Plate", rest: recipe.items.length > 1 ? "everything together" : "it", where: "plate cart" });
  }
  if (recipe.finish?.length) out.push({ icon: spiceIcons(recipe.finish), verb: "Finish", rest: `with ${spices(recipe.finish)}`, where: "spice rack", kind: "season" });
  out.push({ icon: glyph("bell"), verb: "Serve", rest: "it at the pass", where: "pass", kind: "serve" });
  return out;
}

/** The kitchen station a step happens at, as the icon you'll see in the HUD. */
function placeIcon(where: string): Element {
  switch (where) {
    case "board": return img("CuttingBoard");
    case "pan": return img("FryingPan");
    case "pot": return img("Pot");
    case "plate cart": return img("Plate");
    case "spice rack": return glyph("salt");
    case "fridge": return glyph("fridge");
    case "shelf": return glyph("crate");
    default: return glyph("bell");
  }
}

function method(recipe: Recipe): HTMLElement {
  const steps = document.createElement("ol");
  steps.className = "book-method";
  for (const step of instructions(recipe)) {
    const li = document.createElement("li");
    if (step.kind) li.className = step.kind;
    const icon = document.createElement("span");
    icon.className = "step-icon";
    icon.append(step.icon);
    const text = document.createElement("span");
    text.className = "step-text";
    const verb = document.createElement("b");
    verb.textContent = step.verb;
    text.append(verb, ` ${step.rest}`);
    const where = document.createElement("span");
    where.className = "step-where";
    where.title = `at the ${step.where}`;
    where.append(placeIcon(step.where), step.where);
    li.append(icon, text, where);
    steps.append(li);
  }
  return steps;
}

/** One practical hint per dish: the thing that most often goes wrong. */
function chefTip(recipe: Recipe): string {
  if (recipe.vessel === "bowl") return `The pot needs exactly ${SOUP_SIZE} chopped vegetables. Bring a bowl as soon as it's boiled, before it burns.`;
  const cooked = recipe.items.find((i) => i.state === "cooked");
  const before = recipe.items.find((i) => i.season?.length && i.seasonAt === "before");
  if (before) return `Season the ${lower(before.kind)} before it goes in the pan, not after. Ask a friend to grab the ${spiceList(before.season!)} while you cook.`;
  if (cooked) {
    const rule = FOOD_RULES[cooked.kind] ?? {};
    return `The ${lower(cooked.kind)} is done in ${rule.cookTime}s and burns ${rule.burnTime}s later. Call it out so someone's ready with a plate.`;
  }
  if (recipe.finish?.length) return "Plate everything first, then add the finishing touch at the spice rack.";
  return "Split the chopping: one chef per ingredient is twice as fast.";
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = "") => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

/** What's in it, for the menu: "tomato, lettuce · olive oil, lemon". */
function menuLine(recipe: Recipe): string {
  const foods = [...new Set(recipe.items.map((i) => displayKind(i.kind).toLowerCase()))].join(", ");
  return recipe.finish?.length ? `${foods} · ${recipe.finish.map((sp) => SPICE_NAMES[sp]).join(", ")}` : foods;
}

export class RecipeBook {
  readonly dialog = $<HTMLDialogElement>("recipe-book");
  private readonly spread = $("book-spread");
  private readonly left = $("book-left");
  private readonly right = $("book-right");
  private readonly note = $("book-note");
  private recipes: Recipe[] = [];
  private ordered = new Set<string>();
  private levelName = "";
  /** the recipes served on this shift */
  private today = new Set<string>();
  /** -1 is the menu; otherwise the recipe being read */
  private index = -1;
  private readAloud = false;

  constructor() {
    this.dialog.addEventListener("keydown", (e) => {
      if (!this.recipes.length) return;
      if (e.code === "ArrowRight" || e.code === "ArrowDown") this.turn(1);
      else if (e.code === "ArrowLeft" || e.code === "ArrowUp") this.turn(-1);
      else if ((e.code === "Backspace" || e.code === "KeyM") && this.index >= 0) this.goTo(-1, -1);
      else if (e.code === "Enter" && this.readAloud && this.index >= 0) this.speak(recipeSentence(this.recipes[this.index]));
      else return;
      e.preventDefault();
    });
    this.dialog.addEventListener("close", () => {
      if (this.readAloud && "speechSynthesis" in window) speechSynthesis.cancel();
    });
    $("book-close").addEventListener("click", () => this.close());
    $("book-prev").addEventListener("click", () => this.turn(-1));
    $("book-next").addEventListener("click", () => this.turn(1));
    // a page with more below fades out at the bottom until you've scrolled to the end
    for (const page of [this.left, this.right]) page.addEventListener("scroll", () => this.markMore(page), { passive: true });
    new ResizeObserver(() => this.markMore()).observe(this.spread);
  }

  private markMore(...pages: HTMLElement[]) {
    for (const page of pages.length ? pages : [this.left, this.right]) {
      const more = page.scrollHeight - page.scrollTop - page.clientHeight > 4;
      page.classList.toggle("more", more);
    }
  }

  get open(): boolean {
    return this.dialog.open;
  }

  /** Opens on the menu; dishes already ordered come first. The blind chef starts on the first recipe. */
  show(game: Game, role: Role) {
    const { sees, hears } = ROLES[role];
    this.ordered = new Set(game.orders.filter((o) => (o.channel === "ticket" ? sees : hears)).map((o) => o.recipe.id));
    const level = levelByNumber(game.level);
    this.levelName = level.name;
    // today's dishes first (ordered ones on top), then the rest of this restaurant's menu
    this.today = new Set(level.recipes);
    const later = [...new Set(levelsAt(level.venue).flatMap((l) => l.recipes))].filter((id) => !this.today.has(id));
    this.recipes = [
      ...level.recipes.map(recipeById).sort((a, b) => Number(this.ordered.has(b.id)) - Number(this.ordered.has(a.id))),
      ...later.map(recipeById),
    ];
    // the blind chef hears the book; nobody else gets it read out unasked
    this.readAloud = !sees && hears;
    this.dialog.classList.toggle("read-aloud", this.readAloud);
    this.note.textContent = this.readAloud
      ? "Read aloud: ← → turn the page, Enter repeats it, R closes the book."
      : `${level.name}: ${this.recipes.length} dishes. Pick one from the menu; ← → turns the page.`;
    if (!this.dialog.open) this.dialog.showModal();
    this.goTo(this.readAloud ? 0 : -1, 0);
    if (this.readAloud) this.speak(`Recipe book, ${this.recipes.length} dishes. ${recipeSentence(this.recipes[0])}`);
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  private turn(by: number) {
    const n = this.recipes.length;
    // the menu sits before the first recipe: -1, 0 .. n-1, then back round to the menu
    const next = ((this.index + 1 + by + n + 1) % (n + 1)) - 1;
    this.goTo(next, by);
    if (this.readAloud && next >= 0) this.speak(`${next + 1} of ${n}. ${recipeSentence(this.recipes[next])}`);
  }

  private goTo(i: number, dir: number) {
    const turning = dir !== 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches && this.spread.offsetWidth > 640;
    const before = turning
      ? { left: this.snapshot(this.left), right: this.snapshot(this.right), scroll: { left: this.left.scrollTop, right: this.right.scrollTop } }
      : null;
    this.spread.querySelectorAll(".leaf, .under").forEach((n) => n.remove());
    this.index = i;
    if (i < 0) this.renderMenu();
    else this.renderRecipe(this.recipes[i]);
    this.spread.classList.toggle("on-menu", i < 0);
    for (const page of [this.left, this.right]) page.scrollTop = 0;
    requestAnimationFrame(() => this.markMore());
    if (before) this.flip(dir, before);
    this.right.focus({ preventScroll: true });
  }

  private snapshot(page: HTMLElement): Node[] {
    return [...page.childNodes].map((n) => n.cloneNode(true));
  }

  /**
   * Turn a page like a real book. Going forward, the old right page lifts at the spine side and
   * swings over to the left, showing the new left page on its back; the old left page stays put
   * underneath until it's covered. Going back is the mirror image.
   */
  private flip(dir: number, before: { left: Node[]; right: Node[]; scroll: { left: number; right: number } }) {
    const forward = dir > 0;
    const face = (side: "left" | "right", nodes: Node[], back: boolean) => {
      const f = el("div", `leaf-face book-pg ${side}${back ? " back" : ""}`);
      f.append(...nodes);
      return f;
    };
    const leaf = el("div", `leaf ${forward ? "next" : "back"}`);
    leaf.append(
      face(forward ? "right" : "left", forward ? before.right : before.left, false),
      face(forward ? "left" : "right", this.snapshot(forward ? this.left : this.right), true),
    );
    // what the turning page hasn't covered yet: the old page on the side it's heading to
    const under = el("div", `under ${forward ? "left" : "right"}`);
    under.append(face(forward ? "left" : "right", forward ? before.left : before.right, false));
    this.spread.append(under, leaf);
    // the old pages turn over where you'd scrolled them to, not jumping back to the top
    (leaf.firstElementChild as HTMLElement).scrollTop = forward ? before.scroll.right : before.scroll.left;
    (under.firstElementChild as HTMLElement).scrollTop = forward ? before.scroll.left : before.scroll.right;
    leaf.addEventListener("animationend", (e) => {
      if (e.target !== leaf) return; // the shading on its faces ends too
      leaf.remove();
      under.remove();
    });
  }

  /** The first spread: a cover page on the left, the menu on the right. */
  private renderMenu() {
    const title = el("div", "cover");
    const h = el("h2", "cover-title");
    h.append(glyph("book"), "Recipe book");
    const key = el("dl", "book-key");
    for (const [icon, text] of [
      [glyph("fridge"), "from the fridge, keep it cold"],
      [glyph("crate"), "from the shelf"],
      [el("span", "toc-dot"), "someone ordered it"],
    ] as const) {
      const row = el("div");
      const dt = el("dt");
      dt.append(icon);
      row.append(dt, el("dd", "", text));
      key.append(row);
    }
    title.append(
      el("p", "cover-eyebrow", "Kitchen Co-op"),
      h,
      el("p", "cover-sub", `${this.levelName} · ${this.today.size} dishes today`),
      el("p", "cover-hint", "Pick a dish to open its recipe. Read it out to your team!"),
      key,
    );
    this.left.replaceChildren(title);

    const menu = el("ol", "menu-list");
    const later = el("ol", "menu-list later");
    this.recipes.forEach((r, i) => {
      const li = el("li");
      const btn = el("button", "menu-entry");
      btn.type = "button";
      const words = el("span", "menu-words");
      const name = el("span", "menu-name", r.name);
      if (this.ordered.has(r.id)) name.append(el("span", "toc-dot"));
      words.append(name, el("span", "menu-what", menuLine(r)));
      const price = el("span", "menu-price");
      price.append(`${r.reward}`, glyph("coin"));
      btn.append(dishImage(r), words, el("span", "toc-dots"), price);
      btn.addEventListener("click", () => this.goTo(i, 1));
      li.append(btn);
      (this.today.has(r.id) ? menu : later).append(li);
    });
    const parts: Node[] = [el("h3", "menu-head", "Today's menu"), menu];
    if (later.children.length) parts.push(el("h4", "menu-later-head", "Coming up on later shifts"), later);
    this.right.replaceChildren(...parts, el("span", "folio right", "1"));
  }

  /** A recipe across the spread: the dish and what you need on the left, how to make it on the right. */
  private renderRecipe(recipe: Recipe) {
    const back = el("button", "book-back");
    back.type = "button";
    back.append("‹ Menu");
    back.addEventListener("click", () => this.goTo(-1, -1));

    const hero = el("div", "hero");
    hero.append(dishImage(recipe));
    if (this.ordered.has(recipe.id)) hero.append(el("span", "book-badge", "On order"));
    const meta = el("p", "book-meta");
    meta.append(glyph("coin"), `${recipe.reward} coins · served in a ${recipe.vessel}`);
    const tip = el("aside", "book-tip");
    tip.append(glyph("chef"), chefTip(recipe));
    this.left.replaceChildren(back, hero, el("h3", "hero-name", recipe.name), meta, section("You'll need", ingredients(recipe)), tip, el("span", "folio left", `${this.index * 2 + 2}`));

    const sentence = el("p", "visually-hidden", recipeSentence(recipe));
    this.right.replaceChildren(section("Method", method(recipe)), sentence, el("span", "folio right", `${this.index * 2 + 3}`));
  }

  private speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
}
