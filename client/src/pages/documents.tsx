import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Search,
  File,
  Image,
  Video,
  Music
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['/api/documents'],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: 'File Uploaded',
        description: 'Your document has been uploaded successfully.',
      });
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: 'Document Deleted',
        description: 'The document has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please select a file smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    uploadMutation.mutate(file);
  };

  const handleDownload = async (id: number, filename: string) => {
    try {
      const response = await fetch(`/api/documents/${id}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Unable to download the file.',
        variant: 'destructive',
      });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.startsWith('audio/')) return Music;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocuments = documents?.filter((doc: any) =>
    doc.originalName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Documents</h1>
          <p className="text-gray-500 mt-1">
            Upload and manage your documents and files.
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-oficaz-primary hover:bg-blue-700"
                >
                  {isUploading ? 'Uploading...' : 'Choose File'}
                </Button>
                <span className="text-sm text-gray-500">
                  or drag and drop files here
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Maximum file size: 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-gray-500">
              {filteredDocuments.length} documents
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Grid */}
      {filteredDocuments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((document: any) => {
            const FileIcon = getFileIcon(document.mimeType);
            
            return (
              <Card key={document.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileIcon className="text-oficaz-primary" size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {document.originalName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(document.fileSize)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(document.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <Badge variant="secondary" className="text-xs">
                      {document.mimeType.split('/')[0]}
                    </Badge>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(document.id, document.originalName)}
                      >
                        <Download size={14} />
                      </Button>
                      {(document.userId === user?.id || ['admin', 'manager'].includes(user?.role || '')) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(document.id)}
                          disabled={deleteMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'No documents found' : 'No documents yet'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms.'
                  : 'Upload your first document to get started.'
                }
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-oficaz-primary hover:bg-blue-700"
                >
                  <Upload className="mr-2" size={16} />
                  Upload Document
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
