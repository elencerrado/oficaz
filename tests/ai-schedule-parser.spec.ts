import { describe, expect, it } from 'vitest';
import { parseExcludedWeekdays } from '../server/ai-schedule-parser';

const sort = (values: number[]) => [...values].sort((a, b) => a - b);

describe('parseExcludedWeekdays', () => {
  it('detects multiple exclusions with commas and accents', () => {
    const { excludedWeekdays, foundExclusionKeyword } = parseExcludedWeekdays('esta semana trabaja de 8 a 15 todos los dias menos lunes, jueves y sábado');
    expect(foundExclusionKeyword).toBe(true);
    expect(sort(excludedWeekdays)).toEqual([1, 4, 6]);
  });

  it('works without commas or articles', () => {
    const { excludedWeekdays, foundExclusionKeyword } = parseExcludedWeekdays('todos los dias menos lunes jueves sabado');
    expect(foundExclusionKeyword).toBe(true);
    expect(sort(excludedWeekdays)).toEqual([1, 4, 6]);
  });

  it('supports exclusions across multiple sentences', () => {
    const { excludedWeekdays, foundExclusionKeyword } = parseExcludedWeekdays('menos el jueves. y tambien quita el sabado');
    expect(foundExclusionKeyword).toBe(true);
    expect(sort(excludedWeekdays)).toEqual([4, 6]);
  });

  it('normalizes articles and accents', () => {
    const { excludedWeekdays, foundExclusionKeyword } = parseExcludedWeekdays('excepto el sábado y el jueves');
    expect(foundExclusionKeyword).toBe(true);
    expect(sort(excludedWeekdays)).toEqual([4, 6]);
  });

  it('signals ambiguity when no weekday is found but keyword is present', () => {
    const { excludedWeekdays, foundExclusionKeyword } = parseExcludedWeekdays('menos los que tu veas');
    expect(foundExclusionKeyword).toBe(true);
    expect(excludedWeekdays).toHaveLength(0);
  });
});
