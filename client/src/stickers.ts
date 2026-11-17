// The sticker album: one sticker for each moment worth remembering, collected over every shift and
// kept in this browser. Most point at a skill (a perfect sizzle, a long combo, cooking in the
// dark); the rest at the long goals (three stars everywhere, a week of daily specials).
import { LEVELS, UPGRADES, VENUES, levelByNumber, levelsAt, type Chef, type Game, type VenueId } from "@kitchen/shared";
import { loadBusiness } from "./business";
import { dailyStatus } from "./daily";
import { bestStars } from "./progress";
import { readJson, writeJson } from "./storage";

export interface Sticker {
  id: string;
  name: string;
  /** how to earn it */
  how: string;
  icon: string;
}

export const STICKERS: Sticker[] = [
  { id: "first-dish", name: "First plate", how: "Serve your first dish", icon: "check" },
  { id: "tutorial", name: "First day", how: "Finish the tutorial kitchen", icon: "hands" },
  { id: "perfect", name: "Perfect sizzle", how: "Take food off as the sizzle peaks", icon: "sparkle" },
  { id: "seasoned", name: "Just right", how: "Season 5 dishes just right in one shift", icon: "salt" },
  { id: "combo-3", name: "On a roll", how: "Make a 3× combo", icon: "bolt" },
  { id: "combo-6", name: "Unstoppable", how: "Make a 6× combo", icon: "flame" },
  { id: "rush", name: "Rush hour hero", how: "Serve 3 dishes in one rush hour", icon: "hurry" },
  { id: "dark", name: "Cooking in the dark", how: "Serve a dish in a power cut", icon: "moon" },
  { id: "storm", name: "Through the storm", how: "Serve a dish in a storm", icon: "storm" },
  { id: "rave", name: "Rave review", how: "Make a food critic rave", icon: "critic" },
  { id: "firefighter", name: "Firefighter", how: "Put out a kitchen fire", icon: "flame" },
  { id: "squeaky", name: "Squeaky clean", how: "Wash 8 dishes in one shift", icon: "sink" },
  { id: "nose", name: "Good nose", how: "Bin spoiled food before anyone eats it", icon: "smell" },
  { id: "charm", name: "Charmer", how: "Charm the tables 3 times in one shift", icon: "bell" },
  { id: "pass", name: "Pass it on", how: "Hand 5 things to teammates in one shift", icon: "give" },
  { id: "till", name: "Full till", how: "Take 150 coins in one shift", icon: "coin" },
  { id: "no-lost", name: "Nobody left hungry", how: "Finish a shift without losing a customer", icon: "diner" },
  { id: "three-stars", name: "Top marks", how: "Get three stars on a shift", icon: "star" },
  { id: "together", name: "Better together", how: "Finish a shift with friends online", icon: "chef" },
  { id: "daily", name: "Today's special", how: "Finish a daily special", icon: "ticket" },
  { id: "streak-7", name: "Every day chef", how: "Cook the daily special 7 days in a row", icon: "chart" },
  { id: "equipped", name: "Fully equipped", how: "Buy every upgrade", icon: "knife" },
  { id: "burmese-open", name: "Second restaurant", how: "Open the Burmese restaurant", icon: "flag" },
  { id: "street", name: "Street legend", how: "Three stars on every street stand shift", icon: "medal" },
  { id: "burmese", name: "Yangon legend", how: "Three stars on every Burmese shift", icon: "medal" },
];

const KEY = "kitchen.stickers";
/** how many stickers the album had the last time it was opened */
const SEEN_KEY = "kitchen.stickersSeen";

/** sticker id -> the day it was earned */
let earned: Record<string, string> = readJson<Record<string, string>>(KEY, {});
let thisShift: Sticker[] = [];

const byId = new Map(STICKERS.map((s) => [s.id, s]));
export const hasSticker = (id: string) => id in earned;
export const stickerCount = () => STICKERS.filter((s) => hasSticker(s.id)).length;

/** Stick it in the album; the sticker if it's new. */
function award(id: string): Sticker | null {
  const sticker = byId.get(id);
  if (!sticker || hasSticker(id)) return null;
  earned = { ...earned, [id]: new Date().toISOString().slice(0, 10) };
  writeJson(KEY, earned);
  thisShift.push(sticker);
  return sticker;
}

const awardAll = (ids: (string | false)[]) => ids.flatMap((id) => (id && award(id)) || []);

// moments in a shift, checked every frame: most are the team's, a few are your own hands'
const LIVE: [string, (g: Game, me: Chef) => boolean][] = [
  ["first-dish", (g) => g.served >= 1],
  ["perfect", (g) => g.perfects >= 1],
  ["seasoned", (g) => g.tally.seasonedRight >= 5],
  ["combo-3", (g) => g.combo >= 3],
  ["combo-6", (g) => g.combo >= 6],
  ["rush", (g) => g.tally.rushServed >= 3],
  ["dark", (g) => g.tally.darkServed >= 1],
  ["storm", (g) => g.tally.stormServed >= 1],
  ["rave", (g) => g.tally.raves >= 1],
  ["nose", (g) => g.tally.binned >= 1],
  ["squeaky", (g) => g.tally.washed >= 8],
  // every fire this shift is out again
  ["firefighter", (g) => g.tally.fires > 0 && !g.stations.some((s) => s.fire)],
  ["till", (g) => g.coins >= 150],
  ["charm", (_, me) => me.stats.charms >= 3],
  ["pass", (_, me) => me.stats.handoffs >= 5],
];

export function startShift() {
  thisShift = [];
}

/** Stickers earned just now, in the middle of a shift. */
export function checkLive(game: Game, me: Chef): Sticker[] {
  if (game.phase !== "playing" || !game.tally) return [];
  return awardAll(LIVE.map(([id, test]) => !hasSticker(id) && test(game, me) && id));
}

/** Stickers for the shift as a whole, and for the progress it made; then everything this shift earned. */
export function finishShift(game: Game, stars: number): Sticker[] {
  const tutorial = !!levelByNumber(game.level).tutorial;
  awardAll([
    tutorial && "tutorial",
    !tutorial && game.tally.lost === 0 && game.served >= 4 && "no-lost",
    !tutorial && stars === 3 && "three-stars",
    game.crew >= 2 && "together",
  ]);
  checkProgress();
  return [...thisShift];
}

const allThreeStars = (venue: VenueId) => levelsAt(venue).every((l) => bestStars(l.n) === 3);

/** Stickers for long-term progress: stars, restaurants, upgrades, daily streaks (also earned by saves from before stickers). */
export function checkProgress(): Sticker[] {
  const business = loadBusiness();
  const burmese = VENUES.find((v) => v.id === "burmese");
  const lastStreet = levelsAt("street").at(-1);
  const daily = dailyStatus();
  return awardAll([
    LEVELS.some((l) => bestStars(l.n) === 3) && "three-stars",
    allThreeStars("street") && "street",
    allThreeStars("burmese") && "burmese",
    !!burmese && !!lastStreet && business.totalSales >= burmese.unlockSales && bestStars(lastStreet.n) > 0 && "burmese-open",
    UPGRADES.every((u) => u.needs || business.upgrades.includes(u.id)) && "equipped",
    daily.playedToday && "daily",
    daily.streak >= 7 && "streak-7",
  ]);
}

/** Stickers earned since the album was last opened. */
export const unseenStickers = () => Math.max(0, stickerCount() - readJson<number>(SEEN_KEY, 0));
export const markStickersSeen = () => writeJson(SEEN_KEY, stickerCount());
