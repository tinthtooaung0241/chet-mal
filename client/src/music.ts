// Background music: a cozy loop made in Web Audio (no files) that picks up in rush hour and the
// last 30 seconds. Its level is a setting; a storm drowns it out like every other sound.
import { readText, writeText } from "./storage";

export type MusicLevel = "off" | "low" | "on";
const KEY = "kitchen.music";
const GAIN: Record<MusicLevel, number> = { off: 0, low: 0.05, on: 0.11 };

export const musicLevel = (): MusicLevel => {
  const saved = readText(KEY);
  return saved === "off" || saved === "low" ? saved : "on";
};
export const saveMusicLevel = (level: MusicLevel) => writeText(KEY, level);

// I-vi-IV-V in F major, one bar each, and a little pentatonic tune over it (eighth notes, 0 rests)
const CHORDS = [
  [174.61, 220, 261.63],
  [146.83, 174.61, 220],
  [116.54, 146.83, 174.61],
  [130.81, 164.81, 196],
];
const [F4, G4, A4, C5, D5] = [349.23, 392, 440, 523.25, 587.33];
const TUNE = [
  [A4, 0, C5, 0, D5, C5, A4, 0],
  [F4, 0, A4, 0, C5, A4, G4, 0],
  [D5, 0, C5, 0, A4, G4, F4, 0],
  [G4, 0, A4, C5, 0, G4, 0, 0],
].flat();

export class Music {
  private out: GainNode | null = null;
  /** when the next eighth note starts, and which one it is */
  private next = 0;
  private step = 0;

  constructor(private readonly context: () => AudioContext | null) {}

  /**
   * Every frame: fades in or out and keeps a moment of music scheduled ahead.
   * @param on a shift is being played
   * @param fast rush hour or the last 30 seconds
   * @param silent nothing to hear (a storm, or a chef who can't hear)
   */
  update(on: boolean, fast: boolean, silent: boolean) {
    const ctx = this.context();
    if (!ctx || ctx.state !== "running") return;
    if (!this.out) {
      this.out = new GainNode(ctx, { gain: 0 });
      this.out.connect(ctx.destination);
    }
    const level = on && !silent ? GAIN[musicLevel()] : 0;
    this.out.gain.setTargetAtTime(level, ctx.currentTime, 0.4);
    if (level === 0 && this.out.gain.value < 0.002) {
      this.next = 0; // silent: nothing to schedule, start again on the beat when it comes back
      return;
    }
    const eighth = 60 / (fast ? 116 : 92) / 2;
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.3) {
      this.play(ctx, this.next, eighth);
      this.next += eighth;
      this.step += 1;
    }
  }

  private play(ctx: AudioContext, at: number, eighth: number) {
    const i = this.step % 8;
    const chord = CHORDS[Math.floor(this.step / 8) % CHORDS.length];
    // a soft pad on the bar, a bass note on beats one and three, the tune on top
    if (i === 0) for (const f of chord) this.note(ctx, f, at, eighth * 8, "sine", 0.1);
    if (i % 4 === 0) this.note(ctx, chord[0] / 2, at, eighth * 3, "triangle", 0.45);
    const tune = TUNE[this.step % TUNE.length];
    if (tune) this.note(ctx, tune, at, eighth * 0.9, "triangle", 0.2);
  }

  private note(ctx: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, gain: number) {
    const osc = new OscillatorNode(ctx, { type, frequency: freq });
    const env = new GainNode(ctx, { gain: 0 });
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env).connect(this.out!);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
}
