import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import FeatureUnavailable from '@/components/feature-unavailable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  MessageSquare, 
  Send, 
  User,
  Clock,
  Check,
  CheckCheck
} from 'lucide-react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  subject: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderName: string;
  senderRole: string;
}

interface Manager {
  id: number;
  fullName: string;
  role: string;
  email: string;
}

export default function EmployeeMessages() {
  const { user, company } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [selectedManager, setSelectedManager] = useState<number | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canAccess = hasAccess('messages');

  if (!canAccess) {
    return <FeatureUnavailable feature="messages" />;
  }

  // Get managers list
  const { data: managers = [] } = useQuery<Manager[]>({
    queryKey: ['/api/managers'],
    enabled: !!user,
  });

  // Get messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/messages'],
    enabled: !!user,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time
    staleTime: 0,
  });

  // Mark message as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return await apiRequest('PATCH', `/api/messages/${messageId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { receiverId: number; subject: string; content: string }) => {
      return await apiRequest('POST', '/api/messages', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
      setMessageContent('');
      setMessageSubject('');
      toast({ title: 'Mensaje enviado correctamente' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al enviar mensaje', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (selectedManager && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, selectedManager]);

  // Mark messages as read when opening conversation
  useEffect(() => {
    if (selectedManager) {
      const unreadMessages = messages.filter(
        msg => msg.senderId === selectedManager && !msg.isRead
      );
      unreadMessages.forEach(msg => {
        if (!msg.isRead) {
          markAsReadMutation.mutate(msg.id);
        }
      });
    }
  }, [selectedManager, messages]);

  const handleSendMessage = () => {
    if (!selectedManager || !messageContent.trim()) return;

    sendMessageMutation.mutate({
      receiverId: selectedManager,
      subject: messageSubject.trim() || 'Sin asunto',
      content: messageContent.trim()
    });
  };

  const getMessagesWithManager = (managerId: number) => {
    return messages.filter(
      msg => 
        (msg.senderId === managerId && msg.receiverId === user?.id) ||
        (msg.senderId === user?.id && msg.receiverId === managerId)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const getUnreadCount = (managerId: number) => {
    return messages.filter(
      msg => msg.senderId === managerId && msg.receiverId === user?.id && !msg.isRead
    ).length;
  };

  const getMessageStatus = (message: Message) => {
    if (message.senderId === user?.id) {
      // Message sent by employee
      return message.isRead ? (
        <CheckCheck className="w-4 h-4 text-green-400" />
      ) : (
        <Check className="w-4 h-4 text-gray-400" />
      );
    }
    return null;
  };

  if (!selectedManager) {
    return (
      <div className="h-screen bg-employee-gradient text-white flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const urlParts = window.location.pathname.split('/').filter(part => part.length > 0);
                  const companyAlias = urlParts[0] || company?.companyAlias || 'test';
                  setLocation(`/${companyAlias}`);
                }}
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Mensajes</h1>
                <p className="text-white/70 text-sm">Comunícate con tus responsables</p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            {/* Managers list */}
            <div className="mt-6 space-y-3">
              {managers.length === 0 ? (
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-white/40 mx-auto mb-3" />
                    <p className="text-white/70">No hay responsables disponibles para contactar</p>
                  </CardContent>
                </Card>
              ) : (
                managers.map((manager) => {
                  const unreadCount = getUnreadCount(manager.id);
                  const lastMessage = getMessagesWithManager(manager.id).slice(-1)[0];
                  
                  return (
                    <Card 
                      key={manager.id} 
                      className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => setSelectedManager(manager.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                              <User className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-medium text-white">{manager.fullName}</h3>
                              <p className="text-sm text-white/60 capitalize">{manager.role}</p>
                              {lastMessage && (
                                <p className="text-xs text-white/50 mt-1 truncate max-w-48">
                                  {lastMessage.senderId === user?.id ? 'Tú: ' : ''}
                                  {lastMessage.content}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {lastMessage && (
                              <span className="text-xs text-white/50">
                                {format(new Date(lastMessage.createdAt), 'HH:mm')}
                              </span>
                            )}
                            {unreadCount > 0 && (
                              <div className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
                                {unreadCount}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedManagerData = managers.find(m => m.id === selectedManager);
  const conversationMessages = getMessagesWithManager(selectedManager);

  return (
    <div className="h-screen bg-employee-gradient text-white flex flex-col overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedManager(null)}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-medium text-white">{selectedManagerData?.fullName}</h2>
            <p className="text-sm text-white/60 capitalize">{selectedManagerData?.role}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversationMessages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-white/40 mx-auto mb-3" />
            <p className="text-white/70">No hay mensajes en esta conversación</p>
            <p className="text-white/50 text-sm">Envía el primer mensaje</p>
          </div>
        ) : (
          conversationMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.senderId === user?.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white'
                }`}
              >
                <div className="flex flex-col">
                  <p className="text-sm">{message.content}</p>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <span className="text-xs opacity-70">
                      {format(new Date(message.createdAt), 'HH:mm')}
                    </span>
                    {getMessageStatus(message)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Asunto (opcional)"
              value={messageSubject}
              onChange={(e) => setMessageSubject(e.target.value)}
              className="mb-2 bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
            <Textarea
              placeholder="Escribe tu mensaje..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!messageContent.trim() || sendMessageMutation.isPending}
            className="self-end bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}