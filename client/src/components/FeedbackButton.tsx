import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Upload } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Type definitions
interface FeedbackButtonProps {
  variant?: 'floating' | 'discrete';
  hasAI?: boolean;
}

interface FeedbackButtonProps {
  variant?: 'floating' | 'discrete';
  hasAI?: boolean;
}

export function FeedbackButton({ variant = 'discrete', hasAI = false }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ subject?: string; message?: string }>({});
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalSize = attachedFiles.reduce((sum, f) => sum + f.size, 0) +
      files.reduce((sum, f) => sum + f.size, 0);
    
    if (totalSize > 20 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Tamaño total excedido',
        description: 'El tamaño total de archivos no puede exceder 20MB',
      });
      return;
    }
    
    setAttachedFiles([...attachedFiles, ...files]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: typeof errors = {};
    if (!subject.trim()) {
      newErrors.subject = "El asunto es obligatorio";
    } else if (subject.length > 200) {
      newErrors.subject = "El asunto no puede exceder 200 caracteres";
    }
    if (!message.trim()) {
      newErrors.message = "El mensaje es obligatorio";
    } else if (message.length < 10) {
      newErrors.message = "El mensaje debe tener al menos 10 caracteres";
    } else if (message.length > 2000) {
      newErrors.message = "El mensaje no puede exceder 2000 caracteres";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('message', message);
      formData.append('type', 'feedback');
      
      attachedFiles.forEach((file) => {
        formData.append('files', file);
      });

      await apiRequest('POST', '/api/contact/feedback', formData);
      
      toast({
        title: 'Gracias por tu feedback',
        description: 'Hemos recibido tu mensaje. Te responderemos pronto.',
      });
      
      setSubject('');
      setMessage('');
      setAttachedFiles([]);
      setIsOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar tu feedback. Intenta de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === 'floating') {
    return (
      <>
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed right-4 sm:right-6 z-50 cursor-pointer transition-all duration-300 hover:scale-105 px-4 py-2 h-auto text-white bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl border-0 [bottom:calc(env(safe-area-inset-bottom)+1rem)] sm:[bottom:calc(env(safe-area-inset-bottom)+1.5rem)]"
          title="Dar feedback"
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          <span className="hidden sm:inline">Dar Feedback</span>
          <span className="sm:hidden">Feedback</span>
        </Button>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-md max-h-[85svh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                <span>Dar feedback</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Asunto</label>
                <Input
                  placeholder="Ej: Sugerencia de mejora"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1"
                />
                {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
              </div>

              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  placeholder="Cuéntanos tu idea, sugerencia o problema..."
                  className="min-h-[120px] resize-none mt-1"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSubmitting}
                />
                {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium">Adjuntar archivos (opcional)</label>
                <div className="mt-2">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400" />
                        <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-semibold">Haz clic para subir</span> o arrastra
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          PDF, PNG, JPG, JPEG (Max. 10MB c/u, 20MB total)
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={handleFileChange}
                        disabled={isSubmitting}
                      />
                    </label>
                  </div>

                  {attachedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {attachedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded"
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-gray-500 hover:text-red-500"
                            disabled={isSubmitting}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Discrete variant (button next to AI)
  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="ghost"
        size="sm"
        title="Dar feedback"
        className="px-4 py-2 text-blue-600 hover:text-blue-700 backdrop-blur-sm bg-white/30 hover:bg-white/40 dark:text-blue-400 dark:hover:text-blue-300 dark:bg-slate-800/30 dark:hover:bg-slate-800/50 border border-white/20 dark:border-slate-700/30 rounded-lg transition-all hover:shadow-lg"
      >
        <MessageSquare className="h-4 w-4 mr-1" />
        Dar Feedback
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <span>Dar feedback</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Asunto</label>
              <Input
                placeholder="Ej: Sugerencia de mejora"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSubmitting}
                className="mt-1"
              />
              {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
            </div>

            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea
                placeholder="Cuéntanos tu idea, sugerencia o problema..."
                className="min-h-[120px] resize-none mt-1"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
              />
              {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium">Adjuntar archivos (opcional)</label>
              <div className="mt-2">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400" />
                      <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Haz clic para subir</span> o arrastra
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PDF, PNG, JPG, JPEG (Max. 10MB c/u, 20MB total)
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileChange}
                      disabled={isSubmitting}
                    />
                  </label>
                </div>

                {attachedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-gray-500 hover:text-red-500"
                          disabled={isSubmitting}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
