import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Send, 
  Inbox, 
  Mail, 
  MailOpen,
  User,
  Search,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function Messages() {
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState({
    receiverId: '',
    subject: '',
    content: '',
  });
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ['/api/messages'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: employees } = useQuery({
    queryKey: ['/api/employees'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/messages', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
      toast({
        title: 'Message Sent',
        description: 'Your message has been sent successfully.',
      });
      setIsComposeOpen(false);
      setNewMessage({ receiverId: '', subject: '', content: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Send Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/messages/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
    },
  });

  const handleMessageClick = (message: any) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      markAsReadMutation.mutate(message.id);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.receiverId || !newMessage.subject || !newMessage.content) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    sendMessageMutation.mutate({
      receiverId: parseInt(newMessage.receiverId),
      subject: newMessage.subject,
      content: newMessage.content,
    });
  };

  const filteredMessages = messages?.filter((message: any) =>
    message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.content.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const unreadCount = filteredMessages.filter((msg: any) => !msg.isRead).length;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 h-96 bg-gray-200 rounded-lg"></div>
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
          <p className="text-gray-500 mt-1">
            Communicate with your team members.
          </p>
        </div>
        <Button 
          onClick={() => setIsComposeOpen(true)}
          className="bg-oficaz-primary hover:bg-blue-700"
        >
          <Plus className="mr-2" size={16} />
          Compose
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Inbox</CardTitle>
                <Badge variant="secondary">
                  {unreadCount} unread
                </Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {filteredMessages.length > 0 ? (
                  filteredMessages.map((message: any) => (
                    <div
                      key={message.id}
                      onClick={() => handleMessageClick(message)}
                      className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedMessage?.id === message.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="text-gray-600" size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${
                              message.isRead ? 'text-gray-600' : 'text-gray-900'
                            }`}>
                              Sender #{message.senderId}
                            </p>
                            <div className="flex items-center space-x-1">
                              {!message.isRead && (
                                <div className="w-2 h-2 bg-oficaz-primary rounded-full"></div>
                              )}
                              {message.isRead ? (
                                <MailOpen className="text-gray-400" size={14} />
                              ) : (
                                <Mail className="text-oficaz-primary" size={14} />
                              )}
                            </div>
                          </div>
                          <p className={`text-sm truncate mt-1 ${
                            message.isRead ? 'text-gray-500' : 'text-gray-700 font-medium'
                          }`}>
                            {message.subject}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <Inbox className="mx-auto mb-4" size={48} />
                    <p>No messages found</p>
                    {searchTerm && (
                      <p className="text-sm mt-1">Try adjusting your search terms</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Message Details */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            {selectedMessage ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {selectedMessage.subject}
                      </h2>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>From: Sender #{selectedMessage.senderId}</span>
                        <span>
                          {format(new Date(selectedMessage.createdAt), 'MMM d, yyyy at h:mm a')}
                        </span>
                      </div>
                    </div>
                    {!selectedMessage.isRead && (
                      <Badge className="bg-oficaz-primary">New</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {selectedMessage.content}
                    </p>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <Mail className="mx-auto mb-4" size={48} />
                  <p className="text-lg mb-2">Select a message</p>
                  <p className="text-sm">Choose a message from the list to read it</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* Compose Message Dialog */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Compose Message</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div>
              <Label htmlFor="recipient">Recipient</Label>
              <Select
                value={newMessage.receiverId}
                onValueChange={(value) => setNewMessage(prev => ({ ...prev, receiverId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recipient" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map((employee: any) => (
                    <SelectItem key={employee.id} value={employee.id.toString()}>
                      {employee.firstName} {employee.lastName} ({employee.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={newMessage.subject}
                onChange={(e) => setNewMessage(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Enter message subject"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="content">Message</Label>
              <Textarea
                id="content"
                rows={6}
                value={newMessage.content}
                onChange={(e) => setNewMessage(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Type your message here..."
                required
              />
            </div>
            
            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsComposeOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sendMessageMutation.isPending}
                className="flex-1 bg-oficaz-primary hover:bg-blue-700"
              >
                {sendMessageMutation.isPending ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="mr-2" size={16} />
                    Send
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
