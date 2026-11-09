// Arrow keys for every menu: they move between a dialog's controls, in reading order. Text boxes
// and radio groups keep their own arrow behaviour; a dialog can opt out with data-own-keys.
const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex='0']";

export function setupMenuKeys() {
  // the focus ring is only for people moving around by keyboard, not after a menu just opens
  document.addEventListener("keydown", (e) => {
    if (e.key === "Tab" || e.key.startsWith("Arrow")) document.body.classList.add("keyboard-nav");
  }, true);
  document.addEventListener("pointerdown", () => document.body.classList.remove("keyboard-nav"), true);
  document.addEventListener("keydown", (e) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    const dialog = target?.closest<HTMLDialogElement>("dialog[open]") ?? document.querySelector<HTMLDialogElement>("dialog[open]:modal");
    if (!dialog || dialog.hasAttribute("data-own-keys")) return;
    if (target instanceof HTMLInputElement && target.type !== "checkbox") return;
    if (target instanceof HTMLSelectElement) return;
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    if (!items.length) return;
    const at = target ? items.indexOf(target) : -1;
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? items.length - 1
      : e.key === "ArrowDown" || e.key === "ArrowRight" ? (at + 1) % items.length
      : (at - 1 + items.length) % items.length;
    items[next].focus();
    e.preventDefault();
  });
}
