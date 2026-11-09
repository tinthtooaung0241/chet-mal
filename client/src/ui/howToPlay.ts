// How to play: one idea per page. Next walks through them, Back returns (and leaves from the
// first page), left and right turn the pages, and the last page starts the tutorial kitchen.
import { $ } from "./dom";

export function setupHowToPlay(startTutorial: () => void) {
  const dialog = $<HTMLDialogElement>("how-to-play");
  const pages = [...dialog.querySelectorAll<HTMLElement>(".how-page")];
  const dots = [...dialog.querySelectorAll(".how-dots i")];
  let page = 0;

  const show = (to: number) => {
    page = to;
    pages.forEach((p, i) => (p.hidden = i !== to));
    dots.forEach((d, i) => d.classList.toggle("on", i === to));
    const last = to === pages.length - 1;
    $("how-next").hidden = last;
    $("how-tutorial").hidden = !last;
    if (dialog.open) $(last ? "how-tutorial" : "how-next").focus();
  };

  $("how-next").addEventListener("click", () => show(page + 1));
  dialog.addEventListener("keydown", (e) => {
    const to = e.key === "ArrowRight" ? page + 1 : e.key === "ArrowLeft" ? page - 1 : -1;
    if (to < 0 || to >= pages.length) return;
    show(to);
    e.preventDefault();
    e.stopPropagation();
  });
  $("how-close").addEventListener("click", () => {
    if (page > 0) show(page - 1);
    else dialog.close();
  });
  $("how-tutorial").addEventListener("click", startTutorial);

  return {
    open() {
      show(0);
      dialog.showModal();
      $("how-next").focus();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
