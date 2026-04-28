// ⚡⚡⚡ ULTRA-FAST STARTUP: Server listens FIRST, then loads everything else
import http from "http";

// Detect deployment environment
const isDeployed = process.env.REPLIT_DEPLOYMENT === '1';
const isProduction = isDeployed || process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 5000);

const enableDebugLogs = process.env.OFICAZ_DEBUG_LOGS === 'true' || process.env.APP_DEBUG_LOGS === 'true';
if (!enableDebugLogs && isProduction) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

// Track if Express is ready
let expressReady = false;
let expressApp: any = null;

// Create raw HTTP server that responds to health checks IMMEDIATELY
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';
  
  // INSTANT health check responses for dedicated endpoints
  if (method === 'GET' && (url === '/health' || url === '/__health')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }
  
  // For root path while Express is NOT ready yet, always show an HTML loader
  // This avoids occasional plain-text responses being rendered as a blank page
  if (method === 'GET' && url === '/' && !expressReady) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>Loading...</h1><script>setTimeout(()=>location.reload(),1000)</script></body></html>');
    return;
  }
  
  // Pass to Express if ready
  if (expressReady && expressApp) {
    expressApp(req, res);
  } else {
    // Express not ready - return 503 for non-root paths
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('Service starting...');
  }
});

// START LISTENING IMMEDIATELY - health checks work instantly
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server listening on port ${port} - health checks ready!`);
  
  // NOW load Express and everything else asynchronously
  initializeExpress().catch(err => {
    console.error('Failed to initialize Express:', err);
  });
});

// Handle errors gracefully
process.on('unhandledRejection', (reason: any) => {
  const message = reason?.message || String(reason);
  
  // Only suppress Neon WebSocket errors
  if (message.includes('Cannot set property message') || 
      (message.includes('WebSocket') && message.includes('connect'))) {
    console.error('🔄 Neon WebSocket error (auto-recovering):', message);
    return;
  }
  
  console.error('🚨 UNHANDLED REJECTION:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});

// ============================================================================
// ASYNC INITIALIZATION - runs AFTER server is already listening
// ============================================================================
async function initializeExpress() {
  console.log('📦 Loading Express and modules...');
  
  // Load dotenv first
  await import('dotenv/config');
  
  // Load all required modules
  const express = (await import('express')).default;
  const cors = (await import('cors')).default;
  const rateLimit = (await import('express-rate-limit')).default;
  const helmet = (await import('helmet')).default;
  const path = (await import('path')).default;
  const fs = (await import('fs')).default;
  const { fileURLToPath } = await import('url');
  
  // Load app-specific modules
  const { registerRoutes, startBackgroundServices } = await import('./routes');
  const { setupVite, serveStatic, log } = await import('./vite');
  const { backgroundImageProcessor } = await import('./backgroundWorker');
  
  // Get __dirname equivalent
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  const app = express();
  
  console.log(`🔍 Environment: isDeployed=${isDeployed}, isProduction=${isProduction}`);

  // Configure Trust Proxy
  if (isProduction || process.env.REPLIT_DOMAINS) {
    app.set('trust proxy', 1);
  } else {
    app.set('trust proxy', false);
  }

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "https://js.stripe.com",
            "https://maps.googleapis.com",
            "https://maps.gstatic.com",
            ...(process.env.NODE_ENV === "development"
              ? ["https://replit.com/public/js/replit-dev-banner.js", "'unsafe-inline'", "'unsafe-eval'", "data:"]
              : []),
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:", "https://ui-avatars.com"],
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
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          frameSrc: [
            "'self'",
            "blob:",
            "https://js.stripe.com",
            "https://hooks.stripe.com",
            "https://www.youtube.com",
            "https://www.youtube-nocookie.com",
          ],
          objectSrc: ["'self'", "blob:"],
          workerSrc: ["'self'", "blob:"],
          baseUri: ["'self'"],
          formAction: ["'self'", "https://js.stripe.com"],
          frameAncestors: ["'self'"],
          ...(process.env.NODE_ENV === "production"
            ? { upgradeInsecureRequests: [] }
            : { upgradeInsecureRequests: null }),
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: process.env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : undefined,
    })
  );

  // CORS configuration
  const isReplit = !!process.env.REPLIT_DOMAINS;
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isLocalDevelopment = isDevelopment && !isReplit;
  const nativeAppOrigins = [
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost',
  ];

  const allowedOrigins = isLocalDevelopment || isReplit
    ? [
        "http://localhost:5000",
        "http://localhost:5173",
        "http://127.0.0.1:5000",
        ...nativeAppOrigins,
        ...(process.env.REPLIT_DOMAINS?.split(",").map((d: string) => `https://${d}`) || []),
      ]
    : [
        'https://oficaz.es',
        'https://www.oficaz.es',
        ...nativeAppOrigins,
      ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = origin.toLowerCase();
        const isAllowed = allowedOrigins.some((allowed) => {
          const normalizedAllowed = allowed.toLowerCase();
          if (normalizedAllowed.includes('://')) {
            return normalizedOrigin === normalizedAllowed;
          }

          const hostOnly = normalizedAllowed.replace('https://', '').replace('http://', '');
          return normalizedOrigin.includes(hostOnly);
        });

        if (isAllowed) {
          callback(null, true);
        } else if (process.env.NODE_ENV !== 'production') {
          // Allow all origins in non-production environments
          callback(null, true);
        } else {
          // 🔒 SECURITY: Block unknown cross-origins in production
          callback(new Error('CORS: Origin not allowed'));
        }
      },
      credentials: true,
    })
  );

  // Rate limiting
  if (process.env.NODE_ENV === "production") {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      message: { message: "Too many requests, please try again later." },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);
  }

  // Body parsers
  // 🔒 SECURITY: Limit JSON body size to prevent DoS via large payloads.
  // Routes that handle file uploads use their own multer parsers with explicit size limits.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
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

  // SEO files
  app.get('/robots.txt', (req, res) => {
    const robotsPath = path.join(__dirname, '..', 'client', 'public', 'robots.txt');
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    });
    fs.createReadStream(robotsPath).pipe(res);
  });

  app.get('/sitemap.xml', (req, res) => {
    const sitemapPath = path.join(__dirname, '..', 'client', 'public', 'sitemap.xml');
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    });
    fs.createReadStream(sitemapPath).pipe(res);
  });

  // Minimal client crash/error telemetry endpoint (non-blocking, sanitized logs only)
  app.post('/api/telemetry/client-error', (req, res) => {
    const body = req.body ?? {};

    const sanitizeString = (value: unknown, max = 500) => {
      if (typeof value !== 'string') return undefined;
      return value.slice(0, max);
    };

    const payload = {
      type: sanitizeString(body.type, 60) ?? 'client_error',
      message: sanitizeString(body.message, 1000) ?? 'Unknown client error',
      stack: sanitizeString(body.stack, 4000),
      url: sanitizeString(body.url, 1000),
      userAgent: sanitizeString(body.userAgent, 500),
      source: sanitizeString(body.source, 500),
      line: Number.isFinite(body.line) ? Number(body.line) : undefined,
      column: Number.isFinite(body.column) ? Number(body.column) : undefined,
      timestamp: sanitizeString(body.timestamp, 60),
      appVersion: sanitizeString(body.appVersion, 80),
    };

    console.error('🧭 Client telemetry error:', payload);
    res.status(204).end();
  });

  // R2 Object Storage validation (lazy, won't block)
  const validateObjectStorageConfig = () => {
    const requiredVars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      console.warn('⚠️ R2 Object Storage not fully configured. Missing:', missing.join(', '));
    } else {
      console.log('✅ R2 Object Storage configuration validated');
    }
  };

  // Register all API routes
  await registerRoutes(app);

  // Error handler
  app.use((err: any, req: any, res: any, _next: any) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error('🚨 Server Error:', { path: req.path, method: req.method, status, message });
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // Setup Vite or static files
  const useVite = !isDeployed && !isProduction && (process.env.NODE_ENV === "development" || app.get("env") === "development");
  console.log(`🔍 Vite decision: isDeployed=${isDeployed}, isProduction=${isProduction}, useVite=${useVite}`);
  
  if (useVite) {
    try {
      console.log('🚀 Starting Vite server...');
      await setupVite(app, server);
      console.log('✅ Vite setup completed');
    } catch (error) {
      console.error('❌ Error setting up Vite:', error);
    }
  } else {
    console.log('📦 Serving static build files...');
    serveStatic(app);
  }

  // Mark Express as ready - now requests will be handled by Express
  expressApp = app;
  expressReady = true;
  console.log('✅ Express ready - accepting all requests');

  // Defer background services with a delay
  setTimeout(async () => {
    console.log('[init] Validating object storage...');
    validateObjectStorageConfig();
    
    console.log('[init] Starting background services...');
    try {
      await startBackgroundServices();
    } catch (error) {
      console.error('[init] Background services failed:', error);
    }
    
    console.log('[init] Starting background worker...');
    try {
      await backgroundImageProcessor.start();
    } catch (error) {
      console.error('❌ Failed to start background image processor:', error);
    }
    
    console.log('🎉 All services initialized');
  }, 1000);
}
