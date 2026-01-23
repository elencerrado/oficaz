// Heuristics and model routing helper for OficazIA
// Exports helpers to pick a model and decide if we should escalate to a stronger model

const DEFAULT_FAST_MODEL = process.env.AI_INTEGRATIONS_OPENAI_FAST_MODEL || "gpt-4o-mini";
const DEFAULT_STRONG_MODEL = process.env.AI_INTEGRATIONS_OPENAI_STRONG_MODEL || "gpt-4o";

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
  'cuadrante', 'cuadrantes', 'json', 'base de datos', 'db', 'bulk', 'masivo', 'estadísticas', 'reporte', 'report', 'integración', 'configurar', 'configuración'
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

  // If assistant attempted a function call that is a mutation → escalate
  if (assistantMessage.function_call && assistantMessage.function_call.name) {
    const fname = assistantMessage.function_call.name;
    if (MUTATION_FUNCTIONS.has(fname)) return true;
  }

  // If assistant states uncertainty about performing an action or requests privileged access
  const content = (assistantMessage.content || '').toLowerCase();
  if (/no puedo|no tengo acceso|necesito más información|necesito acceso|no(?: )?estoy seguro|tampoco puedo/i.test(content)) {
    return true;
  }

  return false;
}

export function getStrongModel() {
  return DEFAULT_STRONG_MODEL;
}
