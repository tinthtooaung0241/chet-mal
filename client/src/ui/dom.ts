/** The page element with this id (the game's markup is fixed, so it's always there). */
export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Lets go of the mouse (pointer lock), so a menu can use the cursor. */
export function releasePointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}
