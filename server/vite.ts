import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
const viteLogger = createLogger();
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
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
  // ⚠️ Excluir robots.txt y sitemap.xml de Vite
  app.use((req, res, next) => {
    const excludedPaths = ["/robots.txt", "/sitemap.xml"];
    if (excludedPaths.includes(req.path)) {
      return next(); // deja que lo maneje otro middleware
    }
    vite.middlewares(req, res, next);
  });
  // Fallback para SPA solo si no es una ruta excluida
  app.use("*", async (req, res, next) => {
    const excludedPaths = ["/robots.txt", "/sitemap.xml"];
    if (excludedPaths.includes(req.path)) {
      return next();
    }
    const url = req.originalUrl;
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
  // ⚠️ SEO routes removed - handled by interceptors in server/index.ts
  // ORIGINAL LINES 92-101 DELETED TO PREVENT CONFLICT:
  // app.get("/robots.txt", (req, res) => {
  //   res.type("text/plain");
  //   res.sendFile(path.join(distPath, "robots.txt"));
  // });
  // app.get("/sitemap.xml", (req, res) => {
  //   res.type("application/xml");
  //   res.sendFile(path.join(distPath, "sitemap.xml"));
  // });
  // 🧱 Archivos estáticos
  app.use(express.static(distPath));
  // 🚨 Catch-all solo si no es robots.txt o sitemap.xml
  app.use("*", (req, res) => {
    const excludedPaths = ["/robots.txt", "/sitemap.xml"];
    if (excludedPaths.some((path) => req.path === path)) {
      return; // Skip catch-all for SEO routes
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
