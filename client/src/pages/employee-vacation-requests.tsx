import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageTitle } from '@/hooks/use-page-title';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarPlus, Calendar, Check, X, Clock, CalendarDays, ChevronLeft, ChevronRight, HelpCircle, MessageCircle, FileText, Upload, Paperclip, Baby, Heart, Users, Home, Briefcase, Thermometer, Plane } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { EmployeeTopBar } from '@/components/employee/employee-top-bar';

interface AbsencePolicy {
  id: number;
  companyId: number;
  absenceType: string;
  name: string;
  maxDays: number | null;
  requiresAttachment: boolean;
  isActive: boolean;
}

const ABSENCE_TYPE_ICONS: Record<string, any> = {
  vacation: Plane,
  maternity_paternity: Baby,
  marriage: Heart,
  family_death: Users,
  family_death_travel: Users,
  family_illness: Thermometer,
  family_illness_travel: Thermometer,
  home_relocation: Home,
  public_duty: Briefcase,
  temporary_disability: Thermometer,
};

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacaciones',
  maternity_paternity: 'Maternidad / Paternidad',
  marriage: 'Matrimonio',
  family_death: 'Fallecimiento familiar',
  family_death_travel: 'Fallecimiento familiar (con desplazamiento)',
  family_illness: 'Enfermedad grave familiar',
  family_illness_travel: 'Enfermedad grave familiar (con desplazamiento)',
  home_relocation: 'Traslado de domicilio',
  public_duty: 'Deber público',
  temporary_disability: 'Incapacidad temporal',
};

export default function VacationRequests() {
  usePageTitle('Mis Ausencias');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAbsenceType, setSelectedAbsenceType] = useState<string>('vacation');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const { user, company } = useAuth();
  const { hasAccess, getRequiredPlan } = useFeatureCheck();
  
  // Check if user has access to vacation feature
  if (!hasAccess('vacation')) {
    return (
      <FeatureRestrictedPage
        featureName="Ausencias"
        description="Solicitud y gestión de días de ausencia"
        requiredPlan={getRequiredPlan('vacation')}
        icon={Calendar}
      />
    );
  }
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const urlParts = location.split('/').filter(part => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/vacation-requests'],
    enabled: !!user,
    staleTime: 60000, // ⚡ WebSocket handles vacation_request_* events - cache for 1 min
  });

  const { data: absencePolicies = [] } = useQuery<AbsencePolicy[]>({
    queryKey: ['/api/absence-policies'],
    enabled: !!user,
  });

  const { data: companyConfig } = useQuery<{ vacationCutoffDay?: string }>({
    queryKey: ['/api/company/config'],
    queryFn: async () => apiRequest('GET', '/api/company/config'),
    enabled: !!user,
  });

  const selectedPolicy = absencePolicies.find(p => p.absenceType === selectedAbsenceType);
  const isFixedDurationAbsence = selectedPolicy?.maxDays !== null && selectedAbsenceType !== 'vacation';
  const requiresAttachment = selectedPolicy?.requiresAttachment ?? false;






  const createRequestMutation = useMutation({
    mutationFn: (data: { startDate: string; endDate: string; reason?: string; absenceType?: string; attachmentPath?: string; attachmentFileSize?: number; attachmentMimeType?: string }) =>
      apiRequest('POST', '/api/vacation-requests', data),
    onSuccess: () => {
      // Invalidate both employee and admin cache keys
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      setIsModalOpen(false);
      setSelectedStartDate(null);
      setSelectedEndDate(null);
      setReason('');
      setSelectedAbsenceType('vacation');
      setAttachmentFile(null);
      toast({
        title: '¡Solicitud enviada!',
        description: selectedAbsenceType === 'vacation' 
          ? 'Tu solicitud de ausencia ha sido enviada correctamente.'
          : 'Tu solicitud de ausencia ha sido enviada correctamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar la solicitud',
        variant: 'destructive',
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-500/30';
      case 'approved':
        return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-500/30';
      case 'denied':
        return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/30';
      default:
        return 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobado';
      case 'denied':
        return 'Rechazado';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <Check className="w-3 h-3" />;
      case 'denied': return <X className="w-3 h-3" />;
      case 'pending': return <Clock className="w-3 h-3" />;
      default: return null;
    }
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return differenceInDays(end, start) + 1;
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'd MMM', { locale: es });
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    
    if (startDate.toDateString() === endDate.toDateString()) {
      return format(startDate, 'd MMM yyyy', { locale: es });
    }
    
    const startFormatted = format(startDate, 'd MMM', { locale: es });
    const endFormatted = format(endDate, 'd MMM yyyy', { locale: es });
    return `${startFormatted} - ${endFormatted}`;
  };

  // Calculate vacation days
  const totalDays = parseFloat(user?.totalVacationDays || '22');
  
  // Días usados = todas las vacaciones aprobadas (pasadas, actuales y futuras)
  const usedDays = Array.isArray(requests) ? requests
    .filter(r => r.status === 'approved')
    .reduce((sum: number, r) => sum + calculateDays(r.startDate, r.endDate), 0) : 0;
  
  // Días disponibles = total - usados
  const availableDays = Math.max(0, totalDays - usedDays);
  
  // Solo para mostrar en la leyenda (no afecta cálculos)
  const pendingDays = Array.isArray(requests) ? requests
    .filter(r => r.status === 'pending')
    .reduce((sum: number, r) => sum + calculateDays(r.startDate, r.endDate), 0) : 0;
  const usagePercentage = totalDays > 0 ? (usedDays / totalDays) * 100 : 0;

  // Create vacation explanation message
  const daysPerMonth = parseFloat(user?.vacationDaysPerMonth || '2.5');
  const adjustment = parseFloat(user?.vacationDaysAdjustment || '0');
  const startDate = user?.startDate ? new Date(user.startDate) : new Date();
  const currentDate = new Date();
  
  // Calculate months according to Spanish vacation law
  const oneYearFromStart = new Date(startDate);
  oneYearFromStart.setFullYear(startDate.getFullYear() + 1);
  
  let monthsWorked: number;
  
  if (currentDate >= oneYearFromStart) {
    // Employee has worked more than one year - gets full annual entitlement
    monthsWorked = 12; // Maximum 12 months per Spanish labor law
  } else {
    // Employee has worked less than one year - proportional calculation within current vacation period
    const cutoff = companyConfig?.vacationCutoffDay || '01-31';
    const [mmStr, ddStr] = cutoff.split('-');
    const mm = Math.max(1, Math.min(12, parseInt(mmStr || '1', 10))) - 1;
    const dd = Math.max(1, Math.min(31, parseInt(ddStr || '31', 10)));
    const cutoffThisYear = new Date(currentDate.getFullYear(), mm, dd);
    const periodEnd = currentDate <= cutoffThisYear ? cutoffThisYear : new Date(currentDate.getFullYear() + 1, mm, dd);
    const periodStart = new Date(periodEnd);
    periodStart.setFullYear(periodEnd.getFullYear() - 1);
    periodStart.setDate(periodStart.getDate() + 1);

    const accrualStart = startDate > periodStart ? startDate : periodStart;

    if (accrualStart > periodEnd) {
      monthsWorked = 0;
    } else {
      const months = (periodEnd.getFullYear() - accrualStart.getFullYear()) * 12 +
        (periodEnd.getMonth() - accrualStart.getMonth()) +
        (periodEnd.getDate() >= accrualStart.getDate() ? 1 : 0);
      monthsWorked = Math.min(12, Math.max(0, months));
    }
  }
  
  const calculatedBaseDays = Math.round(monthsWorked * daysPerMonth * 10) / 10;

  const canRequestDays = selectedStartDate && selectedEndDate ? 
    differenceInDays(selectedEndDate, selectedStartDate) + 1 : 0;
  const exceedsAvailable = canRequestDays > availableDays;

  // Calendar logic
  const handleDateClick = (date: Date) => {
    setErrorMessage(null); // Clear any previous error

    // Block selections outside current vacation period
    if (selectedAbsenceType === 'vacation') {
      if (date < periodStart || date > periodEnd) {
        setErrorMessage(`Solo puedes seleccionar vacaciones hasta el ${format(periodEnd, "d 'de' MMMM", { locale: es })} del periodo vigente.`);
        return;
      }
    }
    
    // For fixed-duration absences, only allow start date selection
    if (isFixedDurationAbsence && selectedPolicy?.maxDays) {
      setSelectedStartDate(date);
      // Auto-calculate end date based on policy maxDays
      const endDate = addDays(date, selectedPolicy.maxDays - 1);
      setSelectedEndDate(endDate);
      return;
    }
    
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Starting new selection
      setSelectedStartDate(date);
      setSelectedEndDate(null);
    } else if (date < selectedStartDate) {
      // Clicked before start date, make it the new start
      setSelectedStartDate(date);
    } else {
      // Set end date and check if range is valid (only for vacation)
      if (selectedAbsenceType === 'vacation') {
        const daysBetween = differenceInDays(date, selectedStartDate) + 1;
        if (daysBetween <= availableDays) {
          setSelectedEndDate(date);
        } else {
          setErrorMessage(`Ojalá pudiéramos darte más… pero ahora mismo solo tienes ${availableDays} días.`);
        }
      } else {
        setSelectedEndDate(date);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedStartDate || !selectedEndDate) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona las fechas de inicio y fin',
        variant: 'destructive',
      });
      return;
    }

    // Only check vacation balance for vacation type
    if (selectedAbsenceType === 'vacation' && exceedsAvailable) {
      setErrorMessage(`Ojalá pudiéramos darte más… pero ahora mismo solo tienes ${availableDays} días.`);
      return;
    }

    // Check if attachment is required but not provided
    if (requiresAttachment && !attachmentFile) {
      toast({
        title: 'Error',
        description: 'Debes adjuntar un justificante para este tipo de ausencia',
        variant: 'destructive',
      });
      return;
    }

    try {
      let attachmentPath: string | undefined;

      // Upload attachment if provided
      let attachmentFileSize: number | undefined;
      let attachmentMimeType: string | undefined;
      
      if (attachmentFile) {
        setUploadingAttachment(true);
        const formData = new FormData();
        formData.append('file', attachmentFile);
        
        const response = await fetch('/api/absence-attachments', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Error al subir el archivo');
        }

        const result = await response.json();
        // Use the URL (not path) so it's accessible via the public-objects endpoint
        attachmentPath = result.url;
        attachmentFileSize = result.fileSize;
        attachmentMimeType = result.mimeType;
        setUploadingAttachment(false);
      }

      createRequestMutation.mutate({
        startDate: selectedStartDate.toISOString(),
        endDate: selectedEndDate.toISOString(),
        reason: reason || undefined,
        absenceType: selectedAbsenceType,
        attachmentPath,
        attachmentFileSize,
        attachmentMimeType,
      });
    } catch (error: any) {
      setUploadingAttachment(false);
      toast({
        title: 'Error',
        description: error.message || 'Error al procesar la solicitud',
        variant: 'destructive',
      });
    }
  };

  const isDateInRange = (date: Date) => {
    if (!selectedStartDate) return false;
    if (!selectedEndDate && !hoverDate) return isSameDay(date, selectedStartDate);
    
    const endDate = selectedEndDate || hoverDate;
    if (!endDate) return isSameDay(date, selectedStartDate);
    
    return isWithinInterval(date, { 
      start: selectedStartDate < endDate ? selectedStartDate : endDate,
      end: selectedStartDate < endDate ? endDate : selectedStartDate
    });
  };

  const isDateStart = (date: Date) => selectedStartDate && isSameDay(date, selectedStartDate);
  const isDateEnd = (date: Date) => selectedEndDate && isSameDay(date, selectedEndDate);

  // Vacation period limits based on company cutoff (used only for vacation type)
  const { periodStart, periodEnd } = useMemo(() => {
    const cutoff = companyConfig?.vacationCutoffDay || '01-31';
    const [mmStr, ddStr] = cutoff.split('-');
    const mm = Math.max(1, Math.min(12, parseInt(mmStr || '1', 10))) - 1;
    const dd = Math.max(1, Math.min(31, parseInt(ddStr || '31', 10)));
    const today = new Date();
    const cutoffThisYear = new Date(today.getFullYear(), mm, dd);
    const end = today <= cutoffThisYear ? cutoffThisYear : new Date(today.getFullYear() + 1, mm, dd);
    const start = new Date(end);
    start.setFullYear(end.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    return { periodStart: start, periodEnd: end };
  }, [companyConfig?.vacationCutoffDay]);

  // Calendar navigation bounded only when selecting vacation
  const goToPreviousMonth = () => {
    const prev = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    if (selectedAbsenceType === 'vacation') {
      if (prev >= new Date(periodStart.getFullYear(), periodStart.getMonth(), 1)) {
        setCalendarDate(prev);
      }
    } else {
      setCalendarDate(prev);
    }
  };

  const goToNextMonth = () => {
    const next = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    if (selectedAbsenceType === 'vacation') {
      if (next <= new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1)) {
        setCalendarDate(next);
      }
    } else {
      setCalendarDate(next);
    }
  };

  // Generate calendar days for selected month, bounding to period only for vacation and blocking past days
  const generateCalendarDays = () => {
    const today = new Date();
    const currentMonth = calendarDate.getMonth();
    const currentYear = calendarDate.getFullYear();
    
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDay = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [] as Array<Date | null>;
    
    for (let i = 0; i < startDay; i++) days.push(null);
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const inPeriod = selectedAbsenceType === 'vacation' ? (date >= periodStart && date <= periodEnd) : true;
      if (date > yesterday && inPeriod) {
        days.push(date);
      } else {
        days.push(null);
      }
    }
    return days;
  };

  const isInitialLoading = isLoading;

  return (
    <div 
      className="bg-gray-50 dark:bg-employee-gradient text-gray-900 dark:text-white"
      style={{
        overscrollBehavior: 'none'
      }}
    >
      <EmployeeTopBar homeHref={`/${companyAlias}/inicio`} />
      {/* Page Title */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Ausencias</h1>
        <p className="text-gray-600 dark:text-white/70 text-sm">
          Solicita y consulta el estado de tus ausencias y permisos
        </p>
      </div>
      {/* Compact Vacation Summary */}
      <div className="px-6 mb-6">
        <div className="bg-white dark:bg-white/5 rounded-xl p-6 border border-gray-100 dark:border-white/10">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-light text-blue-400 mb-1 flex items-center justify-center gap-2">
                {totalDays}
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      <HelpCircle className="w-4 h-4 text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-colors" />
                    </button>
                  </DialogTrigger>
                  <DialogContent 
                    className="max-w-md border-0 p-0 bg-transparent"
                  >
                    <div className="backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-white/20 text-gray-900 dark:text-[#e1e7ef] bg-white dark:bg-[#0000008c]">
                      <DialogHeader className="mb-4">
                        <DialogTitle className="text-blue-600 dark:text-blue-400 text-lg font-medium">
                          ¿Por qué tengo {totalDays} días?
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 text-sm leading-relaxed text-gray-900 dark:text-white">
                        <p>
                          En España te corresponden <span className="font-semibold text-blue-600 dark:text-blue-400">{daysPerMonth} días</span> de 
                          ausencia por cada mes trabajado desde tu fecha de incorporación.
                        </p>
                        <p>
                          Empezaste el <span className="font-semibold text-green-600 dark:text-green-500">
                          {format(startDate, 'd MMMM yyyy', { locale: es })}</span> y has trabajado{' '}
                          <span className="font-semibold text-green-600 dark:text-green-500">{monthsWorked} meses</span>, lo que te da{' '}
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{calculatedBaseDays} días</span>.
                        </p>
                        {adjustment !== 0 && (
                          <p>
                            Además te hemos ajustado <span className="font-semibold text-orange-600 dark:text-orange-500">
                            {adjustment > 0 ? '+' : ''}{adjustment} días</span> de forma manual.
                          </p>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="text-xs text-gray-600 dark:text-white/60 uppercase tracking-wider">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light text-orange-400 mb-1">{usedDays}</div>
              <div className="text-xs text-gray-600 dark:text-white/60 uppercase tracking-wider">Aprobados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light text-green-400 mb-1">{availableDays}</div>
              <div className="text-xs text-gray-600 dark:text-white/60 uppercase tracking-wider">Disponibles</div>
            </div>
          </div>
          
          {/* Modern horizontal progress bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-white/70 font-medium">Progreso anual</span>
              <span className="text-sm text-gray-600 dark:text-white/70 font-medium">{usagePercentage.toFixed(1)}%</span>
            </div>
            
            {/* Modern thick progress bar */}
            <div className="relative">
              <div className="w-full bg-gray-200 dark:bg-white/10 rounded-2xl h-6 overflow-hidden shadow-inner">
                {/* Used days */}
                <div 
                  className="bg-blue-500 h-full rounded-2xl shadow-lg relative overflow-hidden"
                  style={{ 
                    '--final-width': `${Math.min(usagePercentage, 100)}%`,
                    animation: 'growWidth 1000ms ease-out 500ms both'
                  } as React.CSSProperties}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                </div>
              </div>
              
              {/* Subtle glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-blue-500/20 blur-sm -z-10"></div>
            </div>
            
            {/* Legend */}
            <div className="flex justify-between items-center text-xs text-gray-600 dark:text-white/60">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Aprobados</span>
                </div>
              </div>
              <span className="text-green-600 dark:text-green-500">{availableDays} días disponibles</span>
            </div>
          </div>
        </div>
      </div>
      {/* Request button */}
      <div className="px-6 mb-6">
        <Dialog open={isModalOpen} onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setSelectedStartDate(null);
            setSelectedEndDate(null);
            setReason('');
            setCalendarDate(new Date());
            setErrorMessage(null);
            setSelectedAbsenceType('vacation');
            setAttachmentFile(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold">
              <CalendarPlus className="mr-2 h-5 w-5" />
              Solicitar Ausencia
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl mt-4 max-h-[95vh] overflow-hidden flex flex-col shadow-xl">
            <DialogHeader className="pb-4 pt-2">
              <DialogTitle className="text-xl font-semibold text-center text-gray-900 dark:text-white">
                Solicitar Ausencia
              </DialogTitle>
              {selectedAbsenceType === 'vacation' && (
                <p className="text-sm text-gray-600 dark:text-white/70 text-center">
                  Tienes {availableDays} días disponibles
                </p>
              )}
              {selectedPolicy && selectedAbsenceType !== 'vacation' && (
                <p className="text-sm text-gray-600 dark:text-white/70 text-center">
                  {selectedPolicy.maxDays ? `${selectedPolicy.maxDays} días según convenio` : 'Sin límite de días'}
                </p>
              )}
              {errorMessage && (
                <div className="bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/30 rounded-lg p-3 mt-2">
                  <p className="text-red-700 dark:text-red-300 text-sm text-center font-medium">
                    {errorMessage}
                  </p>
                </div>
              )}
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto px-1 space-y-4">
              {/* Absence Type Selector */}
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-white/70 mb-2 block">
                  Tipo de Ausencia
                </Label>
                <Select 
                  value={selectedAbsenceType} 
                  onValueChange={(value) => {
                    setSelectedAbsenceType(value);
                    setSelectedStartDate(null);
                    setSelectedEndDate(null);
                    setAttachmentFile(null);
                    setErrorMessage(null);
                  }}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
                    <SelectValue placeholder="Selecciona el tipo de ausencia" />
                  </SelectTrigger>
                  <SelectContent 
                    className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 max-w-[calc(100vw-3rem)] max-h-[300px]"
                    position="popper"
                    side="bottom"
                    align="start"
                    sideOffset={4}
                  >
                    <SelectGroup>
                      <SelectLabel className="text-gray-500 dark:text-white/50">Vacaciones</SelectLabel>
                      <SelectItem value="vacation" className="text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <Plane className="w-4 h-4 flex-shrink-0 text-green-500" />
                          <span>Vacaciones</span>
                        </div>
                      </SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-gray-500 dark:text-white/50">Permisos retribuidos</SelectLabel>
                      {absencePolicies.filter(p => p.absenceType !== 'vacation' && p.absenceType !== 'temporary_disability' && p.isActive).map(policy => {
                        const IconComponent = ABSENCE_TYPE_ICONS[policy.absenceType] || Calendar;
                        return (
                          <SelectItem 
                            key={policy.absenceType} 
                            value={policy.absenceType}
                            className="text-gray-900 dark:text-white"
                          >
                            <div className="flex items-center gap-2">
                              <IconComponent className="w-4 h-4 flex-shrink-0 text-blue-500" />
                              <span>{policy.name}</span>
                              {policy.maxDays && (
                                <span className="text-xs text-gray-500 dark:text-white/50">
                                  ({policy.maxDays}d)
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-gray-500 dark:text-white/50">Baja médica</SelectLabel>
                      {absencePolicies.filter(p => p.absenceType === 'temporary_disability' && p.isActive).map(policy => {
                        const IconComponent = ABSENCE_TYPE_ICONS[policy.absenceType] || Calendar;
                        return (
                          <SelectItem 
                            key={policy.absenceType} 
                            value={policy.absenceType}
                            className="text-gray-900 dark:text-white"
                          >
                            <div className="flex items-center gap-2">
                              <IconComponent className="w-4 h-4 flex-shrink-0 text-red-500" />
                              <span>{policy.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Calendar */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToPreviousMonth}
                    disabled={calendarDate.getMonth() <= new Date().getMonth() && calendarDate.getFullYear() <= new Date().getFullYear()}
                    className="h-8 w-8 p-0 text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {format(calendarDate, 'MMMM yyyy', { locale: es })}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNextMonth}
                    className="h-8 w-8 p-0 text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Days of week header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                    <div key={day} className="text-xs text-gray-600 dark:text-white/60 text-center py-2 font-medium">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar days - Fixed height container */}
                <div className="grid grid-cols-7 gap-1 min-h-[192px]">
                  {generateCalendarDays().map((date, index) => {
                    if (!date) {
                      return <div key={`empty-${index}`} className="w-8 h-8"></div>;
                    }
                    
                    const isInRange = isDateInRange(date);
                    const isStart = isDateStart(date);
                    const isEnd = isDateEnd(date);
                    const isToday = isSameDay(date, new Date());
                    
                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => handleDateClick(date)}
                        onMouseEnter={() => selectedStartDate && !selectedEndDate && setHoverDate(date)}
                        onMouseLeave={() => setHoverDate(null)}
                        className={`
                          w-8 h-8 text-xs rounded-lg transition-all duration-200 relative
                          ${isInRange 
                            ? (isStart || isEnd)
                              ? 'bg-blue-500 text-white font-semibold'
                              : 'bg-blue-100 dark:bg-blue-500/30 text-blue-700 dark:text-blue-200'
                            : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                          }
                          ${isToday && !isInRange ? 'ring-1 ring-blue-400' : ''}
                        `}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Selected range info */}
              <div className={`
                text-sm p-3 rounded-lg text-center font-medium
                ${selectedStartDate && selectedEndDate && selectedAbsenceType === 'vacation' && exceedsAvailable 
                  ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/30' 
                  : selectedStartDate && !selectedEndDate
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                    : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30'
                }
              `}>
                {selectedStartDate && selectedEndDate ? (
                  <>
                    {isSameDay(selectedStartDate, selectedEndDate) 
                      ? format(selectedStartDate, 'd MMM', { locale: es })
                      : `${format(selectedStartDate, 'd MMM', { locale: es })} - ${format(selectedEndDate, 'd MMM', { locale: es })}`
                    }
                    {selectedAbsenceType === 'vacation' && (
                      <>
                        <br />
                        {exceedsAvailable 
                          ? `Ojalá pudiéramos darte más… pero ahora mismo solo tienes ${availableDays} días.`
                          : `${canRequestDays} día${canRequestDays > 1 ? 's' : ''} solicitado${canRequestDays > 1 ? 's' : ''}`
                        }
                      </>
                    )}
                  </>
                ) : selectedStartDate ? (
                  <>
                    {format(selectedStartDate, 'd MMM', { locale: es })} → Selecciona día final o el mismo
                  </>
                ) : (
                  'Selecciona fecha de inicio'
                )}
              </div>
              
              {/* Compact Vacation Summary */}
              {selectedAbsenceType === 'vacation' && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {isInitialLoading ? (
                    Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="text-center animate-pulse">
                        <div className="mx-auto h-6 w-16 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
                        <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700 mx-auto" />
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="text-center">
                        <div className="text-2xl font-light text-blue-400 mb-1 flex items-center justify-center gap-2">
                          {totalDays}
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                <HelpCircle className="w-4 h-4 text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-colors" />
                              </button>
                            </DialogTrigger>
                            <DialogContent 
                              className="max-w-md border-0 p-0 bg-transparent"
                            >
                              <div className="backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-white/20 text-gray-900 dark:text-[#e1e7ef] bg-white dark:bg-[#0000008c]">
                                <DialogHeader className="mb-4">
                                  <DialogTitle className="text-blue-600 dark:text-blue-400 text-lg font-medium">
                                    ¿Por qué tengo {totalDays} días?
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 text-sm leading-relaxed text-gray-900 dark:text-white">
                                  <p>
                                    En España te corresponden <span className="font-semibold text-blue-600 dark:text-blue-400">{daysPerMonth} días</span> de 
                                    ausencia por cada mes trabajado desde tu fecha de incorporación.
                                  </p>
                                  <p>
                                    Con la fecha de inicio que tenemos registrada, tu saldo acumulado es de <span className="font-semibold text-blue-600 dark:text-blue-400">{totalDays} días</span>.
                                  </p>
                                  <p>
                                    Cada mes, este balance se actualiza automáticamente.
                                  </p>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Días disponibles</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-light text-emerald-400 mb-1">{availableDays}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Días restantes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-light text-amber-400 mb-1">{usedDays}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Días disfrutados</div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Description field */}
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-white/70 mb-2 block">
                  Descripción {selectedAbsenceType === 'deber_publico' ? '(obligatorio)' : '(opcional)'}
                </Label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Añade detalles sobre tu solicitud..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm resize-none"
                  rows={3}
                />
              </div>

              {/* Attachment Upload */}
              {requiresAttachment && (
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-white/70 mb-2 block">
                    Adjunto (obligatorio)
                  </Label>
                  <div>
                    <input
                      type="file"
                      id="attachment-upload"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 10 * 1024 * 1024) {
                            toast({
                              title: "Archivo demasiado grande",
                              description: "El archivo no puede superar los 10MB",
                              variant: "destructive"
                            });
                            return;
                          }
                          setAttachmentFile(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="attachment-upload"
                      className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {attachmentFile ? (
                        <>
                          <Paperclip className="w-5 h-5 text-blue-500" />
                          <span className="text-sm truncate max-w-[200px]">{attachmentFile.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setAttachmentFile(null);
                            }}
                            className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full transition-colors"
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span className="text-sm">Subir archivo</span>
                        </>
                      )}
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
                    PDF, imágenes o documentos (máx. 10MB)
                  </p>
                </div>
              )}
            </div>
            
            {/* Action buttons - Fixed at bottom */}
            <div className="flex space-x-4 pt-4 px-1 border-t border-gray-200 dark:border-white/20 mt-4">
              <Button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-xl h-12"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createRequestMutation.isPending || 
                  uploadingAttachment ||
                  !selectedStartDate || 
                  !selectedEndDate || 
                  (selectedAbsenceType === 'vacation' && exceedsAvailable) ||
                  (requiresAttachment && !attachmentFile) ||
                  (selectedAbsenceType === 'deber_publico' && !reason.trim())
                }
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl h-12 disabled:opacity-50"
              >
                {uploadingAttachment 
                  ? 'Subiendo archivo...' 
                  : createRequestMutation.isPending 
                    ? 'Solicitando...' 
                    : 'Solicitar'
                }
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {/* Requests list - Apple style cards */}
      <div className="px-6 mb-6 flex-1 space-y-2">
        {Array.isArray(requests) && requests.length > 0 ? (
          requests
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map(request => {
              const absenceType = request.absenceType || 'vacation';
              const AbsenceIcon = ABSENCE_TYPE_ICONS[absenceType] || Calendar;
              const days = calculateDays(request.startDate, request.endDate);
              const startDate = parseISO(request.startDate);
              const endDate = parseISO(request.endDate);
              const isSingleDay = isSameDay(startDate, endDate);
              
              const statusColors: Record<string, { bg: string, icon: string, text: string }> = {
                pending: { bg: 'bg-amber-50 dark:bg-amber-500/10', icon: 'text-amber-500', text: 'Pendiente' },
                approved: { bg: 'bg-green-50 dark:bg-green-500/10', icon: 'text-green-500', text: 'Aprobado' },
                denied: { bg: 'bg-red-50 dark:bg-red-500/10', icon: 'text-red-500', text: 'Rechazado' },
              };
              const statusStyle = statusColors[request.status] || statusColors.pending;
              
              return (
                <div 
                  key={request.id} 
                  className="bg-white dark:bg-white/5 rounded-xl overflow-hidden border border-gray-100 dark:border-white/10 hover:shadow-sm transition-shadow flex"
                >
                  {/* Main content */}
                  <div className="flex-1 p-3 flex items-center gap-3 overflow-hidden">
                    {/* Icon with colored background */}
                    <div className={`
                      w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                      ${absenceType === 'vacation' 
                        ? 'bg-green-100 dark:bg-green-500/20' 
                        : 'bg-blue-100 dark:bg-blue-500/20'
                      }
                    `}>
                      <AbsenceIcon className={`w-4 h-4 ${absenceType === 'vacation' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate block max-w-full">
                        {ABSENCE_TYPE_LABELS[absenceType] || 'Vacaciones'}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 dark:text-white/60">
                          {isSingleDay 
                            ? format(startDate, "d 'de' MMMM", { locale: es })
                            : `${format(startDate, "d MMM", { locale: es })} → ${format(endDate, "d MMM", { locale: es })}`
                          }
                        </span>
                        <span className="text-xs text-gray-400 dark:text-white/40">•</span>
                        <span className="text-xs font-medium text-gray-600 dark:text-white/70">
                          {days} día{Number(days) > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    
                    {/* Comment bubble - shows if admin replied */}
                    {request.status !== 'pending' && request.adminComment && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/20 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-colors flex-shrink-0">
                            <MessageCircle className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 max-w-[80vw] p-3 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" side="top" sideOffset={5} align="end" avoidCollisions={true}>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Respuesta</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">
                              {request.adminComment}
                            </p>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  
                  {/* Status indicator - colored right side */}
                  <div className={`${statusStyle.bg} w-14 flex flex-col items-center justify-center py-2`}>
                    <div className={statusStyle.icon}>
                      {getStatusIcon(request.status)}
                    </div>
                    <span className={`text-[10px] mt-0.5 font-medium ${statusStyle.icon}`}>{statusStyle.text}</span>
                  </div>
                </div>
              );
            })
        ) : (
          <div className="flex items-center justify-center py-16">
            <div className="text-center text-gray-500 dark:text-white/60">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-white/10 rounded-2xl flex items-center justify-center">
                <CalendarDays className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium">Sin solicitudes</p>
              <p className="text-sm mt-1 opacity-70">Solicita tu primera ausencia</p>
            </div>
          </div>
        )}
      </div>
      {/* Copyright at bottom */}
      <div className="text-center pb-4 mt-auto">
        <div className="flex items-center justify-center space-x-1 text-gray-600 dark:text-white/60 text-xs">
          <span className="font-semibold text-blue-600 dark:text-blue-400">Oficaz</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}
