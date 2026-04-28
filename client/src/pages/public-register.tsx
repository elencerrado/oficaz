import { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building, User, Eye, EyeOff, Users, CheckCircle, XCircle, ArrowRight, ArrowLeft, Shield, Star, Crown, Check, Clock, Palmtree, CalendarDays, MessageSquare, Bell, FileText, ClipboardList, Sparkles, Brain, Calendar, Mail, CalendarClock, HelpCircle, Plus, Minus, CirclePlay } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ADDON_DEFINITIONS } from '@shared/addon-definitions';
import { getAddonColorClasses, getAddonIconComponent } from '@/lib/addon-visuals';
import oficazLogo from '@/assets/oficaz-logo.png';

import { apiRequest } from '@/lib/queryClient';

import { useAuth } from '@/hooks/use-auth';
import { DemoLoadingOverlay } from '@/components/demo-loading-overlay';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Las contraseñas no coinciden',
      path: ['confirmPassword'],
    });
  }

  if (!data.sameAsAdmin) {
    if (!data.contactName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nombre de contacto requerido',
        path: ['contactName'],
      });
    }

    if (!data.contactPhone?.trim() || data.contactPhone.trim().length < 9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Teléfono de contacto no válido',
        path: ['contactPhone'],
      });
    }

    const emailValue = data.contactEmail?.trim() || '';
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
    if (!isEmailValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email de contacto no válido',
        path: ['contactEmail'],
      });
    }
  }
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

const MANDATORY_FEATURE_KEYS = ['employees'] as const;

const normalizeSelectedFeatures = (features: unknown): string[] => {
  const baseFeatures = Array.isArray(features)
    ? features.filter((feature): feature is string => typeof feature === 'string' && feature.trim().length > 0)
    : [];

  return Array.from(new Set([...MANDATORY_FEATURE_KEYS, ...baseFeatures]));
};

const getAddonDisplayName = (addon: Pick<Addon, 'key' | 'name'>): string => {
  if (addon.key === 'ai_assistant') {
    return 'OficazIA';
  }

  return addon.name;
};

type RoleVideoKey = 'admin' | 'manager' | 'employee';

const roleVideoConfig: Record<RoleVideoKey, { embedId: string; title: string }> = {
  admin: {
    embedId: 'THVtK0rxHzo',
    title: 'Video explicativo: Administrador',
  },
  manager: {
    embedId: 'Pwuv9q9PhDI',
    title: 'Video explicativo: Manager',
  },
  employee: {
    embedId: 'OydgoA8fYN4',
    title: 'Video explicativo: Empleado',
  },
};

interface PersistedRegisterWizardState {
  currentStep: number;
  formData: Partial<FormData>;
}

const REGISTER_WIZARD_STORAGE_PREFIX = 'registerWizardState:v2';

const DEFAULT_REGISTER_FORM_DATA: Partial<FormData> = {
  selectedFeatures: ['employees'], // employees is always included (free)
  admins: 1,
  managers: 0,
  employees: 0,
  sameAsAdmin: true,
};

const readPersistedRegisterWizardState = (key: string): PersistedRegisterWizardState | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedRegisterWizardState;
    if (typeof parsed?.currentStep !== 'number' || !parsed?.formData || typeof parsed.formData !== 'object') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

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

  const params = new URLSearchParams(search);
  const verificationToken = params.get('token');
  const emailFromUrl = params.get('email') || '';
  const referralCodeFromUrl = (params.get('ref') || '').trim();

  const wizardStorageKey = byInvitation
    ? `${REGISTER_WIZARD_STORAGE_PREFIX}:invitation:${invitationToken || invitationEmail || 'default'}`
    : `${REGISTER_WIZARD_STORAGE_PREFIX}:verification:${verificationToken || emailFromUrl || 'default'}`;

  const [isLoading, setIsLoading] = useState(false);
  const [validatingStep2, setValidatingStep2] = useState(false);
  const [validatingStep3, setValidatingStep3] = useState(false);
  const [formData, setFormData] = useState<Partial<FormData>>(() => {
    const persisted = readPersistedRegisterWizardState(wizardStorageKey);
    const persistedFeatures = normalizeSelectedFeatures(persisted?.formData?.selectedFeatures);

    return {
      ...DEFAULT_REGISTER_FORM_DATA,
      ...(persisted?.formData || {}),
      selectedFeatures: persistedFeatures,
    };
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(() => {
    const persisted = readPersistedRegisterWizardState(wizardStorageKey);
    const persistedStep = persisted?.currentStep;
    if (typeof persistedStep !== 'number' || persistedStep < 0 || persistedStep > 5) {
      return 0;
    }
    return persistedStep;
  });
  const [showDemoLoading, setShowDemoLoading] = useState(false);
  const [introAnimationStarted, setIntroAnimationStarted] = useState(false);
  const [isBackendComplete, setIsBackendComplete] = useState(false);
  const [activeRoleVideo, setActiveRoleVideo] = useState<RoleVideoKey | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrorIsTokenIssue, setSubmitErrorIsTokenIssue] = useState(false);
  const [promoCodeValidation, setPromoCodeValidation] = useState<{ status: 'idle' | 'checking' | 'valid' | 'invalid', message?: string, trialDays?: number }>({ status: 'idle' });
  
  useEffect(() => {
    if (!byInvitation && !verificationToken) {
      setIsLoading(false);
      setValidatingStep2(false);
      setValidatingStep3(false);
      const timer = setTimeout(() => {
        const referralQuery = referralCodeFromUrl ? `?ref=${encodeURIComponent(referralCodeFromUrl)}` : '';
        setLocation(`/request-code${referralQuery}`, { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [verificationToken, byInvitation, referralCodeFromUrl, setLocation]);

  useEffect(() => {
    document.documentElement.classList.add('dark-notch');
    return () => {
      document.documentElement.classList.remove('dark-notch');
    };
  }, []);

  useEffect(() => {
    // Use setTimeout to ensure DOM has updated before scrolling
    const timer = setTimeout(() => {
      const scrollContainer = document.querySelector('.wizard-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 50);
    return () => clearTimeout(timer);
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 0) {
      const timer = setTimeout(() => setIntroAnimationStarted(true), 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Load addons from API with pricing from database
  const { data: apiAddons = [] } = useQuery<Addon[]>({
    queryKey: ['/api/public/addons'],
  });
  
  // Load seat prices from API
  const { data: seatPrices = [] } = useQuery({
    queryKey: ['/api/public/seat-prices'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/public/seat-prices');
        if (!response.ok) throw new Error('Failed to fetch seat prices');
        return response.json();
      } catch (error) {
        console.warn('Failed to fetch seat prices, using defaults');
        return [];
      }
    },
  });
  
  // Build seat price map from API data (with fallback defaults)
  const seatPriceMap = {
    admin: seatPrices.find((s: any) => s.roleType === 'admin')?.monthlyPrice 
      ? parseFloat(seatPrices.find((s: any) => s.roleType === 'admin').monthlyPrice)
      : 6,
    manager: seatPrices.find((s: any) => s.roleType === 'manager')?.monthlyPrice
      ? parseFloat(seatPrices.find((s: any) => s.roleType === 'manager').monthlyPrice)
      : 4,
    employee: seatPrices.find((s: any) => s.roleType === 'employee')?.monthlyPrice
      ? parseFloat(seatPrices.find((s: any) => s.roleType === 'employee').monthlyPrice)
      : 2,
  };
  
  // Use API addons if available, fallback to ADDON_DEFINITIONS for offline mode
  const addons = apiAddons.length > 0 ? (apiAddons as any[]) : ADDON_DEFINITIONS;


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

  const step1Values = step1Form.watch();
  const step2Values = step2Form.watch();
  const step3Values = step3Form.watch();
  const step4Values = step4Form.watch();
  const step5Values = step5Form.watch();

  useEffect(() => {
    const currentFeatures = step1Form.getValues('selectedFeatures') ?? [];
    const normalizedFeatures = normalizeSelectedFeatures(currentFeatures);

    if (normalizedFeatures.length !== currentFeatures.length || normalizedFeatures.some((feature, index) => feature !== currentFeatures[index])) {
      step1Form.setValue('selectedFeatures', normalizedFeatures, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [step1Form, step1Values.selectedFeatures]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const { password: _password, confirmPassword: _confirmPassword, ...safeStep4Values } = step4Values;

    const persistedData: Partial<FormData> = {
      ...DEFAULT_REGISTER_FORM_DATA,
      ...formData,
      ...step1Values,
      ...step2Values,
      ...step3Values,
      ...safeStep4Values,
      ...step5Values,
      selectedFeatures: normalizeSelectedFeatures(step1Values.selectedFeatures ?? formData.selectedFeatures),
    };

    window.sessionStorage.setItem(
      wizardStorageKey,
      JSON.stringify({
        currentStep,
        formData: persistedData,
      }),
    );
  }, [wizardStorageKey, currentStep, formData, step1Values, step2Values, step3Values, step4Values, step5Values]);

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
    const normalizedData: Step1Data = {
      ...data,
      selectedFeatures: normalizeSelectedFeatures(data.selectedFeatures),
    };

    setFormData(prev => ({ ...prev, ...normalizedData }));
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
    const getReadableRegistrationError = (error: any): string => {
      const rawMessage = typeof error?.message === 'string' ? error.message : '';
      const parseCandidate = (candidate: string): string | null => {
        try {
          const parsed = JSON.parse(candidate);

          if (Array.isArray(parsed)) {
            const firstMessage = parsed.find((item: any) => typeof item?.message === 'string')?.message;
            return typeof firstMessage === 'string' && firstMessage.trim().length > 0
              ? firstMessage
              : null;
          }

          if (typeof parsed?.message === 'string' && parsed.message.trim().length > 0) {
            return parsed.message;
          }

          if (typeof parsed?.error === 'string' && parsed.error.trim().length > 0) {
            return parsed.error;
          }
        } catch {
          // Ignore JSON parse errors and fallback below.
        }

        return null;
      };

      const jsonSuffixMatch = rawMessage.match(/(\{.*\}|\[.*\])$/);

      if (jsonSuffixMatch) {
        const parsedMessage = parseCandidate(jsonSuffixMatch[0]);
        if (parsedMessage) {
          return parsedMessage;
        }
      }

      const wholeMessageParsed = parseCandidate(rawMessage);
      if (wholeMessageParsed) {
        return wholeMessageParsed;
      }

      if (rawMessage.trim().length > 0) {
        const trimmed = rawMessage.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          return 'No se pudo completar el registro. Revisa los datos y vuelve a intentarlo.';
        }
        return rawMessage;
      }

      return 'Error al crear la empresa';
    };

    try {
      setIsLoading(true);
      setSubmitError(null);
      setSubmitErrorIsTokenIssue(false);
      // Set flag BEFORE showing loader to prevent PublicRoute redirect
      sessionStorage.setItem('registrationWelcomeFlow', 'true');
      setShowDemoLoading(true);
      setIsBackendComplete(false);
      
      const urlParams = new URLSearchParams(search);
      const campaignId = urlParams.get('campaign');
      const registrationSource = urlParams.get('source') || 'direct';

      const passwordValue = (step4Form.getValues('password') || '').trim();
      const confirmPasswordValue = (step4Form.getValues('confirmPassword') || '').trim();

      if (passwordValue.length === 0 || confirmPasswordValue.length === 0) {
        sessionStorage.removeItem('registrationWelcomeFlow');
        setShowDemoLoading(false);
        setIsBackendComplete(false);
        setIsLoading(false);
        setCurrentStep(4);
        step4Form.setError('password', { message: 'Por seguridad, vuelve a introducir tu contraseña' });
        step4Form.setError('confirmPassword', { message: 'Confirma de nuevo tu contraseña para continuar' });
        return;
      }
      
      const latestFormSnapshot: Partial<FormData> = {
        ...formData,
        ...step1Form.getValues(),
        ...step2Form.getValues(),
        ...step3Form.getValues(),
        ...step4Form.getValues(),
        ...data,
        selectedFeatures: normalizeSelectedFeatures(step1Form.getValues('selectedFeatures')),
      };

      const isSameContact = latestFormSnapshot.sameAsAdmin !== false;

      const finalData = {
        ...latestFormSnapshot,
        verificationToken: byInvitation ? null : verificationToken,
        invitationToken: byInvitation ? invitationToken : null,
        referralCode: referralCodeFromUrl || undefined,
        contactName: isSameContact ? latestFormSnapshot.adminFullName : latestFormSnapshot.contactName,
        contactPhone: isSameContact ? latestFormSnapshot.adminPhone : latestFormSnapshot.contactPhone,
        contactEmail: isSameContact ? latestFormSnapshot.adminEmail : latestFormSnapshot.contactEmail,
        campaignId: campaignId,
        source: registrationSource,
      };
      
      try {
        await register(finalData);
        sessionStorage.removeItem(wizardStorageKey);
        // Welcome screen is handled by DemoLoadingOverlay, not the old modal
        setIsBackendComplete(true);
      } catch (error: any) {
        sessionStorage.removeItem('registrationWelcomeFlow');
        setShowDemoLoading(false);
        setIsBackendComplete(false);

        const readableMessage = getReadableRegistrationError(error);
        const normalizedMessage = readableMessage.toLowerCase();
        const isTokenIssue =
          normalizedMessage.includes('token de verificación inválido') ||
          normalizedMessage.includes('token de verificacion invalido') ||
          normalizedMessage.includes('token de verificación expirado') ||
          (normalizedMessage.includes('token') && normalizedMessage.includes('expirado'));

        if (isTokenIssue && !byInvitation) {
          sessionStorage.removeItem(wizardStorageKey);
          setIsLoading(false);
          setSubmitError(null);
          setSubmitErrorIsTokenIssue(false);
          setCurrentStep(0);
          setLocation('/request-code');
          return;
        }

        setSubmitError(
          isTokenIssue
            ? 'Tu enlace de verificación ha caducado o ya no es válido. Solicita un nuevo código para continuar.'
            : readableMessage,
        );
        setSubmitErrorIsTokenIssue(isTokenIssue);
        setIsLoading(false);
      }
    } catch (error: any) {
      sessionStorage.removeItem('registrationWelcomeFlow');
      setShowDemoLoading(false);
      setIsBackendComplete(false);
      setSubmitError(getReadableRegistrationError(error));
      setSubmitErrorIsTokenIssue(false);
      setIsLoading(false);
    }
  };

  const validatePromotionalCode = async (code: string) => {
    if (!code || code.trim() === '') {
      setPromoCodeValidation({ status: 'idle' });
      return;
    }
    
    setPromoCodeValidation({ status: 'checking' });
    
    try {
      const response = await apiRequest('POST', '/api/validate-promotional-code', { code: code.trim() });
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

  const selectedRoleVideo = activeRoleVideo ? roleVideoConfig[activeRoleVideo] : null;

  const renderRoleVideoButton = (role: RoleVideoKey) => (
    <button
      type="button"
      onClick={() => setActiveRoleVideo(role)}
      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-red-600 transition-colors flex items-center justify-center"
      title="Ver video explicativo"
      aria-label={`Ver video del rol ${role}`}
    >
      <CirclePlay className="w-4 h-4" />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Left Rail - Desktop only - Apple style minimal - FIXED position */}
      <div className="hidden lg:flex lg:w-80 xl:w-96 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f23] flex-col p-8 fixed inset-y-0 left-0 overflow-hidden z-40">
        {/* Subtle decorative gradient orbs */}
        <div className="absolute top-20 right-0 w-80 h-80 bg-oficaz-primary/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/5 rounded-full blur-[80px]" />
        
        {/* Logo - Centered at top */}
        <div className="relative z-10 flex justify-center pt-4 pb-12">
          <img src={oficazLogo} alt="Oficaz" className="h-10 w-auto" />
        </div>

        {referralCodeFromUrl && (
          <div className="relative z-10 mx-auto mb-6 max-w-sm rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            Registro con referido activo: <span className="font-semibold">{referralCodeFromUrl}</span>
          </div>
        )}

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

        {/* Price summary - compact version with real-time updates */}
        {currentStep >= 1 && (() => {
          const liveAdmins = Number(step2Values.admins ?? formData.admins ?? 1);
          const liveManagers = Number(step2Values.managers ?? formData.managers ?? 0);
          const liveEmployees = Number(step2Values.employees ?? formData.employees ?? 0);
          const liveFeatures = (step1Values.selectedFeatures || formData.selectedFeatures || []) as string[];
          const totalUsers = liveAdmins + liveManagers + liveEmployees;
          const totalFeatures = liveFeatures.length;
          const addonsPriceTotal = liveFeatures.reduce((sum: number, key: string) => {
            const addon = addons.find((a: any) => a.key === key);
            return sum + Number(addon?.monthlyPrice ?? 0);
          }, 0);
          const totalPrice = (liveAdmins * seatPriceMap.admin) + (liveManagers * seatPriceMap.manager) + (liveEmployees * seatPriceMap.employee) + addonsPriceTotal;
          
          return (
            <div className="relative z-10 pt-6 border-t border-white/10">
              <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Tu plan</div>
                  <div className="flex gap-3 text-xs text-gray-400">
                    <span>{totalUsers} usuarios</span>
                    {(currentStep >= 2 || totalFeatures > 0) && (
                      <span>{totalFeatures} funciones</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-300 text-sm">Total</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-white">€{totalPrice.toFixed(2)}</span>
                    <span className="text-gray-400 text-sm">/mes</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Minimal footer - just key benefits */}
        <div className="relative z-10 pt-6 space-y-3">
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
      {/* Right Panel - Main content with scroll - offset by fixed sidebar */}
      <div className="lg:ml-80 xl:ml-96 min-h-screen flex flex-col overflow-y-auto wizard-scroll-container">
        {/* Mobile header - hidden on intro step */}
        {currentStep > 0 && (
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <img src="/favicon.png" alt="Oficaz" className="h-6" />
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
            
            {/* Step 0: Introduction - Apple Style with original text */}
            {currentStep === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
                {/* Logo for mobile */}
                <div className="lg:hidden mb-20">
                  <img src="/favicon.png" alt="Oficaz" className="h-10 mx-auto" />
                </div>
                
                {/* Text content with refined Apple typography */}
                <div className="max-w-2xl mx-auto space-y-8 mb-16">
                  <p 
                    className={`text-[1.125rem] sm:text-[1.375rem] text-[#86868b] font-normal tracking-[-0.01em] transition-all duration-1000 ease-out ${
                      introAnimationStarted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
                    }`}
                  >
                    Este es un pequeño paso para nosotros,
                  </p>
                  <h1 
                    className={`text-[1.5rem] sm:text-[1.75rem] lg:text-[2.25rem] font-semibold text-[#1d1d1f] leading-[1.15] tracking-[-0.02em] transition-all duration-1000 ease-out delay-500 ${
                      introAnimationStarted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
                    }`}
                  >
                    pero un gran paso para que tu empresa sea más{' '}
                    <span className="text-oficaz-primary">Oficaz</span>
                  </h1>
                </div>
                
                {/* Button */}
                <div 
                  className={`transition-all duration-700 ease-out delay-1000 ${
                    introAnimationStarted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                >
                  <Button
                    onClick={() => setCurrentStep(1)}
                    size="lg"
                    className="h-14 px-10 rounded-full text-[1.0625rem] font-medium bg-[#0071e3] hover:bg-[#0077ED] text-white transition-all duration-200"
                    data-testid="button-start-wizard"
                  >
                    Avanzar
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <p className="text-[0.875rem] text-[#86868b] mt-8 font-normal">
                    Solo te llevará 2 minutos
                  </p>
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
              <form key={`step-1-${currentStep}`} onSubmit={step2Form.handleSubmit(handleTeamSubmit)} className="space-y-6 pb-28">
                <div className="hidden lg:grid lg:grid-cols-3 items-center gap-3 sticky top-3 z-30 bg-white/90 backdrop-blur-sm border border-gray-200/80 rounded-2xl p-3 shadow-sm lg:w-[calc(100%+6rem)] lg:-mx-12 xl:w-[calc(100%+8rem)] xl:-mx-16">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => goToStep(0)}
                    className="justify-self-start h-10 px-3 rounded-xl text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <div className="text-center px-2">
                    <h2 className="text-lg font-semibold text-gray-900">Vamos a configurar tu equipo</h2>
                    <p className="text-sm text-gray-500">Cuéntanos cuántas personas usarán Oficaz.</p>
                  </div>
                  <Button
                    type="submit"
                    data-testid="button-step1-continue-desktop"
                    className="justify-self-end h-10 px-4 rounded-xl"
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                <div className="text-center mb-8 wizard-section-animate lg:hidden">
                  <h2 className="text-2xl lg:text-3xl font-semibold text-gray-900 mb-3">
                    Vamos a configurar tu equipo
                  </h2>
                  <p className="text-gray-500">
                    Cuéntanos cuántas personas usarán Oficaz. No te preocupes, podrás cambiarlo cuando quieras.
                  </p>
                </div>

                {/* User counters - Visual Apple style with cascade animation */}
                <div className="space-y-4">
                  {/* Admin counter - minimum 1 required */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 wizard-animate wizard-delay-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                          <Crown className="w-7 h-7 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 text-lg">Administradores</h3>
                            {renderRoleVideoButton('admin')}
                          </div>
                          <p className="text-sm text-gray-500">Control total y facturación</p>
                          <span className="text-sm font-medium text-amber-600">€{seatPriceMap.admin}/usuario/mes</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('admins');
                            if (current > 1) step2Form.setValue('admins', current - 1);
                          }}
                          disabled={step2Form.watch('admins') <= 1}
                          className="w-11 h-11 rounded-xl bg-white border-2 border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          data-testid="button-minus-admins"
                        >
                          <Minus className="w-5 h-5 text-gray-600" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={step2Form.watch('admins')}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            step2Form.setValue('admins', Math.max(1, val));
                          }}
                          className="w-12 h-11 text-center text-2xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          data-testid="input-admins"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('admins');
                            step2Form.setValue('admins', current + 1);
                          }}
                          className="w-11 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 flex items-center justify-center transition-colors"
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
                  <div className="bg-white border-2 border-gray-100 hover:border-gray-200 rounded-2xl p-5 wizard-animate wizard-delay-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500 flex items-center justify-center flex-shrink-0">
                          <Users className="w-7 h-7 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 text-lg">Managers</h3>
                            {renderRoleVideoButton('manager')}
                          </div>
                          <p className="text-sm text-gray-500">Gestión de equipos e informes</p>
                          <span className="text-sm font-medium text-purple-600">€{seatPriceMap.manager}/usuario/mes</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('managers');
                            if (current > 0) step2Form.setValue('managers', current - 1);
                          }}
                          disabled={step2Form.watch('managers') <= 0}
                          className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          data-testid="button-minus-managers"
                        >
                          <Minus className="w-5 h-5 text-gray-600" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={step2Form.watch('managers')}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            step2Form.setValue('managers', Math.max(0, val));
                          }}
                          className="w-12 h-11 text-center text-2xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          data-testid="input-managers"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('managers');
                            step2Form.setValue('managers', current + 1);
                          }}
                          className="w-11 h-11 rounded-xl bg-purple-500 hover:bg-purple-600 flex items-center justify-center transition-colors"
                          data-testid="button-plus-managers"
                        >
                          <Plus className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Employee counter */}
                  <div className="bg-white border-2 border-gray-100 hover:border-gray-200 rounded-2xl p-5 wizard-animate wizard-delay-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <User className="w-7 h-7 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 text-lg">Empleados</h3>
                            {renderRoleVideoButton('employee')}
                          </div>
                          <p className="text-sm text-gray-500">Fichajes, ausencias, nóminas</p>
                          <span className="text-sm font-medium text-blue-600">€{seatPriceMap.employee}/usuario/mes</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('employees');
                            if (current > 0) step2Form.setValue('employees', current - 1);
                          }}
                          disabled={step2Form.watch('employees') <= 0}
                          className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          data-testid="button-minus-employees"
                        >
                          <Minus className="w-5 h-5 text-gray-600" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={step2Form.watch('employees')}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            step2Form.setValue('employees', Math.max(0, val));
                          }}
                          className="w-12 h-11 text-center text-2xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          data-testid="input-employees"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const current = step2Form.getValues('employees');
                            step2Form.setValue('employees', current + 1);
                          }}
                          className="w-11 h-11 rounded-xl bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors"
                          data-testid="button-plus-employees"
                        >
                          <Plus className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:hidden sticky bottom-0 z-20 flex gap-3 pt-4 pb-2 bg-[#f5f5f7]/95 backdrop-blur-sm border-t border-gray-200/80">
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
              <form key={`step-2-${currentStep}`} onSubmit={step1Form.handleSubmit(handleFeaturesSubmit)} className="space-y-6 pb-28 lg:space-y-0 lg:pb-0 lg:h-[calc(100vh-6rem)] lg:flex lg:flex-col">
                <div className="hidden lg:grid lg:grid-cols-3 items-center gap-3 sticky top-3 z-30 bg-white border border-gray-200/90 rounded-2xl p-3 shadow-sm lg:w-[calc(100%+6rem)] lg:-mx-12 xl:w-[calc(100%+8rem)] xl:-mx-16">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => goToStep(1)}
                    className="justify-self-start h-10 px-3 rounded-xl text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <div className="text-center px-2">
                    <h2 className="text-lg font-semibold text-gray-900">Elige las funciones que te interesan</h2>
                    <p className="text-sm text-gray-500">Selecciona lo que necesitas ahora.</p>
                  </div>
                  <Button
                    type="submit"
                    data-testid="button-step2-continue-desktop"
                    disabled={(step1Form.watch('selectedFeatures') || []).length === 0}
                    className="justify-self-end h-10 px-4 rounded-xl"
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                <div className="text-center mb-8 wizard-section-animate lg:hidden">
                  <h2 className="text-2xl lg:text-3xl font-semibold text-gray-900 mb-3">
                    Elige las funciones que te interesan
                  </h2>
                  <p className="text-gray-500">
                    Selecciona lo que necesitas ahora. Podrás añadir más cuando quieras.
                  </p>
                </div>

                <div className="lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:-mt-1">
                  <div className="lg:h-full lg:overflow-y-auto lg:pt-5 lg:pr-2">
                  {/* Features grid - Apple style cards with cascade animation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {addons.map((addon, index) => {
                      const Icon = getAddonIconComponent(addon.key, addon.icon);
                      const selectedFeatures = step1Form.watch('selectedFeatures') || [];
                      const isSelected = selectedFeatures.includes(addon.key);
                      const price = Number(addon.monthlyPrice);
                      const isFree = addon.isFreeFeature;
                      const isLocked = addon.key === 'employees'; // employees is always included
                      
                      return (
                        <label
                          key={addon.key}
                          htmlFor={`feature-${addon.key}`}
                          data-testid={`feature-${addon.key}`}
                          className={`
                            flex flex-col p-5 rounded-2xl min-h-[160px]
                            wizard-animate wizard-delay-${index}
                            ${isLocked 
                              ? 'bg-green-50 border-2 border-green-300 cursor-default'
                              : isSelected 
                                ? 'bg-oficaz-primary/5 border-2 border-oficaz-primary shadow-lg shadow-oficaz-primary/10 scale-[1.02] cursor-pointer' 
                                : 'bg-white border-2 border-gray-100 hover:border-gray-200 hover:shadow-md cursor-pointer'
                            }
                          `}
                        >
                          <input
                            type="checkbox"
                            id={`feature-${addon.key}`}
                            value={addon.key}
                            {...step1Form.register('selectedFeatures')}
                            className="sr-only"
                            disabled={isLocked}
                            checked={isLocked ? true : undefined}
                          />
                          
                          {/* Header: Icon + Name + Selection indicator */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`
                              w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                              ${getAddonColorClasses(addon.key, isFree)}
                              ${isSelected ? 'ring-2 ring-oficaz-primary/35' : ''}
                            `}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-gray-900 flex-1">{getAddonDisplayName(addon)}</span>
                            <div className={`
                              w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0
                              ${isLocked ? 'bg-green-500 text-white' : isSelected ? 'bg-oficaz-primary text-white' : 'bg-gray-100'}
                            `}>
                              {(isSelected || isLocked) && <Check className="w-4 h-4" />}
                            </div>
                          </div>
                          
                          {/* Description - full text with personality */}
                          <p className="text-sm text-gray-500 flex-1 leading-relaxed">{addon.description}</p>
                          
                          {/* Price - bottom right */}
                          <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                            {isFree ? (
                              <Badge className="bg-green-100 text-green-700 border-0">
                                Gratis - Incluido
                              </Badge>
                            ) : (
                              <span className={`text-base font-bold ${isSelected ? 'text-oficaz-primary' : 'text-gray-700'}`}>
                                €{price}<span className="text-sm font-normal text-gray-400">/mes</span>
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Validation error */}
                  {step1Form.formState.errors.selectedFeatures && (
                    <p className="text-sm text-red-500 text-center mt-4">
                      {step1Form.formState.errors.selectedFeatures.message}
                    </p>
                  )}

                  {(step1Form.watch('selectedFeatures') || []).length === 0 && (
                    <p className="hidden lg:block text-xs text-gray-400 text-center mt-4">
                      Selecciona al menos 1 funcionalidad para continuar
                    </p>
                  )}
                  </div>
                </div>

                <div className="lg:hidden sticky bottom-0 z-20 flex gap-3 pt-4 pb-2 bg-[#f5f5f7]/95 backdrop-blur-sm border-t border-gray-200/80">
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
                  <p className="lg:hidden text-xs text-gray-400 text-center">
                    Selecciona al menos 1 funcionalidad para continuar
                  </p>
                )}
              </form>
            )}

            {/* Step 3: Company - Friendly tone */}
            {currentStep === 3 && (
              <form key={`step-3-${currentStep}`} onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-6 pb-28">
                <div className="hidden lg:grid lg:grid-cols-3 items-center gap-3 sticky top-3 z-30 bg-white/90 backdrop-blur-sm border border-gray-200/80 rounded-2xl p-3 shadow-sm lg:w-[calc(100%+6rem)] lg:-mx-12 xl:w-[calc(100%+8rem)] xl:-mx-16">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => goToStep(2)}
                    className="justify-self-start h-10 px-3 rounded-xl text-gray-600 hover:text-gray-900"
                    disabled={validatingStep2}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <div className="text-center px-2">
                    <h2 className="text-lg font-semibold text-gray-900">Cuéntanos sobre tu empresa</h2>
                    <p className="text-sm text-gray-500">Solo necesitamos unos datos básicos para empezar.</p>
                  </div>
                  <Button
                    type="submit"
                    data-testid="button-step3-continue-desktop"
                    className="justify-self-end h-10 px-4 rounded-xl"
                    disabled={validatingStep2}
                  >
                    {validatingStep2 ? 'Verificando...' : 'Continuar'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                <div className="text-center lg:text-left mb-6 wizard-section-animate lg:hidden">
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                    Cuéntanos sobre tu empresa
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Solo necesitamos unos datos básicos para empezar
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 wizard-animate wizard-delay-1">
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
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        oficaz.es/
                      </span>
                      <Input
                        id="companyAlias"
                        placeholder="mi-empresa"
                        className="h-12 rounded-xl bg-white border-gray-200 pl-20"
                        {...step3Form.register('companyAlias')}
                        onChange={(e) => {
                          const normalized = e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, '-')
                            .replace(/[^a-z0-9-]/g, '');
                          step3Form.setValue('companyAlias', normalized, { shouldValidate: true });
                        }}
                      />
                    </div>
                    {step3Form.formState.errors.companyAlias && (
                      <p className="text-xs text-red-500">{step3Form.formState.errors.companyAlias.message}</p>
                    )}
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="province" className="text-sm font-medium text-gray-700">
                      Provincia
                    </Label>
                    <Controller
                      control={step3Form.control}
                      name="province"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
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
                      )}
                    />
                    {step3Form.formState.errors.province && (
                      <p className="text-xs text-red-500">{step3Form.formState.errors.province.message}</p>
                    )}
                  </div>
                </div>

                <div className="lg:hidden sticky bottom-0 z-20 flex gap-3 pt-4 pb-2 bg-[#f5f5f7]/95 backdrop-blur-sm border-t border-gray-200/80">
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
              <form key={`step-4-${currentStep}`} onSubmit={step4Form.handleSubmit(handleStep4Submit)} className="space-y-6 pb-28">
                <div className="hidden lg:grid lg:grid-cols-3 items-center gap-3 sticky top-3 z-30 bg-white/90 backdrop-blur-sm border border-gray-200/80 rounded-2xl p-3 shadow-sm lg:w-[calc(100%+6rem)] lg:-mx-12 xl:w-[calc(100%+8rem)] xl:-mx-16">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => goToStep(3)}
                    className="justify-self-start h-10 px-3 rounded-xl text-gray-600 hover:text-gray-900"
                    disabled={validatingStep3}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <div className="text-center px-2">
                    <h2 className="text-lg font-semibold text-gray-900">Crea tu cuenta</h2>
                    <p className="text-sm text-gray-500">Estos serán tus datos de acceso como administrador.</p>
                  </div>
                  <Button
                    type="submit"
                    data-testid="button-step4-continue-desktop"
                    className="justify-self-end h-10 px-4 rounded-xl"
                    disabled={validatingStep3}
                  >
                    {validatingStep3 ? 'Verificando...' : 'Continuar'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                <div className="text-center lg:text-left mb-6 wizard-section-animate lg:hidden">
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                    Crea tu cuenta
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Estos serán tus datos de acceso como administrador
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 wizard-animate wizard-delay-1">
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
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowPassword((prev) => !prev)}
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
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
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

                <div className="lg:hidden sticky bottom-0 z-20 flex gap-3 pt-4 pb-2 bg-[#f5f5f7]/95 backdrop-blur-sm border-t border-gray-200/80">
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

            {/* Step 5: Confirmation - Apple Style */}
            {currentStep === 5 && (
              <form key={`step-5-${currentStep}`} onSubmit={step5Form.handleSubmit(handleStep5Submit)} className="space-y-8 pb-28">
                <div className="hidden lg:grid lg:grid-cols-3 items-center gap-3 sticky top-3 z-30 bg-white/90 backdrop-blur-sm border border-gray-200/80 rounded-2xl p-3 shadow-sm lg:w-[calc(100%+6rem)] lg:-mx-12 xl:w-[calc(100%+8rem)] xl:-mx-16">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => goToStep(4)}
                    className="justify-self-start h-10 px-3 rounded-xl text-gray-600 hover:text-gray-900"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <div className="text-center px-2">
                    <h2 className="text-lg font-semibold text-gray-900">Confirma tu configuración</h2>
                    <p className="text-sm text-gray-500">Revisa todo y activa tu prueba en segundos.</p>
                  </div>
                  <div className="justify-self-end w-full" aria-hidden="true" />
                </div>

                {/* Header - Personalized */}
                <div className="text-center mb-6 wizard-section-animate lg:hidden">
                  <h2 className="text-2xl lg:text-3xl font-semibold text-gray-900 mb-3">
                    Este es tu plan perfecto para {formData.companyName || 'tu empresa'}
                  </h2>
                  <p className="text-gray-500">
                    Ni más ni menos, solo lo que necesitas.
                  </p>
                </div>

                {submitError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                    {submitErrorIsTokenIssue && !byInvitation && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setLocation('/request-code')}
                        className="h-10 rounded-xl border-red-200 text-red-700 hover:bg-red-100"
                      >
                        Solicitar nuevo código
                      </Button>
                    )}
                  </div>
                )}

                {referralCodeFromUrl && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-800">
                      Este registro quedará asociado al referido
                      {' '}
                      <span className="font-semibold">{referralCodeFromUrl}</span>
                      {' '}
                      y se aplicará al programa cuando la empresa complete su primer pago.
                    </p>
                  </div>
                )}

                {/* Minimal Summary Card */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm wizard-animate wizard-delay-1">
                  {/* Features - Compact list */}
                  <div className="mb-6">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Funcionalidades</span>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.selectedFeatures && formData.selectedFeatures.map((featureKey: string) => {
                        const addon = addons.find(a => a.key === featureKey);
                        if (!addon) return null;
                        const Icon = getAddonIconComponent(addon.key, addon.icon);
                        return (
                          <div key={featureKey} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${getAddonColorClasses(addon.key, addon.isFreeFeature)}`}>
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{getAddonDisplayName(addon)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gray-100 my-6" />

                  {/* Team - Simple numbers */}
                  <div className="mb-6">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tu equipo</span>
                    <div className="flex items-center gap-6 mt-3">
                      {(formData.employees || 0) > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-gray-900">{formData.employees}</span>
                          <span className="text-sm text-gray-500">empleados</span>
                        </div>
                      )}
                      {(formData.managers || 0) > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-gray-900">{formData.managers}</span>
                          <span className="text-sm text-gray-500">managers</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900">{formData.admins || 1}</span>
                        <span className="text-sm text-gray-500">admin{(formData.admins || 1) > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gray-100 my-6" />

                  {/* Promo code */}
                  <div className="space-y-2 mb-6">
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
                          <LoadingSpinner size="xs" />
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
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                      <Checkbox
                        id="acceptTerms"
                        checked={step5Form.watch('acceptTerms') || false}
                        onCheckedChange={(checked) => step5Form.setValue('acceptTerms', checked as boolean)}
                        className="mt-0.5"
                      />
                      <Label htmlFor="acceptTerms" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                        Acepto los{' '}
                        <a href="/terminos" target="_blank" className="text-oficaz-primary hover:underline">Términos</a>,{' '}
                        <a href="/politica-privacidad" target="_blank" className="text-oficaz-primary hover:underline">Privacidad</a> y{' '}
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

                  {/* Divider */}
                  <div className="h-px bg-gray-100 my-6" />

                  {/* Price - Big and centered */}
                  <div className="text-center">
                    <div className="mb-2">
                      <span className="text-5xl font-bold text-gray-900">
                        €{
                          ((formData.admins || 1) * seatPriceMap.admin) + 
                          ((formData.managers || 0) * seatPriceMap.manager) + 
                          ((formData.employees || 0) * seatPriceMap.employee) +
                          (formData.selectedFeatures?.reduce((sum: number, key: string) => {
                            const addon = addons.find(a => a.key === key);
                            return sum + (addon ? Number(addon.monthlyPrice) : 0);
                          }, 0) || 0)
                        }
                      </span>
                      <span className="text-xl text-gray-400">/mes</span>
                    </div>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                      A este precio hay que descontarle las horas que te vamos a ahorrar en trabajo.
                    </p>
                  </div>

                  {/* Final CTA in body for desktop and mobile */}
                  <div className="mt-8 rounded-2xl bg-gradient-to-r from-[#0b7fdc] to-[#0aa5d6] p-5 text-white shadow-lg shadow-sky-200/70">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="text-sm text-white/85">Todo listo para empezar</p>
                        <p className="text-lg font-semibold">Activa ahora tu entorno y prueba todas las funciones</p>
                      </div>
                      <Button
                        type="submit"
                        data-testid="button-start-trial-body"
                        className="h-12 px-6 rounded-xl bg-white text-[#0b7fdc] hover:bg-slate-100 font-semibold"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Creando...' : 'Comenzar prueba'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Trial Badge - Minimal */}
                <div className="text-center py-6 wizard-animate wizard-delay-2">
                  <div className="inline-flex items-center gap-3 bg-green-50 rounded-full px-6 py-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Star className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold text-green-900 block">
                        {promoCodeValidation.status === 'valid' && promoCodeValidation.trialDays 
                          ? `${promoCodeValidation.trialDays} días para probarlo todo` 
                          : '7 días para probarlo todo'
                        }
                      </span>
                      <span className="text-xs text-green-700">Hoy no tienes que pagar nada</span>
                    </div>
                  </div>
                </div>

                <div className="lg:hidden sticky bottom-0 z-20 flex gap-3 pt-4 pb-2 bg-[#f5f5f7]/95 backdrop-blur-sm border-t border-gray-200/80">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => goToStep(4)}
                    className="w-full h-12 rounded-xl"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Atrás
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
        companyName={formData.companyName}
        onComplete={() => {
          // Clear the welcome flow flag to allow normal routing
          sessionStorage.removeItem('registrationWelcomeFlow');
          setShowDemoLoading(false);
          setIsBackendComplete(false);
          setLocation('/dashboard');
        }}
      />

      <Dialog open={!!selectedRoleVideo} onOpenChange={(open) => {
        if (!open) {
          setActiveRoleVideo(null);
        }
      }}>
        <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none [&>button]:hidden" data-testid="register-role-video-dialog">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedRoleVideo?.title || 'Video explicativo'}</DialogTitle>
            <DialogDescription>Video explicativo del rol seleccionado</DialogDescription>
          </DialogHeader>
          {selectedRoleVideo ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-black dark:border-gray-700">
              <div className="relative aspect-video w-full">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${selectedRoleVideo.embedId}?autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&playsinline=1&fs=0`}
                  title={selectedRoleVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

