import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft, User, Mail, Phone, Edit3, Save, X } from 'lucide-react';
import { useLocation, Link } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function EmployeeProfile() {
  const { user, company, companyAlias } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  
  // Editable fields by employee
  const [personalEmail, setPersonalEmail] = useState(user?.personalEmail || '');
  const [personalPhone, setPersonalPhone] = useState(user?.personalPhone || '');
  const [postalAddress, setPostalAddress] = useState(user?.postalAddress || '');
  const [emergencyContactName, setEmergencyContactName] = useState(user?.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(user?.emergencyContactPhone || '');
  
  // Get company alias from current URL
  const urlParts = window.location.pathname.split('/').filter((part: string) => part.length > 0);
  const currentCompanyAlias = urlParts[0] || companyAlias || 'test';

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Error al actualizar perfil');
      return response.json();
    },
    onSuccess: () => {
      setIsEditing(false);
      toast({
        title: 'Perfil actualizado',
        description: 'Tus datos personales han sido actualizados correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el perfil',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateProfileMutation.mutate({
      personalEmail,
      personalPhone,
      postalAddress,
      emergencyContactName,
      emergencyContactPhone,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original values
    setPersonalEmail(user?.personalEmail || '');
    setPersonalPhone(user?.personalPhone || '');
    setPostalAddress(user?.postalAddress || '');
    setEmergencyContactName(user?.emergencyContactName || '');
    setEmergencyContactPhone(user?.emergencyContactPhone || '');
  };

  return (
    <div className="min-h-screen bg-employee-gradient text-white">
      {/* Header - Exactly like other employee pages but without user name */}
      <div className="flex items-center justify-between p-6 pb-8 h-20">
        <Link href={`/${currentCompanyAlias}/inicio`}>
          <Button
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/20 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm transition-all duration-200 transform hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex-1 flex flex-col items-end text-right">
          <div className="text-white text-sm font-medium">
            {company?.name || 'Test Company'}
          </div>
        </div>
      </div>
      {/* Page Title */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Mi Perfil</h1>
        <p className="text-white/70 text-sm">
          Gestiona tu información personal y de contacto
        </p>
      </div>
      <div className="px-6 space-y-6">
        {/* Ficha de Usuario - Avatar, Nombre, Cargo */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <div className="flex items-center space-x-6 mb-6">
            {/* Avatar moderno con gradiente */}
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-600 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                <User className="h-10 w-10 text-white drop-shadow-lg" />
              </div>
              {/* Indicador de estado online */}
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
            </div>
            
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">{user?.fullName}</h2>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <p className="text-blue-200 font-medium">{user?.position || 'Empleado'}</p>
              </div>
            </div>
          </div>
          
          {/* Información básica en ficha - Diseño compacto */}
          <div className="space-y-2">
            {/* DNI - siempre mostrar */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">DNI</span>
              <span className="text-white text-sm">{user?.dni}</span>
            </div>
            
            {/* Teléfono - solo si tiene datos */}
            {user?.companyPhone && (
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">Teléfono</span>
                <span className="text-white text-sm">{user.companyPhone}</span>
              </div>
            )}
            
            {/* Email - solo si tiene datos */}
            {user?.companyEmail && (
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">Email</span>
                <span className="text-white text-sm truncate max-w-48">{user.companyEmail}</span>
              </div>
            )}
          </div>
        </div>

        {/* Datos Editables */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-white">Datos Personales Editables</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-300">Email Personal</label>
              {isEditing ? (
                <Input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="tu-email@ejemplo.com"
                  className="mt-1 bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:border-white focus:ring-white"
                />
              ) : (
                <div className="mt-1 bg-white/5 rounded-lg p-3 text-white">
                  {personalEmail || 'No especificado'}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-300">Teléfono Personal</label>
              {isEditing ? (
                <Input
                  type="tel"
                  value={personalPhone}
                  onChange={(e) => setPersonalPhone(e.target.value)}
                  placeholder="+34 666 777 888"
                  className="mt-1 bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:border-white focus:ring-white"
                />
              ) : (
                <div className="mt-1 bg-white/5 rounded-lg p-3 text-white">
                  {personalPhone || 'No especificado'}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-300">Dirección Postal</label>
              {isEditing ? (
                <Input
                  value={postalAddress}
                  onChange={(e) => setPostalAddress(e.target.value)}
                  placeholder="Calle, número, ciudad, código postal"
                  className="mt-1 bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:border-white focus:ring-white"
                />
              ) : (
                <div className="mt-1 bg-white/5 rounded-lg p-3 text-white">
                  {postalAddress || 'No especificado'}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-300">Contacto de Emergencia</label>
              {isEditing ? (
                <Input
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="Nombre del contacto de emergencia"
                  className="mt-1 bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:border-white focus:ring-white"
                />
              ) : (
                <div className="mt-1 bg-white/5 rounded-lg p-3 text-white">
                  {emergencyContactName || 'No especificado'}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-300">Teléfono de Emergencia</label>
              {isEditing ? (
                <Input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="+34 666 777 888"
                  className="mt-1 bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:border-white focus:ring-white"
                />
              ) : (
                <div className="mt-1 bg-white/5 rounded-lg p-3 text-white">
                  {emergencyContactPhone || 'No especificado'}
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-6 pt-4 border-t border-white/20">
            {!isEditing ? (
              <div className="flex justify-center">
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Editar Datos Personales
                </Button>
              </div>
            ) : (
              <div className="flex justify-between space-x-4">
                <Button
                  onClick={handleCancel}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateProfileMutation.isPending}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg flex-1"
                >
                  {updateProfileMutation.isPending ? (
                    <LoadingSpinner size="sm" className="text-white mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}