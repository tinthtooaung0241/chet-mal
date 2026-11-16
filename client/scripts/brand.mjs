// Renders the social image and app icons from brand.html with headless Chrome, at exact sizes.
// Needs the dev server running (npm run dev). Usage: npm run brand
import { execFileSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const BASE = process.env.DEV_URL ?? "http://localhost:5180";

const ASSETS = [
  { asset: "og", file: "og-image.png", size: [1200, 630] },
  { asset: "maskable", file: "icon-maskable-512.png", size: [512, 512] },
];

if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (set CHROME=...)`);
for (const { asset, file, size } of ASSETS) {
  const out = `${PUBLIC}${file}`;
  execFileSync(CHROME, [
    "--headless=new",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--default-background-color=00000000",
    `--window-size=${size[0]},${size[1]}`,
    "--virtual-time-budget=8000",
    `--screenshot=${out}.tmp.png`,
    `${BASE}/brand.html?asset=${asset}`,
  ], { stdio: "ignore" });
  renameSync(`${out}.tmp.png`, out);
  console.log("made", file);
}

// link previews load faster as a JPEG (macOS sips; elsewhere the PNG stays)
try {
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "90", `${PUBLIC}og-image.png`, "--out", `${PUBLIC}og-image.jpg`], { stdio: "ignore" });
  rmSync(`${PUBLIC}og-image.png`);
  console.log("made og-image.jpg");
} catch {
  console.log("kept og-image.png (no sips here): point the og:image tags at it");
}
