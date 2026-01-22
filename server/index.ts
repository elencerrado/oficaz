// Load environment variables from .env file (for local development outside Replit)
import 'dotenv/config';

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { registerRoutes, startBackgroundServices } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { backgroundImageProcessor } from "./backgroundWorker";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 🔧 Configure Trust Proxy for Replit and production environments
// This is essential for rate limiting and IP detection behind reverse proxies
if (process.env.NODE_ENV === 'production' || process.env.REPLIT_DOMAINS) {
  app.set('trust proxy', 1); // Trust first proxy (Replit or load balancer)
} else if (process.env.NODE_ENV === 'development' && !process.env.REPLIT_DOMAINS) {
  app.set('trust proxy', false);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Stripe + Google Maps
        scriptSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://maps.googleapis.com",
          "https://maps.gstatic.com",
          ...(process.env.NODE_ENV === "development"
            ? [
                "https://replit.com/public/js/replit-dev-banner.js",
                "'unsafe-inline'",
                "'unsafe-eval'",
              ]
            : []),
        ],
        // Tailwind/styled-components require inline styles; allowed
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        // Images from self, data URIs, blobs, HTTPS, and UI Avatars
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:",
          "https://ui-avatars.com",
        ],
        // API calls and WebSockets - restrict in production
        connectSrc: [
          "'self'",
          "wss:",
          "ws:",
          "https://api.stripe.com",
          "https://js.stripe.com",
          "https://maps.googleapis.com",
          "https://fcm.googleapis.com",
          "https://web.push.apple.com",
          ...(process.env.NODE_ENV === "development"
            ? ["http://localhost:*", "ws://localhost:*", "https://*.trycloudflareaccess.com"]
            : []),
        ],
        // Fonts (Google Fonts)
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        // Frames (Stripe) + blob: for previews
        frameSrc: [
          "'self'",
          "blob:",
          "https://js.stripe.com",
          "https://hooks.stripe.com",
        ],
        // Allow blob: for PDF object/embed previews
        objectSrc: ["'self'", "blob:"],
        // Workers for SW and PDF.js
        workerSrc: ["'self'", "blob:"],
        // Base URI restricted to self
        baseUri: ["'self'"],
        // Forms only submit to self or Stripe
        formAction: ["'self'", "https://js.stripe.com"],
        // Frame ancestors restriction
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
        : undefined,
  })
);

// CORS configuration
const isReplit = !!process.env.REPLIT_DOMAINS;
// 🔒 SECURITY: Only treat as development if explicitly set, not just Replit
const isDevelopment = process.env.NODE_ENV === 'development';
const isLocalDevelopment = isDevelopment && !isReplit;

const allowedOrigins =
  isLocalDevelopment || isReplit
    ? [
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:5173",
        "http://127.0.0.1:5000",
        "http://127.0.0.1:5173",
        // Cloudflare Tunnel
        /^https:\/\/[a-zA-Z0-9-]+\.trycloudflareaccess\.com$/,
        // Replit development domains (match subdomains and root)
        ...(process.env.REPLIT_DOMAINS
          ? process.env.REPLIT_DOMAINS.split(",").map(
              (domain) => new RegExp(`^https://.*${domain.replace(/\./g, '\\.')}(:[0-9]+)?$`),
            )
          : []),
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
    origin: (origin, callback) => {
      // En desarrollo o Replit, ser muy permisivo
      if (isDevelopment) {
        return callback(null, true);
      }
      
      // En producción, ser restrictivo
      // Permitir sin origin (mobile apps, etc)
      if (!origin) return callback(null, true);
      
      // Permitir matches exactos (strings)
      const exactMatch = allowedOrigins.find(o => typeof o === 'string' && o === origin);
      if (exactMatch) return callback(null, true);
      
      // Permitir matches regex (Cloudflare, etc)
      const regexMatch = allowedOrigins.find(o => o instanceof RegExp && o.test(origin));
      if (regexMatch) return callback(null, true);
      
      // Denegar si no coincide
      return callback(new Error('CORS no permitido'));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Minimal CSRF guard: validate Origin/Referer on state-changing requests when present
const csrfOriginGuard = (req: Request, res: Response, next: NextFunction) => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  // Log all POST requests for debugging
  console.log(`📨 ${method} ${req.path} - Origin: ${req.headers.origin}, Referer: ${req.headers.referer}`);

  // 🔒 SECURITY: En desarrollo local (no Replit), ser permisivo para facilitar testing
  if (process.env.NODE_ENV === 'development' && !isReplit) {
    console.log(`✅ Local development mode - allowing request`);
    return next();
  }

  const headerOrigin = req.headers.origin || req.headers.referer;
  if (!headerOrigin) return next(); // Non-browser or missing headers

  try {
    const originUrl = new URL(headerOrigin);
    const originValue = `${originUrl.protocol}//${originUrl.host}`;
    
    // Permitir matches exactos
    const exactMatch = allowedOrigins.find(o => typeof o === 'string' && o === originValue);
    if (exactMatch) return next();
    
    // Permitir matches regex
    const regexMatch = allowedOrigins.find(o => o instanceof RegExp && o.test(originValue));
    if (regexMatch) return next();
    
    return res.status(403).json({ message: 'Origen no permitido' });
  } catch (err) {
    return res.status(400).json({ message: 'Cabeceras de origen inválidas' });
  }

  next();
};

app.use(csrfOriginGuard);

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

// Global rate limiting (skip in dev to avoid local 429s on reload)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' && !process.env.REPLIT_DOMAINS,
});

if (process.env.NODE_ENV === 'production') {
  app.use(globalLimiter);
} else {
  console.warn('Skipping global rate limiter in non-production environment');
}

// Body parsing with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// 📦 Object Storage: Validate configuration on startup (deferred to after server starts)
function validateObjectStorageConfig() {
  // R2 is now the primary storage, no need for PUBLIC_OBJECT_SEARCH_PATHS
  const r2Configured = process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME;
  
  if (!r2Configured) {
    console.warn('⚠️  Cloudflare R2 not configured. File storage will not work.');
    console.warn('   Configure R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME in .env');
    return false;
  }
  
  console.log('✓ Object Storage configured: Cloudflare R2');
  console.log(`  • Bucket: ${process.env.R2_BUCKET_NAME}`);
  return true;
}

// Don't validate on startup - do it after server is listening

// Serve uploaded files with R2/Object Storage priority, local fallback
// Priority: R2 → Replit Object Storage → Local filesystem
app.get("/uploads/:filename", async (req, res, next) => {
  const filename = req.params.filename;
  const localPath = path.join(process.cwd(), "uploads", filename);
  
  // Try R2/Object Storage first (primary storage)
  try {
    const { SimpleObjectStorageService } = await import('./objectStorageSimple.js');
    const objectStorage = new SimpleObjectStorageService();
    
    // Try profile-pictures folder first (user avatars)
    let objectPath = `profile-pictures/${filename}`;
    let file = await objectStorage.searchPublicObject(objectPath);
    
    // If not in profile-pictures/, try documents folder (migrated files)
    if (!file) {
      objectPath = `documents/${filename}`;
      file = await objectStorage.searchPublicObject(objectPath);
    }
    
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
  const isDevelopment = process.env.NODE_ENV === "development" || app.get("env") === "development";
  console.log(`🔍 Environment: NODE_ENV=${process.env.NODE_ENV}, app.get("env")=${app.get("env")}, isDevelopment=${isDevelopment}`);
  
  if (isDevelopment) {
    try {
      console.log('🚀 Starting Vite server...');
      await setupVite(app, server);
      console.log('✅ Vite setup completed successfully');
    } catch (error) {
      console.error('❌ Error setting up Vite:', error);
      console.error('Stack:', error);
      // Don't exit, continue serving without Vite
    }
  } else {
    console.log('📦 Serving static build files...');
    serveStatic(app);
  }

  // Use PORT from environment (Replit sets this automatically)
  const port = Number(process.env.PORT || 5000);
  
  if (!process.env.PORT && isReplit) {
    console.warn('⚠️  PORT not set in Replit environment, using default 5000');
  }
  
  // Determine host based on platform and environment
  // Replit needs 0.0.0.0 to accept external connections
  const isReplit = process.env.REPLIT_DOMAINS !== undefined || process.env.REPL_ID !== undefined;
  let host: string;
  
  if (isReplit) {
    host = '0.0.0.0'; // Replit requires binding to all interfaces
    console.log('🔧 Detected Replit environment, binding to 0.0.0.0 on port', port);
  } else if (process.platform === 'win32') {
    host = '127.0.0.1'; // Windows local development
  } else {
    // Prefer localhost binding on macOS/dev machines to avoid
    // platform-specific socket option issues (ENOTSUP).
    host = '127.0.0.1';
  }

  // Only enable SO_REUSEPORT on Linux where it's consistently supported
  const listenOptions: any = {
    port,
    host,
  };
  if (process.platform === "linux") {
    listenOptions.reusePort = true;
  }

  server.listen(
    listenOptions,
    async () => {
      const hostDisplay = process.platform === 'win32' ? 'localhost' : (listenOptions.host || '0.0.0.0');
      const url = `http://${hostDisplay}:${port}`;
      log(`serving on port ${port}`);
      console.log(`🔗 Open in browser: ${url}`);
      console.log('✅ Server is ready to accept health checks');
      
      // NOW that server is listening, start background services asynchronously
      // This ensures health checks pass quickly during deployment
      // Services start in the background without blocking the response
      
      // Initialize all background services asynchronously
      setImmediate(async () => {
        try {
          // Validate R2 configuration
          console.log('[init] Validating object storage...');
          validateObjectStorageConfig();
          
          // Start background services (email queue, push notifications)
          console.log('[init] Starting background services...');
          await startBackgroundServices();
          console.log('[init] ✓ Background services started');
          
          // Initialize background image processor
          console.log('[init] Starting background worker...');
          await backgroundImageProcessor.start();
          console.log('[init] ✓ Background worker started');
          
          console.log('🎉 All services initialized - application ready');
        } catch (error) {
          console.error('❌ Background initialization error:', error);
          // Don't crash - services can retry or work in degraded mode
        }
      });
    },
  );
  
  // Keep process alive and handle shutdown gracefully
  process.on('SIGTERM', () => {
    if (process.env.NODE_ENV === 'production') {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    }
  });
  
  // Prevent auto-shutdown in development
  if (process.env.NODE_ENV === 'production') {
    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  }
})();
