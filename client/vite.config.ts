import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";

// GLBs and icons exported from Blender live outside the client root; watch them so a new export
// appears in the game without restarting the dev server.
const kitchenAssets = decodeURIComponent(new URL("../assets", import.meta.url).pathname);

// --- search engines and link previews ---------------------------------------------------
// The site's address, set when building for the real host (e.g. SITE_URL=https://chetmal.com):
// canonical links, link-preview images and the sitemap need absolute URLs. Without it, the
// pages still get their text, meta tags and structured data.
const SITE = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const PAGES = ["/", "/about.html"];

const DESCRIPTION =
  "A cozy co-op cooking game for 1–3 players in your browser. The head chef runs the pass, the deaf chef cooks by sight and the mute chef talks with signs.";

/** schema.org data for each page (what search engines show about the game). */
function structuredData(page: string): object[] {
  const url = SITE ? `${SITE}${page === "/" ? "/" : page}` : undefined;
  const game = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Chet Mal",
    alternateName: "ချက်မယ်",
    description: DESCRIPTION,
    ...(SITE ? { url: `${SITE}/`, image: `${SITE}/og-image.jpg` } : {}),
    genre: ["Cooking", "Co-op", "Party", "Casual"],
    gamePlatform: ["Web browser", "PC", "Mobile"],
    applicationCategory: "Game",
    operatingSystem: "Any (plays in a web browser)",
    playMode: ["SinglePlayer", "CoOp", "MultiPlayer"],
    numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3 },
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  if (page === "/") return [game];
  const faq = (q: string, a: string) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } });
  return [
    { ...game, ...(url ? { mainEntityOfPage: url } : {}) },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        faq("Is Chet Mal free?", "Yes. It's free to play in your browser, with nothing to download and no account."),
        faq("How many players can play?", "One to three. Play solo, or online with one or two friends."),
        faq("Can I play on my phone?", "Yes. Turn your phone sideways: a thumb stick walks and a big Use button does the rest."),
        faq("What does Chet Mal mean?", "ချက်မယ် (chet meh) is Burmese for \"let's cook!\"."),
        faq("Is it accessible?", "Every role is built around what that chef perceives, with text, visual cues, sound cues, read-aloud and larger text options."),
      ],
    },
  ];
}

function seo(): Plugin {
  return {
    name: "seo",
    transformIndexHtml(html, ctx) {
      const page = ctx.path.endsWith("about.html") ? "/about.html" : ctx.path === "/index.html" || ctx.path === "/" ? "/" : null;
      if (!page) return html;
      const tags: HtmlTagDescriptor[] = structuredData(page).map((data) => ({
        tag: "script",
        attrs: { type: "application/ld+json" },
        children: JSON.stringify(data),
        injectTo: "head",
      }));
      if (SITE) {
        const url = `${SITE}${page}`;
        const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: "meta", attrs, injectTo: "head" });
        tags.push(
          { tag: "link", attrs: { rel: "canonical", href: url }, injectTo: "head" },
          meta({ property: "og:url", content: url }),
          meta({ property: "og:image", content: `${SITE}/og-image.jpg` }),
          meta({ property: "og:image:width", content: "1200" }),
          meta({ property: "og:image:height", content: "630" }),
          meta({ property: "og:image:alt", content: "Chet Mal: Chet the cooking pot, the 3D kitchen and the head, deaf and mute chefs" }),
          meta({ name: "twitter:image", content: `${SITE}/og-image.jpg` }),
        );
      }
      return { html, tags };
    },
    generateBundle() {
      const robots = ["User-agent: *", "Allow: /", "Disallow: /gallery.html", ...(SITE ? [`Sitemap: ${SITE}/sitemap.xml`] : []), ""].join("\n");
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
      if (SITE) {
        const today = new Date().toISOString().slice(0, 10);
        const urls = PAGES.map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n");
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    seo(),
    {
      name: "watch-kitchen-assets",
      configureServer(server) {
        server.watcher.add(kitchenAssets);
      },
    },
  ],
  server: {
    // 5173 is often taken by other Vite projects on this machine
    port: 5180,
    strictPort: true,
    // reachable from phones on the same Wi-Fi
    host: true,
    // GLBs live in ../assets (shared with Blender), outside the client root
    fs: { allow: [".."] },
    // the game server (npm run dev:server); in production it serves the client itself
    proxy: { "/ws": { target: "ws://localhost:8787", ws: true } },
  },
  build: {
    // never inline small GLBs as data: URLs; keep every model a real file
    assetsInlineLimit: (filePath) => (filePath.endsWith(".glb") ? false : undefined),
    rolldownOptions: {
      input: { game: "index.html", about: "about.html", gallery: "gallery.html" },
    },
  },
});
