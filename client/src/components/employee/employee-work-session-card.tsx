import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, MapPin, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkSession {
  id: number;
  userId: number;
  clockIn: string;
  clockOut?: string;
  totalHours?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  device?: string;
}

export interface EmployeeWorkSessionCardProps {
  session: WorkSession;
  isActive: boolean;
  onClockOut?: () => void;
}

export function EmployeeWorkSessionCard({ session, isActive, onClockOut }: EmployeeWorkSessionCardProps) {
  const clockInTime = new Date(session.clockIn);
  const clockOutTime = session.clockOut ? new Date(session.clockOut) : null;

  const locationLink = session.location
    ? `https://www.google.com/maps/@${session.location.latitude},${session.location.longitude},18z`
    : null;

  return (
    <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {format(clockInTime, 'EEEE, d MMMM', { locale: es })}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ID: {session.id}
          </p>
        </div>
        {isActive && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 animate-pulse">
            • En sesión
          </span>
        )}
      </div>

      <div className="space-y-2">
        {/* Clock In Time */}
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>Entrada: {format(clockInTime, 'HH:mm:ss')}</span>
        </div>

        {/* Clock Out Time */}
        {clockOutTime && (
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span>Salida: {format(clockOutTime, 'HH:mm:ss')}</span>
          </div>
        )}

        {/* Total Hours */}
        {session.totalHours && (
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Total: {session.totalHours}</span>
          </div>
        )}

        {/* Location */}
        {locationLink && (
          <a
            href={locationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <MapPin className="h-4 w-4" />
            Ver ubicación
          </a>
        )}

        {/* Device */}
        {session.device && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Cpu className="h-3 w-3" />
            <span>{session.device}</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      {isActive && onClockOut && (
        <Button
          onClick={onClockOut}
          className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white"
          size="sm"
        >
          Registrar Salida
        </Button>
      )}
    </div>
  );
}
