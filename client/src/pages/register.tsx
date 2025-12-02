import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/use-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Building, User, Eye, EyeOff, Users, CheckCircle, XCircle, ArrowRight, ArrowLeft, Calendar, FileText, MessageSquare, Shield, Star, Crown } from 'lucide-react';

import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@assets/oficaz logo_1750516757063.png';
import { useAuth } from '@/hooks/use-auth';
import { DemoLoadingOverlay } from '@/components/demo-loading-overlay';

// Validation function for company uniqueness
const validateCompanyField = async (field: string, value: string) => {
  try {
    const response = await apiRequest('POST', '/api/validate-company', { field, value });
    console.log(`Validation for ${field} with value "${value}":`, response);
    return response.available;
  } catch (error) {
    console.error('Validation error:', error);
    return true; // Allow if validation fails
  }
};

// Validation function for user uniqueness
const validateUserField = async (field: string, value: string) => {
  try {
    const response = await apiRequest('POST', '/api/validate-user', { field, value });
    console.log(`User validation for ${field} with value "${value}":`, response);
    return response.available;
  } catch (error) {
    console.error('User validation error:', error);
    return true; // Allow if validation fails
  }
};

// All available features with pricing and inclusion status
const allFeatures = [
  { id: 'timeTracking', name: 'Fichajes', icon: Calendar, description: 'Control de horarios y asistencia de empleados', included: true, price: 0 },
  { id: 'schedules', name: 'Cuadrante', icon: Calendar, description: 'Planificación de turnos y horarios de trabajo', included: true, price: 0 },
  { id: 'vacation', name: 'Vacaciones', icon: Calendar, description: 'Gestión de solicitudes y aprobación de vacaciones', included: true, price: 0 },
  { id: 'messages', name: 'Mensajería Interna', icon: MessageSquare, description: 'Comunicación directa entre empleados y gestores', included: false, price: 5 },
  { id: 'reminders', name: 'Recordatorios', icon: Calendar, description: 'Alertas y notificaciones automáticas', included: false, price: 5 },
  { id: 'documents', name: 'Gestión Documental', icon: FileText, description: 'Almacenamiento y gestión de documentos', included: false, price: 10 },
  { id: 'workReports', name: 'Partes de Trabajo', icon: FileText, description: 'Registro detallado de actividades laborales', included: false, price: 8 },
  { id: 'aiAssistant', name: 'OficazIA', icon: Star, description: 'Asistente inteligente para gestión administrativa', included: false, price: 15 },
];

// Step schemas for validation (5 steps)
const step1Schema = z.object({
  interestedFeatures: z.array(z.string()).optional(),
});

const step2Schema = z.object({
  teamSize: z.string().min(1, 'Selecciona el tamaño aproximado de tu equipo'),
});

const step3Schema = z.object({
  companyName: z.string().min(2, 'El nombre de la empresa debe tener al menos 2 caracteres'),
  cif: z.string().min(9, 'El CIF debe tener al menos 9 caracteres'),
  companyEmail: z.string().email('Email no válido'),
  companyAlias: z.string()
    .min(3, 'El alias debe tener al menos 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo se permiten letras minúsculas, números y guiones'),
  province: z.string().min(1, 'Selecciona una provincia'),
});

const step4Schema = z.object({
  adminFullName: z.string().min(2, 'El nombre completo debe tener al menos 2 caracteres'),
  adminEmail: z.string().email('Email no válido'),
  adminDni: z.string().min(8, 'El DNI/NIE es requerido'),
  adminPhone: z.string().min(9, 'El teléfono debe tener al menos 9 dígitos'),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula') 
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial'),
  confirmPassword: z.string().min(8, 'Confirma tu contraseña'),
  sameAsAdmin: z.boolean().default(true),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
}).refine((data) => {
  if (!data.sameAsAdmin && !data.contactName) {
    return false;
  }
  return true;
}, {
  message: 'El nombre de contacto es requerido cuando no es el mismo administrador',
  path: ['contactName'],
});

const step5Schema = z.object({
  selectedPlan: z.string().default('oficaz'),
  promotionalCode: z.string().optional(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos y condiciones para continuar',
  }),
  acceptMarketing: z.boolean().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Step4Data = z.infer<typeof step4Schema>;
type Step5Data = z.infer<typeof step5Schema>;

type FormData = Step1Data & Step2Data & Step3Data & Step4Data & Step5Data;

interface RegisterProps {
  byInvitation?: boolean;
  invitationEmail?: string;
  invitationToken?: string;
  invitationWelcomeMessage?: string;
}

export default function Register({ byInvitation = false, invitationEmail, invitationToken, invitationWelcomeMessage }: RegisterProps = {}) {
  usePageTitle('Registrarse');
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { register } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [validatingStep2, setValidatingStep2] = useState(false);
  const [validatingStep3, setValidatingStep3] = useState(false);
  const [formData, setFormData] = useState<Partial<FormData>>({
    interestedFeatures: [],
    sameAsAdmin: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showDemoLoading, setShowDemoLoading] = useState(false);
  const [isBackendComplete, setIsBackendComplete] = useState(false);
  const [promoCodeValidation, setPromoCodeValidation] = useState<{ status: 'idle' | 'checking' | 'valid' | 'invalid', message?: string, trialDays?: number }>({ status: 'idle' });

  // Check for verification token (only if not by invitation)
  const params = new URLSearchParams(search);
  const verificationToken = params.get('token');
  const emailFromUrl = params.get('email') || ''; // Get email from URL parameters, fallback to empty string
  
  useEffect(() => {
    if (!byInvitation && !verificationToken) {
      // Clear any loading states and redirect only if not invitation
      setIsLoading(false);
      setValidatingStep2(false);
      setValidatingStep3(false);
      // Use setTimeout to avoid immediate redirect during render
      const timer = setTimeout(() => {
        setLocation('/request-code', { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [verificationToken, byInvitation, setLocation]);

  // Set dark notch for dark background
  useEffect(() => {
    document.documentElement.classList.add('dark-notch');
    return () => {
      document.documentElement.classList.remove('dark-notch');
    };
  }, []);

  // Don't render if no token and not by invitation
  if (!byInvitation && !verificationToken) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-white">Redirigiendo...</div>
    </div>;
  }

  // Step 1 form - Features selection
  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      interestedFeatures: [],
    },
  });

  // Step 2 form - Team size
  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      teamSize: '',
    },
  });

  // Step 3 form - Company data
  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      companyName: '',
      cif: '',
      companyEmail: '',
      companyAlias: '',
      province: '',
    },
  });

  // Step 4 form - Admin data
  const step4Form = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      adminFullName: '',
      adminEmail: emailFromUrl || '',
      adminDni: '',
      adminPhone: '',
      password: '',
      confirmPassword: '',
      sameAsAdmin: true,
      contactName: '',
      contactPhone: '',
      contactEmail: '',
    },
  });

  // Step 5 form - Summary and confirmation
  const step5Form = useForm<Step5Data>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      selectedPlan: 'oficaz',
      promotionalCode: '',
      acceptTerms: false,
      acceptMarketing: false,
    },
  });

  const progressPercentage = (currentStep / 5) * 100;

  const teamSizes = [
    { value: '1-5', label: '1-5 personas', description: 'Pequeño equipo' },
    { value: '6-15', label: '6-15 personas', description: 'Equipo mediano' },
    { value: '16-50', label: '16-50 personas', description: 'Empresa mediana' },
    { value: '51+', label: '51+ personas', description: 'Gran empresa' },
  ];

  // Validation function for promotional codes
  const validatePromotionalCode = async (code: string) => {
    if (!code || code.trim() === '') {
      setPromoCodeValidation({ status: 'idle' });
      return;
    }
    
    try {
      setPromoCodeValidation({ status: 'checking' });
      const response = await apiRequest('POST', '/api/validate-promotional-code', { code: code.trim() });
      
      if (response.valid) {
        setPromoCodeValidation({ 
          status: 'valid', 
          message: response.message || `Código válido! Tendrás ${response.trialDays} días de prueba gratuitos`,
          trialDays: response.trialDays 
        });
      } else {
        setPromoCodeValidation({ 
          status: 'invalid', 
          message: response.message || 'Código promocional no válido' 
        });
      }
    } catch (error) {
      setPromoCodeValidation({ 
        status: 'invalid', 
        message: 'Error al verificar el código. Inténtalo de nuevo.' 
      });
    }
  };

  // Step 1: Features selection - just save and continue
  const handleStep1Submit = (data: Step1Data) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  // Step 2: Team size - just save and continue
  const handleStep2Submit = (data: Step2Data) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentStep(3);
  };

  // Step 3: Company data - validate uniqueness and continue
  const handleStep3Submit = async (data: Step3Data) => {
    try {
      setValidatingStep2(true);
      
      const validations = await Promise.all([
        validateCompanyField('name', data.companyName),
        validateCompanyField('cif', data.cif),
        validateCompanyField('billingEmail', data.companyEmail),
        validateCompanyField('alias', data.companyAlias),
      ]);

      const [nameAvailable, cifAvailable, emailAvailable, aliasAvailable] = validations;

      if (!nameAvailable) {
        step3Form.setError('companyName', { message: 'Ya existe una empresa con este nombre' });
        return;
      }
      if (!cifAvailable) {
        step3Form.setError('cif', { message: 'Este CIF ya está registrado' });
        return;
      }
      if (!emailAvailable) {
        step3Form.setError('companyEmail', { message: 'Este email ya está en uso' });
        return;
      }
      if (!aliasAvailable) {
        step3Form.setError('companyAlias', { message: 'Este alias ya está en uso' });
        return;
      }

      setFormData(prev => ({ ...prev, ...data }));
      setCurrentStep(4);
    } catch (error) {
      console.error("Validation error:", "Error al verificar los datos. Inténtalo de nuevo.");
    } finally {
      setValidatingStep2(false);
    }
  };

  // Step 4: Admin data - validate uniqueness and continue
  const handleStep4Submit = async (data: Step4Data) => {
    try {
      setValidatingStep3(true);
      
      const emailAvailable = await validateUserField('email', data.adminEmail);

      if (!emailAvailable) {
        step4Form.setError('adminEmail', { message: 'Este email ya está registrado' });
        return;
      }

      setFormData(prev => ({ ...prev, ...data }));
      setCurrentStep(5);
    } catch (error: any) {
      console.error('Validation error:', error.message || 'Error al verificar los datos');
    } finally {
      setValidatingStep3(false);
    }
  };

  // Step 5: Summary and confirmation - final submit
  const handleStep5Submit = async (data: Step5Data) => {
    try {
      setIsLoading(true);
      setShowDemoLoading(true);
      setIsBackendComplete(false); // Reset completion state
      
      // Extract campaign tracking parameters from URL
      const urlParams = new URLSearchParams(search);
      const campaignId = urlParams.get('campaign');
      const registrationSource = urlParams.get('source') || 'direct';
      
      // Prepare final registration data
      const finalData = { 
        ...formData, 
        ...data,
        verificationToken: byInvitation ? null : verificationToken,
        invitationToken: byInvitation ? invitationToken : null,
        // Set contactName to adminFullName if sameAsAdmin is true
        contactName: formData.sameAsAdmin ? formData.adminFullName : formData.contactName,
        // 📊 Email marketing conversion tracking
        campaignId: campaignId,
        source: registrationSource,
      };
      
      console.log('Final registration data:', finalData);
      if (campaignId) {
        console.log(`📊 Registration from email campaign: ${campaignId} (source: ${registrationSource})`);
      }
      
      try {
        await register(finalData);
        console.log('Registration successful - backend complete');
        // Set flag to show welcome modal on dashboard
        localStorage.setItem('showWelcomeModal', 'true');
        // Signal that backend is complete - overlay will finish animation and redirect
        setIsBackendComplete(true);
      } catch (error: any) {
        console.error('Registration failed:', error);
        setShowDemoLoading(false);
        setIsBackendComplete(false);
        
        // Handle scheduled deletion conflicts specially
        if (error.message && error.message.includes('programada para eliminación')) {
          const isEmailConflict = error.message.includes('email');
          const isCifConflict = error.message.includes('CIF');
          
          const restoreMessage = isEmailConflict 
            ? 'Si eres el administrador original, puedes restaurar tu cuenta haciendo login en lugar de crear una nueva empresa.'
            : 'El administrador original puede restaurar la cuenta haciendo login en lugar de crear una nueva empresa.';
            
          alert(`${error.message}\n\n${restoreMessage}\n\nSi necesitas ayuda, contacta con soporte técnico.`);
        } else {
          alert('Error al crear la empresa: ' + (error.message || 'Inténtalo de nuevo'));
        }
      }
    } catch (error: any) {
      console.error('Registration error:', error.message || 'Ha ocurrido un error durante el registro');
      setShowDemoLoading(false);
      setIsBackendComplete(false);
      
      // Handle scheduled deletion conflicts specially
      if (error.message && error.message.includes('programada para eliminación')) {
        const isEmailConflict = error.message.includes('email');
        const isCifConflict = error.message.includes('CIF');
        
        const restoreMessage = isEmailConflict 
          ? 'Si eres el administrador original, puedes restaurar tu cuenta haciendo login en lugar de crear una nueva empresa.'
          : 'El administrador original puede restaurar la cuenta haciendo login en lugar de crear una nueva empresa.';
          
        alert(`${error.message}\n\n${restoreMessage}\n\nSi necesitas ayuda, contacta con soporte técnico.`);
      } else {
        // Show user-friendly error message
        alert('Error al crear la empresa: ' + (error.message || 'Inténtalo de nuevo'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  // Fetch subscription plans and filter out Master plan for now
  const { data: allSubscriptionPlans = [] } = useQuery({
    queryKey: ['/api/public/subscription-plans'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Filter out Master plan from wizard
  const subscriptionPlans = (allSubscriptionPlans as any[]).filter((plan: any) => plan.name !== 'master');

  // Plan recommendation logic based on step 1 answers
  const getRecommendedPlan = () => {
    const { teamSize, interestedFeatures } = formData;
    
    // ⚠️ PROTECTED: Critical business logic - DO NOT MODIFY
    // Direct PRO recommendation for premium features
    if (interestedFeatures?.includes('documents') || interestedFeatures?.includes('messages')) {
      return 'pro'; // Documents or messages = PRO plan automatically
    }
    
    // Advanced scoring system that considers functionality needs
    let score = 0;
    
    // Team size scoring (balanced approach)
    if (teamSize === '1-5') score += 2;
    else if (teamSize === '6-15') score += 3;
    else if (teamSize === '16-50') score += 4;
    else if (teamSize === '51+') score += 5;
    
    // Features scoring (more weight for functionality needs)
    const featureCount = interestedFeatures?.length || 0;
    if (featureCount >= 5) score += 4; // Many features = advanced needs
    else if (featureCount >= 4) score += 3;
    else if (featureCount >= 3) score += 2;
    else if (featureCount >= 2) score += 1;
    
    // Advanced features boost (premium functionality indicators)
    if (interestedFeatures?.includes('reports')) score += 2;
    if (interestedFeatures?.includes('notifications')) score += 1;
    
    // Intelligent recommendation logic
    // Consider both team size and feature complexity
    if (score >= 8) return 'pro'; // High needs regardless of team size
    else if (score >= 6 && featureCount >= 4) return 'pro'; // Medium-high needs with many features
    else if (score >= 5 && featureCount >= 3) return 'pro'; // Medium needs with several features
    else return 'basic'; // Low complexity needs
  };

  const recommendedPlan = getRecommendedPlan();

  return (
    <div
      className="min-h-screen flex items-center justify-center py-4 md:py-12 px-4 sm:px-6 lg:px-8"
      style={{
        background: `radial-gradient(circle at center, #323A46, #232B36)`,
      }}
    >
      <Card className="w-full max-w-3xl shadow-2xl rounded-xl md:rounded-2xl">
        <CardHeader className="space-y-4">
          {/* Mobile optimized header */}
          <div className="text-center">
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-6 md:h-8 w-auto mx-auto mb-3"
            />
            
            {/* Mensaje de bienvenida para invitaciones */}
            {byInvitation && invitationWelcomeMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{invitationWelcomeMessage}</span>
                </div>
              </div>
            )}
            
            <CardTitle className="text-lg md:text-xl font-semibold text-gray-900">Configurar tu empresa</CardTitle>
            <CardDescription className="text-xs md:text-sm text-gray-600 mt-1">
              Proceso rápido en 5 pasos - Solo toma un minuto
            </CardDescription>
          </div>
          
          {/* Progress bar */}
          <div className="w-full">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs md:text-sm font-medium text-gray-500">Paso {currentStep} de 5</span>
              <span className="text-xs md:text-sm font-medium text-gray-500">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-1.5 md:h-2" />
          </div>

          {/* Step indicators - 5 steps */}
          <div className="flex justify-center items-center space-x-2 md:space-x-4">
            <div className={`flex items-center space-x-1 ${currentStep >= 1 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 text-xs ${
                currentStep >= 1 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                {currentStep > 1 ? <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3" /> : '1'}
              </div>
              <span className="text-xs font-medium hidden md:block">Funciones</span>
            </div>
            <div className={`flex items-center space-x-1 ${currentStep >= 2 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 text-xs ${
                currentStep >= 2 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                {currentStep > 2 ? <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3" /> : '2'}
              </div>
              <span className="text-xs font-medium hidden md:block">Equipo</span>
            </div>
            <div className={`flex items-center space-x-1 ${currentStep >= 3 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 text-xs ${
                currentStep >= 3 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                {currentStep > 3 ? <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3" /> : '3'}
              </div>
              <span className="text-xs font-medium hidden md:block">Empresa</span>
            </div>
            <div className={`flex items-center space-x-1 ${currentStep >= 4 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 text-xs ${
                currentStep >= 4 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                {currentStep > 4 ? <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3" /> : '4'}
              </div>
              <span className="text-xs font-medium hidden md:block">Admin</span>
            </div>
            <div className={`flex items-center space-x-1 ${currentStep >= 5 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 text-xs ${
                currentStep >= 5 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                5
              </div>
              <span className="text-xs font-medium hidden md:block">Confirmar</span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Step 1: Features selection */}
          {currentStep === 1 && (
            <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-6">
              <div className="text-center mb-4">
                <Star className="h-6 w-6 md:h-8 md:w-8 text-oficaz-primary mx-auto mb-2" />
                <h3 className="text-sm md:text-base font-semibold mb-1">¿Qué funcionalidades te interesan?</h3>
                <p className="text-xs text-gray-600">Selecciona las que quieras probar. Durante el trial tendrás acceso a todas.</p>
              </div>

              {/* Included features section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Incluido</Badge>
                  <span className="text-xs text-gray-600">Estas funciones están incluidas en tu suscripción</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {allFeatures.filter(f => f.included).map((feature) => {
                    const Icon = feature.icon;
                    const selectedFeatures = step1Form.watch('interestedFeatures') || [];
                    const isSelected = selectedFeatures.includes(feature.id);
                    return (
                      <div key={feature.id} className="relative">
                        <input
                          type="checkbox"
                          id={`feature-${feature.id}`}
                          value={feature.id}
                          {...step1Form.register('interestedFeatures')}
                          className="sr-only"
                        />
                        <label
                          htmlFor={`feature-${feature.id}`}
                          data-testid={`feature-${feature.id}`}
                          className={`block p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-all ${
                            isSelected
                              ? 'bg-green-50 border-green-400 ring-2 ring-green-200'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Icon className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium">{feature.name}</div>
                              <div className="text-xs text-gray-500 line-clamp-2">{feature.description}</div>
                            </div>
                            <CheckCircle className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-green-600' : 'text-gray-300'}`} />
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Paid add-ons section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Complementos</Badge>
                  <span className="text-xs text-gray-600">Funciones adicionales de pago (pruébalas gratis durante el trial)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {allFeatures.filter(f => !f.included).map((feature) => {
                    const Icon = feature.icon;
                    const selectedFeatures = step1Form.watch('interestedFeatures') || [];
                    const isSelected = selectedFeatures.includes(feature.id);
                    return (
                      <div key={feature.id} className="relative">
                        <input
                          type="checkbox"
                          id={`feature-${feature.id}`}
                          value={feature.id}
                          {...step1Form.register('interestedFeatures')}
                          className="sr-only"
                        />
                        <label
                          htmlFor={`feature-${feature.id}`}
                          data-testid={`feature-${feature.id}`}
                          className={`block p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-all ${
                            isSelected
                              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Icon className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{feature.name}</span>
                                <span className="text-xs text-blue-600 font-medium">+{feature.price}€/mes</span>
                              </div>
                              <div className="text-xs text-gray-500 line-clamp-2">{feature.description}</div>
                            </div>
                            <CheckCircle className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-300'}`} />
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button type="submit" data-testid="button-step1-continue" className="w-full rounded-xl px-8">
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* Step 2: Team size */}
          {currentStep === 2 && (
            <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-6">
              <div className="text-center mb-4">
                <Users className="h-6 w-6 md:h-8 md:w-8 text-oficaz-primary mx-auto mb-2" />
                <h3 className="text-sm md:text-base font-semibold mb-1">¿Cuántas personas usarán Oficaz?</h3>
                <p className="text-xs text-gray-600">Tu plan incluye 1 admin, 1 manager y 10 empleados</p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {teamSizes.map((size) => {
                    const isSelected = step2Form.watch('teamSize') === size.value;
                    return (
                      <div key={size.value} className="relative">
                        <input
                          type="radio"
                          id={`teamSize-${size.value}`}
                          value={size.value}
                          {...step2Form.register('teamSize')}
                          className="sr-only"
                        />
                        <label
                          htmlFor={`teamSize-${size.value}`}
                          data-testid={`teamsize-${size.value}`}
                          className={`block p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-all ${
                            isSelected
                              ? 'bg-oficaz-primary/5 border-oficaz-primary ring-2 ring-oficaz-primary/20'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium">{size.label}</div>
                              <div className="text-xs text-gray-500">{size.description}</div>
                            </div>
                            <div className={`w-4 h-4 border-2 rounded-full flex items-center justify-center ${
                              isSelected ? 'border-oficaz-primary bg-oficaz-primary' : 'border-gray-300'
                            }`}>
                              {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
                {step2Form.formState.errors.teamSize && (
                  <p className="text-sm text-red-600">{step2Form.formState.errors.teamSize.message}</p>
                )}
              </div>

              {/* Included users info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="text-xs font-medium text-gray-700">Tu plan Oficaz incluye:</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-oficaz-primary">1</div>
                    <div className="text-xs text-gray-600">Administrador</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-oficaz-primary">1</div>
                    <div className="text-xs text-gray-600">Manager</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-oficaz-primary">10</div>
                    <div className="text-xs text-gray-600">Empleados</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">Puedes añadir más usuarios en cualquier momento desde tu panel</p>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                <Button 
                  type="submit" 
                  data-testid="button-step2-continue"
                  className="w-full sm:flex-1 rounded-xl px-8 order-1 sm:order-2"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button type="button" variant="outline" onClick={() => goToStep(1)} className="w-full sm:flex-1 rounded-xl px-8 order-2 sm:order-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Atrás
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Company information */}
          {currentStep === 3 && (
            <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-6">
              <div className="text-center mb-4 md:mb-6">
                <Building className="h-8 w-8 md:h-12 md:w-12 text-oficaz-primary mx-auto mb-2 md:mb-3" />
                <h3 className="text-base md:text-lg font-semibold mb-1">Datos de tu empresa</h3>
                <p className="text-xs md:text-sm text-gray-600">Solo alguna información básica para configurar tu cuenta</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre de la empresa *</Label>
                  <Input
                    id="companyName"
                    className="rounded-xl"
                    {...step3Form.register('companyName')}
                    placeholder="Mi Empresa S.L."
                  />
                  {step3Form.formState.errors.companyName && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.companyName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cif">CIF *</Label>
                  <Input
                    id="cif"
                    className="rounded-xl"
                    {...step3Form.register('cif')}
                    placeholder="B12345678"
                  />
                  {step3Form.formState.errors.cif && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.cif.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email corporativo / facturación *</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    className="rounded-xl"
                    {...step3Form.register('companyEmail')}
                    placeholder="info@miempresa.com"
                  />
                  {step3Form.formState.errors.companyEmail && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.companyEmail.message}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Este email se usará para comunicaciones corporativas y facturación
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyAlias">Alias de empresa *</Label>
                  <Input
                    id="companyAlias"
                    className="rounded-xl"
                    {...step3Form.register('companyAlias')}
                    placeholder="miempresa"
                  />
                  <p className="text-xs text-gray-500">Tu URL será: oficaz.com/{step3Form.getValues('companyAlias') || 'miempresa'}</p>
                  {step3Form.formState.errors.companyAlias && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.companyAlias.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="province">Provincia *</Label>
                  <Select 
                    value={step3Form.watch('province') || ''}
                    onValueChange={(value) => {
                      step3Form.setValue('province', value);
                    }}
                  >
                    <SelectTrigger className="rounded-xl mt-2">
                      <SelectValue placeholder="Selecciona tu provincia" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto z-50">
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
                  {step3Form.formState.errors.province && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.province.message}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                <Button 
                  type="submit" 
                  data-testid="button-step3-continue"
                  className="w-full sm:flex-1 rounded-xl px-8 order-1 sm:order-2"
                  disabled={validatingStep2}
                >
                  {validatingStep2 ? 'Verificando datos...' : 'Continuar'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button type="button" variant="outline" onClick={() => goToStep(2)} className="w-full sm:flex-1 rounded-xl px-8 order-2 sm:order-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Atrás
                </Button>
              </div>
            </form>
          )}

          {/* Step 4: Admin account */}
          {currentStep === 4 && (
            <form onSubmit={step4Form.handleSubmit(handleStep4Submit)} className="space-y-6">
              <div className="text-center mb-4 md:mb-6">
                <Shield className="h-8 w-8 md:h-12 md:w-12 text-oficaz-primary mx-auto mb-2 md:mb-3" />
                <h3 className="text-base md:text-lg font-semibold mb-1">Cuenta de administrador</h3>
                <p className="text-xs md:text-sm text-gray-600">Ahora creemos los datos de tu usuario como administrador</p>
              </div>

              {/* Admin basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="adminFullName">Nombre completo del administrador *</Label>
                  <Input
                    id="adminFullName"
                    className="rounded-xl"
                    {...step4Form.register('adminFullName')}
                    placeholder="Juan Pérez García"
                  />
                  {step4Form.formState.errors.adminFullName && (
                    <p className="text-sm text-red-600">{step4Form.formState.errors.adminFullName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email de administrador *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    className="rounded-xl"
                    {...step4Form.register('adminEmail')}
                    placeholder="admin@miempresa.com"
                  />
                  <p className="text-xs text-gray-500">Este será tu email para iniciar sesión</p>
                  {step4Form.formState.errors.adminEmail && (
                    <p className="text-sm text-red-600">{step4Form.formState.errors.adminEmail.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminDni">DNI/NIE del administrador *</Label>
                  <Input
                    id="adminDni"
                    className="rounded-xl"
                    {...step4Form.register('adminDni')}
                    placeholder="12345678Z"
                  />
                  <p className="text-xs text-gray-500">DNI español o NIE para extranjeros</p>
                  {step4Form.formState.errors.adminDni && (
                    <p className="text-sm text-red-600">{step4Form.formState.errors.adminDni.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPhone">Teléfono empresarial *</Label>
                  <Input
                    id="adminPhone"
                    className="rounded-xl"
                    {...step4Form.register('adminPhone')}
                    placeholder="+34 600 000 000"
                  />
                  <p className="text-xs text-gray-500">Teléfono de contacto de la empresa</p>
                  {step4Form.formState.errors.adminPhone && (
                    <p className="text-sm text-red-600">{step4Form.formState.errors.adminPhone.message}</p>
                  )}
                </div>
              </div>

              {/* Password requirements */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm font-medium text-blue-900 mb-2">Requisitos de contraseña:</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Al menos 8 caracteres</li>
                  <li>• Una letra mayúscula (A-Z)</li>
                  <li>• Una letra minúscula (a-z)</li>
                  <li>• Un número (0-9)</li>
                  <li>• Un carácter especial (!@#$%^&*)</li>
                </ul>
              </div>

              {/* Password section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      className="rounded-xl"
                      type={showPassword ? 'text' : 'password'}
                      {...step4Form.register('password')}
                      placeholder="Crea una contraseña segura"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent rounded-r-xl"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {step4Form.formState.errors.password && (
                    <p className="text-sm text-red-600">{step4Form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      className="rounded-xl"
                      type={showConfirmPassword ? 'text' : 'password'}
                      {...step4Form.register('confirmPassword')}
                      placeholder="Repite la contraseña"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent rounded-r-xl"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {step4Form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-600">{step4Form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Contact person section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sameAsAdmin"
                    checked={step4Form.getValues('sameAsAdmin')}
                    onCheckedChange={(checked) => step4Form.setValue('sameAsAdmin', checked as boolean)}
                  />
                  <Label htmlFor="sameAsAdmin" className="text-sm">
                    Yo seré la persona de contacto de la empresa
                  </Label>
                </div>

                {!step4Form.getValues('sameAsAdmin') && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Nombre de contacto</Label>
                      <Input
                        id="contactName"
                        className="rounded-xl"
                        {...step4Form.register('contactName')}
                        placeholder="María García"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Teléfono de contacto</Label>
                      <Input
                        id="contactPhone"
                        className="rounded-xl"
                        {...step4Form.register('contactPhone')}
                        placeholder="+34 600 000 000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Email de contacto</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        className="rounded-xl"
                        {...step4Form.register('contactEmail')}
                        placeholder="maria@miempresa.com"
                      />
                    </div>
                  </div>
                )}
                
                {!step4Form.watch('sameAsAdmin') && step4Form.formState.errors.contactName && (
                  <p className="text-sm text-red-600">{step4Form.formState.errors.contactName.message}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                <Button type="submit" data-testid="button-step4-continue" className="w-full sm:flex-1 rounded-xl px-8 order-1 sm:order-2" disabled={validatingStep3}>
                  {validatingStep3 ? 'Verificando datos...' : 'Continuar'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setValidatingStep3(false);
                    setIsLoading(false);
                    goToStep(3);
                  }} 
                  className="w-full sm:flex-1 rounded-xl px-8 order-2 sm:order-1"
                  disabled={isLoading || validatingStep3}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Atrás
                </Button>
              </div>
            </form>
          )}

          {/* Step 5: Confirmation and Summary */}
          {currentStep === 5 && (
            <form onSubmit={step5Form.handleSubmit(handleStep5Submit)} className="space-y-6">
              <div className="text-center mb-6">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">¡Ya casi estás!</h3>
                <p className="text-sm text-gray-600">Revisa tu configuración y comienza tu prueba gratuita</p>
              </div>

              {/* Summary cards */}
              <div className="space-y-4">
                {/* Plan summary */}
                <div className="bg-oficaz-primary/5 border border-oficaz-primary/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Plan Oficaz</h4>
                    <Badge className="bg-oficaz-primary text-white">€39/mes</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-lg font-semibold text-oficaz-primary">1</div>
                      <div className="text-xs text-gray-600">Admin</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-oficaz-primary">1</div>
                      <div className="text-xs text-gray-600">Manager</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-oficaz-primary">10</div>
                      <div className="text-xs text-gray-600">Empleados</div>
                    </div>
                  </div>
                </div>

                {/* Selected features summary */}
                {formData.interestedFeatures && formData.interestedFeatures.length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Funciones seleccionadas</h4>
                    <div className="flex flex-wrap gap-2">
                      {formData.interestedFeatures.map((featureId: string) => {
                        const feature = allFeatures.find(f => f.id === featureId);
                        if (!feature) return null;
                        return (
                          <Badge 
                            key={featureId} 
                            className={feature.included 
                              ? "bg-green-100 text-green-700 hover:bg-green-100" 
                              : "bg-blue-100 text-blue-700 hover:bg-blue-100"
                            }
                          >
                            {feature.name}
                            {!feature.included && ` (+€${feature.price})`}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Company and admin summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Tu empresa</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Empresa:</span>
                      <span className="ml-2 font-medium">{formData.companyName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Admin:</span>
                      <span className="ml-2 font-medium">{formData.adminFullName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">CIF:</span>
                      <span className="ml-2 font-medium">{formData.cif || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 font-medium">{formData.adminEmail || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Free trial notice - 7 days */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center mb-2">
                  <Star className="h-5 w-5 text-green-500 mr-2" />
                  <h4 className="font-medium text-green-900">
                    {promoCodeValidation.status === 'valid' && promoCodeValidation.trialDays 
                      ? `${promoCodeValidation.trialDays} días de prueba gratuitos` 
                      : '7 días de prueba gratuitos'
                    }
                  </h4>
                </div>
                <p className="text-sm text-green-700">
                  Durante tu período de prueba tendrás acceso completo a todas las funciones, incluyendo los complementos de pago. No se te cobrará nada hasta que finalice tu trial.
                </p>
              </div>

              {/* Promotional Code Input */}
              <div className="space-y-3">
                <Label htmlFor="promotionalCode" className="text-sm font-medium text-gray-700">
                  Código promocional (opcional)
                </Label>
                <div className="relative">
                  <Input
                    id="promotionalCode"
                    type="text"
                    placeholder="Ingresa tu código promocional"
                    className="pr-12"
                    {...step5Form.register('promotionalCode')}
                    onBlur={(e) => validatePromotionalCode(e.target.value)}
                    data-testid="input-promotional-code"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {promoCodeValidation.status === 'checking' && (
                      <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                    )}
                    {promoCodeValidation.status === 'valid' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {promoCodeValidation.status === 'invalid' && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
                
                {promoCodeValidation.message && (
                  <p className={`text-xs flex items-center gap-1 ${
                    promoCodeValidation.status === 'valid' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {promoCodeValidation.status === 'valid' ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {promoCodeValidation.message}
                  </p>
                )}
              </div>

              {/* Terms and Conditions checkbox */}
              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-xl">
                <Checkbox
                  id="acceptTerms"
                  checked={step5Form.watch('acceptTerms') || false}
                  onCheckedChange={(checked) => step5Form.setValue('acceptTerms', checked as boolean)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor="acceptTerms" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                    Acepto los{' '}
                    <a href="/terms" target="_blank" className="text-oficaz-primary hover:underline font-medium">
                      Términos y Condiciones
                    </a>
                    , la{' '}
                    <a href="/privacy" target="_blank" className="text-oficaz-primary hover:underline font-medium">
                      Política de Privacidad
                    </a>
                    {' '}y las{' '}
                    <a href="/cookies" target="_blank" className="text-oficaz-primary hover:underline font-medium">
                      Políticas de Cookies
                    </a>
                    {' '}de Oficaz.
                  </Label>
                </div>
              </div>

              {step5Form.formState.errors.acceptTerms && (
                <p className="text-sm text-red-600 text-center">
                  {step5Form.formState.errors.acceptTerms.message}
                </p>
              )}

              {/* Marketing emails consent checkbox */}
              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-xl">
                <Checkbox
                  id="acceptMarketing"
                  checked={step5Form.watch('acceptMarketing') || false}
                  onCheckedChange={(checked) => step5Form.setValue('acceptMarketing', checked as boolean)}
                  className="mt-0.5"
                  data-testid="checkbox-accept-marketing"
                />
                <div className="flex-1">
                  <Label htmlFor="acceptMarketing" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                    Acepto recibir correos comerciales e informativos de Oficaz (opcional)
                  </Label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                <Button 
                  type="submit" 
                  data-testid="button-start-trial"
                  className="w-full sm:flex-1 rounded-xl px-8 order-1 sm:order-2 bg-green-600 hover:bg-green-700" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Creando empresa...' : 'Comenzar prueba gratuita'}
                  <Star className="h-4 w-4 ml-2" />
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => goToStep(4)} 
                  className="w-full sm:flex-1 rounded-xl px-8 order-2 sm:order-1"
                  disabled={isLoading}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Atrás
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/login" className="font-medium text-oficaz-primary hover:text-blue-500">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Demo Loading Overlay */}
      <DemoLoadingOverlay 
        isVisible={showDemoLoading}
        isBackendComplete={isBackendComplete}
        onComplete={() => {
          setShowDemoLoading(false);
          setIsBackendComplete(false);
          // Redirect to dashboard after animation completes
          setLocation('/dashboard');
        }}
      />
    </div>
  );
}