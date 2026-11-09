// How fast your shifts run: Cozy (the default: more time, and an arrow for every step) or Classic.
// Online, the host's choice counts.
import { paceById, type Pace } from "@kitchen/shared";
import { readText, writeText } from "./storage";

const KEY = "kitchen.pace";

export const myPace = (): Pace => (readText(KEY) === null ? "cozy" : paceById(readText(KEY)));
export const setPace = (pace: Pace) => writeText(KEY, pace);
