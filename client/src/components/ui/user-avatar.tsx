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

  // Colores únicos para cada empleado (paleta vibrante y profesional)
  const getUserColor = (id?: number) => {
    if (!id) return 'bg-oficaz-primary'; // Color por defecto si no hay userId
    
    const colors = [
      'bg-blue-500',    // Azul vibrante
      'bg-emerald-500', // Verde esmeralda
      'bg-purple-500',  // Púrpura
      'bg-orange-500',  // Naranja
      'bg-pink-500',    // Rosa
      'bg-teal-500',    // Verde azulado
      'bg-indigo-500',  // Índigo
      'bg-red-500',     // Rojo
      'bg-cyan-500',    // Cian
      'bg-amber-500',   // Ámbar
      'bg-lime-500',    // Lima
      'bg-rose-500',    // Rosa intenso
      'bg-violet-500',  // Violeta
      'bg-sky-500',     // Azul cielo
      'bg-green-500',   // Verde
      'bg-yellow-500',  // Amarillo
      'bg-fuchsia-500', // Fucsia
      'bg-slate-500',   // Gris pizarra
    ];
    
    // Usar el ID del usuario para seleccionar un color consistente
    return colors[id % colors.length];
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
  const userColor = getUserColor(userId);
  
  return (
    <div className={`${baseClasses} ${defaultClasses} ${textSizes[size]} ${userColor} text-white`}>
      {getInitials(fullName)}
    </div>
  );
}