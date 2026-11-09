// Browser storage that never throws: in a private window or with storage blocked, the game
// still plays and simply doesn't remember.

export function readText(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Saves a value, or forgets it when given null. */
export function writeText(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable: it lasts until the page closes
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const text = readText(key);
  if (text === null) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  writeText(key, JSON.stringify(value));
}
