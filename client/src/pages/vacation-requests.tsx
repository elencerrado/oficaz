import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PageLoading } from '@/components/ui/page-loading';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, CalendarPlus, Calendar, Check, X, Clock, CalendarDays, ChevronLeft, ChevronRight, HelpCircle, MessageCircle } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation, Link } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addDays, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

export default function VacationRequests() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const { user, company } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const urlParts = location.split('/').filter(part => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/vacation-requests'],
    enabled: !!user,
    staleTime: 30000,
  });



  const createRequestMutation = useMutation({
    mutationFn: (data: { startDate: string; endDate: string; reason?: string }) =>
      apiRequest('POST', '/api/vacation-requests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      setIsModalOpen(false);
      setSelectedStartDate(null);
      setSelectedEndDate(null);
      setReason('');
      toast({
        title: '¡Solicitud enviada!',
        description: 'Tu solicitud de vacaciones ha sido enviada correctamente.',
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
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'approved':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'denied':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
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

  const calculateDays = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return differenceInDays(end, start) + 1;
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'd MMM', { locale: es });
  };

  const formatDateRange = (start: string, end: string) => {
    const startFormatted = format(parseISO(start), 'd MMM', { locale: es });
    const endFormatted = format(parseISO(end), 'd MMM yyyy', { locale: es });
    return `${startFormatted} - ${endFormatted}`;
  };

  // Calculate vacation days
  const totalDays = parseFloat(user?.totalVacationDays || '22');
  
  // Días usados = todas las vacaciones aprobadas (pasadas, actuales y futuras)
  const usedDays = (requests as any[])
    .filter((r: any) => r.status === 'approved')
    .reduce((sum: number, r: any) => sum + calculateDays(r.startDate, r.endDate), 0);
  
  // Días disponibles = total - usados
  const availableDays = Math.max(0, totalDays - usedDays);
  
  // Solo para mostrar en la leyenda (no afecta cálculos)
  const pendingDays = (requests as any[])
    .filter((r: any) => r.status === 'pending')
    .reduce((sum: number, r: any) => sum + calculateDays(r.startDate, r.endDate), 0);
  const usagePercentage = totalDays > 0 ? (usedDays / totalDays) * 100 : 0;

  // Create vacation explanation message
  const daysPerMonth = parseFloat(user?.vacationDaysPerMonth || '2.5');
  const adjustment = parseFloat(user?.vacationDaysAdjustment || '0');
  const startDate = user?.startDate ? new Date(user.startDate) : new Date();
  const currentDate = new Date();
  
  // Calculate months more accurately
  let monthsWorked = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                     (currentDate.getMonth() - startDate.getMonth());
  
  // Add partial month if current day >= start day
  if (currentDate.getDate() >= startDate.getDate()) {
    monthsWorked += 1;
  }
  
  // Ensure minimum of 1 month
  monthsWorked = Math.max(1, monthsWorked);
  
  const calculatedBaseDays = Math.round(monthsWorked * daysPerMonth * 10) / 10;

  const canRequestDays = selectedStartDate && selectedEndDate ? 
    differenceInDays(selectedEndDate, selectedStartDate) + 1 : 0;
  const exceedsAvailable = canRequestDays > availableDays;

  // Calendar logic
  const handleDateClick = (date: Date) => {
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Starting new selection
      setSelectedStartDate(date);
      setSelectedEndDate(null);
    } else if (date < selectedStartDate) {
      // Clicked before start date, make it the new start
      setSelectedStartDate(date);
    } else {
      // Set end date and check if range is valid
      const daysBetween = differenceInDays(date, selectedStartDate) + 1;
      if (daysBetween <= availableDays) {
        setSelectedEndDate(date);
      } else {
        toast({
          description: `Ojalá pudiéramos darte más… pero ahora mismo solo tienes ${availableDays} días.`,
          variant: 'destructive',
        });
      }
    }
  };

  const handleSubmit = () => {
    if (!selectedStartDate || !selectedEndDate) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona las fechas de inicio y fin',
        variant: 'destructive',
      });
      return;
    }

    if (exceedsAvailable) {
      toast({
        description: `Ojalá pudiéramos darte más… pero ahora mismo solo tienes ${availableDays} días.`,
        variant: 'destructive',
      });
      return;
    }

    createRequestMutation.mutate({
      startDate: selectedStartDate.toISOString(),
      endDate: selectedEndDate.toISOString(),
      reason: reason || undefined,
    });
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

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  // Generate calendar days for selected month
  const generateCalendarDays = () => {
    const today = new Date();
    const currentMonth = calendarDate.getMonth();
    const currentYear = calendarDate.getFullYear();
    
    // Get first day of month and its day of week (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDay = (firstDayOfMonth.getDay() + 6) % 7; // Convert to Monday = 0
    
    // Get days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      // Only show dates from today onwards if it's the current month, otherwise show all dates
      const isCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear();
      if (!isCurrentMonth || date >= startOfDay(today)) {
        days.push(date);
      } else {
        days.push(null);
      }
    }
    
    return days;
  };

  // Show loading state
  if (isLoading) {
    return <PageLoading />;
  }

  return (
    <div 
      className="min-h-screen text-white"
      style={{
        background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)',
        overscrollBehavior: 'none'
      }}
    >
      {/* Header - Fixed height */}
      <div className="flex items-center justify-between p-6 pb-8 h-20">
        <Link href={`/${companyAlias}/inicio`}>
          <Button
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/20 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm transition-all duration-200 transform hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex-1 flex flex-col items-end text-right">
          {company?.logoUrl ? (
            <img 
              src={company.logoUrl} 
              alt={company.name} 
              className="w-8 h-8 mb-1 rounded-full object-cover"
            />
          ) : (
            <div className="text-white text-sm font-medium mb-1">
              {company?.name || 'Mi Empresa'}
            </div>
          )}
          <div className="text-white/70 text-xs">
            {user?.fullName}
          </div>
        </div>
      </div>

      {/* Modern Title - Fixed height */}
      <div className="text-center mb-8 h-12 flex items-center justify-center">
        <h1 className="text-2xl font-light text-white/90 tracking-wide">Vacaciones</h1>
      </div>

      {/* Compact Vacation Summary */}
      <div className="px-6 mb-6">
        <div className="bg-white/8 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-light text-blue-300 mb-1 flex items-center justify-center gap-2">
                {totalDays}
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="p-1 rounded-full hover:bg-white/10 transition-colors">
                      <HelpCircle className="w-4 h-4 text-white/40 hover:text-white/70 transition-colors" />
                    </button>
                  </DialogTrigger>
                  <DialogContent 
                    className="max-w-md border-0 p-0 bg-transparent"
                    style={{ backgroundColor: 'rgba(50, 58, 70, 0.95)' }}
                  >
                    <div className="bg-white/8 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
                      <DialogHeader className="mb-4">
                        <DialogTitle className="text-blue-300 text-lg font-medium">
                          ¿Por qué tengo {totalDays} días?
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 text-sm leading-relaxed text-white/90">
                        <p>
                          En España te corresponden <span className="font-semibold text-blue-300">{daysPerMonth} días</span> de 
                          vacaciones por cada mes trabajado desde tu fecha de incorporación.
                        </p>
                        <p>
                          Empezaste el <span className="font-semibold text-emerald-300">
                          {format(startDate, 'd MMMM yyyy', { locale: es })}</span> y has trabajado{' '}
                          <span className="font-semibold text-emerald-300">{monthsWorked} meses</span>, lo que te da{' '}
                          <span className="font-semibold text-blue-300">{calculatedBaseDays} días</span>.
                        </p>
                        {adjustment !== 0 && (
                          <p>
                            Además te hemos ajustado <span className="font-semibold text-orange-300">
                            {adjustment > 0 ? '+' : ''}{adjustment} días</span> de forma manual.
                          </p>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="text-xs text-white/60 uppercase tracking-wider">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light text-orange-300 mb-1">{usedDays}</div>
              <div className="text-xs text-white/60 uppercase tracking-wider">Aprobados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light text-emerald-300 mb-1">{availableDays}</div>
              <div className="text-xs text-white/60 uppercase tracking-wider">Disponibles</div>
            </div>
          </div>
          
          {/* Modern horizontal progress bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/70 font-medium">Progreso anual</span>
              <span className="text-sm text-white/70 font-medium">{usagePercentage.toFixed(1)}%</span>
            </div>
            
            {/* Modern thick progress bar */}
            <div className="relative">
              <div className="w-full bg-white/10 rounded-2xl h-6 overflow-hidden shadow-inner">
                {/* Used days */}
                <div 
                  className="bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 h-full rounded-2xl shadow-lg relative overflow-hidden"
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
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400/20 to-blue-600/20 blur-sm -z-10"></div>
            </div>
            
            {/* Legend */}
            <div className="flex justify-between items-center text-xs text-white/50">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Aprobados</span>
                </div>
              </div>
              <span className="text-white/40">{availableDays} días disponibles</span>
            </div>
          </div>
        </div>
      </div>

      {/* Request button */}
      <div className="px-6 mb-6">
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold">
              <CalendarPlus className="mr-2 h-5 w-5" />
              Solicitar Vacaciones
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md mx-auto bg-gray-800 border border-gray-600 text-white rounded-2xl mt-4 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4 pt-2">
              <DialogTitle className="text-xl font-semibold text-center text-white">
                Solicitar Vacaciones
              </DialogTitle>
              <p className="text-sm text-gray-300 text-center">
                Tienes {availableDays} días disponibles
              </p>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Calendar */}
              <div className="bg-gray-700 rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToPreviousMonth}
                    className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-gray-600"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="text-sm font-medium text-white capitalize">
                    {format(calendarDate, 'MMMM yyyy', { locale: es })}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNextMonth}
                    className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-gray-600"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Days of week header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                    <div key={day} className="text-xs text-gray-300 text-center py-2 font-medium">
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
                              : 'bg-blue-500/30 text-blue-200'
                            : 'text-gray-100 hover:bg-gray-600'
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
              {canRequestDays > 0 && (
                <div className={`
                  text-sm p-3 rounded-lg text-center font-medium
                  ${exceedsAvailable 
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }
                `}>
                  {selectedStartDate && selectedEndDate ? (
                    <>
                      {format(selectedStartDate, 'd MMM', { locale: es })} - {format(selectedEndDate, 'd MMM', { locale: es })}
                      <br />
                      {exceedsAvailable 
                        ? `Ojalá pudiéramos darte más… pero ahora mismo solo tienes ${availableDays} días.`
                        : `${canRequestDays} días solicitados`
                      }
                    </>
                  ) : (
                    'Selecciona fecha de inicio y fin'
                  )}
                </div>
              )}
              
              {/* Reason textarea */}
              <div>
                <Label className="text-sm font-medium text-gray-300 mb-2 block">
                  Motivo (opcional)
                </Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe el motivo de tu solicitud..."
                  className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 rounded-lg resize-none"
                  rows={3}
                />
              </div>
              
              {/* Action buttons */}
              <div className="flex space-x-4 pt-2">
                <Button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-xl h-12"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createRequestMutation.isPending || !selectedStartDate || !selectedEndDate || exceedsAvailable}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl h-12 disabled:opacity-50"
                >
                  {createRequestMutation.isPending ? 'Solicitando...' : 'Solicitar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Requests table */}
      <div className="px-6 mb-6 flex-1">
        <div className="bg-white/5 rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(50, 58, 70, 0.8)' }}>
          {/* Table Header */}
          <div className="grid grid-cols-4 bg-white/10 py-3 px-4">
            <div className="text-sm font-semibold text-center">Período</div>
            <div className="text-sm font-semibold text-center">Días</div>
            <div className="text-sm font-semibold text-left pl-4">Estado</div>
            <div className="text-sm font-semibold text-center">Fecha</div>
          </div>

          {/* Table Body */}
          <div className="overflow-y-auto scrollbar-thin" style={{ 
            maxHeight: 'calc(100vh - 400px)', 
            minHeight: '300px',
            backgroundColor: 'rgba(50, 58, 70, 0.6)',
            overscrollBehavior: 'contain'
          }}>
            {(requests as any[]).length > 0 ? (
              (requests as any[])
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((request: any) => (
                  <div key={request.id} className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr] py-3 px-4 border-b border-white/10 hover:bg-white/5 items-center min-h-[48px]">
                    <div className="text-sm text-center text-white/90 flex items-center justify-center">
                      {formatDateRange(request.startDate, request.endDate)}
                    </div>
                    <div className="text-sm text-center font-mono text-white/90 flex items-center justify-center">
                      {calculateDays(request.startDate, request.endDate)}
                    </div>
                    <div className="flex justify-start items-center pl-2 pr-1 overflow-hidden">
                      {request.status !== 'pending' && request.adminComment ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="flex items-center gap-1 cursor-pointer">
                              <Badge className={`${getStatusColor(request.status)} hover:opacity-80 flex-shrink-0 px-1.5 py-1 flex items-center gap-1`}>
                                {getStatusIcon(request.status)}
                                <span className="hidden sm:inline text-xs">{getStatusText(request.status)}</span>
                              </Badge>
                              <MessageCircle className="w-3 h-3 text-white/40 flex-shrink-0" />
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 max-w-[80vw] p-3" side="top" sideOffset={5} align="start" avoidCollisions={true}>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-700">Comentario del administrador</span>
                              </div>
                              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                {request.adminComment}
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Badge className={`${getStatusColor(request.status)} px-1.5 py-1 flex items-center gap-1`}>
                          {getStatusIcon(request.status)}
                          <span className="hidden sm:inline text-xs">{getStatusText(request.status)}</span>
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-center text-white/70 flex items-center justify-center">
                      {formatDate(request.createdAt)}
                    </div>
                  </div>
                ))
            ) : (
              <div className="flex items-center justify-center h-full min-h-48">
                <div className="text-center text-white/60">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No tienes solicitudes de vacaciones</p>
                  <p className="text-sm mt-1">Solicita tus primeras vacaciones</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Copyright at bottom */}
      <div className="text-center pb-4 mt-auto">
        <div className="flex items-center justify-center space-x-1 text-gray-400 text-xs">
          <span className="font-semibold text-blue-400">Oficaz</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}
