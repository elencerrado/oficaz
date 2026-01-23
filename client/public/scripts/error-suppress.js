// Suppress Vite HMR WebSocket errors and other development errors
(function() {
  var host = window.location && window.location.hostname;
  var isDev = host === 'localhost' || host.endsWith('.repl.co') || host.includes('replit');
  if (!isDev) {
    // Do nothing in production
    return;
  }
  window.addEventListener('unhandledrejection', function(event) {
    var message = event.reason && event.reason.message ? (event.reason.message.toString ? event.reason.message.toString() : String(event.reason.message)) : '';
    var reasonStr = event.reason ? String(event.reason) : '';
    
    // Suppress Vite HMR WebSocket errors - comprehensive check
    if ((message.includes('WebSocket') || reasonStr.includes('WebSocket')) &&
        (message.includes('localhost') || message.includes('wss://') || reasonStr.includes('localhost') || reasonStr.includes('wss://'))) {
      console.log('🔇 Suppressed Vite HMR error (development only)');
      event.preventDefault();
      return;
    }
    if ((message.includes('Failed to construct') && message.includes('WebSocket')) ||
        (reasonStr.includes('Failed to construct') && reasonStr.includes('WebSocket'))) {
      console.log('🔇 Suppressed WebSocket construction error');
      event.preventDefault();
      return;
    }
    
    // Suppress network errors during navigation
    if (message.includes('Failed to fetch') ||
        message.includes('NetworkError') ||
        message.includes('Load failed')) {
      console.log('🔇 Suppressed network error');
      event.preventDefault();
      return;
    }
  });
  
  // Suppress console errors from Vite HMR
  var originalError = console.error;
  console.error = function() {
    var message = arguments[0] ? arguments[0].toString() : '';
    if (message.includes('WebSocket') && (message.includes('localhost') || message.includes('wss://'))) {
      return;
    }
    if (message.includes('Failed to construct') && message.includes('WebSocket')) {
      return;
    }
    originalError.apply(console, arguments);
  };
})();