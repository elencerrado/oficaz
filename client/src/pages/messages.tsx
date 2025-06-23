import { useState, useEffect, useRef, useCallback } from 'react';
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
  Plus
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
}

interface Manager {
  id: number;
  fullName: string;
  role: string;
}

export default function Messages() {
  const { user, company } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const companyAlias = location.split('/')[1];

  // All state declarations together
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddChatModal, setShowAddChatModal] = useState(false);
  const [modalGroupMode, setModalGroupMode] = useState(false);
  const [modalSelectedEmployees, setModalSelectedEmployees] = useState<number[]>([]);
  const [modalMessage, setModalMessage] = useState('');
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Queries
  const { data: messages, isLoading: messagesLoading } = useQuery({
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

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { receiverId: number; subject: string; content: string }) => {
      return apiRequest('POST', '/api/messages', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      setNewMessage('');
      // Scroll to bottom after sending message
      requestAnimationFrame(() => {
        setTimeout(() => scrollToBottom(), 100);
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

  // Auto-scroll functionality enhanced for mobile
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Target mobile chat container specifically
        const mobileContainer = document.querySelector('.lg\\:hidden .overflow-y-auto');
        if (mobileContainer) {
          mobileContainer.scrollTop = mobileContainer.scrollHeight;
        }
        
        // Target desktop container
        const desktopContainer = document.querySelector('.hidden.lg\\:flex .overflow-y-auto');
        if (desktopContainer) {
          desktopContainer.scrollTop = desktopContainer.scrollHeight;
        }
      }, 100);
    });
  }, []);

  // Effects for auto-scroll - Enhanced for mobile fullscreen
  useEffect(() => {
    if (selectedChat) {
      // Force scroll immediately on chat selection
      const scrollMobileChat = () => {
        const container = document.querySelector('.z-\\[60\\] .overflow-y-auto');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      };
      
      // Multiple attempts with increasing delays for mobile rendering
      setTimeout(scrollMobileChat, 50);
      setTimeout(scrollMobileChat, 200);
      setTimeout(scrollMobileChat, 400);
      setTimeout(scrollMobileChat, 600);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (selectedChat && messages) {
      const chatMessages = getChatMessages(selectedChat);
      if (chatMessages.length > 0) {
        const scrollMobileChat = () => {
          const container = document.querySelector('.z-\\[60\\] .overflow-y-auto');
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        };
        
        setTimeout(scrollMobileChat, 100);
        setTimeout(scrollMobileChat, 300);
      }
    }
  }, [messages, selectedChat]);

  // Mark messages as read
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

  // Utility functions
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

  const getChatMessages = (chatId: number) => {
    if (!messages) return [];
    return (messages as Message[]).filter(msg => 
      (msg.senderId === user?.id && msg.receiverId === chatId) ||
      (msg.receiverId === user?.id && msg.senderId === chatId)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

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
      // Close modal first to avoid z-index issues with toast
      closeAddChatModal();
      
      // Send messages sequentially using the same format as individual messages
      for (const employeeId of modalSelectedEmployees) {
        await apiRequest('POST', '/api/messages', {
          receiverId: employeeId,
          subject: 'Mensaje grupal',
          content: modalMessage,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      
      // Show success toast after modal is closed
      setTimeout(() => {
        toast({
          title: "Mensajes enviados",
          description: `Mensaje enviado a ${modalSelectedEmployees.length} empleados`,
        });
      }, 100);
      
    } catch (error) {
      console.error('Error sending group message:', error);
      // Show error toast after modal is closed
      setTimeout(() => {
        toast({
          title: "Error",
          description: "No se pudieron enviar los mensajes",
          variant: "destructive",
        });
      }, 100);
    }
  };

  // Loading state
  if (messagesLoading) {
    return <PageLoading message="Cargando mensajes..." />;
  }

  // Filter employees based on search and exclude current user
  const contactList = user?.role === 'employee' ? (managers as Manager[] || []) : (employees as Employee[] || []);
  const filteredEmployees = contactList.filter(person => 
    person.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) && person.id !== user?.id
  );

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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 icon-sm" />
                  <Input
                    placeholder="Buscar empleado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-oficaz bg-gray-50"
                    style={{ paddingLeft: '2.75rem' }}
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
                        <p className={`truncate text-xs ${
                          selectedChat === employee.id ? 'text-white/90' : 'text-gray-500'
                        }`}>
                          Empleado
                        </p>
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
                        <p className="caption-text">Empleado</p>
                      </div>
                    </div>
                  </div>

                  {/* Messages - Scrollable middle section */}
                  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 bg-gray-50">
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
                                  : 'bg-white text-gray-900 border border-gray-200'
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
                    </div>
                  </div>

                  {/* Message Input - Fixed at bottom */}
                  <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
                    <div className="flex space-x-2">
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
            <div className="flex-1 flex flex-col min-h-0">
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 icon-sm" />
                  <Input
                    placeholder="Buscar empleado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-oficaz bg-gray-50 pl-10"
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
                          <p className="text-sm text-gray-500 truncate">
                            Empleado
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Chat View - Full screen overlay */
            <div className="fixed inset-0 bg-white z-[60] flex flex-col lg:hidden">
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
                    {filteredEmployees.find(e => e.id === selectedChat)?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {filteredEmployees.find(e => e.id === selectedChat)?.fullName}
                  </h3>
                  <p className="text-sm text-gray-500">Empleado</p>
                </div>
              </div>

              {/* Messages - Scrollable area */}
              <div className="flex-1 overflow-y-auto px-4 bg-gray-50" style={{ paddingBottom: '8px' }}>
                <div className="space-y-4 pt-4">
                  {getChatMessages(selectedChat).length > 0 ? (
                    getChatMessages(selectedChat).map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            message.senderId === user?.id
                              ? 'bg-oficaz-primary text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
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
                      <p className="text-sm">Envía el primer mensaje para comenzar</p>
                    </div>
                  )}
                </div>
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
                  style={{ 
                    fontSize: '16px',
                    minHeight: '44px'
                  }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="btn-oficaz-primary min-h-[44px]"
                >
                  <Send className="icon-sm" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Add Chat Modal */}
        <Dialog open={showAddChatModal} onOpenChange={setShowAddChatModal}>
            <DialogContent className="sm:max-w-md" aria-describedby="dialog-description">
              <DialogHeader>
                <DialogTitle>Crear Nueva Conversación</DialogTitle>
                <p id="dialog-description" className="text-sm text-gray-500">
                  Selecciona empleados para iniciar una conversación individual o enviar un mensaje grupal
                </p>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Toggle between individual and group mode */}
                <div className="flex items-center justify-center">
                  <Button
                    variant={modalGroupMode ? "outline" : "default"}
                    size="sm"
                    onClick={() => {
                      setModalGroupMode(false);
                      setModalSelectedEmployees([]);
                    }}
                    className="mr-2"
                  >
                    Chat Individual
                  </Button>
                  <Button
                    variant={modalGroupMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setModalGroupMode(true)}
                  >
                    <Users className="icon-sm mr-2" />
                    Chat Grupal
                  </Button>
                </div>

                {/* Modal Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 icon-sm" />
                  <Input
                    placeholder="Buscar empleado..."
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="input-oficaz bg-gray-50"
                    style={{ paddingLeft: '2.75rem' }}
                  />
                </div>

                {/* Employee List */}
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <div className="p-2 space-y-1">
                    {filteredEmployees
                      .filter(employee => 
                        employee.fullName?.toLowerCase().includes(modalSearchTerm.toLowerCase()) && employee.id !== user?.id
                      )
                      .map((employee) => (
                      <div
                        key={employee.id}
                        className={`p-3 rounded-lg cursor-pointer border transition-all duration-200 hover:bg-gray-50 ${
                          modalGroupMode && modalSelectedEmployees.includes(employee.id)
                            ? 'bg-oficaz-primary/10 border-oficaz-primary'
                            : 'border-gray-200'
                        }`}
                        onClick={() => modalGroupMode ? toggleModalEmployeeSelection(employee.id) : startIndividualChat(employee.id)}
                      >
                        <div className="flex items-center space-x-3">
                          {modalGroupMode && (
                            <input
                              type="checkbox"
                              checked={modalSelectedEmployees.includes(employee.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleModalEmployeeSelection(employee.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded"
                            />
                          )}
                          
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-oficaz-primary text-white text-xs">
                            {employee.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate text-gray-900">
                              {employee.fullName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              Empleado
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group Message Input */}
                {modalGroupMode && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {modalSelectedEmployees.length} empleados seleccionados
                      </span>
                      <div className="space-x-2">
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
                    </div>
                    
                    <Input
                      placeholder="Escribe tu mensaje grupal..."
                      value={modalMessage}
                      onChange={(e) => setModalMessage(e.target.value)}
                      className="input-oficaz"
                    />
                    
                    <Button
                      onClick={sendModalGroupMessage}
                      disabled={modalSelectedEmployees.length === 0 || !modalMessage.trim()}
                      className="btn-oficaz-primary w-full"
                    >
                      <Send className="icon-sm mr-2" />
                      Enviar a {modalSelectedEmployees.length} empleados
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
      </div>
    );
  }

  // Employee view (simplified version)
  return (
    <div className="min-h-screen bg-employee-gradient text-white flex flex-col">
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

      <div className="px-6 pb-6">
        <h1 className="text-2xl font-bold text-white">Mensajes</h1>
      </div>

      <div className="flex-1 flex flex-col px-6">
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
      </div>
    </div>
  );
}