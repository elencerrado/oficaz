import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  Building2, 
  Building,
  Users, 
  Settings as SettingsIcon, 
  Clock, 
  Mail, 
  Phone, 
  MapPin,
  Shield,
  FileText,
  Save,
  Edit,
  X,
  Upload,
  Trash2,
  ArrowLeft,
  Key,
  Eye,
  EyeOff,
  PenTool,
  RotateCcw,
  Check
} from 'lucide-react';
import { CreditCard, Crown, AlertCircle, CheckCircle, Lightbulb, Info, MessageSquare, Send, Paperclip, HardDrive, Sparkles, Calculator } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { TabNavigation } from '@/components/ui/tab-navigation';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { TrialManagerSimple } from '@/components/TrialManagerSimple';
import { PaymentMethodManager } from '@/components/PaymentMethodManager';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DatePickerDayEmployee } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';
import flameIcon from '@assets/icon flam_1751450814463.png';
import { usePageHeader } from '@/components/layout/page-header';

// Password change schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Contraseña actual requerida"),
  newPassword: z.string().min(8, "Contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una minúscula") 
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial"),
  confirmPassword: z.string().min(1, "Confirmar contraseña requerido")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"]
});

type ChangePasswordData = z.infer<typeof changePasswordSchema>;

// Contact form schema
const contactFormSchema = z.object({
  subject: z.string().min(1, "El asunto es obligatorio").max(200, "El asunto no puede exceder 200 caracteres"),
  message: z.string().min(10, "El mensaje debe tener al menos 10 caracteres").max(2000, "El mensaje no puede exceder 2000 caracteres"),
  attachments: z.any().optional() // For file attachments
});

type ContactFormData = z.infer<typeof contactFormSchema>;

// Function to get plan icon color - Nuevo modelo: siempre Oficaz
const getPlanIconColor = (_plan: string) => {
  // Ahora hay un único plan "Oficaz" - usamos color primario
  return '#3B82F6'; // Azul Oficaz
};

// Animated counter component
const AnimatedCounter = ({ 
  value, 
  suffix = '', 
  decimals = 0,
  duration = 1.5 
}: { 
  value: number; 
  suffix?: string; 
  decimals?: number;
  duration?: number;
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!isInView) return;
    
    const startTime = Date.now();
    const endValue = value;
    
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = endValue * easeOut;
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, isInView, duration]);
  
  return (
    <span ref={ref}>
      {decimals > 0 ? displayValue.toFixed(decimals) : Math.floor(displayValue)}
      {suffix}
    </span>
  );
};

// Animated stat card component
const AnimatedStatCard = ({ 
  index,
  icon: Icon,
  title,
  value,
  maxValue,
  suffix,
  colorTheme,
  decimals = 0
}: {
  index: number;
  icon: any;
  title: string;
  value: number;
  maxValue: number | string;
  suffix?: string;
  colorTheme: 'blue' | 'emerald' | 'purple';
  decimals?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const [progressWidth, setProgressWidth] = useState(0);
  
  const colorClasses = {
    blue: {
      bg: 'from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30',
      border: 'border-blue-100/50 dark:border-blue-800/30',
      iconBg: 'bg-blue-100/80 dark:bg-blue-900/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      textColor: 'text-blue-600 dark:text-blue-400',
      progressBg: 'bg-blue-100/50 dark:bg-blue-900/30',
      progressBar: 'from-blue-500 to-indigo-500'
    },
    emerald: {
      bg: 'from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/30 dark:to-teal-950/30',
      border: 'border-emerald-100/50 dark:border-emerald-800/30',
      iconBg: 'bg-emerald-100/80 dark:bg-emerald-900/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      progressBg: 'bg-emerald-100/50 dark:bg-emerald-900/30',
      progressBar: 'from-emerald-500 to-teal-500'
    },
    purple: {
      bg: 'from-purple-50/80 to-violet-50/80 dark:from-purple-950/30 dark:to-violet-950/30',
      border: 'border-purple-100/50 dark:border-purple-800/30',
      iconBg: 'bg-purple-100/80 dark:bg-purple-900/50',
      iconColor: 'text-purple-600 dark:text-purple-400',
      textColor: 'text-purple-600 dark:text-purple-400',
      progressBg: 'bg-purple-100/50 dark:bg-purple-900/30',
      progressBar: 'from-purple-500 to-violet-500'
    }
  };
  
  const colors = colorClasses[colorTheme];
  const percentage = typeof maxValue === 'number' ? Math.min((value / maxValue) * 100, 100) : 0;
  
  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        setProgressWidth(percentage);
      }, 300 + index * 150);
      return () => clearTimeout(timer);
    }
  }, [isInView, percentage, index]);
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className={`p-4 bg-gradient-to-br ${colors.bg} backdrop-blur-sm rounded-xl border ${colors.border} shadow-sm hover:shadow-md transition-shadow duration-300`}
    >
      <div className="flex items-center gap-2 mb-2">
        <motion.div 
          initial={{ scale: 0, rotate: -180 }}
          animate={isInView ? { scale: 1, rotate: 0 } : {}}
          transition={{ delay: index * 0.1 + 0.2, type: "spring", stiffness: 200 }}
          className={`p-2 ${colors.iconBg} rounded-lg`}
        >
          <Icon className={`h-4 w-4 ${colors.iconColor}`} />
        </motion.div>
        <span className="font-medium text-foreground">{title}</span>
      </div>
      <div className={`text-lg font-semibold ${colors.textColor} mb-2`}>
        <AnimatedCounter value={value} decimals={decimals} /> {suffix} / {maxValue}{suffix ? '' : ''}
      </div>
      <div className={`h-2 ${colors.progressBg} rounded-full overflow-hidden`}>
        <motion.div 
          className={`h-full bg-gradient-to-r ${colors.progressBar} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${progressWidth}%` }}
          transition={{ duration: 1, delay: index * 0.15 + 0.3, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
};



// Component for Account Management
const AccountManagement = () => {
  const { user, company, subscription } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Payment modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Delete account modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Contact form modal states
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileList | null>(null);
  
  // Contact form setup
  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      subject: '',
      message: ''
    }
  });

  // Frontend file validation function for security
  const validateFiles = (files: FileList) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB per file
    const maxTotalSize = 20 * 1024 * 1024; // 20MB total
    const maxFiles = 5;

    if (files.length > maxFiles) {
      return {
        isValid: false,
        error: `Máximo ${maxFiles} archivos permitidos. Has seleccionado ${files.length}.`
      };
    }

    let totalSize = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      
      // Check file type
      if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
        return {
          isValid: false,
          error: `Tipo de archivo no permitido: ${file.name}. Solo se permiten: PDF, PNG, JPG, JPEG, WEBP.`
        };
      }
      
      // Check file size
      if (file.size > maxFileSize) {
        return {
          isValid: false,
          error: `Archivo demasiado grande: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB). Máximo 10MB por archivo.`
        };
      }
      
      totalSize += file.size;
    }
    
    // Check total size
    if (totalSize > maxTotalSize) {
      return {
        isValid: false,
        error: `Tamaño total de archivos demasiado grande: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Máximo 20MB total.`
      };
    }

    return { isValid: true, error: null };
  };
  
  // Contact form mutation
  const contactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const formData = new FormData();
      // Ensure we have valid data before sending
      const userName = user?.fullName || 'Usuario';
      const userEmail = user?.companyEmail || company?.email || 'contacto@empresa.com';
      
      formData.append('name', userName);
      formData.append('email', userEmail);
      formData.append('subject', 'Incidencia: ' + data.subject);
      formData.append('message', data.message);
      
      // Add attached files
      if (attachedFiles) {
        Array.from(attachedFiles).forEach((file, index) => {
          formData.append(`attachments`, file);
        });
      }
      
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar el mensaje');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mensaje enviado",
        description: "Tu mensaje se ha enviado correctamente al equipo de Oficaz. Te responderemos lo antes posible.",
      });
      contactForm.reset();
      setAttachedFiles(null);
      setIsContactModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar el mensaje. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });
  
  const handleContactSubmit = (data: ContactFormData) => {
    contactMutation.mutate(data);
  };
  
  // Add missing functions and mutations that were in the main component
  
  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async (confirmationText: string) => {
      const response = await fetch('/api/account/schedule-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ confirmationText }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al programar la eliminación de la cuenta');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cuenta programada para eliminación",
        description: "Tu cuenta será eliminada en 30 días. Puedes cancelar esta acción desde configuración.",
        variant: "destructive",
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al programar eliminación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel scheduled deletion
  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/account/cancel-deletion', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cancelar la eliminación');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Eliminación cancelada",
        description: "La eliminación de tu cuenta ha sido cancelada exitosamente.",
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cancelar eliminación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler functions
  const handleDeleteAccount = () => {
    if (confirmationText !== 'ELIMINAR PERMANENTEMENTE') {
      toast({
        title: "Error de confirmación",
        description: 'Debes escribir exactamente "ELIMINAR PERMANENTEMENTE"',
        variant: "destructive",
      });
      return;
    }
    
    setIsDeleting(true);
    deleteAccountMutation.mutate(confirmationText);
  };

  const handleCancelDeletion = () => {
    cancelDeletionMutation.mutate();
  };

  const { data: accountInfo } = useQuery<any>({
    queryKey: ['/api/account/info'],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: subscriptionData } = useQuery<any>({
    queryKey: ['/api/account/subscription'],
    retry: false,
    staleTime: 30000, // 30 seconds
  });

  const { data: paymentMethods } = useQuery<any[]>({
    queryKey: ['/api/account/payment-methods'],
    retry: false,
    staleTime: 60000, // 1 minute
  });

  const { data: invoices } = useQuery<any[]>({
    queryKey: ['/api/account/invoices'],
    retry: false,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: usageData } = useQuery<any>({
    queryKey: ['/api/account/usage-stats'],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: cancellationStatus } = useQuery<any>({
    queryKey: ['/api/account/cancellation-status'],
    retry: false,
    staleTime: 30000, // 30 seconds
  });

  const { data: trialStatus } = useQuery<any>({
    queryKey: ['/api/account/trial-status'],
    retry: false,
    staleTime: 30000, // 30 seconds
    meta: {
      authRequired: true
    }
  });

  const { data: subscriptionPlans } = useQuery<any[]>({
    queryKey: ['/api/subscription-plans'],
    retry: false,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const formatDate = (dateString: string) => {
    try {
      // Ensure we handle ISO date strings properly
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '(fecha no disponible)';
      }
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'dateString:', dateString);
      return '(fecha no disponible)';
    }
  };

  const formatAmount = (amount: string) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(parseFloat(amount));
  }

  const getInvoiceStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Pagada';
      case 'open': return 'Pendiente';
      case 'draft': return 'Borrador';
      case 'void': return 'Anulada';
      case 'uncollectible': return 'Incobrable';
      default: return 'Desconocido';
    }
  }

  const getInvoiceStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'paid': return 'secondary';
      case 'open': return 'outline';
      case 'draft': return 'outline';
      case 'void': return 'destructive';
      case 'uncollectible': return 'destructive';
      default: return 'outline';
    }
  }

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'open': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'void': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'uncollectible': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getPlanPrice = () => {
    // Use custom monthly price if available (set by superadmin)
    if (subscription?.customMonthlyPrice) {
      const customPrice = Number(subscription.customMonthlyPrice);
      if (customPrice > 0) {
        return `€${customPrice.toFixed(2)}`;
      }
    }
    
    // Nuevo modelo: precio base de Oficaz es 39€/mes
    if (subscription?.baseMonthlyPrice) {
      return `€${Number(subscription.baseMonthlyPrice).toFixed(2)}`;
    }
    
    // Default al precio base del plan Oficaz
    return '€39.00';
  };

  if (!accountInfo && !subscription) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <span>Estado de suscripción</span>
          </CardTitle>
          <CardDescription>
            Información sobre tu plan actual y características disponibles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <style>{`
            @keyframes planBandEntry {
              0% { opacity: 0; transform: translateX(-20px) scale(0.98); }
              100% { opacity: 1; transform: translateX(0) scale(1); }
            }
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
            @keyframes iconPop {
              0% { opacity: 0; transform: scale(0.5) rotate(-10deg); }
              100% { opacity: 1; transform: scale(1) rotate(0deg); }
            }
            @keyframes textSlide {
              0% { opacity: 0; transform: translateY(10px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes badgeFade {
              0% { opacity: 0; transform: scale(0.8); }
              100% { opacity: 1; transform: scale(1); }
            }
          `}</style>
          <div 
            className="relative p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50 transition-colors overflow-hidden"
            style={{
              animation: 'planBandEntry 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards'
            }}
          >
            {/* Shimmer effect overlay */}
            <div 
              className="absolute inset-0 -translate-x-full pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                animation: 'shimmer 1.5s ease-in-out 0.3s forwards'
              }}
            />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img 
                    src={flameIcon} 
                    alt="Plan icon" 
                    className="h-12 w-12 object-contain"
                    style={{ 
                      filter: 'hue-rotate(200deg)', // Azul para plan Oficaz
                      animation: 'iconPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both'
                    }}
                  />
                  <div style={{ animation: 'textSlide 0.5s ease-out 0.3s both' }}>
                    <p className="font-semibold text-foreground">Plan Oficaz</p>
                  </div>
                </div>
                <div 
                  className="flex items-center space-x-2"
                  style={{ animation: 'badgeFade 0.4s ease-out 0.5s both' }}
                >
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <Badge variant="secondary" className={`transition-colors ${
                    trialStatus?.status === 'trial' 
                      ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200" 
                      : "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200"
                  }`}>
                    {trialStatus?.status === 'trial' ? 'PRUEBA' : 'ACTIVO'}
                  </Badge>
                </div>
              </div>
              
              {/* Payment Information or Cancellation Warning */}
              {subscription?.nextPaymentDate && trialStatus?.status !== 'trial' && (
                <div className="pt-2 border-t border-gray-200/50">
                {paymentMethods && paymentMethods.length > 0 ? (
                  // Show payment info when payment methods exist
                  (<div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Próximo cobro:</span>
                      <span className="text-sm font-medium text-foreground">
                        {formatDate(subscription.nextPaymentDate)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {getPlanPrice()}/mes
                      </span>
                    </div>
                  </div>)
                ) : cancellationStatus?.scheduledForCancellation && (
                  // Show cancellation warning when no payment methods
                  (<div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">
                          ⚠️ Tu suscripción terminará el {formatDate(subscription.nextPaymentDate)}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          No tienes métodos de pago activos. Añade una tarjeta antes de esa fecha para mantener tu suscripción.
                        </p>
                      </div>
                    </div>
                  </div>)
                )}
                </div>
              )}
            </div>
          </div>
          
          {/* Usage Statistics - Animated Cards */}
          {usageData?.current && (
            <div className={`grid gap-4 ${typeof usageData.current.ai_tokens_limit === 'number' && usageData.current.ai_tokens_limit > 0 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
              {/* Usuarios */}
              <AnimatedStatCard
                index={0}
                icon={Users}
                title="Usuarios"
                value={usageData.current.employee_count}
                maxValue={usageData.current.max_users || subscription?.maxUsers || 100}
                colorTheme="blue"
              />
              
              {/* Almacenamiento */}
              <AnimatedStatCard
                index={1}
                icon={HardDrive}
                title="Almacenamiento"
                value={parseFloat(usageData.current.storage_used_gb || '0') < 1 
                  ? parseFloat(usageData.current.storage_used_mb || '0')
                  : parseFloat(usageData.current.storage_used_gb || '0')}
                maxValue={parseFloat(usageData.current.storage_used_gb || '0') < 1 
                  ? (usageData.current.storage_limit_gb || 1) * 1024
                  : usageData.current.storage_limit_gb || 1}
                suffix={parseFloat(usageData.current.storage_used_gb || '0') < 1 ? ' MB' : ' GB'}
                colorTheme="emerald"
                decimals={2}
              />
              
              {/* Asistente IA - Solo si el plan tiene límite de tokens */}
              {typeof usageData.current.ai_tokens_limit === 'number' && usageData.current.ai_tokens_limit > 0 && (
                <AnimatedStatCard
                  index={2}
                  icon={Sparkles}
                  title="Asistente IA"
                  value={(Number(usageData.current.ai_tokens_used) || 0) / 1000000}
                  maxValue={Number(usageData.current.ai_tokens_limit) / 1000000}
                  suffix="M tokens"
                  colorTheme="purple"
                  decimals={2}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Contact Oficaz */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <span>Contactar con Oficaz</span>
          </CardTitle>
          <CardDescription>
            ¿Tienes algún problema con la aplicación o necesitas ayuda? Contacta con nuestro equipo de soporte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setIsContactModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Send className="mr-2 h-4 w-4" />
            Enviar mensaje
          </Button>
        </CardContent>
      </Card>
      
      {/* Company Registration Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Información de registro</span>
          </CardTitle>
          <CardDescription>
            Detalles de la cuenta y registro en Oficaz
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">ID de cuenta</Label>
              <p className="text-sm text-gray-600">{accountInfo?.account_id}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Fecha de registro</Label>
              <p className="text-sm text-gray-600">{formatDate(accountInfo?.registration_date)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Administrador principal</Label>
              <p className="text-sm text-gray-600">{user?.fullName}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Email corporativo / facturación</Label>
              <p className="text-sm text-gray-600 break-words">{company?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Información de facturación</span>
          </CardTitle>
          <CardDescription>
            Direcciones fiscales y métodos de pago
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Billing Address */}
          <div>
            <Label className="text-sm font-semibold">Dirección fiscal</Label>
            <div className="mt-2 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Nombre:</span> {user?.fullName}
                </div>
                <div>
                  <span className="font-medium">CIF/NIF:</span> {accountInfo?.cif}
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium">Dirección:</span> {accountInfo?.address}
                </div>
                <div>
                  <span className="font-medium">Ciudad:</span> {accountInfo?.province}
                </div>
                <div>
                  <span className="font-medium">Código postal:</span> {accountInfo?.billing_postal_code}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <Label className="text-sm font-semibold">Método de pago</Label>
            {paymentMethods && paymentMethods.length > 0 ? (
              <div className="mt-2 p-4 bg-muted rounded-lg">
                {paymentMethods.map((method: any) => (
                  <div key={method.id} className="flex items-center space-x-3">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {method.card_brand?.toUpperCase()} **** {method.card_last_four}
                      </p>
                      <p className="text-xs text-gray-500">
                        Expira: {method.card_exp_month}/{method.card_exp_year}
                      </p>
                    </div>
                    {method.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        Principal
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      {trialStatus?.status === 'trial' ? (
                        // Durante período de prueba (con o sin haber tenido método de pago antes)
                        (<>
                          <p className="text-sm font-medium text-red-800" key={trialStatus?.trialEndDate}>
                            ⚠️ Tu período de prueba terminará el {trialStatus?.trialEndDate ? formatDate(trialStatus.trialEndDate) : '(fecha no disponible)'} ({trialStatus?.daysRemaining} días restantes)
                          </p>
                          <p className="text-sm text-red-700 mt-1">
                            No tienes métodos de pago configurados. Tu cuenta se cancelará automáticamente cuando termine el período de prueba.
                          </p>
                          <p className="text-xs text-red-600 mt-2">
                            Añade una tarjeta de crédito o débito para continuar usando Oficaz después del período de prueba.
                          </p>
                        </>)
                      ) : (
                        // Suscripción activa sin método de pago (eliminado durante suscripción activa)
                        (<>
                          <p className="text-sm font-medium text-red-800" key={subscription?.nextPaymentDate}>
                            ⚠️ Tu suscripción no se renovará el {subscription?.nextPaymentDate ? formatDate(subscription.nextPaymentDate) : '(fecha no disponible)'}
                          </p>
                          <p className="text-sm text-red-700 mt-1">
                            Has eliminado tu método de pago. Tu suscripción se cancelará automáticamente en la fecha indicada.
                          </p>
                          <p className="text-xs text-red-600 mt-2">
                            Añade una tarjeta de crédito o débito para que tu suscripción se renueve automáticamente.
                          </p>
                        </>)
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Management Actions */}
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => setIsPaymentModalOpen(true)}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Actualizar método de pago
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Invoice History - Solo mostrar si hay métodos de pago */}
      {paymentMethods && paymentMethods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Historial de facturas
            </CardTitle>
            <CardDescription>
              Últimas facturas emitidas para tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoices && invoices.length > 0 ? (
              <div className="space-y-3">
                {invoices.slice(0, 5).map((invoice: any) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-gray-600">{invoice.description}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(invoice.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="font-semibold">{formatAmount(invoice.amount)}</p>
                        <Badge 
                          variant={getInvoiceStatusVariant(invoice.status)}
                          className={getInvoiceStatusColor(invoice.status)}
                        >
                          {getInvoiceStatusText(invoice.status)}
                        </Badge>
                      </div>
                      {invoice.download_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Descargar factura sin salir del modo standalone
                            const link = document.createElement('a');
                            link.href = invoice.download_url;
                            link.download = `factura-${invoice.invoice_number}.pdf`;
                            link.target = '_self';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="ml-2"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Aún no hay facturas disponibles</p>
                <p className="text-sm mt-1">Las facturas aparecerán aquí cuando se generen</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de cuenta</CardTitle>
          <CardDescription>
            Opciones avanzadas para la administración de tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => window.location.href = '/addon-store'}
            >
              <Crown className="mr-2 h-4 w-4" />
              Gestionar complementos
            </Button>
          </div>
          
          {/* Danger Zone */}
          <div className="border-t pt-4 mt-6">
            <h4 className="text-lg font-semibold text-red-600 mb-2">Zona de peligro</h4>
            <p className="text-sm text-gray-600 mb-4">
              Estas acciones son permanentes y no se pueden deshacer.
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Show different buttons based on deletion status */}
              {cancellationStatus?.scheduledForDeletion ? (
                <Button 
                  variant="outline" 
                  className="justify-start border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                  onClick={handleCancelDeletion}
                  disabled={cancelDeletionMutation.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {cancelDeletionMutation.isPending ? 'Cancelando...' : 'Cancelar eliminación programada'}
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="justify-start border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-300 dark:hover:border-red-700"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancelar cuenta
                </Button>
              )}
            </div>

            {/* Show deletion warning if scheduled - Adaptado para modo oscuro */}
            {cancellationStatus?.scheduledForDeletion && cancellationStatus?.deletionWillOccurAt && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-4 mt-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    <p className="font-semibold mb-1">⚠️ Cuenta programada para eliminación</p>
                    <p className="mb-2">
                      Tu cuenta será eliminada permanentemente el{' '}
                      <strong>
                        {new Date(cancellationStatus.deletionWillOccurAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </strong>
                    </p>
                    <p className="text-xs">
                      Todos los datos serán eliminados permanentemente. Puedes cancelar esta acción usando el botón de arriba.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Modal de gestión de métodos de pago */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gestionar métodos de pago</DialogTitle>
            <DialogDescription>
              Administra tus métodos de pago y facturación para tu suscripción activa.
            </DialogDescription>
          </DialogHeader>
          <PaymentMethodManager paymentMethods={paymentMethods || []} />
        </DialogContent>
      </Dialog>
      {/* Modal de eliminación permanente - Adaptado para modo oscuro */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400 flex items-center space-x-2">
              <X className="h-5 w-5" />
              <span>Programar eliminación de cuenta</span>
            </DialogTitle>
            <DialogDescription className="text-gray-700 dark:text-gray-300">
              Tu cuenta será programada para eliminación con un período de gracia de 30 días.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5" />
                <div className="text-sm text-red-700 dark:text-red-300">
                  <p className="font-semibold mb-2">⚠️ ADVERTENCIA: Eliminación programada</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Se programará la eliminación para dentro de 30 días</li>
                    <li>• Tu suscripción se cancelará INMEDIATAMENTE (sin más cobros)</li>
                    <li>• Durante estos 30 días podrás cancelar la eliminación</li>
                    <li>• Después de 30 días se eliminarán TODOS los datos</li>
                    <li>• Se borrarán usuarios, fichajes, vacaciones y documentos</li>
                    <li>• Una vez eliminados, los datos NO se pueden recuperar</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmationInput" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Para confirmar, escribe exactamente: <span className="font-mono bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded">ELIMINAR PERMANENTEMENTE</span>
              </Label>
              <Input
                id="confirmationInput"
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Escribe aquí..."
                className="mt-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:border-red-500 dark:focus:border-red-400"
                disabled={isDeleting}
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setConfirmationText('');
                  setIsDeleting(false);
                }}
                disabled={isDeleting}
                className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={confirmationText !== 'ELIMINAR PERMANENTEMENTE' || isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              >
                {isDeleting ? (
                  <>
                    <LoadingSpinner size="xs" className="mr-2" />
                    Programando...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Programar eliminación
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Contact Form Modal */}
      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
        <DialogContent className="max-w-md max-h-[85svh] md:max-h-[85vh] overflow-y-auto">
          {/* Fixed Header */}
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <span>Contactar con Oficaz</span>
            </DialogTitle>
            <DialogDescription>
              Describe tu problema o consulta. Incluye todos los detalles que puedan ayudarnos.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...contactForm}>
              <form onSubmit={contactForm.handleSubmit(handleContactSubmit)} className="space-y-4">
                <FormField
                  control={contactForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asunto</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ej: Error en el sistema de fichajes"
                          {...field}
                          disabled={contactMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={contactForm.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción del problema</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe detalladamente el problema que estás experimentando, pasos para reproducirlo, mensajes de error, etc."
                          className="min-h-[120px] resize-none"
                          {...field}
                          disabled={contactMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* File attachment field */}
                <div>
                  <Label className="text-sm font-medium">Adjuntar archivos (opcional)</Label>
                  <div className="mt-2">
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400" />
                          <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-semibold">Haz clic para subir</span> o arrastra archivos aquí
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            PDF, PNG, JPG, JPEG, WEBP (Max. 10MB por archivo, 20MB total)
                          </p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                              // FRONTEND SECURITY: Validate files before setting state
                              const validatedFiles = validateFiles(files);
                              if (validatedFiles.isValid) {
                                setAttachedFiles(files);
                              } else {
                                toast({
                                  title: "Archivos inválidos",
                                  description: validatedFiles.error,
                                  variant: "destructive",
                                });
                                // Clear the input
                                e.target.value = '';
                                setAttachedFiles(null);
                              }
                            }
                          }}
                          disabled={contactMutation.isPending}
                        />
                      </label>
                    </div>
                    
                    {/* Show selected files */}
                    {attachedFiles && attachedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Archivos seleccionados:
                        </p>
                        {Array.from(attachedFiles).map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <Paperclip className="h-4 w-4 text-blue-500" />
                              <span className="text-sm text-blue-700 dark:text-blue-300 truncate">
                                {file.name}
                              </span>
                              <span className="text-xs text-blue-500 dark:text-blue-400">
                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                                if (input) {
                                  const dt = new DataTransfer();
                                  Array.from(attachedFiles).forEach((f, i) => {
                                    if (i !== index) dt.items.add(f);
                                  });
                                  input.files = dt.files;
                                  setAttachedFiles(dt.files);
                                }
                              }}
                              disabled={contactMutation.isPending}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <p className="font-medium mb-1">Tu información de contacto:</p>
                      <p className="text-xs">• <strong>Nombre:</strong> {user?.fullName}</p>
                      <p className="text-xs">• <strong>Email:</strong> {company?.email || user?.dni}</p>
                      <p className="text-xs mt-2">Te responderemos a tu email corporativo lo antes posible.</p>
                    </div>
                  </div>
                </div>
              
              {/* Form buttons at the end */}
              <div className="flex justify-center sm:justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsContactModalOpen(false)}
                  disabled={contactMutation.isPending}
                  className="flex-1 sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={contactMutation.isPending}
                  className="flex-1 sm:w-auto bg-blue-600 hover:bg-blue-700"
                >
                  {contactMutation.isPending ? (
                    <>
                      <LoadingSpinner size="xs" className="mr-2" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar mensaje
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Change Password Modal Component
const ChangePasswordModalComponent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al cambiar la contraseña');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Contraseña actualizada',
        description: 'Tu contraseña ha sido cambiada exitosamente.',
      });
      setIsOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo cambiar la contraseña',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: ChangePasswordData) => {
    changePasswordMutation.mutate(data);
  };

  const getPasswordStrength = (password: string) => {
    let score = 0;
    const checks = [
      /[A-Z]/.test(password), // Mayúscula
      /[a-z]/.test(password), // Minúscula
      /[0-9]/.test(password), // Número
      /[^A-Za-z0-9]/.test(password), // Carácter especial
      password.length >= 8 // Longitud mínima
    ];
    
    score = checks.filter(Boolean).length;
    
    if (score < 2) return { label: 'Muy débil', color: 'bg-red-500', width: '20%' };
    if (score < 3) return { label: 'Débil', color: 'bg-orange-500', width: '40%' };
    if (score < 4) return { label: 'Media', color: 'bg-yellow-500', width: '60%' };
    if (score < 5) return { label: 'Fuerte', color: 'bg-blue-500', width: '80%' };
    return { label: 'Muy fuerte', color: 'bg-green-500', width: '100%' };
  };

  const [passwordValue, setPasswordValue] = useState('');
  const passwordStrength = getPasswordStrength(passwordValue);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Key className="h-4 w-4 mr-2" />
          Cambiar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Key className="h-5 w-5 mr-2" />
            Cambiar contraseña
          </DialogTitle>
          <DialogDescription>
            Introduce tu contraseña actual y la nueva contraseña.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Contraseña actual */}
          <div>
            <Label htmlFor="currentPassword">Contraseña actual</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Introduce tu contraseña actual"
                {...form.register('currentPassword')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.formState.errors.currentPassword && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.currentPassword.message}</p>
            )}
          </div>

          {/* Nueva contraseña */}
          <div>
            <Label htmlFor="newPassword">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Introduce tu nueva contraseña"
                {...form.register('newPassword')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {/* Indicador de fuerza de contraseña */}
            {form.watch('newPassword') && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Fuerza de la contraseña</span>
                  <span className={`font-medium ${
                    passwordStrength.label === 'Muy fuerte' ? 'text-green-600' :
                    passwordStrength.label === 'Fuerte' ? 'text-blue-600' :
                    passwordStrength.label === 'Media' ? 'text-yellow-600' :
                    passwordStrength.label === 'Débil' ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: passwordStrength.width }}
                  ></div>
                </div>
              </div>
            )}

            {form.formState.errors.newPassword && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.newPassword.message}</p>
            )}

            {/* Requisitos de contraseña */}
            <div className="mt-2 text-xs text-gray-600 space-y-1">
              <p className="font-medium">La contraseña debe contener:</p>
              <ul className="space-y-1">
                <li className={`flex items-center ${/[A-Z]/.test(form.watch('newPassword') || '') ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className="mr-2">•</span> Al menos una mayúscula
                </li>
                <li className={`flex items-center ${/[a-z]/.test(form.watch('newPassword') || '') ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className="mr-2">•</span> Al menos una minúscula
                </li>
                <li className={`flex items-center ${/[0-9]/.test(form.watch('newPassword') || '') ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className="mr-2">•</span> Al menos un número
                </li>
                <li className={`flex items-center ${/[^A-Za-z0-9]/.test(form.watch('newPassword') || '') ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className="mr-2">•</span> Al menos un carácter especial
                </li>
                <li className={`flex items-center ${(form.watch('newPassword') || '').length >= 8 ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className="mr-2">•</span> Mínimo 8 caracteres
                </li>
              </ul>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div>
            <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirma tu nueva contraseña"
                {...form.register('confirmPassword')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                form.reset();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? 'Cambiando...' : 'Cambiar contraseña'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

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

export default function Settings() {
  usePageTitle('Configuración');
  const { user, company, subscription, refreshUser } = useAuth();
  const { toast } = useToast();
  const { hasAccess } = useFeatureCheck();
  const { setHeader, resetHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setHeader({
      title: 'Configuración',
      subtitle: 'Gestiona la configuración de tu empresa y perfil'
    });
    return resetHeader;
  }, []);
  const queryClient = useQueryClient();

  // Query for subscription plans
  const { data: subscriptionPlans } = useQuery({
    queryKey: ['/api/subscription-plans'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query for manager permissions (for conditionally showing tabs)
  const isManager = user?.role === 'manager';
  const { data: permissionsData } = useQuery<{ managerPermissions: {
    canCreateDeleteEmployees: boolean;
    canCreateDeleteManagers: boolean;
    canBuyRemoveFeatures: boolean;
    canBuyRemoveUsers: boolean;
    canEditCompanyData: boolean;
  } }>({
    queryKey: ['/api/settings/manager-permissions'],
    enabled: user?.role === 'admin' || isManager,
  });
  const managerPermissions = permissionsData?.managerPermissions;

  // Determine if manager can see company tab
  const managerCanEditCompany = isManager && managerPermissions?.canEditCompanyData;
  
  // Initialize active tab - admins start at 'account', others at 'profile'
  // Managers with company access will be switched to 'company' via effect
  const [activeTab, setActiveTab] = useState(user?.role === 'admin' ? 'account' : 'profile');
  
  // Update default tab when permissions become available for managers with company access
  useEffect(() => {
    if (isManager && managerPermissions?.canEditCompanyData && activeTab === 'profile') {
      setActiveTab('company');
    }
  }, [isManager, managerPermissions?.canEditCompanyData, activeTab]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // User profile data
  const [profileData, setProfileData] = useState({
    personalPhone: user?.personalPhone || '',
    personalEmail: user?.personalEmail || '',
    postalAddress: user?.postalAddress || '',
    companyEmail: user?.companyEmail || '',
    companyPhone: user?.companyPhone || '',
    position: user?.position || '',
    emergencyContactName: user?.emergencyContactName || '',
    emergencyContactPhone: user?.emergencyContactPhone || '',
    startDate: user?.startDate || ''
  });

  // Signature states
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Fetch saved signature
  const { data: signatureData, isLoading: signatureLoading } = useQuery<{ signatureUrl: string | null }>({
    queryKey: ['/api/work-reports/signature'],
    staleTime: 30000
  });
  
  const savedSignatureUrl = signatureData?.signatureUrl;

  // Signature mutation
  const saveSignatureMutation = useMutation({
    mutationFn: (signatureData: string) => 
      apiRequest('POST', '/api/work-reports/signature', { signatureData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-reports/signature'] });
      setIsEditingSignature(false);
      setHasDrawnSignature(false);
      toast({
        title: 'Firma guardada',
        description: 'Tu firma se ha guardado correctamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar firma',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Signature canvas functions
  const clearSignatureCanvas = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        lastPointRef.current = null;
        setHasDrawnSignature(false);
      }
    }
  }, []);

  const setupSignatureCanvas = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      // High-DPI canvas for crisp signatures
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      
      // Set canvas internal resolution to 2x or more for high quality
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Scale context to match DPI
        ctx.scale(dpr, dpr);
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.strokeStyle = '#1a1a1a';
        // Fine line width - will be crisp at high DPI
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        lastPointRef.current = null;
      }
    }
  }, []);

  const getEventPos = useCallback((event: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    // Use CSS coordinates since context is scaled by DPR
    if ('touches' in event) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top
      };
    }
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }, []);

  const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    const { x, y } = getEventPos(event, canvas);
    lastPointRef.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getEventPos]);

  const draw = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (!isDrawing) return;

    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getEventPos(event, canvas);
    
    if (lastPointRef.current) {
      const midX = (lastPointRef.current.x + x) / 2;
      const midY = (lastPointRef.current.y + y) / 2;
      ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
    }
    
    lastPointRef.current = { x, y };
    setHasDrawnSignature(true);
  }, [isDrawing, getEventPos]);

  const stopDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (isDrawing && lastPointRef.current) {
      const canvas = signatureCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineTo(lastPointRef.current.x, lastPointRef.current.y);
          ctx.stroke();
        }
      }
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [isDrawing]);

  const handleSaveSignature = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !hasDrawnSignature) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        if (data[idx] < 250 || data[idx + 1] < 250 || data[idx + 2] < 250) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    // Higher padding for better margins
    const padding = 40;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Export at higher resolution (800px) for crisp PDF rendering
    const optimizedCanvas = document.createElement('canvas');
    const targetWidth = Math.min(800, width);
    const scale = targetWidth / width;
    optimizedCanvas.width = targetWidth;
    optimizedCanvas.height = height * scale;
    
    const optCtx = optimizedCanvas.getContext('2d');
    if (optCtx) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        tempCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
        
        const imgData = tempCtx.getImageData(0, 0, width, height);
        const pixels = imgData.data;
        
        // Make white pixels transparent
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          if (r > 230 && g > 230 && b > 230) {
            pixels[i + 3] = 0;
          }
        }
        
        tempCtx.putImageData(imgData, 0, 0);
        
        // Draw with high quality anti-aliasing
        optCtx.clearRect(0, 0, optimizedCanvas.width, optimizedCanvas.height);
        optCtx.imageSmoothingEnabled = true;
        optCtx.imageSmoothingQuality = 'high';
        optCtx.drawImage(tempCanvas, 0, 0, optimizedCanvas.width, optimizedCanvas.height);
      }
    }
    
    // Export as high-quality PNG
    const signatureDataUrl = optimizedCanvas.toDataURL('image/png', 1.0);
    saveSignatureMutation.mutate(signatureDataUrl);
  }, [hasDrawnSignature, saveSignatureMutation]);

  useEffect(() => {
    if (isEditingSignature) {
      setTimeout(() => setupSignatureCanvas(), 100);
    }
  }, [isEditingSignature, setupSignatureCanvas]);

  // Company configuration data
  const [companyData, setCompanyData] = useState({
    name: '',
    cif: '',
    email: '',
    contactName: '',
    companyAlias: '',
    phone: '',
    address: '',
    province: '',
    logoUrl: '',
    // Configuration settings
    defaultVacationDays: 30,
    vacationDaysPerMonth: 2.5,
    workingHoursPerDay: 8,
    // employeeTimeEditPermission movido a sistema de features
  });

  // Query para cargar configuración de la empresa
  const { data: companySettings } = useQuery<any>({
    queryKey: ['/api/settings/work-hours'],
    staleTime: 60000, // Cache for 1 minute
  });

  // Query para cargar políticas de ausencias retribuidas
  const { data: absencePolicies = [], isLoading: absencePoliciesLoading } = useQuery<any[]>({
    queryKey: ['/api/absence-policies'],
    staleTime: 60000,
  });

  // Estado para editar políticas de ausencias
  const [editingPolicies, setEditingPolicies] = useState<Record<number, number | null>>({});

  // Mutación para actualizar política de ausencia
  const updateAbsencePolicyMutation = useMutation({
    mutationFn: async ({ id, maxDays }: { id: number; maxDays: number | null }) => {
      return apiRequest('PATCH', `/api/absence-policies/${id}`, { maxDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/absence-policies'] });
      toast({
        title: 'Política actualizada',
        description: 'Los días de ausencia se han actualizado correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la política.',
        variant: 'destructive',
      });
    },
  });

  // Initialize form data when company data loads
  useEffect(() => {
    if (companySettings) {
      setCompanyData(prev => ({
        ...prev,
        workingHoursPerDay: companySettings.workingHoursPerDay || 8,
        defaultVacationDays: companySettings.defaultVacationDays || 30,
        vacationDaysPerMonth: parseFloat(companySettings.vacationDaysPerMonth || '2.5'),
      }));
    }
  }, [companySettings]);

  useEffect(() => {
    if (company) {
      setCompanyData({
        name: company.name || '',
        cif: company.cif || '',
        email: company.email || '',
        contactName: company.contactName || '',
        companyAlias: company.companyAlias || '',
        phone: company.phone || '',
        address: company.address || '',
        province: company.province || '',
        logoUrl: company.logoUrl || '',
        // employeeTimeEditPermission ahora manejado por sistema de features
        workingHoursPerDay: Number(company.workingHoursPerDay) || 8,
        defaultVacationDays: Number(company.defaultVacationDays) || 30,
        vacationDaysPerMonth: Number(company.vacationDaysPerMonth) || 2.5,
      });
      
      // Clear any preview when company data changes
      setLogoPreview(null);
      setLogoFile(null);
    }
  }, [company]);

  // Initialize profile data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        personalPhone: user.personalPhone || '',
        personalEmail: user.personalEmail || '',
        postalAddress: user.postalAddress || '',
        companyEmail: user.companyEmail || '',
        companyPhone: user.companyPhone || '',
        position: user.position || '',
        emergencyContactName: user.emergencyContactName || '',
        emergencyContactPhone: user.emergencyContactPhone || '',
        startDate: user.startDate || ''
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el perfil');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Perfil actualizado",
        description: "Los cambios se han guardado correctamente",
      });
      setIsEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: typeof companyData) => {
      let logoUrl = data.logoUrl;
      
      // Si hay un nuevo archivo de logo, súbelo primero
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        
        const uploadResponse = await fetch('/api/companies/upload-logo', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Error al subir el logo');
        }
        
        const uploadResult = await uploadResponse.json();
        logoUrl = uploadResult.logoUrl;
      }
      
      const response = await fetch('/api/companies/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ ...data, logoUrl })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al actualizar la empresa');
      }
      
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: 'Empresa actualizada',
        description: 'La información de la empresa ha sido guardada correctamente.',
      });
      setIsEditingCompany(false);
      setLogoFile(null);
      setLogoPreview(null);
      
      // Update company data in the local state immediately to show the logo
      if (data.company) {
        setCompanyData(prev => ({
          ...prev,
          logoUrl: data.company.logoUrl
        }));
      }
      
      // Los días de vacaciones ya se recalculan en el backend cuando se guarda la empresa
      // Solo mostramos el mensaje si hubo recálculo
      if (data.vacationDaysRecalculated) {
        toast({
          title: 'Días de vacaciones recalculados',
          description: `Se actualizaron los días de vacaciones de ${data.vacationDaysRecalculated} empleados`,
        });
      }
      
      // Force immediate refresh of auth data to update company info including logo
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
      
      // Invalidar queries de empleados y vacaciones para actualización inmediata
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      
      // Refresh authentication context to update logo in all components
      refreshUser();
    },
    onError: (error: Error) => {
      const errorMessage = error.message.includes('CIF') 
        ? error.message 
        : 'No se pudo actualizar la empresa. Inténtalo de nuevo.';
      
      toast({
        title: 'Error al actualizar empresa',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  });

  const handleDeleteLogo = async () => {
    setIsUploading(true);
    try {
      const response = await fetch('/api/companies/delete-logo', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar el logo');
      }
      
      // Update local state immediately
      setCompanyData(prev => ({
        ...prev,
        logoUrl: ''
      }));
      
      setLogoPreview(null);
      setLogoFile(null);
      
      toast({
        title: "Logo eliminado",
        description: "El logo de la empresa ha sido eliminado correctamente",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
      // Refresh authentication context to update logo in all components
      refreshUser();
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Schedule account deletion - 30 day grace period
  const deleteAccountMutation = useMutation({
    mutationFn: async (confirmationText: string) => {
      const response = await fetch('/api/account/schedule-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ confirmationText }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al programar la eliminación de la cuenta');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cuenta programada para eliminación",
        description: "Tu cuenta será eliminada en 30 días. Puedes cancelar esta acción desde configuración.",
        variant: "destructive",
      });
      
      // Refresh page to show new status
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al programar eliminación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel scheduled deletion
  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/account/cancel-deletion', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cancelar la eliminación');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Eliminación cancelada",
        description: "La eliminación de tu cuenta ha sido cancelada exitosamente.",
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cancelar eliminación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Employee profile view for non-admin users
  if (user?.role === 'employee') {
    return (
      <div className="bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Mi Perfil</h1>
            <p className="text-gray-600 dark:text-gray-400">Gestiona tu información personal</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-oficaz-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    {user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <CardTitle>{user?.fullName}</CardTitle>
                  <CardDescription>{user?.position || 'Empleado'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company Information (Read-only) */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Información de la empresa</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">DNI</Label>
                    <div className="mt-1 p-3 bg-muted border border-border rounded-lg text-foreground">
                      {user?.dni}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email corporativo</Label>
                    <div className="mt-1 p-3 bg-muted border border-border rounded-lg text-foreground">
                      {user?.companyEmail}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono corporativo</Label>
                    <div className="mt-1 p-3 bg-muted border border-border rounded-lg text-foreground">
                      {user?.companyPhone || 'No asignado'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de incorporación</Label>
                    <div className="mt-1 p-3 bg-muted border border-border rounded-lg text-foreground">
                      {user?.startDate ? new Date(user.startDate).toLocaleDateString('es-ES') : 'No disponible'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Information (Editable) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Información personal</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                  >
                    {isEditingProfile ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                    {isEditingProfile ? 'Cancelar' : 'Editar'}
                  </Button>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="personalEmail">Email personal</Label>
                    {isEditingProfile ? (
                      <Input
                        id="personalEmail"
                        value={profileData.personalEmail}
                        onChange={(e) => setProfileData(prev => ({ ...prev, personalEmail: e.target.value }))}
                        placeholder="tu@email.com"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-muted border border-border rounded-lg text-foreground">
                        {profileData.personalEmail || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="personalPhone">Teléfono personal</Label>
                    {isEditingProfile ? (
                      <Input
                        id="personalPhone"
                        value={profileData.personalPhone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, personalPhone: e.target.value }))}
                        placeholder="+34 600 000 000"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-muted border border-border rounded-lg text-foreground">
                        {profileData.personalPhone || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="postalAddress">Dirección</Label>
                    {isEditingProfile ? (
                      <Textarea
                        id="postalAddress"
                        value={profileData.postalAddress}
                        onChange={(e) => setProfileData(prev => ({ ...prev, postalAddress: e.target.value }))}
                        placeholder="Calle, número, piso, código postal, ciudad"
                        rows={3}
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-muted border border-border rounded-lg text-foreground min-h-[80px]">
                        {profileData.postalAddress || 'No especificada'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="emergencyContactName">Contacto de emergencia</Label>
                    {isEditingProfile ? (
                      <Input
                        id="emergencyContactName"
                        value={profileData.emergencyContactName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                        placeholder="Nombre completo"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-muted border border-border rounded-lg text-foreground">
                        {profileData.emergencyContactName || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="emergencyContactPhone">Teléfono de emergencia</Label>
                    {isEditingProfile ? (
                      <Input
                        id="emergencyContactPhone"
                        value={profileData.emergencyContactPhone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                        placeholder="+34 600 000 000"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-muted border border-border rounded-lg text-foreground">
                        {profileData.emergencyContactPhone || 'No especificado'}
                      </div>
                    )}
                  </div>
                </div>

                {isEditingProfile && (
                  <div className="flex justify-end space-x-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileData({
                          personalPhone: user?.personalPhone || '',
                          personalEmail: user?.personalEmail || '',
                          postalAddress: user?.postalAddress || '',
                          companyEmail: user?.companyEmail || '',
                          companyPhone: user?.companyPhone || '',
                          position: user?.position || '',
                          emergencyContactName: user?.emergencyContactName || '',
                          emergencyContactPhone: user?.emergencyContactPhone || '',
                          startDate: user?.startDate || new Date()
                        });
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => updateProfileMutation.mutate(profileData)}
                      disabled={updateProfileMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateProfileMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Admin/Manager configuration view
  return (
    <div className="bg-background" style={{ overflowX: 'clip' }}>
      {/* Trial Manager - shown only for admins in trial or active accounts (but not blocked) */}
      {user?.role === 'admin' && 
       ((subscription?.status === 'trial' && subscription?.isTrialActive) || 
        (subscription?.status === 'active')) && 
        subscription?.status !== 'blocked' ? (
        <div className="mb-6">
          <TrialManagerSimple />
        </div>
      ) : null}
      <TabNavigation
          tabs={[
            ...(user?.role === 'admin' ? [{ id: 'account', label: 'Mi Cuenta', icon: CreditCard }] : []),
            ...((user?.role === 'admin' || managerCanEditCompany) ? [{ id: 'company', label: 'Empresa', icon: Building2 }] : []),
            { id: 'policies', label: 'Políticas', icon: Shield },
            { id: 'profile', label: 'Mi Perfil', icon: Users },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
      />
      <div className="mt-6">
        {/* Company Information Tab */}
        {activeTab === 'company' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5" />
                      <span>Información de la empresa</span>
                    </CardTitle>
                    <CardDescription>
                      Datos fiscales y de contacto de tu empresa
                    </CardDescription>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-2">
                      {isEditingCompany ? (
                        <>
                          <Button onClick={() => setIsEditingCompany(false)} variant="outline" size="sm">
                            <X className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Cancelar</span>
                          </Button>
                          <Button
                            onClick={() => updateCompanyMutation.mutate(companyData)}
                            disabled={updateCompanyMutation.isPending}
                            size="sm"
                          >
                            <Save className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">
                              {updateCompanyMutation.isPending ? 'Guardando...' : 'Guardar'}
                            </span>
                          </Button>
                        </>
                      ) : (
                        <Button onClick={() => setIsEditingCompany(true)} size="sm">
                          <Edit className="h-4 w-4 md:mr-2" />
                          <span className="hidden md:inline">Editar</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Section */}
                <div>
                  <Label>Logo de la empresa</Label>
                  <div className="mt-2 flex items-center space-x-4">
                    {logoPreview || companyData.logoUrl ? (
                      <div className="w-32 h-16 border rounded-lg bg-white flex items-center justify-center p-2">
                        <img 
                          src={logoPreview || companyData.logoUrl} 
                          alt="Logo de la empresa" 
                          className="max-w-full max-h-full object-contain"
                          onLoad={() => console.log('Logo loaded successfully:', logoPreview || companyData.logoUrl)}
                          onError={(e) => {
                            console.error('Error loading logo:', logoPreview || companyData.logoUrl);
                            console.error('Image element:', e.currentTarget);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-16 bg-gray-100 border-2 border-dashed rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    {/* Logo upload/change */}
                    {isEditingCompany && hasAccess('logoUpload') && (
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('logo-upload')?.click()}
                            className="flex items-center space-x-2"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Subir logo</span>
                          </Button>
                          {(companyData.logoUrl || logoPreview) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCompanyData(prev => ({ ...prev, logoUrl: '' }));
                                setLogoFile(null);
                                setLogoPreview(null);
                              }}
                              className="flex items-center space-x-2 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Eliminar</span>
                            </Button>
                          )}
                        </div>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Validate file size
                              if (file.size > 2 * 1024 * 1024) {
                                toast({
                                  title: 'Archivo demasiado grande',
                                  description: 'El logo debe ser menor a 2MB',
                                  variant: 'destructive'
                                });
                                return;
                              }
                              
                              // Validate file type
                              const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml'];
                              if (!allowedTypes.includes(file.type)) {
                                toast({
                                  title: 'Formato no soportado',
                                  description: 'Solo se permiten archivos JPG, PNG, GIF, SVG',
                                  variant: 'destructive'
                                });
                                return;
                              }
                              
                              setLogoFile(file);
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                setLogoPreview(e.target?.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <div className="space-y-3">
                          <p className="text-xs text-gray-500">
                            Formatos: JPG, PNG, SVG (máx. 2MB)
                          </p>
                          
                          {/* Logo recommendations */}
                          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                            <div className="flex items-start space-x-2 mb-2">
                              <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                              <div className="text-sm">
                                <p className="font-medium text-blue-900 dark:text-blue-200 mb-2">Para que tu logo se vea perfecto en la app, recomendamos usar:</p>
                                <div className="space-y-2">
                                  <div>
                                    <span className="font-medium text-blue-800 dark:text-blue-300">• Logotipo:</span>
                                    <span className="text-blue-700 dark:text-blue-400"> Solo letras, sin imágenes.</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-blue-800 dark:text-blue-300">• Imagotipo:</span>
                                    <span className="text-blue-700 dark:text-blue-400"> Letras junto con un icono, todo en una misma línea.</span>
                                  </div>
                                </div>
                                <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded border border-border flex items-center space-x-2">
                                  <img 
                                    src={oficazLogo} 
                                    alt="Ejemplo de imagotipo" 
                                    className="h-5 w-auto object-contain"
                                  />
                                  <span className="text-xs text-gray-600 dark:text-gray-400">Ejemplo: imagotipo de Oficaz</span>
                                </div>
                                <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-800/30 rounded border border-border">
                                  <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">📏 Tamaño recomendado:</p>
                                  <p className="text-xs text-blue-700 dark:text-blue-300">
                                    • <strong>Ancho:</strong> 200-400 píxeles<br/>
                                    • <strong>Alto:</strong> 60-120 píxeles<br/>
                                    • <strong>Formato:</strong> PNG o SVG para mejor calidad
                                  </p>
                                </div>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                                  Esto asegura que tu logo se vea nítido, se cargue rápido y se ajuste perfectamente en toda la aplicación.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Delete existing logo (available for all plans) */}
                    {isEditingCompany && (logoPreview || companyData.logoUrl) && (
                      <div className="flex-1 space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteLogo}
                          disabled={isUploading}
                          className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar logo
                        </Button>
                      </div>
                    )}
                    {/* Restriction message for users without logo feature */}
                    {!hasAccess('logoUpload') && isEditingCompany && !companyData.logoUrl && (
                      <div className="flex-1">
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            La subida de logos no está disponible en tu configuración actual.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Info for users with existing logo but no upload access */}
                    {!hasAccess('logoUpload') && isEditingCompany && companyData.logoUrl && (
                      <div className="flex-1">
                        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Tu logo actual se mantiene. Contacta con soporte para modificarlo.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="companyName">Nombre de la empresa</Label>
                    {isEditingCompany ? (
                      <Input
                        id="companyName"
                        value={companyData.name}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Mi Empresa S.L."
                        className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                      />
                    ) : (
                      <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 font-medium">
                        {companyData.name || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="companyAlias">Alias de la empresa</Label>
                    <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                      {companyData.companyAlias || 'No especificado'}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Usado en las URLs de la aplicación (no se puede modificar)
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="companyCif">CIF</Label>
                    {isEditingCompany ? (
                      <Input
                        id="companyCif"
                        value={companyData.cif}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, cif: e.target.value }))}
                        placeholder="B12345678"
                        className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                      />
                    ) : (
                      <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                        {companyData.cif || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="contactName">Persona de contacto</Label>
                    {isEditingCompany ? (
                      <Input
                        id="contactName"
                        value={companyData.contactName}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, contactName: e.target.value }))}
                        placeholder="Juan Pérez"
                        className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                      />
                    ) : (
                      <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                        {companyData.contactName || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="companyEmail">Email corporativo / facturación</Label>
                    {isEditingCompany ? (
                      <Input
                        id="companyEmail"
                        type="email"
                        value={companyData.email}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="info@miempresa.com"
                        className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                      />
                    ) : (
                      <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                        {companyData.email || 'No especificado'}
                      </div>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      Este email se usa tanto para comunicaciones corporativas como para facturación
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="companyPhone">Teléfono corporativo</Label>
                    {isEditingCompany ? (
                      <Input
                        id="companyPhone"
                        value={companyData.phone}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+34 900 000 000"
                        className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                      />
                    ) : (
                      <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                        {companyData.phone || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="companyAddress">Dirección fiscal</Label>
                    {isEditingCompany ? (
                      <Textarea
                        id="companyAddress"
                        value={companyData.address}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Calle, número, código postal, ciudad"
                        rows={3}
                        className="mt-1 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                      />
                    ) : (
                      <div className="mt-1 min-h-[80px] flex items-start pt-3 px-3 pb-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                        {companyData.address || 'No especificada'}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="companyProvince">Provincia</Label>
                    {isEditingCompany ? (
                      <Select 
                        value={companyData.province}
                        onValueChange={(value) => setCompanyData(prev => ({ ...prev, province: value }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Seleccionar provincia" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          <SelectItem value="alava">Álava</SelectItem>
                          <SelectItem value="albacete">Albacete</SelectItem>
                          <SelectItem value="alicante">Alicante</SelectItem>
                          <SelectItem value="almeria">Almería</SelectItem>
                          <SelectItem value="asturias">Asturias</SelectItem>
                          <SelectItem value="avila">Ávila</SelectItem>
                          <SelectItem value="badajoz">Badajoz</SelectItem>
                          <SelectItem value="barcelona">Barcelona</SelectItem>
                          <SelectItem value="burgos">Burgos</SelectItem>
                          <SelectItem value="caceres">Cáceres</SelectItem>
                          <SelectItem value="cadiz">Cádiz</SelectItem>
                          <SelectItem value="cantabria">Cantabria</SelectItem>
                          <SelectItem value="castellon">Castellón</SelectItem>
                          <SelectItem value="ceuta">Ceuta</SelectItem>
                          <SelectItem value="ciudad_real">Ciudad Real</SelectItem>
                          <SelectItem value="cordoba">Córdoba</SelectItem>
                          <SelectItem value="cuenca">Cuenca</SelectItem>
                          <SelectItem value="girona">Girona</SelectItem>
                          <SelectItem value="granada">Granada</SelectItem>
                          <SelectItem value="guadalajara">Guadalajara</SelectItem>
                          <SelectItem value="guipuzcoa">Guipúzcoa</SelectItem>
                          <SelectItem value="huelva">Huelva</SelectItem>
                          <SelectItem value="huesca">Huesca</SelectItem>
                          <SelectItem value="islas_baleares">Islas Baleares</SelectItem>
                          <SelectItem value="jaen">Jaén</SelectItem>
                          <SelectItem value="la_coruna">La Coruña</SelectItem>
                          <SelectItem value="la_rioja">La Rioja</SelectItem>
                          <SelectItem value="las_palmas">Las Palmas</SelectItem>
                          <SelectItem value="leon">León</SelectItem>
                          <SelectItem value="lleida">Lleida</SelectItem>
                          <SelectItem value="lugo">Lugo</SelectItem>
                          <SelectItem value="madrid">Madrid</SelectItem>
                          <SelectItem value="malaga">Málaga</SelectItem>
                          <SelectItem value="melilla">Melilla</SelectItem>
                          <SelectItem value="murcia">Murcia</SelectItem>
                          <SelectItem value="navarra">Navarra</SelectItem>
                          <SelectItem value="ourense">Ourense</SelectItem>
                          <SelectItem value="palencia">Palencia</SelectItem>
                          <SelectItem value="pontevedra">Pontevedra</SelectItem>
                          <SelectItem value="salamanca">Salamanca</SelectItem>
                          <SelectItem value="santa_cruz_tenerife">Santa Cruz de Tenerife</SelectItem>
                          <SelectItem value="segovia">Segovia</SelectItem>
                          <SelectItem value="sevilla">Sevilla</SelectItem>
                          <SelectItem value="soria">Soria</SelectItem>
                          <SelectItem value="tarragona">Tarragona</SelectItem>
                          <SelectItem value="teruel">Teruel</SelectItem>
                          <SelectItem value="toledo">Toledo</SelectItem>
                          <SelectItem value="valencia">Valencia</SelectItem>
                          <SelectItem value="valladolid">Valladolid</SelectItem>
                          <SelectItem value="vizcaya">Vizcaya</SelectItem>
                          <SelectItem value="zamora">Zamora</SelectItem>
                          <SelectItem value="zaragoza">Zaragoza</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                        {companyData.province ? companyData.province.charAt(0).toUpperCase() + companyData.province.slice(1).replace('_', ' ') : 'No especificada'}
                      </div>
                    )}
                  </div>
                </div>

              </CardContent>
            </Card>
          )}

          {/* Company Policies Tab */}
          {activeTab === 'policies' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <Clock className="h-5 w-5" />
                        <span>Horarios</span>
                      </CardTitle>
                      <CardDescription>
                        Jornada laboral de la empresa
                      </CardDescription>
                    </div>
                    {user?.role === 'admin' && Number(companyData.workingHoursPerDay) !== Number(company?.workingHoursPerDay || 8) && (
                      <Button
                        size="sm"
                        onClick={() => updateCompanyMutation.mutate(companyData)}
                        disabled={updateCompanyMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateCompanyMutation.isPending ? 'Guardando...' : 'Guardar'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {user?.role === 'manager' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-amber-600" />
                        <p className="text-sm text-amber-700">
                          <strong>Acceso de solo lectura:</strong> Como manager, puedes ver estas configuraciones pero solo los administradores pueden modificarlas.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <Label htmlFor="workingHours" className="text-base font-medium text-gray-900 dark:text-gray-100">
                          Horas por día
                        </Label>
                      </div>
                      <Input
                        id="workingHours"
                        type="number"
                        step="0.5"
                        min="1"
                        max="12"
                        value={companyData.workingHoursPerDay}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, workingHoursPerDay: parseFloat(e.target.value) || 8 }))}
                        className="text-lg h-12 font-medium"
                        disabled={user?.role !== 'admin'}
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Por ejemplo: 8 horas, 7.5 horas
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-5">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center">
                          <Calculator className="h-4 w-4 text-white" />
                        </div>
                        <Label className="text-base font-medium text-gray-900 dark:text-gray-100">
                          Horas semanales calculadas
                        </Label>
                      </div>
                      <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                        {(companyData.workingHoursPerDay * 5).toFixed(1).replace(/\.0$/, '')}
                        <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-2">horas</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {companyData.workingHoursPerDay} horas × 5 días
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <CalendarIcon className="h-5 w-5" />
                        <span>Vacaciones</span>
                      </CardTitle>
                      <CardDescription>Política de vacaciones según normativa</CardDescription>
                    </div>
                    {user?.role === 'admin' && Number(companyData.vacationDaysPerMonth) !== Number(company?.vacationDaysPerMonth || 2.5) && (
                      <Button
                        size="sm"
                        onClick={() => updateCompanyMutation.mutate(companyData)}
                        disabled={updateCompanyMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateCompanyMutation.isPending ? 'Guardando...' : 'Guardar'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-blue-900 dark:text-blue-100">Normativa española</span>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      El sistema calcula automáticamente los días de vacaciones desde la fecha de incorporación del empleado.
                      El mínimo legal son 22 días laborables (30 días naturales = 2.5 días por mes).
                    </p>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                          <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <Label htmlFor="vacationDaysPerMonth" className="text-base font-medium text-gray-900 dark:text-gray-100">
                          Días por mes trabajado
                        </Label>
                      </div>
                      <Input
                        id="vacationDaysPerMonth"
                        type="number"
                        step="0.1"
                        min="1.8"
                        max="3"
                        value={companyData.vacationDaysPerMonth}
                        onChange={(e) => {
                          const daysPerMonth = parseFloat(e.target.value) || 2.5;
                          const annualDays = Math.round(daysPerMonth * 12);
                          setCompanyData(prev => ({ 
                            ...prev, 
                            vacationDaysPerMonth: daysPerMonth,
                            defaultVacationDays: annualDays
                          }));
                        }}
                        className="text-lg h-12 font-medium"
                        disabled={user?.role !== 'admin'}
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Estándar: 2.5 días · Mínimo legal: 1.83 días
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800/50 rounded-xl p-5">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                          <Calculator className="h-4 w-4 text-white" />
                        </div>
                        <Label className="text-base font-medium text-gray-900 dark:text-gray-100">
                          Días anuales calculados
                        </Label>
                      </div>
                      <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                        {Math.round(companyData.vacationDaysPerMonth * 12)}
                        <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-2">días</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {companyData.vacationDaysPerMonth} días × 12 meses
                      </p>
                    </div>
                  </div>

                </CardContent>
              </Card>

              {/* Ausencias Retribuidas Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="h-5 w-5" />
                        <span>Ausencias Retribuidas</span>
                      </CardTitle>
                      <CardDescription>Días por defecto según convenio (no afectan vacaciones)</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {user?.role === 'manager' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-amber-600" />
                        <p className="text-sm text-amber-700">
                          <strong>Acceso de solo lectura:</strong> Como manager, puedes ver estas configuraciones pero solo los administradores pueden modificarlas.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="font-medium text-purple-900 dark:text-purple-100">Permisos según ley</span>
                    </div>
                    <p className="text-sm text-purple-800 dark:text-purple-300">
                      Los días de cada tipo de ausencia se calculan automáticamente según la normativa española. 
                      Puedes ajustar los días si tu convenio colectivo es más favorable.
                    </p>
                  </div>

                  {absencePoliciesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {absencePolicies
                        .filter((p: any) => p.absenceType !== 'vacation' && p.isActive)
                        .map((policy: any) => (
                          <div 
                            key={policy.id} 
                            className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {policy.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {policy.requiresAttachment ? 'Requiere justificante' : 'Sin justificante obligatorio'}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {user?.role === 'admin' ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    max="365"
                                    placeholder="∞"
                                    className="w-20 h-10 text-center font-medium"
                                    value={editingPolicies[policy.id] !== undefined 
                                      ? (editingPolicies[policy.id] ?? '') 
                                      : (policy.maxDays ?? '')}
                                    onChange={(e) => {
                                      const value = e.target.value === '' ? null : parseInt(e.target.value);
                                      setEditingPolicies(prev => ({ ...prev, [policy.id]: value }));
                                    }}
                                  />
                                  <span className="text-gray-500 dark:text-gray-400 text-sm">días</span>
                                  {editingPolicies[policy.id] !== undefined && 
                                   editingPolicies[policy.id] !== policy.maxDays && (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        updateAbsencePolicyMutation.mutate({ 
                                          id: policy.id, 
                                          maxDays: editingPolicies[policy.id] 
                                        });
                                        setEditingPolicies(prev => {
                                          const newState = { ...prev };
                                          delete newState[policy.id];
                                          return newState;
                                        });
                                      }}
                                      disabled={updateAbsencePolicyMutation.isPending}
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                  {policy.maxDays ? `${policy.maxDays} días` : 'Sin límite'}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          )}

          {/* Personal Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="h-5 w-5" />
                      <span>Mi perfil personal</span>
                    </CardTitle>
                    <CardDescription className="hidden md:block">
                      Tu información personal como administrador
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditingProfile ? (
                      <>
                        <Button onClick={() => setIsEditingProfile(false)} variant="outline" size="sm">
                          <X className="h-4 w-4 md:mr-2" />
                          <span className="hidden md:inline">Cancelar</span>
                        </Button>
                        <Button
                          onClick={() => updateProfileMutation.mutate(profileData)}
                          disabled={updateProfileMutation.isPending}
                          size="sm"
                        >
                          <Save className="h-4 w-4 md:mr-2" />
                          <span className="hidden md:inline">
                            {updateProfileMutation.isPending ? 'Guardando...' : 'Guardar'}
                          </span>
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => setIsEditingProfile(true)} size="sm">
                        <Edit className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">Editar perfil</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* User info header */}
                <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                  <UserAvatar
                    userId={user?.id || 0}
                    fullName={user?.fullName || ''}
                    profilePicture={user?.profilePicture}
                    size="lg"
                    showUpload={true}
                  />
                  <div>
                    <h3 className="font-medium text-[#0ea5e9]">{user?.fullName}</h3>
                    <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                      <Badge variant="secondary" className="self-start">
                        {translateRole(user?.role)}
                      </Badge>
                      <span className="text-sm text-gray-500">DNI: {user?.dni}</span>
                    </div>
                  </div>
                </div>

                {/* Editable profile info - expanded with all fields */}
                <div className="space-y-6">
                  {/* Información corporativa */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Información corporativa</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="adminCompanyEmail">Email corporativo</Label>
                        {isEditingProfile ? (
                          <Input
                            id="adminCompanyEmail"
                            value={profileData.companyEmail}
                            onChange={(e) => setProfileData(prev => ({ ...prev, companyEmail: e.target.value }))}
                            placeholder="admin@empresa.com"
                            className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                          />
                        ) : (
                          <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                            {profileData.companyEmail || 'No especificado'}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="adminCompanyPhone">Teléfono corporativo</Label>
                        {isEditingProfile ? (
                          <Input
                            id="adminCompanyPhone"
                            value={profileData.companyPhone}
                            onChange={(e) => setProfileData(prev => ({ ...prev, companyPhone: e.target.value }))}
                            placeholder="+34 900 000 000"
                            className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                          />
                        ) : (
                          <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                            {profileData.companyPhone || 'No especificado'}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="adminPosition">Cargo/Puesto</Label>
                        {isEditingProfile ? (
                          <Input
                            id="adminPosition"
                            value={profileData.position}
                            onChange={(e) => setProfileData(prev => ({ ...prev, position: e.target.value }))}
                            placeholder="Director General, Administrador, etc."
                            className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                          />
                        ) : (
                          <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                            {profileData.position || 'No especificado'}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="adminStartDate">Fecha de incorporación</Label>
                        {isEditingProfile ? (
                          <DatePickerDayEmployee
                            date={profileData.startDate ? new Date(profileData.startDate) : undefined}
                            onDateChange={(date) => {
                              if (date) {
                                setProfileData(prev => ({ ...prev, startDate: date.toISOString() }));
                              }
                            }}
                            placeholder="Selecciona fecha de incorporación"
                            className="mt-1 h-12"
                          />
                        ) : (
                          <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                            {profileData.startDate ? 
                              format(new Date(profileData.startDate), 'PPP', { locale: es }) : 
                              'No especificada'
                            }
                          </div>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Para calcular tus días de vacaciones correctamente
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Información personal */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Información personal</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="adminPersonalEmail">Email personal</Label>
                        {isEditingProfile ? (
                          <Input
                            id="adminPersonalEmail"
                            value={profileData.personalEmail}
                            onChange={(e) => setProfileData(prev => ({ ...prev, personalEmail: e.target.value }))}
                            placeholder="tu@email.com"
                            className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                          />
                        ) : (
                          <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                            {profileData.personalEmail || 'No especificado'}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="adminPersonalPhone">Teléfono personal</Label>
                        {isEditingProfile ? (
                          <Input
                            id="adminPersonalPhone"
                            value={profileData.personalPhone}
                            onChange={(e) => setProfileData(prev => ({ ...prev, personalPhone: e.target.value }))}
                            placeholder="+34 600 000 000"
                            className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                          />
                        ) : (
                          <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                            {profileData.personalPhone || 'No especificado'}
                          </div>
                        )}
                      </div>
                      
                      <div className="md:col-span-2">
                        <Label htmlFor="adminPostalAddress">Dirección personal</Label>
                        {isEditingProfile ? (
                          <Textarea
                            id="adminPostalAddress"
                            value={profileData.postalAddress}
                            onChange={(e) => setProfileData(prev => ({ ...prev, postalAddress: e.target.value }))}
                            placeholder="Calle, número, piso, código postal, ciudad"
                            rows={3}
                            className="mt-1 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                          />
                        ) : (
                          <div className="mt-1 min-h-[80px] flex items-start pt-3 px-3 pb-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                            {profileData.postalAddress || 'No especificada'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contacto de emergencia */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Contacto de emergencia</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="adminEmergencyContactName">Nombre del contacto</Label>
                        {isEditingProfile ? (
                          <Input
                            id="adminEmergencyContactName"
                            value={profileData.emergencyContactName}
                            onChange={(e) => setProfileData(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                            placeholder="Nombre completo"
                            className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                          />
                        ) : (
                          <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                            {profileData.emergencyContactName || 'No especificado'}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="adminEmergencyContactPhone">Teléfono de emergencia</Label>
                        {isEditingProfile ? (
                          <Input
                            id="adminEmergencyContactPhone"
                            value={profileData.emergencyContactPhone}
                            onChange={(e) => setProfileData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                            placeholder="+34 600 000 000"
                            className="mt-1 h-12 bg-white dark:bg-gray-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                          />
                        ) : (
                          <div className="mt-1 h-12 flex items-center px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                            {profileData.emergencyContactPhone || 'No especificado'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Firma Digital */}
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-3 flex items-center">
                      <PenTool className="h-5 w-5 mr-2" />
                      Mi Firma Digital
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Tu firma se usará para firmar documentos, nóminas, circulares y partes de trabajo
                    </p>

                    {signatureLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner size="lg" />
                      </div>
                    ) : !isEditingSignature ? (
                      <div className="space-y-4">
                        {savedSignatureUrl ? (
                          <div className="relative border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6 flex items-center justify-center min-h-[120px]">
                            <img 
                              src={savedSignatureUrl} 
                              alt="Tu firma" 
                              className="max-h-20 max-w-full object-contain dark:invert dark:brightness-90"
                            />
                          </div>
                        ) : (
                          <div className="relative border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 p-8 flex flex-col items-center justify-center min-h-[120px]">
                            <PenTool className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                              No tienes firma guardada
                            </p>
                          </div>
                        )}
                        
                        {/* Condiciones legales */}
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                          <div className="flex items-start gap-2">
                            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                Condiciones de uso de tu firma digital:
                              </p>
                              <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                                <li>Tu firma solo se utilizará con tu consentimiento expreso en cada documento</li>
                                <li>La empresa no puede usar tu firma sin tu autorización previa</li>
                                <li>Para firmar cualquier documento deberás confirmar el uso de tu firma almacenada</li>
                                <li>Puedes modificar o eliminar tu firma en cualquier momento</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <Button
                            onClick={() => setIsEditingSignature(true)}
                            className="bg-blue-500 hover:bg-blue-600 text-white"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {savedSignatureUrl ? 'Cambiar Firma' : 'Crear Firma'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dibuja tu nueva firma:</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearSignatureCanvas}
                            disabled={!hasDrawnSignature}
                            className="h-8 px-3 text-xs"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Limpiar
                          </Button>
                        </div>
                        
                        <div className="relative border rounded-lg bg-white border-gray-300 dark:border-gray-600">
                          <canvas
                            ref={signatureCanvasRef}
                            width={600}
                            height={200}
                            className="w-full h-40 touch-none cursor-crosshair rounded-lg"
                            style={{ 
                              touchAction: 'none',
                              WebkitUserSelect: 'none',
                              userSelect: 'none'
                            }}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                          />
                          {!hasDrawnSignature && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <p className="text-gray-400 text-sm">
                                Usa tu dedo o ratón para firmar aquí
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Aviso legal al crear firma */}
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start gap-2">
                            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                              Al guardar tu firma, aceptas que se almacenará de forma segura y solo se utilizará 
                              con tu consentimiento explícito para firmar documentos laborales.
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-between space-x-4">
                          <Button
                            onClick={() => {
                              setIsEditingSignature(false);
                              setHasDrawnSignature(false);
                            }}
                            variant="outline"
                            className="flex-1"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleSaveSignature}
                            disabled={!hasDrawnSignature || saveSignatureMutation.isPending}
                            className="bg-green-500 hover:bg-green-600 text-white flex-1"
                          >
                            {saveSignatureMutation.isPending ? (
                              <LoadingSpinner size="sm" className="text-white mr-2" />
                            ) : (
                              <Check className="h-4 w-4 mr-2" />
                            )}
                            Guardar Firma
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cambiar contraseña */}
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-3 flex items-center">
                      <Key className="h-5 w-5 mr-2" />
                      Seguridad
                    </h3>
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <Label className="text-sm font-medium text-foreground">Cambiar contraseña</Label>
                        <p className="text-sm text-muted-foreground">
                          Actualiza tu contraseña para mantener tu cuenta segura
                        </p>
                      </div>
                      <ChangePasswordModalComponent />
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          )}

          {/* Account Management Tab */}
        {activeTab === 'account' && (
          <AccountManagement />
        )}
      </div>
    </div>
  );
}