import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import imagotipo from "@assets/Imagotipo Oficaz_1750321812493.png";
import Register from "./register";

interface InvitationData {
  email: string;
  token: string;
  used: boolean;
  expiresAt: string;
  isValid: boolean;
}

export default function InvitationRegister() {
  const [, params] = useRoute("/registro/invitacion/:token");
  const [, setLocation] = useLocation();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const validateInvitation = async () => {
      if (!params?.token) {
        setError("Token de invitación inválido");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/validate-invitation/${params.token}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.message || "Invitación no válida");
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setInvitation(data);
        setIsLoading(false);

      } catch (err) {
        console.error("Error validating invitation:", err);
        setError("Error al validar la invitación");
        setIsLoading(false);
      }
    };

    validateInvitation();
  }, [params?.token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Validando invitación...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation || !invitation.isValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img 
              src={imagotipo} 
              alt="Oficaz" 
              className="h-8 w-auto mx-auto mb-4"
            />
            <CardTitle className="text-red-600 flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Invitación No Válida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                {error || "Esta invitación ha expirado, ya fue utilizada o no es válida."}
              </AlertDescription>
            </Alert>
            
            <div className="mt-6 space-y-3">
              <Button 
                onClick={() => setLocation("/")} 
                className="w-full"
                variant="outline"
              >
                Volver al Inicio
              </Button>
              <Button 
                onClick={() => setLocation("/request-code")} 
                className="w-full"
              >
                Solicitar Nueva Invitación
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitation.used) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img 
              src={imagotipo} 
              alt="Oficaz" 
              className="h-8 w-auto mx-auto mb-4"
            />
            <CardTitle className="text-green-600 flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Invitación Ya Utilizada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                Esta invitación ya fue utilizada para crear una cuenta. Si ya tienes acceso, puedes iniciar sesión directamente.
              </AlertDescription>
            </Alert>
            
            <div className="mt-6 space-y-3">
              <Button 
                onClick={() => setLocation("/login")} 
                className="w-full"
              >
                Iniciar Sesión
              </Button>
              <Button 
                onClick={() => setLocation("/")} 
                className="w-full"
                variant="outline"
              >
                Volver al Inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si la invitación es válida, mostrar mensaje de bienvenida y luego el registro
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="container mx-auto p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header de bienvenida */}
          <Card className="mb-6">
            <CardHeader className="text-center">
              <img 
                src={imagotipo} 
                alt="Oficaz" 
                className="h-10 w-auto mx-auto mb-4"
              />
              <CardTitle className="text-green-600 flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" />
                ¡Bienvenido a Oficaz!
              </CardTitle>
              <CardDescription>
                Invitación válida para <strong>{invitation.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Clock className="w-4 h-4" />
                <AlertDescription>
                  Tu invitación es válida y te permite registrar tu empresa directamente. 
                  Completa el formulario siguiente para comenzar.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Componente de registro con email pre-validado */}
          <Register 
            byInvitation={true}
            invitationEmail={invitation.email}
            invitationToken={invitation.token}
          />
        </div>
      </div>
    </div>
  );
}