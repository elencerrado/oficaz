import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Info, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface WorkSchedule {
  id: number;
  companyId: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  expectedEntryTime: string | null; // "09:00"
  expectedExitTime: string | null; // "17:00"
  isWorkingDay: boolean;
  toleranceMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WORKING_DAYS = [1, 2, 3, 4, 5]; // Monday to Friday

export const GlobalScheduleConfig: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch current schedules
  const { data: schedules = [], isLoading } = useQuery<WorkSchedule[]>({
    queryKey: ['/api/company-work-schedules'],
    staleTime: 60000,
  });

  // Local state for form
  const [formData, setFormData] = useState<Record<number, Partial<WorkSchedule>>>({});

  // Initialize form data when schedules load
  useEffect(() => {
    const normalizedData: Record<number, Partial<WorkSchedule>> = {};

    for (let i = 0; i < 7; i++) {
      const existing = schedules.find((schedule) => schedule.dayOfWeek === i);
      normalizedData[i] = existing
        ? { ...existing, dayOfWeek: i }
        : {
            dayOfWeek: i,
            isWorkingDay: WORKING_DAYS.includes(i),
            expectedEntryTime: WORKING_DAYS.includes(i) ? '09:00' : null,
            expectedExitTime: WORKING_DAYS.includes(i) ? '17:00' : null,
            toleranceMinutes: 15,
          };
    }

    setFormData(normalizedData);
  }, [schedules]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (dayOfWeek: number) => {
      const current = formData[dayOfWeek] || {};
      const isWorkingDay = Boolean(current.isWorkingDay);

      if (isWorkingDay && (!current.expectedEntryTime || !current.expectedExitTime)) {
        throw new Error('Los días laborales deben tener hora de entrada y salida.');
      }

      const safeTolerance = Number.isFinite(Number(current.toleranceMinutes))
        ? Math.min(120, Math.max(0, Math.trunc(Number(current.toleranceMinutes))))
        : 15;

      const data = {
        ...(formData[dayOfWeek] || {}),
        dayOfWeek,
        isWorkingDay,
        toleranceMinutes: safeTolerance,
        expectedEntryTime: isWorkingDay ? (current.expectedEntryTime || null) : null,
        expectedExitTime: isWorkingDay ? (current.expectedExitTime || null) : null,
      };
      return apiRequest('POST', '/api/company-work-schedules', data);
    },
    onSuccess: (_data, dayOfWeek) => {
      toast({
        title: 'Horario guardado',
        description: `La configuración para ${DAYS_ES[dayOfWeek]} se ha actualizado.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/company-work-schedules'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message || 'No se pudo guardar la configuración.',
        variant: 'destructive',
      });
    },
  });

  const handleFieldChange = (dayOfWeek: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [dayOfWeek]: {
        dayOfWeek,
        ...prev[dayOfWeek],
        [field]: value,
      },
    }));
  };

  const handleSave = (dayOfWeek: number) => {
    saveMutation.mutate(dayOfWeek);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <>
      {!isAdmin && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg mb-6">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Acceso de solo lectura:</strong> Solo los administradores pueden modificar estos horarios.
            </p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Nota:</strong> Estos horarios se utilizan como referencia global para detectar empleados que no han fichado. 
            El sistema también aprende los patrones individuales de cada empleado según su historial de 60 días.
          </div>
        </div>
      </div>

        {/* Compact Mac-style grid table */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 overflow-hidden shadow-sm">
          {/* Header row with day names */}
          <div className="grid grid-cols-7 gap-0 border-b border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-900/50">
            {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => (
              <div key={`header-${dayOfWeek}`} className={`p-3 text-center border-r border-slate-200/50 dark:border-slate-700/30 last:border-r-0 ${
                dayOfWeek === 0 || dayOfWeek === 6 ? 'bg-slate-100/50 dark:bg-slate-800/40' : ''
              }`}>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {DAYS_ES[dayOfWeek]}
                </div>
              </div>
            ))}
          </div>

          {/* Row 1: Working day toggle */}
          <div className="grid grid-cols-7 gap-0 border-b border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-slate-900/70">
            {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
              const dayData = formData[dayOfWeek];
              const isWorkingDay = dayData?.isWorkingDay ?? (WORKING_DAYS.includes(dayOfWeek));
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div key={`toggle-${dayOfWeek}`} className={`p-3 border-r border-slate-200/50 dark:border-slate-700/30 last:border-r-0 flex items-center justify-center ${
                  isWeekend && !isWorkingDay ? 'bg-slate-50/50 dark:bg-slate-800/40' : ''
                }`}>
                  <div className="flex flex-col items-center gap-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Laboral</label>
                    <Switch
                      checked={isWorkingDay}
                      disabled={!isAdmin}
                      onCheckedChange={(checked) => {
                        handleFieldChange(dayOfWeek, 'isWorkingDay', checked);
                        if (!checked) {
                          handleFieldChange(dayOfWeek, 'expectedEntryTime', null);
                          handleFieldChange(dayOfWeek, 'expectedExitTime', null);
                        } else {
                          handleFieldChange(dayOfWeek, 'expectedEntryTime', '09:00');
                          handleFieldChange(dayOfWeek, 'expectedExitTime', '17:00');
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 2: Entry time */}
          <div className="grid grid-cols-7 gap-0 border-b border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-slate-900/70">
            {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
              const dayData = formData[dayOfWeek];
              const isWorkingDay = dayData?.isWorkingDay ?? (WORKING_DAYS.includes(dayOfWeek));
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div key={`entry-${dayOfWeek}`} className={`p-2.5 border-r border-slate-200/50 dark:border-slate-700/30 last:border-r-0 ${
                  isWeekend && !isWorkingDay ? 'bg-slate-50/50 dark:bg-slate-800/40' : ''
                }`}>
                  {isWorkingDay ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Entrada</label>
                      <Input
                        type="time"
                        value={dayData?.expectedEntryTime || '09:00'}
                        onChange={(e) => handleFieldChange(dayOfWeek, 'expectedEntryTime', e.target.value)}
                        className="h-8 text-xs bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-600"
                        disabled={!isAdmin}
                      />
                    </div>
                  ) : (
                    <div className="h-8 flex items-center justify-center">
                      <div className="text-xs text-slate-300 dark:text-slate-600">–</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Row 3: Exit time */}
          <div className="grid grid-cols-7 gap-0 border-b border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-slate-900/70">
            {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
              const dayData = formData[dayOfWeek];
              const isWorkingDay = dayData?.isWorkingDay ?? (WORKING_DAYS.includes(dayOfWeek));
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div key={`exit-${dayOfWeek}`} className={`p-2.5 border-r border-slate-200/50 dark:border-slate-700/30 last:border-r-0 ${
                  isWeekend && !isWorkingDay ? 'bg-slate-50/50 dark:bg-slate-800/40' : ''
                }`}>
                  {isWorkingDay ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Salida</label>
                      <Input
                        type="time"
                        value={dayData?.expectedExitTime || '17:00'}
                        onChange={(e) => handleFieldChange(dayOfWeek, 'expectedExitTime', e.target.value)}
                        className="h-8 text-xs bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-600"
                        disabled={!isAdmin}
                      />
                    </div>
                  ) : (
                    <div className="h-8 flex items-center justify-center">
                      <div className="text-xs text-slate-300 dark:text-slate-600">–</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Row 4: Tolerance */}
          <div className="grid grid-cols-7 gap-0 border-b border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-slate-900/70">
            {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
              const dayData = formData[dayOfWeek];
              const isWorkingDay = dayData?.isWorkingDay ?? (WORKING_DAYS.includes(dayOfWeek));
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div key={`tolerance-${dayOfWeek}`} className={`p-2.5 border-r border-slate-200/50 dark:border-slate-700/30 last:border-r-0 ${
                  isWeekend && !isWorkingDay ? 'bg-slate-50/50 dark:bg-slate-800/40' : ''
                }`}>
                  {isWorkingDay ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Tolerancia</label>
                      <Input
                        type="number"
                        min="0"
                        max="120"
                        value={dayData?.toleranceMinutes ?? 15}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            handleFieldChange(dayOfWeek, 'toleranceMinutes', 0);
                            return;
                          }
                          const parsed = Number.parseInt(raw, 10);
                          handleFieldChange(dayOfWeek, 'toleranceMinutes', Number.isNaN(parsed) ? 15 : parsed);
                        }}
                        className="h-8 text-xs bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-600"
                        disabled={!isAdmin}
                      />
                    </div>
                  ) : (
                    <div className="h-8 flex items-center justify-center">
                      <div className="text-xs text-slate-300 dark:text-slate-600">–</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Row 5: Save buttons (only if admin) */}
          {isAdmin && (
            <div className="grid grid-cols-7 gap-0 bg-slate-50/70 dark:bg-slate-900/40">
              {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
                const dayData = formData[dayOfWeek];
                const defaultEntry = WORKING_DAYS.includes(dayOfWeek) ? '09:00' : null;
                const defaultExit = WORKING_DAYS.includes(dayOfWeek) ? '17:00' : null;
                const baseSchedule = schedules.find((s) => s.dayOfWeek === dayOfWeek) || {
                  dayOfWeek,
                  isWorkingDay: WORKING_DAYS.includes(dayOfWeek),
                  expectedEntryTime: defaultEntry,
                  expectedExitTime: defaultExit,
                  toleranceMinutes: 15,
                };
                const isModified =
                  dayData?.isWorkingDay !== baseSchedule.isWorkingDay ||
                  dayData?.expectedEntryTime !== baseSchedule.expectedEntryTime ||
                  dayData?.expectedExitTime !== baseSchedule.expectedExitTime ||
                  dayData?.toleranceMinutes !== baseSchedule.toleranceMinutes;
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <div key={`save-${dayOfWeek}`} className={`p-2 border-r border-slate-200/50 dark:border-slate-700/30 last:border-r-0 flex items-center justify-center ${
                    isWeekend ? 'bg-slate-100/50 dark:bg-slate-800/30' : ''
                  }`}>
                    <Button
                      size="sm"
                      onClick={() => handleSave(dayOfWeek)}
                      disabled={!isModified || saveMutation.isPending}
                      variant={isModified ? 'default' : 'ghost'}
                      className="h-8 px-2 text-xs"
                    >
                      {saveMutation.isPending ? '...' : isModified ? '💾' : '✓'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  };
