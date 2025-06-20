import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Send, 
  ArrowLeft,
  User,
  Bell,
  MessageCircle,
  FileText,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation, Link } from 'wouter';

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  subject: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string;
  type?: 'notification' | 'message';
}

interface Manager {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

export default function Messages() {
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { user, company } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const companyAlias = location.split('/')[1] || 'test';

  const { data: messages, isLoading } = useQuery({
    queryKey: ['/api/messages'],
    refetchInterval: 10000, // Refetch every 10 seconds for real-time feel
  });

  const { data: managers } = useQuery({
    queryKey: ['/api/managers'],
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: { receiverId: number; subject: string; content: string }) => 
      apiRequest('POST', '/api/messages', data),
    onSuccess: () => {
      setNewMessage('');
      toast({
        title: "Mensaje enviado",
        description: "Tu mensaje ha sido enviado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: (messageId: number) => 
      apiRequest('PATCH', `/api/messages/${messageId}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChat]);

  // Mark messages as read when selected
  useEffect(() => {
    if (selectedChat && messages) {
      const unreadMessages = (messages as Message[]).filter(
        msg => !msg.isRead && msg.senderId === selectedChat && msg.receiverId === user?.id
      );
      unreadMessages.forEach(msg => {
        markAsReadMutation.mutate(msg.id);
      });
    }
  }, [selectedChat, messages, user?.id]);

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'payroll':
        return <FileText className="h-4 w-4 text-green-400" />;
      case 'reminder':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'document':
        return <FileText className="h-4 w-4 text-blue-400" />;
      default:
        return <MessageCircle className="h-4 w-4 text-blue-400" />;
    }
  };

  const getNotificationMessage = (subject: string) => {
    if (subject.includes('nómina')) return 'Nueva nómina disponible';
    if (subject.includes('documento')) return 'Actualizar documentación';
    if (subject.includes('fichaje')) return 'Recordatorio de fichaje';
    return subject;
  };

  const handleSendMessage = (managerId: number) => {
    if (!newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      receiverId: managerId,
      subject: 'Mensaje del empleado',
      content: newMessage.trim()
    });
  };

  const getChatMessages = (managerId: number) => {
    if (!messages) return [];
    return (messages as Message[]).filter(
      msg => (msg.senderId === managerId && msg.receiverId === user?.id) ||
             (msg.senderId === user?.id && msg.receiverId === managerId)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-employee-gradient flex items-center justify-center">
        <div className="text-white">Cargando mensajes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-employee-gradient text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <Link href={`/${companyAlias}/dashboard`}>
          <Button
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/20 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm transition-all duration-200 transform hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex-1 flex flex-col items-end text-right">
          <h2 className="text-lg font-semibold text-white">{company?.name}</h2>
          <p className="text-sm text-white/70">{user?.fullName}</p>
        </div>
      </div>

      {/* Page Title */}
      <div className="px-6 pb-6">
        <h1 className="text-2xl font-bold text-white">Mensajes</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {!selectedChat ? (
          // Chat List View
          <div className="flex-1 px-6">
            {/* Notifications Section */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Notificaciones del Sistema
              </h3>
              <div className="space-y-3">
                {(messages as Message[] || [])
                  .filter(msg => msg.subject.includes('nómina') || msg.subject.includes('documento') || msg.subject.includes('fichaje'))
                  .slice(0, 3)
                  .map(msg => (
                    <div key={msg.id} className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                      <div className="flex items-start space-x-3">
                        {getMessageIcon(msg.subject.includes('nómina') ? 'payroll' : 
                                       msg.subject.includes('documento') ? 'document' : 'reminder')}
                        <div className="flex-1">
                          <p className="text-white font-medium">{getNotificationMessage(msg.subject)}</p>
                          <p className="text-white/70 text-sm mt-1">{msg.content}</p>
                          <p className="text-white/50 text-xs mt-2">
                            {format(new Date(msg.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </p>
                        </div>
                        {!msg.isRead && (
                          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Managers Section */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Tu Manager
              </h3>
              <div className="space-y-3">
                {(managers as Manager[] || []).map(manager => {
                  const unreadCount = (messages as Message[] || []).filter(
                    msg => !msg.isRead && msg.senderId === manager.id && msg.receiverId === user?.id
                  ).length;
                  
                  return (
                    <div
                      key={manager.id}
                      onClick={() => setSelectedChat(manager.id)}
                      className="bg-white/10 rounded-lg p-4 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-12 w-12 bg-blue-500">
                          <AvatarFallback className="bg-blue-500 text-white font-semibold">
                            {manager.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-white font-medium">{manager.fullName}</p>
                          <p className="text-white/70 text-sm capitalize">{manager.role}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="h-5 w-5 text-blue-400" />
                          {unreadCount > 0 && (
                            <div className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                              {unreadCount}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          // Chat View
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="bg-white/10 backdrop-blur-sm p-4 flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedChat(null)}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8 bg-blue-500">
                <AvatarFallback className="bg-blue-500 text-white text-sm">
                  {(managers as Manager[] || []).find(m => m.id === selectedChat)?.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-medium">
                  {(managers as Manager[] || []).find(m => m.id === selectedChat)?.fullName}
                </p>
                <p className="text-white/70 text-xs">
                  {(managers as Manager[] || []).find(m => m.id === selectedChat)?.role}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {getChatMessages(selectedChat).map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      msg.senderId === user?.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <p className={`text-xs mt-1 ${
                      msg.senderId === user?.id ? 'text-blue-100' : 'text-white/70'
                    }`}>
                      {format(new Date(msg.createdAt), 'HH:mm', { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white/10 backdrop-blur-sm">
              <div className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1 bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-lg"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(selectedChat);
                    }
                  }}
                />
                <Button
                  onClick={() => handleSendMessage(selectedChat)}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}