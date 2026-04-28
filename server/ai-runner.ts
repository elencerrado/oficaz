import { getPreferredModel, shouldEscalate, getStrongModel, getMiddleModel, pickAvailableModel } from './ai-model-router.js';

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

  const isComplexRequest = (() => {
    const lastUserMsg = currentMessages
      .filter((m: any) => m?.role === 'user')
      .map((m: any) => String(m?.content || ''))
      .pop() || '';
    return /\btodos\b|\btodas\b|rango|semana|mes|masiv|bulk|m[uú]ltiple|varios|aprobar|denegar|crear empleados?|asignar/i.test(lastUserMsg);
  })();

  const initialMaxTokens = isComplexRequest ? 1024 : 512;

  const response = await openai.chat.completions.create({
    model: actualModel,
    messages: currentMessages,
    tools,
    tool_choice: 'auto',
    max_completion_tokens: initialMaxTokens
  });

  let totalTokens = response.usage?.total_tokens || 0;
  const initialAssistantMessage = response.choices[0]?.message;
  let assistantMessage = initialAssistantMessage;

  // Sanitize assistant output: remove internal links, strip raw URLs, and prefer 'ausencias' over 'vacaciones'
  function sanitizeAssistantText(text: string) {
    if (!text || typeof text !== 'string') return text;
    // Keep internal markdown links, remove only external markdown links by keeping their label.
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '$1');
    // Remove any remaining raw http(s) links
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
    // TIER 1 ESCALATION: Try middle-tier model first (cheaper than strong model)
    // Cost: ~20x cheaper than strong model but more capable than fast model
    if (actualModel !== getMiddleModel()) {
      console.log(`⬆️  [ESCALATION TIER 1] Attempting middle-tier model: ${getMiddleModel()}`);
      
      const escalationSystem = {
        role: 'system',
        content: `Escalación Tier 1: Reevalúa la petición anterior con más cuidado. Devuelve una decisión final o una acción verificada.`
      };

      const escalationMessages = [escalationSystem, ...currentMessages];

      const middleResponse = await openai.chat.completions.create({
        model: getMiddleModel(),
        messages: escalationMessages,
        tools,
        tool_choice: 'auto',
        max_completion_tokens: 1536
      });

      totalTokens += middleResponse.usage?.total_tokens || 0;
      assistantMessage = middleResponse.choices[0]?.message;

      // If escalation returns only text but the initial response had tool calls,
      // preserve the actionable tool calls so mutative actions can still execute.
      if (
        (!Array.isArray(assistantMessage?.tool_calls) || assistantMessage.tool_calls.length === 0) &&
        Array.isArray(initialAssistantMessage?.tool_calls) &&
        initialAssistantMessage.tool_calls.length > 0
      ) {
        assistantMessage = {
          ...assistantMessage,
          tool_calls: initialAssistantMessage.tool_calls
        };
      }

      // If middle model handled it, return (don't escalate further)
      return {
        assistantMessage,
        usedTokens: totalTokens,
        chosenModel: actualModel,
        escalated: true
      };
    }

    // TIER 2 ESCALATION: If middle model also fails or is already the strong model, use strongest model
    console.log(`⬆️⬆️ [ESCALATION TIER 2] Attempting strong model: ${getStrongModel()}`);
    const escalationSystem = {
      role: 'system',
      content: `Escalación Tier 2: Esta solicitud requiere análisis profundo. Verifica completamente la acción antes de proceder.`
    };

    const escalationMessages = [escalationSystem, ...currentMessages];

    const strongResponse = await openai.chat.completions.create({
      model: getStrongModel(),
      messages: escalationMessages,
      tools,
      tool_choice: 'auto',
      max_completion_tokens: 1536
    });

    totalTokens += strongResponse.usage?.total_tokens || 0;
    assistantMessage = strongResponse.choices[0]?.message;

    if (
      (!Array.isArray(assistantMessage?.tool_calls) || assistantMessage.tool_calls.length === 0) &&
      Array.isArray(initialAssistantMessage?.tool_calls) &&
      initialAssistantMessage.tool_calls.length > 0
    ) {
      assistantMessage = {
        ...assistantMessage,
        tool_calls: initialAssistantMessage.tool_calls
      };
    }

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
