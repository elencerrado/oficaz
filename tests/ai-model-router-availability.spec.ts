import { describe, it, expect, vi } from 'vitest';
import { pickAvailableModel } from '../server/ai-model-router';

describe('pickAvailableModel', () => {
  it('returns preferred when available', async () => {
    const mockClient: any = {
      models: {
        list: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4' }, { id: 'gpt-3.5-turbo' }] })
      }
    };
    const chosen = await pickAvailableModel(mockClient, 'gpt-4', ['gpt-3.5-turbo']);
    expect(chosen).toBe('gpt-4');
  });

  it('returns fallback by prefix if preferred not present', async () => {
    const mockClient: any = {
      models: {
        list: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-3.5-turbo' }, { id: 'gpt-4-0613' }] })
      }
    };
    const chosen = await pickAvailableModel(mockClient, 'gpt-4o-mini', ['gpt-4']);
    expect(chosen.startsWith('gpt-4')).toBe(true);
  });

  it('returns first common fallback if none match', async () => {
    const mockClient: any = {
      models: {
        list: vi.fn().mockResolvedValue({ data: [{ id: 'some-other-model' }, { id: 'gpt-3.5-turbo' }] })
      }
    };
    const chosen = await pickAvailableModel(mockClient, 'gpt-4o-mini');
    expect(chosen.startsWith('gpt-3.5')).toBe(true);
  });
});
