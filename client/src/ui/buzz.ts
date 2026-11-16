// What the kitchen feels like in the hand: on phones that can vibrate (Android; iPhone browsers
// can't), the things that happen to you each have their own buzz.

const BUZZES: Record<string, number[]> = {
  served: [18, 50, 18],
  perfect: [12],
  burnt: [140],
  fire: [70, 60, 70, 60, 70],
  invalid: [30, 40, 30],
  wrong: [30, 40, 30],
  expired: [90],
};

/** Buzz for something that just happened (only with the touch layout showing). */
export function buzzFor(kind: string) {
  if (typeof document === "undefined" || !BUZZES[kind] || !document.body.classList.contains("touch")) return;
  navigator.vibrate?.(BUZZES[kind]);
}
