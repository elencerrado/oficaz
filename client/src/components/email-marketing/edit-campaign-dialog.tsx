import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronRight, ChevronLeft, Trash2 } from 'lucide-react';
import { RecipientSelector } from './recipient-selector';
import { EmailPreviewEditor } from './email-preview-editor';

interface EditCampaignDialogProps {
  campaign: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EmailContent {
  subtitle: string;
  heading: string;
  paragraph: string;
  buttonText: string;
  buttonUrl: string;
  signature: string;
}

export function EditCampaignDialog({ campaign, open, onOpenChange }: EditCampaignDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    preheader: '',
    selectedEmails: [] as string[],
    targetAudience: 'registered_users' as string,
    includeActiveSubscriptions: true,
    includeTrialSubscriptions: true,
    includeBlockedSubscriptions: false,
    includeCancelledSubscriptions: false,
    includeProspects: false,
  });

  const [emailContent, setEmailContent] = useState<EmailContent>({
    subtitle: '',
    heading: '',
    paragraph: '',
    buttonText: '',
    buttonUrl: '',
    signature: '',
  });

  const [useRawHtml, setUseRawHtml] = useState(false);
  const [rawHtmlContent, setRawHtmlContent] = useState('');

  // Parse HTML to extract visual content (simple text extraction)
  const parseHtmlContent = (html: string): EmailContent | null => {
    // Check for template marker - only parse if it's our template
    if (!html.includes('<!-- OFICAZ_TEMPLATE_V1 -->')) {
      return null;
    }

    try {
      // Helper function to convert <br/> back to newlines and clean HTML
      const cleanHtml = (text: string): string => {
        return text
          .replace(/<br\s*\/?>/gi, '\n')
          .trim();
      };

      // Extract subtitle - look for p tag in blue header (after logo, before Main Content)
      // First try with comment marker
      let subtitleMatch = html.match(/<!-- Subtitle -->[\s\S]*?<p[^>]*>(.*?)<\/p>/);
      // If not found, look for p tag in blue background section (between img and Main Content comment)
      if (!subtitleMatch) {
        const blueHeaderSection = html.match(/background:\s*#007AFF[\s\S]*?<\/tr>/i);
        if (blueHeaderSection) {
          subtitleMatch = blueHeaderSection[0].match(/<p[^>]*>(.*?)<\/p>/);
        }
      }
      
      // Extract heading (h1 tag)
      const headingMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/);
      
      // Extract paragraph - find the section after "Main Content" comment
      let paragraphMatch = null;
      const mainContentSection = html.split(/<!-- Main Content -->/)[1];
      if (mainContentSection) {
        // Get first <p> tag in main content (not h1)
        paragraphMatch = mainContentSection.match(/<p[^>]*>(.*?)<\/p>/);
      }
      
      // Extract button text and URL
      const buttonTextMatch = html.match(/<a[^>]*style="[^"]*display: inline-block[^"]*"[^>]*>(.*?)<\/a>/);
      const buttonUrlMatch = html.match(/<a[^>]*href="([^"]+)"[^>]*style="[^"]*display: inline-block[^"]*"/);
      
      // Extract signature - look for p tag with italic style or after Signature comment
      let signatureMatch = html.match(/<!-- Signature -->[\s\S]*?<p[^>]*>(.*?)<\/p>/);
      if (!signatureMatch) {
        // Try finding italic paragraph after button
        const afterButton = html.split(/<\/a>[\s\S]*?<\/tr>/)[1];
        if (afterButton) {
          signatureMatch = afterButton.match(/<p[^>]*font-style:\s*italic[^>]*>(.*?)<\/p>/);
        }
      }

      return {
        subtitle: subtitleMatch ? cleanHtml(subtitleMatch[1]) : '',
        heading: headingMatch ? cleanHtml(headingMatch[1]) : '',
        paragraph: paragraphMatch ? cleanHtml(paragraphMatch[1]) : '',
        buttonText: buttonTextMatch ? buttonTextMatch[1].trim() : '',
        buttonUrl: buttonUrlMatch ? buttonUrlMatch[1].trim() : '',
        signature: signatureMatch ? cleanHtml(signatureMatch[1]) : '',
      };
    } catch (e) {
      console.error('Error parsing HTML:', e);
      // If parsing fails, return null
    }
    return null;
  };

  // Update form data when campaign changes
  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name || '',
        subject: campaign.subject || '',
        preheader: campaign.preheader || '',
        selectedEmails: campaign.selectedEmails || [],
        targetAudience: campaign.targetAudience || 'registered_users',
        includeActiveSubscriptions: campaign.includeActiveSubscriptions ?? true,
        includeTrialSubscriptions: campaign.includeTrialSubscriptions ?? true,
        includeBlockedSubscriptions: campaign.includeBlockedSubscriptions ?? false,
        includeCancelledSubscriptions: campaign.includeCancelledSubscriptions ?? false,
        includeProspects: campaign.includeProspects ?? false,
      });

      // Try to parse HTML content
      const parsed = parseHtmlContent(campaign.htmlContent || '');
      if (parsed) {
        setEmailContent(parsed);
        setUseRawHtml(false);
      } else {
        // Fallback to raw HTML editing for old campaigns
        setRawHtmlContent(campaign.htmlContent || '');
        setUseRawHtml(true);
      }
      
      setCurrentStep(1);
    }
  }, [campaign]);

  const generateHtmlContent = (content: EmailContent) => {
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
              <img src="${window.location.origin}/email-logo-white.png" alt="Oficaz Logo" height="40" style="height: 40px; width: auto; max-width: 200px; display: block; margin: 0 auto ${content.subtitle ? '15px' : '0'} auto;" />
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
          
          <!-- Signature -->
          ${content.signature ? `
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5; font-style: italic;">${content.signature.replace(/\n/g, '<br/>')}</p>
            </td>
          </tr>
          ` : ''}
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 40px; border-top: 1px solid #e9ecef; text-align: center;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">© ${new Date().getFullYear()} Oficaz. Todos los derechos reservados.</p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                Este correo fue enviado desde Oficaz<br/>
                <a href="{{{unsubscribe_url}}}" style="color: #007AFF; text-decoration: none;">Cancelar suscripción</a>
              </p>
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

  const updateCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update campaign');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Campaña actualizada',
        description: 'Los cambios se han guardado correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-campaigns'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la campaña',
        variant: 'destructive',
      });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-campaigns/${campaign.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });
      if (!response.ok) throw new Error('Failed to delete campaign');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Campaña eliminada',
        description: 'La campaña ha sido eliminada correctamente',
      });
      queryClient.resetQueries({ queryKey: ['/api/super-admin/email-campaigns'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la campaña',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    let htmlContent: string;
    
    if (useRawHtml) {
      htmlContent = rawHtmlContent;
    } else {
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
      
      htmlContent = generateHtmlContent(contentWithDefaults);
    }
    
    updateCampaignMutation.mutate({
      ...formData,
      htmlContent,
    });
  };

  const canProceedStep1 = formData.name && formData.subject;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) setCurrentStep(1);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Editar Campaña - Paso {currentStep} de 3</DialogTitle>
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
                data-testid="input-edit-campaign-name"
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
                data-testid="input-edit-campaign-subject"
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
                data-testid="input-edit-campaign-preheader"
              />
              <p className="text-xs text-white/50 mt-1">Este texto aparece como preview del email</p>
            </div>
          </div>
        )}

        {/* Step 2: Email Content */}
        {currentStep === 2 && (
          <div className="space-y-4">
            {useRawHtml ? (
              <>
                <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-400/30">
                  <p className="text-sm text-yellow-200">
                    Esta campaña usa HTML personalizado. Puedes editarlo directamente aquí.
                  </p>
                </div>
                <div>
                  <Label htmlFor="rawHtml" className="text-white">Contenido HTML</Label>
                  <Textarea
                    id="rawHtml"
                    value={rawHtmlContent}
                    onChange={(e) => setRawHtmlContent(e.target.value)}
                    rows={12}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 font-mono text-sm"
                    data-testid="input-raw-html"
                  />
                </div>
              </>
            ) : (
              <EmailPreviewEditor
                content={emailContent}
                onChange={setEmailContent}
              />
            )}
          </div>
        )}

        {/* Step 3: Recipients */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4 mb-4">
              <p className="text-sm text-white/70">
                Selecciona los destinatarios que recibirán esta campaña. Los cambios en los destinatarios solo afectarán a futuros envíos.
              </p>
            </div>
            
            <div className="space-y-3">
              <Label className="text-white">Destinatarios</Label>
              <RecipientSelector
                selectedEmails={formData.selectedEmails}
                onSelectionChange={(emails) => setFormData({ ...formData, selectedEmails: emails })}
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-white/10">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => deleteCampaignMutation.mutate()}
              disabled={deleteCampaignMutation.isPending}
              className="border-red-500 text-red-500 hover:bg-red-500/10"
              data-testid="button-delete-campaign"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {deleteCampaignMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : onOpenChange(false)}
              className="border-white/20 text-white hover:bg-white/10"
              data-testid="button-edit-previous-step"
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
                data-testid="button-edit-next-step"
              >
                Siguiente
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={updateCampaignMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-save-campaign"
              >
                {updateCampaignMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
