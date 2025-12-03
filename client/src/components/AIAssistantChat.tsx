import { useState, useRef, useEffect, memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Minimize2, RotateCcw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useChatBridge, triggerAINavigation } from "@/lib/chat-bridge";
import oficazLogo from "@/assets/oficaz-logo.png";

interface Message {
  role: "user" | "assistant";
  content: string;
  functionCalled?: string | null;
}

// Componente de animación del asistente de IA
function AIAssistantAnimation({ isThinking = false }: { isThinking?: boolean }) {
  const animationName = isThinking ? 'aiCircularOrbit' : 'aiRandomBounce';
  const animationDuration = isThinking ? '2s' : '30s';
  const gradientDuration = isThinking ? '4s' : '35s';
  
  return (
    <div className="relative w-16 h-16">
      {/* Fondo degradado azul orgánico animado con múltiples tonos */}
      <div 
        className="absolute inset-0 rounded-full shadow-xl"
        style={{
          background: 'linear-gradient(135deg, #002952, #003d7a, #004d99, #005bb5, #007AFF, #0095ff, #00aaff, #0095ff, #007AFF, #005bb5, #004d99, #003d7a, #002952)',
          backgroundSize: '400% 400%',
          animation: `aiGradient ${gradientDuration} ease infinite`
        }}
      />
      
      {/* Anillo blanco con punto - encima del degradado */}
      <div className="absolute inset-[10px] flex items-center justify-center">
        {/* Anillo blanco */}
        <div 
          className="absolute inset-0 rounded-full border-[9px]"
          style={{
            borderColor: 'white',
            background: 'transparent'
          }}
        />
        
        {/* Punto blanco (rebotando o girando según el estado) */}
        <div 
          className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-lg"
          style={{
            animation: `${animationName} ${animationDuration} ${isThinking ? 'linear' : 'ease-in-out'} infinite`
          }}
        />
      </div>
      
      <style>{`
        @keyframes aiCircularOrbit {
          0% {
            transform: rotate(0deg) translateX(6px) rotate(0deg);
          }
          100% {
            transform: rotate(360deg) translateX(6px) rotate(-360deg);
          }
        }
        
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
  // Use chat bridge to access auth data without causing re-renders
  const { userSummary, hasChatAccess } = useChatBridge();
  
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  
  // Detect when welcome modal is open via body attribute
  useEffect(() => {
    const checkWelcomeModal = () => {
      setIsWelcomeModalOpen(document.body.hasAttribute('data-welcome-modal-open'));
    };
    
    // Check immediately
    checkWelcomeModal();
    
    // Use MutationObserver to detect attribute changes
    const observer = new MutationObserver(checkWelcomeModal);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-welcome-modal-open'] });
    
    return () => observer.disconnect();
  }, []);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToBottomOnce = useRef(false);
  const messagesLengthRef = useRef(0);
  const savedScrollPosition = useRef<number>(0);

  // Initialize messages from localStorage or with default welcome message
  // Auto-clear history after 2 days
  const [messages, setMessages] = useState<Message[]>(() => {
    const defaultMessage = {
      role: "assistant" as const,
      content:
        "¡Hola! Puedo ayudarte a gestionar cuadrantes, enviar mensajes y crear recordatorios. ¿En qué te ayudo?",
    };

    const savedMessages = localStorage.getItem("ai_assistant_chat_history");
    const savedTimestamp = localStorage.getItem("ai_assistant_chat_timestamp");
    
    if (savedMessages && savedTimestamp) {
      try {
        const timestamp = parseInt(savedTimestamp);
        const now = Date.now();
        const twoDaysInMs = 2 * 24 * 60 * 60 * 1000; // 2 días en milisegundos
        
        // Si han pasado más de 2 días, reiniciar el chat
        if (now - timestamp > twoDaysInMs) {
          localStorage.removeItem("ai_assistant_chat_history");
          localStorage.removeItem("ai_assistant_chat_timestamp");
          return [defaultMessage];
        }
        
        return JSON.parse(savedMessages);
      } catch {
        return [defaultMessage];
      }
    }
    
    return [defaultMessage];
  });

  // Save messages to localStorage whenever they change, along with timestamp
  useEffect(() => {
    localStorage.setItem("ai_assistant_chat_history", JSON.stringify(messages));
    localStorage.setItem("ai_assistant_chat_timestamp", Date.now().toString());
  }, [messages]);

  // Memoize rendered messages to prevent re-renders
  const renderedMessages = useMemo(() => messages.map((message, index) => (
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
      </div>
    </div>
  )), [messages]);
  
  // Scroll to bottom when new messages are added
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };
  
  // CRITICAL: Save scroll position on every scroll event
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      savedScrollPosition.current = container.scrollTop;
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);
  
  // CRITICAL: Restore scroll position after every render
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // If we have a saved position, restore it
    if (savedScrollPosition.current > 0) {
      container.scrollTop = savedScrollPosition.current;
    }
  });
  
  // CRITICAL: Scroll to bottom when chat opens OR new message arrives
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      // If no saved position, scroll to bottom (first time opening)
      if (savedScrollPosition.current === 0) {
        setTimeout(scrollToBottom, 0);
      }
    }
  }, [isOpen]);
  
  // Auto-scroll when NEW messages arrive
  useEffect(() => {
    if (messages.length > messagesLengthRef.current) {
      setTimeout(scrollToBottom, 0);
      messagesLengthRef.current = messages.length;
    }
  }, [messages.length]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    
    // Scroll to bottom after adding user message
    setTimeout(scrollToBottom, 0);

    try {
      // Send entire message history for context
      const response = await apiRequest("POST", "/api/ai-assistant/chat", {
        messages: [...messages, { role: "user", content: userMessage }],
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.message,
          functionCalled: response.functionCalled,
        },
      ]);
      
      // Scroll to bottom after AI response
      setTimeout(scrollToBottom, 0);

      // AUTO-DOWNLOAD PDF if downloadUrl is present (time tracking reports)
      if (response.downloadUrl) {
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = response.filename || 'informe.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Navigate to page if navigateTo is present (from navigateToPage function)
      // Uses SPA navigation via custom event to avoid full page reload
      if (response.navigateTo) {
        setTimeout(() => {
          triggerAINavigation(response.navigateTo);
        }, 1000); // Small delay to allow user to see the AI response
      }

      // Invalidate relevant queries based on the function that was called
      if (response.functionCalled) {
        const functionsArray = response.functionCalled.split(", ");
        
        for (const func of functionsArray) {
          switch (func.trim()) {
            case "assignSchedule":
            case "assignScheduleInRange":
            case "deleteWorkShift":
            case "deleteWorkShiftsInRange":
            case "updateWorkShiftTimes":
            case "updateWorkShiftsInRange":
            case "updateEmployeeShiftsColor":
            case "updateWorkShiftColor":
            case "updateWorkShiftDetails":
            case "swapEmployeeShifts":
            case "copyEmployeeShifts":
              // Invalidate work shifts queries
              queryClient.invalidateQueries({ queryKey: ['/api/work-shifts/company'] });
              queryClient.invalidateQueries({ queryKey: ['/api/work-shifts/my-shifts'] });
              break;
            case "sendMessage":
              // Invalidate messages queries
              queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
              queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
              break;
            case "approveVacationRequests":
              // Invalidate vacation requests queries
              queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
              queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
              break;
            case "approveTimeModificationRequests":
              // Invalidate modification requests queries
              queryClient.invalidateQueries({ queryKey: ['/api/admin/work-sessions/modification-requests'] });
              break;
            case "createReminder":
              // Invalidate reminders queries
              queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
              queryClient.invalidateQueries({ queryKey: ['/api/reminders/dashboard'] });
              queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
              break;
            case "createEmployee":
              // Invalidate employees queries
              queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
              break;
            case "updateEmployee":
              // Invalidate employees queries
              queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
              queryClient.invalidateQueries({ queryKey: ['/api/users/employees'] });
              break;
            case "requestDocument":
              // Invalidate document notifications
              queryClient.invalidateQueries({ queryKey: ['/api/document-notifications'] });
              break;
            case "generateTimeReport":
              // No query invalidation needed for reports
              break;
            case "navigateToPage":
              // No query invalidation needed, navigation happens via window.location
              break;
          }
        }
      }
    } catch (error: any) {
      console.error("Error sending message to AI:", error);
      // Toast disabled per user request - errors only shown in chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.",
        },
      ]);
      
      // Scroll to bottom after error message
      setTimeout(scrollToBottom, 0);
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

  const clearHistory = () => {
    const defaultMessage = {
      role: "assistant" as const,
      content:
        "¡Hola! Puedo ayudarte a gestionar cuadrantes, enviar mensajes y crear recordatorios. ¿En qué te ayudo?",
    };
    setMessages([defaultMessage]);
    localStorage.setItem("ai_assistant_chat_history", JSON.stringify([defaultMessage]));
    localStorage.setItem("ai_assistant_chat_timestamp", Date.now().toString());
  };

  // CRITICAL: Always render to preserve scroll position, conditional render inside portal
  // 🔒 SECURITY: Only show AI assistant to admin and manager roles
  // Employees should NEVER see the AI assistant, even on master plan
  const hasAccess = Boolean(
    userSummary && 
    hasChatAccess && 
    (userSummary.role === 'admin' || userSummary.role === 'manager')
  );

  // PROFESSIONAL PATTERN: Render to body, use display:none instead of conditional rendering
  // Hide completely when welcome modal is open
  if (isWelcomeModalOpen) {
    return null;
  }
  
  return createPortal(
    <>
      {hasAccess && (
        <>
          {/* Floating button */}
          <div
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-ai-assistant-toggle"
            className={cn(
              "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 cursor-pointer transition-all duration-300",
              !isOpen && "hover:scale-110"
            )}
          >
            <AIAssistantAnimation isThinking={isLoading} />
          </div>

          {/* CRITICAL FIX: Keep position fixed, hide with visibility/opacity instead of moving off-screen */}
          {/* Mobile: full width with margins, Desktop: fixed width */}
          <div
        className="fixed z-50 flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 transition-all duration-300 left-3 right-3 sm:left-auto sm:right-6 sm:w-[400px] max-h-[70vh] sm:max-h-[500px]"
        style={{
          bottom: '5.5rem',
          visibility: isOpen ? 'visible' : 'hidden',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
        data-testid="container-ai-assistant-chat"
      >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-[#007AFF] to-[#0066CC] px-4 py-2 text-white dark:from-[#0A84FF] dark:to-[#0066CC]">
            <h3 className="font-semibold text-sm" data-testid="text-ai-assistant-title">OficazIA</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={clearHistory}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                data-testid="button-clear-chat"
                title="Nueva conversación"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                data-testid="button-minimize-chat"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages - Memoized to prevent re-renders */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 space-y-4 overflow-y-auto p-4" 
            data-testid="container-ai-messages"
            data-preserve-scroll="true"
            key="messages-container"
          >
            {renderedMessages}

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
        </>
      )}
    </>,
    document.body
  );
}
