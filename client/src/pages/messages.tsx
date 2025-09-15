import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { usePageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { 
  Send, 
  ArrowLeft,
  User,
  Bell,
  MessageCircle,
  MessageSquare,
  FileText,
  Clock,
  CheckCircle2,
  Check,
  Search,
  Users,
  X
} from 'lucide-react';
import { PageLoading } from '@/components/ui/page-loading';
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

interface Employee {
  id: number;
  fullName: string;
  role: string;
  email?: string;
  jobTitle?: string;
  position?: string;
}

export default function Messages() {
  const { user, company } = useAuth();
  const { hasAccess, getRequiredPlan } = useFeatureCheck();
  const { setHeader, resetHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setHeader({
      title: 'Mensajes',
      subtitle: 'Comunicación interna entre empleados y administradores'
    });
    return resetHeader;
  }, []);
  
  // Check if user has access to messages feature
  if (!hasAccess('messages')) {
    return (
      <FeatureRestrictedPage
        featureName="Mensajes"
        description="Comunicación interna entre empleados y administradores"
        requiredPlan={getRequiredPlan('messages')}
        icon={MessageSquare}
      />
    );
  }

  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const urlParts = location.split('/').filter(part => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';

  // Check for URL parameters to open specific chat
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const chatParam = urlParams.get('chat');
    if (chatParam) {
      const chatId = parseInt(chatParam);
      if (!isNaN(chatId)) {
        setSelectedChat(chatId);
      }
    }
  }, []);

  // Register page visit for notifications clearing
  useEffect(() => {
    if (user) {
      const now = new Date().toISOString();
      localStorage.setItem('lastMessagesPageVisit', now);
      console.log('💬 Messages page visited at:', now);
    }
  }, [user]);

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/messages'],
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 10000,
  });

  const { data: managers } = useQuery({
    queryKey: ['/api/managers'],
    enabled: !!user && user.role === 'employee',
    staleTime: 60000,
  });

  const { data: employees } = useQuery({
    queryKey: ['/api/employees'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager'),
    staleTime: 60000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { receiverId: number; subject: string; content: string }) => {
      return apiRequest('POST', '/api/messages', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      setNewMessage('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest('PATCH', `/api/messages/${messageId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
  });

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    sendMessageMutation.mutate({
      receiverId: selectedChat,
      subject: 'Mensaje',
      content: newMessage
    });
  };

  // Filter messages for selected chat
  const filteredMessages = (messages as Message[] || []).filter(
    (message) => 
      (message.senderId === selectedChat && message.receiverId === user?.id) ||
      (message.senderId === user?.id && message.receiverId === selectedChat)
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Get available contacts based on role
  const availableContacts = user?.role === 'employee' 
    ? (managers || [])
    : (employees || []);

  // Filter contacts by search term
  const filteredContacts = availableContacts.filter((contact) =>
    contact.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredMessages]);

  // Mark messages as read when chat is selected
  useEffect(() => {
    if (selectedChat && filteredMessages.length > 0) {
      const unreadMessages = filteredMessages.filter(
        (msg) => !msg.isRead && msg.senderId === selectedChat
      );
      
      unreadMessages.forEach((msg) => {
        markAsReadMutation.mutate(msg.id);
      });
    }
  }, [selectedChat, filteredMessages]);

  if (messagesLoading) {
    return <PageLoading message="Cargando mensajes..." />;
  }

  // Admin/Manager view - Simple layout without complex scroll behavior
  if (user?.role === 'admin' || user?.role === 'manager') {
    return (
      <div>
        {!selectedChat ? (
          // Contact list view
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Buscar contacto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
            
            <div className="grid gap-4">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted"
                  onClick={() => setSelectedChat(contact.id)}
                >
                  <div className="flex items-center space-x-3">
                    <UserAvatar 
                      fullName={contact.fullName} 
                      size="md" 
                      userId={contact.id}
                    />
                    <div>
                      <p className="font-medium">{contact.fullName}</p>
                      <p className="text-sm text-muted-foreground">{contact.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Chat view - Simple layout without scroll issues
          <div className="space-y-4">
            <div className="flex items-center space-x-3 border-b pb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedChat(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <div className="flex items-center space-x-2">
                <UserAvatar 
                  fullName={filteredContacts.find(c => c.id === selectedChat)?.fullName || 'Usuario'}
                  size="sm" 
                  userId={selectedChat}
                />
                <span className="font-medium">
                  {filteredContacts.find(c => c.id === selectedChat)?.fullName || 'Usuario'}
                </span>
              </div>
            </div>

            {/* Messages - Simple container without fixed heights */}
            <div className="space-y-4 min-h-96">
              {filteredMessages.length > 0 ? (
                filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        message.senderId === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs opacity-70">
                          {format(new Date(message.createdAt), 'HH:mm')}
                        </p>
                        {message.senderId === user?.id && (
                          <Check className="h-3 w-3 opacity-70" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay mensajes aún</p>
                  <p className="text-sm">Envía el primer mensaje para comenzar la conversación</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input - Simple without complex positioning */}
            <div className="flex space-x-2 pt-4 border-t">
              <Input
                ref={messageInputRef}
                placeholder="Escribe tu mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Employee view - Simple interface
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-4">Mis Mensajes</h2>
        
        {!selectedChat ? (
          <div className="space-y-4">
            {(managers || []).map((manager) => (
              <div
                key={manager.id}
                className="p-4 border rounded-lg cursor-pointer hover:bg-muted"
                onClick={() => setSelectedChat(manager.id)}
              >
                <div className="flex items-center space-x-3">
                  <UserAvatar 
                    fullName={manager.fullName} 
                    size="md" 
                    userId={manager.id}
                  />
                  <div>
                    <p className="font-medium">{manager.fullName}</p>
                    <p className="text-sm text-muted-foreground">Manager</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 border-b pb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedChat(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <div className="flex items-center space-x-2">
                <UserAvatar 
                  fullName={(managers || []).find(m => m.id === selectedChat)?.fullName || 'Manager'}
                  size="sm" 
                  userId={selectedChat}
                />
                <span className="font-medium">
                  {(managers || []).find(m => m.id === selectedChat)?.fullName || 'Manager'}
                </span>
              </div>
            </div>

            <div className="space-y-4 min-h-96">
              {filteredMessages.length > 0 ? (
                filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        message.senderId === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs opacity-70">
                          {format(new Date(message.createdAt), 'HH:mm')}
                        </p>
                        {message.senderId === user?.id && (
                          <Check className="h-3 w-3 opacity-70" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay mensajes aún</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex space-x-2 pt-4 border-t">
              <Input
                ref={messageInputRef}
                placeholder="Escribe tu mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}