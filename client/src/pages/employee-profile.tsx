import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft, User, Mail, Phone, Edit3, Save, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function EmployeeProfile() {
  const { user, company } = useAuth();
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
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';

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
      {/* Header con botón atrás */}
      <div className="flex items-center p-4 pb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(`/${companyAlias}/inicio`)}
          className="text-white hover:bg-white/10 mr-3"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Mi Perfil</h1>
      </div>

      <div className="px-6 space-y-6">
        {/* Ficha de Usuario - Avatar, Nombre, Cargo */}
        <div className="bg-white/10 rounded-xl p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white">{user?.fullName}</h2>
              <p className="text-gray-300">{user?.position || 'Empleado'}</p>
            </div>
          </div>
          
          {/* Información básica en ficha */}
          <div className="space-y-3">
            <div className="flex items-center text-white">
              <span className="text-gray-300 w-20">DNI:</span>
              <span>{user?.dni}</span>
            </div>
            <div className="flex items-center text-white">
              <span className="text-gray-300 w-20">Teléfono:</span>
              <span>{user?.companyPhone || 'No especificado'}</span>
            </div>
            <div className="flex items-center text-white">
              <span className="text-gray-300 w-20">Email:</span>
              <span className="truncate">{user?.companyEmail}</span>
            </div>
          </div>
        </div>

        {/* Datos Editables */}
        <div className="bg-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-white">Datos Personales</h3>
            {!isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-white hover:bg-white/10"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Editar
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  disabled={updateProfileMutation.isPending}
                  className="text-white hover:bg-white/10"
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
        </div>
      </div>
    </div>
  );
}