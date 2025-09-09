import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  X,
  Plus,
  ChevronRight
} from 'lucide-react';
import { PageLoading } from '@/components/ui/page-loading';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation, Link } from 'wouter';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message as ChatScopeMessage,
  MessageInput,
  ConversationHeader,
  Avatar,
  TypingIndicator
} from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  subject: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface Employee {
  id: number;
  fullName: string;
  role: string;
  email?: string;
  jobTitle?: string;
  position?: string;
  profilePicture?: string;
}

interface Manager {
  id: number;
  fullName: string;
  role: string;
  email?: string;
  jobTitle?: string;
  position?: string;
  profilePicture?: string;
}

interface MessageGroup {
  date: string;
  dateFormatted: string;
  messages: Message[];
}

export default function Messages() {
  const { user, company } = useAuth();
  const { hasAccess, getRequiredPlan } = useFeatureCheck();
  
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
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const companyAlias = location.split('/')[1];

  // All state declarations together - FIXED ORDER
  const [selectedChat, setSelectedChat] = useState<number | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const chatParam = urlParams.get('chat');
    if (chatParam) {
      const chatId = parseInt(chatParam);
      console.log('Found chat parameter in URL:', chatId);
      window.history.replaceState({}, '', window.location.pathname);
      return chatId;
    }
    return null;
  });
  const [newMessage, setNewMessage] = useState("");
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddChatModal, setShowAddChatModal] = useState(false);
  const [modalGroupMode, setModalGroupMode] = useState(false);
  const [modalSelectedEmployees, setModalSelectedEmployees] = useState<number[]>([]);
  const [modalMessage, setModalMessage] = useState('');
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // All refs together
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const markedAsReadRef = useRef<Set<number>>(new Set());

  // Hook para manejar altura del viewport en iOS Safari
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );

  useEffect(() => {
    function updateHeight() {
      const height = window.visualViewport 
        ? window.visualViewport.height 
        : window.innerHeight;
      
      // Set CSS custom property for use in styles
      document.documentElement.style.setProperty('--viewport-height', `${height}px`);
      setViewportHeight(height);
    }

    updateHeight(); // Initial call

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateHeight);
      window.visualViewport.addEventListener('scroll', updateHeight);
    }
    
    window.addEventListener('resize', updateHeight);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateHeight);
        window.visualViewport.removeEventListener('scroll', updateHeight);
      }
      window.removeEventListener('resize', updateHeight);
    };
  }, []);




  // All queries together
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

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { receiverId: number; content: string }) => {
      return await apiRequest('POST', '/api/messages', data);
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    },
    onError: (error: any) => {
      console.error('Error sending message:', error);
      toast({ 
        title: "Error", 
        description: "No se pudo enviar el mensaje",
        variant: "destructive" 
      });
    }
  });

  const sendGroupMessageMutation = useMutation({
    mutationFn: async (data: { receiverIds: number[]; content: string }) => {
      return await apiRequest('POST', '/api/messages/group', data);
    },
    onSuccess: () => {
      setModalMessage('');
      setModalSelectedEmployees([]);
      setShowAddChatModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      toast({ description: "Mensaje grupal enviado correctamente" });
    },
    onError: (error: any) => {
      console.error('Error sending group message:', error);
      toast({ 
        title: "Error", 
        description: "No se pudo enviar el mensaje grupal",
        variant: "destructive" 
      });
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return await apiRequest('PATCH', `/api/messages/${messageId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    }
  });

  // Helper functions
  const filteredEmployees = useMemo(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      return (employees as Employee[] || []).filter(employee => 
        employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) && employee.id !== user?.id
      );
    } else {
      return (managers as Manager[] || []).filter(manager => 
        manager.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  }, [employees, managers, searchTerm, user]);

  const filteredModalEmployees = useMemo(() => {
    return (employees as Employee[] || []).filter(employee => 
      employee.fullName?.toLowerCase().includes(modalSearchTerm.toLowerCase()) && employee.id !== user?.id
    );
  }, [employees, modalSearchTerm, user]);

  const selectedChatUser = useMemo(() => {
    if (!selectedChat) return null;
    return filteredEmployees.find(emp => emp.id === selectedChat);
  }, [selectedChat, filteredEmployees]);

  const chatMessages = useMemo(() => {
    if (!selectedChat || !messages) return [];
    return (messages as Message[]).filter(msg => 
      (msg.senderId === selectedChat && msg.receiverId === user?.id) ||
      (msg.senderId === user?.id && msg.receiverId === selectedChat)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [selectedChat, messages, user]);


  // Group messages by date
  const messagesGroupedByDate = useMemo(() => {
    const groups: { [key: string]: Message[] } = {};
    
    chatMessages.forEach(message => {
      const date = format(new Date(message.createdAt), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });

    return Object.entries(groups).map(([date, msgs]) => ({
      date,
      dateFormatted: format(new Date(date), 'dd MMM yyyy', { locale: es }),
      messages: msgs
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [chatMessages]);

  const getRoleDisplay = (employee: Employee | Manager | null) => {
    if (!employee) return '';
    return employee.position || (() => {
      const role = employee.role || 'employee';
      const roleDescriptions = {
        admin: 'Director General',
        manager: 'Responsable', 
        employee: 'Empleado'
      };
      return roleDescriptions[role as keyof typeof roleDescriptions] || 'Empleado';
    })();
  };

  // Scroll functions
  const scrollToBottom = useCallback(() => {
    // Desktop: Force scroll on container
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
    
    // Mobile: Use scrollIntoView
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  // Mark messages as read when viewing chat
  useEffect(() => {
    if (selectedChat && chatMessages.length > 0) {
      const unreadMessages = chatMessages.filter(msg => 
        !msg.isRead && 
        msg.senderId === selectedChat && 
        msg.receiverId === user?.id &&
        !markedAsReadRef.current.has(msg.id)
      );
      
      unreadMessages.forEach(msg => {
        markedAsReadRef.current.add(msg.id);
        markAsReadMutation.mutate(msg.id);
      });
    }
  }, [selectedChat, chatMessages, user]);

  // Clean up marked as read refs when changing chats
  useEffect(() => {
    markedAsReadRef.current.clear();
  }, [selectedChat]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (selectedChat && chatMessages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [chatMessages.length, scrollToBottom]);

  // Auto-scroll when selecting a chat (ensure we see the latest message)
  useEffect(() => {
    if (selectedChat && chatMessages.length > 0) {
      // Multiple attempts to ensure scroll works
      setTimeout(() => scrollToBottom(), 100);
      setTimeout(() => scrollToBottom(), 300);
      setTimeout(() => scrollToBottom(), 500);
    }
  }, [selectedChat]);

  // Send message functions
  const sendMessage = useCallback(() => {
    if (!newMessage.trim() || !selectedChat) return;
    
    sendMessageMutation.mutate({
      receiverId: selectedChat,
      content: newMessage.trim()
    });
  }, [newMessage, selectedChat]);

  const sendModalGroupMessage = useCallback(() => {
    if (!modalMessage.trim() || modalSelectedEmployees.length === 0) {
      toast({ 
        title: "Error", 
        description: "Selecciona empleados y escribe un mensaje",
        variant: "destructive" 
      });
      return;
    }

    sendGroupMessageMutation.mutate({
      receiverIds: modalSelectedEmployees,
      content: modalMessage.trim()
    });
  }, [modalMessage, modalSelectedEmployees, sendGroupMessageMutation, toast]);

  const handleSendEmployeeMessage = useCallback(() => {
    sendMessage();
  }, [sendMessage]);

  // Loading state
  if (messagesLoading) {
    return <PageLoading />;
  }

  const isEmployee = user?.role === 'employee';

  return (
    <>
      {/* Admin Layout - Patrón consistente */}
      {!isEmployee && (
        <div className="px-6 py-4 min-h-screen bg-background" style={{ overflowX: 'clip' }}>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Mensajes</h1>
            <p className="text-muted-foreground mt-1">
              Comunícate con tu equipo y gestiona conversaciones.
            </p>
          </div>
          
          {/* Desktop Layout */}
          <div className="hidden lg:flex w-full h-[calc(100vh-200px)]">
            <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden flex w-full">
              {/* Sidebar */}
              <div className="w-1/3 border-r border-border flex flex-col h-full">
              {/* Header sin línea - búsqueda y botón en la misma línea */}
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Buscar conversaciones..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <Button
                      onClick={() => setShowAddChatModal(true)}
                      size="sm"
                      className="btn-oficaz-primary flex-shrink-0"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Nuevo
                    </Button>
                  )}
                </div>
              </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-2 p-4">
              {filteredEmployees.map((employee) => {
                const unreadCount = (messages as Message[] || []).filter(msg => 
                  !msg.isRead && msg.senderId === employee.id && msg.receiverId === user?.id
                ).length;
                
                return (
                  <div
                    key={employee.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:bg-muted ${
                      selectedChat === employee.id ? 'bg-muted border-primary' : 'bg-card border-border'
                    }`}
                    onClick={() => setSelectedChat(employee.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <UserAvatar 
                        fullName={employee.fullName || ''} 
                        size="md" 
                        userId={employee.id}
                        profilePicture={employee.profilePicture}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground truncate">
                            {employee.fullName}
                          </p>
                          {unreadCount > 0 && (
                            <div className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                              {unreadCount}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {getRoleDisplay(employee)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
            </div>

            {/* Chat Area - Solo para escritorio */}
            <div className="flex-1 flex flex-col h-full">
              {selectedChat && selectedChatUser ? (
                <div className="flex flex-col h-full">
                  {/* Desktop header */}
                  <div className="flex items-center space-x-3 p-4 border-b border-border flex-shrink-0">
                <UserAvatar 
                  fullName={selectedChatUser.fullName || ''} 
                  size="sm" 
                  userId={selectedChatUser.id}
                  profilePicture={selectedChatUser.profilePicture}
                />
                <div>
                  <h3 className="font-semibold text-foreground">
                    {selectedChatUser.fullName}
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    {getRoleDisplay(selectedChatUser || null)}
                  </div>
                </div>
              </div>
              
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4" ref={messagesContainerRef}>
                {messagesGroupedByDate.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center justify-center my-4">
                      <div className="bg-muted/50 text-muted-foreground text-xs px-3 py-1 rounded-full font-medium">
                        {group.dateFormatted}
                      </div>
                    </div>
                    
                    {/* Messages */}
                    {group.messages.map((message) => (
                      <div key={message.id} className={`mb-3 flex ${
                        message.senderId === user?.id ? 'justify-end' : 'justify-start'
                      }`}>
                        <div className={`max-w-[70%] px-3 py-2 rounded-lg ${
                          message.senderId === user?.id 
                            ? 'bg-primary text-primary-foreground rounded-br-sm' 
                            : 'bg-muted text-foreground rounded-bl-sm'
                        }`}>
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          <div className="flex items-center justify-between mt-1 text-xs opacity-70">
                            <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                            {message.senderId === user?.id && (
                              <div className="ml-2">
                                {(user?.role === 'admin' || user?.role === 'manager') ? (
                                  message.isRead ? (
                                    <div className="flex items-center text-green-200">
                                      <Check className="h-3 w-3" />
                                      <Check className="h-3 w-3 -ml-1" />
                                    </div>
                                  ) : (
                                    <Check className="h-3 w-3 text-green-200" />
                                  )
                                ) : (
                                  <Check className="h-3 w-3 text-green-200" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {/* Elemento para scroll automático */}
                <div ref={messagesEndRef} />
              </div>
                  
                  {/* Input area */}
                  <div className="p-4 border-t border-border flex-shrink-0">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Escribe tu mensaje..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        disabled={sendMessageMutation.isPending}
                        className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <Button
                        onClick={() => sendMessage()}
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground p-2"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-muted/30">
                  <div className="text-center">
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      Selecciona una conversación
                    </h3>
                    <p className="text-muted-foreground">
                      Elige un contacto para comenzar a chatear
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

          {/* Mobile Layout */}
          <div className="lg:hidden w-full h-full">
            {!selectedChat ? (
              /* Contact List View */
              <div className={`w-full h-full flex flex-col ${
                isEmployee ? 'bg-employee-gradient' : 'bg-background'
              }`}>
            {/* Header */}
            <div 
              className={`flex items-center justify-between p-6 pb-8 h-20 ${
                isEmployee ? '' : 'border-b border-border bg-background'
              }`}
              style={{
                paddingTop: `calc(24px + env(safe-area-inset-top, 0px))`
              }}
            >
              {isEmployee ? (
                <>
                  <Link href={`/${companyAlias}/inicio`}>
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
                    <div className="text-white text-sm font-medium mb-1">
                      {company?.name || 'Mi Empresa'}
                    </div>
                    <div className="text-white/70 text-xs">
                      {user?.fullName}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold text-foreground">
                    Mensajes
                  </h1>
                  <Button
                    onClick={() => setShowAddChatModal(true)}
                    size="sm"
                    className="btn-oficaz-primary"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nuevo
                  </Button>
                </>
              )}
            </div>

            {/* Page Title for Employee */}
            {isEmployee && (
              <div className="px-6 pb-6">
                <h1 className="text-3xl font-bold text-white mb-2">Mensajes</h1>
                <p className="text-white/70 text-sm">
                  Comunicación con la dirección
                </p>
              </div>
            )}

            {/* Search Bar */}
            <div className={`px-6 ${isEmployee ? 'pb-6' : 'pb-4'}`}>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                  isEmployee ? 'text-white/50' : 'text-muted-foreground'
                }`} />
                <Input
                  placeholder="Buscar conversaciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-9 ${
                    isEmployee 
                      ? 'bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-white/40' 
                      : ''
                  }`}
                />
              </div>
            </div>

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-3 p-4">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => {
                    const unreadCount = (messages as Message[] || []).filter(msg => 
                      !msg.isRead && msg.senderId === employee.id && msg.receiverId === user?.id
                    ).length;
                    
                    return (
                      <div
                        key={employee.id}
                        className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 border ${
                          isEmployee 
                            ? 'bg-white/10 backdrop-blur-sm hover:bg-white/15 border-white/10' 
                            : 'bg-card hover:bg-muted border-border'
                        }`}
                        onClick={() => setSelectedChat(employee.id)}
                      >
                        <div className="flex items-center space-x-4">
                          <UserAvatar 
                            fullName={employee.fullName || ''} 
                            size="md" 
                            userId={employee.id}
                            profilePicture={employee.profilePicture}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`font-medium truncate ${
                                isEmployee ? 'text-white' : 'text-foreground'
                              }`}>
                                {employee.fullName}
                              </p>
                              {unreadCount > 0 && (
                                <div className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                                  {unreadCount}
                                </div>
                              )}
                            </div>
                            <div className={`text-xs mt-1 ${
                              isEmployee ? 'text-white/70' : 'text-muted-foreground'
                            }`}>
                              {getRoleDisplay(employee)}
                            </div>
                          </div>
                          
                          <ChevronRight className={`w-5 h-5 ${
                            isEmployee ? 'text-white/50' : 'text-muted-foreground'
                          }`} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${
                      isEmployee ? 'bg-white/10' : 'bg-muted'
                    }`}>
                      <Users className={`w-8 h-8 ${
                        isEmployee ? 'text-white/50' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <p className={isEmployee ? 'text-white/70' : 'text-muted-foreground'}>
                      {isEmployee ? 'No hay responsables disponibles' : 'No hay empleados disponibles'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Chat simple y funcional - SIN complicaciones */
          <div className="simple-chat-container">
            {/* Header simple */}
            <div className="simple-chat-header">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedChat(null)}
                className="p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <UserAvatar 
                fullName={selectedChatUser?.fullName || ''} 
                size="sm" 
                userId={selectedChatUser?.id}
                profilePicture={selectedChatUser?.profilePicture}
              />
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-foreground">
                  {selectedChatUser?.fullName}
                </h3>
                <div className="text-xs text-muted-foreground">
                  {getRoleDisplay(selectedChatUser || null)}
                </div>
              </div>
            </div>

            {/* Mensajes */}
            <div className="simple-chat-messages" ref={messagesContainerRef}>
              {messagesGroupedByDate.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-muted/50 text-muted-foreground text-xs px-3 py-1 rounded-full font-medium">
                      {group.dateFormatted}
                    </div>
                  </div>
                  
                  {group.messages.map((message) => (
                    <div key={message.id} className={`mb-3 flex ${
                      message.senderId === user?.id ? 'justify-end' : 'justify-start'
                    }`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-lg ${
                        message.senderId === user?.id 
                          ? 'bg-primary text-primary-foreground rounded-br-sm' 
                          : 'bg-muted text-foreground rounded-bl-sm'
                      }`}>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        <div className="flex items-center justify-between mt-1 text-xs opacity-70">
                          <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                          {message.senderId === user?.id && (
                            <div className="ml-2">
                              <Check className="h-3 w-3 text-green-200" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input simple */}
            <div className="simple-chat-input">
              <input
                type="text"
                placeholder="Escribe tu mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    isEmployee ? handleSendEmployeeMessage() : sendMessage();
                  }
                }}
                disabled={sendMessageMutation.isPending}
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground"
                style={{ fontSize: '16px' }}
              />
              <Button
                onClick={() => isEmployee ? handleSendEmployeeMessage() : sendMessage()}
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground p-2 ml-2"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
            )}
          </div>
        </div>
      )}
      
      {/* Employee Layout - FORMATO EXACTO de employee-reminders */}
      {isEmployee && (
        <div className="w-full h-full">
          {!selectedChat ? (
            /* Contact List View - formato EXACTO de recordatorios */
            <div className="min-h-screen bg-employee-gradient text-white flex flex-col page-scroll">
              {/* Header - Standard employee pattern EXACTO */}
              <div className="flex items-center justify-between p-6 pb-8 h-20">
                <Link href={`/${companyAlias}/inicio`}>
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
                  {/* Mostrar logo solo si tiene logo Y función habilitada en super admin */}
                  {company?.logoUrl && hasAccess('logoUpload') ? (
                    <img 
                      src={company.logoUrl} 
                      alt={company.name} 
                      className="h-8 w-auto mb-1 object-contain filter brightness-0 invert"
                    />
                  ) : (
                    <div className="text-white text-sm font-medium mb-1">
                      {company?.name || 'Mi Empresa'}
                    </div>
                  )}
                  <div className="text-white/70 text-xs">
                    {user?.fullName}
                  </div>
                </div>
              </div>

              {/* Page title - EXACTO como recordatorios */}
              <div className="px-6 pb-6">
                <h1 className="text-3xl font-bold text-white mb-2">Mensajes</h1>
                <p className="text-white/70 text-sm">Contacta con tu equipo</p>
              </div>

              {/* Contact List - FORMATO EXACTO de recordatorios */}
              <div className="flex-1 px-6 pb-6">
                {!messages || !Array.isArray(messages) ? (
                  <div className="text-center py-8">
                    <div className="text-white/70">Cargando mensajes...</div>
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-white/30 mx-auto mb-4" />
                    <div className="text-white/70 mb-2">No hay contactos</div>
                    <div className="text-white/50 text-sm">
                      No hay responsables disponibles para contactar
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEmployees.map((employee) => {
                      const unreadCount = Array.isArray(messages) ? messages.filter((msg: any) => 
                        !msg.isRead && msg.senderId === employee.id && msg.receiverId === user?.id
                      ).length : 0;

                      return (
                        <div
                          key={employee.id}
                          className="relative rounded-lg p-4 shadow-md border border-white/10 backdrop-blur-sm bg-white/5 hover:bg-white/10 cursor-pointer transition-all"
                          onClick={() => setSelectedChat(employee.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1">
                              <UserAvatar 
                                fullName={employee.fullName || ''} 
                                size="md" 
                                userId={employee.id}
                                profilePicture={employee.profilePicture}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-medium text-white text-sm truncate">
                                    {employee.fullName}
                                  </h3>
                                  {unreadCount > 0 && (
                                    <div className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                                      {unreadCount}
                                    </div>
                                  )}
                                </div>
                                <p className="text-white/70 text-xs">
                                  {getRoleDisplay(employee)}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center ml-2">
                              <ChevronRight className="h-5 w-5 text-white/50" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Chat simple y funcional - con colores empleado */
            <div className="simple-chat-container">
              {/* Header simple con colores empleado */}
              <div className="simple-chat-header bg-employee-gradient">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChat(null)}
                  className="p-2 text-white hover:bg-white/20"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </Button>
                <UserAvatar 
                  fullName={selectedChatUser?.fullName || ''} 
                  size="sm" 
                  userId={selectedChatUser?.id}
                  profilePicture={selectedChatUser?.profilePicture}
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-white">
                    {selectedChatUser?.fullName}
                  </h3>
                  <div className="text-xs text-white/70">
                    {getRoleDisplay(selectedChatUser || null)}
                  </div>
                </div>
              </div>

              {/* Mensajes */}
              <div className="simple-chat-messages" ref={messagesContainerRef}>
                {messagesGroupedByDate.map((group) => (
                  <div key={group.date}>
                    <div className="flex items-center justify-center my-4">
                      <div className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-3 py-1 rounded-full font-medium">
                        {group.dateFormatted}
                      </div>
                    </div>
                    
                    {group.messages.map((message) => (
                      <div key={message.id} className={`mb-3 flex ${
                        message.senderId === user?.id ? 'justify-end' : 'justify-start'
                      }`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-lg ${
                          message.senderId === user?.id 
                            ? 'bg-blue-500 text-white rounded-br-sm' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                        }`}>
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          <div className="flex items-center justify-between mt-1 text-xs opacity-70">
                            <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                            {message.senderId === user?.id && (
                              <div className="ml-2">
                                <Check className="h-3 w-3 text-green-200" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input simple */}
              <div className="simple-chat-input">
                <input
                  type="text"
                  placeholder="Escribe tu mensaje..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      isEmployee ? handleSendEmployeeMessage() : sendMessage();
                    }
                  }}
                  disabled={sendMessageMutation.isPending}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  style={{ fontSize: '16px' }}
                />
                <Button
                  onClick={() => isEmployee ? handleSendEmployeeMessage() : sendMessage()}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground p-2 ml-2"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal for new chat - Group message functionality */}
      <Dialog open={showAddChatModal} onOpenChange={setShowAddChatModal}>
        <DialogContent className="max-w-md lg:max-w-4xl mx-auto">
          <DialogHeader>
            <DialogTitle>Nuevo mensaje</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant={modalGroupMode ? "default" : "outline"}
                onClick={() => setModalGroupMode(!modalGroupMode)}
                className={modalGroupMode ? "btn-oficaz-primary" : ""}
              >
                <Users className="w-4 h-4 mr-1" />
                Grupal
              </Button>
              
              {modalGroupMode && (
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModalSelectedEmployees(
                      filteredModalEmployees
                        .filter(employee => 
                          employee.fullName?.toLowerCase().includes(modalSearchTerm.toLowerCase()) && employee.id !== user?.id
                        )
                        .map(e => e.id)
                    )}
                  >
                    Todos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModalSelectedEmployees([])}
                  >
                    Ninguno
                  </Button>
                </div>
              )}
            </div>
            
            {/* Responsive layout: Stack on mobile, 2-column on desktop */}
            <div className={`${modalGroupMode ? 'lg:grid lg:grid-cols-2 lg:gap-6' : ''} space-y-4 lg:space-y-0`}>
              
              {/* Left Column: Message composition */}
              <div style={{ display: modalGroupMode ? 'block' : 'none' }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Mensaje grupal
                  </label>
                  <textarea
                    placeholder="Escribe tu mensaje grupal...&#10;&#10;Puedes escribir múltiples líneas y dar formato a tu mensaje."
                    value={modalMessage}
                    onChange={(e) => setModalMessage(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-oficaz-primary focus:border-oficaz-primary resize-none transition-colors"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {modalMessage.length}/1000 caracteres
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Shift + Enter para nueva línea
                    </span>
                  </div>
                </div>
                
                {/* Send button for desktop (hidden on mobile) */}
                <div className="hidden lg:block">
                  <Button
                    onClick={sendModalGroupMessage}
                    disabled={!modalMessage.trim() || modalSelectedEmployees.length === 0 || sendGroupMessageMutation.isPending}
                    className="btn-oficaz-primary w-full"
                  >
                    {sendGroupMessageMutation.isPending ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar a {modalSelectedEmployees.length} empleado{modalSelectedEmployees.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Right Column: Employee selection */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {modalGroupMode ? `Seleccionar empleados (${modalSelectedEmployees.length})` : 'Seleccionar empleado'}
                  </label>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar empleados..."
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                
                <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="space-y-1 p-2">
                    {filteredModalEmployees.map((employee) => (
                      <div
                        key={employee.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          modalGroupMode 
                            ? modalSelectedEmployees.includes(employee.id)
                              ? 'bg-oficaz-primary/10 border border-oficaz-primary/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => {
                          if (modalGroupMode) {
                            setModalSelectedEmployees(prev => 
                              prev.includes(employee.id)
                                ? prev.filter(id => id !== employee.id)
                                : [...prev, employee.id]
                            );
                          } else {
                            setSelectedChat(employee.id);
                            setShowAddChatModal(false);
                          }
                        }}
                      >
                        <UserAvatar 
                          fullName={employee.fullName || ''} 
                          size="sm" 
                          userId={employee.id}
                          profilePicture={employee.profilePicture}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                            {employee.fullName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {getRoleDisplay(employee)}
                          </p>
                        </div>
                        {modalGroupMode && modalSelectedEmployees.includes(employee.id) && (
                          <CheckCircle2 className="w-5 h-5 text-oficaz-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Send button for mobile (visible only on mobile) */}
            {modalGroupMode && (
              <div className="lg:hidden">
                <Button
                  onClick={sendModalGroupMessage}
                  disabled={!modalMessage.trim() || modalSelectedEmployees.length === 0 || sendGroupMessageMutation.isPending}
                  className="btn-oficaz-primary w-full"
                >
                  {sendGroupMessageMutation.isPending ? (
                    <>Enviando...</>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar a {modalSelectedEmployees.length} empleado{modalSelectedEmployees.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

