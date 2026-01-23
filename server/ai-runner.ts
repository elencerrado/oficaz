import { getPreferredModel, shouldEscalate, getStrongModel, pickAvailableModel } from './ai-model-router.js';

export type RunResult = {
  assistantMessage: any;
  usedTokens: number;
  chosenModel: string;
  escalated: boolean;
};

export async function runAssistantTurn(openai: any, currentMessages: any[], tools: any[]) : Promise<RunResult> {
  // Choose preferred model by heuristic
  const preferred = getPreferredModel(currentMessages);

  // Resolve to an available model in the account (fallback if preferred isn't available)
  const actualModel = await pickAvailableModel(openai, preferred, [getStrongModel()]);

  console.log(`🤖 [MODEL ROUTER] Preferred: ${preferred} -> Using: ${actualModel}`);

  const response = await openai.chat.completions.create({
    model: actualModel,
    messages: currentMessages,
    tools,
    tool_choice: 'auto',
    max_completion_tokens: 512
  });

  let totalTokens = response.usage?.total_tokens || 0;
  let assistantMessage = response.choices[0]?.message;

  // Sanitize assistant output: remove internal links, strip raw URLs, and prefer 'ausencias' over 'vacaciones'
  function sanitizeAssistantText(text: string) {
    if (!text || typeof text !== 'string') return text;
    // Remove markdown links but keep label: [aquí](/path) -> aquí
    text = text.replace(/\[([^\]]+)\]\((?:\/[^)]+|https?:\/\/[^)]+)\)/gi, '$1');
    // Remove any remaining http(s) links
    text = text.replace(/https?:\/\/[\S]+/gi, '');
    // Remove 'haciendo clic' clauses or 'Puedes ver' style footers
    text = text.replace(/(?:Puedes ver|Puedes consultarlo|Puedes ver m[aá]s detalles|haz clic|haciendo clic)[^\.\n]*/gi, '');
    text = text.replace(/(?:haciendo clic|haz clic)[^\.\n]*/gi, '');
    // Replace 'vacaciones' with 'ausencias' when relevant
    text = text.replace(/\bvacaciones\b/gi, 'ausencias');
    // Collapse multiple spaces and trim
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  if (assistantMessage && assistantMessage.content) {
    assistantMessage.content = sanitizeAssistantText(assistantMessage.content);
  }

  if (shouldEscalate(assistantMessage) && actualModel !== getStrongModel()) {
    const escalationSystem = {
      role: 'system',
      content: `Escalación: La petición anterior fue procesada por un modelo rápido y requiere análisis más profundo o acción. Reevalúa y devuelve una decisión final o una llamada de función verificada.`
    };

    const escalationMessages = [escalationSystem, ...currentMessages];

    const strongResponse = await openai.chat.completions.create({
      model: getStrongModel(),
      messages: escalationMessages,
      tools,
      tool_choice: 'auto',
      max_completion_tokens: 1024
    });

    totalTokens += strongResponse.usage?.total_tokens || 0;
    assistantMessage = strongResponse.choices[0]?.message;

    return {
      assistantMessage,
      usedTokens: totalTokens,
      chosenModel: actualModel,
      escalated: true
    };
  }

  return {
    assistantMessage,
    usedTokens: totalTokens,
    chosenModel: actualModel,
    escalated: false
  };
}
