import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface WorkAlarm {
  id: number;
  userId: number;
  title: string;
  type: 'clock_in' | 'clock_out';
  time: string;
  weekdays: number[];
  soundEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useWorkAlarms() {
  const { toast } = useToast();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Initialize audio context
  useEffect(() => {
    if ('AudioContext' in window || 'webkitAudioContext' in window) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(context);
      
      return () => {
        context.close();
      };
    }
  }, []);

  // Create notification sound
  const playNotificationSound = useCallback(async () => {
    if (!audioContext) return;
    
    try {
      // Resume audio context if suspended (required by browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Create a simple notification tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Set up the tone (a pleasant notification sound)
      oscillator.frequency.value = 800; // Hz
      oscillator.type = 'sine';
      
      // Fade in and out
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
      
      oscillator.start(now);
      oscillator.stop(now + 0.5);
      
      // Second tone for double beep
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.frequency.value = 1000; // Hz
        oscillator2.type = 'sine';
        
        const now2 = audioContext.currentTime;
        gainNode2.gain.setValueAtTime(0, now2);
        gainNode2.gain.linearRampToValueAtTime(0.3, now2 + 0.1);
        gainNode2.gain.linearRampToValueAtTime(0, now2 + 0.5);
        
        oscillator2.start(now2);
        oscillator2.stop(now2 + 0.5);
      }, 600);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, [audioContext]);

  // Show notification
  const showNotification = useCallback((alarm: WorkAlarm) => {
    const title = `🚨 ${alarm.title}`;
    const body = `Es hora de ${alarm.type === 'clock_in' ? 'fichar entrada' : 'salir del trabajo'} - ${alarm.time}`;
    
    if (notificationPermission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `work-alarm-${alarm.id}`,
        requireInteraction: true // Keep notification visible until user interacts
      });

      // Auto-close notification after 30 seconds
      setTimeout(() => {
        notification.close();
      }, 30000);

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
        // You could navigate to time tracking page here
      };
    } else {
      // Fallback to toast notification
      toast({
        title: `🚨 ${alarm.title}`,
        description: body,
        duration: 10000, // 10 seconds
      });
    }

    // Play sound if enabled
    if (alarm.soundEnabled) {
      playNotificationSound();
    }
  }, [notificationPermission, playNotificationSound, toast]);

  // Check if it's time for an alarm
  const checkAlarmTime = useCallback((alarm: WorkAlarm): boolean => {
    const now = new Date();
    const currentDay = now.getDay() || 7; // Convert Sunday (0) to 7
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    // Check if today is in the alarm's weekdays
    if (!alarm.weekdays.includes(currentDay)) {
      return false;
    }
    
    // Check if current time matches alarm time (with 1-minute window)
    const [alarmHour, alarmMinute] = alarm.time.split(':').map(Number);
    const alarmDate = new Date();
    alarmDate.setHours(alarmHour, alarmMinute, 0, 0);
    
    const currentDate = new Date();
    currentDate.setSeconds(0, 0); // Remove seconds and milliseconds for comparison
    
    // Check if we're within 1 minute of the alarm time
    const timeDiff = Math.abs(currentDate.getTime() - alarmDate.getTime());
    return timeDiff < 60000; // 1 minute = 60000 milliseconds
  }, []);

  // Get active alarms and check them
  const checkActiveAlarms = useCallback(async () => {
    try {
      const activeAlarms: WorkAlarm[] = await apiRequest('/api/work-alarms/active', {
        method: 'GET'
      });
      
      for (const alarm of activeAlarms) {
        if (checkAlarmTime(alarm)) {
          // Check if we've already shown this alarm in the last 5 minutes
          const storageKey = `alarm-shown-${alarm.id}-${alarm.time}`;
          const lastShown = localStorage.getItem(storageKey);
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          
          if (!lastShown || parseInt(lastShown) < fiveMinutesAgo) {
            showNotification(alarm);
            localStorage.setItem(storageKey, Date.now().toString());
          }
        }
      }
    } catch (error) {
      console.error('Error checking active alarms:', error);
    }
  }, [checkAlarmTime, showNotification]);

  // Start alarm checking service
  const startAlarmService = useCallback(() => {
    // Check immediately
    checkActiveAlarms();
    
    // Check every minute
    const interval = setInterval(checkActiveAlarms, 60000);
    
    return () => clearInterval(interval);
  }, [checkActiveAlarms]);

  return {
    notificationPermission,
    showNotification,
    checkActiveAlarms,
    startAlarmService,
    playNotificationSound
  };
}