// Utility parser to extract excluded weekdays from natural language phrases
// Normalizes accents/articles and supports multiple exclusion segments in one message
const weekdayMap: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseExcludedWeekdays(message: string): {
  excludedWeekdays: number[];
  foundExclusionKeyword: boolean;
} {
  const normalized = normalizeText(message);
  const excluded = new Set<number>();
  let foundExclusionKeyword = false;

  const exclusionRegex = /(?:menos|excepto|excluye|quita|sin)\s+([^.;]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = exclusionRegex.exec(normalized)) !== null) {
    foundExclusionKeyword = true;
    const segment = match[1]
      .replace(/\b(el|la|los|las|al)\b/g, ' ')
      .replace(/[.,;]/g, ' ');

    const tokens = segment.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const day = weekdayMap[token];
      if (typeof day === 'number') {
        excluded.add(day);
      }
    }
  }

  return {
    excludedWeekdays: Array.from(excluded),
    foundExclusionKeyword,
  };
}
