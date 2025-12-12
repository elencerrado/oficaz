// Load environment variables from .env file (for local development outside Replit)
import 'dotenv/config';

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { backgroundImageProcessor } from "./backgroundWorker";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();

// ⚠️ SEO files served as static files from client/public/

// Trust proxy for rate limiting (required for Replit)
app.set("trust proxy", 1);

// 🛡️ SECURITY: Content Security Policy configuration for React/Vite
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // React/Vite needs inline scripts and eval for HMR in development
        // Stripe requires js.stripe.com for payment processing
        // Google Maps SDK
        scriptSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://maps.googleapis.com",
          "https://maps.gstatic.com",
          ...(process.env.NODE_ENV === "development" 
            ? ["'unsafe-inline'", "'unsafe-eval'"] 
            : []),
        ],
        // Tailwind and styled components need unsafe-inline
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Images from self, data URIs, blobs, HTTPS, and third-party APIs
        // UI Avatars for user profile pictures
        imgSrc: [
          "'self'", 
          "data:", 
          "blob:", 
          "https:", 
          "https://ui-avatars.com",
        ],
        // API calls and WebSocket connections
        // Stripe API for payment processing
        // Google Maps API if used
        connectSrc: [
          "'self'",
          "wss:",
          "ws:",
          "https://api.stripe.com",
          "https://maps.googleapis.com",
          ...(process.env.NODE_ENV === "development"
            ? ["http://localhost:*", "ws://localhost:*"]
            : []),
        ],
        // Fonts from self and data URIs
        fontSrc: ["'self'", "data:"],
        // Stripe iframe for payment forms
        frameSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://hooks.stripe.com",
        ],
        // No object/embed/applet allowed
        objectSrc: ["'none'"],
        // Base URI restricted to self
        baseUri: ["'self'"],
        // Forms only submit to self or Stripe
        formAction: ["'self'", "https://js.stripe.com"],
        // Frame ancestors (already set in routes.ts for document endpoints)
        frameAncestors: ["'self'"],
        // Upgrade insecure requests in production
        ...(process.env.NODE_ENV === "production" 
          ? { upgradeInsecureRequests: [] } 
          : {}),
      },
    },
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

// 📦 Object Storage: Validate configuration on startup
function validateObjectStorageConfig() {
  const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const paths = pathsStr.split(",").map(p => p.trim()).filter(p => p.length > 0);
  
  if (paths.length === 0) {
    console.warn('⚠️  PUBLIC_OBJECT_SEARCH_PATHS not configured. Object Storage will not work.');
    console.warn('   Create a bucket in "Object Storage" tool to enable persistent file storage.');
    return false;
  }
  
  console.log('✓ Object Storage configured:');
  console.log(`  • Search paths: ${paths.join(', ')}`);
  console.log(`  • Write path: ${paths[0]} (first entry)`);
  return true;
}

validateObjectStorageConfig();

// Serve uploaded files with R2/Object Storage priority, local fallback
// Priority: R2 → Replit Object Storage → Local filesystem
app.get("/uploads/:filename", async (req, res, next) => {
  const filename = req.params.filename;
  const localPath = path.join(process.cwd(), "uploads", filename);
  
  // Try R2/Object Storage first (primary storage)
  try {
    const { SimpleObjectStorageService } = await import('./objectStorageSimple.js');
    const objectStorage = new SimpleObjectStorageService();
    
    // Try documents folder (migrated files)
    let objectPath = `documents/${filename}`;
    let file = await objectStorage.searchPublicObject(objectPath);
    
    // If not in documents/, try email-marketing/ (for email images)
    if (!file) {
      objectPath = `email-marketing/${filename}`;
      file = await objectStorage.searchPublicObject(objectPath);
    }
    
    if (file) {
      console.log(`📦 Serving ${filename} from Cloud Storage`);
      return await objectStorage.downloadObject(file, res);
    }
  } catch (error) {
    console.error(`Error searching Cloud Storage for ${filename}:`, error);
  }
  
  // Fallback to local filesystem (legacy files)
  if (fs.existsSync(localPath)) {
    console.log(`📁 Serving ${filename} from local filesystem (fallback)`);
    return res.sendFile(localPath);
  }
  
  // If not found anywhere, return 404
  res.status(404).send('File not found');
});

// Serve public files (like email logo) statically
app.use(express.static(path.join(process.cwd(), "public")));

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

// ⚠️ CRITICAL SEO CDN REDIRECTS - DO NOT MODIFY
// Redirect SEO files to external CDN with proper content-types
app.get('/robots.txt', (req, res) => {
  console.log('🔄 Serving robots.txt from client/public');
  const robotsPath = path.join(__dirname, '..', 'client', 'public', 'robots.txt');
  
  // Production-ready approach: Direct serving with optimized headers
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Serve the file from client/public
  fs.createReadStream(robotsPath).pipe(res);
});

app.get('/sitemap.xml', (req, res) => {
  console.log('🔄 Serving sitemap.xml from client/public');
  const sitemapPath = path.join(__dirname, '..', 'client', 'public', 'sitemap.xml');
  
  // Production-ready approach: Direct serving with optimized headers
  res.writeHead(200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Serve the file from client/public
  fs.createReadStream(sitemapPath).pipe(res);
});

// Handle only specific Neon database WebSocket errors that cause morning crashes
// Other errors should crash and trigger supervisor restart
process.on('unhandledRejection', (reason: any, promise) => {
  const message = reason?.message || String(reason);
  
  // Only suppress the specific Neon stale WebSocket connection error
  const isNeonWebSocketError = 
    (message.includes('Cannot set property message') && message.includes('ErrorEvent')) ||
    (message.includes('WebSocket') && message.includes('connect'));
  
  if (isNeonWebSocketError) {
    console.error('🔄 Neon WebSocket error (auto-recovering):', message);
    // Don't exit - pool will create new connection on next query
    return;
  }
  
  // For all other errors, crash for supervised restart
  console.error('🚨 UNHANDLED REJECTION - CRASHING FOR RESTART:', reason);
  process.exit(1);
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error details for debugging
    console.error('🚨 Server Error:', {
      path: req.path,
      method: req.method,
      status,
      message,
      stack: err.stack
    });

    // Send error response to client
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    
    // DO NOT throw err - this would crash the server!
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
    async () => {
      log(`serving on port ${port}`);
      
      // Initialize background image processor
      console.log('[init] Starting background worker...');
      try {
        await backgroundImageProcessor.start();
        log('🚀 Background image processor started successfully');
        console.log('[init] Background worker started');
      } catch (error) {
        console.error('❌ Failed to start background image processor:', error);
        console.error('[init] Background worker failed:', error);
      }
      
      // Emergency refund completed successfully - code removed
    },
  );
})();
