import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  ArrowLeft, 
  MessageSquare, 
  FileText, 
  Calendar, 
  Clock, 
  BarChart3, 
  Settings as SettingsIcon, 
  Upload, 
  Zap, 
  Bell,
  Save,
  RefreshCw
} from 'lucide-react';

interface Feature {
  id: number;
  key: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  basicEnabled: boolean;
  proEnabled: boolean;
  masterEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const featureIcons = {
  messages: MessageSquare,
  documents: FileText,
  vacation: Calendar,
  timeTracking: Clock,
  timeEditingPermissions: Clock,
  analytics: BarChart3,
  customization: SettingsIcon,
  logoUpload: Upload,
  api: Zap,
  reminders: Bell,
  employee_time_edit_permission: Clock,
} as const;

const featureLabels = {
  messages: 'Mensajes',
  documents: 'Documentos',
  vacation: 'Vacaciones',
  timeTracking: 'Fichajes',
  timeEditingPermissions: 'Editar horas empleados',
  analytics: 'Analíticas',
  customization: 'Personalización',
  logoUpload: 'Subir logo',
  api: 'API',
  reminders: 'Recordatorios',
  employee_time_edit_permission: 'Permisos edición tiempo empleados',
} as const;

export default function SuperAdminFeatures() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [changes, setChanges] = useState<Record<string, Partial<Feature>>>({});

  const { data: features, isLoading } = useQuery<Feature[]>({
    queryKey: ['/api/super-admin/features'],
    retry: false,
  });

  const updateFeaturesMutation = useMutation({
    mutationFn: async (updates: Array<{ id: number; data: Partial<Feature> }>) => {
      const promises = updates.map(({ id, data }) =>
        apiRequest(`/api/super-admin/features/${id}`, 'PATCH', data)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Features actualizadas",
        description: "Las configuraciones de features han sido guardadas exitosamente.",
      });
      setChanges({});
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/features'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Error al actualizar features: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleFeatureChange = (featureId: number, plan: 'basic' | 'pro' | 'master', enabled: boolean) => {
    setChanges(prev => ({
      ...prev,
      [featureId]: {
        ...prev[featureId],
        [`${plan}Enabled`]: enabled
      }
    }));
  };

  const saveChanges = () => {
    const updates = Object.entries(changes).map(([featureId, data]) => ({
      id: parseInt(featureId),
      data
    }));

    updateFeaturesMutation.mutate(updates);
  };

  const hasChanges = Object.keys(changes).length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.history.back()}
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Gestión de Features</h1>
                <p className="text-white/70">Configura qué funcionalidades incluye cada plan</p>
              </div>
            </div>
            {hasChanges && (
              <Button
                onClick={saveChanges}
                disabled={updateFeaturesMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {updateFeaturesMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Guardar Cambios
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid gap-6">
          {/* Features Table */}
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Configuración de Features por Plan
              </CardTitle>
              <CardDescription className="text-white/70">
                Activa o desactiva features para cada nivel de suscripción
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Header row */}
              <div className="grid grid-cols-5 gap-4 pb-4 border-b border-white/20">
                <div className="text-white font-medium">Feature</div>
                <div className="text-center">
                  <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-400">
                    Basic
                  </Badge>
                </div>
                <div className="text-center">
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-400">
                    Pro
                  </Badge>
                </div>
                <div className="text-center">
                  <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-400">
                    Master
                  </Badge>
                </div>
                <div className="text-white/70 text-sm">Descripción</div>
              </div>

              {/* Feature rows */}
              {features?.map((feature: Feature) => {
                const IconComponent = featureIcons[feature.key as keyof typeof featureIcons];
                const currentBasic = changes[feature.id]?.basicEnabled ?? feature.basicEnabled;
                const currentPro = changes[feature.id]?.proEnabled ?? feature.proEnabled;
                const currentMaster = changes[feature.id]?.masterEnabled ?? feature.masterEnabled;

                return (
                  <div key={feature.id} className="grid grid-cols-5 gap-4 items-center">
                    <div className="flex items-center gap-3">
                      {IconComponent && <IconComponent className="h-5 w-5 text-white/70" />}
                      <div>
                        <p className="text-white font-medium">
                          {featureLabels[feature.key as keyof typeof featureLabels] || feature.name}
                        </p>
                        <p className="text-white/50 text-sm">{feature.key}</p>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <Switch
                        checked={currentBasic}
                        onCheckedChange={(checked) => 
                          handleFeatureChange(feature.id, 'basic', checked)
                        }
                      />
                    </div>

                    <div className="flex justify-center">
                      <Switch
                        checked={currentPro}
                        onCheckedChange={(checked) => 
                          handleFeatureChange(feature.id, 'pro', checked)
                        }
                      />
                    </div>

                    <div className="flex justify-center">
                      <Switch
                        checked={currentMaster}
                        onCheckedChange={(checked) => 
                          handleFeatureChange(feature.id, 'master', checked)
                        }
                      />
                    </div>

                    <div className="text-white/70 text-sm">
                      {feature.description}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Changes Summary */}
          {hasChanges && (
            <Card className="bg-amber-500/10 backdrop-blur-xl border-amber-400/20">
              <CardHeader>
                <CardTitle className="text-amber-300 text-lg">Cambios Pendientes</CardTitle>
                <CardDescription className="text-amber-200/70">
                  {Object.keys(changes).length} feature(s) con cambios pendientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button
                    onClick={saveChanges}
                    disabled={updateFeaturesMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {updateFeaturesMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Guardar Todo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setChanges({})}
                    className="border-amber-400/50 text-amber-300 hover:bg-amber-500/10"
                  >
                    Descartar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}