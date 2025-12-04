import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { useWorkAlarms } from '@/hooks/use-work-alarms';
import { usePageTitle } from '@/hooks/use-page-title';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { Clock, User, FileText, Calendar, Bell, MessageSquare, LogOut, Palmtree, Building2, MapPin, CreditCard, AlarmClock, CalendarDays, Sun, Moon, Monitor, ClipboardList, X, PenTool, RotateCcw, CheckCircle, Shield } from 'lucide-react';
import { useEmployeeViewMode } from '@/hooks/use-employee-view-mode';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/lib/theme-provider';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useEffect, useState, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { DatePickerDay } from '@/components/ui/date-picker';

interface WorkSession {
  id: number;
  userId: number;
  clockIn: string;
  clockOut?: string;
  totalHours?: string;
  createdAt: string;
}

// Función para traducir roles al español
const translateRole = (role: string | undefined) => {
  if (!role) return 'Empleado';
  switch (role.toLowerCase()) {
    case 'admin':
    case 'administrator':
      return 'Administrador';
    case 'manager':
      return 'Manager';
    case 'employee':
      return 'Empleado';
    default:
      return 'Empleado';
  }
};

export default function EmployeeDashboard() {
  usePageTitle('Panel de Empleado');
  const { user, logout, company, subscription } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { isEmployeeViewMode, disableEmployeeView } = useEmployeeViewMode();
  useWorkAlarms(); // Initialize PWA push notifications
  
  // Lógica inteligente: mostrar logo solo si tiene logo Y función habilitada
  const shouldShowLogo = company?.logoUrl && hasAccess('logoUpload');
  const [hasVacationUpdates, setHasVacationUpdates] = useState(false);
  const [lastVacationCheck, setLastVacationCheck] = useState<any[]>([]);
  
  // Estado para mensajes temporales en el cajón de fichaje
  const [temporaryMessage, setTemporaryMessage] = useState<string | null>(null);
  
  // Estado para el modal de alarmas
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
  
  // Estado para el modal de parte de obra al fichar salida
  const [showWorkReportModal, setShowWorkReportModal] = useState(false);
  const [completedSessionData, setCompletedSessionData] = useState<{ clockIn: string; clockOut: string } | null>(null);
  const [workReportForm, setWorkReportForm] = useState({
    reportDate: format(new Date(), 'yyyy-MM-dd'),
    refCode: '',
    location: '',
    description: '',
    clientName: '',
    notes: '',
    startTime: '',
    endTime: '',
    signedBy: ''
  });

  // Estado para la firma del cliente
  const [isClientSignatureModalOpen, setIsClientSignatureModalOpen] = useState(false);
  const [clientSignatureData, setClientSignatureData] = useState<string>('');
  const [clientSignedBy, setClientSignedBy] = useState('');
  const [isClientDrawing, setIsClientDrawing] = useState(false);
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastClientPointRef = useRef<{ x: number; y: number } | null>(null);

  // Estados para mostrar sugerencias
  const [showRefCodeSuggestions, setShowRefCodeSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // Estado para el carrusel de iconos estilo iPhone
  const [menuPage, setMenuPage] = useState(0);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Estado para intercambio de iconos con long press
  const [longPressItem, setLongPressItem] = useState<number | null>(null);
  const [showSwapMenu, setShowSwapMenu] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [customMenuOrder, setCustomMenuOrder] = useState<number[]>(() => {
    const saved = localStorage.getItem('menuIconOrder');
    return saved ? JSON.parse(saved) : [];
  });

  // Queries para autocompletado de partes de obra anteriores
  const { data: refCodeSuggestions } = useQuery<string[]>({
    queryKey: ['/api/work-reports/ref-codes'],
    enabled: showWorkReportModal,
    staleTime: 5 * 60 * 1000,
  });

  const { data: locationSuggestions } = useQuery<string[]>({
    queryKey: ['/api/work-reports/locations'],
    enabled: showWorkReportModal,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clientSuggestions } = useQuery<string[]>({
    queryKey: ['/api/work-reports/clients'],
    enabled: showWorkReportModal,
    staleTime: 5 * 60 * 1000,
  });

  // Sugerencias filtradas
  const filteredRefCodeSuggestions = useMemo(() => {
    const suggestions = refCodeSuggestions || [];
    if (!workReportForm.refCode) return suggestions.slice(0, 5);
    return suggestions
      .filter(code => code.toLowerCase().includes(workReportForm.refCode.toLowerCase()))
      .slice(0, 5);
  }, [workReportForm.refCode, refCodeSuggestions]);

  const filteredLocationSuggestions = useMemo(() => {
    const suggestions = locationSuggestions || [];
    if (!workReportForm.location) return suggestions.slice(0, 5);
    return suggestions
      .filter(loc => loc.toLowerCase().includes(workReportForm.location.toLowerCase()))
      .slice(0, 5);
  }, [workReportForm.location, locationSuggestions]);

  const filteredClientSuggestions = useMemo(() => {
    const suggestions = clientSuggestions || [];
    if (!workReportForm.clientName) return suggestions.slice(0, 5);
    return suggestions
      .filter(client => client.toLowerCase().includes(workReportForm.clientName.toLowerCase()))
      .slice(0, 5);
  }, [workReportForm.clientName, clientSuggestions]);

  // Funciones para firma del cliente
  const initClientCanvas = () => {
    const canvas = clientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    lastClientPointRef.current = null;
  };

  const clearClientCanvas = () => {
    const canvas = clientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastClientPointRef.current = null;
  };

  const getClientCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startClientDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = clientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsClientDrawing(true);
    const { x, y } = getClientCoordinates(e, canvas);
    lastClientPointRef.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawClient = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isClientDrawing) return;
    e.preventDefault();
    const canvas = clientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getClientCoordinates(e, canvas);
    
    if (lastClientPointRef.current) {
      const midX = (lastClientPointRef.current.x + x) / 2;
      const midY = (lastClientPointRef.current.y + y) / 2;
      ctx.quadraticCurveTo(lastClientPointRef.current.x, lastClientPointRef.current.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
    }
    
    lastClientPointRef.current = { x, y };
  };

  const stopClientDrawing = () => {
    if (isClientDrawing && lastClientPointRef.current) {
      const canvas = clientCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineTo(lastClientPointRef.current.x, lastClientPointRef.current.y);
          ctx.stroke();
        }
      }
    }
    setIsClientDrawing(false);
    lastClientPointRef.current = null;
  };

  const saveClientSignature = () => {
    const canvas = clientCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setClientSignatureData(dataUrl);
      setWorkReportForm(prev => ({ ...prev, signedBy: clientSignedBy }));
    }
    setIsClientSignatureModalOpen(false);
  };

  const openClientSignatureModal = () => {
    setIsClientSignatureModalOpen(true);
  };

  useEffect(() => {
    if (isClientSignatureModalOpen) {
      setTimeout(initClientCanvas, 100);
    }
  }, [isClientSignatureModalOpen]);

  // Función para generar mensajes dinámicos según la hora
  const generateDynamicMessage = (actionType: 'entrada' | 'salida') => {
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour >= 6 && hour < 14) {
      greeting = 'Buenos días';
    } else if (hour >= 14 && hour < 20) {
      greeting = 'Buenas tardes';
    } else {
      greeting = 'Buenas noches';
    }
    
    const action = actionType === 'entrada' ? 'Entrada registrada' : 'Salida registrada';
    return `${greeting}, ${action}.`;
  };

  // Función para mostrar mensaje temporal
  const showTemporaryMessage = (message: string) => {
    setTemporaryMessage(message);
    setTimeout(() => {
      setTemporaryMessage(null);
    }, 3000); // Mensaje visible por 3 segundos
  };

  // Data fetching with real-time updates
  const { data: activeSession } = useQuery<WorkSession>({
    queryKey: ['/api/work-sessions/active'],
    enabled: !!user,
    staleTime: 10 * 1000, // 10 seconds for real-time updates
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
    retryDelay: 500,
    refetchInterval: 45 * 1000, // ⚡ Optimizado: poll cada 45 segundos 
    refetchIntervalInBackground: false, // Stop background polling
  });

  // Query for active break period
  const { data: activeBreak } = useQuery({
    queryKey: ['/api/break-periods/active'],
    enabled: !!user && !!activeSession,
    refetchInterval: activeSession ? 60 * 1000 : false, // ⚡ Optimizado: solo cada minuto cuando hay sesión
    refetchIntervalInBackground: false,
    staleTime: 10 * 1000,
  });

  // Query for company work hours settings
  const { data: companySettings } = useQuery({
    queryKey: ['/api/settings/work-hours'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  // Get unread messages count with real-time updates
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread-count'],
    enabled: !!user,
    refetchInterval: 2 * 60 * 1000, // ⚡ Optimizado: mensajes cada 2 minutos
    refetchIntervalInBackground: false,
    staleTime: 90 * 1000, // ⚡ Optimizado: cache mensajes por 90 segundos
  });


  // Get document notifications with reduced frequency
  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // ⚡ Optimizado: documentos cada 5 minutos
    refetchIntervalInBackground: false,
    staleTime: 4 * 60 * 1000, // ⚡ Optimizado: cache documentos por 4 minutos
  });

  // Get real document notifications from database with reduced frequency
  const { data: documentNotifications } = useQuery({
    queryKey: ['/api/document-notifications'],
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // ⚡ Optimizado: notificaciones cada 5 minutos
    refetchIntervalInBackground: false,
    staleTime: 4 * 60 * 1000, // ⚡ Optimizado: cache notificaciones por 4 minutos
  });

  // Get vacation requests with reduced frequency
  const { data: vacationRequests = [] } = useQuery({
    queryKey: ['/api/vacation-requests'],
    enabled: !!user,
    refetchInterval: 10 * 60 * 1000, // ⚡ Optimizado: vacaciones cada 10 minutos
    refetchIntervalInBackground: false,
    staleTime: 8 * 60 * 1000, // ⚡ Optimizado: cache vacaciones por 8 minutos
  });

  // Get all reminders to check for overdue ones
  const { data: allReminders = [] } = useQuery({
    queryKey: ['/api/reminders'],
    enabled: !!user,
    refetchInterval: 10 * 60 * 1000, // ⚡ Optimizado: reminders cada 10 minutos
    refetchIntervalInBackground: false,
    staleTime: 8 * 60 * 1000, // ⚡ Optimizado: cache reminders por 8 minutos
  });

  // Check for vacation updates - clear notification when back on dashboard
  useEffect(() => {
    if (!vacationRequests?.length) return;
    
    const lastCheckTime = localStorage.getItem('lastVacationCheck');
    const lastCheckDate = lastCheckTime ? new Date(lastCheckTime) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find processed requests (approved/denied) that were reviewed after last check
    const newlyProcessedRequests = vacationRequests.filter((request: any) => {
      if (request.status === 'pending') return false;
      
      const reviewDate = request.reviewedAt ? new Date(request.reviewedAt) : new Date(request.createdAt);
      const isNew = reviewDate > lastCheckDate;
      
      console.log('Dashboard vacation check:', {
        id: request.id,
        status: request.status,
        reviewedAt: request.reviewedAt,
        reviewDate: reviewDate.toISOString(),
        lastCheck: lastCheckDate.toISOString(),
        isNew,
        currentTime: new Date().toISOString()
      });
      
      return isNew;
    });
    
    const hasUpdates = newlyProcessedRequests.length > 0;
    setHasVacationUpdates(hasUpdates);
    
    // Determine notification type based on latest status
    if (hasUpdates) {
      const hasApproved = newlyProcessedRequests.some((req: any) => req.status === 'approved');
      const hasRejected = newlyProcessedRequests.some((req: any) => req.status === 'denied');
      
      // Priority: red for rejected, green for approved
      if (hasRejected) {
        localStorage.setItem('vacationNotificationType', 'red');
      } else if (hasApproved) {
        localStorage.setItem('vacationNotificationType', 'green');
      }
    }
    
    if (hasUpdates) {
      console.log('Dashboard setting vacation notification flag for', newlyProcessedRequests.length, 'requests');
      localStorage.setItem('hasVacationUpdates', 'true');
    } else {
      setHasVacationUpdates(false);
    }
  }, [vacationRequests]);

  // Clear vacation notifications when returning to dashboard
  useEffect(() => {
    if (hasVacationUpdates) {
      const timer = setTimeout(() => {
        console.log('Dashboard: clearing vacation notifications after viewing dashboard');
        setHasVacationUpdates(false);
        localStorage.setItem('lastVacationCheck', new Date().toISOString());
        localStorage.removeItem('vacationNotificationType');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [hasVacationUpdates]);

  // Check for document notifications with intelligent state tracking
  const [hasDocumentRequests, setHasDocumentRequests] = useState(false); // RED: solicitudes pendientes
  const [hasNewDocuments, setHasNewDocuments] = useState(false); // GREEN: archivos nuevos

  // Check for overdue reminders 
  const [hasOverdueReminders, setHasOverdueReminders] = useState(false); // RED: recordatorios vencidos

  // Check for new messages
  const [hasNewMessages, setHasNewMessages] = useState(false); // GREEN: mensajes nuevos sin leer

  // Check for active reminders (not completed, not archived)
  const [hasActiveReminders, setHasActiveReminders] = useState(false); // BLUE: recordatorios activos

  // Clear document notifications when returning to dashboard (after visiting documents page)
  useEffect(() => {
    const lastDocumentPageVisit = localStorage.getItem('lastDocumentPageVisit');
    if (lastDocumentPageVisit && hasNewDocuments) {
      const timer = setTimeout(() => {
        console.log('Dashboard: clearing non-payroll document notifications after visiting documents');
        // This will trigger a re-evaluation of document notifications
        // Non-payroll documents will be filtered out in the next useEffect cycle
        setHasNewDocuments(false);
        localStorage.setItem('lastDocumentCheck', new Date().toISOString());
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [hasNewDocuments]);

  // Check if user is currently on vacation
  const today = new Date().toISOString().split('T')[0];
  const isOnVacation = vacationRequests.some((request: any) => 
    request.status === 'approved' &&
    request.startDate.split('T')[0] <= today &&
    request.endDate.split('T')[0] >= today
  );

  // Document notifications with specific rules
  useEffect(() => {
    if (!documentNotifications || !documents) return;

    // 🔴 RED: Pending document upload requests (se quita cuando enviamos archivo)
    const pendingRequests = (documentNotifications as any[]).filter(notification => 
      !notification.isCompleted
    );
    const hasPendingRequests = pendingRequests.length > 0;
    setHasDocumentRequests(hasPendingRequests);

    // 🟢 GREEN: New documents received
    const lastDocumentCheck = localStorage.getItem('lastDocumentCheck');
    const lastCheckDate = lastDocumentCheck ? new Date(lastDocumentCheck) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Check for payroll documents that need signature
    const unsignedPayrolls = (documents as any[]).filter((doc: any) => {
      const isPayroll = doc.fileName.toLowerCase().includes('nomina') || 
                       doc.fileName.toLowerCase().includes('nómina') ||
                       doc.type === 'payroll';
      const needsSignature = !doc.isSigned;
      const isRecent = new Date(doc.createdAt) > lastCheckDate;
      
      return isPayroll && needsSignature && isRecent;
    });

    // Check for other new documents (non-payroll)
    const otherNewDocuments = (documents as any[]).filter((doc: any) => {
      const isPayroll = doc.fileName.toLowerCase().includes('nomina') || 
                       doc.fileName.toLowerCase().includes('nómina') ||
                       doc.type === 'payroll';
      const isRecent = new Date(doc.createdAt) > lastCheckDate;
      
      // For non-payroll docs, check if user has visited documents page
      if (!isPayroll && isRecent) {
        const lastPageVisit = localStorage.getItem('lastDocumentPageVisit');
        if (lastPageVisit) {
          const visitDate = new Date(lastPageVisit);
          // Clear if visited after document creation
          return new Date(doc.createdAt) > visitDate;
        }
        return true;
      }
      
      return false;
    });

    const hasRecentDocuments = unsignedPayrolls.length > 0 || otherNewDocuments.length > 0;
    setHasNewDocuments(hasRecentDocuments);

    console.log('📋 Document notifications check:', {
      pendingRequests: pendingRequests.length,
      unsignedPayrolls: unsignedPayrolls.length,
      otherNewDocuments: otherNewDocuments.length,
      lastCheck: lastCheckDate.toISOString(),
      hasPendingRequests,
      hasRecentDocuments
    });

  }, [documentNotifications, documents]);

  // Check for overdue reminders 
  useEffect(() => {
    if (!allReminders?.length) {
      setHasOverdueReminders(false);
      return;
    }

    const now = new Date();
    const overdueReminders = (allReminders as any[]).filter((reminder: any) => {
      // Skip if reminder doesn't have a due date
      if (!reminder.dueDate) return false;
      
      const dueDate = new Date(reminder.dueDate);
      const isOverdue = dueDate < now;
      
      // Check if user has completed this reminder
      const userCompleted = reminder.completedBy?.includes(user?.id);
      
      console.log('🔔 Reminder overdue check:', {
        id: reminder.id,
        title: reminder.title,
        dueDate: reminder.dueDate,
        isOverdue,
        userCompleted,
        completedBy: reminder.completedBy
      });
      
      return isOverdue && !userCompleted;
    });

    const hasOverdue = overdueReminders.length > 0;
    setHasOverdueReminders(hasOverdue);

    console.log('🔔 Overdue reminders check:', {
      totalReminders: allReminders.length,
      overdueCount: overdueReminders.length,
      hasOverdue,
      overdueReminders: overdueReminders.map((r: any) => ({ id: r.id, title: r.title, dueDate: r.dueDate }))
    });

  }, [allReminders, user?.id]);

  // Check for new messages with intelligent clearing
  useEffect(() => {
    if (!unreadCount?.count || unreadCount.count === 0) {
      setHasNewMessages(false);
      return;
    }

    // Get the last time user entered messages page
    const lastMessagesPageVisit = localStorage.getItem('lastMessagesPageVisit');
    const lastVisitTime = lastMessagesPageVisit ? new Date(lastMessagesPageVisit) : null;
    
    const currentTime = new Date();
    const unreadMessages = parseInt(unreadCount.count.toString());

    // Show green notification if there are unread messages and user hasn't visited recently
    const showNotification = unreadMessages > 0 && (!lastVisitTime || currentTime > lastVisitTime);
    setHasNewMessages(showNotification);

    console.log('💬 Messages notification check:', {
      unreadMessages,
      lastVisitTime: lastVisitTime?.toISOString(),
      currentTime: currentTime.toISOString(),
      showNotification,
      lastMessagesPageVisit
    });

  }, [unreadCount]);

  // Check for active reminders from the /api/reminders/active endpoint
  const { data: activeReminders = [] } = useQuery({
    queryKey: ['/api/reminders/active'],
    enabled: !!user,
    refetchInterval: 10 * 60 * 1000, // ⚡ Optimizado: reminders activos cada 10 minutos
    refetchIntervalInBackground: false,
    staleTime: 8 * 60 * 1000, // ⚡ Optimizado: cache reminders activos por 8 minutos
  });

  // Update active reminders state
  useEffect(() => {
    const hasActive = (activeReminders as any[]).length > 0;
    setHasActiveReminders(hasActive);

    console.log('📋 Active reminders check:', {
      activeCount: activeReminders.length,
      hasActiveReminders: hasActive,
      reminders: (activeReminders as any[]).map((r: any) => ({ id: r.id, title: r.title }))
    });

  }, [activeReminders]);

  // Get recent work session for "last clock in" info
  const { data: recentSessions } = useQuery<WorkSession[]>({
    queryKey: ['/api/work-sessions'],
  });

  // Check if user has any incomplete sessions from previous days
  const hasIncompleteSessions = useMemo(() => {
    if (!recentSessions || recentSessions.length === 0) return false;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check if any session is from before today and has no clockOut
    return recentSessions.some(session => {
      if (session.clockOut) return false; // Has clockOut, so it's complete
      
      const sessionDate = new Date(session.clockIn);
      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
      
      return sessionDay < today; // Session is from before today and has no clockOut
    });
  }, [recentSessions]);

  // Clock in/out mutations
  const clockInMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/work-sessions/clock-in');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      const message = generateDynamicMessage('entrada');
      showTemporaryMessage(message);
    },
    onError: (error: any) => {
      if (error.message?.includes('Invalid or expired token') || error.message?.includes('403')) {
        toast({
          title: "Sesión expirada",
          description: "Redirigiendo al login...",
          variant: "destructive",
        });
        localStorage.removeItem('authData');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      } else {
        toast({ 
          title: 'Error', 
          description: 'No se pudo registrar la entrada',
          variant: 'destructive'
        });
      }
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      // Guardar datos de la sesión antes de cerrarla
      const sessionClockIn = activeSession?.clockIn;
      const result = await apiRequest('POST', '/api/work-sessions/clock-out');
      return { ...result, sessionClockIn };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      const message = generateDynamicMessage('salida');
      showTemporaryMessage(message);
      
      // Debug: verificar valores para el popup de parte de obra
      console.log('🔍 DEBUG clockOut:', {
        workReportMode: user?.workReportMode,
        plan: subscription?.plan,
        userId: user?.id
      });
      
      // Mostrar popup de parte de obra si el usuario tiene configurado on_clockout o both
      const workReportMode = user?.workReportMode;
      if (hasAccess('work_reports') && 
          (workReportMode === 'on_clockout' || workReportMode === 'both')) {
        const clockOutTime = new Date().toISOString();
        const clockInTime = data.sessionClockIn || activeSession?.clockIn || clockOutTime;
        setCompletedSessionData({
          clockIn: clockInTime,
          clockOut: clockOutTime
        });
        // Inicializar los campos del formulario
        const clockInDate = new Date(clockInTime);
        setWorkReportForm(prev => ({
          ...prev,
          reportDate: format(clockInDate, 'yyyy-MM-dd'),
          startTime: clockInDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }),
          endTime: new Date(clockOutTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
        }));
        setClientSignatureData('');
        setClientSignedBy('');
        setShowWorkReportModal(true);
      }
    },
    onError: (error: any) => {
      if (error.message?.includes('Invalid or expired token') || error.message?.includes('403')) {
        toast({
          title: "Sesión expirada",
          description: "Redirigiendo al login...",
          variant: "destructive",
        });
        localStorage.removeItem('authData');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      } else {
        toast({ 
          title: 'Error', 
          description: 'No se pudo registrar la salida',
          variant: 'destructive'
        });
      }
    },
  });

  // Break periods mutations
  const startBreakMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/break-periods/start');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/break-periods/active'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo iniciar el descanso',
        variant: 'destructive'
      });
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/break-periods/end');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/break-periods/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo finalizar el descanso',
        variant: 'destructive'
      });
    },
  });

  // Mutación para crear parte de obra al fichar salida
  const createWorkReportMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/work-reports', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string).startsWith('/api/work-reports') });
      toast({
        title: 'Parte de Obra Enviado',
        description: 'El parte de obra se ha registrado correctamente.',
      });
      setShowWorkReportModal(false);
      setCompletedSessionData(null);
      setWorkReportForm({ reportDate: format(new Date(), 'yyyy-MM-dd'), refCode: '', location: '', description: '', clientName: '', notes: '', startTime: '', endTime: '', signedBy: '' });
      setClientSignatureData('');
      setClientSignedBy('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar el parte de obra.',
        variant: 'destructive'
      });
    },
  });

  // Handler para enviar el parte de obra
  const handleSubmitWorkReport = () => {
    if (!workReportForm.location.trim() || !workReportForm.description.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa la ubicación y descripción del trabajo.',
        variant: 'destructive'
      });
      return;
    }

    const reportData = {
      companyId: user?.companyId,
      employeeId: user?.id,
      reportDate: workReportForm.reportDate,
      refCode: workReportForm.refCode || null,
      location: workReportForm.location,
      startTime: workReportForm.startTime,
      endTime: workReportForm.endTime,
      description: workReportForm.description,
      clientName: workReportForm.clientName || null,
      notes: workReportForm.notes || null,
      signedBy: workReportForm.signedBy || null,
      signatureImage: clientSignatureData || undefined,
      status: 'submitted' // Se envía directamente, sin borrador
    };

    createWorkReportMutation.mutate(reportData);
  };

  // Handler para cerrar el modal sin guardar
  const handleCloseWorkReportModal = () => {
    setShowWorkReportModal(false);
    setCompletedSessionData(null);
    setWorkReportForm({ reportDate: format(new Date(), 'yyyy-MM-dd'), refCode: '', location: '', description: '', clientName: '', notes: '', startTime: '', endTime: '', signedBy: '' });
    setClientSignatureData('');
    setClientSignedBy('');
  };

  // Determine session state and status 
  const getSessionStatus = () => {
    if (!activeSession) {
      return { isActive: false, isIncomplete: false, isToday: false, canStartNew: true };
    }
    
    const clockIn = new Date(activeSession.clockIn);
    const currentTime = new Date();
    const isToday = clockIn.toDateString() === currentTime.toDateString();
    const hoursFromClockIn = (currentTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    const maxDailyHours = (companySettings as any)?.workingHoursPerDay || 8;
    const maxHoursWithOvertime = Number(maxDailyHours) + 4;
    
    // If session is from previous day and has no clock out, it's incomplete
    if (!isToday && !activeSession.clockOut) {
      // If enough time has passed since the incomplete session, allow new session
      const canStartNew = hoursFromClockIn > maxHoursWithOvertime;
      return { isActive: false, isIncomplete: true, isToday: false, canStartNew };
    }
    
    // If session is from today, check if it's still within working hours
    if (isToday) {
      // If exceeded max hours + overtime, treat as finished
      if (hoursFromClockIn > maxHoursWithOvertime) {
        return { isActive: false, isIncomplete: false, isToday: true, canStartNew: true };
      } else {
        return { isActive: true, isIncomplete: false, isToday: true, canStartNew: false };
      }
    }
    
    return { isActive: false, isIncomplete: false, isToday: false, canStartNew: true };
  };

  const sessionStatus = getSessionStatus();

  const formatLastClockDate = () => {
    // If there's an incomplete session from previous day, show it
    if (sessionStatus.isIncomplete && activeSession) {
      const clockInDate = new Date(activeSession.clockIn);
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const isYesterday = clockInDate.toDateString() === yesterday.toDateString();
      const time = clockInDate.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      
      if (isYesterday) {
        return `Sesión incompleta de ayer a las ${time}`;
      } else {
        const dayName = clockInDate.toLocaleDateString('es-ES', { weekday: 'long' });
        const dayNumber = clockInDate.getDate();
        const month = clockInDate.toLocaleDateString('es-ES', { month: 'long' });
        return `Sesión incompleta del ${dayName} ${dayNumber} de ${month} a las ${time}`;
      }
    }
    
    // If there's an active session from today, show when they clocked in
    if (sessionStatus.isActive && activeSession) {
      const clockInDate = new Date(activeSession.clockIn);
      const time = clockInDate.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      return `Hoy a las ${time}`;
    }
    
    // If no active session, show the most recent clock out or clock in
    if (recentSessions && recentSessions.length > 0) {
      // Find the most recent session (should be first due to ordering)
      const mostRecentSession = recentSessions[0];
      
      // If the session has clock out, show when they clocked out
      if (mostRecentSession.clockOut) {
        const clockOutDate = new Date(mostRecentSession.clockOut);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const isToday = clockOutDate.toDateString() === now.toDateString();
        const isYesterday = clockOutDate.toDateString() === yesterday.toDateString();
        
        const time = clockOutDate.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
        
        if (isToday) {
          return `Salida hoy a las ${time}`;
        } else if (isYesterday) {
          return `Salida ayer a las ${time}`;
        } else {
          const dayName = clockOutDate.toLocaleDateString('es-ES', { weekday: 'long' });
          const dayNumber = clockOutDate.getDate();
          const month = clockOutDate.toLocaleDateString('es-ES', { month: 'long' });
          return `Salida el ${dayName} ${dayNumber} de ${month} a las ${time}`;
        }
      } else {
        // Show when they clocked in (incomplete session)
        const clockInDate = new Date(mostRecentSession.clockIn);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const isToday = clockInDate.toDateString() === now.toDateString();
        const isYesterday = clockInDate.toDateString() === yesterday.toDateString();
        
        const time = clockInDate.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
        
        if (isToday) {
          return `Entrada hoy a las ${time}`;
        } else if (isYesterday) {
          return `Entrada ayer a las ${time}`;
        } else {
          const dayName = clockInDate.toLocaleDateString('es-ES', { weekday: 'long' });
          const dayNumber = clockInDate.getDate();
          const month = clockInDate.toLocaleDateString('es-ES', { month: 'long' });
          return `Entrada el ${dayName} ${dayNumber} de ${month} a las ${time}`;
        }
      }
    }
    
    return '';
  };

  const handleClockAction = () => {
    // Solo hacer clock-out si hay sesión ACTIVA (no incompleta)
    if (sessionStatus.isActive) {
      // Si hay un descanso activo, terminarlo primero antes de salir
      if (activeBreak) {
        endBreakMutation.mutate(undefined, {
          onSuccess: () => {
            // Después de terminar el descanso, hacer clock out
            clockOutMutation.mutate();
          }
        });
      } else {
        clockOutMutation.mutate();
      }
    } else {
      // Si no hay sesión activa (incluso si hay sesión incompleta), hacer clock-in
      clockInMutation.mutate();
    }
  };

  // Get company alias from current URL or company data
  const [location, setLocation] = useLocation();
  const urlParts = location.split('/').filter(part => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';

  const handleNavigation = (route: string) => {
    setLocation(route);
  };

  const allMenuItems = [
    { 
      icon: Clock, 
      title: 'Fichajes', 
      route: `/${companyAlias}/misfichajes`,
      notification: hasIncompleteSessions || sessionStatus.isIncomplete,
      notificationType: 'red',
      feature: 'time_tracking' as const
    },
    { 
      icon: CalendarDays, 
      title: 'Cuadrante', 
      route: `/${companyAlias}/cuadrante`,
      notification: false,
      feature: 'schedules' as const
    },
    { 
      icon: Calendar, 
      title: 'Vacaciones', 
      route: `/${companyAlias}/vacaciones`,
      notification: hasVacationUpdates,
      notificationType: hasVacationUpdates ? (localStorage.getItem('vacationNotificationType') || 'red') : 'red',
      feature: 'vacation' as const
    },
    { 
      icon: FileText, 
      title: 'Documentos', 
      route: `/${companyAlias}/documentos`,
      notification: hasDocumentRequests || hasNewDocuments,
      notificationType: hasDocumentRequests ? 'red' : 'green',
      feature: 'documents' as const
    },
    { 
      icon: Bell, 
      title: 'Recordatorios', 
      route: `/${companyAlias}/recordatorios`,
      notification: hasOverdueReminders || hasActiveReminders,
      notificationType: hasOverdueReminders ? 'red' : (hasActiveReminders ? 'blue' : 'none'),
      feature: 'reminders' as const
    },
    ...(!isEmployeeViewMode ? [{ 
      icon: MessageSquare, 
      title: 'Mensajes', 
      route: `/${companyAlias}/mensajes`,
      notification: hasNewMessages,
      notificationType: 'green',
      feature: 'messages' as const
    }] : []),
    ...(user?.workReportMode === 'manual' || user?.workReportMode === 'both' || user?.workReportMode === 'on_clockout' ? [
      { 
        icon: ClipboardList, 
        title: 'Partes', 
        route: `/${companyAlias}/partes-trabajo`,
        notification: false,
        notificationType: 'none',
        feature: 'work_reports' as const
      }
    ] : []),
  ];

  const menuItems = allMenuItems.filter(item => hasAccess(item.feature));

  // Aplicar orden personalizado a los items del menú
  const orderedMenuItems = useMemo(() => {
    if (customMenuOrder.length === 0 || customMenuOrder.length !== menuItems.length) {
      return menuItems.map((item, idx) => ({ ...item, originalIndex: idx }));
    }
    return customMenuOrder.map(idx => ({ ...menuItems[idx], originalIndex: idx }));
  }, [menuItems, customMenuOrder]);

  // Dividir items en páginas de 6 (grid 3x2) - siempre mantener 6 slots por página
  const itemsPerPage = 6;
  const menuPages = useMemo(() => {
    const pages: (typeof orderedMenuItems | null)[][] = [];
    for (let i = 0; i < orderedMenuItems.length; i += itemsPerPage) {
      const pageItems = orderedMenuItems.slice(i, i + itemsPerPage);
      // Rellenar con null hasta tener 6 items para mantener el grid 3x2
      while (pageItems.length < itemsPerPage) {
        pageItems.push(null as any);
      }
      pages.push(pageItems);
    }
    // Si no hay items, crear una página vacía con 6 slots
    if (pages.length === 0) {
      pages.push(Array(itemsPerPage).fill(null));
    }
    return pages;
  }, [orderedMenuItems]);

  const totalPages = menuPages.length;

  // Obtener items de otras páginas para el menú de intercambio
  const getSwappableItems = (currentItemIndex: number) => {
    const currentPage = Math.floor(currentItemIndex / itemsPerPage);
    return orderedMenuItems
      .map((item, idx) => ({ ...item, displayIndex: idx }))
      .filter((_, idx) => Math.floor(idx / itemsPerPage) !== currentPage);
  };

  // Handlers para long press
  const handleLongPressStart = (globalIndex: number) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressItem(globalIndex);
      setShowSwapMenu(true);
    }, 500); // 500ms para activar long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Intercambiar posiciones de iconos
  const handleSwapItems = (targetIndex: number) => {
    if (longPressItem === null) return;
    
    // Crear nuevo orden
    const currentOrder = customMenuOrder.length === menuItems.length 
      ? [...customMenuOrder] 
      : menuItems.map((_, idx) => idx);
    
    // Intercambiar posiciones
    const temp = currentOrder[longPressItem];
    currentOrder[longPressItem] = currentOrder[targetIndex];
    currentOrder[targetIndex] = temp;
    
    // Guardar en localStorage y estado
    localStorage.setItem('menuIconOrder', JSON.stringify(currentOrder));
    setCustomMenuOrder(currentOrder);
    setShowSwapMenu(false);
    setLongPressItem(null);
  };

  // Handlers para swipe del carrusel - con efecto rebote tipo iOS
  const isSwiping = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [bounceOffset, setBounceOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (showSwapMenu) return;
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
    isSwiping.current = false;
    setIsAnimating(false);
    setBounceOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (showSwapMenu) return;
    touchEndX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > 10) {
      isSwiping.current = true;
      
      // Efecto de resistencia en los bordes (rubber band)
      let offset = -diff;
      const isAtStart = menuPage === 0 && diff < 0;
      const isAtEnd = menuPage === totalPages - 1 && diff > 0;
      
      if (isAtStart || isAtEnd) {
        offset = offset * 0.3;
      }
      
      setDragOffset(offset);
    }
  };

  const handleTouchEnd = () => {
    if (showSwapMenu) return;
    
    setDragOffset(0);
    
    if (!isSwiping.current) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0 && menuPage < totalPages - 1) {
        // Rebote: primero overshoot, luego vuelve
        setBounceOffset(-15);
        setIsAnimating(true);
        setMenuPage(menuPage + 1);
        setTimeout(() => setBounceOffset(0), 150);
      } else if (diff < 0 && menuPage > 0) {
        setBounceOffset(15);
        setIsAnimating(true);
        setMenuPage(menuPage - 1);
        setTimeout(() => setBounceOffset(0), 150);
      } else {
        // En los bordes, rebote de vuelta
        setIsAnimating(true);
      }
    } else {
      setIsAnimating(true);
    }
    isSwiping.current = false;
  };
  
  // También añadir rebote al cambiar página con los puntos
  const handlePageDotClick = (index: number) => {
    if (index === menuPage) return;
    const direction = index > menuPage ? -1 : 1;
    setBounceOffset(direction * 15);
    setIsAnimating(true);
    setMenuPage(index);
    setTimeout(() => setBounceOffset(0), 150);
  };

  const currentYear = new Date().getFullYear();

  // Initialize notifications and page setup
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Request notification permission for real-time alerts
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Log real-time notification status for debugging
  useEffect(() => {
    console.log('🔔 Real-time notifications status:', {
      hasVacationUpdates,
      hasDocumentRequests,
      hasNewDocuments,
      unreadMessages: unreadCount?.count || 0,
      timestamp: new Date().toISOString()
    });
  }, [hasVacationUpdates, hasDocumentRequests, hasNewDocuments, unreadCount]);

  // Log feature access for debugging
  useEffect(() => {
    console.log('Employee dashboard feature access:', {
      documents: hasAccess('documents'),
      messages: hasAccess('messages'),
      vacation: hasAccess('vacation'),
      timeTracking: hasAccess('timeTracking')
    });
  }, [hasAccess]);

  // Work alarms are now handled automatically by PWA push notifications

  return (
    <div 
      className="bg-gray-50 dark:bg-employee-gradient text-gray-900 dark:text-white flex flex-col overflow-hidden"
      style={{ 
        height: '100dvh',
        maxHeight: '-webkit-fill-available',
        overscrollBehavior: 'none',
        touchAction: 'none'
      }}
    >
      {/* Fixed Content Container - Sin scroll, usa dvh para móviles reales */}
      <div className="flex-1 flex flex-col px-4 pt-2 pb-0 min-h-0">
        {/* Header - Compacto */}
        <div className="flex justify-between items-center py-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAlarmModalOpen(true)}
              className="text-white dark:text-white bg-red-600 dark:bg-red-500/20 hover:bg-red-700 dark:hover:bg-red-500/30 backdrop-blur-xl border border-red-700 dark:border-red-400/30 hover:border-red-800 dark:hover:border-red-400/50 rounded-lg px-3 py-2 transition-all duration-200"
              title="Configurar alarmas de trabajo"
            >
              <AlarmClock className="h-4 w-4 mr-2" />
              <span className="font-medium text-xs">Alarmas</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2">
                  <div>
                    <h1 className="text-xs font-medium text-gray-900 dark:text-white drop-shadow-lg">{user?.fullName}</h1>
                  </div>
                  <UserAvatar
                    fullName={user?.fullName || ''}
                    size="sm"
                    userId={user?.id}
                    profilePicture={user?.profilePicture}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-white dark:bg-white/10 backdrop-blur-xl border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.fullName}</p>
                  <p className="text-xs text-gray-600 dark:text-white/70">{user?.companyEmail || user?.personalEmail || 'Sin email'}</p>
                  <p className="text-xs text-gray-500 dark:text-white/60 capitalize">{translateRole(user?.role) || 'Empleado'}</p>
                </div>
                
                <div className="px-2 py-3">
                  <div className="relative bg-white dark:bg-white/10 rounded-full p-1 border border-gray-200 dark:border-white/20">
                    {/* Indicador deslizante */}
                    <div 
                      className="absolute top-1 bottom-1 bg-gray-200 dark:bg-white/30 rounded-full transition-all duration-200 shadow-sm"
                      style={{
                        width: 'calc(33.333% - 4px)',
                        left: theme === 'light' ? '2px' : theme === 'system' ? 'calc(33.333% + 2px)' : 'calc(66.666% + 2px)',
                      }}
                    />
                    
                    {/* Botones */}
                    <div className="relative flex items-center">
                      <button
                        onClick={() => setTheme('light')}
                        className={`flex-1 flex items-center justify-center p-2 rounded-full transition-colors z-10 ${
                          theme === 'light' 
                            ? 'text-gray-900 dark:text-white' 
                            : 'text-gray-400 hover:text-gray-600 dark:text-white/50 dark:hover:text-white/80'
                        }`}
                        aria-label="Modo claro"
                      >
                        <Sun className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setTheme('system')}
                        className={`flex-1 flex items-center justify-center p-2 rounded-full transition-colors z-10 ${
                          theme === 'system' 
                            ? 'text-gray-900 dark:text-white' 
                            : 'text-gray-400 hover:text-gray-600 dark:text-white/50 dark:hover:text-white/80'
                        }`}
                        aria-label="Modo sistema"
                      >
                        <Monitor className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`flex-1 flex items-center justify-center p-2 rounded-full transition-colors z-10 ${
                          theme === 'dark' 
                            ? 'text-gray-900 dark:text-white' 
                            : 'text-gray-400 hover:text-gray-600 dark:text-white/50 dark:hover:text-white/80'
                        }`}
                        aria-label="Modo oscuro"
                      >
                        <Moon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <DropdownMenuItem 
                  onClick={() => {
                    const urlParts = window.location.pathname.split('/').filter((part: string) => part.length > 0);
                    const currentCompanyAlias = urlParts[0] || company?.alias || 'test';
                    handleNavigation(`/${currentCompanyAlias}/usuario`);
                  }} 
                  className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  Mi Perfil
                </DropdownMenuItem>
                
                {isEmployeeViewMode && (
                  <DropdownMenuItem 
                    onClick={disableEmployeeView}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 cursor-pointer"
                    data-testid="return-to-manager-mode"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Volver a Modo {user?.role === 'admin' ? 'Admin' : 'Manager'}
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem onClick={logout} className="text-gray-900 dark:text-white hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/20 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Company Logo and Name - Más grande sin cajón */}
        <div className="flex justify-center mb-2 flex-shrink-0">
          <Dialog>
            <DialogTrigger asChild>
              <button className="text-center hover:scale-105 transition-transform duration-200 cursor-pointer">
                {/* Mostrar logo solo si tiene logo Y función habilitada en super admin */}
                {shouldShowLogo ? (
                  <img 
                    src={company.logoUrl} 
                    alt={company.name} 
                    className="h-10 w-auto mx-auto object-contain drop-shadow-lg dark:brightness-0 dark:invert"
                  />
                ) : (
                  <div className="text-gray-900 dark:text-white text-base font-medium drop-shadow-lg">
                    {company?.name || 'Mi Empresa'}
                  </div>
                )}
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-auto bg-white dark:bg-white/10 backdrop-blur-xl border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white rounded-3xl shadow-2xl">
              {/* Tarjeta de Visita de la Empresa */}
              <div className="space-y-5 p-6">
                {/* Header con logo o nombre */}
                <div className="text-center pb-5">
                  {shouldShowLogo ? (
                    <img 
                      src={company.logoUrl} 
                      alt={company.name} 
                      className="h-12 w-auto mx-auto object-contain mb-4 dark:brightness-0 dark:invert"
                    />
                  ) : (
                    <div className="w-12 h-12 mx-auto bg-white dark:bg-white/10 rounded-2xl flex items-center justify-center mb-4 border border-gray-200 dark:border-white/20">
                      <Building2 className="h-6 w-6 text-gray-900 dark:text-white" />
                    </div>
                  )}
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {company?.name || 'Mi Empresa'}
                  </h2>
                </div>

                {/* Información de la empresa */}
                <div className="space-y-4">
                  {/* CIF */}
                  {company?.cif && (
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-400/20 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 dark:text-white/60 mb-1">CIF</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{company.cif}</p>
                      </div>
                    </div>
                  )}

                  {/* Dirección Postal */}
                  {(company?.address || company?.province) && (
                    <div className="flex items-start space-x-4">
                      <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-400/20 flex items-center justify-center mt-0.5">
                        <MapPin className="h-4 w-4 text-green-600 dark:text-green-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 dark:text-white/60 mb-1">Dirección</p>
                        <div className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
                          {company?.address && (
                            <p>{company.address}</p>
                          )}
                          {company?.province && (
                            <p>{company.province}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email de contacto */}
                  {company?.email && (
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-400/20 flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 dark:text-white/60 mb-1">Contacto</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{company.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Menu Grid - Carrusel estilo iPhone */}
        <div className="mb-1 relative flex-shrink-0">
          {/* Contenedor del carrusel con overflow visible para notificaciones */}
          <div 
            ref={menuContainerRef}
            className="overflow-x-clip overflow-y-visible pt-2"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Contenedor deslizable */}
            <div 
              className="flex"
              style={{ 
                transform: `translateX(calc(-${menuPage * 100}% + ${dragOffset + bounceOffset}px))`,
                transition: isAnimating ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
              }}
            >
              {menuPages.map((pageItems, pageIndex) => (
                <div key={pageIndex} className="w-full flex-shrink-0 px-2">
                  <div className="grid grid-cols-3 gap-3 justify-items-center">
                    {pageItems.map((item, index) => {
                      const globalIndex = pageIndex * itemsPerPage + index;
                      
                      if (!item) {
                        return (
                          <div key={index} className="flex flex-col items-center w-20 h-[108px] sm:w-[72px]">
                          </div>
                        );
                      }
                      
                      const isLongPressed = longPressItem === globalIndex;
                      
                      return (
                        <div key={index} className="flex flex-col items-center group relative">
                          <button
                            onClick={() => {
                              if (showSwapMenu) return;
                              
                              if (item.title === 'Vacaciones') {
                                localStorage.setItem('lastVacationCheck', new Date().toISOString());
                                if (hasVacationUpdates) {
                                  setHasVacationUpdates(false);
                                  localStorage.removeItem('hasVacationUpdates');
                                  localStorage.removeItem('vacationNotificationType');
                                }
                              }
                              
                              if (item.title === 'Documentos') {
                                localStorage.setItem('lastDocumentPageVisit', new Date().toISOString());
                              }
                              
                              handleNavigation(item.route);
                            }}
                            onTouchStart={() => handleLongPressStart(globalIndex)}
                            onTouchEnd={handleLongPressEnd}
                            onTouchCancel={handleLongPressEnd}
                            onMouseDown={() => handleLongPressStart(globalIndex)}
                            onMouseUp={handleLongPressEnd}
                            onMouseLeave={handleLongPressEnd}
                            className={`relative w-20 h-20 sm:w-[72px] sm:h-[72px] transition-all duration-200 rounded-2xl flex items-center justify-center mb-2 backdrop-blur-xl border ${
                              isLongPressed
                                ? 'bg-[#0056CC] border-[#0056CC] scale-110 shadow-xl'
                                : 'bg-[#007AFF] hover:bg-[#0056CC] border-[#007AFF] hover:border-[#0056CC]'
                            }`}
                          >
                            <item.icon className="h-10 w-10 sm:h-9 sm:w-9 transition-all duration-200 text-white drop-shadow-lg" />
                            {item.notification && (
                              <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 shadow-lg animate-bounce ${
                                (item as any).notificationType === 'red' ? 'bg-gradient-to-r from-red-500 to-pink-500' : 
                                (item as any).notificationType === 'green' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-pink-500'
                              }`}>
                                <div className="w-full h-full rounded-full animate-ping opacity-75 bg-white/30"></div>
                              </div>
                            )}
                            {!isLongPressed && (
                              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform -skew-x-12"></div>
                            )}
                          </button>
                          <span className="text-xs font-medium text-center leading-tight transition-all duration-300 text-gray-700 dark:text-white/90 group-hover:text-gray-900 dark:group-hover:text-white group-hover:scale-105">
                            {item.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Menú de intercambio de iconos */}
          {showSwapMenu && longPressItem !== null && (
            <div className="absolute inset-0 z-50 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-2xl max-w-[280px] w-full mx-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Intercambiar con:</h4>
                  <button 
                    onClick={() => { setShowSwapMenu(false); setLongPressItem(null); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {getSwappableItems(longPressItem).map((swapItem) => (
                    <button
                      key={swapItem.displayIndex}
                      onClick={() => handleSwapItems(swapItem.displayIndex)}
                      className="flex flex-col items-center p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#007AFF] flex items-center justify-center mb-1">
                        <swapItem.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-[10px] text-gray-600 dark:text-gray-300 text-center leading-tight">
                        {swapItem.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Indicadores de página (puntitos) */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-2">
              {Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => handlePageDotClick(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === menuPage 
                      ? 'bg-[#007AFF] w-4' 
                      : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                  aria-label={`Página ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Status Line and Last Clock In Info / Temporary Message - Compacto */}
        <div className="text-center mb-2 mt-3 flex justify-center flex-shrink-0">
          <div className="bg-white dark:bg-white/10 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/20 p-2 w-[304px] shadow-md">
            {/* Status Line */}
            <div className={`text-xs mb-2 font-medium ${
              sessionStatus.isActive 
                ? activeBreak 
                  ? 'text-orange-400' 
                  : 'text-green-400'
                : sessionStatus.isIncomplete
                  ? 'text-yellow-400'
                  : 'text-red-400'
            }`}>
              <div className="flex items-center justify-center gap-2">
                {sessionStatus.isActive ? (
                  activeBreak ? (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-400"></div>
                      <span>En descanso</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                      <span>Trabajando...</span>
                    </>
                  )
                ) : sessionStatus.isIncomplete ? (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                    <span>Sesión incompleta</span>
                  </>
                ) : (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                    <span>Fuera del trabajo</span>
                  </>
                )}
              </div>
            </div>
            
            {temporaryMessage ? (
              <>
                <div className="text-green-400 text-xs mb-1 font-medium">✓ Fichaje exitoso</div>
                <div className="text-gray-900 dark:text-white text-sm font-medium">
                  {temporaryMessage}
                </div>
              </>
            ) : (
              <>
                <div className="text-gray-500 dark:text-white/60 text-xs mb-1 font-medium">Tu último fichaje</div>
                <div className="text-gray-900 dark:text-white text-sm font-medium">
                  {formatLastClockDate() || 'Sin fichajes previos'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Clock Button or Vacation Message - Compacto */}
        <div className="flex-1 flex items-center justify-center pb-2 min-h-0">
          {isOnVacation ? (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center mb-3 shadow-lg">
                <Palmtree className="w-12 h-12 text-white" />
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white text-center">
                ¡Disfruta de tus vacaciones!
              </p>
            </div>
          ) : (
            <div className="relative w-full flex justify-center">
              {/* Contenedor centrado que se adapta al número de botones */}
              <div className={`flex items-center gap-6 transition-all duration-500 ${
                (sessionStatus.isActive || sessionStatus.isIncomplete) ? 'justify-center' : 'justify-center'
              }`}>
                
                {/* Break Button - Solo visible cuando hay sesión activa del día */}
                {sessionStatus.isActive && (
                  <div className="transition-all duration-700 transform translate-x-0 opacity-100 scale-100 animate-slideInFromRight">
                    <Button
                      onClick={() => {
                        if (activeBreak) {
                          endBreakMutation.mutate();
                        } else {
                          startBreakMutation.mutate();
                        }
                      }}
                      disabled={startBreakMutation.isPending || endBreakMutation.isPending}
                      className={`w-36 h-36 sm:w-32 sm:h-32 rounded-full ${
                        activeBreak 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : 'bg-orange-500 hover:bg-orange-600'
                      } text-white text-sm font-bold shadow-lg transition-all duration-300 relative overflow-hidden`}
                    >
                      {startBreakMutation.isPending || endBreakMutation.isPending ? (
                        <LoadingSpinner size="lg" className="text-white w-12 h-12" />
                      ) : (
                        <span className="relative z-10 whitespace-pre-line">
                          {activeBreak ? 'Terminar\nDescanso' : 'Tomar\nDescanso'}
                        </span>
                      )}
                      {/* Indicador de descanso activo */}
                      {activeBreak && (
                        <div className="absolute -inset-1 rounded-full border border-red-400 animate-pulse opacity-75"></div>
                      )}
                    </Button>
                  </div>
                )}

                {/* Clock Button - Siempre visible */}
                <div className="transition-all duration-500">
                  <Button
                    onClick={handleClockAction}
                    disabled={clockInMutation.isPending || clockOutMutation.isPending}
                    className="w-36 h-36 sm:w-32 sm:h-32 rounded-full bg-[#007AFF] hover:bg-[#0056CC] text-white text-xl font-bold shadow-lg transition-all duration-300 relative overflow-hidden"
                  >
                    {clockInMutation.isPending || clockOutMutation.isPending ? (
                      <LoadingSpinner size="lg" className="text-white w-12 h-12" />
                    ) : (
                      <span className="relative z-10">
                        {sessionStatus.canStartNew ? 'FICHAR' : 'SALIR'}
                      </span>
                    )}
                    {/* Anillo exterior pulsante cuando está activo */}
                    {(sessionStatus.isActive || sessionStatus.isIncomplete) && (
                      <div className={`absolute -inset-1 rounded-full border animate-ping opacity-75 ${
                        sessionStatus.isIncomplete ? 'border-yellow-400' : 'border-green-400'
                      }`}></div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Small Oficaz logo at bottom */}
      <div className="text-center flex-shrink-0 pb-2">
        <div className="flex items-center justify-center space-x-1 text-gray-500 dark:text-gray-400 text-xs">
          <span className="font-semibold text-blue-500 dark:text-blue-400">Oficaz</span>
          <span>© {currentYear}</span>
        </div>
      </div>

      {/* Work Alarms Modal */}
      {isAlarmModalOpen && (
        <WorkAlarmsModal 
          isOpen={isAlarmModalOpen}
          onClose={() => setIsAlarmModalOpen(false)}
        />
      )}

      {/* PWA Install Prompt - solo en dashboard de empleados */}
      <PWAInstallPrompt />

      {/* Modal de Parte de Obra al fichar salida */}
      <Dialog open={showWorkReportModal} onOpenChange={(open) => !open && handleCloseWorkReportModal()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Nuevo Parte de Trabajo
          </DialogTitle>
          <DialogDescription className="sr-only">Formulario para crear un parte de trabajo</DialogDescription>
          <div className="space-y-6 py-4">
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Cuándo y dónde
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Fecha del trabajo</Label>
                    <DatePickerDay
                      date={workReportForm.reportDate ? new Date(workReportForm.reportDate + 'T12:00:00') : new Date()}
                      onDateChange={(date) => setWorkReportForm({ ...workReportForm, reportDate: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd') })}
                      className="w-full justify-start bg-white dark:bg-gray-800"
                      placeholder="Seleccionar fecha"
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <Label className="text-sm">Código ref. <span className="text-gray-400 text-xs">(opcional)</span></Label>
                    <Input
                      placeholder="Ej: OBR-2024-001"
                      value={workReportForm.refCode}
                      onChange={(e) => setWorkReportForm({ ...workReportForm, refCode: e.target.value })}
                      onFocus={() => setShowRefCodeSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowRefCodeSuggestions(false), 200)}
                      className="bg-white dark:bg-gray-800"
                      data-testid="input-work-report-refcode"
                    />
                    {showRefCodeSuggestions && filteredRefCodeSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filteredRefCodeSuggestions.map((code, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            onMouseDown={() => {
                              setWorkReportForm({ ...workReportForm, refCode: code });
                              setShowRefCodeSuggestions(false);
                            }}
                          >
                            <FileText className="w-3 h-3 text-blue-400" />
                            {code}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Hora inicio
                    </Label>
                    <Input
                      type="time"
                      value={workReportForm.startTime}
                      onChange={(e) => setWorkReportForm({ ...workReportForm, startTime: e.target.value })}
                      className="bg-white dark:bg-gray-800"
                      data-testid="input-work-report-start-time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Hora fin
                    </Label>
                    <Input
                      type="time"
                      value={workReportForm.endTime}
                      onChange={(e) => setWorkReportForm({ ...workReportForm, endTime: e.target.value })}
                      className="bg-white dark:bg-gray-800"
                      data-testid="input-work-report-end-time"
                    />
                  </div>
                </div>
                <div className="space-y-2 relative">
                  <Label className="text-sm flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Ubicación
                  </Label>
                  <Input
                    placeholder="Ej: Calle Mayor 15, Madrid"
                    value={workReportForm.location}
                    onChange={(e) => setWorkReportForm({ ...workReportForm, location: e.target.value })}
                    onFocus={() => setShowLocationSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                    className="bg-white dark:bg-gray-800"
                    data-testid="input-work-report-location"
                  />
                  {showLocationSuggestions && filteredLocationSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredLocationSuggestions.map((loc, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          onMouseDown={() => {
                            setWorkReportForm({ ...workReportForm, location: loc });
                            setShowLocationSuggestions(false);
                          }}
                        >
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {loc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Detalles del trabajo
              </h4>
              <div className="space-y-3">
                <div className="space-y-2 relative">
                  <Label className="text-sm flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Cliente <span className="text-gray-400 text-xs">(opcional)</span>
                  </Label>
                  <Input
                    placeholder="Nombre del cliente"
                    value={workReportForm.clientName}
                    onChange={(e) => setWorkReportForm({ ...workReportForm, clientName: e.target.value })}
                    onFocus={() => setShowClientSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                    className="bg-white dark:bg-gray-800"
                    data-testid="input-work-report-client"
                  />
                  {showClientSuggestions && filteredClientSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredClientSuggestions.map((client, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          onMouseDown={() => {
                            setWorkReportForm({ ...workReportForm, clientName: client });
                            setShowClientSuggestions(false);
                          }}
                        >
                          <User className="w-3 h-3 text-gray-400" />
                          {client}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">¿Qué trabajo realizaste?</Label>
                  <Textarea
                    placeholder="Describe las tareas completadas..."
                    value={workReportForm.description}
                    onChange={(e) => setWorkReportForm({ ...workReportForm, description: e.target.value })}
                    rows={3}
                    className="bg-white dark:bg-gray-800"
                    data-testid="textarea-work-report-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Notas adicionales <span className="text-gray-400 text-xs">(opcional)</span></Label>
                  <Textarea
                    placeholder="Observaciones, incidencias..."
                    value={workReportForm.notes}
                    onChange={(e) => setWorkReportForm({ ...workReportForm, notes: e.target.value })}
                    rows={2}
                    className="bg-white dark:bg-gray-800"
                    data-testid="textarea-work-report-notes"
                  />
                </div>
                {clientSignatureData ? (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                    <img src={clientSignatureData} alt="Firma del cliente" className="h-12 max-w-[120px] object-contain" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 dark:text-gray-300">Firmado por: <strong>{workReportForm.signedBy}</strong></p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setClientSignedBy(workReportForm.signedBy); openClientSignatureModal(); }}
                      className="text-amber-700 border-amber-300"
                    >
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => { setClientSignedBy(''); openClientSignatureModal(); }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-add-client-signature"
                  >
                    <PenTool className="w-4 h-4 mr-2" />
                    Añadir firma del cliente (opcional)
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={handleCloseWorkReportModal} 
              data-testid="button-cancel-work-report" 
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmitWorkReport}
              disabled={createWorkReportMutation.isPending || !workReportForm.location || !workReportForm.description}
              data-testid="button-submit-work-report"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {createWorkReportMutation.isPending ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de firma del cliente */}
      <Dialog open={isClientSignatureModalOpen} onOpenChange={setIsClientSignatureModalOpen}>
        <DialogContent className="fixed inset-0 w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 p-0 rounded-none bg-white dark:bg-gray-900 flex flex-col border-0">
          <DialogTitle className="flex flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/30 space-y-0">
            <span className="text-xl font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <PenTool className="w-6 h-6" />
              Firma del Cliente
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsClientSignatureModalOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </Button>
          </DialogTitle>
          <DialogDescription className="sr-only">Panel para capturar la firma del cliente</DialogDescription>

          <div className="flex-1 flex flex-col p-6 gap-6 overflow-auto">
            <div className="space-y-2">
              <Label className="text-lg font-medium text-gray-700 dark:text-gray-200">Nombre del firmante</Label>
              <Input
                placeholder="Escriba su nombre completo"
                value={clientSignedBy}
                onChange={(e) => setClientSignedBy(e.target.value)}
                className="text-xl py-4 px-4 h-14 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600"
                data-testid="input-client-signed-by"
                autoFocus
              />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-lg font-medium text-gray-700 dark:text-gray-200">Firme aquí</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearClientCanvas}
                  className="text-gray-500"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Limpiar
                </Button>
              </div>
              <div className="flex-1 border-2 border-dashed border-amber-400 dark:border-amber-600 rounded-xl bg-white overflow-hidden min-h-[200px]">
                <canvas
                  ref={clientCanvasRef}
                  width={1000}
                  height={500}
                  className="w-full h-full touch-none cursor-crosshair"
                  style={{ touchAction: 'none', aspectRatio: '2/1' }}
                  onMouseDown={startClientDrawing}
                  onMouseMove={drawClient}
                  onMouseUp={stopClientDrawing}
                  onMouseLeave={stopClientDrawing}
                  onTouchStart={startClientDrawing}
                  onTouchMove={drawClient}
                  onTouchEnd={stopClientDrawing}
                />
              </div>
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-2">
                Dibuje su firma con el dedo o ratón
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <Button
              onClick={saveClientSignature}
              disabled={!clientSignedBy.trim()}
              className="w-full h-14 text-lg bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-save-client-signature"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Confirmar Firma
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Work Alarms Modal Component
function WorkAlarmsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [alarms, setAlarms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<any>(null);
  const [alarmToDelete, setAlarmToDelete] = useState<number | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    type: 'clock_in' as 'clock_in' | 'clock_out' | 'break_start' | 'break_end',
    time: '',
    weekdays: [] as number[],
    soundEnabled: true
  });

  // Load alarms
  const loadAlarms = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('GET', '/api/work-alarms');
      setAlarms(response || []);
    } catch (error) {
      console.error('Error loading alarms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load alarms when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAlarms();
    }
  }, [isOpen]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.time || formData.weekdays.length === 0) {
      return;
    }

    try {
      setIsLoading(true);
      
      // Generate title based on type
      const alarmData = {
        ...formData,
        time: formData.time, // Send local time (Spain timezone) to backend
        title: getAlarmTitle(formData.type)
      };
      
      if (editingAlarm) {
        // Update existing alarm
        await apiRequest('PUT', `/api/work-alarms/${editingAlarm.id}`, alarmData);
      } else {
        // Create new alarm
        await apiRequest('POST', '/api/work-alarms', alarmData);
      }
      
      // Reset form
      setFormData({
        type: 'clock_in',
        time: '',
        weekdays: [],
        soundEnabled: true
      });
      setShowForm(false);
      setEditingAlarm(null);
      loadAlarms();
    } catch (error) {
      console.error('Error saving alarm:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete alarm - show confirmation dialog
  const handleDelete = (alarmId: number) => {
    setAlarmToDelete(alarmId);
  };

  // Confirm delete alarm
  const confirmDelete = async () => {
    if (!alarmToDelete) return;

    try {
      setIsLoading(true);
      await apiRequest('DELETE', `/api/work-alarms/${alarmToDelete}`);
      loadAlarms();
    } catch (error) {
      console.error('Error deleting alarm:', error);
    } finally {
      setIsLoading(false);
      setAlarmToDelete(null);
    }
  };

  // Handle edit alarm
  const handleEdit = (alarm: any) => {
    setEditingAlarm(alarm);
    setFormData({
      type: alarm.type,
      time: alarm.time, // Time is already in local format (Spain timezone)
      weekdays: alarm.weekdays,
      soundEnabled: alarm.soundEnabled
    });
    setShowForm(true);
  };

  // Toggle weekday
  const toggleWeekday = (day: number) => {
    setFormData(prev => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter(d => d !== day)
        : [...prev.weekdays, day].sort()
    }));
  };

  // Weekday names
  const weekdayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const weekdayFullNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Generate title based on alarm type
  const getAlarmTitle = (type: string) => {
    switch (type) {
      case 'clock_in': return 'Entrada (Fichar)';
      case 'clock_out': return 'Salida (Salir)';
      case 'break_start': return 'Descanso entrada';
      case 'break_end': return 'Descanso salida';
      default: return 'Alarma';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Alarmas de Trabajo</h2>
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Add alarm button */}
          {!showForm && (
            <>
              <Button
                onClick={() => setShowForm(true)}
                className="w-full mb-4 bg-[#007AFF] hover:bg-[#0056CC] text-white"
              >
                + Nueva Alarma
              </Button>
            </>
          )}

          {/* Alarm form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
              <h3 className="font-medium mb-4 text-gray-900 dark:text-white">
                {editingAlarm ? 'Editar Alarma' : 'Nueva Alarma'}
              </h3>
              
              {/* Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'clock_in' | 'clock_out' | 'break_start' | 'break_end' }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-[#007AFF]"
                >
                  <option value="clock_in">Entrada (Fichar)</option>
                  <option value="clock_out">Salida (Salir)</option>
                  <option value="break_start">Descanso entrada</option>
                  <option value="break_end">Descanso salida</option>
                </select>
              </div>

              {/* Time */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full max-w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-[#007AFF] text-sm sm:text-base box-border"
                  style={{ WebkitAppearance: 'none' }}
                  required
                />
              </div>

              {/* Weekdays */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Días de la semana
                </label>
                <div className="flex gap-1">
                  {weekdayNames.map((day, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleWeekday(index + 1)}
                      className={`w-8 h-8 text-xs font-medium rounded transition-colors ${
                        formData.weekdays.includes(index + 1)
                          ? 'bg-[#007AFF] text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
                      }`}
                      title={weekdayFullNames[index]}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound */}
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.soundEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                    className="mr-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-[#007AFF] focus:ring-[#007AFF]"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Activar sonido</span>
                </label>
              </div>

              {/* Form buttons */}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-[#007AFF] hover:bg-[#0056CC] text-white"
                >
                  {isLoading ? 'Guardando...' : editingAlarm ? 'Actualizar' : 'Crear'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingAlarm(null);
                    setFormData({
                      type: 'clock_in',
                      time: '',
                      weekdays: [],
                      soundEnabled: true
                    });
                  }}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {/* Alarms list */}
          <div className="space-y-3">
            {isLoading && !showForm ? (
              <div className="text-center py-4">
                <LoadingSpinner size="lg" />
              </div>
            ) : alarms.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No tienes alarmas configuradas
              </div>
            ) : (
              alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">{getAlarmTitle(alarm.type)}</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        a las {alarm.time}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {alarm.weekdays.map((day: number) => weekdayFullNames[day - 1]).join(', ')}
                        {alarm.soundEnabled && ' • Con sonido'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(alarm)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(alarm.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={alarmToDelete !== null} onOpenChange={(open) => !open && setAlarmToDelete(null)}>
          <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900 dark:text-white">¿Eliminar alarma?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                Esta acción no se puede deshacer. La alarma será eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => setAlarmToDelete(null)}
                className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}