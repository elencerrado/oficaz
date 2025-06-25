import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useSearch } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Building, User, Eye, EyeOff, Users, CheckCircle, ArrowRight, ArrowLeft, Calendar, FileText, MessageSquare, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@assets/oficaz logo_1750516757063.png';

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
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

type FormData = Step1Data & Step2Data & Step3Data;

export default function Register() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
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

  // Check for verification token
  const params = new URLSearchParams(search);
  const verificationToken = params.get('token');

  useEffect(() => {
    if (!verificationToken) {
      toast({
        title: 'Acceso denegado',
        description: 'Necesitas verificar tu email antes de registrarte.',
        variant: 'destructive',
      });
      setLocation('/request-code');
    }
  }, [verificationToken, toast, setLocation]);

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
      password: '',
      confirmPassword: '',
      sameAsAdmin: true,
      contactName: '',
      contactPhone: '',
      contactEmail: '',
    },
  });

  const progressPercentage = (currentStep / 3) * 100;

  const features = [
    { id: 'timeTracking', name: 'Fichajes', icon: Calendar, description: 'Control de horarios y asistencia' },
    { id: 'vacation', name: 'Vacaciones', icon: Calendar, description: 'Gestión de solicitudes de vacaciones' },
    { id: 'documents', name: 'Documentos', icon: FileText, description: 'Gestión documental' },
    { id: 'messages', name: 'Mensajes', icon: MessageSquare, description: 'Comunicación interna' },
  ];

  const teamSizes = [
    { value: '1-5', label: '1-5 empleados', description: 'Pequeño equipo' },
    { value: '6-15', label: '6-15 empleados', description: 'Equipo mediano' },
    { value: '16-50', label: '16-50 empleados', description: 'Empresa mediana' },
    { value: '51+', label: '51+ empleados', description: 'Gran empresa' },
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
      toast({
        title: "Error de validación",
        description: "Error al verificar los datos. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setValidatingStep2(false);
    }
  };

  const handleStep3Submit = async (data: Step3Data) => {
    try {
      setValidatingStep3(true);
      
      // Validate admin user fields for uniqueness
      const emailAvailable = await validateUserField('email', data.adminEmail);

      if (!emailAvailable) {
        step3Form.setError('adminEmail', { message: 'Este email ya está registrado' });
        return;
      }

      // All validations passed, proceed with registration
      setIsLoading(true);
      const finalData = { 
        ...formData, 
        ...data,
        verificationToken 
      };
      const response = await apiRequest('POST', '/api/auth/register', finalData);
      
      if (response.ok) {
        toast({
          title: 'Registro exitoso',
          description: 'Tu empresa ha sido creada correctamente',
        });
        setLocation('/dashboard');
      }
    } catch (error: any) {
      toast({
        title: 'Error en el registro',
        description: error.message || 'Ha ocurrido un error durante el registro',
        variant: 'destructive',
      });
    } finally {
      setValidatingStep3(false);
      setIsLoading(false);
    }
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        background: `radial-gradient(circle at center, #323A46, #232B36)`,
      }}
    >
      <Card className="w-full max-w-3xl shadow-2xl rounded-2xl">
        <CardHeader className="space-y-4">
          {/* Modern header with logo and title side by side */}
          <div className="flex items-center justify-between">
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-8 w-auto"
            />
            <div className="text-right flex-1 ml-6">
              <CardTitle className="text-xl font-semibold text-gray-900">Configurar tu empresa</CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-1">
                Proceso rápido en 3 pasos - Solo toma un minuto
              </CardDescription>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-gray-500">Paso {currentStep} de 3</span>
              <span className="text-xs font-medium text-gray-500">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Step indicators */}
          <div className="flex justify-center items-center space-x-6">
            <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                currentStep >= 1 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                {currentStep > 1 ? <CheckCircle className="h-3 w-3" /> : '1'}
              </div>
              <span className="text-xs font-medium hidden sm:block">Preferencias</span>
            </div>
            <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                currentStep >= 2 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                {currentStep > 2 ? <CheckCircle className="h-3 w-3" /> : '2'}
              </div>
              <span className="text-xs font-medium hidden sm:block">Empresa</span>
            </div>
            <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-oficaz-primary' : 'text-gray-400'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                currentStep >= 3 ? 'bg-oficaz-primary border-oficaz-primary text-white' : 'border-gray-300'
              }`}>
                3
              </div>
              <span className="text-xs font-medium hidden sm:block">Administrador</span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Step 1: Team preferences */}
          {currentStep === 1 && (
            <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-6">
              <div className="text-center mb-4">
                <Users className="h-8 w-8 text-oficaz-primary mx-auto mb-2" />
                <h3 className="text-base font-semibold mb-1">Cuéntanos sobre tu equipo</h3>
                <p className="text-xs text-gray-600">Esto nos ayudará a personalizar la experiencia</p>
              </div>

              {/* Team size selection */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">¿Cuántas personas van a usar la aplicación?</Label>
                <div className="grid grid-cols-2 gap-2">
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
                <Label className="text-xs font-medium">¿En qué funcionalidades estás más interesado?</Label>
                <p className="text-xs text-gray-500">Selecciona todas las que te interesen</p>
                <div className="grid grid-cols-2 gap-2">
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

              <div className="flex justify-end pt-4">
                <Button type="submit" className="rounded-xl px-8">
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* Step 2: Company information */}
          {currentStep === 2 && (
            <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-6">
              <div className="text-center mb-6">
                <Building className="h-12 w-12 text-oficaz-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">Datos de tu empresa</h3>
                <p className="text-sm text-gray-600">Información básica para configurar tu cuenta</p>
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
                  <Label htmlFor="companyEmail">Email de facturación *</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    className="rounded-xl"
                    {...step2Form.register('companyEmail')}
                    placeholder="facturacion@miempresa.com"
                  />
                  {step2Form.formState.errors.companyEmail && (
                    <p className="text-sm text-red-600">{step2Form.formState.errors.companyEmail.message}</p>
                  )}
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
                  {step2Form.formState.errors.province && (
                    <p className="text-sm text-red-600">{step2Form.formState.errors.province.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => goToStep(1)} className="rounded-xl px-8">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Atrás
                </Button>
                <Button 
                  type="submit" 
                  className="rounded-xl px-8"
                  disabled={validatingStep2}
                >
                  {validatingStep2 ? 'Verificando datos...' : 'Continuar'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Admin account */}
          {currentStep === 3 && (
            <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-6">
              <div className="text-center mb-6">
                <Shield className="h-12 w-12 text-oficaz-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">Cuenta de administrador</h3>
                <p className="text-sm text-gray-600">Crea tu cuenta personal de administrador</p>
              </div>

              {/* Admin basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="adminFullName">Nombre completo *</Label>
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
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => goToStep(2)} className="rounded-xl px-8">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Atrás
                </Button>
                <Button type="submit" className="rounded-xl px-8" disabled={isLoading || validatingStep3}>
                  {validatingStep3 ? 'Verificando datos...' : isLoading ? 'Creando cuenta...' : 'Crear empresa'}
                  <CheckCircle className="h-4 w-4 ml-2" />
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
    </div>
  );
}