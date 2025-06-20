import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { useLocation, Link } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user, company } = useAuth();
  const [location] = useLocation();
  const urlParts = location.split('/').filter(part => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    personalPhone: user?.personalPhone || '+34 666 11 11 11',
    personalEmail: user?.personalEmail || 'juanramirez@gmail.com',
    postalAddress: user?.postalAddress || 'Avenida Andalucía 1 1º Izquierda\n00000 Sevilla',
    emergencyContactName: user?.emergencyContactName || 'María García García',
    emergencyContactPhone: user?.emergencyContactPhone || '+34 666 66 66 66'
  });

  // Company settings (only for admin/manager)
  const [companySettings, setCompanySettings] = useState({
    employeeTimeEditPermission: 'yes' // yes, no, validation
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el perfil');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Perfil actualizado",
        description: "Los cambios se han guardado correctamente",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '01/01/2024';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Split address into lines
  const addressLines = formData.postalAddress.split('\n');

  return (
    <div className="min-h-screen bg-employee-gradient text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-4">
        <Link href={`/${companyAlias}/inicio`}>
          <Button
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/20 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm transition-all duration-200 transform hover:scale-105 flex items-center"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex-1 flex justify-end">
          {company?.logoUrl ? (
            <img 
              src={company.logoUrl} 
              alt={company.name} 
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="text-white text-base font-medium">
              {company?.name || 'Mi Empresa'}
            </div>
          )}
        </div>
      </div>

      {/* User Profile */}
      <div className="px-6 flex-1">
        {/* Simplified Profile Section */}
        <div className="flex items-start mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg flex-shrink-0">
            <span className="text-white text-xl font-bold">
              {getInitials(user?.fullName || 'Juan Ramírez Lopez')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white mb-1 leading-tight">
              {user?.fullName || 'Juan Ramírez Lopez'}
            </h1>
            <p className="text-blue-300 text-sm font-medium mb-1">{user?.position || 'Administrativo'}</p>
            <p className="text-white/70 text-xs mb-3">DNI {user?.dni || '00000000A'}</p>
            
            <div className="space-y-1">
              <p className="text-blue-400 text-sm break-all">{user?.companyEmail || 'j.ramirez@oficaz.com'}</p>
              <p className="text-white/80 text-sm">{user?.companyPhone || '+34 666 11 11 11'}</p>
            </div>
            
            <p className="text-white/60 text-xs mt-3">
              Fecha de alta: {formatDate(user?.startDate?.toString() || '')}
            </p>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="space-y-4">
          {/* Personal Phone */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Teléfono personal
            </label>
            {isEditing ? (
              <Input
                value={formData.personalPhone}
                onChange={(e) => handleInputChange('personalPhone', e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl h-12"
                placeholder="+34 666 11 11 11"
              />
            ) : (
              <div className="bg-white/20 rounded-xl px-4 py-3 text-white h-12 flex items-center">
                {formData.personalPhone}
              </div>
            )}
          </div>

          {/* Personal Email */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Correo electrónico personal
            </label>
            {isEditing ? (
              <Input
                value={formData.personalEmail}
                onChange={(e) => handleInputChange('personalEmail', e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl h-12"
                placeholder="juanramirez@gmail.com"
              />
            ) : (
              <div className="bg-white/20 rounded-xl px-4 py-3 text-white h-12 flex items-center">
                {formData.personalEmail}
              </div>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Dirección postal
            </label>
            {isEditing ? (
              <>
                <Input
                  value={addressLines[0] || ''}
                  onChange={(e) => {
                    const newLines = [...addressLines];
                    newLines[0] = e.target.value;
                    handleInputChange('postalAddress', newLines.join('\n'));
                  }}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl mb-2 h-12"
                  placeholder="Avenida Andalucía 1 1º Izquierda"
                />
                <Input
                  value={addressLines[1] || ''}
                  onChange={(e) => {
                    const newLines = [...addressLines];
                    newLines[1] = e.target.value;
                    handleInputChange('postalAddress', newLines.join('\n'));
                  }}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl h-12"
                  placeholder="00000 Sevilla"
                />
              </>
            ) : (
              <>
                <div className="bg-white/20 rounded-xl px-4 py-3 text-white mb-2 h-12 flex items-center">
                  {addressLines[0] || 'Avenida Andalucía 1 1º Izquierda'}
                </div>
                <div className="bg-white/20 rounded-xl px-4 py-3 text-white h-12 flex items-center">
                  {addressLines[1] || '00000 Sevilla'}
                </div>
              </>
            )}
          </div>

          {/* Emergency Contact */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Contacto de emergencia
            </label>
            {isEditing ? (
              <>
                <Input
                  value={formData.emergencyContactName}
                  onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl mb-2 h-12"
                  placeholder="María García García"
                />
                <Input
                  value={formData.emergencyContactPhone}
                  onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl h-12"
                  placeholder="+34 666 66 66 66"
                />
              </>
            ) : (
              <>
                <div className="bg-white/20 rounded-xl px-4 py-3 text-white mb-2 h-12 flex items-center">
                  {formData.emergencyContactName}
                </div>
                <div className="bg-white/20 rounded-xl px-4 py-3 text-white h-12 flex items-center">
                  {formData.emergencyContactPhone}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Company Settings - Only for admin/manager */}
        {user?.role === 'admin' || user?.role === 'manager' ? (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Configuración de Empresa</h3>
            <div className="space-y-4">
              <div>
                <Label className="block text-white text-sm font-medium mb-2">
                  Los trabajadores pueden editar sus horas
                </Label>
                <Select 
                  value={companySettings.employeeTimeEditPermission} 
                  onValueChange={(value) => setCompanySettings({ ...companySettings, employeeTimeEditPermission: value })}
                >
                  <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="validation">Con validación</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-white/60 text-xs mt-1">
                  {companySettings.employeeTimeEditPermission === 'yes' && 'Los empleados pueden editar libremente sus horarios'}
                  {companySettings.employeeTimeEditPermission === 'no' && 'Solo admin/manager pueden editar horarios'}
                  {companySettings.employeeTimeEditPermission === 'validation' && 'Los empleados pueden solicitar cambios que requieren aprobación'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Edit/Save Button */}
        <div className="mt-8 mb-8">
          {isEditing ? (
            <div className="flex space-x-4">
              <Button
                onClick={() => updateProfileMutation.mutate(formData)}
                disabled={updateProfileMutation.isPending}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl h-12 disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    personalPhone: user?.personalPhone || '+34 666 11 11 11',
                    personalEmail: user?.personalEmail || 'juanramirez@gmail.com',
                    postalAddress: user?.postalAddress || 'Avenida Andalucía 1 1º Izquierda\n00000 Sevilla',
                    emergencyContactName: user?.emergencyContactName || 'María García García',
                    emergencyContactPhone: user?.emergencyContactPhone || '+34 666 66 66 66'
                  });
                }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-xl h-12"
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setIsEditing(true)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl h-12"
            >
              Editar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}