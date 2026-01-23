// iOS Debugging Script - Helps diagnose loading issues on Safari iOS
(function() {
  const DEBUG = true;
  
  function log(msg, data) {
    if (!DEBUG) return;
    const timestamp = new Date().toLocaleTimeString();
    const fullMsg = `[${timestamp}] ${msg}`;
    console.log(fullMsg, data || '');
    
    // Also log to localStorage for inspection
    try {
      const logs = JSON.parse(localStorage.getItem('ios_debug_logs') || '[]');
      logs.push({ timestamp, msg, data });
      if (logs.length > 100) logs.shift();
      localStorage.setItem('ios_debug_logs', JSON.stringify(logs));
    } catch (e) {}
  }
  
  // Detect if running on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  
  log(`iOS Detected: ${isIOS}, Safari: ${isSafari}`, {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    standalone: window.navigator.standalone
  });
  
  // Check if running as PWA
  const isPWA = window.navigator.standalone === true || 
                window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: fullscreen)').matches;
  log(`Running as PWA: ${isPWA}`);
  
  // Monitor fetch errors
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    const isApi = typeof url === 'string' && url.includes('/api');
    if (isApi) {
      log(`API Fetch: ${url}`);
    }
    
    return originalFetch.apply(this, args)
      .catch(error => {
        if (isApi) {
          log(`❌ API Fetch Failed: ${url}`, error.message);
        }
        throw error;
      })
      .then(response => {
        if (isApi && !response.ok) {
          log(`⚠️ API Error ${response.status}: ${url}`);
        }
        return response;
      });
  };
  
  // Monitor console errors
  window.addEventListener('error', (event) => {
    log(`❌ Error: ${event.message}`, {
      file: event.filename,
      line: event.lineno,
      col: event.colno
    });
  });
  
  // Monitor unhandled rejections
  window.addEventListener('unhandledrejection', (event) => {
    log(`❌ Unhandled Rejection: ${event.reason}`);
  });
  
  // Check connectivity
  window.addEventListener('online', () => log('🟢 Online'));
  window.addEventListener('offline', () => log('🔴 Offline'));
  log(`Initial connectivity: ${navigator.onLine ? 'online' : 'offline'}`);
  
  // Monitor service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(() => log('✅ Service Worker Ready'))
      .catch(err => log('❌ Service Worker Failed', err.message));
      
    navigator.serviceWorker.addEventListener('controller', () => {
      log('🔄 Service Worker Activated');
    });
  }
  
  // Monitor storage
  log(`Storage Available:`, {
    localStorage: typeof localStorage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined',
    indexedDB: typeof indexedDB !== 'undefined'
  });
  
  // Expose debug logs access function
  window.getIOSDebugLogs = function() {
    try {
      const logs = JSON.parse(localStorage.getItem('ios_debug_logs') || '[]');
      return logs;
    } catch (e) {
      return [];
    }
  };
  
  window.clearIOSDebugLogs = function() {
    localStorage.removeItem('ios_debug_logs');
    console.log('Debug logs cleared');
  };
  
  log(`📱 iOS Debug Ready - Call window.getIOSDebugLogs() to see logs`);
})();
