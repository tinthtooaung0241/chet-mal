// Error tracking (Sentry) and play analytics (PostHog). Each one is on only when its key is set
// at build time (VITE_SENTRY_DSN, VITE_POSTHOG_KEY) and the player hasn't turned stats off.
// The SDKs are loaded lazily, so a build without keys never downloads them.
import { readText, writeText } from "./storage";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";
const OPT_OUT = "kitchen.noStats";

type Capture = (event: string, props?: Record<string, unknown>) => void;
let capture: Capture | null = null;
const early: [string, Record<string, unknown> | undefined][] = [];

export const statsAllowed = () => readText(OPT_OUT) !== "1";

export function setStatsAllowed(on: boolean) {
  writeText(OPT_OUT, on ? null : "1");
  if (!on) capture = null;
}

let sentryOn = false;

export async function startTelemetry() {
  if (SENTRY_DSN && !sentryOn) {
    sentryOn = true;
    const Sentry = await import("@sentry/browser");
    Sentry.init({ dsn: SENTRY_DSN, release: import.meta.env.MODE, tracesSampleRate: 0 });
  }
  if (POSTHOG_KEY && statsAllowed() && !capture) {
    const { default: posthog } = await import("posthog-js");
    posthog.init(POSTHOG_KEY, { api_host: POSTHOG_HOST, autocapture: false, capture_pageview: true, persistence: "localStorage" });
    capture = (event, props) => {
      if (statsAllowed()) posthog.capture(event, props);
    };
    for (const [event, props] of early.splice(0)) capture(event, props);
  }
}

/** Records one gameplay event, e.g. track("shift_end", { level: 3, stars: 2 }). */
export function track(event: string, props?: Record<string, unknown>) {
  if (capture) capture(event, props);
  else if (POSTHOG_KEY && early.length < 50) early.push([event, props]);
}
