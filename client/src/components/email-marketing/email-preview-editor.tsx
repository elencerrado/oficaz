import { useState, useRef, useEffect } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmailContent {
  subtitle: string;
  heading: string;
  paragraph: string;
  buttonText: string;
  buttonUrl: string;
  signature: string;
}

interface EmailPreviewEditorProps {
  content: EmailContent;
  onChange: (content: EmailContent) => void;
  audienceType?: 'subscribers' | 'one_time';
}

export function EmailPreviewEditor({ content, onChange, audienceType = 'subscribers' }: EmailPreviewEditorProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const buttonTextRef = useRef<HTMLAnchorElement>(null);
  const signatureRef = useRef<HTMLParagraphElement>(null);

  const placeholders: Record<keyof EmailContent, string> = {
    subtitle: 'APP de gestión empresarial para los que lo quieren FÁCIL',
    heading: 'Haz clic para añadir el encabezado...',
    paragraph: 'Haz clic para añadir el contenido principal...',
    buttonText: 'Texto del botón',
    buttonUrl: '',
    signature: 'Saludos cordiales',
  };

  // Update contentEditable elements when content changes externally
  useEffect(() => {
    if (subtitleRef.current) {
      const displayText = content.subtitle || placeholders.subtitle;
      const displayHtml = displayText.replace(/\n/g, '<br>');
      if (subtitleRef.current.innerHTML !== displayHtml) {
        subtitleRef.current.innerHTML = displayHtml;
      }
    }
    if (headingRef.current) {
      const displayText = content.heading || placeholders.heading;
      const displayHtml = displayText.replace(/\n/g, '<br>');
      if (headingRef.current.innerHTML !== displayHtml) {
        headingRef.current.innerHTML = displayHtml;
      }
    }
    if (paragraphRef.current) {
      const displayText = content.paragraph || placeholders.paragraph;
      const displayHtml = displayText.replace(/\n/g, '<br>');
      if (paragraphRef.current.innerHTML !== displayHtml) {
        paragraphRef.current.innerHTML = displayHtml;
      }
    }
    if (buttonTextRef.current) {
      const displayText = content.buttonText || placeholders.buttonText;
      if (buttonTextRef.current.textContent !== displayText) {
        buttonTextRef.current.textContent = displayText;
      }
    }
    if (signatureRef.current) {
      const displayText = content.signature || placeholders.signature;
      const displayHtml = displayText.replace(/\n/g, '<br>');
      if (signatureRef.current.innerHTML !== displayHtml) {
        signatureRef.current.innerHTML = displayHtml;
      }
    }
  }, [content]);

  const handleContentChange = (field: keyof EmailContent, value: string) => {
    onChange({ ...content, [field]: value });
  };

  const handleBlur = (field: keyof EmailContent, ref: React.RefObject<HTMLElement>) => {
    if (ref.current) {
      // For button text, use textContent (no line breaks needed)
      if (field === 'buttonText') {
        const newValue = ref.current.textContent || '';
        if (newValue === placeholders[field]) {
          handleContentChange(field, '');
        } else if (newValue !== content[field]) {
          handleContentChange(field, newValue);
        }
        return;
      }
      
      // For other fields, preserve line breaks by converting <br> to \n
      let html = ref.current.innerHTML || '';
      // Convert <br>, <br/>, <br />, and <div> to newlines
      html = html.replace(/<br\s*\/?>/gi, '\n');
      html = html.replace(/<\/div><div>/gi, '\n');
      html = html.replace(/<div>/gi, '\n');
      html = html.replace(/<\/div>/gi, '');
      // Remove other HTML tags
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const newValue = tempDiv.textContent || '';
      
      // Don't save placeholder text as actual content
      if (newValue.trim() === placeholders[field]) {
        handleContentChange(field, '');
      } else if (newValue !== content[field]) {
        handleContentChange(field, newValue);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
        <div className="text-sm text-white/70">
          <strong className="text-white">Vista previa:</strong> Haz clic en cualquier texto para editarlo
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('desktop')}
            className={`${
              viewMode === 'desktop'
                ? 'bg-blue-500/20 text-blue-300'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            data-testid="button-preview-desktop"
          >
            <Monitor className="w-4 h-4 mr-1" />
            Escritorio
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('mobile')}
            className={`${
              viewMode === 'mobile'
                ? 'bg-blue-500/20 text-blue-300'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            data-testid="button-preview-mobile"
          >
            <Smartphone className="w-4 h-4 mr-1" />
            Móvil
          </Button>
        </div>
      </div>

      {/* URL Input for Button (separate field) */}
      <div className="bg-white/5 rounded-lg p-4">
        <label className="text-sm text-white/70 block mb-2">URL del Botón (opcional)</label>
        <input
          type="text"
          value={content.buttonUrl}
          onChange={(e) => handleContentChange('buttonUrl', e.target.value)}
          placeholder="https://oficaz.es"
          className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="input-button-url-preview"
        />
      </div>

      {/* Email Preview */}
      <div className="flex justify-center bg-gray-100 rounded-lg p-6 overflow-auto">
        <div
          className="transition-all duration-300 shadow-xl"
          style={{
            width: viewMode === 'desktop' ? '600px' : '375px',
            minHeight: '400px',
          }}
        >
          <table
            width="100%"
            cellPadding="0"
            cellSpacing="0"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              overflow: 'hidden',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            }}
          >
            {/* Logo Header with Subtitle */}
            <tbody>
              <tr>
                <td
                  style={{
                    background: '#007AFF',
                    padding: content.subtitle ? '30px 20px 20px' : '30px 20px',
                    textAlign: 'center',
                  }}
                >
                  <img
                    src="/oficaz-logo-white.png"
                    alt="Oficaz Logo"
                    style={{ 
                      height: '40px', 
                      display: 'block', 
                      margin: content.subtitle ? '0 auto 15px auto' : '0 auto',
                      filter: 'brightness(0) invert(1)'
                    }}
                  />
                  <p
                    ref={subtitleRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={() => handleBlur('subtitle', subtitleRef)}
                    style={{
                      margin: 0,
                      color: '#ffffff',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      fontWeight: 500,
                      minHeight: '20px',
                      outline: 'none',
                      cursor: 'text',
                    }}
                    className="hover:bg-white/10 transition-colors rounded px-2 py-1"
                    data-testid="editable-subtitle"
                  >
                    {content.subtitle || placeholders.subtitle}
                  </p>
                </td>
              </tr>

              {/* Main Content - Editable */}
              <tr>
                <td style={{ padding: '30px 40px 20px' }}>
                  <h1
                    ref={headingRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={() => handleBlur('heading', headingRef)}
                    style={{
                      margin: '0 0 20px',
                      color: '#007AFF',
                      fontSize: '24px',
                      fontWeight: 600,
                      lineHeight: '1.3',
                      minHeight: '30px',
                      outline: 'none',
                      cursor: 'text',
                    }}
                    className="hover:bg-blue-50 transition-colors rounded px-2 py-1"
                    data-testid="editable-heading"
                  >
                    {content.heading || placeholders.heading}
                  </h1>
                  <p
                    ref={paragraphRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={() => handleBlur('paragraph', paragraphRef)}
                    style={{
                      margin: 0,
                      color: '#444',
                      fontSize: '16px',
                      lineHeight: '1.6',
                      minHeight: '24px',
                      outline: 'none',
                      cursor: 'text',
                    }}
                    className="hover:bg-blue-50 transition-colors rounded px-2 py-1"
                    data-testid="editable-paragraph"
                  >
                    {content.paragraph || placeholders.paragraph}
                  </p>
                </td>
              </tr>

              {/* Button - Editable Text */}
              <tr>
                <td style={{ padding: '20px 40px 30px', textAlign: 'center' }}>
                  <a
                    ref={buttonTextRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={() => handleBlur('buttonText', buttonTextRef)}
                    href={content.buttonUrl || '#'}
                    onClick={(e) => e.preventDefault()}
                    style={{
                      display: 'inline-block',
                      background: '#007AFF',
                      color: '#ffffff',
                      textDecoration: 'none',
                      padding: '14px 32px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '16px',
                      minWidth: '100px',
                      outline: 'none',
                      cursor: 'text',
                      opacity: (!content.buttonText && !content.buttonUrl) ? 0.5 : 1,
                    }}
                    className="hover:opacity-90 transition-opacity"
                    data-testid="editable-button-text"
                  >
                    {content.buttonText || placeholders.buttonText}
                  </a>
                </td>
              </tr>

              {/* Signature/Farewell - Editable */}
              <tr>
                <td style={{ padding: '0 40px 40px', textAlign: 'center' }}>
                  <p
                    ref={signatureRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={() => handleBlur('signature', signatureRef)}
                    style={{
                      margin: 0,
                      color: '#666',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      fontStyle: 'italic',
                      minHeight: '20px',
                      outline: 'none',
                      cursor: 'text',
                    }}
                    className="hover:bg-blue-50 transition-colors rounded px-2 py-1"
                    data-testid="editable-signature"
                  >
                    {content.signature || placeholders.signature}
                  </p>
                </td>
              </tr>

              {/* Footer */}
              <tr>
                <td
                  style={{
                    backgroundColor: '#f8f9fa',
                    padding: '30px 40px',
                    borderTop: '1px solid #e9ecef',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ margin: audienceType === 'subscribers' ? '0 0 10px' : 0, color: '#666', fontSize: '14px' }}>
                    © {new Date().getFullYear()} Oficaz. Todos los derechos reservados.
                  </p>
                  {audienceType === 'subscribers' && (
                    <p style={{ margin: 0, color: '#999', fontSize: '12px' }}>
                      Este correo fue enviado desde Oficaz<br />
                      <a href="#unsubscribe" style={{ color: '#007AFF', textDecoration: 'none' }}>
                        Cancelar suscripción
                      </a>
                    </p>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-400/30">
        <p className="text-sm text-blue-200">
          💡 <strong>Tip:</strong> El botón siempre está visible para que puedas editarlo. Si dejas el texto vacío, no aparecerá en el email final.
        </p>
      </div>
    </div>
  );
}
