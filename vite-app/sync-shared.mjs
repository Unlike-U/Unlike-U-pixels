/**
 * sync-shared.mjs — vendors the browser-safe modules from the Next.js edition
 * (../src) into vite-app/src/shared so the Vite build is fully self-contained.
 *
 * This matters for Vercel: only the linked project directory (vite-app) is
 * uploaded, so any import of ../src would fail in the remote build.
 *
 * Run with:  npm run sync:shared   (deploy.sh does it automatically)
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoSrc = join(here, "..", "src");
const outDir = join(here, "src", "shared");

/** Only browser-safe modules — never copy db/, scheduler, crypto or oauth. */
const FILES = [
  "lib/grid.ts",
  "lib/image.ts",
  "lib/github.ts",
  "lib/client.ts",
  "lib/cn.ts",
  "components/PixelGrid.tsx",
  "components/Logo.tsx",
  "components/ThemeToggle.tsx",
  "components/ui.tsx",
  "components/Icons.tsx",
];

if (!existsSync(repoSrc)) {
  // Vercel only uploads vite-app, so ../src legitimately doesn't exist there.
  // The vendored copy in src/shared is committed, so the remote build is fine.
  if (existsSync(join(outDir, "lib", "grid.ts"))) {
    console.log("[sync-shared] ../src not present — using the vendored copy (remote build).");
    process.exit(0);
  }
  console.error(`[sync-shared] source not found: ${repoSrc}`);
  console.error("[sync-shared] run this from the repo checkout (needs ../src).");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });

let copied = 0;
for (const rel of FILES) {
  const from = join(repoSrc, rel);
  if (!existsSync(from)) {
    console.error(`[sync-shared] missing ${rel}`);
    process.exit(1);
  }
  const to = join(outDir, rel);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
  copied++;
}

// Fail loudly if a server-only module ever sneaks into the vendored copy.
const forbidden = ["process.env", "drizzle-orm", "@/db", "node:crypto", "next/"];
for (const rel of FILES) {
  const text = readFileSync(join(outDir, rel), "utf8");
  for (const bad of forbidden) {
    if (text.includes(bad)) {
      console.error(`[sync-shared] ${rel} references server-only "${bad}" — fix the shared module.`);
      process.exit(1);
    }
  }
}

console.log(`[sync-shared] vendored ${copied} modules → vite-app/src/shared`);
