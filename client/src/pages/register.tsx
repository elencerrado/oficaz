import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { companyRegistrationSchema, type CompanyRegistrationData } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Building, User, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import oficazLogo from '@/assets/oficaz-logo.png';

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<CompanyRegistrationData>({
    resolver: zodResolver(companyRegistrationSchema),
    defaultValues: {
      companyName: '',
      cif: '',
      companyEmail: '',
      contactName: '',
      companyAlias: '',
      phone: '',
      address: '',

      adminFullName: '',
      adminDni: '',
      adminPhoneNumber: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/auth/register-company', data);
      
      // Store auth data and redirect to dashboard
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('auth_user', JSON.stringify(response.user));
      localStorage.setItem('auth_company', JSON.stringify(response.company));
      
      toast({
        title: "¡Registro exitoso!",
        description: "Tu empresa y cuenta de administrador han sido creadas correctamente.",
      });
      
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Error en el registro",
        description: error.message || "Ha ocurrido un error durante el registro",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        background: `radial-gradient(circle at center, #323A46, #232B36)`,
      }}
    >
      <Card className="w-full max-w-2xl shadow-2xl rounded-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-12 w-auto"
            />
          </div>
          <CardTitle className="text-2xl">Registrar nueva empresa</CardTitle>
          <CardDescription>
            Crea tu cuenta empresarial y comienza a gestionar tu equipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Company Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Building className="h-5 w-5 text-oficaz-primary" />
                <h3 className="text-lg font-semibold">Información de la empresa</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre de la empresa *</Label>
                  <Input
                    id="companyName"
                    className="rounded-xl"
                    {...form.register('companyName')}
                    placeholder="Ej: Mi Empresa S.L."
                  />
                  {form.formState.errors.companyName && (
                    <p className="text-sm text-red-600">{form.formState.errors.companyName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cif">CIF *</Label>
                  <Input
                    id="cif"
                    className="rounded-xl"
                    {...form.register('cif')}
                    placeholder="Ej: B12345678"
                  />
                  {form.formState.errors.cif && (
                    <p className="text-sm text-red-600">{form.formState.errors.cif.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email empresarial *</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    className="rounded-xl"
                    {...form.register('companyEmail')}
                    placeholder="info@miempresa.com"
                  />
                  {form.formState.errors.companyEmail && (
                    <p className="text-sm text-red-600">{form.formState.errors.companyEmail.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyAlias">Alias de empresa *</Label>
                  <Input
                    id="companyAlias"
                    className="rounded-xl"
                    {...form.register('companyAlias')}
                    placeholder="miempresa"
                  />
                  <p className="text-xs text-gray-500">Se usará para crear tu URL personalizada: oficaz.com/miempresa</p>
                  {form.formState.errors.companyAlias && (
                    <p className="text-sm text-red-600">{form.formState.errors.companyAlias.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactName">Persona de contacto *</Label>
                  <Input
                    id="contactName"
                    className="rounded-xl"
                    {...form.register('contactName')}
                    placeholder="Juan Pérez"
                  />
                  {form.formState.errors.contactName && (
                    <p className="text-sm text-red-600">{form.formState.errors.contactName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    className="rounded-xl"
                    {...form.register('phone')}
                    placeholder="+34 600 123 456"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  className="rounded-xl"
                  {...form.register('address')}
                  placeholder="Calle Mayor 123, 28001 Madrid"
                />
              </div>
            </div>

            <Separator />

            {/* Admin User Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-oficaz-primary" />
                <h3 className="text-lg font-semibold">Cuenta de administrador</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminFullName">Nombre completo *</Label>
                  <Input
                    id="adminFullName"
                    className="rounded-xl"
                    {...form.register('adminFullName')}
                    placeholder="Juan Pérez García"
                  />
                  {form.formState.errors.adminFullName && (
                    <p className="text-sm text-red-600">{form.formState.errors.adminFullName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminDni">DNI/NIE *</Label>
                  <Input
                    id="adminDni"
                    className="rounded-xl"
                    {...form.register('adminDni')}
                    placeholder="12345678A, X1234567L"
                  />
                  {form.formState.errors.adminDni && (
                    <p className="text-sm text-red-600">{form.formState.errors.adminDni.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPhoneNumber">Teléfono personal</Label>
                  <Input
                    id="adminPhoneNumber"
                    className="rounded-xl"
                    {...form.register('adminPhoneNumber')}
                    placeholder="+34 600 123 456"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      className="rounded-xl"
                      type={showPassword ? 'text' : 'password'}
                      {...form.register('password')}
                      placeholder="Mínimo 6 caracteres"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent rounded-r-xl"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      className="rounded-xl"
                      type={showConfirmPassword ? 'text' : 'password'}
                      {...form.register('confirmPassword')}
                      placeholder="Repite la contraseña"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent rounded-r-xl"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full rounded-xl" disabled={isLoading}>
              {isLoading ? 'Creando cuenta...' : 'Crear empresa y cuenta'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/login">
                <a className="font-medium text-oficaz-primary hover:text-blue-500">
                  Iniciar sesión
                </a>
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}