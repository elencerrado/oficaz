import { runAssistantTurn } from './ai-runner.js';
import { runToolCalls } from './ai-tool-runner.js';

export async function handleAIChatCore({ openai, messages, storage, companyId, adminUserId, executeAIFunction, aiFunctions, resolveEmployeeName }: {
  openai: any;
  messages: any[];
  storage: any;
  companyId: number;
  adminUserId: number;
  executeAIFunction: any;
  aiFunctions: any[];
  resolveEmployeeName?: any;
}) {
  // Basic subscription check
  const subscription = await storage.getSubscriptionByCompanyId(companyId);
  if (!subscription || !(subscription.features || {}).ai_assistant) {
    return { status: 403, body: { message: 'La funcionalidad de Asistente de IA no está disponible en tu plan actual.' } };
  }

  // PRE-PARSER: Detect direct queries about "horas" and handle deterministically
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
  const hoursIntent = /\bcu[aá]ntas horas\b|\bhoras\b.*\btrabaj/i.test(lastUserMsg);
  if (hoursIntent) {
    try {
      // Determine period
      let params: any = {};
      const msgLower = lastUserMsg.toLowerCase();
      if (/mes pasado|el mes pasado|ultimo mes|último mes|el mes anterior/.test(msgLower)) {
        params.period = 'last_month';
      } else if (/la semana pasada|semana pasada/.test(msgLower)) {
        params.period = 'last_week';
      } else if (/esta semana/.test(msgLower)) {
        params.period = 'this_week';
      } else if (/hoy/.test(msgLower)) {
        params.period = 'today';
      } else if (/ayer/.test(msgLower)) {
        params.period = 'yesterday';
      } else if (/periodo|del\s+\d{4}-\d{2}-\d{2}\s+al\s+\d{4}-\d{2}-\d{2}/i.test(lastUserMsg)) {
        // Custom range like 'del 2025-11-01 al 2025-11-30'
        const m = lastUserMsg.match(/del\s+(\d{4}-\d{2}-\d{2})\s+al\s+(\d{4}-\d{2}-\d{2})/i);
        if (m) {
          params.period = 'custom';
          params.startDate = m[1];
          params.endDate = m[2];
        }
      } else {
        // Default heuristic: last_month if contains 'mes', else this_month
        if (/mes\b/.test(msgLower)) params.period = 'last_month';
        else params.period = 'this_month';
      }

      // Attempt to extract employee name (look for capitalized sequences or common last names)
      let nameCandidate: string | undefined;
      const capMatches = lastUserMsg.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/g);
      if (capMatches && capMatches.length > 0) {
        // pick longest match as name
        nameCandidate = capMatches.reduce((a: string, b: string) => (a.length > b.length ? a : b));
      } else {
        // Fallback: remove known words and try remaining
        let guess = lastUserMsg.replace(/cu[aá]ntas horas|horas|trabaj[oó]|el mes pasado|la semana pasada|esta semana|hoy|ayer|del|al|en|el|la|de|mes/gi, '').replace(/[\?\.,]/g, '').trim();
        if (guess && guess.length > 2 && guess.length < 60) {
          nameCandidate = guess.split(' ').slice(0,4).join(' ').trim();
        }
      }

      if (nameCandidate) params.employeeName = nameCandidate;

      // Call the query function deterministically
      const context = { storage, companyId, adminUserId } as any;
      const result = await executeAIFunction('getEmployeeWorkHours', params, context);

      if (result && result.navigateTo) {
        // Friendly, short phrasing
        const empName = result.data?.employeeName || params.employeeName || 'el equipo';
        const periodDesc = result.data?.period || (params.period === 'last_month' ? 'el mes pasado' : params.period);
        const hours = typeof result.data?.totalHours === 'number' ? `${Number(result.data.totalHours).toFixed(1)}` : '';
        const friendly = `Sí, ${empName} trabajó ${hours} horas ${periodDesc} — te las muestro.`.replace(/\s+/g, ' ').trim();

        return {
          status: 200,
          body: {
            message: friendly,
            functionCalled: 'getEmployeeWorkHours',
            result: result,
            navigateTo: result.navigateTo
          }
        };
      } else if (result && result.success && !result.navigateTo) {
        // If function succeeded but no navigateTo, still return friendly message
        const friendly = result.message || 'He consultado las horas.';
        return { status: 200, body: { message: friendly } };
      } else if (result && !result.success) {
        // Clarify if employee not found or function returned an error
        const errMsg = result.error || 'No encontré al empleado. ¿Puedes indicar el nombre completo o más datos?';
        return { status: 200, body: { message: errMsg } };
      }
    } catch (err: any) {
      console.error('[PRE-PARSER] hours pre-parser failed:', err?.message || err);
      // Fallthrough to regular AI flow if pre-parser fails
    }
  }

  // Run assistant turn (model selection + escalation)
  const tools = (aiFunctions || []).map((f: any) => ({ type: 'function', function: f }));
  const runResult = await runAssistantTurn(openai, messages, tools);
  const assistantMessage = runResult.assistantMessage;
  let navigateToUrl: string | null = null;
  const toolResults: any[] = [];

  if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
    const context = { storage, companyId, adminUserId } as any;
    const results = await runToolCalls(assistantMessage.tool_calls, context, resolveEmployeeName || (async () => { throw new Error('resolveEmployeeName not provided'); }), executeAIFunction, storage);
    for (const tr of results) {
      const parsed = JSON.parse(tr.content);
      if (parsed.navigateTo) navigateToUrl = parsed.navigateTo;
      toolResults.push(parsed);
    }
  }

  // Post-process tool results to produce friendly, concise messages for certain queries (e.g., getEmployeeWorkHours)
  let finalMessage = assistantMessage?.content || null;
  if (Array.isArray(toolResults) && toolResults.length > 0) {
    // Look for an hours summary inside tool results
    const hoursResult = toolResults.find((r: any) => r && ((r.data && typeof r.data.totalHours === 'number') || typeof r.totalHours === 'number'));
    if (hoursResult) {
      const empName = hoursResult.data?.employeeName || hoursResult.employeeName || 'el equipo';
      const totalHours = (hoursResult.data && hoursResult.data.totalHours) || hoursResult.totalHours;
      const periodDesc = (hoursResult.data && hoursResult.data.period) || hoursResult.period || '';
      const hoursText = typeof totalHours === 'number' ? `${Number(totalHours).toFixed(1)}` : '';
      finalMessage = `Sí, ${empName} trabajó ${hoursText} horas ${periodDesc} — te las muestro.`.replace(/\s+/g, ' ').trim();
    }

    // Other tool types could be handled similarly in the future
  }

  return {
    status: 200,
    body: {
      message: finalMessage,
      functionCalled: assistantMessage?.tool_calls?.map((t: any) => t.function.name).join(', ') || null,
      result: toolResults.length > 0 ? toolResults : null,
      navigateTo: navigateToUrl
    }
  };
}