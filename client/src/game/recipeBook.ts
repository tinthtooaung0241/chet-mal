// The recipe book (R): every dish on today's menu and how to make it. Each chef reads it their
// own way — sighted chefs see illustrated pages, the blind chef has it read aloud page by page
// (←/→ to turn, Enter to hear it again), and it's also real text for screen readers.
import { FOOD_RULES, ROLES, SOUP_SIZE, SPICE_NAMES, spiceList, levelByNumber, recipeById, type Game, type Recipe, type RecipeItem, type Role, type Spice } from "@kitchen/shared";
import { glyph, img } from "../ui/icons";
import { SPICE_GLYPHS, foodIcon, soupIcon } from "./hints";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

interface Step {
  icon: Element;
  text: string;
}

const lower = (kind: string) => kind.toLowerCase();
const cookVerb = (kind: string) => (kind === "Bread" ? "toast" : "fry");
const article =(s: string) => (/^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`);

/** What to do to one ingredient, in kitchen order, seasoning included at its proper step. */
function itemSteps(item: RecipeItem): Step[] {
  const rule = FOOD_RULES[item.kind] ?? {};
  const steps: Step[] = [{ icon: img(foodIcon(item.kind, "raw")), text: lower(item.kind) }];
  const chop = item.state === "chopped" || (item.state === "cooked" && rule.cookFrom === "chopped");
  const season = (): Step => ({ icon: spiceIcons(item.season!), text: (item.season ?? []).map((sp) => SPICE_NAMES[sp]).join(" + ") });
  if (chop) steps.push({ icon: img("CuttingBoard"), text: "chop" });
  if (item.season?.length && item.seasonAt === "before") steps.push(season());
  if (item.state === "cooked") steps.push({ icon: img("FryingPan"), text: cookVerb(item.kind) });
  if (item.season?.length && item.seasonAt === "after") steps.push(season());
  return steps;
}

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
    const cooked = cookVerb(item.kind) === "toast" ? "toasted" : "fried";
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

function stepChip({ icon, text }: Step): HTMLElement {
  const li = document.createElement("li");
  li.append(icon, text);
  return li;
}

function page(recipe: Recipe, ordered: boolean): HTMLElement {
  const li = document.createElement("li");
  li.className = `book-page ${recipe.vessel}`;
  li.tabIndex = -1;
  li.dataset.recipe = recipe.id;
  if (ordered) li.classList.add("ordered");

  const head = document.createElement("div");
  head.className = "book-head";
  const name = document.createElement("h3");
  name.textContent = recipe.name;
  const meta = document.createElement("span");
  meta.className = "book-meta";
  meta.append(glyph("coin"), `${recipe.reward}`);
  head.append(dishImage(recipe), name, meta);
  if (ordered) {
    const badge = document.createElement("span");
    badge.className = "book-badge";
    badge.textContent = "On order";
    head.append(badge);
  }

  const steps = document.createElement("ol");
  steps.className = "book-steps";
  if (recipe.vessel === "bowl") {
    const counts = new Map<string, number>();
    for (const i of recipe.items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
    for (const [kind, n] of counts) {
      const plural = lower(kind) + (kind.endsWith("o") ? "es" : "s");
      steps.append(stepChip({ icon: img(foodIcon(kind, "chopped")), text: n > 1 ? `Chop ${n} ${plural}` : `Chop ${article(lower(kind))}` }));
    }
    steps.append(stepChip({ icon: img("Pot"), text: `All ${SOUP_SIZE} into the pot, boil` }));
    steps.append(stepChip({ icon: img("Bowl"), text: "Ladle into a bowl" }));
  } else {
    for (const item of recipe.items) {
      const row = document.createElement("li");
      row.className = "book-item";
      const chain = itemSteps(item);
      chain.forEach((step, i) => {
        if (i) row.append(Object.assign(document.createElement("span"), { className: "arrow", textContent: "→" }));
        row.append(step.icon, step.text);
      });
      steps.append(row);
    }
    steps.append(stepChip({ icon: img("Plate"), text: "All on one plate" }));
  }
  if (recipe.finish?.length) {
    const li = document.createElement("li");
    li.className = "book-season";
    li.append(spiceIcons(recipe.finish), `Finish: ${recipe.finish.map((sp) => SPICE_NAMES[sp]).join(" + ")}`);
    steps.append(li);
  }
  steps.append(stepChip({ icon: glyph("bell"), text: "Serve at the pass" }));

  const sentence = document.createElement("p");
  sentence.className = "visually-hidden";
  sentence.textContent = recipeSentence(recipe);
  li.append(head, steps, sentence);
  return li;
}

export class RecipeBook {
  readonly dialog = $<HTMLDialogElement>("recipe-book");
  private readonly pages = $<HTMLOListElement>("book-pages");
  private readonly note = $("book-note");
  private recipes: Recipe[] = [];
  private index = 0;
  private readAloud = false;

  constructor() {
    this.dialog.addEventListener("keydown", (e) => {
      if (!this.recipes.length) return;
      if (e.code === "ArrowRight" || e.code === "ArrowDown") this.turn(1);
      else if (e.code === "ArrowLeft" || e.code === "ArrowUp") this.turn(-1);
      else if (e.code === "Enter" && this.readAloud) this.speak(recipeSentence(this.recipes[this.index]));
      else return;
      e.preventDefault();
    });
    this.dialog.addEventListener("close", () => {
      if (this.readAloud && "speechSynthesis" in window) speechSynthesis.cancel();
    });
    $("close-book").addEventListener("click", () => this.dialog.close());
  }

  get open(): boolean {
    return this.dialog.open;
  }

  /** Opens on today's menu; dishes already ordered come first. */
  show(game: Game, role: Role) {
    const { sees, hears } = ROLES[role];
    const ordered = new Set(game.orders.filter((o) => (o.channel === "ticket" ? sees : hears)).map((o) => o.recipe.id));
    const level = levelByNumber(game.level);
    this.recipes = level.recipes.map(recipeById).sort((a, b) => Number(ordered.has(b.id)) - Number(ordered.has(a.id)));
    this.pages.replaceChildren(...this.recipes.map((r) => page(r, ordered.has(r.id))));
    // the blind chef hears the book; nobody else gets it read out unasked
    this.readAloud = !sees && hears;
    this.dialog.classList.toggle("read-aloud", this.readAloud);
    this.note.textContent = this.readAloud
      ? "Read aloud: ← → turn the page, Enter repeats it, R closes the book."
      : `${level.name}: ${this.recipes.length} dishes on the menu. Press R to close.`;
    this.index = 0;
    if (!this.dialog.open) this.dialog.showModal();
    this.focusPage(true);
    if (this.readAloud) this.speak(`Recipe book, ${this.recipes.length} dishes. ${recipeSentence(this.recipes[0])}`);
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  private turn(by: number) {
    this.index = (this.index + by + this.recipes.length) % this.recipes.length;
    this.focusPage();
    if (this.readAloud) this.speak(`${this.index + 1} of ${this.recipes.length}. ${recipeSentence(this.recipes[this.index])}`);
  }

  private focusPage(first = false) {
    const pages = [...this.pages.children] as HTMLElement[];
    pages.forEach((p, i) => p.classList.toggle("current", i === this.index));
    const current = pages[this.index];
    current?.focus({ preventScroll: first });
    current?.scrollIntoView({ block: "nearest" });
  }

  private speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
}
