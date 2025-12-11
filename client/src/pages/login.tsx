import { useState, useEffect } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Eye, EyeOff, User, Lock, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { apiRequest } from '@/lib/queryClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import oficazLogo from '@/assets/oficaz-logo.png';

// Secure login schema
const loginSchema = z.object({
  dniOrEmail: z.string().min(1, 'DNI/Email requerido').trim(),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginData = z.infer<typeof loginSchema>;

export default function Login() {
  usePageTitle('Iniciar Sesión');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [, setLocation] = useLocation();
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check for account cancellation message from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    if (message === 'account_cancelled') {
      setLoginError('Tu cuenta ha sido cancelada y el acceso está suspendido. Para recuperar tu cuenta, solicita un código de verificación con tu email.');
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // CRITICAL: Clean up corrupted tokens and ensure proper login state
  useEffect(() => {
    // SECURITY FIX: Ensure clean login state - reset dark mode if coming from logout
    document.documentElement.classList.remove('dark');
    // Add dark notch class for pages with dark background and prevent scroll
    document.documentElement.classList.add('dark-notch');
    document.body.style.overflow = 'hidden';
    
    return () => {
      // Cleanup dark notch class when leaving the page
      document.documentElement.classList.remove('dark-notch');
      document.body.style.overflow = '';
    };
    
    const cleanupCorruptedTokens = () => {
      const authData = localStorage.getItem('authData');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          // Check if token belongs to non-existent user ID 4
          if (parsed.user?.id === 4 || (parsed.token && parsed.token.includes('.'))) {
            const payload = JSON.parse(atob(parsed.token.split('.')[1]));
            if (payload.userId === 4) {
              console.log('🧹 Removing corrupted token for user ID 4');
              localStorage.clear();
              sessionStorage.clear();
              return;
            }
          }
        } catch (error) {
          // If we can't parse it, it's corrupted - clear it
          console.log('🧹 Removing unparseable auth data');
          localStorage.clear();
          sessionStorage.clear();
        }
      }
      
      // Also check individual storage items that might be corrupted
      const keys = ['authData', 'superAdminToken', 'token', 'user', 'company'];
      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item && item.includes('4')) { // Quick check for user ID 4
          try {
            const parsed = JSON.parse(item);
            if (parsed.id === 4 || parsed.userId === 4) {
              console.log(`🧹 Removing corrupted ${key} for user ID 4`);
              localStorage.removeItem(key);
            }
          } catch (error) {
            // If we can't parse, it might be corrupted
            console.log(`🧹 Removing unparseable ${key}`);
            localStorage.removeItem(key);
          }
        }
      });
    };
    cleanupCorruptedTokens();
  }, []);
  
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
      
      console.log('🔐 Frontend login starting...');
      const response = await login(normalizedData.dniOrEmail, data.password, companyAlias, rememberMe);
      console.log('🔐 Frontend login completed successfully:', { hasResponse: !!response, rememberMe });
      
      // Debug: Check localStorage immediately after login
      setTimeout(() => {
        const authDataCheck = localStorage.getItem('authData');
        console.log('🔍 Debug - localStorage after login:', { 
          hasAuthData: !!authDataCheck, 
          dataLength: authDataCheck?.length,
          preview: authDataCheck?.substring(0, 100) + '...'
        });
      }, 500);
      
      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('rememberedCredentials', JSON.stringify({
          dniOrEmail: normalizedData.dniOrEmail,
          companyAlias: companyAlias || (response as any)?.company?.companyAlias
        }));
      } else {
        localStorage.removeItem('rememberedCredentials');
      }
      
      // Wait for auth state to update before redirect
      console.log('🔐 Login successful, waiting for auth state update...');
      
      // Wait a bit for the auth state to be fully updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect
      const redirectAlias = companyAlias || (response as any)?.company?.companyAlias || 'test';
      console.log('🔐 Redirecting to:', `/${redirectAlias}/inicio`);
      setLocation(`/${redirectAlias}/inicio`);
      
    } catch (error: any) {
      console.error('Login failed:', error);
      
      if (error.message === 'ACCOUNT_CANCELLED') {
        setLoginError('Tu cuenta ha sido cancelada y el acceso está suspendido. Para recuperar tu cuenta, solicita un código de verificación con tu email.');
      } else if (error.message?.includes('429')) {
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
    <div className="h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
      <Card className="w-full max-w-sm shadow-2xl rounded-2xl border-0 bg-white">
        <CardHeader className="text-center pt-6 pb-4">
          <div className="flex justify-center mb-4">
            {companyInfo?.logoUrl ? (
              <img 
                src={companyInfo.logoUrl} 
                alt={companyInfo.name}
                className="h-10 w-auto max-w-32 object-contain"
              />
            ) : (
              <Link href="/">
                <img 
                  src={oficazLogo} 
                  alt="Oficaz" 
                  className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity"
                />
              </Link>
            )}
          </div>
          {companyInfo ? (
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {companyInfo.name}
            </h1>
          ) : (
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Iniciar sesión
            </h1>
          )}
          <p className="text-gray-600 text-sm">
            Accede a tu cuenta
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-6">
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
                className="rounded-xl border border-gray-300 py-3 px-4 pr-12 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                className="rounded-xl border border-gray-300 py-3 px-4 pr-16 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                  <LoadingSpinner size="xs" />
                  Iniciando sesión...
                </div>
              ) : (
                'Iniciar sesión'
              )}
            </Button>



            {/* Password Recovery Link */}
            <div className="text-center mt-4">
              <Link 
                href={companyAlias ? `/${companyAlias}/forgot-password` : '/forgot-password'}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

          </form>

          {/* Register Link - moved outside form */}
          <div className="text-center mt-6">
            <Link href="/register" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
              Registra tu empresa
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}