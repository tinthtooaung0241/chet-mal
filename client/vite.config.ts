import { defineConfig } from "vite";

// GLBs exported from Blender live outside the client root; watch them so a new export
// appears in the game without restarting the dev server.
const kitchenAssets = decodeURIComponent(new URL("../assets/kitchen", import.meta.url).pathname);

export default defineConfig({
  plugins: [
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
    // GLBs live in ../assets (shared with Blender), outside the client root
    fs: { allow: [".."] },
    // the game server (npm run dev:server); in production it serves the client itself
    proxy: { "/ws": { target: "ws://localhost:8787", ws: true } },
  },
  build: {
    // never inline small GLBs as data: URLs; keep every model a real file
    assetsInlineLimit: (filePath) => (filePath.endsWith(".glb") ? false : undefined),
    rolldownOptions: {
      input: { game: "index.html", gallery: "gallery.html" },
    },
  },
});
