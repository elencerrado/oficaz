import { useState, useRef, useEffect } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmailContent {
  subtitle: string;
  heading: string;
  paragraph: string;
  buttonText: string;
  buttonUrl: string;
}

interface EmailPreviewEditorProps {
  content: EmailContent;
  onChange: (content: EmailContent) => void;
}

export function EmailPreviewEditor({ content, onChange }: EmailPreviewEditorProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const buttonTextRef = useRef<HTMLAnchorElement>(null);

  // Update contentEditable elements when content changes externally
  useEffect(() => {
    if (subtitleRef.current && subtitleRef.current.textContent !== content.subtitle) {
      subtitleRef.current.textContent = content.subtitle;
    }
    if (headingRef.current && headingRef.current.textContent !== content.heading) {
      headingRef.current.textContent = content.heading;
    }
    if (paragraphRef.current && paragraphRef.current.textContent !== content.paragraph) {
      paragraphRef.current.textContent = content.paragraph;
    }
    if (buttonTextRef.current && buttonTextRef.current.textContent !== content.buttonText) {
      buttonTextRef.current.textContent = content.buttonText;
    }
  }, [content]);

  const handleContentChange = (field: keyof EmailContent, value: string) => {
    onChange({ ...content, [field]: value });
  };

  const handleBlur = (field: keyof EmailContent, ref: React.RefObject<HTMLElement>) => {
    if (ref.current) {
      const newValue = ref.current.textContent || '';
      if (newValue !== content[field]) {
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
            {/* Logo Header */}
            <tbody>
              <tr>
                <td
                  style={{
                    background: 'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)',
                    padding: '30px',
                    textAlign: 'center',
                  }}
                >
                  <img
                    src="https://oficaz.es/email-logo.png"
                    alt="Oficaz Logo"
                    style={{ height: '40px', display: 'block', margin: '0 auto' }}
                  />
                </td>
              </tr>

              {/* Subtitle - Editable */}
              <tr>
                <td style={{ padding: '20px 40px 10px', textAlign: 'center' }}>
                  <p
                    ref={subtitleRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={() => handleBlur('subtitle', subtitleRef)}
                    style={{
                      margin: 0,
                      color: '#666',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      minHeight: '20px',
                      outline: 'none',
                      cursor: 'text',
                    }}
                    className="hover:bg-blue-50 transition-colors rounded px-2 py-1"
                    data-testid="editable-subtitle"
                  >
                    {content.subtitle || 'Haz clic para añadir un subtítulo...'}
                  </p>
                </td>
              </tr>

              {/* Main Content - Editable */}
              <tr>
                <td style={{ padding: '10px 40px 20px' }}>
                  <h1
                    ref={headingRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={() => handleBlur('heading', headingRef)}
                    style={{
                      margin: '0 0 20px',
                      color: '#1a1a1a',
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
                    {content.heading || 'Haz clic para añadir el encabezado...'}
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
                    {content.paragraph || 'Haz clic para añadir el contenido principal...'}
                  </p>
                </td>
              </tr>

              {/* Button - Editable Text */}
              {(content.buttonText || content.buttonUrl) && (
                <tr>
                  <td style={{ padding: '20px 40px 40px', textAlign: 'center' }}>
                    <a
                      ref={buttonTextRef}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={() => handleBlur('buttonText', buttonTextRef)}
                      href={content.buttonUrl || '#'}
                      onClick={(e) => e.preventDefault()}
                      style={{
                        display: 'inline-block',
                        background: 'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)',
                        color: '#ffffff',
                        textDecoration: 'none',
                        padding: '14px 32px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '16px',
                        minWidth: '100px',
                        outline: 'none',
                        cursor: 'text',
                      }}
                      className="hover:opacity-90 transition-opacity"
                      data-testid="editable-button-text"
                    >
                      {content.buttonText || 'Texto del botón'}
                    </a>
                  </td>
                </tr>
              )}

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
                  <p style={{ margin: '0 0 10px', color: '#666', fontSize: '14px' }}>
                    © {new Date().getFullYear()} Oficaz. Todos los derechos reservados.
                  </p>
                  <p style={{ margin: 0, color: '#999', fontSize: '12px' }}>
                    Este correo fue enviado desde Oficaz
                    <br />
                    <a href="#" style={{ color: '#007AFF', textDecoration: 'none' }}>
                      Cancelar suscripción
                    </a>
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-400/30">
        <p className="text-sm text-blue-200">
          💡 <strong>Tip:</strong> El botón solo aparecerá si añades texto y URL. El subtítulo es opcional.
        </p>
      </div>
    </div>
  );
}
