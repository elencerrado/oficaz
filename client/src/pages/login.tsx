import { useState, useEffect } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginData } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@/assets/oficaz-logo.png';

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
    setSubmitting(true);
    setLoginError(null);
    
    try {
      // Normalize email/DNI case - lowercase for emails, uppercase last char for DNI/NIE
      const trimmed = data.dniOrEmail.trim();
      let normalizedDniOrEmail = trimmed;
      
      // If it contains @ it's an email, convert to lowercase
      if (trimmed.includes('@')) {
        normalizedDniOrEmail = trimmed.toLowerCase();
      } else {
        // For DNI/NIE, normalize: numbers lowercase, last letter uppercase
        normalizedDniOrEmail = trimmed.toLowerCase().replace(/([a-z])$/, (match) => match.toUpperCase());
      }
      
      const normalizedData = {
        ...data,
        dniOrEmail: normalizedDniOrEmail
      };
      
      const response = await login(normalizedData.dniOrEmail, data.password, companyAlias);
      // Always use the company alias from the URL if we're in a company-specific login
      const redirectAlias = companyAlias || (response as any)?.company?.companyAlias || 'test';
      setLocation(`/${redirectAlias}/inicio`);
    } catch (error: any) {
      console.error('Login failed:', error);
      // Show user-friendly message regardless of technical error
      setLoginError('Mmm... ese usuario o contraseña no nos suena.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-8 sm:px-16 lg:px-24"
      style={{
        background: `radial-gradient(circle at center, #323A46, #232B36)`,
      }}
    >
      <Card className="w-full max-w-sm shadow-2xl rounded-3xl border-0 bg-white">
        <CardHeader className="text-center pt-8 pb-6">
          <div className="flex justify-center mb-6">
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-10 w-auto"
            />
          </div>
          <p className="text-gray-600 text-sm font-medium">
            Inicia sesión para continuar
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Campo DNI/Email con icono */}
            <div className="relative">
              <Input
                {...form.register('dniOrEmail')}
                placeholder="Introduce tu DNI/NIE o email"
                className="rounded-xl border border-gray-300 py-3 px-4 pr-12 text-sm placeholder:text-gray-400 focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                onChange={(e) => {
                  form.setValue('dniOrEmail', e.target.value);
                  if (loginError) setLoginError(null);
                }}
              />
              <User className="absolute right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              {form.formState.errors.dniOrEmail && (
                <p className="text-xs text-red-500 mt-1">
                  {form.formState.errors.dniOrEmail.message}
                </p>
              )}
            </div>

            {/* Campo Contraseña con iconos */}
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                {...form.register('password')}
                placeholder="Introduce tu contraseña"
                className="rounded-xl border border-gray-300 py-3 px-4 pr-16 text-sm placeholder:text-gray-400 focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                onChange={(e) => {
                  form.setValue('password', e.target.value);
                  if (loginError) setLoginError(null);
                }}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <Lock className="h-4 w-4 text-gray-400" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-red-500 mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Error message */}
            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4">
                <p className="text-red-600 text-sm text-center">{loginError}</p>
              </div>
            )}

            {/* Botón ENTRAR */}
            <Button 
              type="submit" 
              disabled={submitting}
              className="w-full rounded-xl bg-[#007AFF] hover:bg-[#0056CC] text-white font-medium py-3 mt-6 text-sm disabled:opacity-100 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="sm" className="text-white" />
                </div>
              ) : (
                'ENTRAR'
              )}
            </Button>

            {/* Checkbox Recordarme */}
            <div className="flex items-center justify-center mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="rounded border-gray-300 data-[state=checked]:bg-[#007AFF] data-[state=checked]:border-[#007AFF]"
                />
                <label 
                  htmlFor="remember" 
                  className="text-sm text-gray-600 cursor-pointer"
                >
                  Recordarme
                </label>
              </div>
            </div>

            {/* Enlace de ayuda */}
            <div className="text-center mt-4">
              <Link href="/register">
                <a className="text-sm text-[#007AFF] hover:underline">
                  ¿Tienes problemas para acceder?
                </a>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}