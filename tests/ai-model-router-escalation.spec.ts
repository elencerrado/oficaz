import { describe, expect, it } from 'vitest';
import { shouldEscalate } from '../server/ai-model-router';

describe('shouldEscalate', () => {
  it('does not escalate mutation tool calls when response is confident', () => {
    const assistantMessage = {
      tool_calls: [{ function: { name: 'createEmployee' } }],
      content: 'Hecho. Empleado creado correctamente.'
    };

    expect(shouldEscalate(assistantMessage)).toBe(false);
  });

  it('escalates mutation tool calls when uncertainty is present', () => {
    const assistantMessage = {
      tool_calls: [{ function: { name: 'createEmployee' } }],
      content: 'No puedo asegurar el resultado todavía.'
    };

    expect(shouldEscalate(assistantMessage)).toBe(true);
  });

  it('escalates non-mutation responses when uncertainty is present', () => {
    const assistantMessage = {
      content: 'No tengo acceso para comprobar esto ahora mismo.'
    };

    expect(shouldEscalate(assistantMessage)).toBe(true);
  });
});
