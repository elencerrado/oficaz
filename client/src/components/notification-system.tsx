import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Bell, FileText, MessageSquare, Calendar, Clock, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SystemNotification {
  id: number;
  userId: number;
  type: string;
  category: string;
  title: string;
  message: string;
  actionUrl: string | null;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high';
  isRead: boolean;
  isCompleted: boolean;
  metadata: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

const priorityColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800'
};

const categoryIcons = {
  documents: FileText,
  messages: MessageSquare,
  vacations: Calendar,
  system: AlertCircle,
  reminders: Clock,
  'time-tracking': Clock
};

const categoryNames = {
  documents: 'Documentos',
  messages: 'Mensajes',
  vacations: 'Vacaciones',
  system: 'Sistema',
  reminders: 'Recordatorios',
  'time-tracking': 'Fichajes'
};

export function NotificationSystem() {
  const queryClient = useQueryClient();

  // Fetch all notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    }
  });

  // Fetch unread count - WebSocket handles real-time updates for most notifications
  const { data: unreadData } = useQuery({
    queryKey: ['/api/notifications/unread-count'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch unread count');
      return response.json();
    },
    staleTime: 60000, // Cache for 1 min - WebSocket invalidates on real events
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    }
  });

  // Mark as completed mutation
  const markAsCompletedMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/notifications/${id}/complete`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to mark as completed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    }
  });

  const handleMarkAsRead = (id: number) => {
    markAsReadMutation.mutate(id);
  };

  const handleMarkAsCompleted = (id: number) => {
    markAsCompletedMutation.mutate(id);
  };

  const handleActionClick = (notification: SystemNotification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  // Group notifications by category
  const notificationsByCategory = notifications.reduce((acc: Record<string, SystemNotification[]>, notification: SystemNotification) => {
    if (!acc[notification.category]) {
      acc[notification.category] = [];
    }
    acc[notification.category].push(notification);
    return acc;
  }, {} as Record<string, SystemNotification[]>);

  const categories = Object.keys(notificationsByCategory);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          {unreadData && unreadData.count > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadData.count} nuevas
            </Badge>
          )}
        </div>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes notificaciones
            </h3>
            <p className="text-gray-600 text-center">
              Cuando tengas nuevas notificaciones aparecerán aquí
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={categories[0]} className="w-full">
          <TabsList className="grid w-full grid-cols-auto gap-1">
            {categories.map((category) => {
              const IconComponent = categoryIcons[category as keyof typeof categoryIcons] || AlertCircle;
              const categoryNotifications = notificationsByCategory[category];
              const unreadCount = categoryNotifications.filter((n: SystemNotification) => !n.isRead).length;
              
              return (
                <TabsTrigger key={category} value={category} className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4" />
                  <span>{categoryNames[category as keyof typeof categoryNames] || category}</span>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category} value={category}>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {notificationsByCategory[category].map((notification: SystemNotification) => {
                    const IconComponent = categoryIcons[notification.category as keyof typeof categoryIcons] || AlertCircle;
                    
                    return (
                      <Card 
                        key={notification.id} 
                        className={`transition-all hover:shadow-md ${
                          !notification.isRead ? 'border-blue-200 bg-blue-50/30' : ''
                        } ${notification.isCompleted ? 'opacity-60' : ''}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                !notification.isRead ? 'bg-blue-100' : 'bg-gray-100'
                              }`}>
                                <IconComponent className={`h-4 w-4 ${
                                  !notification.isRead ? 'text-blue-600' : 'text-gray-600'
                                }`} />
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-lg mb-1">
                                  {notification.title}
                                  {!notification.isRead && (
                                    <span className="ml-2 h-2 w-2 bg-blue-600 rounded-full inline-block"></span>
                                  )}
                                </CardTitle>
                                <CardDescription className="text-sm">
                                  {format(new Date(notification.createdAt), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={priorityColors[notification.priority as keyof typeof priorityColors]}>
                                {notification.priority === 'high' ? 'Alta' : 
                                 notification.priority === 'medium' ? 'Media' : 'Baja'}
                              </Badge>
                              {notification.isCompleted && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Completado
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-700 mb-4">{notification.message}</p>
                          
                          {notification.dueDate && (
                            <div className="flex items-center gap-2 text-sm text-orange-600 mb-4">
                              <Clock className="h-4 w-4" />
                              <span>
                                Fecha límite: {format(new Date(notification.dueDate), "d 'de' MMMM, yyyy", { locale: es })}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            {!notification.isCompleted && notification.actionUrl && (
                              <Button 
                                onClick={() => handleActionClick(notification)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Realizar Acción
                              </Button>
                            )}
                            
                            {!notification.isRead && (
                              <Button 
                                variant="outline" 
                                onClick={() => handleMarkAsRead(notification.id)}
                                disabled={markAsReadMutation.isPending}
                              >
                                Marcar como Leído
                              </Button>
                            )}
                            
                            {!notification.isCompleted && (
                              <Button 
                                variant="outline" 
                                onClick={() => handleMarkAsCompleted(notification.id)}
                                disabled={markAsCompletedMutation.isPending}
                              >
                                Marcar como Completado
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}