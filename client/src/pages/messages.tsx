import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Send, 
  ArrowLeft,
  User,
  MessageCircle,
  Check,
  Search,
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

interface Manager {
  id: number;
  fullName: string;
  role: string;
}

interface Employee {
  id: number;
  fullName: string;
  role: string;
  email?: string;
}

export default function Messages() {
  // ALL HOOKS FIRST - NEVER CONDITIONAL
  const { user, company } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  
  // All state hooks
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // All queries - always run
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/messages'],
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 10000,
  });

  const { data: managers } = useQuery({
    queryKey: ['/api/managers'],
    enabled: !!user,
    staleTime: 60000,
  });

  const { data: employees } = useQuery({
    queryKey: ['/api/employees'],
    enabled: !!user,
    staleTime: 60000,
  });

  // All mutations
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

  // All useMemo/useCallback FIRST
  const contactList = useMemo(() => {
    if (!user) return [];
    return user.role === 'employee' ? (managers || []) : (employees || []);
  }, [user?.role, managers, employees]);

  const filteredContacts = useMemo(() => {
    return contactList.filter(person => 
      person.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) && person.id !== user?.id
    );
  }, [contactList, searchTerm, user?.id]);

  const chatMessages = useMemo(() => {
    if (!selectedChat || !messages || !user) return [];
    return (messages as Message[]).filter(msg => 
      (msg.senderId === user.id && msg.receiverId === selectedChat) ||
      (msg.receiverId === user.id && msg.senderId === selectedChat)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [selectedChat, messages, user]);

  // All useEffects AFTER
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const chatParam = urlParams.get('chat');
    if (chatParam && user) {
      const chatId = parseInt(chatParam);
      setSelectedChat(chatId);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user]);

  // Auto scroll to bottom when new messages arrive or chat changes
  useEffect(() => {
    if (messagesEndRef.current && selectedChat) {
      // Instant scroll when opening chat, smooth when new messages
      const behavior = chatMessages.length > 0 ? 'smooth' : 'auto';
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, [chatMessages, selectedChat]);

  const selectedChatUser = useMemo(() => {
    if (!selectedChat) return null;
    return contactList.find(person => person.id === selectedChat) || null;
  }, [selectedChat, contactList]);

  const handleSendMessage = useCallback(() => {
    if (!selectedChat || !newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      receiverId: selectedChat,
      subject: 'Mensaje',
      content: newMessage,
    });
  }, [selectedChat, newMessage, sendMessageMutation]);

  const getUnreadCount = useCallback((contactId: number) => {
    if (!messages || !user) return 0;
    return (messages as Message[]).filter(msg => 
      msg.senderId === contactId && 
      msg.receiverId === user.id && 
      !msg.isRead
    ).length;
  }, [messages, user]);

  // Role display helper with icons - shows actual data from database
  const getRoleDisplay = useCallback((person: any) => {
    if (!person) return null;
    
    const role = person.role || 'employee';
    const displayText = person.jobTitle || person.position || 'Sin cargo definido';
    
    // Icon color and letter based on role
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
        <span className="text-xs">{displayText}</span>
      </div>
    );
  }, []);

  // EARLY RETURNS AFTER ALL HOOKS
  if (!user) {
    return <PageLoading />;
  }

  if (messagesLoading) {
    return <PageLoading message="Cargando mensajes..." />;
  }

  const companyAlias = location.split('/')[1];

  // ADMIN/MANAGER VIEW
  if (user.role === 'admin' || user.role === 'manager') {
    return (
      <div className="px-6 py-4 min-h-screen bg-gray-50">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Mensajes</h1>
          <p className="text-gray-500 mt-1">
            Comunícate con empleados y gestiona mensajes
          </p>
        </div>

        <div className="hidden lg:flex gap-6 h-[calc(100vh-180px)]">
          {/* Employee List */}
          <div className="w-1/3 bg-white rounded-lg border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-lg">Conversaciones ({filteredContacts.length})</h2>
              
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar empleado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {filteredContacts.map((contact) => {
                const unreadCount = getUnreadCount(contact.id);
                return (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedChat(contact.id)}
                    className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
                      selectedChat === contact.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
                      {contact.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 ml-3 min-w-0">
                      <p className="font-medium text-sm truncate">{contact.fullName}</p>
                      <div className="text-gray-500">
                        {getRoleDisplay(contact)}
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{unreadCount}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col">
            {selectedChat && selectedChatUser ? (
              <>
                <div className="p-4 border-b border-gray-200 flex items-center">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
                    {selectedChatUser.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium">{selectedChatUser.fullName}</p>
                    <div className="text-sm text-gray-500">
                      {getRoleDisplay(selectedChatUser)}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] p-3 rounded-lg ${
                        message.senderId === user.id 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-xs ${message.senderId === user.id ? 'text-blue-100' : 'text-gray-500'}`}>
                            {format(new Date(message.createdAt), 'HH:mm', { locale: es })}
                          </p>
                          {message.senderId === user.id && (
                            <Check className={`h-3 w-3 ml-2 ${message.isRead ? 'text-green-400' : 'text-gray-300'}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="Escribe un mensaje..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      size="sm"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Selecciona una conversación para empezar</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile view */}
        <div className="lg:hidden">
          {!selectedChat ? (
            <div className="space-y-2">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar empleado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {filteredContacts.map((contact) => {
                const unreadCount = getUnreadCount(contact.id);
                return (
                  <Card key={contact.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedChat(contact.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
                            {contact.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium">{contact.fullName}</p>
                            <div className="text-sm text-gray-500">
                              {getRoleDisplay(contact)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {unreadCount > 0 && (
                            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{unreadCount}</span>
                            </div>
                          )}
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="fixed inset-0 bg-white z-50 flex flex-col">
              <div className="bg-blue-500 text-white p-4 flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChat(null)}
                  className="text-white hover:bg-white/10 mr-3"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{selectedChatUser?.fullName}</p>
                    <p className="text-white/70 text-xs capitalize">{selectedChatUser?.role || 'empleado'}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg ${
                      message.senderId === user.id 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className={`text-xs ${message.senderId === user.id ? 'text-blue-100' : 'text-gray-500'}`}>
                          {format(new Date(message.createdAt), 'HH:mm', { locale: es })}
                        </p>
                        {message.senderId === user.id && (
                          <Check className={`h-3 w-3 ml-2 ${message.isRead ? 'text-green-400' : 'text-gray-300'}`} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    size="sm"
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

  // EMPLOYEE VIEW
  return (
    <div className="fixed inset-0 bg-employee-gradient text-white flex flex-col">
      <div className="sticky top-0 bg-employee-gradient flex items-center justify-between p-6 pb-4 h-16 z-40 border-b border-white/10">
        <Link href={`/${companyAlias}/inicio`}>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <h1 className="text-lg font-medium text-white">Mensajes</h1>
        <div className="w-16"></div>
      </div>

      {!selectedChat ? (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {filteredContacts.map((contact) => {
              const unreadCount = getUnreadCount(contact.id);
              return (
                <div
                  key={contact.id}
                  onClick={() => setSelectedChat(contact.id)}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-4 cursor-pointer hover:bg-white/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{contact.fullName}</p>
                        <div className="text-white/70 text-sm">
                          {getRoleDisplay(contact)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {unreadCount > 0 && (
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{unreadCount}</span>
                        </div>
                      )}
                      <ChevronRight className="h-5 w-5 text-white/70" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-white/10 backdrop-blur-sm p-4 flex items-center border-b border-white/20 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedChat(null)}
              className="text-white hover:bg-white/10 mr-3"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">{selectedChatUser?.fullName}</p>
                <p className="text-white/70 text-xs capitalize">{selectedChatUser?.role || 'responsable'}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 min-h-0 flex flex-col">
            <div className="flex-1"></div>
            <div className="space-y-4">
              {chatMessages.map((message) => (
              <div key={message.id} className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  message.senderId === user.id 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-white'
                }`}>
                  <p className="text-sm">{message.content}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className={`text-xs ${message.senderId === user.id ? 'text-blue-100' : 'text-white/50'}`}>
                      {format(new Date(message.createdAt), 'HH:mm', { locale: es })}
                    </p>
                    {message.senderId === user.id && (
                      <Check className="h-3 w-3 ml-2 text-green-400" />
                    )}
                  </div>
                </div>
              </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 border-t border-white/20 flex-shrink-0 bg-employee-gradient">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Escribe un mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                size="sm"
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}