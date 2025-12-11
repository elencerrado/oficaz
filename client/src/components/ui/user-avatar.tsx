import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Camera, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface UserAvatarProps {
  fullName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  userId?: number; // Para generar color único por empleado
  profilePicture?: string | null; // URL de la foto de perfil
  showUpload?: boolean; // Mostrar opción de subir foto
  role?: 'admin' | 'manager' | 'employee'; // Rol del usuario para mostrar indicador
}

// Helper para obtener letra y color del rol
const getRoleIndicator = (role?: 'admin' | 'manager' | 'employee') => {
  if (!role) return null;
  
  const roleConfig = {
    admin: { letter: 'A', bg: '#EF4444', label: 'Administrador' },
    manager: { letter: 'M', bg: '#F59E0B', label: 'Manager' },
    employee: { letter: 'E', bg: '#3B82F6', label: 'Empleado' }
  };
  
  return roleConfig[role];
};

export function UserAvatar({ fullName, size = 'md', className = '', userId, profilePicture, showUpload = false, role }: UserAvatarProps) {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localProfilePicture, setLocalProfilePicture] = useState<string | null>(profilePicture || null);
  const [processingJobId, setProcessingJobId] = useState<number | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [pollingTimeoutId, setPollingTimeoutId] = useState<NodeJS.Timeout | null>(null);
  
  // Sincronizar estado local con props cuando cambian
  useEffect(() => {
    setLocalProfilePicture(profilePicture || null);
  }, [profilePicture]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutId) {
        clearTimeout(pollingTimeoutId);
      }
    };
  }, [pollingTimeoutId]);

  // Polling function for background processing status
  const pollJobStatus = useCallback(async (jobId: number) => {
    try {
      const response = await apiRequest('GET', `/api/image-processing/status/${jobId}`);
      setProcessingStatus(response.status);
      
      if (response.status === 'completed') {
        // Job completed successfully
        if (response.profilePicture) {
          setLocalProfilePicture(response.profilePicture);
          // Force re-render with small delay
          setTimeout(() => {
            setLocalProfilePicture(response.profilePicture);
          }, 100);
        }
        
        // Update auth context and invalidate queries
        refreshUser();
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
        
        toast({ title: "Foto actualizada", description: "La foto se ha procesado y actualizado correctamente" });
        setIsUploading(false);
        setProcessingJobId(null);
        setProcessingStatus(null);
        
      } else if (response.status === 'failed') {
        // Job failed
        toast({ 
          title: "Error", 
          description: response.errorMessage || "Error al procesar la imagen", 
          variant: "destructive" 
        });
        setIsUploading(false);
        setProcessingJobId(null);
        setProcessingStatus(null);
        
      } else {
        // Job still processing, continue polling
        const timeoutId = setTimeout(() => pollJobStatus(jobId), 3000); // Poll every 3 seconds
        setPollingTimeoutId(timeoutId);
      }
    } catch (error) {
      console.error('Error polling job status:', error);
      toast({ title: "Error", description: "Error al consultar el estado del procesamiento", variant: "destructive" });
      setIsUploading(false);
      setProcessingJobId(null);
      setProcessingStatus(null);
    }
  }, [refreshUser, queryClient, toast]);

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
      if (data?.jobId) {
        // New background processing workflow
        setProcessingJobId(data.jobId);
        setProcessingStatus('pending');
        toast({ title: "Procesando imagen", description: "La imagen se está procesando en segundo plano..." });
        
        // Start polling for job status
        setTimeout(() => pollJobStatus(data.jobId), 1000); // Start polling after 1 second
        
      } else if (data?.profilePicture) {
        // Legacy direct response (fallback)
        setLocalProfilePicture(data.profilePicture);
        setTimeout(() => {
          setLocalProfilePicture(data.profilePicture);
        }, 100);
        
        refreshUser();
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
        
        toast({ title: "Foto actualizada", description: "La foto se ha actualizado correctamente" });
        setIsUploading(false);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la foto", variant: "destructive" });
      setIsUploading(false);
      setProcessingJobId(null);
      setProcessingStatus(null);
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      // Solo usar el endpoint con ID específico si el usuario actual es admin/manager Y está gestionando otro usuario
      // Si es el propio usuario o no es admin, usar el endpoint personal
      const currentUser = await apiRequest('GET', '/api/auth/me');
      const isAdmin = currentUser.user.role === 'admin' || currentUser.user.role === 'manager';
      const isDifferentUser = userId && userId !== currentUser.user.id;
      
      if (isAdmin && isDifferentUser) {
        return await apiRequest('DELETE', `/api/users/${userId}/profile-picture`);
      } else {
        return await apiRequest('DELETE', '/api/users/profile-picture');
      }
    },
    onSuccess: () => {
      // Actualizar estado local inmediatamente para eliminar la foto
      setLocalProfilePicture(null);
      
      // CRÍTICO: Actualizar contexto de autenticación para el dashboard
      refreshUser();
      
      // Efficient cache invalidation - only invalidate essential queries
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      
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

  // Extraer iniciales del nombre completo - Lógica mejorada para nombres españoles
  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    
    if (words.length === 2) {
      // Solo 2 palabras: Nombre + Apellido
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    
    // Para 3 o más palabras, necesitamos detectar donde termina el nombre y empiezan los apellidos
    // En España es común: [Nombre] [Segundo_Nombre?] [Primer_Apellido] [Segundo_Apellido?]
    
    // Lista de segundos nombres muy comunes en España
    const commonSecondNames = [
      'luis', 'josé', 'maría', 'ana', 'juan', 'carlos', 'antonio', 'manuel', 'francisco', 
      'jesús', 'javier', 'miguel', 'pedro', 'angel', 'rafael', 'david', 'daniel', 'sergio',
      'pablo', 'alberto', 'fernando', 'eduardo', 'ricardo', 'alejandro', 'jorge', 'ramón',
      'andrés', 'ignacio', 'francisco', 'enrique', 'diego', 'cristina', 'carmen', 'pilar',
      'teresa', 'mercedes', 'dolores', 'concepción', 'rosario', 'angeles', 'montserrat',
      'isabel', 'patricia', 'esperanza', 'inmaculada', 'amparo', 'gloria', 'soledad'
    ];
    
    if (words.length >= 3) {
      // Verificar si la segunda palabra es un segundo nombre común
      if (commonSecondNames.includes(words[1].toLowerCase())) {
        // Formato: [Nombre] [Segundo_Nombre] [Apellido] [Apellido?]
        // Usar primer nombre + primer apellido (posición 2)
        return (words[0][0] + words[2][0]).toUpperCase();
      } else {
        // Formato: [Nombre] [Apellido] [Apellido]
        // Usar primer nombre + primer apellido (posición 1)
        return (words[0][0] + words[1][0]).toUpperCase();
      }
    }
    
    return words[0].substring(0, 2).toUpperCase();
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

  // Tamaño unificado más grande para todos los avatares - CONSISTENCIA TOTAL
  const getSizePixels = (size: 'sm' | 'md' | 'lg') => {
    // TODOS los tamaños ahora usan las mismas dimensiones para máxima consistencia
    return { size: 40, fontSize: 14, border: 3 };
  };

  // Si no se necesita upload, usar el renderizado simple original
  if (!showUpload) {
    // Usar colores únicos con estilos inline SUPER agresivos para TODOS los avatares
    const colors = getUserColors(userId);
    const sizeConfig = getSizePixels(size);
    
    return (
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
          flexShrink: 0,
          aspectRatio: '1'
        } as React.CSSProperties}
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
        
        {/* Mostrar foto real si está disponible */}
        {(localProfilePicture || profilePicture) ? (
          <img 
            src={(localProfilePicture || profilePicture) as string} 
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
              // Si falla cargar la foto real, usar servicio UI Avatars
              const target = e.target as HTMLImageElement;
              target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(fullName))}&size=${sizeConfig.size}&background=${colors.bg.replace('#', '')}&color=${colors.text.replace('#', '')}&font-size=0.4&bold=true`;
              
              target.onerror = () => {
                // Si también falla UI Avatars, usar canvas local
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
              };
            }}
          />
        ) : (
          /* Usar servicio UI Avatars como respaldo cuando no hay foto real */
          <img 
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(fullName))}&size=${sizeConfig.size}&background=${colors.bg.replace('#', '')}&color=${colors.text.replace('#', '')}&font-size=0.4&bold=true`}
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
              // Si falla UI Avatars, usar canvas local
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
        )}
        
        {/* Indicador de rol */}
        {role && (() => {
          const roleIndicator = getRoleIndicator(role);
          if (!roleIndicator) return null;
          
          const indicatorSize = Math.max(sizeConfig.size * 0.28, 14);
          
          return (
            <div
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                width: `${indicatorSize}px`,
                height: `${indicatorSize}px`,
                borderRadius: '50%',
                backgroundColor: roleIndicator.bg,
                border: '2px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${indicatorSize * 0.6}px`,
                fontWeight: 'bold',
                color: 'white',
                zIndex: 10,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              } as React.CSSProperties}
              title={roleIndicator.label}
            >
              {roleIndicator.letter}
            </div>
          );
        })()}
      </div>
    );
  }

  // Renderizado con opciones de upload - USAR TAMAÑO DEL CLASSNAME SI ESTÁ PRESENTE
  const colors = getUserColors(userId);
  const baseSizeConfig = getSizePixels(size);
  
  // Si hay className con w-64 h-64, extraer el tamaño
  let sizeConfig = {
    size: 60,
    border: 3,
    fontSize: 18
  };
  
  // Detectar tamaño desde className
  if (className && className.includes('w-64') && className.includes('h-64')) {
    sizeConfig = {
      size: 256,
      border: 6,
      fontSize: 48
    };
  } else if (className && className.includes('w-32') && className.includes('h-32')) {
    sizeConfig = {
      size: 128,
      border: 4,
      fontSize: 24
    };
  } else if (className && className.includes('w-20') && className.includes('h-20')) {
    sizeConfig = {
      size: 80,
      border: 3,
      fontSize: 16
    };
  }
  
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
      
      {/* Avatar principal - ESTILOS INLINE PUROS */}
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
          cursor: 'pointer',
          transition: 'opacity 0.2s',
          opacity: 1,
          flexShrink: 0,
          aspectRatio: '1'
        } as React.CSSProperties}
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
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
          src={(localProfilePicture || profilePicture) 
            ? `${localProfilePicture || profilePicture}?v=${Date.now()}` 
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(fullName))}&size=${sizeConfig.size}&background=${colors.bg.replace('#', '')}&color=${colors.text.replace('#', '')}&font-size=0.4&bold=true`} 
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
        
        {/* Overlay con icono de cámara cuando está uploading */}
        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center flex-col">
            <LoadingSpinner size="xs" />
            {processingStatus && (
              <div className="text-white text-xs mt-1 font-medium">
                {processingStatus === 'pending' ? 'Subiendo...' : 
                 processingStatus === 'processing' ? 'Procesando...' : 'Subiendo...'}
              </div>
            )}
          </div>
        )}
        
        {/* Indicador de rol */}
        {role && (() => {
          const roleIndicator = getRoleIndicator(role);
          if (!roleIndicator) return null;
          
          const indicatorSize = Math.max(sizeConfig.size * 0.28, 14);
          
          return (
            <div
              style={{
                position: 'absolute',
                bottom: '-2px',
                left: '-2px',
                width: `${indicatorSize}px`,
                height: `${indicatorSize}px`,
                borderRadius: '50%',
                backgroundColor: roleIndicator.bg,
                border: '2px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${indicatorSize * 0.6}px`,
                fontWeight: 'bold',
                color: 'white',
                zIndex: 11,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              } as React.CSSProperties}
              title={roleIndicator.label}
            >
              {roleIndicator.letter}
            </div>
          );
        })()}
      </div>
      
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
    </div>
  );
}