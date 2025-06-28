import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Camera, X } from 'lucide-react';

interface UserAvatarProps {
  fullName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  userId?: number; // Para generar color único por empleado
  profilePicture?: string | null; // URL de la foto de perfil
  showUpload?: boolean; // Mostrar opción de subir foto
}

export function UserAvatar({ fullName, size = 'md', className = '', userId, profilePicture, showUpload = false }: UserAvatarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Mutations para subir y eliminar fotos
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profilePicture', file);
      return await apiRequest('POST', '/api/users/profile-picture', formData);
    },
    onSuccess: (data) => {
      // Invalidar TODOS los posibles endpoints que contengan datos del usuario
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      
      // Invalidar cache de forma más amplia usando patrones
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.includes('/api/auth') || 
                 key?.includes('/api/employees') || 
                 key?.includes('/api/users') ||
                 key?.includes('/api/messages') ||
                 key?.includes('/api/vacation') ||
                 key?.includes('/api/work-sessions');
        }
      });
      
      // Forzar refetch inmediato de los datos más críticos
      queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
      queryClient.refetchQueries({ queryKey: ['/api/employees'] });
      
      toast({ title: "Foto actualizada", description: "Tu foto de perfil se ha actualizado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la foto", variant: "destructive" });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', '/api/users/profile-picture');
    },
    onSuccess: () => {
      // Invalidar TODOS los posibles endpoints que contengan datos del usuario
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      
      // Invalidar cache de forma más amplia usando patrones
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.includes('/api/auth') || 
                 key?.includes('/api/employees') || 
                 key?.includes('/api/users') ||
                 key?.includes('/api/messages') ||
                 key?.includes('/api/vacation') ||
                 key?.includes('/api/work-sessions');
        }
      });
      
      // Forzar refetch inmediato de los datos más críticos
      queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
      queryClient.refetchQueries({ queryKey: ['/api/employees'] });
      
      toast({ title: "Foto eliminada", description: "Tu foto de perfil se ha eliminado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la foto", variant: "destructive" });
    },
  });

  // Manejar selección de archivo
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Error", description: "El archivo debe ser menor a 5MB", variant: "destructive" });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({ title: "Error", description: "Solo se permiten archivos de imagen", variant: "destructive" });
        return;
      }
      setIsUploading(true);
      uploadPhotoMutation.mutate(file);
    }
  };

  // Extraer iniciales del nombre completo
  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    // Tomar primera letra del primer nombre y primera del último apellido
    return (words[0][0] + (words[words.length - 1][0] || '')).toUpperCase();
  };

  // Colores únicos para cada empleado usando estilos inline agresivos
  const getUserColors = (id?: number) => {
    if (!id) return { bg: '#007AFF', text: '#FFFFFF' }; // Oficaz primary color
    
    const colorPairs = [
      { bg: '#3B82F6', text: '#FFFFFF' },  // blue-500
      { bg: '#10B981', text: '#FFFFFF' },  // emerald-500  
      { bg: '#8B5CF6', text: '#FFFFFF' },  // purple-500
      { bg: '#F97316', text: '#FFFFFF' },  // orange-500
      { bg: '#EC4899', text: '#FFFFFF' },  // pink-500
      { bg: '#14B8A6', text: '#FFFFFF' },  // teal-500
      { bg: '#6366F1', text: '#FFFFFF' },  // indigo-500
      { bg: '#EF4444', text: '#FFFFFF' },  // red-500
      { bg: '#06B6D4', text: '#FFFFFF' },  // cyan-500
      { bg: '#F59E0B', text: '#FFFFFF' },  // amber-500
      { bg: '#84CC16', text: '#FFFFFF' },  // lime-500
      { bg: '#F43F5E', text: '#FFFFFF' },  // rose-500
      { bg: '#8B5CF6', text: '#FFFFFF' },  // violet-500
      { bg: '#0EA5E9', text: '#FFFFFF' },  // sky-500
      { bg: '#22C55E', text: '#FFFFFF' },  // green-500
      { bg: '#EAB308', text: '#000000' },  // yellow-500 (texto negro)
      { bg: '#D946EF', text: '#FFFFFF' },  // fuchsia-500
      { bg: '#64748B', text: '#FFFFFF' },  // slate-500
    ];
    
    return colorPairs[id % colorPairs.length];
  };

  // Tamaño único consistente para todos los avatares - más grande
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-10 h-10 text-sm', 
    lg: 'w-10 h-10 text-sm'
  };

  // Si no se necesita upload, usar el renderizado simple original
  if (!showUpload) {
    // Si hay clases personalizadas, usarlas completamente
    if (className) {
      return (
        <div className={`rounded-full flex items-center justify-center font-medium select-none ${className}`}>
          {getInitials(fullName)}
        </div>
      );
    }

    // Usar colores únicos con estilos inline SUPER agresivos
    const colors = getUserColors(userId);
    
    // Si hay foto de perfil, mostrarla con borde de color único
    if (profilePicture) {
      return (
        <div 
          className={`rounded-full overflow-hidden flex items-center justify-center select-none ${sizeClasses[size]}`}
          style={{
            border: `3px solid ${colors.bg}`,
            padding: '2px'
          } as React.CSSProperties}
        >
          <img 
            src={profilePicture} 
            alt={fullName}
            className="w-full h-full rounded-full object-cover"
            onError={(e) => {
              // Si la imagen falla al cargar, ocultar el elemento para mostrar fallback
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      );
    }
    
    // Si no hay foto, mostrar iniciales con fondo de color
    return (
      <div 
        className={`rounded-full flex items-center justify-center font-medium select-none user-avatar-unique ${sizeClasses[size]}`}
        style={{
          '--avatar-bg': colors.bg,
          '--avatar-color': colors.text
        } as React.CSSProperties}
      >
        {getInitials(fullName)}
      </div>
    );
  }

  // Renderizado con opciones de upload
  const colors = getUserColors(userId);
  
  return (
    <div className="relative">
      {/* Input oculto para seleccionar archivos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Avatar principal */}
      <div 
        className={`rounded-full overflow-hidden flex items-center justify-center select-none cursor-pointer transition-all duration-200 hover:opacity-80 ${sizeClasses[size]}`}
        style={{
          border: `3px solid ${colors.bg}`,
          padding: '2px'
        } as React.CSSProperties}
        onClick={() => fileInputRef.current?.click()}
      >
        {profilePicture ? (
          <img 
            src={profilePicture} 
            alt={fullName}
            className="w-full h-full rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div 
            className="w-full h-full rounded-full flex items-center justify-center font-medium select-none user-avatar-unique"
            style={{
              '--avatar-bg': colors.bg,
              '--avatar-color': colors.text
            } as React.CSSProperties}
          >
            {getInitials(fullName)}
          </div>
        )}
        
        {/* Overlay con icono de cámara cuando está uploading */}
        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      
      {/* Botón de cámara */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors duration-200 disabled:opacity-50"
        title="Cambiar foto"
      >
        <Camera className="w-3 h-3" />
      </button>
      
      {/* Botón de eliminar foto cuando hay una */}
      {profilePicture && !isUploading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            deletePhotoMutation.mutate();
          }}
          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors duration-200"
          title="Eliminar foto"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}