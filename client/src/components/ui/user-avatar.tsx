interface UserAvatarProps {
  fullName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  userId?: number; // Para generar color único por empleado
}

export function UserAvatar({ fullName, size = 'md', className = '', userId }: UserAvatarProps) {
  // Extraer iniciales del nombre completo
  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    // Tomar primera letra del primer nombre y primera del último apellido
    return (words[0][0] + (words[words.length - 1][0] || '')).toUpperCase();
  };

  // Colores únicos para cada empleado con estilos CSS directos
  const getUserColorStyle = (id?: number) => {
    if (!id) return { backgroundColor: '#007AFF' }; // Oficaz primary color
    
    const colors = [
      '#3B82F6',  // blue-500
      '#10B981',  // emerald-500  
      '#8B5CF6',  // purple-500
      '#F97316',  // orange-500
      '#EC4899',  // pink-500
      '#14B8A6',  // teal-500
      '#6366F1',  // indigo-500
      '#EF4444',  // red-500
      '#06B6D4',  // cyan-500
      '#F59E0B',  // amber-500
      '#84CC16',  // lime-500
      '#F43F5E',  // rose-500
      '#8B5CF6',  // violet-500
      '#0EA5E9',  // sky-500
      '#22C55E',  // green-500
      '#EAB308',  // yellow-500
      '#D946EF',  // fuchsia-500
      '#64748B',  // slate-500
    ];
    
    return { backgroundColor: colors[id % colors.length] };
  };

  // Tamaños de texto según el tamaño del avatar
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm', 
    lg: 'text-base'
  };

  // Crear clases base mínimas
  const baseClasses = 'rounded-full flex items-center justify-center font-medium select-none';
  
  // Si hay clases personalizadas, usarlas completamente
  if (className) {
    return (
      <div className={`${baseClasses} ${textSizes[size]} ${className}`}>
        {getInitials(fullName)}
      </div>
    );
  }

  // Solo aplicar defaults si no hay className personalizada
  const defaultClasses = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';
  const userColorStyle = getUserColorStyle(userId);
  
  return (
    <div 
      className={`${baseClasses} ${defaultClasses} ${textSizes[size]} text-white`}
      style={userColorStyle}
    >
      {getInitials(fullName)}
    </div>
  );
}