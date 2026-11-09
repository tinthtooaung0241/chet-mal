// Settings: the camera view, music, sound, voices, text size, graphics, motion and sharing play
// stats, all remembered in this browser.
import { musicLevel, saveMusicLevel, type MusicLevel } from "../music";
import { PREFS, pref, savePref, type PrefName } from "../prefs";
import { readText, writeText } from "../storage";
import { setStatsAllowed, startTelemetry, statsAllowed } from "../telemetry";
import { $ } from "./dom";

export type ViewPref = "fpp" | "tpp";
const VIEW_KEY = "view";

/** First person unless the player chose the overhead view. */
export const viewPref = (): ViewPref => (readText(VIEW_KEY) === "tpp" ? "tpp" : "fpp");
export const saveViewPref = (view: ViewPref) => writeText(VIEW_KEY, view);

/**
 * Wires the Settings dialog and returns its opener; onView hears when another camera is picked,
 * onPref when a comfort setting changes (so it takes effect straight away).
 */
export function setupSettings(onView: (view: ViewPref) => void, onPref: (name: PrefName) => void): () => void {
  const dialog = $<HTMLDialogElement>("settings");
  const radios = (name: string) => dialog.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`);
  $("settings-done").addEventListener("click", () => dialog.close());
  dialog.addEventListener("change", (e) => {
    const radio = e.target as HTMLInputElement;
    if (radio.name === "stats") {
      setStatsAllowed(radio.value === "on");
      if (radio.value === "on") void startTelemetry();
    } else if (radio.name in PREFS) {
      savePref(radio.name as PrefName, radio.value);
      onPref(radio.name as PrefName);
    } else if (radio.name === "music") {
      saveMusicLevel(radio.value as MusicLevel);
    } else if (radio.name === "view") {
      saveViewPref(radio.value as ViewPref);
      onView(radio.value as ViewPref);
    }
  });
  return () => {
    for (const r of radios("view")) r.checked = r.value === viewPref();
    for (const r of radios("music")) r.checked = r.value === musicLevel();
    for (const name of Object.keys(PREFS) as PrefName[]) for (const r of radios(name)) r.checked = r.value === pref(name);
    for (const r of radios("stats")) r.checked = (r.value === "on") === statsAllowed();
    dialog.showModal();
  };
}
