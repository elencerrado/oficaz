import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Send, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import oficazLogo from "@/assets/oficaz-logo.png";

interface Message {
  role: "user" | "assistant";
  content: string;
  functionCalled?: string | null;
}

// Componente de animación del asistente de IA
function AIAssistantAnimation({ isThinking = false }: { isThinking?: boolean }) {
  const animationDuration = isThinking ? '1.5s' : '20s';
  const gradientDuration = isThinking ? '3s' : '25s';
  
  return (
    <div className="relative w-16 h-16">
      {/* Capa 1: Fondo degradado animado - completamente visible */}
      <div 
        className="absolute inset-0 rounded-full shadow-xl"
        style={{
          background: 'linear-gradient(45deg, #5856D6, #007AFF, #00C6FF, #007AFF, #5856D6)',
          backgroundSize: '400% 400%',
          animation: `aiGradient ${gradientDuration} ease infinite`,
          zIndex: 0
        }}
      />
      
      {/* Capa 2: Contenedor interior semi-transparente que deja ver el borde degradado */}
      <div 
        className="absolute inset-[12px] rounded-full"
        style={{
          background: 'rgba(10, 10, 30, 0.85)',
          zIndex: 10
        }}
      >
        {/* Anillo azul exterior (más grande) */}
        <div 
          className="absolute inset-[4px] rounded-full border-[3px]"
          style={{
            borderColor: '#4F8DFF',
            background: 'transparent'
          }}
        />
        
        {/* Anillo azul interior (más pequeño) */}
        <div 
          className="absolute inset-[10px] rounded-full border-[4px]"
          style={{
            borderColor: '#1F6BFF',
            background: 'transparent'
          }}
        />
        
        {/* Punto rebotando aleatoriamente */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="absolute w-2 h-2 bg-[#007AFF] rounded-full shadow-lg"
            style={{
              animation: `aiRandomBounce ${animationDuration} ease-in-out infinite`,
              zIndex: 20
            }}
          />
        </div>
      </div>
      
      <style>{`
        @keyframes aiRandomBounce {
          0% {
            transform: translate(0px, 0px);
          }
          15% {
            transform: translate(8px, -6px);
          }
          30% {
            transform: translate(-6px, 8px);
          }
          45% {
            transform: translate(10px, 4px);
          }
          60% {
            transform: translate(-8px, -8px);
          }
          75% {
            transform: translate(6px, 10px);
          }
          90% {
            transform: translate(-10px, -4px);
          }
          100% {
            transform: translate(0px, 0px);
          }
        }
        
        @keyframes aiGradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
}

export function AIAssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "¡Hola! Soy tu asistente de IA. Puedo ayudarte con:\n\n• Enviar mensajes a empleados\n• Aprobar solicitudes de vacaciones\n• Aprobar cambios de horario\n• Crear recordatorios\n• Gestionar empleados\n• Asignar turnos\n• Solicitar documentos\n\n¿En qué puedo ayudarte hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/ai-assistant/chat", {
        message: userMessage,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.message,
          functionCalled: response.functionCalled,
        },
      ]);
    } catch (error: any) {
      console.error("Error sending message to AI:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar tu solicitud",
        variant: "destructive",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-ai-assistant-toggle"
        className={cn(
          "fixed bottom-6 right-6 z-50 cursor-pointer transition-all duration-300",
          isOpen ? "scale-95" : "hover:scale-110"
        )}
      >
        {isOpen ? (
          <div className="w-16 h-16 rounded-full bg-red-500 dark:bg-red-600 flex items-center justify-center shadow-xl hover:bg-red-600 dark:hover:bg-red-700 transition-colors">
            <X className="h-7 w-7 text-white" />
          </div>
        ) : (
          <AIAssistantAnimation isThinking={isLoading} />
        )}
      </div>

      {/* Chat window with animations */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex h-[600px] w-[400px] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 animate-in fade-in slide-in-from-bottom-4 duration-300"
          data-testid="container-ai-assistant-chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-[#007AFF] to-[#0066CC] p-4 text-white dark:from-[#0A84FF] dark:to-[#0066CC]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <img 
                  src={oficazLogo} 
                  alt="Oficaz" 
                  className="w-6 h-6 object-contain brightness-0 invert"
                />
              </div>
              <div>
                <h3 className="font-semibold" data-testid="text-ai-assistant-title">Asistente de IA</h3>
                <p className="text-xs opacity-90">Powered by GPT-5 Nano</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4" data-testid="container-ai-messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
                data-testid={`message-${message.role}-${index}`}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                    message.role === "user"
                      ? "bg-gradient-to-br from-[#007AFF] to-[#0066CC] text-white dark:from-[#0A84FF] dark:to-[#0066CC]"
                      : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  {message.functionCalled && (
                    <div className="mt-2 flex items-center gap-1 text-xs opacity-75">
                      <div className="w-3 h-3 relative">
                        <img 
                          src={oficazLogo} 
                          alt="" 
                          className="w-3 h-3 object-contain brightness-0 invert opacity-75"
                        />
                      </div>
                      <span>Acción ejecutada: {message.functionCalled}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start" data-testid="indicator-ai-loading">
                <div className="max-w-[85%] rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Procesando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje..."
                disabled={isLoading}
                data-testid="input-ai-message"
                className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm focus:border-[#007AFF] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                data-testid="button-send-ai-message"
                className={cn(
                  "h-10 w-10 rounded-full p-0 transition-all duration-200",
                  "bg-gradient-to-br from-[#007AFF] to-[#0066CC] hover:from-[#0066CC] hover:to-[#0055AA]",
                  "dark:from-[#0A84FF] dark:to-[#0066CC] dark:hover:from-[#0066CC] dark:hover:to-[#0055AA]",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
