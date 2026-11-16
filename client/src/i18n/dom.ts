// The page in the player's language. One pass over the page as it loads, then a watcher that
// translates whatever the game writes later (tickets, toasts, menus, the end screen), so screens
// are written in English once and shown in Burmese without each one knowing. Text that is already
// Burmese is left alone, which also stops the watcher reacting to its own changes.
import { LANG, isBurmese, tr } from "./index";

/** attributes people see or hear (labels on icon buttons, tooltips, placeholders) */
const ATTRS = ["aria-label", "title", "placeholder", "data-label", "alt"];
/** Myanmar script: already translated (a text is translated once; its Burmese passes through) */
const MYANMAR = /[က-႟ꩠ-ꩿꧠ-꧿]/;
const LATIN = /[A-Za-z]/;
/** an English word (in a text that's partly Burmese already, e.g. built from translated pieces) */
const WORD = /[A-Za-z]{2,}/;
/** never translated: scripts, keys, the code people type, player names... */
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "KBD", "CODE", "TEXTAREA"]);

function wanted(text: string | null): text is string {
  return !!text && LATIN.test(text) && (!MYANMAR.test(text) || WORD.test(text));
}

function skipped(el: Element | null): boolean {
  for (let n = el; n; n = n.parentElement) {
    if (SKIP.has(n.tagName) || n.getAttribute("translate") === "no") return true;
  }
  return false;
}

function text(node: Text) {
  if (!wanted(node.nodeValue) || skipped(node.parentElement)) return;
  const out = tr(node.nodeValue);
  if (out !== node.nodeValue) node.nodeValue = out;
}

function attributes(el: Element) {
  if (skipped(el)) return;
  for (const name of ATTRS) {
    const value = el.getAttribute(name);
    if (!wanted(value)) continue;
    const out = tr(value);
    if (out !== value) el.setAttribute(name, out);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return text(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) attributes(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) text(n as Text);
    else attributes(n as Element);
  }
}

/** Elements whose Burmese needs its own markup (a key or a bold word in the middle of a sentence). */
const HTML: Record<string, string> = {
  "help-hint": "ခလုတ်တွေ ကြည့်ဖို့ <kbd>?</kbd> ကို နှိပ်ပါ",
  "ios-tip-text": "မျက်နှာပြင် အပြည့်: <b translate=\"no\">Share</b> ကို နှိပ်ပြီး <b translate=\"no\">Add to Home Screen</b> ကို ရွေးပါ",
};

/**
 * Put the page in the chosen language: the html lang (fonts, line breaking, screen readers), the
 * Burmese font, the title and every string, then keep translating what the game adds.
 */
export function localizePage() {
  document.documentElement.lang = LANG;
  if (!isBurmese) return;
  // Noto Sans Myanmar, so Burmese reads the same everywhere, including older phones whose own
  // Myanmar font is the old Zawgyi encoding (it garbles standard Unicode text)
  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;500;600;700&display=swap";
  document.head.append(font);
  document.title = tr(document.title);
  for (const [id, html] of Object.entries(HTML)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }
  walk(document.body);
  new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === "characterData") text(change.target as Text);
      else if (change.type === "attributes") attributes(change.target as Element);
      else for (const node of change.addedNodes) walk(node);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
