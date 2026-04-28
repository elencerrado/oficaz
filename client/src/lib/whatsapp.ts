interface OpenWhatsAppOptions {
  event?: { preventDefault?: () => void };
  fallbackDelayMs?: number;
}

export function openWhatsApp(phone: string, options: OpenWhatsAppOptions = {}): void {
  options.event?.preventDefault?.();

  const cleanedPhone = phone.replace(/[^\d]/g, '');
  if (!cleanedPhone) return;

  const appUrl = `whatsapp://send?phone=${cleanedPhone}`;
  const webUrl = `https://wa.me/${cleanedPhone}`;
  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  if (!isMobile) {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const timeoutId = window.setTimeout(() => {
    window.location.href = webUrl;
  }, options.fallbackDelayMs ?? 900);

  const clearFallbackOnAppOpen = () => {
    if (document.hidden) {
      window.clearTimeout(timeoutId);
    }
  };

  document.addEventListener('visibilitychange', clearFallbackOnAppOpen, { once: true });
  window.location.href = appUrl;
}
