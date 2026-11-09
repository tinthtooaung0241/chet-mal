// The shift report on the end screen: where the points came from and where they went, and one
// thing to try next time.
import { levelByNumber, recipeById, twistOf, type Game, type Role } from "@kitchen/shared";

export interface ReportLine {
  label: string;
  points: number;
  icon: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Every line that earned or cost something; together they add up to the score. */
export function shiftReport(game: Game): ReportLine[] {
  const t = game.tally;
  // short labels: the report sits in two narrow columns
  const bonuses = [t.rushServed ? "Rush hour" : "", t.raves ? plural(t.raves, "rave").replace(/^1 /, "Critic ") : "", twistOf(game)?.name ?? ""].filter(Boolean);
  const lines: ReportLine[] = [
    { label: plural(game.served, "dish", "dishes"), points: t.dishes, icon: "check" },
    { label: "Speed", points: t.speed, icon: "alarm" },
    { label: "Perfect", points: t.perfect, icon: "sparkle" },
    { label: "Seasoning", points: t.seasoning, icon: "salt" },
    { label: `Combo ×${t.bestCombo}`, points: t.combo, icon: "bolt" },
    { label: bonuses.length === 1 ? bonuses[0] : "Bonuses", points: t.extra, icon: "star" },
    { label: `${t.lost} walked out`, points: -t.lostPoints, icon: "angry" },
    { label: `${t.sick} got sick`, points: -t.sickPoints, icon: "sick" },
    { label: plural(t.fires, "fire"), points: -t.firePoints, icon: "flame" },
  ];
  return lines.filter((line) => line.points !== 0);
}

/** One tip, for the thing that cost the most this shift (null after a clean one). */
export function nextTimeTip(game: Game, role: Role): string | null {
  const t = game.tally;
  const level = levelByNumber(game.level);
  if (level.tutorial) return null;
  const cooked = level.recipes.some((id) => recipeById(id).items.some((i) => i.state === "cooked"));
  if (t.sick) return "Sniff produce with Z before you use it. Mouldy food makes customers sick.";
  if (t.fires) return "Take burnt food off the stove and bin it before it catches fire.";
  if (t.lost >= 2) return "Start the ticket with the least time left, and send each dish out as soon as it's ready.";
  if (t.seasoning < 0) return "Check each ticket's seasoning: some goes on before cooking, some after, some on top.";
  if (t.unpaid) return "Ring customers up at the till the way they want to pay: 1 for cash, 2 for card.";
  if (t.wrong) return "Check the ticket before you serve: a dish nobody ordered goes to waste.";
  if (!t.perfect && cooked && role !== "head")
    return role === "deaf" ? "The perfect moment is heard, not seen: ask a hearing chef to call the sizzle." : "When the sizzle peaks, take the food off for a perfect bonus.";
  if (t.critics > t.raves) return "Critics rave about a dish seasoned just right, served before their ticket turns red.";
  if (t.bestCombo < 3) return "Serve dishes within 30 seconds of each other to build a combo.";
  return null;
}
