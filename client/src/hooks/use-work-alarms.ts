import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [pushPermission, setPushPermission] = useState<'granted' | 'denied' | 'default'>('default');

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
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration);
          setServiceWorkerRegistration(registration);
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    } else {
      console.warn('⚠️  Service Workers not supported');
    }
  }, []);

  // Request push notification permission and subscribe
  useEffect(() => {
    const setupPushNotifications = async () => {
      if (!serviceWorkerRegistration) return;
      
      try {
        // Request notification permission
        const permission = await Notification.requestPermission();
        setPushPermission(permission);
        
        if (permission !== 'granted') {
          console.log('📢 Push notification permission denied');
          toast({
            title: '📱 Instala Oficaz como App',
            description: 'Para recibir notificaciones de alarmas con el móvil bloqueado, instala Oficaz desde el menú de tu navegador.',
            duration: 10000,
          });
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

        // Send subscription to server
        await apiRequest('POST', '/api/push/subscribe', {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...Array.from(new Uint8Array(subscription.getKey('p256dh')!)))),
            auth: btoa(String.fromCharCode(...Array.from(new Uint8Array(subscription.getKey('auth')!))))
          }
        });

        console.log('✅ Push subscription saved to server');
        
        toast({
          title: '✅ Notificaciones activadas',
          description: 'Recibirás alertas de tus alarmas incluso con el móvil bloqueado.',
          duration: 5000,
        });

      } catch (error: any) {
        console.error('❌ Error setting up push notifications:', error);
        
        // User-friendly error message
        if (error.message?.includes('not configured')) {
          toast({
            title: '⚠️  Configuración pendiente',
            description: 'Las notificaciones push están en configuración. Mientras tanto, mantén la app abierta para recibir alarmas.',
            duration: 5000,
          });
        }
      }
    };

    setupPushNotifications();
  }, [serviceWorkerRegistration, toast]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!pushSubscription) return;

    try {
      await pushSubscription.unsubscribe();
      await apiRequest('POST', '/api/push/unsubscribe', {
        endpoint: pushSubscription.endpoint
      });
      setPushSubscription(null);
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
