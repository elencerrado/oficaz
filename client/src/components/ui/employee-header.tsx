import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface EmployeeHeaderProps {
  title: string;
  companyName?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  showLogout?: boolean;
}

export function EmployeeHeader({ 
  title, 
  companyName, 
  showBackButton = false, 
  onBackClick,
  showLogout = true 
}: EmployeeHeaderProps) {
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  return (
    <div 
      className="px-4 py-3 flex items-center justify-between border-b border-gray-200/20"
      style={{
        background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)',
        paddingTop: 'max(12px, env(safe-area-inset-top, 12px))'
      }}
    >
      <div className="flex items-center space-x-3">
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackClick}
            className="p-2 text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        
        <div className="text-center">
          <div className="text-white text-sm font-medium">
            {companyName || 'Test Company'}
          </div>
          <div className="text-white/70 text-xs">
            {user?.fullName}
          </div>
        </div>
      </div>

      <div className="text-center flex-1">
        <h1 className="text-white text-lg font-semibold">{title}</h1>
      </div>

      <div className="flex items-center">
        {showLogout && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="p-2 text-white hover:bg-white/10"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}