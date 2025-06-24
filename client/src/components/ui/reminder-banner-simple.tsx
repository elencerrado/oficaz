import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

interface ActiveReminder {
  id: number;
  title: string;
  content?: string;
  reminderDate?: string;
  priority: 'low' | 'medium' | 'high';
  color: string;
}

export function ReminderBannerSimple() {
  console.log('🔔 ReminderBannerSimple component starting...');
  
  const [dismissedReminders, setDismissedReminders] = useState<number[]>([]);
  
  const { data: activeReminders = [], isLoading, error } = useQuery({
    queryKey: ['/api/reminders/active'],
    refetchInterval: 1000, // Check every second for immediate detection
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache results
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
    enabled: true
  });

  console.log('🔔 ReminderBannerSimple data:', {
    activeReminders,
    isLoading,
    error: error?.message,
    dismissedReminders
  });

  // Filter out dismissed reminders
  const visibleReminders = (activeReminders || []).filter(
    (reminder: ActiveReminder) => !dismissedReminders.includes(reminder.id)
  );

  console.log('🔔 Visible reminders:', visibleReminders);

  if (isLoading || !visibleReminders || visibleReminders.length === 0) {
    console.log('🔔 No reminders to show, returning null');
    return null;
  }

  const firstReminder = visibleReminders[0];
  console.log('🔔 Showing reminder:', firstReminder);

  const dismissReminder = (reminderId: number) => {
    console.log('🔔 Dismissing reminder:', reminderId);
    setDismissedReminders(prev => [...prev, reminderId]);
  };

  // Simple color logic
  const backgroundColor = firstReminder.color || '#3b82f6';
  const textColor = backgroundColor === '#ffffff' || backgroundColor === '#ffeb3b' ? '#000000' : '#ffffff';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor,
        color: textColor,
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        zIndex: 10000,
        maxWidth: '90vw',
        minWidth: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '14px',
        fontWeight: '500'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '600', marginBottom: '2px' }}>
          {firstReminder.title}
        </div>
        {firstReminder.content && (
          <div style={{ fontSize: '12px', opacity: '0.9' }}>
            {firstReminder.content}
          </div>
        )}
      </div>
      
      <button
        onClick={() => dismissReminder(firstReminder.id)}
        style={{
          background: 'transparent',
          border: 'none',
          color: textColor,
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <X style={{ width: '16px', height: '16px' }} />
      </button>
    </div>
  );
}