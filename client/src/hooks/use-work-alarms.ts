import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

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
      // 🔒 CRITICAL: Unregister ALL old service workers first
      navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log(`🧹 Found ${registrations.length} existing service worker(s)`);
        Promise.all(registrations.map(reg => reg.unregister()))
          .then(() => {
            console.log('✅ All old service workers unregistered');
            // Now register the new one
            return navigator.serviceWorker.register('/service-worker.js');
          })
          .then((registration) => {
            console.log('✅ Service Worker registered:', registration);
            setServiceWorkerRegistration(registration);
          })
          .catch((error) => {
            console.error('❌ Service Worker registration failed:', error);
          });
      });
    } else {
      console.warn('⚠️  Service Workers not supported');
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
      if (!serviceWorkerRegistration || hasSetup) return;
      
      // Check if already subscribed in this session or previously
      const alreadySubscribed = localStorage.getItem('pwa-push-subscribed');
      if (alreadySubscribed) {
        setHasSetup(true);
        return;
      }
      
      setHasSetup(true); // Mark as setup to prevent multiple runs
      
      try {
        // Request notification permission
        const permission = await Notification.requestPermission();
        setPushPermission(permission);
        
        if (permission !== 'granted') {
          console.log('📢 Push notification permission denied');
          return;
        }

        // Get VAPID public key from server
        const { publicKey } = await apiRequest('GET', '/api/push/vapid-public-key');
        
        // Subscribe to push notifications
        const subscription = await serviceWorkerRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        console.log('✅ Push subscription created:', subscription);
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

        console.log('✅ Push subscription saved to server');
        
        // Mark as subscribed in localStorage to prevent showing toast again
        localStorage.setItem('pwa-push-subscribed', 'true');

      } catch (error: any) {
        console.error('❌ Error setting up push notifications:', error);
      }
    };

    setupPushNotifications();
  }, [serviceWorkerRegistration, hasSetup]);

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
      console.log('✅ Unsubscribed from push notifications');
    } catch (error) {
      console.error('❌ Error unsubscribing:', error);
    }
  }, [pushSubscription]);

  return {
    pushPermission,
    isSubscribed: !!pushSubscription,
    serviceWorkerRegistered: !!serviceWorkerRegistration,
    unsubscribe
  };
}
