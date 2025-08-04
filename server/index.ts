import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";


const app = express();

// ⚠️ SEO files served as static files from client/public/

// Trust proxy for rate limiting (required for Replit)
app.set("trust proxy", 1);

// Security middleware - Simplified for deployment stability
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP temporarily to avoid mixed content issues
    crossOriginEmbedderPolicy: false,
    hsts:
      process.env.NODE_ENV === "production"
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
  }),
);

// CORS configuration
const allowedOrigins =
  process.env.NODE_ENV === "development"
    ? [
        "http://localhost:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
      ]
    : [
        // Replit domains
        ...(process.env.REPLIT_DOMAINS
          ? process.env.REPLIT_DOMAINS.split(",").map(
              (domain) => `https://${domain}`,
            )
          : []),
        // Custom domain
        "https://oficaz.es",
        "https://www.oficaz.es",
      ];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Force HTTPS in production and set security headers
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    // ⚠️ EXCLUDE SEO routes from HTTPS redirect - they must be handled by interceptor
    if (req.path === "/robots.txt" || req.path === "/sitemap.xml") {
      console.log(`🚨 HTTPS REDIRECT BYPASS for SEO route: ${req.path}`);
      return next(); // Skip HTTPS redirect for SEO files
    }
    
    const host = req.header("host");
    const proto =
      req.header("x-forwarded-proto") ||
      req.header("x-forwarded-protocol") ||
      req.protocol;

    // Redirect HTTP to HTTPS for all domains including custom domains
    if (proto !== "https" && host !== "localhost") {
      return res.redirect(301, `https://${host}${req.url}`);
    }

    // Set additional security headers for HTTPS
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN"); // Changed from DENY to SAMEORIGIN
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // Additional header for custom domains
    if (host === "oficaz.es" || host === "www.oficaz.es") {
      res.setHeader("Access-Control-Allow-Origin", `https://${host}`);
    }

    next();
  });
}

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Body parsing with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// ⚠️ CRITICAL SEO FILE READING - DO NOT MODIFY
// Read SEO files from filesystem and serve with explicit headers
app.get('/robots.txt', (req, res) => {
  try {
    const robotsPath = path.join(process.cwd(), 'public/robots.txt');
    const content = fs.readFileSync(robotsPath, 'utf8');
    
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(content, 'utf8'),
      'Cache-Control': 'public, max-age=86400',
      'X-SEO-Source': 'filesystem'
    });
    res.end(content);
    console.log('📋 Served robots.txt from filesystem with text/plain');
  } catch (error) {
    console.error('❌ Error reading robots.txt:', error);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('robots.txt not found');
  }
});

app.get('/sitemap.xml', (req, res) => {
  try {
    const sitemapPath = path.join(process.cwd(), 'public/sitemap.xml');
    const content = fs.readFileSync(sitemapPath, 'utf8');
    
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(content, 'utf8'),
      'Cache-Control': 'public, max-age=86400',
      'X-SEO-Source': 'filesystem'
    });
    res.end(content);
    console.log('🗺️ Served sitemap.xml from filesystem with application/xml');
  } catch (error) {
    console.error('❌ Error reading sitemap.xml:', error);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('sitemap.xml not found');
  }
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Simple solution: serve on port 5000
  const port = 5000;
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
