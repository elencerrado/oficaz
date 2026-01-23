import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { getAuthData } from '@/lib/auth';

interface WorkAlarm {
  id: number;
  userId: number;
  title: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  time: string;
  weekdays: number[];
  soundEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useWorkAlarms() {
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [pushPermission, setPushPermission] = useState<'granted' | 'denied' | 'default'>('default');
  const [hasSetup, setHasSetup] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Convert base64 to Uint8Array for VAPID key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        Promise.all(registrations.map(reg => reg.unregister()))
          .then(() => {
            return navigator.serviceWorker.register('/service-worker.js');
          })
          .then((registration) => {
            setServiceWorkerRegistration(registration);
          })
          .catch((error) => {
            // Service Worker registration failed
          });
      });
    }
  }, []);

  // Get or create a stable device ID
  const getDeviceId = (): string => {
    let deviceId = localStorage.getItem('oficaz-device-id');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('oficaz-device-id', deviceId);
    }
    return deviceId;
  };

  // Request push notification permission and subscribe
  useEffect(() => {
    const setupPushNotifications = async () => {
      if (!serviceWorkerRegistration) return;
      
      // Get current user ID from auth
      if (!userId) return;
      
      // Reset setup if user changed
      if (currentUserId !== null && currentUserId !== userId) {
        
        // Unsubscribe old user's push subscription from this device
        try {
          const oldSubscription = await serviceWorkerRegistration.pushManager.getSubscription();
          if (oldSubscription) {
            // Try to unsubscribe from server (may fail if token expired, that's OK)
            try {
              const authData = getAuthData();
              const oldToken = authData?.token;
              if (oldToken) {
                await fetch('/api/push/unsubscribe', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${oldToken}`
                  },
                  body: JSON.stringify({ endpoint: oldSubscription.endpoint })
                });
              }
            } catch (e) {
              // Could not unsubscribe from server (token expired), continuing...
            }
            
            // Unsubscribe from browser
            await oldSubscription.unsubscribe();
          }
        } catch (e) {
          // Error removing old subscription
        }
        
        setHasSetup(false);
        setCurrentUserId(userId);
        localStorage.removeItem('pwa-push-subscribed');
      } else if (currentUserId === null) {
        setCurrentUserId(userId);
      }
      
      // Check if already set up for this user
      if (hasSetup) return;
      
      setHasSetup(true); // Mark as setup to prevent multiple runs
      
      try {
        // Request notification permission
        const permission = await Notification.requestPermission();
        setPushPermission(permission);
        
        if (permission !== 'granted') {
          return;
        }

        // Get VAPID public key from server
        const { publicKey } = await apiRequest('GET', '/api/push/vapid-public-key');
        
        // Subscribe to push notifications
        const subscription = await serviceWorkerRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        setPushSubscription(subscription);

        // Send subscription to server with device ID
        await apiRequest('POST', '/api/push/subscribe', {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...Array.from(new Uint8Array(subscription.getKey('p256dh')!)))),
            auth: btoa(String.fromCharCode(...Array.from(new Uint8Array(subscription.getKey('auth')!))))
          },
          deviceId: getDeviceId()
        });

        setPushSubscription(subscription);

        // Mark as subscribed in localStorage to prevent showing toast again
        localStorage.setItem('pwa-push-subscribed', 'true');

      } catch (error: any) {
        // Error setting up push notifications
      }
    };

    setupPushNotifications();
  }, [serviceWorkerRegistration, hasSetup, currentUserId]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!pushSubscription) return;

    try {
      await pushSubscription.unsubscribe();
      await apiRequest('POST', '/api/push/unsubscribe', {
        endpoint: pushSubscription.endpoint
      });
      setPushSubscription(null);
      // Remove from localStorage to allow re-subscription
      localStorage.removeItem('pwa-push-subscribed');
    } catch (error) {
      // Error unsubscribing
    }
  }, [pushSubscription]);

  return {
    pushPermission,
    isSubscribed: !!pushSubscription,
    serviceWorkerRegistered: !!serviceWorkerRegistration,
    unsubscribe
  };
}
