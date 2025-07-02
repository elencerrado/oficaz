import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface UserAvatarProps {
  fullName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  userId?: number;
  profilePicture?: string | null;
  showUpload?: boolean;
}

// Función para generar iniciales
function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Función para generar colores únicos por usuario
function getUserColors(userId?: number) {
  const colors = [
    { bg: '#3B82F6', text: '#FFFFFF' }, // azul
    { bg: '#10B981', text: '#FFFFFF' }, // verde
    { bg: '#F59E0B', text: '#FFFFFF' }, // amarillo
    { bg: '#EF4444', text: '#FFFFFF' }, // rojo
    { bg: '#8B5CF6', text: '#FFFFFF' }, // púrpura
    { bg: '#06B6D4', text: '#FFFFFF' }, // cian
    { bg: '#F97316', text: '#FFFFFF' }, // naranja
    { bg: '#84CC16', text: '#FFFFFF' }, // lima
    { bg: '#EC4899', text: '#FFFFFF' }, // rosa
    { bg: '#6366F1', text: '#FFFFFF' }, // índigo
    { bg: '#14B8A6', text: '#FFFFFF' }, // teal
    { bg: '#A855F7', text: '#FFFFFF' }, // violeta
    { bg: '#DC2626', text: '#FFFFFF' }, // rojo oscuro
    { bg: '#059669', text: '#FFFFFF' }, // esmeralda
    { bg: '#7C3AED', text: '#FFFFFF' }, // morado
    { bg: '#DB2777', text: '#FFFFFF' }, // rosa fuerte
    { bg: '#B91C1C', text: '#FFFFFF' }, // rojo intenso
    { bg: '#047857', text: '#FFFFFF' }  // verde bosque
  ];
  
  const index = userId ? userId % colors.length : 0;
  return colors[index];
}

// Función para obtener tamaños en pixels
function getSizePixels(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm': return { size: 32, fontSize: 12 };
    case 'md': return { size: 40, fontSize: 14 };
    case 'lg': return { size: 48, fontSize: 16 };
    default: return { size: 40, fontSize: 14 };
  }
}

export function UserAvatar({ 
  fullName, 
  size = 'md', 
  className = '', 
  userId, 
  profilePicture, 
  showUpload = false 
}: UserAvatarProps) {
  const [localProfilePicture, setLocalProfilePicture] = useState<string | null>(profilePicture || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  const colors = getUserColors(userId);
  const sizeConfig = getSizePixels(size);

  // Si hay foto real, mostrarla directamente
  const hasRealPhoto = localProfilePicture || profilePicture;

  // Mutación para subir foto
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await fetch('/api/users/profile-picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error al subir la imagen');
      }

      const data = await response.json();
      return data.profilePicture;
    },
    onSuccess: (profilePictureUrl) => {
      setLocalProfilePicture(profilePictureUrl);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      if (refreshUser) refreshUser();
    }
  });

  // Mutación para eliminar foto
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/users/profile-picture', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al eliminar la imagen');
      }
    },
    onSuccess: () => {
      setLocalProfilePicture(null);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      if (refreshUser) refreshUser();
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteClick = () => {
    deleteMutation.mutate();
  };

  // AVATAR BÁSICO (sin upload)
  if (!showUpload) {
    if (hasRealPhoto) {
      // Avatar con foto real
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
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            aspectRatio: '1'
          } as React.CSSProperties}
        >
          {/* Círculo de fondo con color único */}
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
          {/* Imagen real encima del fondo */}
          <img 
            src={localProfilePicture || profilePicture || ''} 
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
          />
        </div>
      );
    } else {
      // Avatar con iniciales
      return (
        <div 
          style={{
            width: `${sizeConfig.size}px`,
            height: `${sizeConfig.size}px`,
            minWidth: `${sizeConfig.size}px`,
            minHeight: `${sizeConfig.size}px`,
            maxWidth: `${sizeConfig.size}px`,
            maxHeight: `${sizeConfig.size}px`,
            borderRadius: '50%',
            backgroundColor: colors.bg,
            color: colors.text,
            fontSize: `${sizeConfig.fontSize}px`,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            aspectRatio: '1'
          } as React.CSSProperties}
        >
          {getInitials(fullName)}
        </div>
      );
    }
  }

  // AVATAR CON UPLOAD
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
      <div className="relative">
        {hasRealPhoto ? (
          // Avatar con foto real
          <div 
            style={{
              width: '80px',
              height: '80px',
              position: 'relative',
              borderRadius: '50%',
              overflow: 'hidden'
            } as React.CSSProperties}
          >
            {/* Círculo de fondo con color único */}
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
            {/* Imagen real encima del fondo */}
            <img 
              src={localProfilePicture || profilePicture || ''} 
              alt={fullName}
              style={{
                position: 'absolute',
                top: '3px',
                left: '3px',
                width: '74px',
                height: '74px',
                objectFit: 'cover',
                display: 'block',
                borderRadius: '50%',
                zIndex: 2
              } as React.CSSProperties}
            />
          </div>
        ) : (
          // Avatar con iniciales
          <div 
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: colors.bg,
              color: colors.text,
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            } as React.CSSProperties}
          >
            {getInitials(fullName)}
          </div>
        )}

        {/* Botones de upload y delete */}
        <div className="absolute -bottom-1 -right-1 flex space-x-1">
          <button
            onClick={handleUploadClick}
            disabled={uploadMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-full shadow-lg transition-colors"
            title="Subir foto"
          >
            <Upload className="w-3 h-3" />
          </button>

          {hasRealPhoto && (
            <button
              onClick={handleDeleteClick}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-lg transition-colors"
              title="Eliminar foto"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}