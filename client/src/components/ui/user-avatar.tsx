import { useRef, useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';

interface UserAvatarProps {
  fullName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  userId?: number;
  profilePicture?: string | null;
  showUpload?: boolean;
}

export function UserAvatar({ fullName, size = 'md', className = '', userId, profilePicture, showUpload = false }: UserAvatarProps) {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localProfilePicture, setLocalProfilePicture] = useState<string | null>(profilePicture || null);
  
  // Sincronizar estado local con props cuando cambian
  useEffect(() => {
    setLocalProfilePicture(profilePicture || null);
  }, [profilePicture]);

  // Mutations para subir y eliminar fotos
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      // Si tenemos un userId específico (admin subiendo para empleado), lo enviamos como targetEmployeeId
      if (userId) {
        formData.append('targetEmployeeId', userId.toString());
      }
      
      return await apiRequest('POST', '/api/users/profile-picture', formData);
    },
    onSuccess: (data) => {
      // Actualizar estado local inmediatamente
      if (data?.profilePicture) {
        setLocalProfilePicture(data.profilePicture);
        // Refrescar datos del usuario si es su propia foto
        refreshUser?.();
        // Invalidar queries relacionadas
        queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
        queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      }
      setIsUploading(false);
    },
    onError: (error: any) => {
      setIsUploading(false);
      toast({
        title: "Error",
        description: error.message || "Error al subir la foto",
        variant: "destructive",
      });
    }
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      // Si tenemos userId específico (admin eliminando foto de empleado), usarlo
      if (userId) {
        return await apiRequest('DELETE', `/api/users/${userId}/profile-picture`);
      } else {
        return await apiRequest('DELETE', '/api/users/profile-picture');
      }
    },
    onSuccess: () => {
      // Actualizar estado local inmediatamente
      setLocalProfilePicture(null);
      // Refrescar datos del usuario si es su propia foto
      refreshUser?.();
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar la foto",
        variant: "destructive",
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      uploadPhotoMutation.mutate(file);
    }
  };

  // Función para obtener iniciales del nombre
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Función para obtener colores únicos por userId
  const getUserColors = (userId?: number) => {
    if (!userId) {
      return { bg: '#007AFF', text: '#FFFFFF' };
    }
    
    const colors = [
      { bg: '#3B82F6', text: '#FFFFFF' }, // Blue
      { bg: '#10B981', text: '#FFFFFF' }, // Emerald
      { bg: '#F59E0B', text: '#FFFFFF' }, // Amber
      { bg: '#EF4444', text: '#FFFFFF' }, // Red
      { bg: '#8B5CF6', text: '#FFFFFF' }, // Violet
      { bg: '#06B6D4', text: '#FFFFFF' }, // Cyan
      { bg: '#84CC16', text: '#FFFFFF' }, // Lime
      { bg: '#F97316', text: '#FFFFFF' }, // Orange
      { bg: '#EC4899', text: '#FFFFFF' }, // Pink
      { bg: '#6366F1', text: '#FFFFFF' }, // Indigo
      { bg: '#14B8A6', text: '#FFFFFF' }, // Teal
      { bg: '#A855F7', text: '#FFFFFF' }, // Purple
      { bg: '#22C55E', text: '#FFFFFF' }, // Green
      { bg: '#EAB308', text: '#FFFFFF' }, // Yellow
      { bg: '#DC2626', text: '#FFFFFF' }, // Red-600
      { bg: '#2563EB', text: '#FFFFFF' }, // Blue-600
      { bg: '#7C3AED', text: '#FFFFFF' }, // Violet-600
      { bg: '#059669', text: '#FFFFFF' }  // Emerald-600
    ];
    
    return colors[userId % colors.length];
  };

  // Función para obtener tamaños según el prop size
  const getSizePixels = (size: string) => {
    switch (size) {
      case 'sm': return { size: 32, fontSize: 12, border: 2 };
      case 'lg': return { size: 48, fontSize: 16, border: 3 };
      default: return { size: 40, fontSize: 14, border: 2 };
    }
  };

  // Si hay clases personalizadas Y NO hay foto real, usar renderizado de iniciales
  if (className && !profilePicture && !localProfilePicture) {
    return (
      <div className={`rounded-full flex items-center justify-center font-medium select-none ${className}`}>
        {getInitials(fullName)}
      </div>
    );
  }

  // Usar colores únicos con estilos inline SUPER agresivos
  const colors = getUserColors(userId);
  const sizeConfig = getSizePixels(size);
  
  // SOLO AVATARES CON FOTO - usar estado local para actualizaciones inmediatas
  // Si hay foto real (local o profilePicture), usarla. Si no, usar servicio externo con fallback
  const avatarSrc = localProfilePicture || profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(fullName))}&size=${sizeConfig.size}&background=${colors.bg.replace('#', '')}&color=${colors.text.replace('#', '')}&font-size=0.4&bold=true`;
  
  return (
    <div className={showUpload ? "relative" : ""}>
      {/* Input oculto para seleccionar archivos - SOLO si showUpload */}
      {showUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      )}
      
      {/* Avatar principal - MISMO COMPONENTE PARA TODOS */}
      <div 
        style={{
          width: `${sizeConfig.size}px`,
          height: `${sizeConfig.size}px`,
          minWidth: `${sizeConfig.size}px`,
          minHeight: `${sizeConfig.size}px`,
          maxWidth: `${sizeConfig.size}px`,
          maxHeight: `${sizeConfig.size}px`,
          position: 'relative',
          userSelect: 'none',
          cursor: showUpload ? 'pointer' : 'default',
          transition: showUpload ? 'opacity 0.2s' : 'none',
          opacity: 1,
          flexShrink: 0,
          aspectRatio: '1'
        } as React.CSSProperties}
        onClick={showUpload ? () => fileInputRef.current?.click() : undefined}
        onMouseEnter={showUpload ? (e) => e.currentTarget.style.opacity = '0.8' : undefined}
        onMouseLeave={showUpload ? (e) => e.currentTarget.style.opacity = '1' : undefined}
      >
        {/* Círculo de fondo de color único */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: colors.bg,
            zIndex: 1
          } as React.CSSProperties}
        />
        {/* Imagen encima del fondo */}
        <img 
          src={avatarSrc} 
          alt={fullName}
          style={{
            position: 'absolute',
            top: '3px',
            left: '3px',
            width: `${sizeConfig.size - 6}px`,
            height: `${sizeConfig.size - 6}px`,
            objectFit: 'cover',
            display: 'block',
            borderRadius: '50%',
            zIndex: 2
          } as React.CSSProperties}
          onError={(e) => {
            // Si falla el servicio externo, usar avatar local generado con canvas
            const target = e.target as HTMLImageElement;
            const canvas = document.createElement('canvas');
            const size = sizeConfig.size - 6;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              // Fondo circular
              ctx.fillStyle = colors.bg;
              ctx.beginPath();
              ctx.arc(size/2, size/2, size/2, 0, 2 * Math.PI);
              ctx.fill();
              
              // Texto iniciales
              ctx.fillStyle = colors.text;
              ctx.font = `bold ${sizeConfig.fontSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(getInitials(fullName), size/2, size/2);
              
              target.src = canvas.toDataURL();
            }
          }}
        />
        
        {/* Overlay con icono de cámara cuando está uploading - SOLO si showUpload */}
        {showUpload && isUploading && (
          <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      
      {/* Botones de upload - SOLO si showUpload */}
      {showUpload && (
        <>
          {/* Botón de cámara */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors duration-200 disabled:opacity-50"
            style={{ zIndex: 10 }}
            title="Cambiar foto"
          >
            <Camera className="w-3 h-3" />
          </button>
          
          {/* Botón de eliminar foto cuando hay una */}
          {localProfilePicture && !isUploading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deletePhotoMutation.mutate();
              }}
              className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors duration-200"
              style={{ zIndex: 10 }}
              title="Eliminar foto"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}