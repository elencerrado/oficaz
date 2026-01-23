// Oficaz PWA Service Worker - v3.0 (FAST STARTUP + FIXED NOTIFICATIONS)
const CACHE_NAME = 'oficaz-v3';
const SW_INSTANCE_ID = `SW-${Date.now()}-${Math.random().toString(36).substring(7)}`;

// Essential assets to cache on install for instant startup
const PRECACHE_ASSETS = [
  '/',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

// Install event - precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        // Precache failed (non-critical)
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network first for API, Cache first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API calls - always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return;
  }
  
  // For static assets, use stale-while-revalidate strategy
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/i) || 
      url.pathname === '/' || 
      url.pathname === '/manifest.json') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            // Update cache with fresh version
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Network failed, return cached if available, or a proper error response
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a proper error Response instead of undefined
            return new Response('Network error', { status: 503, statusText: 'Service Unavailable' });
          });
          
          // Return cached immediately, update in background
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
  
  // For HTML navigation, use network-first with cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        // Cache the latest HTML
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
        });
        return response;
      }).catch(() => {
        // Offline - try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Try root cache
          return caches.match('/').then((rootResponse) => {
            if (rootResponse) return rootResponse;
            // Return a proper error Response instead of undefined
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
        });
      })
    );
    return;
  }
});

// Push event - Receive push notifications
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Oficaz',
    body: 'Nueva notificación',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'oficaz-notification'
  };

  if (event.data) {
    try {
      const data = event.data.json();
      
      notificationData = {
        title: data.title || 'Oficaz',
        body: data.body || data.message || 'Nueva notificación',
        icon: data.icon || '/icon-192.png',
        badge: '/icon-192.png',
        data: data.data || {},
        vibrate: data.vibrate || [200, 100, 200, 100, 200],
        requireInteraction: true,
        tag: data.tag || 'oficaz-notification',
        actions: data.actions || []
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .then(() => {
        // Notification displayed successfully
      })
      .catch(err => {
        console.error('Error showing notification:', err);
      })
  );
});

// Notification click event - Handle both notification and action clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Get notification data
  const notificationData = event.notification.data || {};
  const action = event.action; // Empty string if notification body clicked, otherwise action id

  // Handle action button clicks
  if (action && action !== 'open') {
    console.log('[SW] Action button clicked:', action, 'userId:', notificationData.userId);
    
    // Handle 'view' action for incomplete sessions (just open the app)
    if (action === 'view') {
      const urlToOpen = notificationData.url || '/employee';
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
          // Try to focus existing window
          for (const client of clientList) {
            if (client.url.includes(urlToOpen) && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
      );
      return;
    }
    
    // Get auth token from notification data for work actions
    const authToken = notificationData.authToken;
    if (!authToken) {
      return;
    }
    
    // Perform the work action via API
    event.waitUntil(
      fetch('/api/push/work-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        credentials: 'include', // Include cookies for auth
        body: JSON.stringify({
          action: action,
          sessionId: notificationData.sessionId,
          breakId: notificationData.breakId
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Show confirmation notification
        const messages = {
          'clock_in': '✅ Fichado entrada correctamente',
          'clock_out': '✅ Fichado salida correctamente',
          'start_break': '☕ Descanso iniciado',
          'end_break': '✅ Descanso finalizado'
        };
        
        return self.registration.showNotification('Oficaz', {
          body: messages[action] || data.message || 'Acción completada',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'oficaz-action-' + Date.now(),
          requireInteraction: false,
          vibrate: [100, 50, 100]
        });
      })
      .catch(error => {
        // Show error notification
        return self.registration.showNotification('Oficaz', {
          body: '❌ Error: ' + error.message + '. Abre la app para intentarlo de nuevo.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'oficaz-action-error-' + Date.now(),
          requireInteraction: false,
          vibrate: [100, 50, 100, 50, 100]
        });
      })
    );
    
    return; // Don't open app when action button clicked
  }

  // If notification body clicked (not an action button), open/focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise, open a new window
        if (clients.openWindow) {
          const url = notificationData.url || '/employee';
          return clients.openWindow(url);
        }
      })
  );
});

// Message event - Communication with main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
