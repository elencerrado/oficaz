interface UserAvatarProps {
  fullName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  userId?: number; // Para generar color único por empleado
  profilePicture?: string | null; // URL de la foto de perfil
}

export function UserAvatar({ fullName, size = 'md', className = '', userId, profilePicture }: UserAvatarProps) {
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