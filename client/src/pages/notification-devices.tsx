import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Smartphone, Monitor, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PushSubscription {
  id: number;
  deviceId: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  endpoint: string;
}

function getDeviceName(userAgent: string | null, endpoint: string): { name: string; icon: typeof Smartphone } {
  if (!userAgent) {
    return { name: "Dispositivo desconocido", icon: Smartphone };
  }

  const ua = userAgent.toLowerCase();
  
  if (ua.includes("iphone")) {
    return { name: "iPhone", icon: Smartphone };
  } else if (ua.includes("ipad")) {
    return { name: "iPad", icon: Smartphone };
  } else if (ua.includes("android")) {
    return { name: "Android", icon: Smartphone };
  } else if (ua.includes("macintosh") || ua.includes("mac os")) {
    return { name: "Mac", icon: Monitor };
  } else if (ua.includes("windows")) {
    return { name: "Windows PC", icon: Monitor };
  } else if (ua.includes("linux")) {
    return { name: "Linux", icon: Monitor };
  }
  
  return { name: "Dispositivo desconocido", icon: Smartphone };
}

export default function NotificationDevices() {
  const { toast } = useToast();

  const { data: subscriptions, isLoading } = useQuery<PushSubscription[]>({
    queryKey: ["/api/push/subscriptions"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/push/subscriptions/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/push/subscriptions"] });
      toast({
        title: "Dispositivo eliminado",
        description: "El dispositivo ya no recibirá notificaciones push",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el dispositivo",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="px-6 py-4 min-h-screen bg-gray-50" style={{ overflowX: 'clip' }}>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Dispositivos de Notificación</h1>
          <p className="text-gray-500 mt-1">Cargando dispositivos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50" style={{ overflowX: 'clip' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dispositivos de Notificación</h1>
        <p className="text-gray-500 mt-1">
          Gestiona los dispositivos que reciben notificaciones push
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dispositivos Registrados</CardTitle>
          <CardDescription>
            Estos dispositivos están registrados para recibir notificaciones push. Cada dispositivo recibirá una notificación independiente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!subscriptions || subscriptions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p>No tienes dispositivos registrados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub) => {
                const device = getDeviceName(sub.userAgent, sub.endpoint);
                const Icon = device.icon;
                
                return (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-white"
                    data-testid={`device-${sub.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Icon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900" data-testid={`device-name-${sub.id}`}>
                          {device.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Registrado: {format(new Date(sub.createdAt), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                        {sub.deviceId && (
                          <p className="text-xs text-gray-400 mt-1">
                            ID: {sub.deviceId.substring(0, 24)}...
                          </p>
                        )}
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid={`delete-device-${sub.id}`}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar dispositivo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Este dispositivo dejará de recibir notificaciones push. Puedes volver a registrarlo
                            abriendo la aplicación desde ese dispositivo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(sub.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Importante:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Cada dispositivo registrado recibirá su propia notificación</li>
                  <li>Si solo quieres recibir notificaciones en un dispositivo, elimina los demás</li>
                  <li>Para volver a registrar un dispositivo, simplemente abre la app desde ese dispositivo</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
