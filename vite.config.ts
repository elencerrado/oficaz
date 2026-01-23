import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import os from "os";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  // Move Vite's cache out of the Dropbox-synced workspace to avoid file locks
  cacheDir: path.join(os.tmpdir(), "vite-cache-oficaz"),
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0", // Permite conexiones externas en Replit
    port: 5173, // Puerto estándar de Vite
    hmr: {
      clientPort: process.env.REPLIT_DOMAINS ? 443 : 5173, // En Replit usa puerto 443 para WebSocket
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
