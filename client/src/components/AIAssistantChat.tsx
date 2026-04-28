import { useState, useRef, useEffect, memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Send, Minimize2, RotateCcw, Mic, MicOff } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useChatBridge, triggerAINavigation } from "@/lib/chat-bridge";
import { FeedbackButton } from "@/components/FeedbackButton";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import oficazLogo from "@/assets/oficaz-logo.png";
import { AIConfirmationModal } from "@/components/AIConfirmationModal";

interface Message {
  role: "user" | "assistant";
  content: string;
  functionCalled?: string | null;
  suggestions?: string[];
}

interface ProfessionalConfirmation {
  message?: string;
  needsConfirmation?: boolean;
  confirmationModal?: {
    title: string;
    description?: string;
    icon: "warning" | "check" | "info";
    items: Array<{
      label: string;
      value: string | number;
      icon?: string;
      highlight?: boolean;
    }>;
    confirmText?: string;
    cancelText?: string;
  };
  confirmationContext?: {
    action: string;
    [key: string]: any;
  };
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
    const [pendingConfirmation, setPendingConfirmation] = useState<ProfessionalConfirmation | null>(null);
  
  // Initialize voice input hook with callback to set input text
  const { 
    isRecording, 
    isListening, 
    transcript, 
    error: voiceError, 
    startRecording, 
    stopRecording, 
    clearTranscript,
    supportsWebSpeechAPI
  } = useVoiceInput({
    onTranscriptionComplete: (text) => {
      setInput(text);
    },
    language: 'es-ES'
  });
  
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
        "¡Hola! Puedo ayudarte a gestionar cuadrantes, enviar mensajes y crear tareas. ¿En qué te ayudo?",
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
    <div key={index} className="flex flex-col">
      <div
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
      {message.role === "assistant" && message.suggestions && message.suggestions.length > 0 && (
        <div className="flex justify-start px-0 mt-1.5">
          <div className="flex flex-wrap gap-1.5 max-w-[85%]">
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setInput(s)}
                className="text-xs px-2.5 py-1 rounded-full border border-[#007AFF]/30 text-[#007AFF] bg-white hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:bg-gray-900 dark:hover:bg-blue-900/30 transition-colors shadow-sm"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
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
      // Store suggestions from server response (context-aware follow-up chips)
      if (response.suggestions && response.suggestions.length > 0) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = { ...last, suggestions: response.suggestions };
          }
          return updated;
        });
      }
      
      // Si hay una confirmación pendiente, guardarla para que el usuario responda
      if (response.needsConfirmation && response.confirmationContext) {
        setPendingConfirmation(response);
      } else {
        setPendingConfirmation(null);
      }
      
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
            case "createCRMContact":
              queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
              break;
            case "addCRMInteraction":
              queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
              break;
            case "createWorkReport":
              queryClient.invalidateQueries({ queryKey: ['/api/work-reports'] });
              break;
            case "createVacationRequest":
              queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
              queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
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
        "¡Hola! Puedo ayudarte a gestionar cuadrantes, enviar mensajes y crear tareas. ¿En qué te ayudo?",
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

  const isEmployee = userSummary?.role === 'employee';

  // PROFESSIONAL PATTERN: Render to body, use display:none instead of conditional rendering
  // Hide completely when welcome modal is open
  if (isWelcomeModalOpen) {
    return null;
  }
  
  // Solo mostrar si hay un usuario autenticado (no en páginas públicas)
  const isAuthenticated = Boolean(userSummary);

  return createPortal(
    <>
      {hasAccess && (
        <>
          {/* Feedback button - Mobile: above AI. Desktop: offset to the left of AI */}
          <div className="fixed right-4 sm:right-24 z-[60] [bottom:calc(env(safe-area-inset-bottom)+6.25rem)] sm:bottom-6">
            <FeedbackButton variant="discrete" hasAI={true} />
          </div>

          {/* Floating button */}
          <div
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-ai-assistant-toggle"
            className={cn(
              "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 cursor-pointer transition-all duration-300 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] scale-90 sm:scale-100",
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
                    <LoadingSpinner size="xs" />
                    <span>Procesando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            {/* Voice recording indicator and transcript preview */}
            {(isRecording || isListening || transcript) && (
              <div className="mb-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                {isRecording && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      🎤 Grabando audio...
                    </span>
                  </div>
                )}
                {isListening && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">
                      👂 Escuchando...
                    </span>
                  </div>
                )}
                {transcript && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {transcript}
                  </p>
                )}
              </div>
            )}

            {/* Voice error display */}
            {voiceError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300">
                  ⚠️ {voiceError}
                </p>
              </div>
            )}
            
            {/* Botones de confirmación si hay una acción pendiente */}
            {pendingConfirmation && (
              <div className="mb-3 flex flex-col gap-2">
                <button
                  onClick={async () => {
                    setInput("");
                    setIsLoading(true);
                    setPendingConfirmation(null);
                    
                    try {
                      const params = pendingConfirmation.confirmationContext || {};

                      // Reenviar con forceOverwrite=true
                      const response = await apiRequest("POST", "/api/ai-assistant/chat", {
                        messages: [...messages],
                        confirmAction: {
                          ...params,
                          forceOverwrite: true
                        }
                      });
                      
                      setMessages((prev) => [
                        ...prev,
                        {
                          role: "assistant",
                          content: response.message,
                          functionCalled: response.functionCalled,
                        },
                      ]);
                      
                      if (response.navigateTo) {
                        setTimeout(() => {
                          triggerAINavigation(response.navigateTo);
                        }, 1000);
                      }
                      
                      queryClient.invalidateQueries({ queryKey: ['/api/work-shifts/company'] });
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message || "No se pudo completar la acción",
                        variant: "destructive",
                      });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className="rounded-lg bg-gradient-to-br from-[#007AFF] to-[#0066CC] px-4 py-2 text-sm font-medium text-white hover:from-[#0066CC] hover:to-[#0055AA] disabled:opacity-50"
                >
                  ✅ Sí, eliminar los antiguos y crear los nuevos
                </button>
                <button
                  onClick={() => {
                    setPendingConfirmation(null);
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: "Entendido, mantengo los turnos actuales.",
                      },
                    ]);
                  }}
                  disabled={isLoading}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  ❌ No, mantener los turnos actuales
                </button>
              </div>
            )}
            
              {/* Professional confirmation modal */}
              {pendingConfirmation?.confirmationModal && (
                <AIConfirmationModal
                  title={pendingConfirmation.confirmationModal.title}
                  description={pendingConfirmation.confirmationModal.description}
                  icon={pendingConfirmation.confirmationModal.icon}
                  items={pendingConfirmation.confirmationModal.items}
                  confirmText={pendingConfirmation.confirmationModal.confirmText || "✅ Confirmar"}
                  cancelText={pendingConfirmation.confirmationModal.cancelText || "❌ Cancelar"}
                  isLoading={isLoading}
                  onConfirm={async () => {
                    setIsLoading(true);
                    try {
                      const response = await apiRequest("POST", "/api/ai-assistant/chat", {
                        messages: [...messages],
                        confirmAction: pendingConfirmation.confirmationContext
                      });
                    
                      setMessages((prev) => [
                        ...prev,
                        {
                          role: "assistant",
                          content: response.message,
                          functionCalled: response.functionCalled,
                          suggestions: response.suggestions,
                        },
                      ]);
                    
                      setPendingConfirmation(null);
                    
                      // Navigation if needed
                      if (response.navigateTo) {
                        setTimeout(() => {
                          triggerAINavigation(response.navigateTo);
                        }, 1000);
                      }
                    
                      // Invalidate relevant queries
                      queryClient.invalidateQueries({ queryKey: ['/api/work-shifts/company'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
                    
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message || "No se pudo completar la acción",
                        variant: "destructive",
                      });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  onCancel={() => {
                    setPendingConfirmation(null);
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: "Entendido, cancelo la acción.",
                      },
                    ]);
                  }}
                />
              )}
            
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isRecording ? "Hablando..." : "Escribe o habla tu mensaje..."}
                disabled={isLoading || isRecording}
                data-testid="input-ai-message"
                className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm focus:border-[#007AFF] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
              />

              {/* Voice Input Button */}
              {supportsWebSpeechAPI && (
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  title={isRecording ? "Detener grabación" : "Grabar audio (pulsa para hablar)"}
                  data-testid="button-voice-input"
                  className={cn(
                    "h-10 w-10 rounded-full p-0 transition-all duration-200",
                    isRecording
                      ? "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                      : "bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              )}

              {/* Send Button */}
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
      
      {!hasAccess && isAuthenticated && !isEmployee && (
        <>
          {/* Floating feedback button when no AI access - only show if authenticated */}
          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
            <FeedbackButton variant="floating" />
          </div>
        </>
      )}
    </>,
    document.body
  );
}
