import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Building, User, Eye, EyeOff, Users, CheckCircle, ArrowRight, ArrowLeft, Calendar, FileText, MessageSquare, Shield, Star, Crown } from 'lucide-react';

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

// Step schemas for validation
const step1Schema = z.object({
  teamSize: z.string().min(1, 'Selecciona el tamaño de tu equipo'),
  interestedFeatures: z.array(z.string()).min(1, 'Selecciona al menos una funcionalidad'),
});

const step2Schema = z.object({
  companyName: z.string().min(2, 'El nombre de la empresa debe tener al menos 2 caracteres'),
  cif: z.string().min(9, 'El CIF debe tener al menos 9 caracteres'),
  companyEmail: z.string().email('Email no válido'),
  companyAlias: z.string()
    .min(3, 'El alias debe tener al menos 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo se permiten letras minúsculas, números y guiones'),
  province: z.string().min(1, 'Selecciona una provincia'),
});

const step3Schema = z.object({
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

const step4Schema = z.object({
  selectedPlan: z.string().min(1, 'Selecciona un plan de suscripción'),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos y condiciones para continuar',
  }),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Step4Data = z.infer<typeof step4Schema>;

type FormData = Step1Data & Step2Data & Step3Data & Step4Data;

interface RegisterProps {
  byInvitation?: boolean;
  invitationEmail?: string;
  invitationToken?: string;
  invitationWelcomeMessage?: string;
}

export default function Register({ byInvitation = false, invitationEmail, invitationToken, invitationWelcomeMessage }: RegisterProps = {}) {
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

  // Check for verification token (only if not by invitation)
  const params = new URLSearchParams(search);
  const verificationToken = params.get('token');
  
  useEffect(() => {
    if (!byInvitation && !verificationToken) {
      // Clear any loading states and redirect only if not invitation
      setIsLoading(false);
      setValidatingStep2(false);
      setValidatingStep3(false);
      window.location.href = '/request-code';
    }
  }, [verificationToken, byInvitation]);

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

  // Step 1 form
  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      teamSize: '',
      interestedFeatures: [],
    },
  });

  // Step 2 form
  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      companyName: '',
      cif: '',
      companyEmail: '',
      companyAlias: '',
      province: '',
    },
  });

  // Step 3 form
  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      adminFullName: '',
      adminEmail: '',
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

  // Step 4 form
  const step4Form = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      selectedPlan: '',
      acceptTerms: false,
    },
  });

  const progressPercentage = (currentStep / 4) * 100;

  const features = [
    { id: 'timeTracking', name: 'Fichajes', icon: Calendar, description: 'Control de horarios y asistencia' },
    { id: 'vacation', name: 'Vacaciones', icon: Calendar, description: 'Gestión de solicitudes de vacaciones' },
    { id: 'documents', name: 'Documentos', icon: FileText, description: 'Gestión documental' },
    { id: 'messages', name: 'Mensajes', icon: MessageSquare, description: 'Comunicación interna' },
  ];

  const teamSizes = [
    { value: '1-5', label: '1-5 personas', description: 'Pequeño equipo' },
    { value: '6-15', label: '6-15 personas', description: 'Equipo mediano' },
    { value: '16-50', label: '16-50 personas', description: 'Empresa mediana' },
    { value: '51+', label: '51+ personas', description: 'Gran empresa' },
  ];

  const handleStep1Submit = (data: Step1Data) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  const handleStep2Submit = async (data: Step2Data) => {
    try {
      setValidatingStep2(true);
      
      // Validate all company fields for uniqueness
      const validations = await Promise.all([
        validateCompanyField('name', data.companyName),
        validateCompanyField('cif', data.cif),
        validateCompanyField('billingEmail', data.companyEmail),
        validateCompanyField('alias', data.companyAlias),
      ]);

      const [nameAvailable, cifAvailable, emailAvailable, aliasAvailable] = validations;

      if (!nameAvailable) {
        step2Form.setError('companyName', { message: 'Ya existe una empresa con este nombre' });
        return;
      }
      if (!cifAvailable) {
        step2Form.setError('cif', { message: 'Este CIF ya está registrado' });
        return;
      }
      if (!emailAvailable) {
        step2Form.setError('companyEmail', { message: 'Este email ya está en uso' });
        return;
      }
      if (!aliasAvailable) {
        step2Form.setError('companyAlias', { message: 'Este alias ya está en uso' });
        return;
      }

      // All validations passed, continue to next step
      setFormData(prev => ({ ...prev, ...data }));
      setCurrentStep(3);
    } catch (error) {
      console.error("Validation error:", "Error al verificar los datos. Inténtalo de nuevo.");
    } finally {
      setValidatingStep2(false);
    }
  };

  const handleStep3Submit = async (data: Step3Data) => {
    try {
      setValidatingStep3(true);
      
      console.log('Step 3 data:', data);
      console.log('Step 3 form errors:', step3Form.formState.errors);
      
      // Validate admin user fields for uniqueness
      const emailAvailable = await validateUserField('email', data.adminEmail);

      if (!emailAvailable) {
        step3Form.setError('adminEmail', { message: 'Este email ya está registrado' });
        return;
      }

      // All validations passed, continue to plan selection
      setFormData(prev => ({ ...prev, ...data }));
      setCurrentStep(4);
    } catch (error: any) {
      console.error('Validation error:', error.message || 'Error al verificar los datos');
    } finally {
      setValidatingStep3(false);
    }
  };

  const handleStep4Submit = async (data: Step4Data) => {
    try {
      setIsLoading(true);
      setShowDemoLoading(true);
      
      // Prepare final registration data
      const finalData = { 
        ...formData, 
        ...data,
        verificationToken: byInvitation ? null : verificationToken,
        invitationToken: byInvitation ? invitationToken : null,
        // Set contactName to adminFullName if sameAsAdmin is true
        contactName: formData.sameAsAdmin ? formData.adminFullName : formData.contactName
      };
      
      console.log('Final registration data:', finalData);
      
      try {
        await register(finalData);
        console.log('Registration successful, redirecting to dashboard');
        // Set flag to show welcome modal on dashboard
        localStorage.setItem('showWelcomeModal', 'true');
        // Keep loading overlay visible until redirect
        setLocation('/dashboard');
      } catch (error: any) {
        console.error('Registration failed:', error);
        setShowDemoLoading(false);
        
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
    
    // Basic scoring system
    let score = 0;
    
    // Team size scoring (more conservative)
    if (teamSize === '1-5') score += 1;
    else if (teamSize === '6-15') score += 2;
    else if (teamSize === '16-50') score += 3;
    else if (teamSize === '51+') score += 4;
    
    // Features scoring (reduced impact)
    const featureCount = interestedFeatures?.length || 0;
    if (featureCount >= 4) score += 2;
    else if (featureCount >= 3) score += 1;
    
    // Advanced features boost (only for very advanced features)
    if (interestedFeatures?.includes('reports')) score += 1;
    if (interestedFeatures?.includes('notifications')) score += 1;
    
    // Conservative recommendation logic (Master plan hidden for now)
    // Only recommend Pro for larger teams with many features
    if (score >= 5 && teamSize !== '1-5') return 'pro';
    else if (score >= 3 && teamSize !== '1-5') return 'pro';
    else return 'basic';
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
              Proceso rápido en 4 pasos - Solo toma un minuto
            </CardDescription>
          </div>
          
          {/* Progress bar */}
          <div className="w-full">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs md:text-sm font-medium text-gray-500">Paso {currentStep} de 4</span>
              <span className="text-xs md:text-sm font-medium text-gray-500">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-1.5 md:h-2" />
          </div>

          {/* Step indicators */}
          <div className="flex justify-center items-center space-x-3 md:space-x-6">
            <div className={`flex items-center space-x-1 md:space-x-2 ${currentStep >= 1 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 text-xs ${
                currentStep >= 1 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                {currentStep > 1 ? <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3" /> : '1'}
              </div>
              <span className="text-xs font-medium hidden sm:block">Preferencias</span>
            </div>
            <div className={`flex items-center space-x-1 md:space-x-2 ${currentStep >= 2 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 text-xs ${
                currentStep >= 2 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                {currentStep > 2 ? <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3" /> : '2'}
              </div>
              <span className="text-xs font-medium hidden sm:block">Empresa</span>
            </div>
            <div className={`flex items-center space-x-1 md:space-x-2 ${currentStep >= 3 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 text-xs ${
                currentStep >= 3 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                {currentStep > 3 ? <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3" /> : '3'}
              </div>
              <span className="text-xs font-medium hidden sm:block">Administrador</span>
            </div>
            <div className={`flex items-center space-x-1 md:space-x-2 ${currentStep >= 4 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 text-xs ${
                currentStep >= 4 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                4
              </div>
              <span className="text-xs font-medium hidden sm:block">Plan</span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Step 1: Team preferences */}
          {currentStep === 1 && (
            <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-6">
              <div className="text-center mb-4">
                <Users className="h-6 w-6 md:h-8 md:w-8 text-oficaz-primary mx-auto mb-2" />
                <h3 className="text-sm md:text-base font-semibold mb-1">Queremos saber como es tu equipo</h3>
                <p className="text-xs text-gray-600">Esto nos ayudará a personalizar la experiencia</p>
              </div>

              {/* Team size selection */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">¿Cuántas personas van a usar la aplicación?</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {teamSizes.map((size) => {
                    const isSelected = step1Form.watch('teamSize') === size.value;
                    return (
                      <div key={size.value} className="relative">
                        <input
                          type="radio"
                          id={`teamSize-${size.value}`}
                          value={size.value}
                          {...step1Form.register('teamSize')}
                          className="sr-only"
                        />
                        <label
                          htmlFor={`teamSize-${size.value}`}
                          className={`block p-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-all ${
                            isSelected
                              ? 'bg-oficaz-primary/5 border-oficaz-primary ring-2 ring-oficaz-primary/20'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-medium">{size.label}</div>
                              <div className="text-xs text-gray-500">{size.description}</div>
                            </div>
                            <div className={`w-3 h-3 border rounded-full ${
                              isSelected
                                ? 'bg-oficaz-primary border-oficaz-primary'
                                : 'border-gray-300'
                            }`}></div>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
                {step1Form.formState.errors.teamSize && (
                  <p className="text-sm text-red-600">{step1Form.formState.errors.teamSize.message}</p>
                )}
              </div>

              {/* Features selection */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">¿Qué funcionalidades te interesan más?</Label>
                <p className="text-xs text-gray-500">Selecciona todas las que quieras, sin miedo</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {features.map((feature) => {
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
                          className={`block p-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-all ${
                            isSelected
                              ? 'bg-oficaz-primary/5 border-oficaz-primary ring-2 ring-oficaz-primary/20'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Icon className="h-3 w-3 text-oficaz-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{feature.name}</div>
                              <div className="text-xs text-gray-500 truncate">{feature.description}</div>
                            </div>
                            <div className={`w-3 h-3 border rounded-full ${
                              isSelected
                                ? 'bg-oficaz-primary border-oficaz-primary'
                                : 'border-gray-300'
                            }`}></div>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
                {step1Form.formState.errors.interestedFeatures && (
                  <p className="text-sm text-red-600">{step1Form.formState.errors.interestedFeatures.message}</p>
                )}
              </div>

              <div className="flex justify-center pt-4">
                <Button type="submit" className="w-full rounded-xl px-8">
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* Step 2: Company information */}
          {currentStep === 2 && (
            <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-6">
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
                    {...step2Form.register('companyName')}
                    placeholder="Mi Empresa S.L."
                  />
                  {step2Form.formState.errors.companyName && (
                    <p className="text-sm text-red-600">{step2Form.formState.errors.companyName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cif">CIF *</Label>
                  <Input
                    id="cif"
                    className="rounded-xl"
                    {...step2Form.register('cif')}
                    placeholder="B12345678"
                  />
                  {step2Form.formState.errors.cif && (
                    <p className="text-sm text-red-600">{step2Form.formState.errors.cif.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email corporativo / facturación *</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    className="rounded-xl"
                    {...step2Form.register('companyEmail')}
                    placeholder="info@miempresa.com"
                  />
                  {step2Form.formState.errors.companyEmail && (
                    <p className="text-sm text-red-600">{step2Form.formState.errors.companyEmail.message}</p>
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
                    {...step2Form.register('companyAlias')}
                    placeholder="miempresa"
                  />
                  <p className="text-xs text-gray-500">Tu URL será: oficaz.com/{step2Form.watch('companyAlias') || 'miempresa'}</p>
                  {step2Form.formState.errors.companyAlias && (
                    <p className="text-sm text-red-600">{step2Form.formState.errors.companyAlias.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="province">Provincia *</Label>
                  <Select value={step2Form.watch('province')} onValueChange={(value) => step2Form.setValue('province', value)}>
                    <SelectTrigger className="rounded-xl mt-2">
                      <SelectValue placeholder="Selecciona tu provincia" />
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
                  {step2Form.formState.errors.province && (
                    <p className="text-sm text-red-600">{step2Form.formState.errors.province.message}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                <Button 
                  type="submit" 
                  className="w-full sm:flex-1 rounded-xl px-8 order-1 sm:order-2"
                  disabled={validatingStep2}
                >
                  {validatingStep2 ? 'Verificando datos...' : 'Continuar'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button type="button" variant="outline" onClick={() => goToStep(1)} className="w-full sm:flex-1 rounded-xl px-8 order-2 sm:order-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Atrás
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Admin account */}
          {currentStep === 3 && (
            <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-6">
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
                    {...step3Form.register('adminFullName')}
                    placeholder="Juan Pérez García"
                  />
                  {step3Form.formState.errors.adminFullName && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.adminFullName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email de administrador *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    className="rounded-xl"
                    {...step3Form.register('adminEmail')}
                    placeholder="admin@miempresa.com"
                  />
                  <p className="text-xs text-gray-500">Este será tu email para iniciar sesión</p>
                  {step3Form.formState.errors.adminEmail && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.adminEmail.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminDni">DNI/NIE del administrador *</Label>
                  <Input
                    id="adminDni"
                    className="rounded-xl"
                    {...step3Form.register('adminDni')}
                    placeholder="12345678Z"
                  />
                  <p className="text-xs text-gray-500">DNI español o NIE para extranjeros</p>
                  {step3Form.formState.errors.adminDni && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.adminDni.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPhone">Teléfono empresarial *</Label>
                  <Input
                    id="adminPhone"
                    className="rounded-xl"
                    {...step3Form.register('adminPhone')}
                    placeholder="+34 600 000 000"
                  />
                  <p className="text-xs text-gray-500">Teléfono de contacto de la empresa</p>
                  {step3Form.formState.errors.adminPhone && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.adminPhone.message}</p>
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
                      {...step3Form.register('password')}
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
                  {step3Form.formState.errors.password && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      className="rounded-xl"
                      type={showConfirmPassword ? 'text' : 'password'}
                      {...step3Form.register('confirmPassword')}
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
                  {step3Form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-600">{step3Form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Contact person section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sameAsAdmin"
                    checked={step3Form.watch('sameAsAdmin')}
                    onCheckedChange={(checked) => step3Form.setValue('sameAsAdmin', checked as boolean)}
                  />
                  <Label htmlFor="sameAsAdmin" className="text-sm">
                    Yo seré la persona de contacto de la empresa
                  </Label>
                </div>

                {!step3Form.watch('sameAsAdmin') && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Nombre de contacto</Label>
                      <Input
                        id="contactName"
                        className="rounded-xl"
                        {...step3Form.register('contactName')}
                        placeholder="María García"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Teléfono de contacto</Label>
                      <Input
                        id="contactPhone"
                        className="rounded-xl"
                        {...step3Form.register('contactPhone')}
                        placeholder="+34 600 000 000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Email de contacto</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        className="rounded-xl"
                        {...step3Form.register('contactEmail')}
                        placeholder="maria@miempresa.com"
                      />
                    </div>
                  </div>
                )}
                
                {!step3Form.watch('sameAsAdmin') && step3Form.formState.errors.contactName && (
                  <p className="text-sm text-red-600">{step3Form.formState.errors.contactName.message}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                <Button type="submit" className="w-full sm:flex-1 rounded-xl px-8 order-1 sm:order-2" disabled={validatingStep3}>
                  {validatingStep3 ? 'Verificando datos...' : 'Continuar'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setValidatingStep3(false);
                    setIsLoading(false);
                    goToStep(2);
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

          {/* Step 4: Plan Selection */}
          {currentStep === 4 && (
            <form onSubmit={step4Form.handleSubmit(handleStep4Submit)} className="space-y-6">
              <div className="text-center mb-6">
                <Crown className="h-12 w-12 text-oficaz-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">Elige tu plan</h3>
                <p className="text-sm text-gray-600">
                  Basado en tus respuestas, te recomendamos el plan{' '}
                  <Badge variant="secondary" className="mx-1 capitalize">{recommendedPlan}</Badge>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subscriptionPlans.map((plan: any) => {
                  const isRecommended = plan.name === recommendedPlan;
                  return (
                    <div
                      key={plan.id}
                      className={`relative border rounded-xl p-4 cursor-pointer transition-all ${
                        step4Form.watch('selectedPlan') === plan.name
                          ? 'border-green-500 bg-green-50 shadow-md'
                          : isRecommended 
                            ? 'border-orange-300 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => step4Form.setValue('selectedPlan', plan.name)}
                    >
                      {isRecommended && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-orange-500 text-white shadow-md">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Recomendado
                          </Badge>
                        </div>
                      )}
                      
                      {step4Form.watch('selectedPlan') === plan.name && (
                        <div className="absolute -top-3 right-4">
                          <Badge className="bg-green-500 text-white shadow-md">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Seleccionado
                          </Badge>
                        </div>
                      )}
                      
                      <div className="text-center">
                        <h4 className="font-semibold text-lg capitalize">{plan.displayName}</h4>
                        <div className={`text-2xl font-bold mt-2 ${
                          step4Form.watch('selectedPlan') === plan.name 
                            ? 'text-green-600' 
                            : 'text-oficaz-primary'
                        }`}>
                          €{plan.monthlyPrice}
                          <span className="text-sm font-normal text-gray-500">/mes</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Hasta {plan.maxUsers} usuarios
                        </p>
                      </div>
                      
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center text-xs">
                          <CheckCircle className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                          <span>Fichajes y control horario</span>
                        </div>
                        {plan.features?.vacation && (
                          <div className="flex items-center text-xs">
                            <CheckCircle className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                            <span>Gestión de vacaciones</span>
                          </div>
                        )}
                        {plan.features?.documents && (
                          <div className="flex items-center text-xs">
                            <CheckCircle className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                            <span>Gestión de documentos</span>
                          </div>
                        )}
                        {plan.features?.messages && (
                          <div className="flex items-center text-xs">
                            <CheckCircle className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                            <span>Mensajería interna</span>
                          </div>
                        )}
                        {plan.features?.reminders && (
                          <div className="flex items-center text-xs">
                            <CheckCircle className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                            <span>Recordatorios</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {step4Form.formState.errors.selectedPlan && (
                <p className="text-sm text-red-600 text-center">
                  {step4Form.formState.errors.selectedPlan.message}
                </p>
              )}

              {/* Free trial notice */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <div className="flex items-center mb-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <h4 className="font-medium text-green-900">14 días de prueba gratuitos</h4>
                </div>
                <p className="text-sm text-green-700">
                  Podrás usar Oficaz completamente gratis durante 14 días. No se cobrará nada hasta que termine tu período de prueba.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-medium text-blue-900 mb-2">¿Por qué esta recomendación?</h4>
                <p className="text-sm text-blue-700">
                  Basándose en que tu equipo tiene {formData.teamSize?.replace('-', ' a ')} empleados
                  {formData.interestedFeatures && formData.interestedFeatures.length > 0 && 
                    ` y estás interesado en ${formData.interestedFeatures.length} funcionalidades`
                  }, el plan {recommendedPlan} ofrece la mejor relación calidad-precio para tus necesidades.
                </p>
              </div>

              {/* Terms and Conditions checkbox */}
              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-xl">
                <Checkbox
                  id="acceptTerms"
                  checked={step4Form.watch('acceptTerms') || false}
                  onCheckedChange={(checked) => step4Form.setValue('acceptTerms', checked as boolean)}
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

              {step4Form.formState.errors.acceptTerms && (
                <p className="text-sm text-red-600 text-center">
                  {step4Form.formState.errors.acceptTerms.message}
                </p>
              )}

              <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                <Button type="submit" className="w-full sm:flex-1 rounded-xl px-8 order-1 sm:order-2" disabled={isLoading}>
                  {isLoading ? 'Creando empresa...' : 'Crear empresa'}
                  <CheckCircle className="h-4 w-4 ml-2" />
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => goToStep(3)} 
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
        onComplete={() => {
          setShowDemoLoading(false);
          // Redirect will happen naturally from handleStep4Submit
        }}
      />
    </div>
  );
}