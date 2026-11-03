// Our own dropdown over a real <select>: the select keeps the value and the change events, so
// the code using it doesn't change. Options ending in ★/☆ show them as our star icon. The list
// floats over what's below, like a select.
import { glyph } from "./icons";

function fillLabel(el: HTMLElement, text: string) {
  const [, number, name, stars] = text.match(/^(?:(\d+)\.\s*)?(.*?)\s*([★☆]*)$/)!;
  const badge = document.createElement("span");
  badge.className = "dd-number";
  badge.textContent = number ?? "";
  const label = document.createElement("span");
  label.className = "dd-name";
  label.textContent = name;
  const row = document.createElement("span");
  row.className = "dd-stars";
  for (const star of stars) {
    const icon = glyph("star");
    icon.classList.toggle("empty", star === "☆");
    row.append(icon);
  }
  el.replaceChildren(badge, label, row);
}

export function enhanceSelect(select: HTMLSelectElement) {
  const root = document.createElement("div");
  root.className = "dropdown";
  const face = document.createElement("button");
  face.type = "button";
  face.className = "dd-face";
  face.setAttribute("aria-haspopup", "listbox");
  const value = document.createElement("span");
  value.className = "dd-value";
  const arrow = document.createElement("span");
  arrow.className = "dd-arrow";
  arrow.setAttribute("aria-hidden", "true");
  face.append(value, arrow);
  const list = document.createElement("div");
  list.className = "dd-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  root.append(face, list);
  select.hidden = true;
  select.after(root);

  const setOpen = (open: boolean) => {
    list.hidden = !open;
    root.classList.toggle("open", open);
    face.setAttribute("aria-expanded", String(open));
    if (!open) return;
    // opens toward whichever side has room, and never runs off the screen
    const box = face.getBoundingClientRect();
    const below = innerHeight - box.bottom - 16;
    const above = box.top - 16;
    const up = list.scrollHeight > below && above > below;
    root.classList.toggle("up", up);
    list.style.maxHeight = `${Math.max(120, up ? above : below)}px`;
    const current = list.querySelector<HTMLElement>(".on") ?? list.querySelector<HTMLElement>("button");
    current?.focus();
    current?.scrollIntoView({ block: "nearest" });
  };

  const render = () => {
    face.disabled = select.disabled;
    fillLabel(value, select.selectedOptions[0]?.textContent ?? "");
    list.replaceChildren(
      ...[...select.options].map((option) => {
        const item = document.createElement("button");
        item.type = "button";
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(option.selected));
        item.classList.toggle("on", option.selected);
        fillLabel(item, option.textContent ?? "");
        item.addEventListener("click", () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          render();
          setOpen(false);
          face.focus();
        });
        return item;
      }),
    );
  };

  // a click anywhere else closes it, like any select
  document.addEventListener("pointerdown", (e) => {
    if (!list.hidden && !root.contains(e.target as Node)) setOpen(false);
  }, true);
  face.addEventListener("click", (e) => {
    e.preventDefault();
    render();
    setOpen(list.hidden !== false);
  });
  root.addEventListener("click", (e) => e.preventDefault());
  root.addEventListener("keydown", (e) => {
    if (list.hidden) {
      // arrows open it too, like a real select
      if (e.target === face && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        e.stopPropagation();
        render();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    const items = [...list.querySelectorAll<HTMLElement>("button")];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") items[Math.min(at + 1, items.length - 1)]?.focus();
    else if (e.key === "ArrowUp") items[Math.max(at - 1, 0)]?.focus();
    else if (e.key === "Home") items[0]?.focus();
    else if (e.key === "End") items[items.length - 1]?.focus();
    else if (e.key === "Escape") {
      setOpen(false);
      face.focus();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  });
  select.addEventListener("change", render);
  new MutationObserver(render).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });
  render();
  return { render };
}
