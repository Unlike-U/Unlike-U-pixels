import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * pixelpunisher.x — Vite build.
 *
 * The bitmap engine, pixel grid, icons, logo and GitHub transport live in
 * `src/shared`, vendored from the Next.js edition by `sync-shared.mjs`. Keeping
 * them inside the project root is what makes `vercel deploy` work: Vercel only
 * uploads this directory, so nothing may reach outside it.
 */
const sharedSrc = fileURLToPath(new URL("./src/shared", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // `@/` is used inside the vendored modules themselves (e.g. @/lib/cn)
      { find: /^@\//, replacement: `${sharedSrc}/` },
      // `@shared/` is used by the app pages
      { find: /^@shared\//, replacement: `${sharedSrc}/` },
    ],
  },
  server: { port: 5173, host: true },
  preview: { port: 4173 },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
