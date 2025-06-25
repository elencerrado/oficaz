import { useState, useEffect } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Eye, EyeOff, User, Lock, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@/assets/oficaz-logo.png';

// Secure login schema
const loginSchema = z.object({
  dniOrEmail: z.string().min(1, 'DNI/Email requerido').trim(),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginData = z.infer<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [, setLocation] = useLocation();
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Extract company alias from URL
  const [match, params] = useRoute('/:companyAlias/login');
  const companyAlias = params?.companyAlias;

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { dniOrEmail: '', password: '' },
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

    // Load remembered credentials
    const remembered = localStorage.getItem('rememberedCredentials');
    if (remembered) {
      try {
        const { dniOrEmail, companyAlias: savedCompanyAlias } = JSON.parse(remembered);
        if (!companyAlias || companyAlias === savedCompanyAlias) {
          form.setValue('dniOrEmail', dniOrEmail);
          setRememberMe(true);
        }
      } catch (error) {
        console.error('Error loading remembered credentials:', error);
      }
    }
  }, [companyAlias, setLocation, form]);

  const handleSubmit = async (data: LoginData) => {
    setSubmitting(true);
    setLoginError(null);
    
    try {
      // Normalize input
      const normalizedData = {
        ...data,
        dniOrEmail: data.dniOrEmail.includes('@') 
          ? data.dniOrEmail.toLowerCase().trim()
          : data.dniOrEmail.toUpperCase().trim()
      };
      
      const response = await login(normalizedData.dniOrEmail, data.password, companyAlias);
      
      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('rememberedCredentials', JSON.stringify({
          dniOrEmail: normalizedData.dniOrEmail,
          companyAlias: companyAlias || (response as any)?.company?.companyAlias
        }));
      } else {
        localStorage.removeItem('rememberedCredentials');
      }
      
      // Redirect
      const redirectAlias = companyAlias || (response as any)?.company?.companyAlias || 'test';
      setLocation(`/${redirectAlias}/inicio`);
      
    } catch (error: any) {
      console.error('Login failed:', error);
      
      if (error.message?.includes('429')) {
        setLoginError('Demasiados intentos. Espera unos minutos antes de intentar de nuevo.');
      } else if (error.message?.includes('desactivada')) {
        setLoginError('Tu cuenta está desactivada. Contacta con tu administrador.');
      } else {
        setLoginError('Usuario o contraseña incorrectos.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-md shadow-2xl rounded-2xl border-0 bg-white">
        <CardHeader className="text-center pt-8 pb-6">
          <div className="flex justify-center mb-6">
            {companyInfo?.logoUrl ? (
              <img 
                src={companyInfo.logoUrl} 
                alt={companyInfo.name}
                className="h-10 w-auto max-w-32 object-contain"
              />
            ) : (
              <img 
                src={oficazLogo} 
                alt="Oficaz" 
                className="h-10 w-auto"
              />
            )}
          </div>
          {companyInfo && (
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {companyInfo.name}
            </h1>
          )}
          <p className="text-gray-600 text-sm">
            Accede a tu cuenta
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Error Message */}
            {loginError && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            {/* Email/DNI Field */}
            <div className="relative">
              <Input
                {...form.register('dniOrEmail')}
                placeholder="DNI/NIE o email"
                className="rounded-xl border-gray-300 py-3 px-4 pr-12 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                onChange={(e) => {
                  form.setValue('dniOrEmail', e.target.value);
                  setLoginError(null);
                }}
              />
              <User className="absolute right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              {form.formState.errors.dniOrEmail && (
                <p className="text-xs text-red-500 mt-1">
                  {form.formState.errors.dniOrEmail.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                {...form.register('password')}
                placeholder="Contraseña"
                className="rounded-xl border-gray-300 py-3 px-4 pr-16 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                onChange={(e) => {
                  form.setValue('password', e.target.value);
                  setLoginError(null);
                }}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
                <Lock className="h-4 w-4 text-gray-400" />
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-red-500 mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="rounded border-gray-300"
              />
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                Recordarme
              </label>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full rounded-xl py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={submitting}
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Iniciando sesión...
                </div>
              ) : (
                'Iniciar sesión'
              )}
            </Button>

            {/* Register Link */}
            <div className="text-center mt-6">
              <Link href="/register" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                Registra tu empresa
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}