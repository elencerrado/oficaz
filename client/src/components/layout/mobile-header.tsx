import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="lg:hidden bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onMenuClick}>
        <Menu className="text-gray-600" size={20} />
      </Button>
      <h1 className="text-lg font-semibold text-gray-900">Oficaz</h1>
      <div className="w-6"></div>
    </header>
  );
}
