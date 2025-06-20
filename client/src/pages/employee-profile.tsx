import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Building, Save } from 'lucide-react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function EmployeeProfile() {
  const { user, company } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Editable fields by employee
  const [personalEmail, setPersonalEmail] = useState(user?.personalEmail || '');
  const [personalPhone, setPersonalPhone] = useState(user?.personalPhone || '');
  const [postalAddress, setPostalAddress] = useState(user?.postalAddress || '');
  const [emergencyContactName, setEmergencyContactName] = useState(user?.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(user?.emergencyContactPhone || '');
  
  // Get company alias from current URL
  const [currentLocation] = useLocation();
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

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return '';
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
        {/* Sección Datos Personales (Solo lectura) */}
        <div className="bg-white/10 rounded-xl p-4">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <User className="h-5 w-5 mr-2" />
            Datos Personales
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-300">Nombre Completo</label>
              <div className="bg-white/5 rounded-lg p-3 text-white">
                {user?.fullName}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-300">DNI/NIE</label>
              <div className="bg-white/5 rounded-lg p-3 text-white">
                {user?.dni}
              </div>
            </div>
          </div>
        </div>

        {/* Sección Datos Laborales (Solo lectura) */}
        <div className="bg-white/10 rounded-xl p-4">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <Building className="h-5 w-5 mr-2" />
            Datos Laborales
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-300">Email Corporativo</label>
              <div className="bg-white/5 rounded-lg p-3 text-white">
                {user?.companyEmail}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-300">Cargo</label>
              <div className="bg-white/5 rounded-lg p-3 text-white">
                {user?.position || 'No especificado'}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-300">Fecha de Incorporación</label>
              <div className="bg-white/5 rounded-lg p-3 text-white flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                {formatDate(user?.startDate)}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-300">Teléfono Corporativo</label>
              <div className="bg-white/5 rounded-lg p-3 text-white">
                {user?.companyPhone || 'No especificado'}
              </div>
            </div>
          </div>
        </div>

        {/* Sección Datos de Contacto (Editables) */}
        <div className="bg-white/10 rounded-xl p-4">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Datos de Contacto Personal
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-300">Email Personal</label>
              <Input
                type="email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                placeholder="tu-email@ejemplo.com"
                className="bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:border-white focus:ring-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300">Teléfono Personal</label>
              <Input
                type="tel"
                value={personalPhone}
                onChange={(e) => setPersonalPhone(e.target.value)}
                placeholder="+34 666 777 888"
                className="bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:border-white focus:ring-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300">Dirección Postal</label>
              <Input
                value={postalAddress}
                onChange={(e) => setPostalAddress(e.target.value)}
                placeholder="Calle, número, ciudad, código postal"
                className="bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:border-white focus:ring-white"
              />
            </div>
          </div>
        </div>

        {/* Sección Contacto de Emergencia (Editables) */}
        <div className="bg-white/10 rounded-xl p-4">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <Phone className="h-5 w-5 mr-2" />
            Contacto de Emergencia
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-300">Nombre de Contacto</label>
              <Input
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="Nombre del contacto de emergencia"
                className="bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:border-white focus:ring-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300">Teléfono de Contacto</label>
              <Input
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="+34 666 777 888"
                className="bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:border-white focus:ring-white"
              />
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="pb-6">
          <Button
            onClick={handleSave}
            disabled={updateProfileMutation.isPending}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl"
          >
            {updateProfileMutation.isPending ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="text-white mr-2" />
                Guardando...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}