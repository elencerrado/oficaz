// Oficaz PWA Service Worker
const CACHE_NAME = 'oficaz-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
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

// Push event - Receive push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
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
      console.log('[SW] Push data received:', {
        title: data.title,
        body: data.body,
        actionsCount: data.actions?.length || 0,
        actions: data.actions
      });
      
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
      
      console.log('[SW] Notification will show with', notificationData.actions.length, 'action(s)');
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event - Handle both notification and action clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
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
      console.error('[SW] No auth token in notification data');
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
        console.log('[SW] Response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('[SW] Action completed successfully:', data);
        
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
        console.error('[SW] Error performing action:', error);
        
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
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
