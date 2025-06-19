import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { useLocation, Link } from 'wouter';

export default function Settings() {
  const { user, company } = useAuth();
  const [location] = useLocation();
  const companyAlias = location.split('/')[1] || 'test';
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    personalPhone: user?.personalPhone || '+34 666 11 11 11',
    personalEmail: user?.personalEmail || 'juanramirez@gmail.com',
    postalAddress: user?.postalAddress || 'Avenida Andalucía 1 1º Izquierda\n00000 Sevilla',
    emergencyContactName: user?.emergencyContactName || 'María García García',
    emergencyContactPhone: user?.emergencyContactPhone || '+34 666 66 66 66'
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
        <Link href={`/${companyAlias}/dashboard`}>
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
        {/* Modern Profile Card */}
        <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 mb-6 border border-white/10">
          {/* Avatar and Name Row */}
          <div className="flex items-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
              <span className="text-white text-xl font-bold">
                {getInitials(user?.fullName || 'Juan Ramírez Lopez')}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white mb-1 leading-tight">
                {user?.fullName || 'Juan Ramírez Lopez'}
              </h1>
              <div className="flex items-center justify-between">
                <span className="text-blue-300 text-sm font-medium">{user?.position || 'Administrativo'}</span>
                <span className="text-white/70 text-xs bg-white/10 px-2 py-1 rounded-lg">
                  DNI {user?.dni || '00000000A'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Correo Corporativo</p>
              <p className="text-white text-sm font-medium">{user?.companyEmail || 'j.ramirez@oficaz.com'}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Teléfono Corporativo</p>
              <p className="text-white text-sm font-medium">{user?.companyPhone || '+34 666 11 11 11'}</p>
            </div>
          </div>

          {/* Hire Date */}
          <div className="text-center py-3 bg-white/5 rounded-xl">
            <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Fecha de Alta</p>
            <p className="text-white text-sm font-medium">
              {formatDate(user?.startDate?.toString() || '')}
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

        {/* Edit/Save Button */}
        <div className="mt-8 mb-8">
          {isEditing ? (
            <div className="flex space-x-4">
              <Button
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl h-12"
              >
                Guardar
              </Button>
              <Button
                onClick={() => setIsEditing(false)}
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