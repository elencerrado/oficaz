import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import { RecipientSelector } from './recipient-selector';
import { EmailPreviewEditor } from './email-preview-editor';

interface EmailContent {
  subtitle: string;
  heading: string;
  paragraph: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl?: string;
  signature: string;
}

export function CreateCampaignDialog() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    preheader: '',
    audienceType: 'subscribers' as 'subscribers' | 'one_time', // subscribers (con footer) | one_time (sin footer)
    selectedEmails: [] as string[],
  });

  const [emailContent, setEmailContent] = useState<EmailContent>({
    subtitle: '',
    heading: '',
    paragraph: '',
    buttonText: '',
    buttonUrl: '',
    imageUrl: '',
    signature: '',
  });

  const generateHtmlContent = (content: EmailContent, audienceType: 'subscribers' | 'one_time' = 'subscribers') => {
    // Footer condicional: solo para suscritos incluye el texto de "Este correo fue enviado desde Oficaz"
    const footerContent = audienceType === 'subscribers' 
      ? `<p style="margin: 0 0 10px; color: #666; font-size: 14px;">© ${new Date().getFullYear()} Oficaz. Todos los derechos reservados.</p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                Este correo fue enviado desde Oficaz<br/>
                <a href="https://oficaz.es/api/email/unsubscribe?email={{{recipient_email}}}" style="color: #007AFF; text-decoration: none;">Cancelar suscripción</a>
              </p>`
      : `<p style="margin: 0; color: #666; font-size: 14px;">© ${new Date().getFullYear()} Oficaz. Todos los derechos reservados.</p>`;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${formData.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  ${formData.preheader ? `<div style="display: none; max-height: 0px; overflow: hidden;">${formData.preheader}</div>` : ''}
  <!-- OFICAZ_TEMPLATE_V1 -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Logo Header with Subtitle -->
          <tr>
            <td style="background: #007AFF; padding: ${content.subtitle ? '30px 20px 20px' : '30px 20px'}; text-align: center;">
              <img src="${window.location.protocol}//${window.location.host}/email-logo-white.png" alt="Oficaz Logo" height="40" style="height: 40px; width: auto; max-width: 200px; display: block; margin: 0 auto ${content.subtitle ? '15px' : '0'} auto;" />
              <!-- Subtitle -->
              ${content.subtitle ? `<p style="margin: 0; color: #ffffff; font-size: 14px; line-height: 1.5; font-weight: 500;">${content.subtitle.replace(/\n/g, '<br/>')}</p>` : ''}
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 40px 20px;">
              ${content.heading ? `<h1 style="margin: 0 0 20px; color: #007AFF; font-size: 24px; font-weight: 600; line-height: 1.3;">${content.heading.replace(/\n/g, '<br/>')}</h1>` : ''}
              ${content.paragraph ? `<p style="margin: 0; color: #444; font-size: 16px; line-height: 1.6;">${content.paragraph.replace(/\n/g, '<br/>')}</p>` : ''}
            </td>
          </tr>
          
          <!-- Button -->
          ${content.buttonText && content.buttonUrl ? `
          <tr>
            <td style="padding: 20px 40px 30px; text-align: center;">
              <a href="${content.buttonUrl}" style="display: inline-block; background: #007AFF; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">${content.buttonText}</a>
            </td>
          </tr>
          ` : '<tr><td style="padding-bottom: 20px;"></td></tr>'}
          
          <!-- Optional Image -->
          ${content.imageUrl ? `
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <img src="${content.imageUrl}" alt="Email content" style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
            </td>
          </tr>
          ` : ''}
          
          <!-- Signature -->
          ${content.signature ? `
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5; font-style: italic;">${content.signature.replace(/\n/g, '<br/>')}</p>
            </td>
          </tr>
          ` : ''}
          
          <!-- WhatsApp Contact -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; background-color: #ffffff;">
              <a href="https://wa.me/34614028600" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #25D366; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; border: none;">
                💬 Escríbenos por WhatsApp
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 40px; border-top: 1px solid #e9ecef; text-align: center;">
              ${footerContent}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  };

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/email-campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create campaign');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Campaña creada',
        description: 'La campaña se ha creado correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-campaigns'] });
      setOpen(false);
      setCurrentStep(1);
      setFormData({
        name: '',
        subject: '',
        preheader: '',
        audienceType: 'subscribers',
        selectedEmails: [],
      });
      setEmailContent({
        subtitle: '',
        heading: '',
        paragraph: '',
        buttonText: '',
        buttonUrl: '',
        signature: '',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo crear la campaña',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    // Define default placeholders to use if fields are empty
    const defaultPlaceholders = {
      subtitle: 'APP de gestión empresarial para los que lo quieren FÁCIL',
      heading: '',
      paragraph: '',
      buttonText: '',
      buttonUrl: '',
      signature: 'Saludos cordiales',
    };
    
    // Fill empty fields with default placeholders
    const contentWithDefaults = {
      subtitle: emailContent.subtitle || defaultPlaceholders.subtitle,
      heading: emailContent.heading || defaultPlaceholders.heading,
      paragraph: emailContent.paragraph || defaultPlaceholders.paragraph,
      buttonText: emailContent.buttonText || defaultPlaceholders.buttonText,
      buttonUrl: emailContent.buttonUrl || defaultPlaceholders.buttonUrl,
      signature: emailContent.signature || defaultPlaceholders.signature,
    };
    
    const htmlContent = generateHtmlContent(contentWithDefaults, formData.audienceType);
    createCampaignMutation.mutate({
      ...formData,
      htmlContent,
      audienceType: formData.audienceType, // 'subscribers' o 'one_time'
      targetAudience: 'registered_users',
      includeActiveSubscriptions: true,
      includeTrialSubscriptions: true,
      includeBlockedSubscriptions: false,
      includeCancelledSubscriptions: false,
      includeProspects: false,
    });
  };

  const canProceedStep1 = formData.name && formData.subject;
  const canProceedStep2 = true; // Content is optional
  const canSubmit = formData.selectedEmails.length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setCurrentStep(1);
    }}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-create-campaign">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Campaña
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Crear Nueva Campaña - Paso {currentStep} de 3</DialogTitle>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-2 w-20 rounded-full transition-colors ${
                step === currentStep ? 'bg-blue-500' : step < currentStep ? 'bg-blue-400/50' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-white">Nombre de la Campaña</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Newsletter Septiembre 2024"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                data-testid="input-campaign-name"
              />
            </div>

            <div>
              <Label htmlFor="subject" className="text-white">Asunto del Email</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Ej: Novedades de Oficaz - Septiembre"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                data-testid="input-campaign-subject"
              />
            </div>

            <div>
              <Label htmlFor="preheader" className="text-white">Preheader (opcional)</Label>
              <Input
                id="preheader"
                value={formData.preheader}
                onChange={(e) => setFormData({ ...formData, preheader: e.target.value })}
                placeholder="Texto que aparece junto al asunto en el inbox"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                data-testid="input-campaign-preheader"
              />
              <p className="text-xs text-white/50 mt-1">Este texto aparece como preview del email</p>
            </div>

            <div>
              <Label className="text-white mb-2 block">Tipo de Campaña</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, audienceType: 'subscribers' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.audienceType === 'subscribers'
                      ? 'border-blue-400 bg-blue-500/20'
                      : 'border-white/20 bg-white/5 hover:border-white/40'
                  }`}
                  data-testid="button-audience-subscribers"
                >
                  <div className="text-left">
                    <div className="font-semibold text-white mb-1">Suscritos</div>
                    <div className="text-xs text-white/60">
                      Usuarios que aceptaron recibir emails comerciales. Incluye footer con opción de cancelar suscripción.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, audienceType: 'one_time' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.audienceType === 'one_time'
                      ? 'border-blue-400 bg-blue-500/20'
                      : 'border-white/20 bg-white/5 hover:border-white/40'
                  }`}
                  data-testid="button-audience-onetime"
                >
                  <div className="text-left">
                    <div className="font-semibold text-white mb-1">Campaña Puntual</div>
                    <div className="text-xs text-white/60">
                      Para prospectos y captación. Sin footer de cancelación.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Email Content */}
        {currentStep === 2 && (
          <EmailPreviewEditor
            content={emailContent}
            onChange={setEmailContent}
            audienceType={formData.audienceType}
          />
        )}

        {/* Step 3: Recipients */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4 mb-4">
              <p className="text-sm text-white/70">
                Selecciona los destinatarios que recibirán esta campaña. Puedes elegir usuarios registrados por estado de suscripción y/o prospects externos.
              </p>
            </div>
            
            <div className="space-y-3">
              <Label className="text-white">Destinatarios</Label>
              <RecipientSelector
                selectedEmails={formData.selectedEmails}
                onSelectionChange={(emails) => setFormData({ ...formData, selectedEmails: emails })}
                audienceType={formData.audienceType}
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-white/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : setOpen(false)}
            className="border-white/20 text-white hover:bg-white/10"
            data-testid="button-previous-step"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {currentStep === 1 ? 'Cancelar' : 'Anterior'}
          </Button>

          {currentStep < 3 ? (
            <Button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={currentStep === 1 && !canProceedStep1}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-next-step"
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || createCampaignMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-create-campaign"
            >
              {createCampaignMutation.isPending ? 'Creando...' : 'Crear Campaña'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
