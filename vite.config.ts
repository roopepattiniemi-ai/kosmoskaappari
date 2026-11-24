import path from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(root, "assets");

const types: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
};

function serveAssets(): Plugin {
  const handler = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: () => void }, next: (err?: unknown) => void) => {
    const raw = (req.url ?? "/").split("?")[0] ?? "/";
    const rel = decodeURIComponent(raw).replace(/^\/+/, "");
    if (!rel || rel.includes("..")) return next();
    const file = path.join(assetsDir, rel);
    if (!file.startsWith(assetsDir) || !existsSync(file) || !statSync(file).isFile()) return next();
    res.setHeader("Content-Type", types[path.extname(file).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=3600");
    createReadStream(file).pipe(res as unknown as NodeJS.WritableStream);
  };
  return {
    name: "kosmos-assets",
    configureServer(server) {
      server.middlewares.use("/assets", handler as never);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/assets", handler as never);
    },
  };
}

export default defineConfig({
  root: path.join(root, "src/client"),
  plugins: [serveAssets()],
  build: {
    outDir: path.join(root, "dist/client"),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
});
