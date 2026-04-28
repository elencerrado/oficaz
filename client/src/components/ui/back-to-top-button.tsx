import { useEffect, useState } from 'react';
import { ChevronsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackToTopButtonProps {
  threshold?: number;
  className?: string;
}

const SCROLLABLE_SELECTOR = '.overflow-y-auto, [data-scroll-container]';

function getScrollableElements(): HTMLElement[] {
  const all = Array.from(document.querySelectorAll<HTMLElement>(SCROLLABLE_SELECTOR));

  return all.filter((element) => {
    if (element.hasAttribute('data-preserve-scroll')) return false;
    if (element.tagName === 'NAV') return false;
    return element.scrollHeight > element.clientHeight + 8;
  });
}

export function BackToTopButton({ threshold = 500, className }: BackToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let scrollableElements: HTMLElement[] = [];

    const handleScroll = () => {
      const windowScroll = window.scrollY || document.documentElement.scrollTop || 0;
      const maxContainerScroll = scrollableElements.reduce((max, element) => {
        return Math.max(max, element.scrollTop);
      }, 0);

      setIsVisible(Math.max(windowScroll, maxContainerScroll) > threshold);
    };

    const bindListeners = () => {
      scrollableElements = getScrollableElements();

      window.addEventListener('scroll', handleScroll, { passive: true });
      scrollableElements.forEach((element) => {
        element.addEventListener('scroll', handleScroll, { passive: true });
      });

      handleScroll();
    };

    // Delay one frame so layout wrappers with overflow are already mounted.
    const rafId = window.requestAnimationFrame(bindListeners);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);

      scrollableElements.forEach((element) => {
        element.removeEventListener('scroll', handleScroll);
      });
    };
  }, [threshold]);

  if (!isVisible) return null;

  const scrollToTop = () => {
    const scrollableElements = getScrollableElements();
    const activeElement = scrollableElements.find((element) => element.scrollTop > 0);

    if (activeElement) {
      activeElement.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Button
      type="button"
      onClick={scrollToTop}
      className={
        className ||
        'fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2.5 text-white shadow-lg hover:bg-slate-800'
      }
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      data-testid="button-back-to-top"
      aria-label="Volver arriba"
    >
      <ChevronsUp className="mr-2 h-4 w-4" />
      Volver arriba
    </Button>
  );
}