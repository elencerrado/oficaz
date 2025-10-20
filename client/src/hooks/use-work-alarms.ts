import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const lastCheckRef = useRef<number>(Date.now());
  const activeIntervalsRef = useRef<number[]>([]);

  // Detect if we're on iOS/Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Request notification permission on mount (only on supported browsers)
  useEffect(() => {
    // iOS Safari doesn't support Web Notifications API
    if ('Notification' in window && !isIOS) {
      setNotificationPermission(Notification.permission);
      
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    } else {
      // On iOS, we'll use toast notifications exclusively
      setNotificationPermission('denied');
    }
  }, [isIOS]);

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
      // Resume audio context if suspended (required by browsers, especially iOS)
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
    const getNotificationText = (type: string) => {
      switch (type) {
        case 'clock_in': return 'fichar entrada';
        case 'clock_out': return 'salir del trabajo';
        case 'break_start': return 'iniciar descanso';
        case 'break_end': return 'terminar descanso';
        default: return 'fichar';
      }
    };
    const body = `Es hora de ${getNotificationText(alarm.type)} - ${alarm.time}`;
    
    // Always show toast notification (works on all platforms including iOS)
    toast({
      title: `🚨 ${alarm.title}`,
      description: body,
      duration: 30000, // 30 seconds for better visibility
    });

    // Also try browser notification if supported (won't work on iOS)
    if (notificationPermission === 'granted' && !isIOS) {
      try {
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
        };
      } catch (error) {
        console.error('Error showing browser notification:', error);
      }
    }

    // Play sound if enabled
    if (alarm.soundEnabled) {
      playNotificationSound();
    }

    // Log for debugging
    console.log('🔔 Alarm triggered:', {
      title: alarm.title,
      time: alarm.time,
      type: alarm.type,
      platform: isIOS ? 'iOS' : isSafari ? 'Safari' : 'Other',
      notificationMethod: isIOS ? 'Toast only' : notificationPermission === 'granted' ? 'Browser + Toast' : 'Toast only'
    });
  }, [notificationPermission, playNotificationSound, toast, isIOS, isSafari]);

  // Check if it's time for an alarm
  const checkAlarmTime = useCallback((alarm: WorkAlarm): boolean => {
    const now = new Date();
    const currentDay = now.getDay() || 7; // Convert Sunday (0) to 7
    
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
      const now = Date.now();
      
      // Log check for debugging (only every 60 seconds to avoid spam)
      if (now - lastCheckRef.current >= 60000) {
        console.log('⏰ Checking alarms at', new Date().toLocaleTimeString());
        lastCheckRef.current = now;
      }

      const activeAlarms: WorkAlarm[] = await apiRequest('GET', '/api/work-alarms/active');
      
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

  // Handle page visibility changes (important for mobile browsers)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, check alarms immediately
        console.log('📱 Page visible, checking alarms...');
        checkActiveAlarms();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkActiveAlarms]);

  // Start alarm checking service with multiple strategies
  const startAlarmService = useCallback(() => {
    // Check immediately
    checkActiveAlarms();
    
    // Clear any existing intervals
    activeIntervalsRef.current.forEach(id => clearInterval(id));
    activeIntervalsRef.current = [];
    
    // Strategy 1: Check every 30 seconds (more frequent for better reliability)
    const interval1 = window.setInterval(checkActiveAlarms, 30000);
    activeIntervalsRef.current.push(interval1);
    
    // Strategy 2: Check every minute on the minute mark (for precision)
    const checkOnMinute = () => {
      const now = new Date();
      const secondsUntilNextMinute = 60 - now.getSeconds();
      
      setTimeout(() => {
        checkActiveAlarms();
        // Set up recurring check every minute
        const interval2 = window.setInterval(checkActiveAlarms, 60000);
        activeIntervalsRef.current.push(interval2);
      }, secondsUntilNextMinute * 1000);
    };
    checkOnMinute();
    
    console.log('✅ Alarm service started with multi-strategy checking');
    
    return () => {
      activeIntervalsRef.current.forEach(id => clearInterval(id));
      activeIntervalsRef.current = [];
      console.log('❌ Alarm service stopped');
    };
  }, [checkActiveAlarms]);

  return {
    notificationPermission,
    showNotification,
    checkActiveAlarms,
    startAlarmService,
    playNotificationSound,
    isIOS, // Expose for debugging
    isSafari
  };
}
