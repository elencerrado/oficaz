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
  step: "email" | "code" | "verified";
  token?: string;
}

export default function SuperAdminSecurity() {
  const [currentStep, setCurrentStep] = useState<SecurityStep>({ step: "email" });
  const [email, setEmail] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email is exactly soy@oficaz.es
    if (email !== "soy@oficaz.es") {
      setError("Acceso denegado. Email no autorizado.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/super-admin/request-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Error al enviar código de seguridad");
      }

      const data = await response.json();
      
      setCurrentStep({ step: "code", token: data.token });
      toast({
        title: "Código enviado",
        description: "Se ha enviado un código de seguridad a soy@oficaz.es",
      });
    } catch (error) {
      setError("Error al enviar el código de seguridad. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!securityCode || securityCode.length !== 6) {
      setError("El código debe tener 6 dígitos");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/super-admin/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email: email,
          code: securityCode
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
      setError("Código de seguridad inválido. Inténtalo de nuevo.");
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
          {currentStep.step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email autorizado
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="soy@oficaz.es"
                  required
                  className="text-center"
                />
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
                {isLoading ? "Enviando..." : "Solicitar código de seguridad"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleCodeVerification} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Código de seguridad
                </Label>
                <Input
                  id="code"
                  type="text"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                  disabled={isLoading || securityCode.length !== 6}
                >
                  {isLoading ? "Verificando..." : "Verificar código"}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setCurrentStep({ step: "email" })}
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