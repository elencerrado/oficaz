import fs from "fs";
import path from "path";
import { createViteServer, type ViteDevServer } from "vite";
import type { Express } from "express";
import type { Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
const viteLogger = {
  info: (msg: string, options?: any) => logWithTimestamp(msg, "vite", "info"),
  warn: (msg: string, options?: any) => logWithTimestamp(msg, "vite", "warn"),
  error: (msg: string, options?: any) => logWithTimestamp(msg, "vite", "error"),
  warnOnce: (msg: string, options?: any) =>
    logWithTimestamp(msg, "vite", "warn"),
  hasErrorLogged: () => false,
  clearScreen: () => {},
};
function logWithTimestamp(
  message: string,
  source: string,
  level: string = "info",
) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });
  app.use(vite.middlewares);
  // MUCHO MÁS PERMISIVO - Solo servir React para rutas que realmente lo necesitan
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    // Solo omitir archivos con extensión y rutas API
    if (url.includes(".") || url.startsWith("/api/")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );
      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }
  app.use(express.static(distPath));
  // MUCHO MÁS PERMISIVO - Solo servir React para rutas que realmente lo necesitan
  app.use("*", (req, res, next) => {
    const url = req.originalUrl;
    // Solo omitir archivos con extensión y rutas API
    if (url.includes(".") || url.startsWith("/api/")) {
      return next();
    }
    // Fall through to index.html for SPA routing
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
