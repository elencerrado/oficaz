import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Crown, Building2, Users, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface QuickUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  company?: string;
  companyAlias?: string;
  icon: React.ReactNode;
  color: string;
}

const quickUsers: QuickUser[] = [
  {
    id: "super-admin",
    name: "Super Admin",
    email: "admin@oficaz.com",
    password: "admin123",
    role: "Super Administrador",
    icon: <Crown className="w-5 h-5" />,
    color: "bg-gradient-to-r from-purple-500 to-pink-500"
  },
  {
    id: "admin-test",
    name: "Admin Test Company",
    email: "admin@test.com",
    password: "123456",
    role: "Administrador",
    company: "Test Company",
    companyAlias: "test",
    icon: <Building2 className="w-5 h-5" />,
    color: "bg-gradient-to-r from-blue-500 to-cyan-500"
  },
  {
    id: "marta-perez",
    name: "Marta Pérez García",
    email: "marta.perez@test.com",
    password: "123456",
    role: "Empleado",
    company: "Test Company",
    companyAlias: "test",
    icon: <UserCheck className="w-5 h-5" />,
    color: "bg-gradient-to-r from-emerald-500 to-teal-500"
  },
  {
    id: "juan-ramirez",
    name: "Juan José Ramírez Martín",
    email: "juanramirez2@gmail.com",
    password: "123456",
    role: "Empleado",
    company: "Test Company",
    companyAlias: "test",
    icon: <Users className="w-5 h-5" />,
    color: "bg-gradient-to-r from-orange-500 to-red-500"
  }
];

export default function QuickAccess() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [isLogging, setIsLogging] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleQuickLogin = async () => {
    if (!selectedUser) {
      toast({
        title: "Selecciona un usuario",
        description: "Por favor selecciona un usuario para continuar.",
        variant: "destructive",
      });
      return;
    }

    const user = quickUsers.find(u => u.id === selectedUser);
    if (!user) return;

    setIsLogging(true);

    try {
      if (user.id === "super-admin") {
        // Redirect to super admin security page
        setLocation("/super-admin");
      } else {
        // Regular user login - simulate the normal login flow
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dniOrEmail: user.email,
            password: user.password,
            companyAlias: user.companyAlias
          }),
        });

        if (response.ok) {
          const result = await response.json();
          
          // Store auth data like the normal login does
          localStorage.setItem('authData', JSON.stringify({
            token: result.token,
            user: result.user,
            company: result.company
          }));
          
          // Force a page reload to reinitialize auth state
          if (user.role === "Empleado") {
            window.location.href = `/${user.companyAlias}`;
          } else {
            window.location.href = `/${user.companyAlias}/inicio`;
          }
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Login failed');
        }
      }

      toast({
        title: "Acceso exitoso",
        description: `Has iniciado sesión como ${user.name}`,
      });

    } catch (error) {
      console.error('Quick login error:', error);
      toast({
        title: "Error de acceso",
        description: "No se pudo iniciar sesión. Verifica las credenciales.",
        variant: "destructive",
      });
    } finally {
      setIsLogging(false);
    }
  };

  const selectedUserData = quickUsers.find(u => u.id === selectedUser);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" 
         style={{
           background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)'
         }}>
      
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-lg bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Crown className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-light text-white">
            Acceso Rápido - Testing
          </CardTitle>
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
            Solo para desarrollo
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <label className="text-white/90 font-medium text-sm">
              Seleccionar Usuario
            </label>
            
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Elige un usuario para acceder..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                {quickUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id} className="text-white hover:bg-white/10">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${user.color} rounded-lg flex items-center justify-center text-white text-xs`}>
                        {user.icon}
                      </div>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-gray-400">
                          {user.role} {user.company ? `• ${user.company}` : ''}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedUserData && (
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 ${selectedUserData.color} rounded-lg flex items-center justify-center text-white`}>
                    {selectedUserData.icon}
                  </div>
                  <div>
                    <div className="font-medium text-white">{selectedUserData.name}</div>
                    <div className="text-sm text-white/60">{selectedUserData.role}</div>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Email:</span>
                    <span className="text-white/90 font-mono text-xs">{selectedUserData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Password:</span>
                    <span className="text-white/90 font-mono text-xs">{selectedUserData.password}</span>
                  </div>
                  {selectedUserData.company && (
                    <div className="flex justify-between">
                      <span className="text-white/60">Empresa:</span>
                      <span className="text-white/90">{selectedUserData.company}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleQuickLogin}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl"
            disabled={isLogging || !selectedUser}
          >
            {isLogging ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="xs" />
                Iniciando sesión...
              </div>
            ) : (
              "Acceder como Usuario Seleccionado"
            )}
          </Button>

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              Volver al login normal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
        <p className="text-white/40 text-xs text-center">
          ⚠️ Panel de acceso rápido solo para testing - No usar en producción
        </p>
      </div>
    </div>
  );
}