interface UserAvatarProps {
  fullName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserAvatar({ fullName, size = 'md', className = '' }: UserAvatarProps) {
  // Extraer iniciales del nombre completo
  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    // Tomar primera letra del primer nombre y primera del último apellido
    return (words[0][0] + (words[words.length - 1][0] || '')).toUpperCase();
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
  
  return (
    <div className={`${baseClasses} ${defaultClasses} ${textSizes[size]} bg-oficaz-primary text-white`}>
      {getInitials(fullName)}
    </div>
  );
}