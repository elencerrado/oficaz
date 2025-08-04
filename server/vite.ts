import fs from "fs";
import path from "path";
import { createServer, type ViteDevServer } from "vite";
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
  const vite = await createServer({
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

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

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

  app.use("*", (req, res, next) => {
    const url = req.originalUrl;

    if (url.includes(".") || url.startsWith("/api/")) {
      return next();
    }

    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
