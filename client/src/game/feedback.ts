// Presents game events to the local chef, filtered by role. Each event says which senses carry
// it; this class only delivers what the local role could perceive, in the forms that role uses:
//   - hearing roles: 3D sound placed around the chef, live stove sizzles, spoken phone orders
//   - everyone: text in the log and screen-reader announcements for perceived events
// A blind chef also hears each station's "signature" when facing it.
import {
  EMOTES,
  FOOD_RULES,
  SOUP_TIME,
  ROLES,
  currentSenses,
  perceivesEvent,
  stationName,
  potPhase,
  stovePhase,
  targetStation,
  type Chef,
  type EventKind,
  type Game,
  type GameEvent,
  type Role,
  type StationKind,
} from "@kitchen/shared";
import { glyph } from "../ui/icons";

type Wave = OscillatorType;
interface Note {
  freq: number;
  at: number;
  dur: number;
  wave?: Wave;
  gain?: number;
  /** slide to this frequency over the note */
  to?: number;
}

const n = (freq: number, at: number, dur: number, wave: Wave = "sine", gain = 0.25, to?: number): Note => ({
  freq,
  at,
  dur,
  wave,
  gain,
  to,
});

const SOUNDS: Partial<Record<EventKind, Note[]>> = {
  pickup: [n(660, 0, 0.06)],
  place: [n(440, 0, 0.07)],
  chop: [n(170, 0, 0.045, "square", 0.12)],
  chopped: [n(660, 0, 0.08, "triangle"), n(880, 0.09, 0.12, "triangle")],
  cooked: [n(880, 0, 0.12, "triangle"), n(880, 0.18, 0.18, "triangle")],
  perfect: [n(1568, 0, 0.12, "sine", 0.2), n(2093, 0.12, 0.25, "sine", 0.2)],
  smoking: [n(1000, 0, 0.08, "square", 0.12), n(1000, 0.12, 0.08, "square", 0.12)],
  burnt: [n(150, 0, 0.45, "sawtooth", 0.2)],
  served: [n(523, 0, 0.1), n(659, 0.1, 0.1), n(784, 0.2, 0.25)],
  wrong: [n(220, 0, 0.15, "sawtooth", 0.15), n(170, 0.16, 0.25, "sawtooth", 0.15)],
  order: [n(1320, 0, 0.12, "sine", 0.12)],
  phone: [n(880, 0, 0.35, "square", 0.08), n(988, 0, 0.35, "square", 0.08), n(880, 0.5, 0.35, "square", 0.08), n(988, 0.5, 0.35, "square", 0.08)],
  impatient: [n(330, 0, 0.4, "triangle", 0.15, 220)],
  expired: [n(300, 0, 0.18, "sawtooth", 0.15), n(200, 0.2, 0.3, "sawtooth", 0.15)],
  trash: [n(120, 0, 0.14, "square", 0.12)],
  invalid: [n(200, 0, 0.09, "square", 0.08)],
  bump: [n(90, 0, 0.08, "sine", 0.35, 60)],
  ping: [n(1760, 0, 0.18, "sine", 0.22), n(2637, 0.08, 0.3, "sine", 0.14)],
  bell: [n(2093, 0, 0.9, "sine", 0.25), n(4186, 0, 0.5, "sine", 0.08)],
  over: [n(784, 0, 0.15), n(659, 0.16, 0.15), n(523, 0.32, 0.4)],
  // a quick shake-shake over the plate
  season: [n(3200, 0, 0.03, "square", 0.05), n(2800, 0.07, 0.03, "square", 0.05), n(3400, 0.14, 0.03, "square", 0.05)],
  // a soft, falling "uh-oh" as cold food warms up
  warm: [n(660, 0, 0.12, "triangle", 0.12), n(494, 0.13, 0.22, "triangle", 0.12)],
  // the terrace door chime: a customer walks in
  arrive: [n(1319, 0, 0.35, "sine", 0.1), n(1047, 0.22, 0.5, "sine", 0.1)],
};



// Each emote has its own short melody so a blind teammate can tell them apart.
const EMOTE_SOUNDS: Record<string, Note[]> = {
  Yes: [n(523, 0, 0.1), n(784, 0.1, 0.15)],
  No: [n(392, 0, 0.12, "triangle"), n(262, 0.12, 0.2, "triangle")],
  Here: [n(1047, 0, 0.08), n(1047, 0.12, 0.08), n(1047, 0.24, 0.08)],
  Hurry: [n(880, 0, 0.06, "square", 0.12), n(988, 0.07, 0.06, "square", 0.12), n(1175, 0.14, 0.06, "square", 0.12), n(1319, 0.21, 0.1, "square", 0.12)],
  Stop: [n(220, 0, 0.3, "square", 0.15)],
  Done: [n(659, 0, 0.1), n(784, 0.1, 0.1), n(1047, 0.2, 0.25)],
};
if (Object.keys(EMOTE_SOUNDS).length !== EMOTES.length) throw new Error("every emote needs a sound");

// What a station sounds like when a blind chef turns to face it.
const STATION_SIGNATURES: Record<StationKind, Note[]> = {
  counter: [n(330, 0, 0.05, "sine", 0.18)],
  crate: [n(220, 0, 0.05, "square", 0.12), n(196, 0.07, 0.05, "square", 0.12)],
  board: [n(160, 0, 0.06, "triangle", 0.25), n(160, 0.1, 0.06, "triangle", 0.25)],
  stove: [n(110, 0, 0.18, "sawtooth", 0.08)],
  plates: [n(2400, 0, 0.05, "sine", 0.12), n(2900, 0.06, 0.06, "sine", 0.1)],
  bowls: [n(1900, 0, 0.06, "sine", 0.12), n(2300, 0.07, 0.07, "sine", 0.1)],
  pot: [n(140, 0, 0.12, "sine", 0.18), n(210, 0.1, 0.12, "sine", 0.14), n(170, 0.2, 0.12, "sine", 0.12)],
  serve: [n(1568, 0, 0.25, "sine", 0.15)],
  trash: [n(100, 0, 0.12, "square", 0.12)],
  sink: [n(900, 0, 0.12, "sine", 0.12, 500)],
  // a rattle of jars, and the low hum of a fridge
  spice: [n(3000, 0, 0.03, "square", 0.06), n(3300, 0.06, 0.03, "square", 0.06), n(2700, 0.12, 0.03, "square", 0.06)],
  fridge: [n(118, 0, 0.35, "sine", 0.16), n(236, 0, 0.35, "sine", 0.05)],
  decor: [],
  // a hollow wooden knock-knock on the pantry shelf
  pantry: [n(260, 0, 0.06, "triangle", 0.2), n(220, 0.1, 0.06, "triangle", 0.2)],
};

const ROUTINE = new Set<EventKind>(["pickup", "place", "trash"]);

const THUNDER: Note[] = [n(55, 0, 1.6, "sawtooth", 0.35, 35), n(80, 0.05, 1.2, "square", 0.15, 40)];

const LOG_SIZE = 6;
const MAX_TOASTS = 3;

const TOAST_ICONS: Partial<Record<EventKind | "info", string>> = {
  pickup: "pickup",
  place: "place",
  handoff: "give",
  hand: "hands",
  chopped: "knife",
  cooked: "flame",
  perfect: "sparkle",
  smoking: "smoke",
  burnt: "burnt",
  served: "check",
  wrong: "cross",
  sick: "sick",
  sniff: "smell",
  order: "ticket",
  phone: "phone",
  impatient: "alarm",
  expired: "angry",
  trash: "bin",
  invalid: "warning",
  ping: "pin",
  emote: "signs",
  bell: "bell",
  blackout: "moon",
  storm: "storm",
  over: "flag",
  season: "salt",
  warm: "snow",
  info: "chef",
};
const GOOD = new Set<EventKind | "info">(["served", "cooked", "chopped", "perfect", "order", "phone", "season"]);
const SMOKE_BEEP_INTERVAL = 0.6;

interface Sizzle {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  whistle: OscillatorNode;
  whistleGain: GainNode;
  panner: PannerNode;
}

export class Feedback {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private sizzles = new Map<number, Sizzle>();
  private storm: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private smokeTimer = 0;
  private lastTarget: number | null = null;
  private flip = false;
  private time = 0;
  speak = false;
  role: Role = "full";

  constructor(
    private readonly politeRegion: HTMLElement,
    private readonly urgentRegion: HTMLElement,
    private readonly log: HTMLOListElement,
  ) {}

  private get hears() {
    return ROLES[this.role].hears;
  }

  /** Shared with voice chat so teammates' voices are placed in the same 3D sound space. */
  get audioContext(): AudioContext | null {
    return this.ctx;
  }

  /** Browsers only allow audio after a user gesture; call this from key/click handlers. */
  unlock() {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setRole(role: Role) {
    this.role = role;
    if (!this.hears) this.stopSizzles();
    this.lastTarget = null;
  }

  setPaused(paused: boolean) {
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  handle(event: GameEvent, me: Chef, game: Game) {
    const isActor = event.actors?.includes(me.id) ?? false;
    if (!perceivesEvent(game, me, event)) return;
    const hearsNow = currentSenses(game, me).hears;
    const notes = event.kind === "emote" ? EMOTE_SOUNDS[event.text?.match(/signals: (\w+)/)?.[1] ?? ""] : SOUNDS[event.kind];
    const audible = event.senses.includes("sound") || (isActor && event.senses.includes("touch"));
    if (notes && hearsNow && audible) this.play(notes, event.x, event.z, me);
    if (event.kind === "storm" && this.hears && game.storm > 0) this.play(THUNDER, me.x + 3, me.z + 2, me);
    if (!event.text) return;
    // A teammate's routine handling reaches you as a cue, not a description: you might hear
    // a clatter across the kitchen, but not what they picked up.
    if (!isActor && ROUTINE.has(event.kind)) return;
    // the caller's voice: phone orders are spoken aloud to anyone who can hear
    if (event.kind === "phone" && hearsNow) this.speakAloud(event.text.replace(/^Phone order: /, ""), true);
    this.say(event.text, event.urgent ?? false, event.kind !== "phone", event.kind);
  }

  /**
   * A new item chosen at a fridge or spice rack: a click that rises with its number (so you can
   * count by ear) and its name for screen readers and speech. Not a toast: it's just a choice.
   */
  pickCue(index: number, name: string, me: Chef) {
    this.play([n(520 + index * 90, 0, 0.05, "triangle", 0.15)], me.x, me.z, me);
    this.announce(`${index + 1}: ${name}`, false);
    if (this.speak) this.speakAloud(name, true);
  }

  /**
   * The coach's next step (guided shift): to the screen reader, and spoken for the blind chef (or
   * anyone with speech on). No toast: the coach banner shows it.
   */
  coach(text: string) {
    this.announce(`Next: ${text}`, false);
    if (this.speak || this.role === "blind") this.speakAloud(text, true);
  }

  /** Text message: toast + screen reader (+ speech if enabled). */
  say(text: string, urgent = false, speech = true, kind: EventKind | "info" = "info") {
    this.announce(text, urgent);
    this.addLog(text, urgent);
    this.toast(text, urgent, kind);
    if (speech && this.speak) this.speakAloud(text, urgent);
  }

  /** Continuous cues that are about state rather than single events. */
  update(game: Game, me: Chef, dt: number) {
    this.time += dt;
    // a storm's roar is the only thing a hearing chef can hear while it lasts
    this.updateStorm(this.hears && game.storm > 0);
    const hearsNow = currentSenses(game, me).hears;
    this.updateSizzles(game, me, hearsNow);
    if (!hearsNow) return;

    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      const smoking = game.stations.find(
        (s) => (s.kind === "stove" && s.item?.type === "food" && stovePhase(s.item) === "smoking") || (s.pot && potPhase(s.pot) === "smoking"),
      );
      if (smoking) {
        this.play(SOUNDS.smoking!, smoking.x, smoking.z, me);
        this.smokeTimer = SMOKE_BEEP_INTERVAL;
      }
    }

    // a blind chef hears what it turns to face; the name goes to the screen reader only
    if (this.role === "blind") {
      const target = targetStation(game, me);
      const id = target?.id ?? null;
      if (id !== this.lastTarget) {
        this.lastTarget = id;
        if (target) {
          this.play(STATION_SIGNATURES[target.kind], target.x, target.z, me);
          this.announce(stationName(target), false);
        }
      }
    }
  }

  // --- audio ------------------------------------------------------------------

  /** Place a world position relative to the chef's ears (listener sits at the origin facing -z). */
  private relative(x: number, z: number, me: Chef): [number, number, number] {
    const dx = x - me.x;
    const dz = z - me.z;
    const f = me.facing;
    const forward = dx * Math.sin(f) + dz * Math.cos(f);
    const right = dx * Math.cos(f) - dz * Math.sin(f);
    return [right, 0, -forward];
  }

  private panner(x: number, z: number, me: Chef): PannerNode {
    const [px, py, pz] = this.relative(x, z, me);
    return new PannerNode(this.ctx!, {
      panningModel: "HRTF",
      distanceModel: "inverse",
      refDistance: 1,
      rolloffFactor: 0.7,
      positionX: px,
      positionY: py,
      positionZ: pz,
    });
  }

  private play(notes: Note[], x: number, z: number, me: Chef) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const panner = this.panner(x, z, me);
    panner.connect(ctx.destination);
    const now = ctx.currentTime;
    for (const note of notes) {
      const osc = new OscillatorNode(ctx, { type: note.wave, frequency: note.freq });
      const gain = new GainNode(ctx, { gain: 0 });
      const start = now + note.at;
      if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, start + note.dur);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(note.gain ?? 0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
      osc.connect(gain).connect(panner);
      osc.start(start);
      osc.stop(start + note.dur + 0.02);
    }
  }

  private noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const ctx = this.ctx!;
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  /**
   * One looping sizzle per busy stove. Pitch climbs while cooking, settles when cooked,
   * whistles during the perfect window (the only perfect cue anywhere), and turns harsh when smoking.
   */
  private updateSizzles(game: Game, me: Chef, hearsNow: boolean) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    if (!hearsNow) {
      this.stopSizzles();
      return;
    }
    const active = new Set<number>();
    for (const s of game.stations) {
      const food = s.kind === "stove" && s.item?.type === "food" ? s.item : null;
      const pot = s.pot && (s.pot.state === "cooking" || s.pot.state === "done") ? s.pot : null;
      const phase = food ? stovePhase(food) : pot ? potPhase(pot) : null;
      if (!phase) continue;
      active.add(s.id);
      let sizzle = this.sizzles.get(s.id);
      if (!sizzle) {
        const source = new AudioBufferSourceNode(ctx, { buffer: this.noiseBuffer(), loop: true });
        const filter = new BiquadFilterNode(ctx, { type: "bandpass", frequency: 900, Q: 1.4 });
        const gain = new GainNode(ctx, { gain: 0 });
        const whistle = new OscillatorNode(ctx, { type: "sine", frequency: 2600 });
        const whistleGain = new GainNode(ctx, { gain: 0 });
        const panner = this.panner(s.x, s.z, me);
        source.connect(filter).connect(gain).connect(panner);
        whistle.connect(whistleGain).connect(panner);
        panner.connect(ctx.destination);
        source.start();
        whistle.start();
        sizzle = { source, filter, gain, whistle, whistleGain, panner };
        this.sizzles.set(s.id, sizzle);
      }
      const progress = Math.min(1, food ? food.cook / (FOOD_RULES[food.kind].cookTime ?? 6) : pot!.cook / SOUP_TIME);
      const whistleNow = 0.07 * (0.6 + 0.4 * Math.sin(this.time * 18));
      // a pot bubbles (low, pulsing); a pan sizzles (high, hissing)
      const bubble = 0.55 + 0.45 * Math.abs(Math.sin(this.time * 7 + s.id));
      const settings: Record<string, [number, number, number]> = food
        ? {
            // [band frequency, noise gain, whistle gain]
            cooking: [700 + 900 * progress, 0.05 + 0.05 * progress, 0],
            cooked: [1700, 0.1, 0],
            perfect: [2300, 0.12, whistleNow],
            smoking: [800, 0.18, 0],
          }
        : {
            cooking: [260 + 260 * progress, (0.06 + 0.06 * progress) * bubble, 0],
            cooked: [560, 0.12 * bubble, 0],
            perfect: [760, 0.13 * bubble, whistleNow],
            smoking: [420, 0.2, 0],
          };
      const [freq, level, whistle] = settings[phase];
      const t = ctx.currentTime;
      sizzle.filter.frequency.setTargetAtTime(freq, t, 0.08);
      sizzle.filter.Q.setTargetAtTime(phase === "smoking" ? 0.6 : 1.4, t, 0.1);
      sizzle.gain.gain.setTargetAtTime(level, t, 0.08);
      sizzle.whistleGain.gain.setTargetAtTime(whistle, t, 0.03);
      const [px, py, pz] = this.relative(s.x, s.z, me);
      sizzle.panner.positionX.setTargetAtTime(px, t, 0.05);
      sizzle.panner.positionY.setTargetAtTime(py, t, 0.05);
      sizzle.panner.positionZ.setTargetAtTime(pz, t, 0.05);
    }
    for (const [id, sizzle] of this.sizzles) if (!active.has(id)) this.stopSizzle(id, sizzle);
  }

  private stopSizzle(id: number, s: Sizzle) {
    s.source.stop();
    s.whistle.stop();
    s.panner.disconnect();
    this.sizzles.delete(id);
  }

  stopSizzles() {
    for (const [id, s] of this.sizzles) this.stopSizzle(id, s);
  }

  /**
   * A soft footfall where a chef stepped. Teammates' steps are louder than your own, so a blind
   * chef can follow everyone around the kitchen by ear.
   */
  footstep(x: number, z: number, me: Chef, game: Game, own: boolean) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !currentSenses(game, me).hears) return;
    const source = new AudioBufferSourceNode(ctx, { buffer: this.noiseBuffer(), playbackRate: 0.8 + Math.random() * 0.4 });
    const filter = new BiquadFilterNode(ctx, { type: "bandpass", frequency: 300 + Math.random() * 250, Q: 1.2 });
    const gain = new GainNode(ctx, { gain: 0 });
    const panner = this.panner(x, z, me);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(own ? 0.05 : 0.22, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    source.connect(filter).connect(gain).connect(panner).connect(ctx.destination);
    source.start(t, Math.random() * 0.5, 0.12);
  }

  /** Rain and wind: loud low-passed noise that fades in and out with the storm. */
  private updateStorm(on: boolean) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    if (on && !this.storm) {
      const source = new AudioBufferSourceNode(ctx, { buffer: this.noiseBuffer(), loop: true });
      const filter = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 700, Q: 0.4 });
      const gain = new GainNode(ctx, { gain: 0 });
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      gain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.6);
      this.storm = { source, gain };
    } else if (!on && this.storm) {
      const { source, gain } = this.storm;
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      source.stop(ctx.currentTime + 2.5);
      this.storm = null;
    }
  }

  // --- text -------------------------------------------------------------------

  private speakAloud(text: string, interrupt: boolean) {
    if (!("speechSynthesis" in window)) return;
    if (interrupt) speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  private announce(text: string, urgent: boolean) {
    const region = urgent ? this.urgentRegion : this.politeRegion;
    // alternate a trailing invisible character so repeated messages are re-read
    this.flip = !this.flip;
    region.textContent = text + (this.flip ? "​" : "");
  }

  private addLog(text: string, urgent: boolean) {
    const li = document.createElement("li");
    li.textContent = text;
    if (urgent) li.classList.add("urgent");
    this.log.prepend(li);
    while (this.log.children.length > LOG_SIZE) this.log.lastElementChild?.remove();
  }

  /** A message card that pops in at the left and fades out. */
  private toast(text: string, urgent: boolean, kind: EventKind | "info") {
    const box = document.getElementById("toasts");
    if (!box) return;
    const el = document.createElement("div");
    const tone = urgent ? "urgent" : GOOD.has(kind) ? "good" : kind === "invalid" ? "soft" : "";
    el.className = `toast ${tone}`;
    const icon = document.createElement("span");
    icon.className = "icon";
    icon.append(glyph(TOAST_ICONS[kind] ?? "signs"));
    const body = document.createElement("span");
    body.className = "text";
    body.textContent = text;
    el.title = text;
    el.append(icon, body);
    box.prepend(el);
    while (box.children.length > MAX_TOASTS) box.lastElementChild?.remove();
    const life = urgent ? 6500 : kind === "invalid" ? 2500 : 4200;
    setTimeout(() => el.classList.add("out"), life);
    setTimeout(() => el.remove(), life + 450);
  }

  clearLog() {
    this.log.replaceChildren();
    document.getElementById("toasts")?.replaceChildren();
  }
}
