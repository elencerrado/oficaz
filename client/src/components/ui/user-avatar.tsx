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

  // Colores únicos para cada empleado usando estilos inline con !important
  const getUserColor = (id?: number) => {
    if (!id) return '007AFF'; // Oficaz primary color
    
    const colors = [
      '3B82F6',  // blue-500
      '10B981',  // emerald-500  
      '8B5CF6',  // purple-500
      'F97316',  // orange-500
      'EC4899',  // pink-500
      '14B8A6',  // teal-500
      '6366F1',  // indigo-500
      'EF4444',  // red-500
      '06B6D4',  // cyan-500
      'F59E0B',  // amber-500
      '84CC16',  // lime-500
      'F43F5E',  // rose-500
      '8B5CF6',  // violet-500
      '0EA5E9',  // sky-500
      '22C55E',  // green-500
      'EAB308',  // yellow-500 (texto negro)
      'D946EF',  // fuchsia-500
      '64748B',  // slate-500
    ];
    
    return colors[id % colors.length];
  };

  // Tamaños según el tamaño del avatar
  const sizeMap = {
    sm: { width: '32px', height: '32px', fontSize: '12px' },
    md: { width: '40px', height: '40px', fontSize: '14px' }, 
    lg: { width: '48px', height: '48px', fontSize: '16px' }
  };

  // Si hay clases personalizadas, usarlas completamente
  if (className) {
    return (
      <div className={`rounded-full flex items-center justify-center font-medium select-none ${className}`}>
        {getInitials(fullName)}
      </div>
    );
  }

  // Crear avatar con estilos inline completos que no puedan ser sobrescritos
  const userColor = getUserColor(userId);
  const isYellow = userColor === 'EAB308';
  const textColor = isYellow ? '#000000' : '#FFFFFF';
  const bgColor = `#${userColor}`;
  const sizes = sizeMap[size];
  
  return (
    <div 
      style={{
        backgroundColor: bgColor + ' !important',
        color: textColor + ' !important',
        width: sizes.width,
        height: sizes.height,
        fontSize: sizes.fontSize,
        borderRadius: '9999px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '500',
        userSelect: 'none',
        border: 'none',
        outline: 'none'
      }}
    >
      {getInitials(fullName)}
    </div>
  );
}