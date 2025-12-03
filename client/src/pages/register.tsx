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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Building, User, Eye, EyeOff, Users, CheckCircle, XCircle, ArrowRight, ArrowLeft, Shield, Star, Crown, Check, Clock, Palmtree, CalendarDays, MessageSquare, Bell, FileText, ClipboardList, Sparkles, Brain, Calendar, Mail, CalendarClock, HelpCircle, Plus, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@assets/oficaz logo_1750516757063.png';
import { useAuth } from '@/hooks/use-auth';
import { DemoLoadingOverlay } from '@/components/demo-loading-overlay';

interface Addon {
  id: number;
  key: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  monthlyPrice: string;
  icon: string | null;
  isFreeFeature: boolean;
}

const iconMap: Record<string, any> = {
  clock: Clock,
  palmtree: Palmtree,
  'calendar-days': CalendarDays,
  calendar: Calendar,
  'calendar-clock': CalendarClock,
  'message-square': MessageSquare,
  mail: Mail,
  bell: Bell,
  'file-text': FileText,
  'clipboard-list': ClipboardList,
  sparkles: Sparkles,
  brain: Brain,
  star: Star,
};

const getIcon = (iconName: string | null) => {
  if (!iconName) return Star;
  return iconMap[iconName.toLowerCase()] || iconMap[iconName] || Star;
};

const validateCompanyField = async (field: string, value: string) => {
  try {
    const response = await apiRequest('POST', '/api/validate-company', { field, value });
    return response.available;
  } catch (error) {
    return true;
  }
};

const validateUserField = async (field: string, value: string) => {
  try {
    const response = await apiRequest('POST', '/api/validate-user', { field, value });
    return response.available;
  } catch (error) {
    return true;
  }
};

const step1Schema = z.object({
  selectedFeatures: z.array(z.string()).min(1, 'Selecciona al menos 1 funcionalidad'),
});

const step2Schema = z.object({
  admins: z.number().min(1).default(1),
  managers: z.number().min(0).default(0),
  employees: z.number().min(0).default(0),
});

const step3Schema = z.object({
  companyName: z.string().min(2, 'Mínimo 2 caracteres'),
  cif: z.string().min(9, 'Mínimo 9 caracteres'),
  companyEmail: z.string().email('Email no válido'),
  companyAlias: z.string()
    .min(3, 'Mínimo 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  province: z.string().min(1, 'Selecciona una provincia'),
});

const step4Schema = z.object({
  adminFullName: z.string().min(2, 'Mínimo 2 caracteres'),
  adminEmail: z.string().email('Email no válido'),
  adminDni: z.string().min(8, 'DNI/NIE requerido'),
  adminPhone: z.string().min(9, 'Mínimo 9 dígitos'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Una mayúscula')
    .regex(/[a-z]/, 'Una minúscula') 
    .regex(/[0-9]/, 'Un número')
    .regex(/[^A-Za-z0-9]/, 'Un carácter especial'),
  confirmPassword: z.string().min(8, 'Confirma tu contraseña'),
  sameAsAdmin: z.boolean().default(true),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

const step5Schema = z.object({
  selectedPlan: z.string().default('oficaz'),
  promotionalCode: z.string().optional(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos',
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

const spanishProvinces = [
  'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Barcelona',
  'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ciudad Real', 'Córdoba', 'Cuenca',
  'Gerona', 'Granada', 'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Islas Baleares',
  'Jaén', 'La Coruña', 'La Rioja', 'Las Palmas', 'León', 'Lérida', 'Lugo', 'Madrid', 'Málaga',
  'Murcia', 'Navarra', 'Orense', 'Palencia', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife',
  'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid',
  'Vizcaya', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'
];

export default function Register({ byInvitation = false, invitationEmail, invitationToken, invitationWelcomeMessage }: RegisterProps = {}) {
  usePageTitle('Registrarse');
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { register } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [validatingStep2, setValidatingStep2] = useState(false);
  const [validatingStep3, setValidatingStep3] = useState(false);
  const [formData, setFormData] = useState<Partial<FormData>>({
    selectedFeatures: [],
    admins: 1,
    managers: 0,
    employees: 0,
    sameAsAdmin: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showDemoLoading, setShowDemoLoading] = useState(false);
  const [introAnimationStarted, setIntroAnimationStarted] = useState(false);
  const [isBackendComplete, setIsBackendComplete] = useState(false);
  const [promoCodeValidation, setPromoCodeValidation] = useState<{ status: 'idle' | 'checking' | 'valid' | 'invalid', message?: string, trialDays?: number }>({ status: 'idle' });

  const params = new URLSearchParams(search);
  const verificationToken = params.get('token');
  const emailFromUrl = params.get('email') || '';
  
  useEffect(() => {
    if (!byInvitation && !verificationToken) {
      setIsLoading(false);
      setValidatingStep2(false);
      setValidatingStep3(false);
      const timer = setTimeout(() => {
        setLocation('/request-code', { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [verificationToken, byInvitation, setLocation]);

  useEffect(() => {
    document.documentElement.classList.add('dark-notch');
    return () => {
      document.documentElement.classList.remove('dark-notch');
    };
  }, []);

  useEffect(() => {
    if (currentStep === 0) {
      const timer = setTimeout(() => setIntroAnimationStarted(true), 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Load addons from API (public endpoint, no auth required)
  const { data: addons = [] } = useQuery<Addon[]>({
    queryKey: ['/api/public/addons'],
  });


  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { selectedFeatures: formData.selectedFeatures || [] },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: { 
      admins: formData.admins || 1,
      managers: formData.managers || 0,
      employees: formData.employees || 0,
    },
  });

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      companyName: formData.companyName || '',
      cif: formData.cif || '',
      companyEmail: formData.companyEmail || emailFromUrl || '',
      companyAlias: formData.companyAlias || '',
      province: formData.province || '',
    },
  });

  const step4Form = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      adminFullName: formData.adminFullName || '',
      adminEmail: formData.adminEmail || invitationEmail || '',
      adminDni: formData.adminDni || '',
      adminPhone: formData.adminPhone || '',
      password: '',
      confirmPassword: '',
      sameAsAdmin: formData.sameAsAdmin !== false,
      contactName: formData.contactName || '',
      contactPhone: formData.contactPhone || '',
      contactEmail: formData.contactEmail || '',
    },
  });

  const step5Form = useForm<Step5Data>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      selectedPlan: 'oficaz',
      promotionalCode: formData.promotionalCode || '',
      acceptTerms: false,
      acceptMarketing: formData.acceptMarketing || false,
    },
  });

  const goToStep = (step: number) => {
    setCurrentStep(step);
    setIsLoading(false);
    setValidatingStep2(false);
    setValidatingStep3(false);
  };

  const handleTeamSubmit = (data: Step2Data) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  const handleFeaturesSubmit = (data: Step1Data) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentStep(3);
  };

  const handleStep3Submit = async (data: Step3Data) => {
    try {
      setValidatingStep2(true);
      
      const [nameAvailable, cifAvailable, emailAvailable, aliasAvailable] = await Promise.all([
        validateCompanyField('name', data.companyName),
        validateCompanyField('cif', data.cif),
        validateCompanyField('email', data.companyEmail),
        validateCompanyField('alias', data.companyAlias),
      ]);

      if (!nameAvailable) {
        step3Form.setError('companyName', { message: 'Nombre ya registrado' });
        return;
      }
      if (!cifAvailable) {
        step3Form.setError('cif', { message: 'CIF ya registrado' });
        return;
      }
      if (!emailAvailable) {
        step3Form.setError('companyEmail', { message: 'Email ya en uso' });
        return;
      }
      if (!aliasAvailable) {
        step3Form.setError('companyAlias', { message: 'Alias ya en uso' });
        return;
      }

      setFormData(prev => ({ ...prev, ...data }));
      setCurrentStep(4);
    } catch (error) {
      console.error("Validation error");
    } finally {
      setValidatingStep2(false);
    }
  };

  const handleStep4Submit = async (data: Step4Data) => {
    try {
      setValidatingStep3(true);
      
      // Check if admin email is same as company email (allowed for small businesses)
      const companyEmail = formData.companyEmail?.toLowerCase() || '';
      const adminEmail = data.adminEmail.toLowerCase();
      const isSameAsCompanyEmail = companyEmail === adminEmail;
      
      // Validate email, DNI and phone in parallel
      // Skip email validation if it's the same as company email (already verified)
      const [emailAvailable, dniAvailable, phoneAvailable] = await Promise.all([
        isSameAsCompanyEmail ? Promise.resolve(true) : validateUserField('email', data.adminEmail),
        validateUserField('dni', data.adminDni),
        data.adminPhone ? validateUserField('phone', data.adminPhone) : Promise.resolve(true),
      ]);

      let hasErrors = false;

      if (!emailAvailable) {
        step4Form.setError('adminEmail', { message: 'Email ya registrado' });
        hasErrors = true;
      }

      if (!dniAvailable) {
        step4Form.setError('adminDni', { message: 'DNI/NIE ya registrado' });
        hasErrors = true;
      }

      if (!phoneAvailable) {
        step4Form.setError('adminPhone', { message: 'Teléfono ya registrado' });
        hasErrors = true;
      }

      if (hasErrors) {
        return;
      }

      setFormData(prev => ({ ...prev, ...data }));
      setCurrentStep(5);
    } catch (error) {
      console.error('Validation error');
    } finally {
      setValidatingStep3(false);
    }
  };

  const handleStep5Submit = async (data: Step5Data) => {
    try {
      setIsLoading(true);
      setShowDemoLoading(true);
      setIsBackendComplete(false);
      
      const urlParams = new URLSearchParams(search);
      const campaignId = urlParams.get('campaign');
      const registrationSource = urlParams.get('source') || 'direct';
      
      const finalData = { 
        ...formData, 
        ...data,
        verificationToken: byInvitation ? null : verificationToken,
        invitationToken: byInvitation ? invitationToken : null,
        contactName: formData.sameAsAdmin ? formData.adminFullName : formData.contactName,
        campaignId: campaignId,
        source: registrationSource,
      };
      
      try {
        await register(finalData);
        localStorage.setItem('showWelcomeModal', 'true');
        setIsBackendComplete(true);
      } catch (error: any) {
        setShowDemoLoading(false);
        setIsBackendComplete(false);
        
        if (error.message && error.message.includes('programada para eliminación')) {
          alert(error.message);
        } else {
          alert(error.message || 'Error al crear la empresa');
        }
        setIsLoading(false);
      }
    } catch (error: any) {
      setShowDemoLoading(false);
      setIsLoading(false);
      alert(error.message || 'Error al crear la empresa');
    }
  };

  const validatePromotionalCode = async (code: string) => {
    if (!code || code.trim() === '') {
      setPromoCodeValidation({ status: 'idle' });
      return;
    }
    
    setPromoCodeValidation({ status: 'checking' });
    
    try {
      const response = await apiRequest('POST', '/api/validate-promo-code', { code: code.trim() });
      if (response.valid) {
        setPromoCodeValidation({ 
          status: 'valid', 
          message: response.message || 'Código válido',
          trialDays: response.trialDays
        });
      } else {
        setPromoCodeValidation({ 
          status: 'invalid', 
          message: response.message || 'Código no válido'
        });
      }
    } catch (error) {
      setPromoCodeValidation({ 
        status: 'invalid', 
        message: 'Código no válido'
      });
    }
  };

  const progressPercentage = currentStep === 0 ? 0 : (currentStep / 5) * 100;

  const steps = [
    { num: 1, label: 'Equipo', icon: Users },
    { num: 2, label: 'Funciones', icon: Star },
    { num: 3, label: 'Empresa', icon: Building },
    { num: 4, label: 'Admin', icon: Shield },
    { num: 5, label: 'Confirmar', icon: Check },
  ];

  return (
    <div className="h-screen bg-[#f5f5f7] flex overflow-hidden">
      {/* Left Rail - Desktop only - Apple style minimal */}
      <div className="hidden lg:flex lg:w-80 xl:w-96 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f23] flex-col p-8 relative overflow-hidden flex-shrink-0">
        {/* Subtle decorative gradient orbs */}
        <div className="absolute top-20 right-0 w-80 h-80 bg-oficaz-primary/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/5 rounded-full blur-[80px]" />
        
        {/* Logo - Centered at top */}
        <div className="relative z-10 flex justify-center pt-4 pb-12">
          <img src={oficazLogo} alt="Oficaz" className="h-10" />
        </div>

        {/* Progress steps - vertical, centered */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="space-y-5">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.num;
              const isComplete = currentStep > step.num;
              
              return (
                <div key={step.num} className="flex items-center gap-4">
                  <div className={`
                    w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500
                    ${isComplete ? 'bg-green-500/90 text-white' : ''}
                    ${isActive ? 'bg-oficaz-primary text-white shadow-lg shadow-oficaz-primary/40' : ''}
                    ${!isComplete && !isActive ? 'bg-white/5 text-gray-500 border border-white/10' : ''}
                  `}>
                    {isComplete ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-medium transition-colors duration-300 ${
                      isActive ? 'text-white' : isComplete ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Minimal footer - just key benefits */}
        <div className="relative z-10 pt-8 space-y-3">
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <Star className="w-4 h-4 text-yellow-400/80" />
            <span>7 días de prueba gratis</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <CheckCircle className="w-4 h-4 text-green-400/80" />
            <span>Cancela cuando quieras</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Main content with scroll */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Mobile header - hidden on intro step */}
        {currentStep > 0 && (
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <img src={oficazLogo} alt="Oficaz" className="h-6" />
              <span className="text-sm text-gray-500">Paso {currentStep}/5</span>
            </div>
            {/* Mobile progress bar */}
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-oficaz-primary transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-2xl">
            
            {/* Step 0: Introduction - Clean Apple Style */}
            {currentStep === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
                {/* Logo for mobile */}
                <div className="lg:hidden mb-16">
                  <img src={oficazLogo} alt="Oficaz" className="h-9 mx-auto" />
                </div>
                
                {/* Clean headline */}
                <div className="max-w-lg mx-auto mb-12">
                  <h1 
                    className={`text-[2rem] sm:text-[2.5rem] lg:text-[3rem] font-semibold text-gray-900 leading-[1.1] tracking-tight transition-all duration-1000 ease-out ${
                      introAnimationStarted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                    }`}
                  >
                    Gestiona tu empresa de forma más eficiente.
                  </h1>
                </div>
                
                {/* Subtitle */}
                <p 
                  className={`text-lg sm:text-xl text-gray-500 font-normal mb-12 max-w-md transition-all duration-1000 ease-out delay-300 ${
                    introAnimationStarted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
                >
                  Configura tu cuenta en solo 2 minutos.
                </p>
                
                {/* Clean button */}
                <div 
                  className={`transition-all duration-700 ease-out delay-700 ${
                    introAnimationStarted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                >
                  <Button
                    onClick={() => setCurrentStep(1)}
                    size="lg"
                    className="h-12 px-8 rounded-full text-base font-medium bg-oficaz-primary hover:bg-oficaz-primary/90 transition-all duration-200"
                    data-testid="button-start-wizard"
                  >
                    Avanzar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Invitation message */}
            {currentStep > 0 && byInvitation && invitationWelcomeMessage && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="text-sm text-green-700">{invitationWelcomeMessage}</span>
              </div>
            )}

            {/* Step 1: Team Configuration - Apple Style (friendly tone) */}
            {currentStep === 1 && (
              <form onSubmit={step2Form.handleSubmit(handleTeamSubmit)} className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl lg:text-3xl font-semibold text-gray-900 mb-3">
                    Vamos a configurar tu equipo
                  </h2>
                  <p className="text-gray-500">
                    Cuéntanos cuántas personas usarán Oficaz. No te preocupes, podrás cambiarlo cuando quieras.
                  </p>
                </div>

                {/* User counters - Visual Apple style */}
                <div className="space-y-4">
                  {/* Admin counter - minimum 1 required */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center">
                          <Crown className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">Administradores</h3>
                          <p className="text-sm text-gray-500">Control total y facturación</p>
                          <span className="text-sm font-medium text-amber-600">€6/usuario/mes</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('admins');
                            if (current > 1) step2Form.setValue('admins', current - 1);
                          }}
                          disabled={step2Form.watch('admins') <= 1}
                          className="w-12 h-12 rounded-xl bg-white border-2 border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          data-testid="button-minus-admins"
                        >
                          <Minus className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="w-14 text-center text-2xl font-bold text-gray-900">
                          {step2Form.watch('admins')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('admins');
                            step2Form.setValue('admins', current + 1);
                          }}
                          className="w-12 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 flex items-center justify-center transition-colors"
                          data-testid="button-plus-admins"
                        >
                          <Plus className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Mínimo 1 administrador (tú serás el primero)
                    </p>
                  </div>

                  {/* Manager counter */}
                  <div className="bg-white border-2 border-gray-100 hover:border-gray-200 rounded-2xl p-5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500 flex items-center justify-center">
                          <Users className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">Managers</h3>
                          <p className="text-sm text-gray-500">Gestión de equipos e informes</p>
                          <span className="text-sm font-medium text-purple-600">€4/usuario/mes</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('managers');
                            if (current > 0) step2Form.setValue('managers', current - 1);
                          }}
                          disabled={step2Form.watch('managers') <= 0}
                          className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          data-testid="button-minus-managers"
                        >
                          <Minus className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="w-14 text-center text-2xl font-bold text-gray-900">
                          {step2Form.watch('managers')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('managers');
                            step2Form.setValue('managers', current + 1);
                          }}
                          className="w-12 h-12 rounded-xl bg-purple-500 hover:bg-purple-600 flex items-center justify-center transition-colors"
                          data-testid="button-plus-managers"
                        >
                          <Plus className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Employee counter */}
                  <div className="bg-white border-2 border-gray-100 hover:border-gray-200 rounded-2xl p-5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center">
                          <User className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">Empleados</h3>
                          <p className="text-sm text-gray-500">Fichajes, vacaciones, nóminas</p>
                          <span className="text-sm font-medium text-blue-600">€2/usuario/mes</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('employees');
                            if (current > 0) step2Form.setValue('employees', current - 1);
                          }}
                          disabled={step2Form.watch('employees') <= 0}
                          className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          data-testid="button-minus-employees"
                        >
                          <Minus className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="w-14 text-center text-2xl font-bold text-gray-900">
                          {step2Form.watch('employees')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('employees');
                            step2Form.setValue('employees', current + 1);
                          }}
                          className="w-12 h-12 rounded-xl bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors"
                          data-testid="button-plus-employees"
                        >
                          <Plus className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total summary */}
                <div className="bg-gray-50 rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600">Tu equipo:</span>
                      <div className="text-sm text-gray-500 mt-1">
                        {step2Form.watch('admins')} admin{step2Form.watch('admins') > 1 ? 's' : ''}
                        {step2Form.watch('managers') > 0 && `, ${step2Form.watch('managers')} manager${step2Form.watch('managers') > 1 ? 's' : ''}`}
                        {step2Form.watch('employees') > 0 && `, ${step2Form.watch('employees')} empleado${step2Form.watch('employees') > 1 ? 's' : ''}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-oficaz-primary">
                        €{(step2Form.watch('admins') * 6) + (step2Form.watch('managers') * 4) + (step2Form.watch('employees') * 2)}
                      </span>
                      <span className="text-gray-500">/mes</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => goToStep(0)}
                    className="flex-1 h-14 rounded-2xl"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <Button 
                    type="submit" 
                    data-testid="button-step1-continue"
                    className="flex-1 h-14 rounded-2xl"
                  >
                    Continuar
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 2: Features Selection - Apple Style (friendly tone) */}
            {currentStep === 2 && (
              <form onSubmit={step1Form.handleSubmit(handleFeaturesSubmit)} className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl lg:text-3xl font-semibold text-gray-900 mb-3">
                    Elige las funciones que te interesan
                  </h2>
                  <p className="text-gray-500">
                    Selecciona lo que necesitas ahora. Podrás añadir más cuando quieras.
                  </p>
                </div>

                {/* Features grid - Apple style cards with full description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addons.map((addon) => {
                    const Icon = getIcon(addon.icon);
                    const selectedFeatures = step1Form.watch('selectedFeatures') || [];
                    const isSelected = selectedFeatures.includes(addon.key);
                    const price = Number(addon.monthlyPrice);
                    
                    return (
                      <label
                        key={addon.key}
                        htmlFor={`feature-${addon.key}`}
                        data-testid={`feature-${addon.key}`}
                        className={`
                          flex flex-col p-5 rounded-2xl cursor-pointer transition-all duration-300 min-h-[160px]
                          ${isSelected 
                            ? 'bg-oficaz-primary/5 border-2 border-oficaz-primary shadow-lg shadow-oficaz-primary/10 scale-[1.02]' 
                            : 'bg-white border-2 border-gray-100 hover:border-gray-200 hover:shadow-md'
                          }
                        `}
                      >
                        <input
                          type="checkbox"
                          id={`feature-${addon.key}`}
                          value={addon.key}
                          {...step1Form.register('selectedFeatures')}
                          className="sr-only"
                        />
                        
                        {/* Header: Icon + Name + Selection indicator */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`
                            w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                            ${isSelected ? 'bg-oficaz-primary text-white' : 'bg-gray-100 text-gray-500'}
                          `}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="font-semibold text-gray-900 flex-1">{addon.name}</span>
                          <div className={`
                            w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0
                            ${isSelected ? 'bg-oficaz-primary text-white' : 'bg-gray-100'}
                          `}>
                            {isSelected && <Check className="w-4 h-4" />}
                          </div>
                        </div>
                        
                        {/* Description - full text without clamp */}
                        <p className="text-sm text-gray-500 flex-1 leading-relaxed">{addon.shortDescription}</p>
                        
                        {/* Price - bottom right */}
                        <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                          <span className={`text-base font-bold ${isSelected ? 'text-oficaz-primary' : 'text-gray-700'}`}>
                            €{price}<span className="text-sm font-normal text-gray-400">/mes</span>
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Price summary */}
                {(step1Form.watch('selectedFeatures') || []).length > 0 && (
                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600">Funcionalidades seleccionadas:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {(step1Form.watch('selectedFeatures') || []).length}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-500">Subtotal: </span>
                      <span className="text-lg font-bold text-oficaz-primary">
                        €{(step1Form.watch('selectedFeatures') || []).reduce((sum, key) => {
                          const addon = addons.find(a => a.key === key);
                          return sum + Number(addon?.monthlyPrice || 0);
                        }, 0)}/mes
                      </span>
                    </div>
                  </div>
                )}

                {/* Validation error */}
                {step1Form.formState.errors.selectedFeatures && (
                  <p className="text-sm text-red-500 text-center">
                    {step1Form.formState.errors.selectedFeatures.message}
                  </p>
                )}

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => goToStep(1)}
                    className="flex-1 h-14 rounded-2xl"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <Button 
                    type="submit" 
                    data-testid="button-step2-continue"
                    disabled={(step1Form.watch('selectedFeatures') || []).length === 0}
                    className="flex-1 h-14 rounded-2xl"
                  >
                    Continuar
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
                {(step1Form.watch('selectedFeatures') || []).length === 0 && (
                  <p className="text-xs text-gray-400 text-center">
                    Selecciona al menos 1 funcionalidad para continuar
                  </p>
                )}
              </form>
            )}

            {/* Step 3: Company - Friendly tone */}
            {currentStep === 3 && (
              <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-6">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                    Cuéntanos sobre tu empresa
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Solo necesitamos unos datos básicos para empezar
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-sm font-medium text-gray-700">
                      Nombre de la empresa
                    </Label>
                    <Input
                      id="companyName"
                      placeholder="Mi Empresa S.L."
                      className="h-12 rounded-xl bg-white border-gray-200"
                      {...step3Form.register('companyName')}
                    />
                    {step3Form.formState.errors.companyName && (
                      <p className="text-xs text-red-500">{step3Form.formState.errors.companyName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cif" className="text-sm font-medium text-gray-700">
                      CIF
                    </Label>
                    <Input
                      id="cif"
                      placeholder="B12345678"
                      className="h-12 rounded-xl bg-white border-gray-200"
                      {...step3Form.register('cif')}
                    />
                    {step3Form.formState.errors.cif && (
                      <p className="text-xs text-red-500">{step3Form.formState.errors.cif.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyEmail" className="text-sm font-medium text-gray-700">
                      Email de facturación
                    </Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      placeholder="info@miempresa.com"
                      className="h-12 rounded-xl bg-white border-gray-200"
                      {...step3Form.register('companyEmail')}
                    />
                    <p className="text-xs text-gray-500">
                      Recibirás las facturas en este email
                    </p>
                    {step3Form.formState.errors.companyEmail && (
                      <p className="text-xs text-red-500">{step3Form.formState.errors.companyEmail.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyAlias" className="text-sm font-medium text-gray-700">
                      Alias (URL única)
                    </Label>
                    <div className="relative">
                      <Input
                        id="companyAlias"
                        placeholder="mi-empresa"
                        className="h-12 rounded-xl bg-white border-gray-200 pr-24"
                        {...step3Form.register('companyAlias')}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        .oficaz.com
                      </span>
                    </div>
                    {step3Form.formState.errors.companyAlias && (
                      <p className="text-xs text-red-500">{step3Form.formState.errors.companyAlias.message}</p>
                    )}
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="province" className="text-sm font-medium text-gray-700">
                      Provincia
                    </Label>
                    <Select
                      value={step3Form.watch('province')}
                      onValueChange={(value) => step3Form.setValue('province', value)}
                    >
                      <SelectTrigger className="h-12 rounded-xl bg-white border-gray-200">
                        <SelectValue placeholder="Selecciona una provincia" />
                      </SelectTrigger>
                      <SelectContent>
                        {spanishProvinces.map((province) => (
                          <SelectItem key={province} value={province}>
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {step3Form.formState.errors.province && (
                      <p className="text-xs text-red-500">{step3Form.formState.errors.province.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => goToStep(2)}
                    className="flex-1 h-12 rounded-xl"
                    disabled={validatingStep2}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <Button 
                    type="submit" 
                    data-testid="button-step3-continue"
                    className="flex-1 h-12 rounded-xl"
                    disabled={validatingStep2}
                  >
                    {validatingStep2 ? 'Verificando...' : 'Continuar'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 4: Admin - Friendly tone */}
            {currentStep === 4 && (
              <form onSubmit={step4Form.handleSubmit(handleStep4Submit)} className="space-y-6">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                    Crea tu cuenta
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Estos serán tus datos de acceso como administrador
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminFullName" className="text-sm font-medium text-gray-700">
                      Nombre completo
                    </Label>
                    <Input
                      id="adminFullName"
                      placeholder="Juan García López"
                      className="h-12 rounded-xl bg-white border-gray-200"
                      {...step4Form.register('adminFullName')}
                    />
                    {step4Form.formState.errors.adminFullName && (
                      <p className="text-xs text-red-500">{step4Form.formState.errors.adminFullName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminDni" className="text-sm font-medium text-gray-700">
                      DNI/NIE
                    </Label>
                    <Input
                      id="adminDni"
                      placeholder="12345678A"
                      className="h-12 rounded-xl bg-white border-gray-200"
                      {...step4Form.register('adminDni')}
                    />
                    {step4Form.formState.errors.adminDni && (
                      <p className="text-xs text-red-500">{step4Form.formState.errors.adminDni.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminEmail" className="text-sm font-medium text-gray-700">
                      Email
                    </Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      placeholder="juan@miempresa.com"
                      className="h-12 rounded-xl bg-white border-gray-200"
                      {...step4Form.register('adminEmail')}
                    />
                    {step4Form.formState.errors.adminEmail && (
                      <p className="text-xs text-red-500">{step4Form.formState.errors.adminEmail.message}</p>
                    )}
                    {formData.companyEmail && step4Form.watch('adminEmail') !== formData.companyEmail && (
                      <button
                        type="button"
                        onClick={() => step4Form.setValue('adminEmail', formData.companyEmail || '')}
                        className="text-xs text-oficaz-primary hover:underline"
                      >
                        Usar el mismo email de facturación ({formData.companyEmail})
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminPhone" className="text-sm font-medium text-gray-700">
                      Teléfono
                    </Label>
                    <Input
                      id="adminPhone"
                      placeholder="612345678"
                      className="h-12 rounded-xl bg-white border-gray-200"
                      {...step4Form.register('adminPhone')}
                    />
                    {step4Form.formState.errors.adminPhone && (
                      <p className="text-xs text-red-500">{step4Form.formState.errors.adminPhone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                      Contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="h-12 rounded-xl bg-white border-gray-200 pr-12"
                        {...step4Form.register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {step4Form.formState.errors.password && (
                      <p className="text-xs text-red-500">{step4Form.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                      Confirmar contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="h-12 rounded-xl bg-white border-gray-200 pr-12"
                        {...step4Form.register('confirmPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {step4Form.formState.errors.confirmPassword && (
                      <p className="text-xs text-red-500">{step4Form.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>

                {/* Password requirements */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">La contraseña debe tener:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-500">
                    <span>• Mínimo 8 caracteres</span>
                    <span>• Una mayúscula</span>
                    <span>• Una minúscula</span>
                    <span>• Un número</span>
                    <span>• Un carácter especial</span>
                  </div>
                </div>

                {/* Contact person toggle */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                    <Checkbox
                      id="sameAsAdmin"
                      checked={step4Form.watch('sameAsAdmin')}
                      onCheckedChange={(checked) => step4Form.setValue('sameAsAdmin', checked as boolean)}
                    />
                    <Label htmlFor="sameAsAdmin" className="text-sm text-gray-700 cursor-pointer">
                      Yo seré la persona de contacto de la empresa
                    </Label>
                  </div>

                  {/* Contact person fields - shown when sameAsAdmin is false */}
                  {!step4Form.watch('sameAsAdmin') && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
                      <p className="text-sm font-medium text-blue-900">Datos de la persona de contacto</p>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contactName" className="text-sm font-medium text-gray-700">
                            Nombre completo *
                          </Label>
                          <Input
                            id="contactName"
                            placeholder="Nombre del contacto"
                            className="h-12 rounded-xl bg-white border-gray-200"
                            {...step4Form.register('contactName')}
                          />
                          {step4Form.formState.errors.contactName && (
                            <p className="text-xs text-red-500">{step4Form.formState.errors.contactName.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactPhone" className="text-sm font-medium text-gray-700">
                            Teléfono
                          </Label>
                          <Input
                            id="contactPhone"
                            placeholder="612345678"
                            className="h-12 rounded-xl bg-white border-gray-200"
                            {...step4Form.register('contactPhone')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactEmail" className="text-sm font-medium text-gray-700">
                            Email
                          </Label>
                          <Input
                            id="contactEmail"
                            type="email"
                            placeholder="contacto@empresa.com"
                            className="h-12 rounded-xl bg-white border-gray-200"
                            {...step4Form.register('contactEmail')}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => goToStep(3)}
                    className="flex-1 h-12 rounded-xl"
                    disabled={validatingStep3}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <Button 
                    type="submit" 
                    data-testid="button-step4-continue"
                    className="flex-1 h-12 rounded-xl"
                    disabled={validatingStep3}
                  >
                    {validatingStep3 ? 'Verificando...' : 'Continuar'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 5: Confirmation */}
            {currentStep === 5 && (
              <form onSubmit={step5Form.handleSubmit(handleStep5Submit)} className="space-y-5">
                <div className="text-center lg:text-left mb-4">
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                    Tu plan Oficaz
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Esto es lo que tendrás disponible
                  </p>
                </div>

                {/* Features selected */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <span className="text-sm font-medium text-gray-900 block mb-3">Tus funcionalidades</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {formData.selectedFeatures && formData.selectedFeatures.map((featureKey: string) => {
                      const addon = addons.find(a => a.key === featureKey);
                      if (!addon) return null;
                      const Icon = iconMap[addon.icon as keyof typeof iconMap] || Clock;
                      return (
                        <div key={featureKey} className="flex items-center justify-between text-sm text-gray-700 bg-gray-50 rounded-xl p-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-oficaz-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-oficaz-primary" />
                            </div>
                            <span className="font-medium">{addon.name}</span>
                          </div>
                          <span className="text-oficaz-primary font-semibold">€{addon.monthlyPrice}/mes</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Users summary */}
                <div className="bg-gradient-to-br from-oficaz-primary/5 to-blue-50 border border-oficaz-primary/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-900">Tu equipo</span>
                    <span className="text-xs text-gray-500">
                      {(formData.admins || 1) + (formData.managers || 0) + (formData.employees || 0)} usuarios en total
                    </span>
                  </div>
                  <div className="flex gap-3 text-center">
                    <div className="flex-1 bg-white/80 rounded-xl py-2">
                      <div className="text-lg font-bold text-blue-600">{formData.employees || 0}</div>
                      <div className="text-xs text-gray-600">Empleados</div>
                      <div className="text-xs text-gray-400">€{(formData.employees || 0) * 2}/mes</div>
                    </div>
                    <div className="flex-1 bg-white/80 rounded-xl py-2">
                      <div className="text-lg font-bold text-purple-600">{formData.managers || 0}</div>
                      <div className="text-xs text-gray-600">Managers</div>
                      <div className="text-xs text-gray-400">€{(formData.managers || 0) * 4}/mes</div>
                    </div>
                    <div className="flex-1 bg-white/80 rounded-xl py-2">
                      <div className="text-lg font-bold text-amber-600">{formData.admins || 1}</div>
                      <div className="text-xs text-gray-600">Admins</div>
                      <div className="text-xs text-gray-400">€{(formData.admins || 1) * 6}/mes</div>
                    </div>
                  </div>
                </div>

                {/* Price summary */}
                <div className="bg-gray-900 text-white rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-semibold">Total mensual</span>
                    <div className="text-right">
                      <span className="text-3xl font-bold">
                        €{
                          ((formData.admins || 1) * 6) + 
                          ((formData.managers || 0) * 4) + 
                          ((formData.employees || 0) * 2) +
                          (formData.selectedFeatures?.reduce((sum: number, key: string) => {
                            const addon = addons.find(a => a.key === key);
                            return sum + (addon ? parseFloat(addon.monthlyPrice) : 0);
                          }, 0) || 0)
                        }
                      </span>
                      <span className="text-gray-400 text-sm">/mes</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Paga solo por lo que usas. Sin sorpresas ni costes ocultos.
                  </p>
                </div>

                {/* Trial notice - friendly message */}
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Star className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <span className="font-semibold text-green-900 block">
                        {promoCodeValidation.status === 'valid' && promoCodeValidation.trialDays 
                          ? `${promoCodeValidation.trialDays} días gratis` 
                          : '7 días gratis'
                        }
                      </span>
                      <span className="text-xs text-green-700">Sin compromiso, cancela cuando quieras</span>
                    </div>
                  </div>
                  <p className="text-sm text-green-800 mt-2">
                    Pero bueno, no te preocupes ahora. Disfruta de tu prueba gratuita y descubre todo lo que Oficaz puede hacer por ti.
                  </p>
                </div>

                {/* Promo code */}
                <div className="space-y-2">
                  <Label htmlFor="promotionalCode" className="text-sm font-medium text-gray-700">
                    Código promocional (opcional)
                  </Label>
                  <div className="relative">
                    <Input
                      id="promotionalCode"
                      placeholder="Ingresa tu código"
                      className="h-12 rounded-xl bg-white border-gray-200 pr-12"
                      {...step5Form.register('promotionalCode')}
                      onBlur={(e) => validatePromotionalCode(e.target.value)}
                      data-testid="input-promotional-code"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {promoCodeValidation.status === 'checking' && (
                        <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-oficaz-primary rounded-full" />
                      )}
                      {promoCodeValidation.status === 'valid' && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {promoCodeValidation.status === 'invalid' && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  </div>
                  {promoCodeValidation.message && (
                    <p className={`text-xs ${promoCodeValidation.status === 'valid' ? 'text-green-600' : 'text-red-600'}`}>
                      {promoCodeValidation.message}
                    </p>
                  )}
                </div>

                {/* Terms */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                    <Checkbox
                      id="acceptTerms"
                      checked={step5Form.watch('acceptTerms') || false}
                      onCheckedChange={(checked) => step5Form.setValue('acceptTerms', checked as boolean)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="acceptTerms" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                      Acepto los{' '}
                      <a href="/terms" target="_blank" className="text-oficaz-primary hover:underline">Términos</a>,{' '}
                      <a href="/privacy" target="_blank" className="text-oficaz-primary hover:underline">Privacidad</a> y{' '}
                      <a href="/cookies" target="_blank" className="text-oficaz-primary hover:underline">Cookies</a>
                    </Label>
                  </div>
                  {step5Form.formState.errors.acceptTerms && (
                    <p className="text-sm text-red-500 text-center">{step5Form.formState.errors.acceptTerms.message}</p>
                  )}

                  <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                    <Checkbox
                      id="acceptMarketing"
                      checked={step5Form.watch('acceptMarketing') || false}
                      onCheckedChange={(checked) => step5Form.setValue('acceptMarketing', checked as boolean)}
                      className="mt-0.5"
                      data-testid="checkbox-accept-marketing"
                    />
                    <Label htmlFor="acceptMarketing" className="text-sm text-gray-700 cursor-pointer">
                      Recibir novedades y ofertas de Oficaz (opcional)
                    </Label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => goToStep(4)}
                    className="flex-1 h-12 rounded-xl"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <Button 
                    type="submit" 
                    data-testid="button-start-trial"
                    className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creando...' : 'Comenzar prueba'}
                    <Star className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            )}

            {/* Login link */}
            <div className="text-center mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                ¿Ya tienes una cuenta?{' '}
                <Link href="/login" className="text-oficaz-primary hover:underline font-medium">
                  Iniciar sesión
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <DemoLoadingOverlay 
        isVisible={showDemoLoading}
        isBackendComplete={isBackendComplete}
        onComplete={() => {
          setShowDemoLoading(false);
          setIsBackendComplete(false);
          setLocation('/dashboard');
        }}
      />
    </div>
  );
}
