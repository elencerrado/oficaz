import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ArrowLeft, User, Mail, Phone, Edit3, Save, X, Camera, Trash2, PenTool, RotateCcw, Check, Info } from 'lucide-react';
import { useLocation, Link } from 'wouter';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function EmployeeProfile() {
  usePageTitle('Mi Perfil');
  const { user, company } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Editable fields by employee
  const [personalEmail, setPersonalEmail] = useState(user?.personalEmail || '');
  const [personalPhone, setPersonalPhone] = useState(user?.personalPhone || '');
  const [postalAddress, setPostalAddress] = useState(user?.postalAddress || '');
  const [emergencyContactName, setEmergencyContactName] = useState(user?.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(user?.emergencyContactPhone || '');
  
  // Signature states
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  
  // Get company alias from current URL
  const urlParts = window.location.pathname.split('/').filter((part: string) => part.length > 0);
  const currentCompanyAlias = urlParts[0] || company?.companyAlias || 'test';
  
  // Fetch saved signature
  const { data: signatureData, isLoading: signatureLoading } = useQuery<{ signatureUrl: string | null }>({
    queryKey: ['/api/work-reports/signature'],
    staleTime: 30000
  });
  
  const savedSignatureUrl = signatureData?.signatureUrl;

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', '/api/users/profile', data);
    },
    onSuccess: () => {
      setIsEditing(false);
      toast({
        title: 'Perfil actualizado',
        description: 'Tus datos personales han sido actualizados correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el perfil',
        variant: 'destructive',
      });
    },
  });

  const uploadProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      return await apiRequest('POST', '/api/users/profile-picture', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: 'Foto actualizada',
        description: 'Tu foto de perfil ha sido actualizada correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al subir foto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteProfilePictureMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', '/api/users/profile-picture');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: 'Foto eliminada',
        description: 'Tu foto de perfil ha sido eliminada correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar foto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Tipo de archivo no válido',
          description: 'Solo se permiten archivos JPG, PNG y GIF.',
          variant: 'destructive',
        });
        return;
      }

      // Validar tamaño (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast({
          title: 'Archivo demasiado grande',
          description: 'El tamaño máximo permitido es 5MB.',
          variant: 'destructive',
        });
        return;
      }

      uploadProfilePictureMutation.mutate(file);
    }
  };

  const handleDeletePhoto = () => {
    deleteProfilePictureMutation.mutate();
  };

  const handleSave = () => {
    updateProfileMutation.mutate({
      personalEmail,
      personalPhone,
      postalAddress,
      emergencyContactName,
      emergencyContactPhone,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original values
    setPersonalEmail(user?.personalEmail || '');
    setPersonalPhone(user?.personalPhone || '');
    setPostalAddress(user?.postalAddress || '');
    setEmergencyContactName(user?.emergencyContactName || '');
    setEmergencyContactPhone(user?.emergencyContactPhone || '');
  };

  // Signature mutation
  const saveSignatureMutation = useMutation({
    mutationFn: (signatureData: string) => 
      apiRequest('POST', '/api/work-reports/signature', { signatureData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-reports/signature'] });
      setIsEditingSignature(false);
      setHasDrawnSignature(false);
      toast({
        title: 'Firma guardada',
        description: 'Tu firma se ha guardado correctamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar firma',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Signature canvas functions
  const clearSignatureCanvas = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        lastPointRef.current = null;
        setHasDrawnSignature(false);
      }
    }
  }, []);

  const setupSignatureCanvas = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        lastPointRef.current = null;
      }
    }
  }, []);

  const getEventPos = useCallback((event: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in event) {
      return {
        x: (event.touches[0].clientX - rect.left) * scaleX,
        y: (event.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }, []);

  const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    const { x, y } = getEventPos(event, canvas);
    lastPointRef.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getEventPos]);

  const draw = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (!isDrawing) return;

    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getEventPos(event, canvas);
    
    if (lastPointRef.current) {
      const midX = (lastPointRef.current.x + x) / 2;
      const midY = (lastPointRef.current.y + y) / 2;
      ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
    }
    
    lastPointRef.current = { x, y };
    setHasDrawnSignature(true);
  }, [isDrawing, getEventPos]);

  const stopDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (isDrawing && lastPointRef.current) {
      const canvas = signatureCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineTo(lastPointRef.current.x, lastPointRef.current.y);
          ctx.stroke();
        }
      }
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [isDrawing]);

  const handleSaveSignature = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !hasDrawnSignature) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        if (data[idx] < 250 || data[idx + 1] < 250 || data[idx + 2] < 250) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    const padding = 20;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    const optimizedCanvas = document.createElement('canvas');
    const targetWidth = Math.min(400, width);
    const scale = targetWidth / width;
    optimizedCanvas.width = targetWidth;
    optimizedCanvas.height = height * scale;
    
    const optCtx = optimizedCanvas.getContext('2d');
    if (optCtx) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        tempCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
        
        const imgData = tempCtx.getImageData(0, 0, width, height);
        const pixels = imgData.data;
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          if (r > 230 && g > 230 && b > 230) {
            pixels[i + 3] = 0;
          }
        }
        
        tempCtx.putImageData(imgData, 0, 0);
        
        optCtx.clearRect(0, 0, optimizedCanvas.width, optimizedCanvas.height);
        optCtx.imageSmoothingEnabled = true;
        optCtx.imageSmoothingQuality = 'high';
        optCtx.drawImage(tempCanvas, 0, 0, optimizedCanvas.width, optimizedCanvas.height);
      }
    }
    
    const signatureDataUrl = optimizedCanvas.toDataURL('image/png');
    saveSignatureMutation.mutate(signatureDataUrl);
  }, [hasDrawnSignature, saveSignatureMutation]);

  useEffect(() => {
    if (isEditingSignature) {
      setTimeout(() => setupSignatureCanvas(), 100);
    }
  }, [isEditingSignature, setupSignatureCanvas]);

  return (
    <div className="bg-gray-50 dark:bg-employee-gradient text-gray-900 dark:text-white">
      {/* Header - Exactly like other employee pages but without user name */}
      <div className="flex items-center justify-between p-6 pb-8 h-20">
        <Link href={`/${currentCompanyAlias}/inicio`}>
          <Button
            variant="ghost"
            size="lg"
            className="text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 px-6 py-3 rounded-xl bg-gray-100 dark:bg-white/10 backdrop-blur-sm transition-all duration-200 border border-gray-300 dark:border-white/20"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex-1 flex flex-col items-end text-right">
          <div className="text-gray-900 dark:text-white text-sm font-medium">
            {company?.name || 'Test Company'}
          </div>
        </div>
      </div>
      
      {/* Page Title */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Mi Perfil</h1>
        <p className="text-gray-600 dark:text-white/70 text-sm">
          Gestiona tu información personal y de contacto
        </p>
      </div>
      <div className="px-6 space-y-6">
        {/* Ficha de Usuario - Avatar, Nombre, Cargo */}
        <div className="bg-white dark:bg-white/10 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/20 p-6">
          <div className="flex items-center space-x-6 mb-6">
            {/* Avatar with photo upload functionality */}
            <div className="relative">
              <UserAvatar
                fullName={user?.fullName || ''}
                size="lg"
                userId={user?.id}
                profilePicture={user?.profilePicture}
                showUpload={true}
                className="w-20 h-20 shadow-lg"
              />
            </div>
            
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{user?.fullName}</h2>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 dark:bg-blue-400 rounded-full"></div>
                <p className="text-blue-600 dark:text-blue-200 font-medium">{user?.position || 'Empleado'}</p>
              </div>
            </div>
          </div>
          
          {/* Información básica en ficha - Diseño compacto */}
          <div className="space-y-2">
            {/* DNI - siempre mostrar */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300 text-sm">DNI</span>
              <span className="text-gray-900 dark:text-white text-sm">{user?.dni}</span>
            </div>
            
            {/* Teléfono - solo si tiene datos */}
            {user?.companyPhone && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300 text-sm">Teléfono</span>
                <span className="text-gray-900 dark:text-white text-sm">{user.companyPhone}</span>
              </div>
            )}
            
            {/* Email - solo si tiene datos */}
            {user?.companyEmail && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300 text-sm">Email</span>
                <span className="text-gray-900 dark:text-white text-sm truncate max-w-48">{user.companyEmail}</span>
              </div>
            )}
          </div>
        </div>

        {/* Datos Editables */}
        <div className="bg-white dark:bg-white/10 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/20 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Datos Personales Editables</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-300">Email Personal</label>
              {isEditing ? (
                <Input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="tu-email@ejemplo.com"
                  className="mt-1 bg-white dark:bg-white/5 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-gray-900 dark:focus:border-white focus:ring-gray-900 dark:focus:ring-white"
                />
              ) : (
                <div className="mt-1 bg-white dark:bg-white/5 rounded-lg p-3 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10">
                  {personalEmail || 'No especificado'}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-600 dark:text-gray-300">Teléfono Personal</label>
              {isEditing ? (
                <Input
                  type="tel"
                  value={personalPhone}
                  onChange={(e) => setPersonalPhone(e.target.value)}
                  placeholder="+34 666 777 888"
                  className="mt-1 bg-white dark:bg-white/5 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-gray-900 dark:focus:border-white focus:ring-gray-900 dark:focus:ring-white"
                />
              ) : (
                <div className="mt-1 bg-white dark:bg-white/5 rounded-lg p-3 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10">
                  {personalPhone || 'No especificado'}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-600 dark:text-gray-300">Dirección Postal</label>
              {isEditing ? (
                <Input
                  value={postalAddress}
                  onChange={(e) => setPostalAddress(e.target.value)}
                  placeholder="Calle, número, ciudad, código postal"
                  className="mt-1 bg-white dark:bg-white/5 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-gray-900 dark:focus:border-white focus:ring-gray-900 dark:focus:ring-white"
                />
              ) : (
                <div className="mt-1 bg-white dark:bg-white/5 rounded-lg p-3 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10">
                  {postalAddress || 'No especificado'}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-600 dark:text-gray-300">Contacto de Emergencia</label>
              {isEditing ? (
                <Input
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="Nombre del contacto de emergencia"
                  className="mt-1 bg-white dark:bg-white/5 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-gray-900 dark:focus:border-white focus:ring-gray-900 dark:focus:ring-white"
                />
              ) : (
                <div className="mt-1 bg-white dark:bg-white/5 rounded-lg p-3 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10">
                  {emergencyContactName || 'No especificado'}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-600 dark:text-gray-300">Teléfono de Emergencia</label>
              {isEditing ? (
                <Input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="+34 666 777 888"
                  className="mt-1 bg-white dark:bg-white/5 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-gray-900 dark:focus:border-white focus:ring-gray-900 dark:focus:ring-white"
                />
              ) : (
                <div className="mt-1 bg-white dark:bg-white/5 rounded-lg p-3 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10">
                  {emergencyContactPhone || 'No especificado'}
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-white/20">
            {!isEditing ? (
              <div className="flex justify-center">
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Editar Datos Personales
                </Button>
              </div>
            ) : (
              <div className="flex justify-between space-x-4">
                <Button
                  onClick={handleCancel}
                  className="bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white px-6 py-2 rounded-lg flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateProfileMutation.isPending}
                  className="bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700 text-white px-6 py-2 rounded-lg flex-1"
                >
                  {updateProfileMutation.isPending ? (
                    <LoadingSpinner size="sm" className="text-white mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Sección de Firma Digital */}
        <div className="bg-white dark:bg-white/10 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/20 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Mi Firma Digital
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Esta firma se usará para firmar documentos y nóminas
            </p>
          </div>

          {signatureLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : !isEditingSignature ? (
            <div className="space-y-4">
              {savedSignatureUrl ? (
                <div className="relative border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6 flex items-center justify-center min-h-[120px]">
                  <img 
                    src={savedSignatureUrl} 
                    alt="Tu firma" 
                    className="max-h-20 max-w-full object-contain dark:invert dark:brightness-90"
                  />
                </div>
              ) : (
                <div className="relative border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 p-8 flex flex-col items-center justify-center min-h-[120px]">
                  <PenTool className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                    No tienes firma guardada
                  </p>
                </div>
              )}
              
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Tu firma digital se usará automáticamente para firmar documentos que requieran tu aprobación.
                </p>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={() => setIsEditingSignature(true)}
                  className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  {savedSignatureUrl ? 'Cambiar Firma' : 'Crear Firma'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dibuja tu nueva firma:</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSignatureCanvas}
                  disabled={!hasDrawnSignature}
                  className="h-8 px-3 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Limpiar
                </Button>
              </div>
              
              <div className="relative border rounded-lg bg-white border-gray-300 dark:border-gray-600">
                <canvas
                  ref={signatureCanvasRef}
                  width={600}
                  height={200}
                  className="w-full h-40 touch-none cursor-crosshair rounded-lg"
                  style={{ 
                    touchAction: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none'
                  }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasDrawnSignature && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-400 text-sm">
                      Usa tu dedo o ratón para firmar aquí
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between space-x-4">
                <Button
                  onClick={() => {
                    setIsEditingSignature(false);
                    setHasDrawnSignature(false);
                  }}
                  className="bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white px-6 py-2 rounded-lg flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveSignature}
                  disabled={!hasDrawnSignature || saveSignatureMutation.isPending}
                  className="bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700 text-white px-6 py-2 rounded-lg flex-1"
                >
                  {saveSignatureMutation.isPending ? (
                    <LoadingSpinner size="sm" className="text-white mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Guardar Firma
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}