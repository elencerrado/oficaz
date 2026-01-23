import { describe, it, expect } from 'vitest';
import { getPreferredModel, shouldEscalate, MUTATION_FUNCTIONS } from '../server/ai-model-router';

describe('ai-model-router heuristics', () => {
  it('chooses strong model for explicit complexity keyword', () => {
    const messages = [{ role: 'user', content: 'Crear un cuadrante masivo para 50 empleados con rotaciones' }];
    const model = getPreferredModel(messages);
    expect(model).toBe(process.env.AI_INTEGRATIONS_OPENAI_STRONG_MODEL || 'gpt-4o');
  });

  it('chooses strong model for long messages', () => {
    const long = 'x'.repeat(500);
    const messages = [{ role: 'user', content: long }];
    const model = getPreferredModel(messages);
    expect(model).toBe(process.env.AI_INTEGRATIONS_OPENAI_STRONG_MODEL || 'gpt-4o');
  });

  it('chooses fast model for short, simple queries', () => {
    const messages = [{ role: 'user', content: '¿Cuántas horas trabajó Ramírez esta semana?' }];
    const model = getPreferredModel(messages);
    expect(model).toBe(process.env.AI_INTEGRATIONS_OPENAI_FAST_MODEL || 'gpt-4o-mini');
  });

  it('detects escalation when assistant attempts a mutative function', () => {
    const assistantMsg: any = { function_call: { name: 'createEmployee' } };
    expect(shouldEscalate(assistantMsg)).toBe(true);
    expect(MUTATION_FUNCTIONS.has('createEmployee')).toBe(true);
  });

  it('detects escalation when assistant expresses uncertainty', () => {
    const assistantMsg: any = { content: 'No puedo acceder a la base de datos para crear el usuario' };
    expect(shouldEscalate(assistantMsg)).toBe(true);
  });

  it('does not escalate for simple informative messages', () => {
    const assistantMsg: any = { content: 'Ramírez trabajó 32 horas esta semana' };
    expect(shouldEscalate(assistantMsg)).toBe(false);
  });
});
