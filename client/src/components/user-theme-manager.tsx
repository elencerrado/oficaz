import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/lib/theme-provider';

/**
 * UserThemeManager - Manages user-specific theme settings
 * 
 * This component handles theme persistence per user to prevent
 * theme interference between different users on the same browser.
 * 
 * It runs inside AuthProvider to have access to user data.
 */
export function UserThemeManager() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const currentUserRef = useRef<number | null>(null);
  const isLoadingUserTheme = useRef(false);

  useEffect(() => {
    if (!user?.id) return;

    const userStorageKey = `oficaz-theme-user-${user.id}`;
    
    // Only load theme when user actually changes
    if (currentUserRef.current !== user.id) {
      currentUserRef.current = user.id;
      isLoadingUserTheme.current = true;
      
      const userTheme = localStorage.getItem(userStorageKey);
      if (userTheme && userTheme !== theme) {
        setTheme(userTheme as 'light' | 'dark' | 'system');
      }
      
      // Small delay to prevent race conditions
      setTimeout(() => {
        isLoadingUserTheme.current = false;
      }, 100);
    }
  }, [user?.id, setTheme]);

  // Save theme changes to user-specific storage
  useEffect(() => {
    if (!user?.id || isLoadingUserTheme.current) return;

    const userStorageKey = `oficaz-theme-user-${user.id}`;
    localStorage.setItem(userStorageKey, theme);
    
    // Also update global storage for initial load
    localStorage.setItem('oficaz-theme', theme);
  }, [theme, user?.id]);

  // This component doesn't render anything
  return null;
}