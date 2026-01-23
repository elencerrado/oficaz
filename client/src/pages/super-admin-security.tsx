import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, Shield, Key, Mail, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface SecurityStep {
  step: "access-password" | "login" | "verified";
}

export default function SuperAdminSecurity() {
  const [currentStep, setCurrentStep] = useState<SecurityStep>({ step: "access-password" });
  const [accessPassword, setAccessPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Refs for uncontrolled inputs (better Chrome autofill support)
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Check if already logged in on mount
  useEffect(() => {
    const token = sessionStorage.getItem('superAdminToken');
    if (token) {
      setLocation('/super-admin/dashboard');
    }
  }, [setLocation]);

  const handleAccessPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/super-admin/verify-access-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Contraseña de acceso incorrecta");
      }

      setCurrentStep({ step: "login" });
      setAccessPassword(""); // Clear password for security
    } catch (error: any) {
      setError(error.message || "Contraseña de acceso incorrecta. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Read values from uncontrolled inputs
    const email = emailRef.current?.value || "";
    const password = passwordRef.current?.value || "";
    const totpCode = (document.getElementById('totpCode') as HTMLInputElement)?.value || "";
    
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/super-admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, totpCode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresTOTP) {
          // Show TOTP input field
          setCurrentStep({ step: "totp_required" });
          setError("Se requiere verificación 2FA. Introduce el código de tu autenticador.");
          return;
        }
        throw new Error(errorData.message || "Email o contraseña incorrectos");
      }

      const data = await response.json();
      
      // 🔒 SECURITY: Store super admin token in sessionStorage (expires when browser closes)
      // This is acceptable for super-admin because:
      // 1. Session expires when browser closes (not persistent like localStorage)
      // 2. Super admin access requires email verification code each time
      // 3. Token is short-lived and not exposed to XSS if properly sanitized
      sessionStorage.setItem("superAdminToken", data.token);
      
      setCurrentStep({ step: "verified" });
      
      toast({
        title: "Acceso autorizado",
        description: "Redirigiendo al panel de superadmin...",
      });

      // Redirect to super admin dashboard
      setTimeout(() => {
        setLocation("/super-admin/dashboard");
      }, 1500);

    } catch (error: any) {
      setError(error.message || "Email o contraseña incorrectos. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  if (currentStep.step === "verified") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-emerald-400" />
            </div>
            <CardTitle className="text-2xl text-white">Acceso Autorizado</CardTitle>
            <CardDescription className="text-white/60">
              Verificación completada. Redirigiendo al panel de administración...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-purple-400" />
          </div>
          <CardTitle className="text-2xl text-white">Acceso Superadmin</CardTitle>
          <CardDescription className="text-white/60">
            {currentStep.step === "access-password" 
              ? "Verificación de seguridad" 
              : "Iniciar sesión"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Access Password Form - First layer */}
          <form 
            onSubmit={handleAccessPasswordSubmit} 
            className={`space-y-4 ${currentStep.step !== "access-password" ? "hidden" : ""}`}
            autoComplete="off"
          >
            <div className="space-y-2">
              <Label htmlFor="accessPassword" className="flex items-center gap-2 text-white">
                <Key className="h-4 w-4" />
                Contraseña de acceso
              </Label>
              <Input
                id="accessPassword"
                type="password"
                value={accessPassword}
                onChange={(e) => setAccessPassword(e.target.value)}
                placeholder="Introduce la contraseña de acceso"
                required
                autoComplete="off"
                className="text-center font-mono bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/60 text-center">
                Primera capa de seguridad
              </p>
            </div>

            {error && currentStep.step === "access-password" && (
              <Alert className="bg-red-500/20 border-red-500/30 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? "Verificando..." : "Continuar"}
            </Button>
          </form>

          {/* Login Form - Second layer (always in DOM for Chrome autofill) */}
          <form 
            onSubmit={handleLoginSubmit} 
            className={`space-y-4 ${currentStep.step !== "login" ? "hidden" : ""}`}
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-white">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                required
                autoComplete="username"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2 text-white">
                <Lock className="h-4 w-4" />
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 🔒 2FA TOTP Code Input - Conditional */}
            {(currentStep.step === "totp_required" || currentStep.step === "login") && (
              <div className="space-y-2">
                <Label htmlFor="totpCode" className="flex items-center gap-2 text-white">
                  <Shield className="h-4 w-4" />
                  Código de Verificación (Google Authenticator/Authy)
                </Label>
                <Input
                  id="totpCode"
                  name="totpCode"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  pattern="\d{6}"
                  inputMode="numeric"
                  autoComplete="off"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono text-center tracking-widest"
                />
                <p className="text-xs text-white/60 text-center">
                  {currentStep.step === "totp_required" 
                    ? "Código requerido para completar la autenticación"
                    : "Verifica tu autenticador para obtener el código de 6 dígitos"}
                </p>
              </div>
            )}

            {error && currentStep.step === "login" && (
              <Alert className="bg-red-500/20 border-red-500/30 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Button 
                type="submit" 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={() => {
                  setCurrentStep({ step: "access-password" });
                  if (emailRef.current) emailRef.current.value = "";
                  if (passwordRef.current) passwordRef.current.value = "";
                  setError("");
                }}
                disabled={isLoading}
              >
                Volver
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-300 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-200">
                <p className="font-medium">Acceso restringido</p>
                <p>Solo personal autorizado de Oficaz puede acceder a este panel.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
