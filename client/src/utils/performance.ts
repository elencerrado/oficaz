// Performance utilities for mobile optimization

// Detect if device is low-end mobile
export const isLowEndDevice = (): boolean => {
  const connection = (navigator as any).connection;
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const deviceMemory = (navigator as any).deviceMemory || 2;
  
  return (
    hardwareConcurrency <= 2 ||
    deviceMemory <= 2 ||
    (connection && connection.effectiveType === 'slow-2g') ||
    (connection && connection.effectiveType === '2g')
  );
};

// Detect mobile device
export const isMobileDevice = (): boolean => {
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768;
};

// Load CSS non-blocking
export const loadCSS = (href: string, priority: 'high' | 'low' = 'low'): Promise<void> => {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = priority === 'low' ? 'print' : 'all';
    
    link.onload = () => {
      if (priority === 'low') {
        link.media = 'all';
      }
      resolve();
    };
    
    document.head.appendChild(link);
  });
};

// Defer script loading
export const loadScript = (src: string, delay: number = 0): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    }, delay);
  });
};