import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Send, 
  ArrowLeft,
  User,
  Bell,
  MessageCircle,
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
}

interface Manager {
  id: number;
  fullName: string;
  role: string;
  email?: string;
  jobTitle?: string;
  position?: string;
}

export default function Messages() {
  const { user, company } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const companyAlias = location.split('/')[1];

  // All state declarations together - FIXED ORDER
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
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

  // All mutations together
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

  // All effects together
  useEffect(() => {
    if (selectedChat) {
      console.log('Selected chat is now:', selectedChat);
      const contactList = user?.role === 'employee' ? (managers as Manager[] || []) : (employees as Employee[] || []);
      const selectedEmployee = contactList.find(e => e.id === selectedChat);
      if (selectedEmployee) {
        console.log('Found employee for chat:', selectedEmployee.fullName);
      }
    }
  }, [selectedChat, user?.role, managers, employees]);

  useEffect(() => {
    const chatMessages = messages as Message[] || [];
    const unreadMessages = chatMessages.filter(msg => 
      !msg.isRead && 
      msg.receiverId === user?.id && 
      selectedChat && 
      msg.senderId === selectedChat
    );
    
    unreadMessages.forEach(msg => {
      markAsReadMutation.mutate(msg.id);
    });
  }, [selectedChat, messages, user?.id, markAsReadMutation]);

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

  // Auto-scroll simple que FUNCIONA
  useEffect(() => {
    if (selectedChat) {
      setTimeout(() => {
        // Desktop scroll
        const desktop = document.querySelector('[class*="overflow-y-auto"][class*="bg-gray-50"]');
        if (desktop) {
          desktop.scrollTop = desktop.scrollHeight;
        }
        
        // Mobile scroll
        const mobile = document.querySelector('[style*="touchAction"][style*="pan-y"]');
        if (mobile) {
          mobile.scrollTop = mobile.scrollHeight;
        }
      }, 200);
    }
  }, [selectedChat, messages]);

  // All computed values and callbacks together
  const contactList = user?.role === 'employee' ? (managers as Manager[] || []) : (employees as Employee[] || []);
  const filteredEmployees = contactList.filter(person => 
    person.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) && person.id !== user?.id
  );

  // CRITICAL: selectedChatUser for EMPLOYEE chat header - DO NOT MODIFY
  const selectedChatUser = useMemo(() => {
    if (!selectedChat) return null;
    
    // Get the correct list based on user role
    const list = user?.role === 'employee' ? (managers as Manager[] || []) : (employees as Employee[] || []);
    const foundUser = list.find(person => person.id === selectedChat);
    
    console.log('Chat user lookup:', {
      selectedChat,
      userRole: user?.role,
      listLength: list.length,
      foundUser: foundUser?.fullName
    });
    
    return foundUser || null;
  }, [selectedChat, user?.role, managers, employees]);

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

  // Role display helper with icons - shows actual data from database
  const getRoleDisplay = useCallback((person: any) => {
    if (!person) return null;
    
    const role = person.role || 'employee';
    const displayText = person.jobTitle || person.position || 'Sin cargo definido';
    
    const roleConfig = {
      admin: { color: 'bg-red-500', letter: 'A', size: 'text-[10px]' },
      manager: { color: 'bg-orange-500', letter: 'M', size: 'text-[10px]' },
      employee: { color: 'bg-blue-500', letter: 'E', size: 'text-[8px]' }
    };
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.employee;
    
    return (
      <div className="flex items-center space-x-1">
        <div className={`w-3 h-3 ${config.color} rounded-full flex items-center justify-center`}>
          <span className={`text-white ${config.size} font-bold`}>{config.letter}</span>
        </div>
        <span>{displayText}</span>
      </div>
    );
  }, []);

  // Role display for employee view - without icon, only text
  const getRoleDisplayEmployee = useCallback((person: any) => {
    if (!person) return null;
    const displayText = person.jobTitle || person.position || 'Sin cargo definido';
    return <span>{displayText}</span>;
  }, []);

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
    
    try {
      closeAddChatModal();
      
      for (const employeeId of modalSelectedEmployees) {
        await apiRequest('POST', '/api/messages', {
          receiverId: employeeId,
          subject: 'Mensaje grupal',
          content: modalMessage,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      
      setTimeout(() => {
        toast({
          title: "Mensajes enviados",
          description: `Mensaje enviado a ${modalSelectedEmployees.length} empleados`,
        });
      }, 100);
      
    } catch (error) {
      console.error('Error sending group message:', error);
      setTimeout(() => {
        toast({
          title: "Error",
          description: "No se pudieron enviar los mensajes",
          variant: "destructive",
        });
      }, 100);
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    sendMessageMutation.mutate({
      receiverId: selectedChat,
      subject: 'Mensaje',
      content: newMessage
    });
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    sendMessageMutation.mutate({
      receiverId: selectedChat,
      subject: 'Mensaje',
      content: newMessage
    });
  };

  // Loading state
  if (messagesLoading) {
    return <PageLoading message="Cargando mensajes..." />;
  }

  // Admin/Manager view
  if (user?.role === 'admin' || user?.role === 'manager') {
    return (
      <div className="px-6 py-4 min-h-screen bg-gray-50" style={{ overflowX: 'clip' }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Mensajes</h1>
          <p className="text-gray-500 mt-1">
            Comunícate con empleados y gestiona mensajes
          </p>
        </div>
        {/* Desktop Layout: Two columns side by side */}
        <div className="hidden lg:flex gap-6 h-[calc(100vh-180px)]">
          {/* Left Column: Employee List (1/3 width) */}
          <div className="w-1/3 bg-white rounded-lg border border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="heading-3">Conversaciones ({filteredEmployees.length})</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {(messages as Message[] || []).filter(m => !m.isRead && m.receiverId === user?.id).length} conversación{(messages as Message[] || []).filter(m => !m.isRead && m.receiverId === user?.id).length !== 1 ? 'es' : ''} sin leer
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openAddChatModal}
                    className="btn-oficaz-primary flex-shrink-0 ml-2"
                  >
                    <Plus className="icon-sm mr-1" />
                    Nuevo
                  </Button>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10 pointer-events-none" />
                  <Input
                    placeholder="Buscar conversación..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-oficaz bg-gray-50"
                    style={{ paddingLeft: '2.5rem', paddingRight: '1rem' }}
                  />
                </div>
              </div>
              
              <div className="p-4 space-y-2 overflow-y-auto flex-1">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className={`p-3 rounded-lg cursor-pointer border transition-all duration-200 hover-lift ${
                      selectedChat === employee.id
                        ? 'bg-oficaz-primary text-white border-oficaz-primary'
                        : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                    }`}
                    onClick={() => setSelectedChat(employee.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        selectedChat === employee.id
                          ? 'bg-white/20 text-white'
                          : 'bg-oficaz-primary text-white'
                      }`}>
                        <span className="text-sm font-medium">
                          {employee.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className={`truncate font-medium text-sm ${
                          selectedChat === employee.id ? 'text-white' : 'text-gray-900'
                        }`}>
                          {employee.fullName}
                        </p>
                        <div className={`truncate text-xs ${
                          selectedChat === employee.id ? 'text-white/90' : 'text-gray-500'
                        }`}>
                          {getRoleDisplay(employee)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Chat Area (2/3 width) */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden">
              {selectedChat ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-gray-200 flex-shrink-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-oficaz-primary rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {filteredEmployees.find(e => e.id === selectedChat)?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h3 className="heading-4">
                          {filteredEmployees.find(e => e.id === selectedChat)?.fullName}
                        </h3>
                        <div className="caption-text">
                          {getRoleDisplay(filteredEmployees.find(e => e.id === selectedChat))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages - Scrollable middle section */}
                  <div 
                    ref={messagesContainerRef} 
                    className="flex-1 overflow-y-auto p-4 bg-gray-50"
                  >
                    <div className="space-y-6">
                      {messagesGroupedByDate.length > 0 ? (
                        messagesGroupedByDate.map((group) => (
                          <div key={group.date} className="space-y-4">
                            {/* Date separator */}
                            <div className="flex items-center justify-center">
                              <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full font-medium">
                                {group.dateFormatted}
                              </div>
                            </div>
                            
                            {/* Messages for this date */}
                            <div className="space-y-3">
                              {group.messages.map((message) => (
                                <div
                                  key={message.id}
                                  className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                      message.senderId === user?.id
                                        ? 'bg-oficaz-primary text-white shadow-oficaz-blue'
                                        : 'bg-white text-gray-900 border border-gray-200 shadow-oficaz'
                                    }`}
                                  >
                                    <p className="text-sm">{message.content}</p>
                                    <div className="flex items-center justify-between mt-1">
                                      <p className={`text-xs ${
                                        message.senderId === user?.id ? 'text-white/70' : 'text-gray-500'
                                      }`}>
                                        {format(new Date(message.createdAt), 'HH:mm')}
                                      </p>
                                      {message.senderId === user?.id && (
                                        <div className="ml-2">
                                          {(user?.role === 'admin' || user?.role === 'manager') ? (
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
                        <div className="text-center text-gray-500 py-8">
                          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No hay mensajes aún</p>
                          <p className="text-sm">Envía el primer mensaje para comenzar la conversación</p>
                        </div>
                      )}
                    </div>
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input - Fixed at bottom */}
                  <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
                    <div className="flex space-x-2">
                      <Input
                        ref={messageInputRef}
                        placeholder="Escribe tu mensaje..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="input-oficaz flex-1"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="btn-oficaz-primary"
                      >
                        <Send className="icon-sm" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="heading-3 mb-2">Selecciona un empleado</h3>
                    <p className="body-text">Elige un empleado de la lista para comenzar a chatear</p>
                  </div>
                </div>
              )}
            </div>
        </div>
        {/* Mobile Layout for Admin/Manager */}
        <div className="lg:hidden h-full flex flex-col">
          {!selectedChat ? (
            /* Employee List View */
            (<div className="flex-1 flex flex-col min-h-0">
              <div className="flex-shrink-0 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Conversaciones</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openAddChatModal}
                    className="btn-oficaz-primary"
                  >
                    <Plus className="icon-sm mr-1" />
                    Nuevo
                  </Button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                  <Input
                    placeholder="Buscar conversación..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-oficaz bg-gray-50 pl-10 pr-4"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-2 py-4">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="p-4 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedChat(employee.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-oficaz-primary rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {employee.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {employee.fullName}
                          </p>
                          <div className="text-sm text-gray-500 truncate">
                            {getRoleDisplay(employee)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>)
          ) : (
            /* Chat View - Full screen overlay */
            (<div 
              className="fixed inset-0 bg-white z-[60] flex flex-col lg:hidden"
              style={{ 
                touchAction: 'manipulation',
                overscrollBehavior: 'none',
                position: 'fixed'
              }}
            >
              {/* Chat Header with Back Button - Fixed at top */}
              <div className="flex items-center space-x-3 p-4 border-b border-gray-200 bg-white flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChat(null)}
                  className="p-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="w-10 h-10 bg-oficaz-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    {selectedChatUser?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedChatUser?.fullName}
                  </h3>
                  <div className="text-sm text-gray-500">
                    {getRoleDisplay(selectedChatUser)}
                  </div>
                </div>
              </div>
              {/* Messages - Scrollable area with bounce prevention */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 bg-gray-50 flex flex-col" 
                style={{ 
                  paddingBottom: '20px',
                  paddingTop: '8px',
                  touchAction: 'pan-y',
                  overscrollBehavior: 'none',
                  WebkitOverflowScrolling: 'touch',
                  position: 'relative'
                }}
              >
                <div className="flex-1"></div>
                <div className="space-y-6">
                  {messagesGroupedByDate.length > 0 ? (
                    messagesGroupedByDate.map((group) => (
                      <div key={group.date} className="space-y-4">
                        {/* Date separator */}
                        <div className="flex items-center justify-center">
                          <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full font-medium">
                            {group.dateFormatted}
                          </div>
                        </div>
                        
                        {/* Messages for this date */}
                        <div className="space-y-3">
                          {group.messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-xs px-4 py-2 rounded-lg ${
                                  message.senderId === user?.id
                                    ? 'bg-oficaz-primary text-white shadow-oficaz-blue'
                                    : 'bg-white text-gray-900 border border-gray-200 shadow-oficaz'
                                }`}
                              >
                                <p className="text-sm">{message.content}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className={`text-xs ${
                                    message.senderId === user?.id ? 'text-white/70' : 'text-gray-500'
                                  }`}>
                                    {format(new Date(message.createdAt), 'HH:mm')}
                                  </p>
                                  {message.senderId === user?.id && (
                                    <div className="ml-2">
                                      {(user?.role === 'admin' || user?.role === 'manager') ? (
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
                    <div className="text-center text-gray-500 py-8">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay mensajes aún</p>
                      <p className="text-sm">Envía el primer mensaje para comenzar</p>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>
              {/* Message Input - Fixed at bottom */}
              <div 
                className="flex space-x-2 p-4 border-t border-gray-200 bg-white flex-shrink-0"
                style={{
                  paddingBottom: 'max(16px, env(safe-area-inset-bottom))'
                }}
              >
                <Input
                  ref={messageInputRef}
                  placeholder="Escribe tu mensaje..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="input-oficaz flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="btn-oficaz-primary"
                >
                  <Send className="icon-sm" />
                </Button>
              </div>
            </div>)
          )}
        </div>
        {/* Modal for new chat - Group message functionality */}
        <Dialog open={showAddChatModal} onOpenChange={setShowAddChatModal}>
          <DialogContent className="max-w-md mx-auto">
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
                        filteredEmployees
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
              
              <Input
                placeholder="Escribe tu mensaje grupal..."
                value={modalMessage}
                onChange={(e) => setModalMessage(e.target.value)}
                className="input-oficaz"
                style={{ display: modalGroupMode ? 'block' : 'none' }}
              />
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                <Input
                  placeholder="Buscar empleado..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="input-oficaz bg-gray-50 pl-10 pr-4"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredEmployees
                  .filter(employee => 
                    employee.fullName?.toLowerCase().includes(modalSearchTerm.toLowerCase()) && employee.id !== user?.id
                  )
                  .map((employee) => (
                    <div
                      key={employee.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        modalGroupMode && modalSelectedEmployees.includes(employee.id)
                          ? 'bg-oficaz-primary text-white border-oficaz-primary'
                          : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                      }`}
                      onClick={() => modalGroupMode ? toggleModalEmployeeSelection(employee.id) : startIndividualChat(employee.id)}
                    >
                      <div className="flex items-center space-x-3">
                        {modalGroupMode && (
                          <div className={`w-4 h-4 border-2 rounded ${
                            modalSelectedEmployees.includes(employee.id)
                              ? 'bg-white border-white'
                              : 'border-gray-300'
                          } flex items-center justify-center`}>
                            {modalSelectedEmployees.includes(employee.id) && (
                              <Check className="w-3 h-3 text-oficaz-primary" />
                            )}
                          </div>
                        )}
                        
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          modalGroupMode && modalSelectedEmployees.includes(employee.id)
                            ? 'bg-white/20 text-white'
                            : 'bg-oficaz-primary text-white'
                        }`}>
                          <span className="text-xs font-medium">
                            {employee.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm truncate ${
                            modalGroupMode && modalSelectedEmployees.includes(employee.id) ? 'text-white' : 'text-gray-900'
                          }`}>
                            {employee.fullName}
                          </p>
                          <div className={`text-xs truncate ${
                            modalGroupMode && modalSelectedEmployees.includes(employee.id) ? 'text-white/90' : 'text-gray-500'
                          }`}>
                            {getRoleDisplay(employee)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {modalGroupMode && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-gray-600">
                    {modalSelectedEmployees.length} empleado{modalSelectedEmployees.length !== 1 ? 's' : ''} seleccionado{modalSelectedEmployees.length !== 1 ? 's' : ''}
                  </span>
                  <Button
                    onClick={sendModalGroupMessage}
                    disabled={modalSelectedEmployees.length === 0 || !modalMessage.trim()}
                    className="btn-oficaz-primary"
                  >
                    Enviar a todos
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Employee view - Mobile-first design - PROTECTED FROM ADMIN CHANGES
  return (
    <div className="min-h-screen bg-employee-gradient text-white flex flex-col page-scroll">
      {!selectedChat ? (
        /* Employee Dashboard - List of managers - STABLE VERSION */
        (<>
          {/* Header - Exactly like vacation-requests - DO NOT MODIFY */}
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
              <div className="text-white text-sm font-medium">
                {company?.name || 'Test Company'}
              </div>
              <div className="text-white/70 text-xs">
                {user?.fullName}
              </div>
            </div>
          </div>
          <div className="px-4 py-6 space-y-6">

          {/* Managers list */}
          <div className="space-y-3">
            <h2 className="text-white/90 text-sm font-medium px-2">Conversaciones</h2>
            
            {filteredEmployees.length > 0 ? (
              <div className="space-y-2">
                {filteredEmployees.map((manager) => {
                  const unreadCount = (messages as Message[] || []).filter(msg => 
                    !msg.isRead && msg.senderId === manager.id && msg.receiverId === user?.id
                  ).length;
                  
                  return (
                    <div
                      key={manager.id}
                      className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 cursor-pointer hover:bg-white/15 transition-all duration-200 border border-white/10"
                      onClick={() => setSelectedChat(manager.id)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
                            {manager.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-white font-medium truncate">
                              {manager.fullName}
                            </p>
                            {unreadCount > 0 && (
                              <div className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                                {unreadCount}
                              </div>
                            )}
                          </div>
                          <div className="text-white/70 text-xs mt-1">
                            {getRoleDisplay(manager)}
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
                <p className="text-white/70">No hay responsables disponibles</p>
              </div>
            )}
          </div>
        </div>
        </>)
      ) : (
            /* Chat View - EXACT COPY FROM ADMIN MOBILE LINE 657 */
            (<div 
              className="fixed inset-0 bg-white z-[60] flex flex-col lg:hidden"
              style={{ 
                touchAction: 'manipulation',
                overscrollBehavior: 'none',
                position: 'fixed'
              }}
            >
              {/* Chat Header - EMPLOYEE DARK VERSION */}
              <div 
                className="flex items-center space-x-3 p-4 border-b border-gray-200/20 flex-shrink-0"
                style={{
                  background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)'
                }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChat(null)}
                  className="p-2 text-white hover:bg-white/10"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </Button>
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    {selectedChatUser?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    {selectedChatUser?.fullName}
                  </h3>
                  <div className="text-sm text-white/70">
                    {getRoleDisplayEmployee(selectedChatUser)}
                  </div>
                </div>
              </div>
              {/* Messages Area - Scrollable */}
              <div 
                className="flex-1 overflow-y-auto px-4 py-4"
                style={{
                  background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)',
                  touchAction: 'pan-y',
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
                          {group.messages.map((message) => (
                            <div key={message.id} className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] p-3 rounded-lg ${message.senderId === user?.id ? 'bg-blue-500 text-white shadow-oficaz-blue' : 'bg-white/10 text-white shadow-oficaz'}`}>
                                <p className="text-sm">{message.content}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className={`text-xs ${message.senderId === user?.id ? 'text-blue-100' : 'text-white/50'}`}>
                                    {format(new Date(message.createdAt), 'HH:mm', { locale: es })}
                                  </p>
                                  {message.senderId === user?.id && (
                                    <div className="ml-2">
                                      {(user?.role === 'admin' || user?.role === 'manager') ? (
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
                <div ref={messagesEndRef} />
              </div>
              {/* Message Input - Fixed at bottom - DARK THEME */}
              <div 
                className="px-4 py-3 border-t border-gray-200/20"
                style={{
                  background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)',
                  paddingBottom: isKeyboardOpen ? '16px' : 'max(16px, env(safe-area-inset-bottom))'
                }}
              >
                <div className="flex space-x-2">
                  <Input
                    ref={messageInputRef}
                    placeholder="Escribe tu mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-white/40 focus:ring-0"
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
            </div>)
      )}
    </div>
  );
}