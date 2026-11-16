// The end-of-shift awards: one for each chef, for the thing they did most of compared with the
// rest of the team, so everyone has something to be proud of (and to tease each other about).
import type { Chef, ChefStats, Game } from "@kitchen/shared";

export interface Award {
  chef: Chef;
  title: string;
  icon: string;
  detail: string;
}

const KINDS: { stat: keyof ChefStats; title: string; icon: string; detail: (n: number) => string }[] = [
  { stat: "served", title: "Speedy server", icon: "bell", detail: (n) => `${n} served` },
  { stat: "perfect", title: "Perfect touch", icon: "sparkle", detail: (n) => `${n} cooked perfectly` },
  { stat: "chopped", title: "Knife wizard", icon: "knife", detail: (n) => `${n} chopped` },
  { stat: "charms", title: "Crowd charmer", icon: "voice", detail: (n) => (n === 1 ? "charmed the tables" : `charmed the tables ${n} times`) },
  { stat: "signs", title: "Clear signals", icon: "signs", detail: (n) => `${n} signals` },
  { stat: "paid", title: "Till master", icon: "coin", detail: (n) => `${n} rung up` },
  { stat: "handoffs", title: "Team player", icon: "give", detail: (n) => `${n} handed over` },
];

export function teamAwards(game: Game): Award[] {
  const total = (stat: keyof ChefStats) => game.chefs.reduce((sum, c) => sum + (c.stats?.[stat] ?? 0), 0);
  // every chef's every non-zero stat, by their share of the team's total
  const options = game.chefs.flatMap((chef) =>
    KINDS.map((kind, order) => ({ chef, kind, order, value: chef.stats?.[kind.stat] ?? 0 }))
      .filter((o) => o.value > 0)
      .map((o) => ({ ...o, share: o.value / total(o.kind.stat) })),
  );
  options.sort((a, b) => b.share - a.share || b.value - a.value || a.order - b.order);
  const given = new Map<string, Award>();
  const taken = new Set<string>();
  for (const o of options) {
    if (given.has(o.chef.id) || taken.has(o.kind.stat)) continue;
    given.set(o.chef.id, { chef: o.chef, title: o.kind.title, icon: o.kind.icon, detail: o.kind.detail(o.value) });
    taken.add(o.kind.stat);
  }
  // nothing stood out: still a nice word, but one that fits a chef who did nothing at all
  const idle = (chef: Chef) => Object.values(chef.stats ?? {}).every((n) => !n);
  return game.chefs.map(
    (chef) => given.get(chef.id) ?? (idle(chef) ? { chef, title: "Warming up", icon: "chef", detail: "next shift's yours" } : { chef, title: "Kitchen spirit", icon: "chef", detail: "kept everyone smiling" }),
  );
}
