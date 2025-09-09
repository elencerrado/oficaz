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
  
  // Unified chat - works for both admin and employee
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const canShowReadStatus = isAdmin; // Only admin/manager see double ticks
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const companyAlias = location.split('/')[1];

  // Unified state management
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddChatModal, setShowAddChatModal] = useState(false);
  const [modalGroupMode, setModalGroupMode] = useState(false);
  const [modalSelectedEmployees, setModalSelectedEmployees] = useState<number[]>([]);
  const [modalMessage, setModalMessage] = useState('');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  
  // iOS PWA viewport fix
  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight;
      setViewportHeight(vh);
      document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // All refs together
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    enabled: !!user && isAdmin,
    staleTime: 60000,
  });

  // All mutations together
  const sendMessageMutation = useMutation({
    mutationFn: (messageData: { receiverId: number; subject: string; content: string }) =>
      apiRequest('POST', '/api/messages', messageData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      setNewMessage("");
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (messageId: number) => apiRequest('PUT', `/api/messages/${messageId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
  });

  // Unified send message function - works for both admin and employee
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    try {
      await sendMessageMutation.mutateAsync({
        receiverId: selectedChat,
        content: newMessage.trim(),
        subject: "Chat"
      });
      setNewMessage("");
      
      // Auto-scroll after sending message
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'auto', 
            block: 'end',
            inline: 'nearest'
          });
        }
        scrollToBottom();
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 300);
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [newMessage, selectedChat, sendMessageMutation]);

  // Simplified contact list - works for both admin and employee
  const contactList = useMemo(() => {
    if (isAdmin) {
      return employees as Employee[] || [];
    } else {
      return managers as Manager[] || [];
    }
  }, [isAdmin, employees, managers]);
  
  const filteredContactList = useMemo(() => {
    return contactList.filter(contact => 
      contact.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) && 
      contact.id !== user?.id
    );
  }, [contactList, searchTerm, user?.id]);

  // All effects together
  useEffect(() => {
    if (selectedChat) {
      console.log('Selected chat is now:', selectedChat);
      const selectedEmployee = contactList.find(e => e.id === selectedChat);
      if (selectedEmployee) {
        console.log('Found contact for chat:', selectedEmployee.fullName);
      }
    }
  }, [selectedChat, contactList]);

  useEffect(() => {
    if (selectedChat && messages && messages.length > 0 && !markAsReadMutation.isPending) {
      const chatMessages = messages as Message[] || [];
      const unreadMessages = chatMessages.filter(msg => 
        !msg.isRead && 
        msg.receiverId === user?.id && 
        msg.senderId === selectedChat
      );
      
      if (unreadMessages.length > 0) {
        unreadMessages.forEach(msg => {
          markAsReadMutation.mutate(msg.id);
        });
      }
    }
  }, [selectedChat, messages?.length, user?.id]);

  useEffect(() => {
    const handleKeyboardVisibility = () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        const viewport = window.visualViewport;
        if (viewport) {
          const handleViewportChange = () => {
            setIsKeyboardOpen(viewport.height < window.screen.height * 0.75);
          };
          viewport.addEventListener('resize', handleViewportChange);
          return () => viewport.removeEventListener('resize', handleViewportChange);
        }
      }
    };
    
    return handleKeyboardVisibility();
  }, []);

  // ⚠️ PROTECTED: Auto-scroll mejorado con múltiples métodos - DO NOT MODIFY
  const scrollToBottom = useCallback(() => {
    // MÉTODO 1: Usar scrollIntoView en messagesEndRef
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'auto', 
        block: 'end',
        inline: 'nearest'
      });
    }

    // MÉTODO 2: Usar messagesContainerRef si existe
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }

    // MÉTODO 3: Buscar cualquier contenedor con overflow-y-auto que contenga mensajes
    const scrollableContainers = document.querySelectorAll('.overflow-y-auto');
    scrollableContainers.forEach(container => {
      if (container.querySelector('[data-message-id]') || container.textContent?.includes('mensaje')) {
        (container as HTMLElement).scrollTop = (container as HTMLElement).scrollHeight;
      }
    });

    return true;
  }, []);

  useEffect(() => {
    if (selectedChat && messages && messages.length > 0) {
      // Scroll inmediato
      scrollToBottom();
      
      // Múltiples intentos para asegurar el scroll
      const timers = [
        setTimeout(scrollToBottom, 100),
        setTimeout(scrollToBottom, 300),
        setTimeout(scrollToBottom, 500)
      ];

      return () => timers.forEach(timer => clearTimeout(timer));
    }
  }, [selectedChat, messages?.length, scrollToBottom]);

  // All computed values and callbacks together
  const selectedChatUser = useMemo(() => {
    if (!selectedChat) return null;
    const foundUser = contactList.find(person => person.id === selectedChat);
    return foundUser || null;
  }, [selectedChat, contactList]);

  const getChatMessages = useCallback((chatUserId: number) => {
    const allMessages = messages as Message[] || [];
    return allMessages
      .filter(msg => 
        (msg.senderId === user?.id && msg.receiverId === chatUserId) ||
        (msg.senderId === chatUserId && msg.receiverId === user?.id)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, user?.id]);

  const getMessagesGroupedByDate = useCallback((chatUserId: number) => {
    const chatMessages = getChatMessages(chatUserId);
    const grouped = chatMessages.reduce((groups: any, message: Message) => {
      const date = format(new Date(message.createdAt), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
      return groups;
    }, {});

    return Object.keys(grouped).map(date => ({
      date,
      dateFormatted: format(new Date(date), 'EEEE, d \'de\' MMMM yyyy', { locale: es }),
      messages: grouped[date]
    }));
  }, [getChatMessages]);

  const chatMessages = useMemo(() => 
    selectedChat ? getChatMessages(selectedChat) : [], 
    [selectedChat, getChatMessages]
  );

  const messagesGroupedByDate = useMemo(() => 
    selectedChat ? getMessagesGroupedByDate(selectedChat) : [], 
    [selectedChat, getMessagesGroupedByDate]
  );

  // Modal functions
  const toggleModalEmployeeSelection = (employeeId: number) => {
    setModalSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const openAddChatModal = () => {
    setShowAddChatModal(true);
    setModalGroupMode(false);
    setModalSelectedEmployees([]);
    setModalMessage('');
  };

  const closeAddChatModal = () => {
    setShowAddChatModal(false);
    setModalGroupMode(false);
    setModalSelectedEmployees([]);
    setModalMessage('');
    setModalSearchTerm('');
  };

  const startIndividualChat = (employeeId: number) => {
    setSelectedChat(employeeId);
    closeAddChatModal();
  };

  const sendModalGroupMessage = async () => {
    if (modalSelectedEmployees.length === 0 || !modalMessage.trim()) return;
    
    // Validate message length
    if (modalMessage.length > 1000) {
      toast({
        title: "Mensaje demasiado largo",
        description: "El mensaje no puede exceder 1000 caracteres",
        variant: "destructive",
      });
      return;
    }
    
    try {
      closeAddChatModal();
      
      // Show sending indicator
      toast({
        title: "Enviando mensajes...",
        description: `Enviando a ${modalSelectedEmployees.length} empleados`,
      });
      
      for (const employeeId of modalSelectedEmployees) {
        await apiRequest('POST', '/api/messages', {
          receiverId: employeeId,
          subject: 'Mensaje grupal',
          content: modalMessage,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      
      // Reset states
      setModalMessage('');
      setModalSelectedEmployees([]);
      setModalGroupMode(false);
      
      setTimeout(() => {
        toast({
          title: "✅ Mensajes enviados",
          description: `Mensaje enviado exitosamente a ${modalSelectedEmployees.length} empleados`,
        });
      }, 500);
      
    } catch (error) {
      console.error('Error sending group message:', error);
      setTimeout(() => {
        toast({
          title: "❌ Error al enviar",
          description: "No se pudieron enviar los mensajes. Inténtalo de nuevo.",
          variant: "destructive",
        });
      }, 100);
    }
  };

  if (messagesLoading) {
    return <PageLoading />;
  }

  if (!user) {
    return <div>No autorizado</div>;
  }

  // ⚠️ UNIFIED CHAT VIEW - Works for both admin and employee
  // Uses dark theme, only differentiates read status ticks
  return (
    <div className="h-full">
      {!selectedChat ? (
        <>
        {/* Contact List View - Unified Dark Theme */}
        <div 
          className="fixed inset-0 z-[60] flex flex-col"
          style={{ 
            touchAction: 'manipulation',
            overscrollBehavior: 'none',
            position: 'fixed',
            background: 'radial-gradient(circle at center, #1A2332 0%, #0F1419 100%)',
            height: '100vh',
            height: '100dvh',
            minHeight: '-webkit-fill-available'
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between p-4 border-b border-gray-200/20 flex-shrink-0"
            style={{
              background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)',
              paddingTop: `calc(16px + env(safe-area-inset-top, 0px))`
            }}
          >
            <div className="flex items-center space-x-3">
              <UserAvatar 
                fullName={user?.fullName || 'Usuario'} 
                size="sm" 
                userId={user?.id || 0}
              />
              {isAdmin ? (
                <div className="text-white text-sm font-medium mb-1">
                  Panel de Administración
                </div>
              ) : (
                <div className="text-white text-sm font-medium mb-1">
                  {company?.name || 'Mi Empresa'}
                </div>
              )}
            </div>
            
            {isAdmin && (
              <Button
                onClick={openAddChatModal}
                size="sm"
                className="bg-blue-500 hover:bg-blue-600 text-white border-0"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nuevo
              </Button>
            )}
          </div>
          
          {/* Page title */}
          <div className="px-6 pb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Mensajes</h1>
            <p className="text-white/70 text-sm">
              {isAdmin ? 'Gestiona la comunicación con tu equipo' : 'Comunícate con tus responsables y mantente al día'}
            </p>
          </div>
          
          <div className="px-4 py-6 space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
              <Input
                placeholder={isAdmin ? "Buscar empleados..." : "Buscar responsables..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
              />
            </div>

            {/* Contact list */}
            <div className="space-y-3">
              <h2 className="text-white/90 text-sm font-medium px-2">Conversaciones</h2>
              
              {filteredContactList.length > 0 ? (
                <div className="space-y-2">
                  {filteredContactList.map((contact) => {
                    const unreadCount = (messages as Message[] || []).filter(msg => 
                      !msg.isRead && msg.senderId === contact.id && msg.receiverId === user?.id
                    ).length;
                    
                    return (
                      <div
                        key={contact.id}
                        className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 cursor-pointer hover:bg-white/15 transition-all duration-200 border border-white/10"
                        onClick={() => setSelectedChat(contact.id)}
                      >
                        <div className="flex items-center space-x-4">
                          <UserAvatar 
                            fullName={contact.fullName || ''} 
                            size="md" 
                            userId={contact.id}
                            profilePicture={contact.profilePicture}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-white font-medium truncate">
                                {contact.fullName}
                              </p>
                              {unreadCount > 0 && (
                                <div className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                                  {unreadCount}
                                </div>
                              )}
                            </div>
                            <div className="text-white/70 text-xs mt-1">
                              {contact.position || (() => {
                                const role = contact.role || 'employee';
                                const roleDescriptions = {
                                  admin: 'Director General',
                                  manager: 'Responsable', 
                                  employee: 'Empleado'
                                };
                                return roleDescriptions[role as keyof typeof roleDescriptions] || 'Empleado';
                              })()}
                            </div>
                          </div>
                          
                          <ChevronRight className="w-5 h-5 text-white/50" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-white/10 rounded-full mx-auto flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-white/50" />
                  </div>
                  <p className="text-white/70">
                    {isAdmin ? 'No hay empleados disponibles' : 'No hay responsables disponibles'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      ) : (
        /* ⚠️ UNIFIED CHAT VIEW - Works for both admin and employee */
        <div 
          className="fixed inset-0 z-[60] flex flex-col"
          style={{ 
            touchAction: 'manipulation',
            overscrollBehavior: 'none',
            position: 'fixed',
            background: 'radial-gradient(circle at center, #1A2332 0%, #0F1419 100%)',
            height: `${viewportHeight}px`,
            minHeight: '-webkit-fill-available'
          }}
        >
          {/* Chat Header - DARK THEME */}
          <div 
            className="flex items-center space-x-3 p-4 border-b border-gray-200/20 flex-shrink-0"
            style={{
              background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)',
              paddingTop: `calc(16px + env(safe-area-inset-top, 0px))`
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedChat(null)}
              className="text-white hover:bg-white/10 p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            {selectedChatUser && (
              <>
                <UserAvatar 
                  fullName={selectedChatUser.fullName || ''} 
                  size="sm" 
                  userId={selectedChatUser.id}
                  profilePicture={selectedChatUser.profilePicture}
                />
                <div className="flex-1">
                  <h3 className="text-white font-medium text-sm">
                    {selectedChatUser.fullName}
                  </h3>
                  <p className="text-white/60 text-xs">
                    {selectedChatUser.position || 'Empleado'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Messages Container - DARK THEME */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-6"
            style={{
              overscrollBehavior: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="space-y-6">
              {messagesGroupedByDate.length > 0 ? (
                messagesGroupedByDate.map((group) => (
                  <div key={group.date} className="space-y-4">
                    {/* Date separator */}
                    <div className="flex items-center justify-center">
                      <div className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-medium">
                        {group.dateFormatted}
                      </div>
                    </div>
                    
                    {/* Messages for this date */}
                    <div className="space-y-3">
                      {group.messages.map((message: Message) => (
                        <div key={message.id} data-message-id={message.id} className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-3 rounded-lg ${message.senderId === user?.id ? 'bg-blue-500 text-white shadow-oficaz-blue' : 'bg-white/10 text-white shadow-oficaz'}`}>
                            <p className="text-sm">{message.content}</p>
                            <div className="flex items-center justify-between mt-1">
                              <p className={`text-xs ${message.senderId === user?.id ? 'text-blue-100' : 'text-white/50'}`}>
                                {format(new Date(message.createdAt), 'HH:mm', { locale: es })}
                              </p>
                              {message.senderId === user?.id && (
                                <div className="ml-2">
                                  {canShowReadStatus ? (
                                    message.isRead ? (
                                      <div className="flex items-center text-green-400">
                                        <Check className="h-3 w-3" />
                                        <Check className="h-3 w-3 -ml-1" />
                                      </div>
                                    ) : (
                                      <Check className="h-3 w-3 text-green-400" />
                                    )
                                  ) : (
                                    <Check className="h-3 w-3 text-green-400" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-white/70 py-8">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay mensajes aún</p>
                  <p className="text-sm">Envía tu primer mensaje</p>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} style={{ height: isKeyboardOpen ? '30px' : '10px' }} />
          </div>
          
          {/* Message Input - Fixed at bottom - DARK THEME */}
          <div 
            className="px-4 py-3 border-t border-gray-200/20 flex-shrink-0"
            style={{
              background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)',
              paddingBottom: isKeyboardOpen ? '0px' : 'max(16px, env(safe-area-inset-bottom))',
              position: 'sticky',
              bottom: 0,
              zIndex: 10
            }}
          >
            <div className="flex space-x-2">
              <Input
                ref={messageInputRef}
                placeholder="Escribe tu mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="input-oficaz flex-1"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white'
                }}
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white border-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal for new chat - Group message functionality - Only for admin */}
      {isAdmin && (
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
                        (employees as Employee[] || [])
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
                      maxLength={1000}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                      {modalMessage.length}/1000 caracteres
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <strong>Empleados seleccionados:</strong> {modalSelectedEmployees.length}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={sendModalGroupMessage}
                      disabled={modalSelectedEmployees.length === 0 || !modalMessage.trim()}
                      className="btn-oficaz-primary flex-1"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Enviar a {modalSelectedEmployees.length} empleados
                    </Button>
                    <Button variant="outline" onClick={closeAddChatModal}>
                      Cancelar
                    </Button>
                  </div>
                </div>
                
                {/* Right Column: Employee selection */}
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar empleados..."
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                    {(employees as Employee[] || [])
                      .filter(employee => 
                        employee.fullName?.toLowerCase().includes(modalSearchTerm.toLowerCase()) && 
                        employee.id !== user?.id
                      )
                      .map((employee) => (
                        <div
                          key={employee.id}
                          className={`p-3 border-b border-gray-100 dark:border-gray-600 last:border-b-0 cursor-pointer transition-colors ${
                            modalSelectedEmployees.includes(employee.id) 
                              ? 'bg-blue-50 dark:bg-blue-900/20' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => 
                            modalGroupMode 
                              ? toggleModalEmployeeSelection(employee.id)
                              : startIndividualChat(employee.id)
                          }
                        >
                          <div className="flex items-center space-x-3">
                            {modalGroupMode && (
                              <input
                                type="checkbox"
                                checked={modalSelectedEmployees.includes(employee.id)}
                                onChange={() => toggleModalEmployeeSelection(employee.id)}
                                className="rounded border-gray-300 dark:border-gray-600"
                              />
                            )}
                            
                            <UserAvatar 
                              fullName={employee.fullName || ''} 
                              size="sm" 
                              userId={employee.id}
                            />
                            
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {employee.fullName}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {employee.email}
                              </p>
                            </div>
                            
                            {!modalGroupMode && <ChevronRight className="w-4 h-4 text-gray-400" />}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}