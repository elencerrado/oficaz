/**
 * FUTURE ENHANCEMENTS - Example implementations for next phase
 * These are NOT yet implemented but show the architectural direction
 */

// ============================================================================
// EXAMPLE 1: Proactive Suggestions based on App Context
// ============================================================================

/*
// In AIAssistantChat.tsx, after messages load:

const { context } = useAIContext();

// Auto-suggest if there are pending items
useEffect(() => {
  if (context.isPendingApprovals && messages.length === 1) { // Only on first load
    const suggestion = generateProactiveSuggestion(context);
    if (suggestion) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: suggestion
      }]);
    }
  }
}, [context.isPendingApprovals]);

function generateProactiveSuggestion(context: any): string {
  const suggestions: string[] = [];

  // Check for pending vacations
  const pendingVacations = context.dashboard?.vacationRequests?.filter(
    (r: any) => r.status === 'pending'
  ) || [];
  if (pendingVacations.length > 0) {
    suggestions.push(`📋 Tienes ${pendingVacations.length} solicitud(es) de vacaciones pendientes. ¿Quieres que te ayude a revisarlas?`);
  }

  // Check for pending documents
  const pendingDocs = context.dashboard?.documentNotifications?.filter(
    (n: any) => !n.completed
  ) || [];
  if (pendingDocs.length > 0) {
    suggestions.push(`📄 Hay ${pendingDocs.length} documento(s) pendiente(s) de recibir. ¿Quieres crear recordatorios?`);
  }

  // Check for unread messages
  if (context.hasUnreadMessages) {
    suggestions.push(`💬 Tienes mensajes sin leer. ¿Quieres que te lea un resumen?`);
  }

  return suggestions.length > 0 
    ? suggestions[0] + " " + suggestions.slice(1).join(" ") 
    : "";
}
*/

// ============================================================================
// EXAMPLE 2: Schedule Intelligence - Conflict Detection
// ============================================================================

/*
// In a new file: server/ai-assistant-schedule-intelligence.ts

export async function detectScheduleConflicts(
  companyId: number, 
  context: any
): Promise<{conflicts: any[], suggestions: string[]}> {
  
  const shifts = context.workShifts || [];
  const conflicts: any[] = [];
  const suggestions: string[] = [];

  // Group shifts by employee
  const shiftsByEmployee = new Map<number, any[]>();
  shifts.forEach((shift: any) => {
    if (!shiftsByEmployee.has(shift.employeeId)) {
      shiftsByEmployee.set(shift.employeeId, []);
    }
    shiftsByEmployee.get(shift.employeeId)!.push(shift);
  });

  // Check for overlapping shifts
  shiftsByEmployee.forEach((employeeShifts, employeeId) => {
    for (let i = 0; i < employeeShifts.length; i++) {
      for (let j = i + 1; j < employeeShifts.length; j++) {
        const shift1 = employeeShifts[i];
        const shift2 = employeeShifts[j];

        // Same day overlap check
        if (shift1.date === shift2.date) {
          const start1 = new Date(shift1.startAt).getTime();
          const end1 = new Date(shift1.endAt).getTime();
          const start2 = new Date(shift2.startAt).getTime();
          const end2 = new Date(shift2.endAt).getTime();

          // Check if overlapping
          if (start1 < end2 && start2 < end1) {
            conflicts.push({
              employee: context.employees?.find(e => e.id === employeeId)?.fullName,
              date: shift1.date,
              shift1: `${shift1.title} (${shift1.startAt}-${shift1.endAt})`,
              shift2: `${shift2.title} (${shift2.startAt}-${shift2.endAt})`
            });
          }
        }
      }
    }
  });

  // Generate AI-readable suggestions
  if (conflicts.length > 0) {
    suggestions.push(
      `🚨 Detecté ${conflicts.length} conflicto(s) de horario: ` +
      conflicts.map(c => `${c.employee} el ${c.date}`).join(", ")
    );
  }

  return { conflicts, suggestions };
}

// Usage in AI endpoint:
// const scheduleIssues = await detectScheduleConflicts(companyId, context);
// Include in AI system prompt: scheduleIssues.suggestions.join("\n")
*/

// ============================================================================
// EXAMPLE 3: Text-to-Speech Response Reading
// ============================================================================

/*
// In a new file: client/src/hooks/useTextToSpeech.ts

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakText = useCallback((text: string, language = 'es-ES') => {
    // Check browser support
    if (!('speechSynthesis' in window)) {
      console.warn('Speech Synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 1.0; // Normal speed
    utterance.pitch = 1.0; // Normal pitch
    utterance.volume = 1.0; // Full volume

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error);
      setIsSpeaking(false);
    };

    speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speakText, stopSpeaking, isSpeaking };
}

// Usage in AIAssistantChat:
// const { speakText } = useTextToSpeech();
// 
// // When AI responds:
// if (context.userSettings?.voiceResponses) {
//   speakText(response.message);
// }

// Add speaker button in chat:
// <button onClick={() => speakText(lastMessage.content)}>
//   🔊 Leer respuesta
// </button>
*/

// ============================================================================
// EXAMPLE 4: Scheduling Intelligence - Optimal Shift Assignment
// ============================================================================

/*
// In AI system prompt, add this function:

async function suggestOptimalSchedule(
  companyId: number,
  employeeNeed: { date: string; hoursNeeded: number },
  context: any
) {
  const employees = context.employees || [];
  const existingShifts = context.workShifts || [];
  
  // Score each employee based on:
  // 1. Availability (no conflicting shifts)
  // 2. Hours worked (balance workload)
  // 3. Specialization (if any)
  // 4. Recent patterns (prefer consistent)
  
  const scored = employees.map(emp => {
    let score = 100;
    
    // Penalty for existing shifts that day
    const dayShifts = existingShifts.filter(
      s => s.employeeId === emp.id && s.date === employeeNeed.date
    );
    score -= dayShifts.length * 30;
    
    // Penalty for high hours already worked
    const hoursWorked = dayShifts.reduce((sum, s) => sum + s.duration, 0);
    score -= Math.max(0, hoursWorked - 8) * 5;
    
    // Bonus for consistent schedule
    const weekShifts = existingShifts.filter(
      s => s.employeeId === emp.id &&
           isInSameWeek(new Date(s.date), new Date(employeeNeed.date))
    );
    if (weekShifts.length > 0) score += 15; // Already scheduled this week
    
    return { employee: emp, score, hoursWorked };
  });
  
  // Sort by score (highest first)
  const recommendations = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // Top 3 recommendations
    .map(r => `${r.employee.fullName} (puntuación: ${r.score}, hoy: ${r.hoursWorked}h)`);
  
  return {
    message: `Para el ${employeeNeed.date}, te recomiendo: ${recommendations.join(", ")}`,
    recommendations: scored.sort((a, b) => b.score - a.score)
  };
}

// Usage:
// const suggestion = await suggestOptimalSchedule(
//   companyId, 
//   { date: "2024-01-15", hoursNeeded: 8 },
//   context
// );
*/

// ============================================================================
// EXAMPLE 5: End-of-Day Summary
// ============================================================================

/*
// In AIAssistantChat.tsx, triggered automatically at 5 PM:

const sendEndOfDaySummary = async () => {
  const now = new Date();
  const hour = now.getHours();
  
  if (hour !== 17) return; // 5 PM
  
  const summary = generateDaySummary(context);
  
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: summary
  }]);
};

function generateDaySummary(context: any): string {
  const lines = ['📊 Resumen del día:'];
  
  // Sessions completed
  const completedSessions = context.dashboard?.completedSessions || 0;
  lines.push(`✅ ${completedSessions} sesiones de trabajo completadas`);
  
  // Messages sent
  const messagesToday = context.dashboard?.messagesToday || 0;
  lines.push(`💬 ${messagesToday} mensajes enviados`);
  
  // Approvals completed
  const approvalsToday = context.dashboard?.approvalsToday || 0;
  lines.push(`✔️ ${approvalsToday} aprobaciones realizadas`);
  
  // Tomorrow's preview
  lines.push('\n📅 Mañana:');
  lines.push(`- ${context.dashboard?.tomorrowShifts || 0} turnos programados`);
  lines.push(`- ${context.dashboard?.tomorrowAbsences || 0} ausencias`);
  
  return lines.join('\n');
}
*/

// ============================================================================
// EXAMPLE 6: Integration into AI System Prompt
// ============================================================================

/*
// In the AI endpoint (server/routes.ts), before sending to OpenAI:

const systemPrompt = `
Eres OficazIA, un asistente administrativo inteligente para la empresa "${context.company?.name}".

${formatAIContextPrompt(context)}

Responsabilidades:
1. Gestión de cuadrantes: crear, modificar, eliminar turnos
2. Aprobaciones: vacaciones, cambios de hora
3. Mensajes: comunicación interna
4. Recordatorios: crear y gestionar
5. Documentos: solicitar y registrar

${scheduleIssues.suggestions.join('\n')}

Directrices:
- Respuestas breves (máx 2 líneas para chat)
- Siempre confirmar acciones importantes
- Usar nombres de empleados con exactitud
- Detectar y resolver conflictos
- Sugerir mejoras cuando veas patrones

Hora actual: ${new Date().toLocaleString('es-ES')}
`;

// Pass to OpenAI with context
*/

// ============================================================================
// ANALYTICS TRACKING
// ============================================================================

/*
// Track usage for improvement:

type AIAnalytics = {
  timestamp: Date;
  command: string; // What user asked
  inputMethod: 'voice' | 'text';
  executedFunction: string | null;
  responseTime: number; // ms
  userConfirmed: boolean;
  success: boolean;
};

// Usage:
const trackAnalytics = async (analytics: AIAnalytics) => {
  await apiRequest('POST', '/api/analytics/ai-usage', analytics);
};

// Helps identify:
// - Most used commands
// - Voice vs text preferences
// - Common failures to fix
// - Response time issues
// - Success rate by function
*/

export default {
  note: "These are examples for future enhancements. Not currently implemented."
};
