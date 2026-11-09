// Whether a porter bot joins your shift (solo, or in the empty seat of a kitchen you host).
import { readText, writeText } from "./storage";

const KEY = "kitchen.helper";

export const helperOn = () => readText(KEY) === "on";
export const setHelper = (on: boolean) => writeText(KEY, on ? "on" : "off");
