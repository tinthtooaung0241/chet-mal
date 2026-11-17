// Chet Mal icon set.
//  - Rendered icons: our own Blender models (food in every state, tools, soups, chef portraits),
//    shot with a cartoon outline. Generated into assets/icons by the IconStudio scene in
//    assets/kitchen_assets.blend, so they always match the 3D kitchen.
//  - UI glyphs: hand-drawn SVGs below, same style (chunky dark outline, warm palette), for
//    symbols that aren't objects in the kitchen (coin, ticket, phone, senses, weather…).

const rendered = import.meta.glob("../../../assets/icons/*.png", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

const RENDERED: Record<string, string> = Object.fromEntries(
  Object.entries(rendered).map(([path, url]) => [path.match(/([^/]+)\.png$/)![1], url]),
);

/** A rendered model icon (e.g. "Tomato", "Steak_Cooked", "Avatar_Deaf"), or null if missing. */
export function renderedIcon(name: string): string | null {
  return RENDERED[name] ?? null;
}

export function img(name: string, alt = ""): HTMLImageElement {
  const el = document.createElement("img");
  el.className = "icon-img";
  el.src = RENDERED[name] ?? "";
  el.alt = alt;
  el.draggable = false;
  if (!alt) el.setAttribute("aria-hidden", "true");
  return el;
}

// --- hand-drawn glyphs ---------------------------------------------------------------

const INK = "#2a2420";
const s = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

const GLYPHS: Record<string, string> = {
  expand: `<path d="M5 12V5h7M20 5h7v7M27 20v7h-7M12 27H5v-7" fill="none" ${s} stroke-width="3"/>`,
  gear: `<path d="M14 3h4l.7 3.4 2.6 1.1 2.9-1.9 2.8 2.8-1.9 2.9 1.1 2.6L29 14v4l-3.4.7-1.1 2.6 1.9 2.9-2.8 2.8-2.9-1.9-2.6 1.1L18 29h-4l-.7-3.4-2.6-1.1-2.9 1.9-2.8-2.8 1.9-2.9-1.1-2.6L3 18v-4l3.4-.7 1.1-2.6-1.9-2.9 2.8-2.8 2.9 1.9 2.6-1.1z" fill="#cfd8e3" ${s}/><circle cx="16" cy="16" r="4.5" fill="#fff" ${s}/>`,
  coin: `<circle cx="16" cy="16" r="12" fill="#f6c35b" ${s}/><circle cx="16" cy="16" r="8" fill="none" stroke="#c97d1c" stroke-width="1.6"/><path d="M16 10.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#fff3c4"/>`,
  hand: `<path d="M9.5 17V11a2 2 0 0 1 4 0v4V7a2 2 0 0 1 4 0v8V8.5a2 2 0 0 1 4 0V16v-4a2 2 0 0 1 4 0v8c0 5-3.5 8-8.5 8S9 26 7.5 22.5L5 17.5a2 2 0 0 1 3.4-2z" fill="#f1c9a5" ${s}/>`,
  menu: `<rect x="6" y="8" width="20" height="3.6" rx="1.8" fill="${INK}"/><rect x="6" y="14.2" width="20" height="3.6" rx="1.8" fill="${INK}"/><rect x="6" y="20.4" width="20" height="3.6" rx="1.8" fill="${INK}"/>`,
  ticket: `<path d="M8 4h16v22l-2.7-2-2.6 2-2.7-2-2.6 2-2.7-2L8 26z" fill="#fffaf0" ${s}/><path d="M12 10h8M12 14h8M12 18h5" ${s}/>`,
  phone: `<path d="M10.5 4.5l3.5.5 1.5 5-2.8 2.2c1.3 2.8 3.4 4.9 6.1 6.2l2.2-2.8 5 1.5.5 3.5c0 2.4-1.9 4.4-4.4 4.4C13.8 25 7 18.2 7 9.9c0-2.5 1.6-4.9 3.5-5.4z" fill="#5aa9e6" ${s}/>`,
  knife: `<path d="M5 22L19 8c2-2 5-2 7 0L11 23z" fill="#dfe4ea" ${s}/><path d="M11 23l-3 3c-1 1-3 1-3-1l1-2 3-2z" fill="#8a5530" ${s}/>`,
  flame: `<path d="M16 3c1 4 7 7 7 14a7 7 0 0 1-14 0c0-3 1.5-5 3-6.5 0 2 1 3.5 2.5 4C13.5 10 15 6 16 3z" fill="#f2a541" ${s}/><path d="M16 15c1.6 1.8 3 3.2 3 5.2a3 3 0 0 1-6 0c0-2 1.6-3.2 3-5.2z" fill="#ffd257"/>`,
  sparkle: `<path d="M14 4l2.6 7.4L24 14l-7.4 2.6L14 24l-2.6-7.4L4 14l7.4-2.6z" fill="#ffd257" ${s}/><path d="M24.5 20l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#ffd257" ${s}/>`,
  smoke: `<path d="M9 23a5 5 0 0 1 .6-10A6.5 6.5 0 0 1 22 11.5a5.5 5.5 0 0 1 1 11.5z" fill="#c4c8ce" ${s}/><path d="M12 8c0-2 2-2 2-4M18 8c0-2 2-2 2-4" ${s}/>`,
  burnt: `<path d="M9 24a5 5 0 0 1 .6-10A6.5 6.5 0 0 1 22 12.5a5.5 5.5 0 0 1 1 11.5z" fill="#3b4048" ${s}/><circle cx="12.5" cy="19" r="1.4" fill="#ff7a3c"/><circle cx="18" cy="17" r="1.2" fill="#ff7a3c"/><circle cx="21" cy="20.5" r="1" fill="#ffb25a"/>`,
  check: `<circle cx="16" cy="16" r="12" fill="#5cbf6b" ${s}/><path d="M10.5 16.5l3.8 3.8 7.4-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  cross: `<circle cx="16" cy="16" r="12" fill="#e4553f" ${s}/><path d="M11.5 11.5l9 9M20.5 11.5l-9 9" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  sick: `<circle cx="16" cy="16" r="12" fill="#9bd26b" ${s}/><path d="M10.5 12.5l3 2M21.5 12.5l-3 2M10 22c2-2 4 0 6-1.5s4 0 6-.5" fill="none" ${s}/>`,
  smell: `<path d="M9 26c-3-3 3-5 0-8s3-5 0-8M16 26c-3-3 3-5 0-8s3-5 0-8M23 26c-3-3 3-5 0-8s3-5 0-8" fill="none" stroke="#5cbf6b" stroke-width="2.4" stroke-linecap="round"/>`,
  alarm: `<circle cx="16" cy="18" r="10" fill="#fffaf0" ${s}/><path d="M16 12v6l4 2.5" fill="none" ${s}/><path d="M5 9l4-4M27 9l-4-4" ${s}/>`,
  angry: `<circle cx="16" cy="16" r="12" fill="#ff8a6a" ${s}/><path d="M10 11.5l4 2M22 11.5l-4 2M11 22c3-3 7-3 10 0" fill="none" ${s}/>`,
  bin: `<path d="M8 10h16l-1.5 16h-13z" fill="#7a8a82" ${s}/><rect x="6" y="6" width="20" height="4" rx="2" fill="#56645c" ${s}/><path d="M13 14v8M19 14v8" ${s}/>`,
  warning: `<path d="M16 4.5L28.5 26h-25z" fill="#f6c35b" ${s}/><path d="M16 12v6.5" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/><circle cx="16" cy="22.3" r="1.6" fill="${INK}"/>`,
  hands: `<path d="M3 20l6-6c2-2 4-2 6 0l2 2-4 4" fill="#f1c9a5" ${s}/><path d="M29 20l-6-6c-2-2-4-2-6 0l-2 2 4 4" fill="#c98a5a" ${s}/><path d="M11 18l4 4c1 1 2.5 1 3.5 0l3.5-3.5" fill="none" ${s}/>`,
  give: `<ellipse cx="13" cy="19" rx="9" ry="4.5" fill="#fffaf0" ${s}/><path d="M19 9h9M24 5l4 4-4 4" fill="none" ${s}/>`,
  pickup: `<path d="M5 24h22" ${s}/><path d="M16 21V7M10 12l6-6 6 6" fill="none" stroke="#5cbf6b" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  place: `<path d="M5 25h22l-2 3H7z" fill="#fffaf0" ${s}/><path d="M16 5v14M10 14l6 6 6-6" fill="none" stroke="#5aa9e6" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  pin: `<path d="M16 29s9-8.5 9-15a9 9 0 0 0-18 0c0 6.5 9 15 9 15z" fill="#e4553f" ${s}/><circle cx="16" cy="14" r="3.5" fill="#fff"/>`,
  bell: `<path d="M6 23a10 10 0 0 1 20 0z" fill="#f6c35b" ${s}/><rect x="4" y="23" width="24" height="4" rx="2" fill="#c97d1c" ${s}/><path d="M16 9V6M13.5 6h5" ${s}/>`,
  signs: `<path d="M5 7h22v13H14l-6 5v-5H5z" fill="#fffaf0" ${s}/><circle cx="11" cy="13.5" r="1.6" fill="${INK}"/><circle cx="16" cy="13.5" r="1.6" fill="${INK}"/><circle cx="21" cy="13.5" r="1.6" fill="${INK}"/>`,
  yes: `<path d="M10 14h-4v12h4zM10 14l5-8c2 0 3 1 2.5 3l-1 4h7.5c1.5 0 2.6 1.4 2.2 2.9l-2 7.6c-.3 1.4-1.6 2.5-3 2.5H10" fill="#f1c9a5" ${s}/>`,
  no: `<path d="M10 18h-4V6h4zM10 18l5 8c2 0 3-1 2.5-3l-1-4h7.5c1.5 0 2.6-1.4 2.2-2.9l-2-7.6c-.3-1.4-1.6-2.5-3-2.5H10" fill="#f1c9a5" ${s}/>`,
  here: `<ellipse cx="16" cy="25" rx="10" ry="4" fill="#ffd257" ${s}/><ellipse cx="16" cy="25" rx="4" ry="1.6" fill="#e4553f"/><path d="M16 3v14M11 12l5 5 5-5" fill="none" stroke="#e4553f" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  hurry: `<path d="M4 7l11 9-11 9zM16 7l11 9-11 9z" fill="#f2a541" ${s}/>`,
  stop: `<path d="M11 3h10l7 7v10l-7 7H11l-7-7V10z" fill="#e4553f" ${s}/><rect x="9" y="13.5" width="14" height="5" rx="2" fill="#fff"/>`,
  done: `<path d="M16 2l3.4 4.6 5.6-1.2-.6 5.7 4.6 3.4-4.6 3.4.6 5.7-5.6-1.2L16 27l-3.4-4.6-5.6 1.2.6-5.7L3 14.5l4.6-3.4-.6-5.7 5.6 1.2z" fill="#ffd257" ${s}/><path d="M11 15l3.5 3.5 6.5-7" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  mouse: `<rect x="9" y="4" width="14" height="24" rx="7" fill="#fffaf0" ${s}/><path d="M16 4v9M9 13h14" fill="none" ${s}/><rect x="14.6" y="7" width="2.8" height="4.5" rx="1.4" fill="#f6a491"/>`,
  bolt: `<path d="M18.5 3L7 18.5h7.5L12.5 29 25 13h-7.8z" fill="#ffd257" ${s}/>`,
  medal: `<path d="M9 3h6l3.5 9h-6zM23 3h-6l-3.5 9h6z" fill="#f6a491" ${s}/><circle cx="16" cy="20.5" r="8" fill="#ffd257" ${s}/><path d="M16 16l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="#fff3c4"/>`,
  critic: `<rect x="10" y="4" width="12" height="15" rx="1.5" fill="#3b4048" ${s}/><rect x="10" y="14" width="12" height="3.5" fill="#e4553f"/><ellipse cx="16" cy="21" rx="12" ry="3.5" fill="#3b4048" ${s}/><circle cx="23.5" cy="25.5" r="3.2" fill="#e4f0fb" ${s}/>`,
  sticker: `<path d="M6 6h20v13l-7 7H6z" fill="#b8a4e3" ${s}/><path d="M26 19h-7v7" fill="#fffaf0" ${s}/><path d="M11 14l3.2 3.2 6-6.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  chart: `<rect x="5" y="17" width="5.5" height="10" rx="1.5" fill="#f6a491" ${s}/><rect x="13.25" y="10" width="5.5" height="17" rx="1.5" fill="#ffd257" ${s}/><rect x="21.5" y="5" width="5.5" height="22" rx="1.5" fill="#b8a4e3" ${s}/>`,
  eye: `<path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z" fill="#fff" ${s}/><circle cx="16" cy="16" r="4.5" fill="#5aa9e6" ${s}/><circle cx="16" cy="16" r="1.6" fill="${INK}"/>`,
  ear: `<path d="M10 13a7 7 0 0 1 14 0c0 4-3 5-4 7.5-.8 2.2-1.5 5.5-5 5.5a3.5 3.5 0 0 1-3.5-3.5" fill="#f1c9a5" ${s}/><path d="M14 13.5a3 3 0 0 1 6 0c0 2-2 2.5-2 4.5" fill="none" ${s}/>`,
  voice: `<path d="M5 12h5l6-5v18l-6-5H5z" fill="#fffaf0" ${s}/><path d="M20 12a5 5 0 0 1 0 8M23.5 9a9.5 9.5 0 0 1 0 14" fill="none" ${s}/>`,
  moon: `<circle cx="16" cy="16" r="12" fill="#22303f" ${s}/><path d="M19 8a8.5 8.5 0 1 0 5 13.5A7 7 0 0 1 19 8z" fill="#ffd257"/>`,
  storm: `<path d="M8 19a5 5 0 0 1 .6-10A6.5 6.5 0 0 1 21 7.5a5.5 5.5 0 0 1 1 11.5z" fill="#8f9aa8" ${s}/><path d="M17 15l-5 8h4l-2 6 7-9h-4l2-5z" fill="#ffd257" ${s}/>`,
  flag: `<path d="M8 29V4" ${s}/><path d="M8 5h17v12H8z" fill="#fff" ${s}/><path d="M8 5h4.25v4H8zM16.5 5h4.25v4H16.5zM12.25 9h4.25v4h-4.25zM20.75 9H25v4h-4.25zM8 13h4.25v4H8zM16.5 13h4.25v4H16.5z" fill="${INK}"/>`,
  chef: `<path d="M9 18a5 5 0 0 1-1-9.8A6 6 0 0 1 16 4a6 6 0 0 1 8 4.2A5 5 0 0 1 23 18z" fill="#fffaf0" ${s}/><rect x="9" y="18" width="14" height="7" rx="1.5" fill="#fffaf0" ${s}/><path d="M13 18v4M19 18v4" ${s}/>`,
  star: `<path d="M16 3l3.9 8 8.8 1.2-6.4 6.1 1.6 8.7L16 22.8 8.1 27l1.6-8.7L3.3 12.2l8.8-1.2z" fill="#ffd257" ${s}/>`,
  play: `<path d="M10 6l16 10-16 10z" fill="#5cbf6b" ${s}/>`,
  back: `<path d="M14 6L4 16l10 10v-6h13v-8H14z" fill="#f2b84b" ${s}/>`,
  restart: `<path d="M23.6 10.6A10 10 0 1 0 26 17.5" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M26.5 4.5v8h-8z" fill="#f2b84b" ${s}/>`,
  exit: `<path d="M5 5h12v22H5z" fill="#c98a5a" ${s}/><circle cx="13.5" cy="16.5" r="1.5" fill="${INK}"/><path d="M21 16h8M25.5 12l4 4-4 4" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`,
  gamepad: `<path d="M9 9h14a6 6 0 0 1 5.8 7.5l-1.5 6a3.3 3.3 0 0 1-5.8 1.2L19 21h-6l-2.5 2.7a3.3 3.3 0 0 1-5.8-1.2l-1.5-6A6 6 0 0 1 9 9z" fill="#8e6bbf" ${s}/><path d="M10 13v5M7.5 15.5h5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="21" cy="14" r="1.5" fill="#ffd257"/><circle cx="24" cy="17" r="1.5" fill="#e4553f"/>`,
  link: `<path d="M13.5 18.5l5-5" ${s}/><path d="M14.5 10.5l2-2a5 5 0 0 1 7 7l-2 2M17.5 21.5l-2 2a5 5 0 0 1-7-7l2-2" fill="none" stroke="#5aa9e6" stroke-width="3" stroke-linecap="round"/>`,
  salt: `<path d="M10 13h12l-1.5 14h-9z" fill="#f4f1ea" ${s}/><path d="M10 13c0-4 2.7-7 6-7s6 3 6 7z" fill="#cfd5dc" ${s}/><circle cx="14" cy="10" r=".9" fill="${INK}"/><circle cx="18" cy="10" r=".9" fill="${INK}"/><circle cx="16" cy="8" r=".9" fill="${INK}"/><path d="M12.5 21h7" stroke="#e8e2d6" stroke-width="3"/>`,
  pepper: `<path d="M12 27h8l-1-8 2-7h-10l2 7z" fill="#8a5530" ${s}/><path d="M11 12a5 4 0 0 1 10 0z" fill="#5c3519" ${s}/><path d="M16 8V4" ${s}/><circle cx="16" cy="4" r="1.6" fill="#cfd5dc" ${s}/>`,
  soy: `<path d="M11 13h10v14H11z" fill="#3a1f10" ${s}/><path d="M11 13l2.5-5h5l2.5 5" fill="#3a1f10" ${s}/><rect x="13" y="4" width="6" height="4" rx="1" fill="#e4553f" ${s}/><rect x="11.5" y="17" width="9" height="6" fill="#fff3df"/><path d="M14 20h4" stroke="#e4553f" stroke-width="1.6" stroke-linecap="round"/>`,
  oil: `<path d="M12 13h8v13.5a1.5 1.5 0 0 1-1.5 1.5h-5a1.5 1.5 0 0 1-1.5-1.5z" fill="#c9c04a" ${s}/><path d="M12 13l1.6-4h4.8l1.6 4" fill="#c9c04a" ${s}/><path d="M16 9V4.5l3.5-1.5" fill="none" stroke="#9aa3ad" stroke-width="2.2" stroke-linecap="round"/><path d="M14 19c1.5-2 3.5-2 4 0-1 2-3 2-4 0z" fill="#5f7d2a"/>`,
  butter: `<path d="M4 23h24l-2.5 4h-19z" fill="#fbf7ef" ${s}/><path d="M8 15l11-3 6 3v8H8z" fill="#f7dc7a" ${s}/><path d="M8 15l11-3 6 3-11 3z" fill="#fbe9a6" ${s}/>`,
  lemon: `<ellipse cx="15" cy="17" rx="10" ry="8" fill="#f6d24a" ${s}/><path d="M24.5 15l3-1.5M5.5 19l-2.5 1" ${s}/><path d="M11 8.5c1-2.5 3.5-3.5 6-3-1 2.5-3.5 3.5-6 3z" fill="#5cbf6b" ${s}/>`,
  // restaurant logos (round badges)
  "logo-burmese": `<circle cx="16" cy="16" r="15" fill="#8c1f16" ${s}/><path d="M5 21.5c3.5-3 18.5-3 22 0-3.5 3.5-18.5 3.5-22 0z" fill="#5aa845" ${s}/><path d="M7 16h18c0 5-4 8.5-9 8.5S7 21 7 16z" fill="#f6f1e7" ${s}/><path d="M8.2 16h15.6" stroke="#2a2420" stroke-width="2"/><ellipse cx="16" cy="16" rx="7.6" ry="1.6" fill="#e0902f"/><path d="M11 15.5c1.5-1 2.5 1 4 0s2.5 1 4 0" fill="none" stroke="#fff3df" stroke-width="1.2" stroke-linecap="round"/><path d="M19 13.5l7-8M21 14l6.5-7" stroke="#d9a441" stroke-width="1.6" stroke-linecap="round"/><path d="M11 12c-1-1.5 1-2.5 0-4M15 11.5c-1-1.5 1-2.5 0-4" fill="none" stroke="#fff3df" stroke-width="1.4" stroke-linecap="round"/>`,
  "logo-street": `<circle cx="16" cy="16" r="15" fill="#3d6a94" ${s}/><rect x="7.5" y="15" width="17" height="8" rx="1.5" fill="#fff3df" ${s}/><path d="M6 15l2-6h16l2 6z" fill="#e4553f" ${s}/><path d="M11.3 9l-1 6M16 9v6M20.7 9l1 6" stroke="#fff3df" stroke-width="2.2"/><circle cx="11" cy="25.5" r="2" fill="#2a2420"/><circle cx="21" cy="25.5" r="2" fill="#2a2420"/><path d="M11 19h4" stroke="#f6c35b" stroke-width="2.4" stroke-linecap="round"/>`,
  // Burmese toppings
  lime: `<circle cx="16" cy="17" r="10" fill="#6fbf3a" ${s}/><circle cx="16" cy="17" r="6.5" fill="#d6f0a0" stroke="#6fbf3a" stroke-width="1.5"/><path d="M16 10.5v13M9.5 17h13M11.4 12.4l9.2 9.2M20.6 12.4l-9.2 9.2" stroke="#9fd35f" stroke-width="1.2"/>`,
  peanuts: `<path d="M5 20c0 5 5 8 11 8s11-3 11-8z" fill="#8c1f16" ${s}/><path d="M7 20c1-4 4-6 9-6s8 2 9 6z" fill="#c99456" ${s}/><circle cx="12" cy="17.5" r="1.4" fill="#a8743d"/><circle cx="17" cy="16.5" r="1.4" fill="#a8743d"/><circle cx="21" cy="18" r="1.3" fill="#a8743d"/>`,
  coriander: `<path d="M16 28V14" stroke="#3f7a32" stroke-width="2" stroke-linecap="round"/><circle cx="11" cy="11" r="4.5" fill="#4f9a3a" ${s}/><circle cx="20" cy="9" r="4.5" fill="#5cbf6b" ${s}/><circle cx="16" cy="16" r="4" fill="#4f9a3a" ${s}/>`,
  chili: `<path d="M8 24c6 1 13-4 15-12 1-3 3-4 4-4-1 3-1 5-3 8-4 7-10 10-16 8z" fill="#d23b2a" ${s}/><path d="M23 9c1-3 3-4 5-4" fill="none" ${s}/><path d="M22 9.5c1.5-.5 3-.2 4 .8" stroke="#3f7a32" stroke-width="2.4" stroke-linecap="round"/>`,
  garlicoil: `<path d="M10 12h12v14a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z" fill="#e3b23c" ${s}/><rect x="9.5" y="7" width="13" height="5" rx="1.5" fill="#c4362b" ${s}/><circle cx="13.5" cy="18" r="1.5" fill="#f4e2b0"/><circle cx="18" cy="21.5" r="1.5" fill="#f4e2b0"/><circle cx="17" cy="16" r="1.2" fill="#f4e2b0"/>`,
  fishsauce: `<path d="M12 13h8v14H12z" fill="#8a4a16" ${s}/><path d="M12 13l2-5h4l2 5" fill="#8a4a16" ${s}/><rect x="14" y="4" width="4" height="4" rx="1" fill="#c4362b" ${s}/><rect x="12.5" y="17" width="7" height="6" fill="#f6efe0"/><path d="M14 20c1.5-1.5 3-1.5 4 0-1 1.5-2.5 1.5-4 0z" fill="#5aa9e6"/>`,
  turmeric: `<path d="M10 12h12v14a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z" fill="#e8a317" ${s}/><rect x="9.5" y="7" width="13" height="5" rx="1.5" fill="#8a5a2b" ${s}/><path d="M13 19c2-2 4-2 6 0" stroke="#c98a10" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  herbs: `<path d="M16 28V12" stroke="#3f7a32" stroke-width="2.2" stroke-linecap="round"/><path d="M16 14c-6-1-8-6-7-10 5 0 8 4 7 10zM16 18c6-1 9-5 8-9-5 0-9 3-8 9zM16 23c-5 0-8-3-8-7 4-1 8 2 8 7z" fill="#5cbf6b" ${s}/>`,
  vinegar: `<path d="M11 14h10v13a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1z" fill="#6b3a17" ${s}/><path d="M11 14l2.5-5h5l2.5 5" fill="#6b3a17" ${s}/><rect x="13.5" y="4" width="5" height="5" rx="1" fill="#c49a6c" ${s}/><rect x="12" y="18" width="8" height="6" fill="#fff3df"/><path d="M14 21h4" stroke="#6b3a17" stroke-width="1.6" stroke-linecap="round"/>`,
  cash: `<rect x="3" y="9" width="26" height="15" rx="2" fill="#9fd3a0" ${s}/><circle cx="16" cy="16.5" r="4" fill="#e1f2da" ${s}/><path d="M7 13v7M25 13v7" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
  card: `<rect x="3" y="7" width="26" height="18" rx="3" fill="#5aa9e6" ${s}/><rect x="3" y="11" width="26" height="4" fill="${INK}"/><rect x="7" y="18" width="7" height="4" rx="1" fill="#f6c35b"/>`,
  fridge: `<rect x="7" y="3" width="18" height="26" rx="2.5" fill="#dfe7ef" ${s}/><rect x="9.5" y="7" width="13" height="19" rx="1" fill="#bfe0f5" ${s}/><path d="M9.5 13h13M9.5 19h13" stroke="#9aa3ad" stroke-width="1.4"/><path d="M20.5 9v15" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><rect x="9" y="4.2" width="14" height="1.8" rx=".9" fill="#5aa9e6"/>`,
  snow: `<path d="M16 4v24M5.6 10l20.8 12M5.6 22l20.8-12" stroke="#5aa9e6" stroke-width="2.6" stroke-linecap="round"/><path d="M13 6.5l3 2.5 3-2.5M13 25.5l3-2.5 3 2.5M6.5 14.2l3.8-.7-1.3-3.6M25.5 17.8l-3.8.7 1.3 3.6M6.5 17.8l3.8.7-1.3 3.6M25.5 14.2l-3.8-.7 1.3-3.6" fill="none" stroke="#5aa9e6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  booster: `<path d="M7 16h18v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" fill="#f2b84b" ${s}/><path d="M9 16V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" fill="#f7cd7a" ${s}/>`,
  diner: `<circle cx="16" cy="9" r="5" fill="#f1c9a5" ${s}/><path d="M7 28c0-6 4-10 9-10s9 4 9 10z" fill="#f08a75" ${s}/><path d="M12.5 7.5c1-2.5 6-2.5 7 0" fill="none" stroke="#3a2416" stroke-width="2.4" stroke-linecap="round"/>`,
  book: `<path d="M16 8c-3-2.4-7-3-11-2.4v18c4-.6 8 0 11 2.4 3-2.4 7-3 11-2.4v-18c-4-.6-8 0-11 2.4z" fill="#f6a491" ${s}/><path d="M16 8v18" ${s}/><path d="M8.5 11c2-.2 3.8.2 5 1M8.5 15c2-.2 3.8.2 5 1M18.5 12c1.2-.8 3-1.2 5-1M18.5 16c1.2-.8 3-1.2 5-1" stroke="#fffaf0" stroke-width="1.6" stroke-linecap="round"/>`,
  crate: `<rect x="4" y="8" width="24" height="18" rx="2" fill="#c98a55" ${s}/><path d="M4 14h24M4 20h24" ${s}/><path d="M9 8v18M23 8v18" stroke="#8a5530" stroke-width="2"/>`,
  sink: `<path d="M4 18h24l-3 8H7z" fill="#c5cad0" ${s}/><path d="M17 18V8a3 3 0 0 1 6 0v2" fill="none" ${s}/><path d="M23 13v2" stroke="#5aa9e6" stroke-width="2.4" stroke-linecap="round"/>`,
  counter: `<rect x="4" y="9" width="24" height="5" rx="1.5" fill="#c5cad0" ${s}/><rect x="6" y="14" width="20" height="13" rx="1" fill="#2f3e4f" ${s}/><path d="M16 14v13M13 19v3M19 19v3" stroke="#c5cad0" stroke-width="1.8" stroke-linecap="round"/>`,
};

/** An inline SVG glyph from the set (decorative unless a label is given). */
export function glyph(name: keyof typeof GLYPHS | string, label?: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("class", "icon-svg");
  svg.innerHTML = GLYPHS[name] ?? GLYPHS.chef;
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }
  return svg;
}

/** Replace every <i data-icon="name"> / <i data-img="Model"> placeholder in the page. */
export function hydrateIcons(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>("[data-icon]")) {
    el.replaceChildren(glyph(el.dataset.icon!));
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-img]")) {
    el.replaceChildren(img(el.dataset.img!));
  }
}
