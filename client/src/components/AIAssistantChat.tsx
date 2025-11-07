import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  functionCalled?: string | null;
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
      <Button
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-ai-assistant-toggle"
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-xl transition-all duration-300 hover:scale-110",
          "bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 hover:from-purple-600 hover:via-pink-600 hover:to-purple-700",
          "dark:from-purple-600 dark:via-pink-600 dark:to-purple-700 dark:hover:from-purple-700 dark:hover:via-pink-700 dark:hover:to-purple-800"
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </Button>

      {/* Chat window */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex h-[600px] w-[400px] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
          data-testid="container-ai-assistant-chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 p-4 text-white dark:from-purple-600 dark:via-pink-600 dark:to-purple-700">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Sparkles className="h-5 w-5" />
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
                      ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white dark:from-purple-600 dark:to-pink-600"
                      : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  {message.functionCalled && (
                    <div className="mt-2 flex items-center gap-1 text-xs opacity-75">
                      <Sparkles className="h-3 w-3" />
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
                className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-purple-400 dark:focus:ring-purple-800"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                data-testid="button-send-ai-message"
                className={cn(
                  "h-10 w-10 rounded-full p-0 transition-all duration-200",
                  "bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600",
                  "dark:from-purple-600 dark:to-pink-600 dark:hover:from-purple-700 dark:hover:to-pink-700",
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
