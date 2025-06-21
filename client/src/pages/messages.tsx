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

export default function Messages() {
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { user, company } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const companyAlias = company?.companyAlias || 'test';
  
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['/api/messages'],
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 10000,
  });

  const { data: managers } = useQuery({
    queryKey: ['/api/managers'],
    enabled: user?.role === 'employee',
    staleTime: 60000,
  });

  const { data: employees } = useQuery({
    queryKey: ['/api/employees'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
    staleTime: 60000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { receiverId: number; subject: string; content: string }) => {
      return apiRequest('POST', '/api/messages', data);
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      toast({
        title: 'Mensaje enviado',
        description: 'Tu mensaje ha sido enviado correctamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar el mensaje',
        variant: 'destructive',
      });
    },
  });



  const markAsReadMutation = useMutation({
    mutationFn: (messageId: number) => 
      apiRequest('PATCH', `/api/messages/${messageId}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChat]);

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

  // Detect keyboard open/close for mobile with multiple methods
  useEffect(() => {
    let initialViewportHeight = window.innerHeight;
    
    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      
      // Keyboard is open if viewport shrunk by more than 150px
      setIsKeyboardOpen(heightDifference > 150);
    };

    const handleWindowResize = () => {
      const currentHeight = window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      
      // Keyboard is open if window shrunk significantly
      setIsKeyboardOpen(heightDifference > 150);
    };

    // Use Visual Viewport API if available (modern browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
    
    // Fallback for older browsers
    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

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

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    sendMessageMutation.mutate({
      receiverId: selectedChat,
      subject: user?.role === 'employee' ? 'Mensaje del empleado' : 'Mensaje del administrador',
      content: newMessage.trim()
    });
  };

  const sendGroupMessage = () => {
    if (!newMessage.trim() || selectedEmployees.length === 0) return;
    
    selectedEmployees.forEach(employeeId => {
      sendMessageMutation.mutate({
        receiverId: employeeId,
        subject: 'Mensaje grupal',
        content: newMessage.trim()
      });
    });
    
    setNewMessage('');
    setSelectedEmployees([]);
    setIsGroupMode(false);
  };

  const toggleEmployeeSelection = (employeeId: number) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const filteredEmployees = (employees as any[] || [])
    .filter(emp => emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

  const getChatMessages = (otherUserId: number) => {
    if (!messages) return [];
    return (messages as Message[]).filter(
      msg => (msg.senderId === otherUserId && msg.receiverId === user?.id) ||
             (msg.senderId === user?.id && msg.receiverId === otherUserId)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  // Reset scroll when returning from chat
  useEffect(() => {
    if (!selectedChat) {
      // Ensure we're at the top when showing message list
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [selectedChat]);

  if (isLoading) {
    return <PageLoading />;
  }

  // Admin view with light theme
  if (isAdmin) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-oficaz-primary rounded-lg flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Mensajería</h1>
              <p className="text-gray-600 text-sm">
                Comunícate con empleados y gestiona mensajes
              </p>
            </div>
          </div>
        </div>
        {/* Content */}
        <div className="p-6 flex-1 overflow-hidden">
          <div className="grid lg:grid-cols-3 gap-6 h-full">
            {/* Employee List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 h-full">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-gray-900">Empleados</h2>
                    <Button
                      variant={isGroupMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setIsGroupMode(!isGroupMode);
                        setSelectedEmployees([]);
                      }}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Grupal
                    </Button>
                  </div>
                  
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar empleado..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-gray-50 border-gray-200"
                    />
                  </div>
                </div>
                
                <div className="p-4 space-y-2 overflow-y-auto flex-1">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                        selectedChat === employee.id
                          ? 'bg-oficaz-primary text-white border-oficaz-primary'
                          : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                      }`}
                      onClick={() => !isGroupMode && setSelectedChat(employee.id)}
                    >
                      <div className="flex items-center space-x-3">
                        {isGroupMode && (
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(employee.id)}
                            onChange={() => toggleEmployeeSelection(employee.id)}
                            className="rounded"
                          />
                        )}
                        
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
                          <p className={`font-medium truncate ${
                            selectedChat === employee.id ? 'text-white' : 'text-gray-900'
                          }`}>
                            {employee.fullName}
                          </p>
                          <p className={`text-xs truncate ${
                            selectedChat === employee.id ? 'text-white/70' : 'text-gray-500'
                          }`}>
                            Empleado
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Group messaging controls */}
                {isGroupMode && (
                  <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-600">
                        {selectedEmployees.length} empleados seleccionados
                      </span>
                      <div className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedEmployees(filteredEmployees.map(e => e.id))}
                        >
                          Todos
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedEmployees([])}
                        >
                          Ninguno
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Input
                        placeholder="Escribe tu mensaje grupal..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="resize-none"
                      />
                      <Button
                        onClick={sendGroupMessage}
                        disabled={selectedEmployees.length === 0 || !newMessage.trim()}
                        className="w-full"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Enviar a {selectedEmployees.length} empleados
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-2">
              {selectedChat ? (
                <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col overflow-hidden">
                  {/* Chat Header - Fixed */}
                  <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white rounded-t-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-oficaz-primary rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {filteredEmployees.find(e => e.id === selectedChat)?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {filteredEmployees.find(e => e.id === selectedChat)?.fullName}
                        </h3>
                        <p className="text-sm text-gray-500">Empleado</p>
                      </div>
                    </div>
                  </div>

                  {/* Messages - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 24rem)' }}>
                    <div className="space-y-4">
                      {getChatMessages(selectedChat).length > 0 ? (
                        getChatMessages(selectedChat).map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                message.senderId === user?.id
                                  ? 'bg-oficaz-primary text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                message.senderId === user?.id ? 'text-white/70' : 'text-gray-500'
                              }`}>
                                {format(new Date(message.createdAt), 'HH:mm')}
                              </p>
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
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Message Input - Fixed */}
                  <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white rounded-b-lg">
                    <div className="flex space-x-2">
                      <Input
                        ref={messageInputRef}
                        placeholder="Escribe tu mensaje..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        className="flex-1"
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 h-full flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Selecciona un empleado</h3>
                    <p>Elige un empleado de la lista para comenzar a chatear</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Employee view (keep existing dark theme)
  return (
    <div className="min-h-screen bg-employee-gradient text-white flex flex-col">
      {!selectedChat ? (
        <>
          {/* Header - Fixed at top for better visibility */}
          <div className="sticky top-0 bg-employee-gradient flex items-center justify-between p-6 pb-8 h-20 z-40">
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
              {company?.logoUrl ? (
                <img 
                  src={company.logoUrl} 
                  alt={company.name} 
                  className="w-8 h-8 mb-1 rounded-full object-cover"
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

          {/* Page Title */}
          <div className="px-6 pb-6">
            <h1 className="text-2xl font-bold text-white">Mensajes</h1>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col">
            {/* Chat List View */}
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

              {/* Contacts Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    {user?.role === 'employee' ? 'Tu Manager' : 'Empleados'}
                  </h3>
                  
                  {user?.role === 'admin' || user?.role === 'manager' ? (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant={isGroupMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setIsGroupMode(!isGroupMode);
                          setSelectedEmployees([]);
                        }}
                        className={isGroupMode ? 
                          "bg-blue-500 hover:bg-blue-600 text-white" : 
                          "border-white/30 text-white hover:bg-white/10"
                        }
                      >
                        <Users className="h-4 w-4 mr-1" />
                        {isGroupMode ? 'Cancelar' : 'Grupal'}
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Search Bar */}
                {user?.role === 'admin' || user?.role === 'manager' ? (
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
                    <Input
                      placeholder="Buscar empleados..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                ) : null}

                {/* Group Message Panel */}
                {isGroupMode && selectedEmployees.length > 0 && (
                  <div className="mb-4 p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">
                        {selectedEmployees.length} empleado(s) seleccionado(s)
                      </span>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            const allIds = filteredEmployees.map(emp => emp.id);
                            setSelectedEmployees(allIds);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Todos
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedEmployees([])}
                          className="border-white/30 text-white hover:bg-white/10"
                        >
                          Ninguno
                        </Button>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Mensaje grupal..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendGroupMessage();
                          }
                        }}
                      />
                      <Button
                        onClick={handleSendGroupMessage}
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Contact List */}
                <div className="space-y-3">
                  {user?.role === 'employee' ? (
                    // Employee view - show managers
                    ((managers as Manager[] || []).map(manager => (
                      <div 
                        key={manager.id}
                        onClick={() => setSelectedChat(manager.id)}
                        className="bg-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/20 transition-all duration-200 transform hover:scale-105"
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12 bg-blue-500">
                            <AvatarFallback className="bg-blue-500 text-white">
                              {manager.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{manager.fullName}</h4>
                            <p className="text-white/70 text-sm">{manager.role}</p>
                          </div>
                          {(() => {
                            const lastMessage = (messages as Message[] || [])
                              .filter(msg => (msg.senderId === manager.id && msg.receiverId === user?.id) ||
                                           (msg.senderId === user?.id && msg.receiverId === manager.id))
                              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                            
                            if (!lastMessage) return null;
                            
                            const unreadCount = (messages as Message[] || [])
                              .filter(msg => msg.senderId === manager.id && msg.receiverId === user?.id && !msg.isRead)
                              .length;
                            
                            return (
                              <div className="flex items-center space-x-2">
                                <div className="text-right">
                                  <p className="text-white/50 text-xs">
                                    {format(new Date(lastMessage.createdAt), 'HH:mm', { locale: es })}
                                  </p>
                                  {unreadCount > 0 && (
                                    <div className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-auto mt-1">
                                      {unreadCount}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )))
                  ) : (
                    // Admin/Manager view - show employees
                    (filteredEmployees.map(employee => (
                      <div 
                        key={employee.id}
                        onClick={() => {
                          if (isGroupMode) {
                            toggleEmployeeSelection(employee.id);
                          } else {
                            setSelectedChat(employee.id);
                          }
                        }}
                        className={`bg-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/20 transition-all duration-200 transform hover:scale-105 ${
                          isGroupMode && selectedEmployees.includes(employee.id) ? 'ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar className="h-12 w-12 bg-green-500">
                              <AvatarFallback className="bg-green-500 text-white">
                                {employee.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            {isGroupMode && (
                              <div className={`absolute -top-1 -right-1 w-5 h-5 rounded border-2 border-white flex items-center justify-center ${
                                selectedEmployees.includes(employee.id) ? 'bg-blue-500' : 'bg-white/20'
                              }`}>
                                {selectedEmployees.includes(employee.id) && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-white font-medium">{employee.fullName}</h4>
                              {!isGroupMode && (() => {
                                const lastSentMessage = (messages as Message[] || [])
                                  .filter(msg => msg.senderId === user?.id && msg.receiverId === employee.id)
                                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                
                                if (!lastSentMessage) return null;
                                
                                return (
                                  <div className="flex items-center text-xs">
                                    {lastSentMessage.isRead ? (
                                      <div className="flex items-center text-green-400">
                                        <Check className="h-3 w-3" />
                                        <Check className="h-3 w-3 -ml-1" />
                                      </div>
                                    ) : (
                                      <Check className="h-3 w-3 text-white/50" />
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            <p className="text-white/70 text-sm">Empleado</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {isGroupMode ? (
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                selectedEmployees.includes(employee.id) 
                                  ? 'bg-blue-500 border-blue-500' 
                                  : 'border-white/30'
                              }`}>
                                {selectedEmployees.includes(employee.id) && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                            ) : (
                              (() => {
                                const unreadCount = (messages as Message[] || [])
                                  .filter(msg => msg.senderId === employee.id && msg.receiverId === user?.id && !msg.isRead)
                                  .length;
                                
                                const lastMessage = (messages as Message[] || [])
                                  .filter(msg => (msg.senderId === employee.id && msg.receiverId === user?.id) ||
                                               (msg.senderId === user?.id && msg.receiverId === employee.id))
                                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                
                                return (
                                  <div className="text-right">
                                    {lastMessage && (
                                      <p className="text-white/50 text-xs">
                                        {format(new Date(lastMessage.createdAt), 'HH:mm', { locale: es })}
                                      </p>
                                    )}
                                    {unreadCount > 0 && (
                                      <div className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-auto mt-1">
                                        {unreadCount}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        </div>
                      </div>
                    )))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        // Chat View - Fixed header layout
        (<div className="h-screen bg-employee-gradient">
          {/* Chat Header - Fixed at top */}
          <div className="fixed top-0 left-0 right-0 bg-[#323A46] p-4 flex items-center space-x-3 border-b border-white/20 z-50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedChat(null);
                // Force scroll to top immediately and smooth for good UX
                setTimeout(() => {
                  window.scrollTo({ top: 0, behavior: 'auto' });
                  document.documentElement.scrollTop = 0;
                  document.body.scrollTop = 0;
                }, 50);
              }}
              className="text-white hover:bg-white/20 p-2 rounded-lg"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {(() => {
              const contact = user?.role === 'employee' 
                ? (managers as Manager[] || []).find(m => m.id === selectedChat)
                : (employees as any[] || []).find(e => e.id === selectedChat);
              
              return (
                <>
                  <Avatar className={`h-8 w-8 ${user?.role === 'employee' ? 'bg-blue-500' : 'bg-green-500'}`}>
                    <AvatarFallback className={`${user?.role === 'employee' ? 'bg-blue-500' : 'bg-green-500'} text-white text-sm`}>
                      {contact?.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white font-medium">
                      {contact?.fullName}
                    </p>
                    <p className="text-white/70 text-xs">
                      {user?.role === 'employee' ? contact?.role : 'Empleado'}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
          {/* Messages - Scrollable area with fixed header/footer */}
          <div className="pt-20 pb-20 p-4 space-y-4 overflow-y-auto h-screen">
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
                  <div className={`flex items-center justify-between mt-1 ${
                    msg.senderId === user?.id ? 'text-blue-100' : 'text-white/70'
                  }`}>
                    <span className="text-xs">
                      {format(new Date(msg.createdAt), 'HH:mm', { locale: es })}
                    </span>
                    {msg.senderId === user?.id && (user?.role === 'admin' || user?.role === 'manager') && (
                      <div className="flex items-center ml-2">
                        {msg.isRead ? (
                          <div className="flex">
                            <Check className="h-3 w-3 text-blue-200" />
                            <Check className="h-3 w-3 text-blue-200 -ml-1" />
                          </div>
                        ) : (
                          <Check className="h-3 w-3 text-white/50" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          {/* Message Input - Fixed at bottom */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#323A46] border-t border-white/20 z-50">
            <div className="flex space-x-2">
              <Input
                ref={messageInputRef}
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
                onFocus={() => {
                  setIsKeyboardOpen(true);
                  setTimeout(() => {
                    if (messageInputRef.current) {
                      messageInputRef.current.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center'
                      });
                    }
                  }, 300);
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setIsKeyboardOpen(false);
                  }, 300);
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
        </div>)
      )}
    </div>
  );
}