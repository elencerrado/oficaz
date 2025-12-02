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
import { Building, User, Eye, EyeOff, Users, CheckCircle, XCircle, ArrowRight, ArrowLeft, Shield, Star, Crown, Check, Clock, Palmtree, CalendarDays, MessageSquare, Bell, FileText, ClipboardList, Sparkles, Brain, Calendar, Mail, CalendarClock } from 'lucide-react';

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
  interestedFeatures: z.array(z.string()).optional(),
});

const step2Schema = z.object({
  teamSize: z.string().min(1, 'Selecciona el tamaño de tu equipo'),
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
    interestedFeatures: [],
    sameAsAdmin: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showDemoLoading, setShowDemoLoading] = useState(false);
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

  // Load addons from API (public endpoint, no auth required)
  const { data: addons = [] } = useQuery<Addon[]>({
    queryKey: ['/api/public/addons'],
  });

  // Split into free and paid addons
  const freeAddons = addons.filter(a => a.isFreeFeature);
  const paidAddons = addons.filter(a => !a.isFreeFeature);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { interestedFeatures: formData.interestedFeatures || [] },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: { teamSize: formData.teamSize || '' },
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

  const handleStep1Submit = (data: Step1Data) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  const handleStep2Submit = (data: Step2Data) => {
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
      
      const emailAvailable = await validateUserField('email', data.adminEmail);

      if (!emailAvailable) {
        step4Form.setError('adminEmail', { message: 'Email ya registrado' });
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

  const progressPercentage = (currentStep / 5) * 100;

  const steps = [
    { num: 1, label: 'Funciones', icon: Star },
    { num: 2, label: 'Equipo', icon: Users },
    { num: 3, label: 'Empresa', icon: Building },
    { num: 4, label: 'Admin', icon: Shield },
    { num: 5, label: 'Confirmar', icon: Check },
  ];

  return (
    <div className="h-screen bg-[#f5f5f7] flex overflow-hidden">
      {/* Left Rail - Desktop only - fixed height, no scroll */}
      <div className="hidden lg:flex lg:w-80 xl:w-96 bg-gradient-to-br from-[#1a1a2e] via-[#232b3b] to-[#2d3748] flex-col justify-between p-8 relative overflow-hidden flex-shrink-0">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-oficaz-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
        
        {/* Logo and title */}
        <div className="relative z-10">
          <img src={oficazLogo} alt="Oficaz" className="h-8 mb-8" />
          <h1 className="text-2xl font-semibold text-white mb-2">
            Bienvenido a Oficaz
          </h1>
          <p className="text-gray-400 text-sm">
            Configura tu empresa en menos de 2 minutos
          </p>
        </div>

        {/* Progress steps - vertical */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-8">
          <div className="space-y-4">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.num;
              const isComplete = currentStep > step.num;
              
              return (
                <div key={step.num} className="flex items-center gap-4">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                    ${isComplete ? 'bg-green-500 text-white' : ''}
                    ${isActive ? 'bg-oficaz-primary text-white ring-4 ring-oficaz-primary/30' : ''}
                    ${!isComplete && !isActive ? 'bg-gray-700 text-gray-400' : ''}
                  `}>
                    {isComplete ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`absolute left-[2.15rem] mt-14 w-0.5 h-4 ${isComplete ? 'bg-green-500' : 'bg-gray-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Trust signals */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <Shield className="w-5 h-5 text-green-400" />
            <span>Datos seguros y encriptados</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <Star className="w-5 h-5 text-yellow-400" />
            <span>7 días de prueba gratuita</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <CheckCircle className="w-5 h-5 text-blue-400" />
            <span>Cancela cuando quieras</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Main content with scroll */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Mobile header */}
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

        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-2xl">
            {/* Invitation message */}
            {byInvitation && invitationWelcomeMessage && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="text-sm text-green-700">{invitationWelcomeMessage}</span>
              </div>
            )}

            {/* Step 1: Features */}
            {currentStep === 1 && (
              <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-6">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                    ¿Qué funciones necesitas?
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Selecciona las que quieras probar. Tendrás acceso a todo durante el trial.
                  </p>
                </div>

                {/* Included features - display only, not selectable */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      Incluido en tu plan
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {freeAddons.map((addon) => {
                      const Icon = getIcon(addon.icon);
                      return (
                        <div
                          key={addon.key}
                          data-testid={`feature-${addon.key}`}
                          className="relative flex flex-col items-center p-4 rounded-2xl bg-green-50 border-2 border-green-200"
                        >
                          <Icon className="w-6 h-6 mb-2 text-green-600" />
                          <span className="text-sm font-medium text-gray-900 text-center">{addon.name}</span>
                          <span className="text-xs text-gray-500 text-center mt-1">{addon.shortDescription}</span>
                          <div className="absolute top-2 right-2">
                            <Check className="w-4 h-4 text-green-600" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Additional add-ons - selectable */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      Complementos adicionales
                    </span>
                    <span className="text-xs text-gray-400">Pruébalos gratis durante el trial</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {paidAddons.map((addon) => {
                      const Icon = getIcon(addon.icon);
                      const selectedFeatures = step1Form.watch('interestedFeatures') || [];
                      const isSelected = selectedFeatures.includes(addon.key);
                      return (
                        <label
                          key={addon.key}
                          htmlFor={`feature-${addon.key}`}
                          data-testid={`feature-${addon.key}`}
                          className={`
                            relative flex flex-col items-center p-4 rounded-2xl cursor-pointer transition-all duration-200
                            ${isSelected 
                              ? 'bg-blue-50 border-2 border-blue-400 shadow-sm' 
                              : 'bg-white border-2 border-gray-100 hover:border-gray-200 hover:shadow-sm'
                            }
                          `}
                        >
                          <input
                            type="checkbox"
                            id={`feature-${addon.key}`}
                            value={addon.key}
                            {...step1Form.register('interestedFeatures')}
                            className="sr-only"
                          />
                          <Icon className={`w-6 h-6 mb-2 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className="text-sm font-medium text-gray-900 text-center">{addon.name}</span>
                          <span className="text-xs text-gray-500 text-center mt-1">{addon.shortDescription}</span>
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-blue-600" />
                            </div>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    data-testid="button-step1-continue"
                    className="w-full h-12 rounded-xl text-base font-medium"
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 2: Team Size */}
            {currentStep === 2 && (
              <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-6">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                    ¿Cuántos empleados tienes?
                  </h2>
                  <p className="text-gray-500 text-sm">
                    El plan base incluye 1 admin, 1 manager y hasta 10 empleados
                  </p>
                </div>

                {/* Plan info card */}
                <div className="bg-gradient-to-r from-oficaz-primary/5 to-blue-50 border border-oficaz-primary/20 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-lg font-semibold text-gray-900">Plan Oficaz</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold text-oficaz-primary">€39</span>
                        <span className="text-gray-500">/mes</span>
                      </div>
                    </div>
                    <Crown className="w-8 h-8 text-oficaz-primary" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white/80 rounded-xl p-3">
                      <div className="text-lg font-semibold text-gray-900">1</div>
                      <div className="text-xs text-gray-500">Admin</div>
                    </div>
                    <div className="bg-white/80 rounded-xl p-3">
                      <div className="text-lg font-semibold text-gray-900">1</div>
                      <div className="text-xs text-gray-500">Manager</div>
                    </div>
                    <div className="bg-white/80 rounded-xl p-3">
                      <div className="text-lg font-semibold text-gray-900">10</div>
                      <div className="text-xs text-gray-500">Empleados</div>
                    </div>
                  </div>
                </div>

                {/* Team size options */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">Tamaño aproximado del equipo</Label>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { value: '1-5', label: '1-5' },
                      { value: '6-10', label: '6-10' },
                      { value: '11-25', label: '11-25' },
                      { value: '26-50', label: '26-50' },
                      { value: '51-100', label: '51-100' },
                      { value: '100+', label: '100+' },
                    ].map((option) => {
                      const isSelected = step2Form.watch('teamSize') === option.value;
                      return (
                        <label
                          key={option.value}
                          className={`
                            flex items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-200 font-medium
                            ${isSelected 
                              ? 'bg-oficaz-primary text-white shadow-md' 
                              : 'bg-white border-2 border-gray-100 text-gray-700 hover:border-gray-200'
                            }
                          `}
                        >
                          <input
                            type="radio"
                            value={option.value}
                            {...step2Form.register('teamSize')}
                            className="sr-only"
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                  {step2Form.formState.errors.teamSize && (
                    <p className="text-sm text-red-500">{step2Form.formState.errors.teamSize.message}</p>
                  )}
                </div>

                {/* Additional seats info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">¿Necesitas más usuarios?</span> Puedes añadirlos después: 
                    empleados +2€, managers +4€, admins +6€ por usuario/mes.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => goToStep(1)}
                    className="flex-1 h-12 rounded-xl"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <Button 
                    type="submit" 
                    data-testid="button-step2-continue"
                    className="flex-1 h-12 rounded-xl"
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 3: Company */}
            {currentStep === 3 && (
              <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-6">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                    Datos de tu empresa
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Información básica para configurar tu cuenta
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
                      Email de la empresa
                    </Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      placeholder="info@miempresa.com"
                      className="h-12 rounded-xl bg-white border-gray-200"
                      {...step3Form.register('companyEmail')}
                    />
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

            {/* Step 4: Admin */}
            {currentStep === 4 && (
              <form onSubmit={step4Form.handleSubmit(handleStep4Submit)} className="space-y-6">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                    Tu cuenta de administrador
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Datos de acceso para gestionar tu empresa
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
                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
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
              <form onSubmit={step5Form.handleSubmit(handleStep5Submit)} className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                    ¡Todo listo!
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Revisa tu configuración y comienza tu prueba gratuita
                  </p>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Plan summary */}
                  <div className="bg-gradient-to-br from-oficaz-primary/10 to-blue-50 border border-oficaz-primary/20 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-900">Plan Oficaz</span>
                      <Badge className="bg-oficaz-primary text-white">€39/mes</Badge>
                    </div>
                    <div className="flex gap-3 text-center">
                      <div className="flex-1 bg-white/70 rounded-xl py-2">
                        <div className="text-lg font-semibold text-oficaz-primary">1</div>
                        <div className="text-xs text-gray-500">Admin</div>
                      </div>
                      <div className="flex-1 bg-white/70 rounded-xl py-2">
                        <div className="text-lg font-semibold text-oficaz-primary">1</div>
                        <div className="text-xs text-gray-500">Manager</div>
                      </div>
                      <div className="flex-1 bg-white/70 rounded-xl py-2">
                        <div className="text-lg font-semibold text-oficaz-primary">10</div>
                        <div className="text-xs text-gray-500">Empleados</div>
                      </div>
                    </div>
                  </div>

                  {/* Company summary */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{formData.companyName || '-'}</span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>CIF:</span>
                        <span className="font-medium">{formData.cif || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Admin:</span>
                        <span className="font-medium">{formData.adminFullName || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected features */}
                {formData.interestedFeatures && formData.interestedFeatures.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4">
                    <span className="text-sm font-medium text-gray-700 block mb-3">Complementos adicionales seleccionados</span>
                    <div className="flex flex-wrap gap-2">
                      {formData.interestedFeatures.map((featureKey: string) => {
                        const addon = addons.find(a => a.key === featureKey);
                        if (!addon) return null;
                        return (
                          <Badge 
                            key={featureKey} 
                            className="bg-blue-100 text-blue-700 hover:bg-blue-100"
                          >
                            {addon.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Trial notice */}
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
                  <Star className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-green-900 block">
                      {promoCodeValidation.status === 'valid' && promoCodeValidation.trialDays 
                        ? `${promoCodeValidation.trialDays} días de prueba gratuitos` 
                        : '7 días de prueba gratuitos'
                      }
                    </span>
                    <span className="text-sm text-green-700">
                      Acceso completo a todas las funciones. Sin compromiso.
                    </span>
                  </div>
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
