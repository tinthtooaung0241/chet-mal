// Surviving a reload. The URL only carries what's worth sharing (?room=CODE, an online kitchen);
// everything else lives in this tab's sessionStorage, so a reload picks up where you were and a
// new tab starts fresh.
//  - solo: the shift in progress is saved every couple of seconds and comes back paused
//  - online: the room you're seated in, so a reload rejoins it straight away (the server keeps
//    your seat by your player id)
import { hydrate, snapshot, type Game } from "@kitchen/shared";

const SOLO_KEY = "kitchen.soloShift";
const ROOM_KEY = "kitchen.seatedRoom";

interface SavedSolo {
  game: Game;
  me: string;
  helper: boolean;
}

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no storage (private mode, full): a reload just starts over
  }
}

export function saveSolo(game: Game, me: string, helper: boolean) {
  if (game.phase !== "playing") return write(SOLO_KEY, null);
  write(SOLO_KEY, { game: snapshot(game), me, helper });
}

/** The solo shift this tab was playing before a reload, if any. */
export function savedSolo(): SavedSolo | null {
  const saved = read<SavedSolo>(SOLO_KEY);
  if (!saved?.game?.chefs?.some((c) => c.id === saved.me) || saved.game.phase !== "playing") return null;
  return { ...saved, game: hydrate(saved.game) };
}

export const clearSolo = () => write(SOLO_KEY, null);

/** The online kitchen this tab has a seat in (set once the server welcomes us). */
export const seatedRoom = () => read<string>(ROOM_KEY);
export const setSeatedRoom = (code: string | null) => write(ROOM_KEY, code);
