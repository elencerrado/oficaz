// Heuristics and model routing helper for OficazIA
// Exports helpers to pick a model and decide if we should escalate to a stronger model

const DEFAULT_FAST_MODEL = process.env.AI_INTEGRATIONS_OPENAI_FAST_MODEL || "gpt-4o-mini";  // ~$0.00015/1k tokens
const DEFAULT_MIDDLE_MODEL = process.env.AI_INTEGRATIONS_OPENAI_MIDDLE_MODEL || "gpt-4-turbo"; // ~$0.003/1k tokens (cheaper than 4o)
const DEFAULT_STRONG_MODEL = process.env.AI_INTEGRATIONS_OPENAI_STRONG_MODEL || "gpt-4o";     // ~$0.006/1k tokens

// Set of function names considered mutations (write / potentially destructive)
export const MUTATION_FUNCTIONS = new Set<string>([
  'approveVacationRequests',
  'denyVacationRequests',
  'createReminder',
  'createEmployee',
  'updateEmployee',
  'assignSchedule',
  'assignRotatingSchedule',
  'assignScheduleInRange',
  'updateEmployeeShiftsColor',
  'createShiftAfterEmployee'
]);

// Simple keyword-based heuristic to detect complexity
const COMPLEXITY_KEYWORDS = [
  'crear', 'crear empleado', 'crear usuario', 'modificar', 'update', 'borrar', 'eliminar', 'aprobar', 'denegar', 'rotación', 'rotativo', 'rotar',
  'cuadrante', 'cuadrantes', 'json', 'base de datos', 'db', 'bulk', 'masivo', 'estadísticas', 'reporte', 'report', 'integración', 'configurar', 'configuración',
  'cliente', 'proveedor', 'contacto', 'crm', 'factura', 'gasto', 'ingreso', 'contabilidad', 'parte de trabajo', 'parte trabajo', 'nota crm', 'interacción'
];

export function getPreferredModel(messages: Array<{role:string, content?: string}>) {
  const msg = messages.filter(m => m.role === 'user').map(m => m.content || '').join('\n');
  const lower = msg.toLowerCase();

  // Heuristic 1: direct complexity keywords
  for (const kw of COMPLEXITY_KEYWORDS) {
    if (lower.includes(kw)) return DEFAULT_STRONG_MODEL;
  }

  // Heuristic 2: message length or structure (long requests usually complex)
  if (lower.length > 300) return DEFAULT_STRONG_MODEL;

  // Heuristic 3: presence of several dates/times/numbers may indicate scheduling/bulk
  const dateLike = (lower.match(/\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}|\b(hoy|mañana|próxima semana|la semana que viene|este mes|próximo mes)\b/g) || []).length;
  if (dateLike >= 2) return DEFAULT_STRONG_MODEL;

  // Default to fast (cheap & low latency)
  return DEFAULT_FAST_MODEL;
}

// Pick an available model from OpenAI account. Returns preferred if available, otherwise falls back to provided fallbacks or first available known family.
export async function pickAvailableModel(openaiClient: any, preferred: string, fallback?: string[]) {
  try {
    const list = await openaiClient.models.list();
    const available = (list?.data || []).map((m: any) => m.id);

    // Direct match
    if (available.includes(preferred)) return preferred;

    // Try user-provided fallbacks first (exact or prefix)
    if (fallback && fallback.length > 0) {
      for (const f of fallback) {
        if (available.includes(f)) return f;
        const partsF = f.split('-').filter(Boolean);
        for (let i = Math.min(partsF.length, 3); i >= 1; i--) {
          const p = partsF.slice(0, i).join('-');
          const alt = available.find((id: string) => id.startsWith(p));
          if (alt) return alt;
        }
      }
    }

    // Match by more specific prefixes of preferred (e.g., gpt-4o-mini -> try 'gpt-4o', then 'gpt-4')
    const parts = preferred.split('-').filter(Boolean);
    for (let i = Math.min(parts.length, 3); i >= 2; i--) {
      const p = parts.slice(0, i).join('-');
      const byPref = available.find((id: string) => id.startsWith(p));
      if (byPref) return byPref;
    }

    // Common fallback list
    const COMMON = ['gpt-4', 'gpt-4o', 'gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-3.5'];
    for (const c of COMMON) {
      const alt = available.find((id: string) => id.startsWith(c.split('-')[0]));
      if (alt) return alt;
    }

    // If nothing matched, return preferred as last resort
    return preferred;
  } catch (err) {
    console.warn('⚠️ pickAvailableModel: error listing models, falling back to preferred', (err as any)?.message || err);
    return preferred;
  }
}

// Decide whether to escalate based on assistant response (cheap model answer)
export function shouldEscalate(assistantMessage: any) {
  if (!assistantMessage) return false;

  const rawContent = typeof assistantMessage.content === 'string' ? assistantMessage.content : '';
  const content = rawContent.toLowerCase();
  const hasUncertainty = /no puedo|no tengo acceso|necesito más información|necesito acceso|no(?: )?estoy seguro|tampoco puedo|hubo un error|fall[óo]/i.test(content);
  const hasExplicitConfirmation = rawContent.trim().length > 0;

  // OpenAI tool-calling (new format)
  const toolCallNames = Array.isArray(assistantMessage.tool_calls)
    ? assistantMessage.tool_calls
        .map((tc: any) => tc?.function?.name)
        .filter((name: any) => typeof name === 'string')
    : [];

  // Legacy function_call fallback
  if (assistantMessage.function_call?.name) {
    toolCallNames.push(assistantMessage.function_call.name);
  }

  const hasMutationToolCall = toolCallNames.some((name: string) => MUTATION_FUNCTIONS.has(name));

  // If a mutation is requested but there is no textual confirmation, escalate to verify outcome.
  if (hasMutationToolCall && !hasExplicitConfirmation) {
    return true;
  }

  // Escalate when there is uncertainty/error signal.
  // This avoids always escalating successful mutation calls and reduces cost/latency.
  if (hasMutationToolCall && hasUncertainty) {
    return true;
  }

  // No tool calls but response is uncertain -> escalate for a second opinion.
  if (!hasMutationToolCall && hasUncertainty) return true;

  return false;
}

export function getStrongModel() {
  return DEFAULT_STRONG_MODEL;
}

// Get middle-tier model for first escalation (cheaper than strong model)
export function getMiddleModel() {
  return DEFAULT_MIDDLE_MODEL;
}
