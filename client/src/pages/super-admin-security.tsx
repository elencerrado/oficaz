import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, Shield, Mail, Key } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface SecurityStep {
  step: "access-code" | "verification-code" | "verified";
  token?: string;
}

export default function SuperAdminSecurity() {
  const [currentStep, setCurrentStep] = useState<SecurityStep>({ step: "access-code" });
  const [accessCode, setAccessCode] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleAccessCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/super-admin/verify-access-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessCode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Código de acceso incorrecto");
      }

      const data = await response.json();
      
      setCurrentStep({ step: "verification-code", token: data.token });
      toast({
        title: "Código enviado",
        description: "Se ha enviado un código de verificación a soy@oficaz.es",
      });
    } catch (error: any) {
      setError(error.message || "Código de acceso incorrecto. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode || verificationCode.length !== 6) {
      setError("El código debe tener 6 dígitos");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/super-admin/verify-verification-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          token: currentStep.token,
          code: verificationCode
        }),
      });

      if (!response.ok) {
        throw new Error("Código inválido");
      }

      const data = await response.json();
      
      // Store super admin token
      localStorage.setItem("superAdminToken", data.token);
      
      setCurrentStep({ step: "verified" });
      
      toast({
        title: "Acceso autorizado",
        description: "Redirigiendo al panel de superadmin...",
      });

      // Redirect to super admin dashboard
      setTimeout(() => {
        setLocation("/super-admin/dashboard");
      }, 1500);

    } catch (error) {
      setError("Código de verificación inválido. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  if (currentStep.step === "verified") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-600">Acceso Autorizado</CardTitle>
            <CardDescription>
              Verificación completada. Redirigiendo al panel de administración...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-gray-900">Acceso Superadmin</CardTitle>
          <CardDescription>
            Sistema de verificación de máxima seguridad
          </CardDescription>
        </CardHeader>

        <CardContent>
          {currentStep.step === "access-code" ? (
            <form onSubmit={handleAccessCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessCode" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Código de acceso seguro
                </Label>
                <Input
                  id="accessCode"
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Introduce el código de acceso"
                  required
                  className="text-center font-mono"
                />
                <p className="text-xs text-gray-500 text-center">
                  Código seguro con letras, números y caracteres especiales
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={isLoading}
              >
                {isLoading ? "Verificando..." : "Solicitar código de verificación"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerificationCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Código de verificación
                </Label>
                <Input
                  id="code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                />
                <p className="text-sm text-gray-500 text-center">
                  Revisa tu email: soy@oficaz.es
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full bg-red-600 hover:bg-red-700"
                  disabled={isLoading || verificationCode.length !== 6}
                >
                  {isLoading ? "Verificando..." : "Verificar código"}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setCurrentStep({ step: "access-code" })}
                  disabled={isLoading}
                >
                  Volver
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 p-4 bg-red-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
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