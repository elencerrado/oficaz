import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, Mail, CheckCircle, XCircle } from "lucide-react";

interface SendingProgressDialogProps {
  isOpen: boolean;
  status: 'preparing' | 'sending' | 'success' | 'error';
  totalEmails: number;
  successCount?: number;
  failCount?: number;
  errorMessage?: string;
  onClose?: () => void;
}

export function SendingProgressDialog({
  isOpen,
  status,
  totalEmails,
  successCount = 0,
  failCount = 0,
  errorMessage,
  onClose
}: SendingProgressDialogProps) {
  
  const getStatusIcon = () => {
    switch (status) {
      case 'preparing':
      case 'sending':
        return <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'error':
        return <XCircle className="w-12 h-12 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'preparing':
        return 'Preparando envío...';
      case 'sending':
        return 'Enviando correos...';
      case 'success':
        return '¡Envío completado!';
      case 'error':
        return 'Error en el envío';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'preparing':
        return `Preparando ${totalEmails} correo${totalEmails !== 1 ? 's' : ''} para enviar`;
      case 'sending':
        return `Enviando a ${totalEmails} destinatario${totalEmails !== 1 ? 's' : ''}...`;
      case 'success':
        return `${successCount} correo${successCount !== 1 ? 's enviados' : ' enviado'} correctamente${failCount > 0 ? ` · ${failCount} fallo${failCount !== 1 ? 's' : ''}` : ''}`;
      case 'error':
        return errorMessage || 'Ha ocurrido un error durante el envío';
    }
  };

  const progress = status === 'success' ? 100 : status === 'sending' ? 50 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={status === 'success' || status === 'error' ? onClose : undefined}>
      <DialogContent 
        className="sm:max-w-md bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-xl border-white/20 text-white"
      >
        <div className="flex flex-col items-center justify-center py-6 space-y-6">
          {/* Icon */}
          <div className="flex items-center justify-center">
            {getStatusIcon()}
          </div>

          {/* Status text */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-white">
              {getStatusText()}
            </h3>
            <p className="text-sm text-white/70">
              {getStatusDescription()}
            </p>
          </div>

          {/* Progress bar (only show during preparation and sending) */}
          {(status === 'preparing' || status === 'sending') && (
            <div className="w-full space-y-2">
              <Progress value={progress} className="h-2 bg-white/20" />
              <div className="flex items-center justify-center gap-2 text-xs text-white/60">
                <Mail className="w-3.5 h-3.5" />
                <span>Esto puede tardar unos segundos...</span>
              </div>
            </div>
          )}

          {/* Success details */}
          {status === 'success' && (
            <div className="w-full space-y-2">
              <div className="flex items-center justify-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-white/80">{successCount} enviados</span>
                </div>
                {failCount > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-white/80">{failCount} fallos</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Close button (only for success/error) */}
          {(status === 'success' || status === 'error') && onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white font-medium"
              data-testid="button-close-sending-dialog"
            >
              Cerrar
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
