import { useState, useEffect } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginData } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@/assets/oficaz-logo.png';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Extract company alias from URL
  const [match, params] = useRoute("/:companyAlias/login");
  const companyAlias = params?.companyAlias;

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      dniOrEmail: '',
      password: '',
    },
  });

  const { login } = useAuth();

  useEffect(() => {
    if (companyAlias) {
      // Fetch company information by alias
      const fetchCompanyInfo = async () => {
        try {
          const company = await apiRequest('GET', `/api/company/${companyAlias}`);
          setCompanyInfo(company);
        } catch (error) {
          console.error('Company not found:', error);
          setLocation('/register');
        } finally {
          setLoading(false);
        }
      };
      fetchCompanyInfo();
    } else {
      setLoading(false);
    }
  }, [companyAlias, setLocation]);

  const onSubmit = async (data: LoginData) => {
    try {
      const response = await login(data.dniOrEmail, data.password, companyAlias);
      // Use the company alias from the response, or fallback to the current URL alias
      const redirectAlias = (response as any)?.company?.companyAlias || companyAlias || 'test';
      setLocation(`/${redirectAlias}/dashboard`);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        background: `radial-gradient(circle at center, #323A46, #232B36)`,
      }}
    >
      <Card className="w-full max-w-md shadow-2xl rounded-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-12 w-auto"
            />
          </div>
          <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
          <CardDescription>
            Accede con tu DNI/NIE o email empresarial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="dniOrEmail">DNI/NIE o Email</Label>
              <Input
                id="dniOrEmail"
                className="rounded-xl"
                {...form.register('dniOrEmail')}
                placeholder="12345678Z, X1234567L o tu@empresa.com"
              />
              {form.formState.errors.dniOrEmail && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.dniOrEmail.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  className="rounded-xl"
                  type={showPassword ? 'text' : 'password'}
                  {...form.register('password')}
                  placeholder="Tu contraseña"
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
                <p className="text-sm text-red-600">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full rounded-xl">
              Iniciar sesión
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿No tienes una cuenta?{' '}
              <Link href="/register">
                <a className="font-medium text-oficaz-primary hover:text-blue-500">
                  Registrar empresa
                </a>
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}