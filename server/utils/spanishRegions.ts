const regionCodeByName: Record<string, string> = {
  'andalucia': 'ES-AN',
  'aragon': 'ES-AR',
  'asturias': 'ES-AS',
  'islas baleares': 'ES-IB',
  'baleares': 'ES-IB',
  'canarias': 'ES-CN',
  'cantabria': 'ES-CB',
  'castilla-la mancha': 'ES-CM',
  'castilla y leon': 'ES-CL',
  'cataluna': 'ES-CT',
  'cataluña': 'ES-CT',
  'comunidad valenciana': 'ES-VC',
  'valencia': 'ES-VC',
  'extremadura': 'ES-EX',
  'galicia': 'ES-GA',
  'la rioja': 'ES-RI',
  'madrid': 'ES-MD',
  'region de murcia': 'ES-MC',
  'murcia': 'ES-MC',
  'navarra': 'ES-NC',
  'pais vasco': 'ES-PV',
  'pais vasco/ea': 'ES-PV',
  'ceuta': 'ES-CE',
  'melilla': 'ES-ML'
};

const provinceToRegionName: Record<string, string> = {
  'alava': 'Pais Vasco',
  'albacete': 'Castilla-La Mancha',
  'alicante': 'Comunidad Valenciana',
  'almeria': 'Andalucia',
  'asturias': 'Asturias',
  'avila': 'Castilla y Leon',
  'badajoz': 'Extremadura',
  'barcelona': 'Cataluna',
  'burgos': 'Castilla y Leon',
  'caceres': 'Extremadura',
  'cadiz': 'Andalucia',
  'cantabria': 'Cantabria',
  'castellon': 'Comunidad Valenciana',
  'ceuta': 'Ceuta',
  'ciudad real': 'Castilla-La Mancha',
  'cordoba': 'Andalucia',
  'coruna': 'Galicia',
  'cuenca': 'Castilla-La Mancha',
  'gerona': 'Cataluna',
  'girona': 'Cataluna',
  'granada': 'Andalucia',
  'guadalajara': 'Castilla-La Mancha',
  'guipuzcoa': 'Pais Vasco',
  'huelva': 'Andalucia',
  'huesca': 'Aragon',
  'islas baleares': 'Islas Baleares',
  'jaen': 'Andalucia',
  'la rioja': 'La Rioja',
  'las palmas': 'Canarias',
  'leon': 'Castilla y Leon',
  'lleida': 'Cataluna',
  'lugo': 'Galicia',
  'madrid': 'Madrid',
  'malaga': 'Andalucia',
  'melilla': 'Melilla',
  'murcia': 'Region de Murcia',
  'navarra': 'Navarra',
  'ourense': 'Galicia',
  'palencia': 'Castilla y Leon',
  'pontevedra': 'Galicia',
  'salamanca': 'Castilla y Leon',
  'segovia': 'Castilla y Leon',
  'sevilla': 'Andalucia',
  'soria': 'Castilla y Leon',
  'tarragona': 'Cataluna',
  'santa cruz de tenerife': 'Canarias',
  'teruel': 'Aragon',
  'toledo': 'Castilla-La Mancha',
  'valencia': 'Comunidad Valenciana',
  'valladolid': 'Castilla y Leon',
  'vizcaya': 'Pais Vasco',
  'zamora': 'Castilla y Leon',
  'zaragoza': 'Aragon'
};

const normalizeText = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

export function getRegionNameFromProvince(province?: string | null): string | null {
  if (!province) return null;
  const normalized = normalizeText(province);
  return provinceToRegionName[normalized] || null;
}

export function getRegionCodeFromProvince(province?: string | null): string | null {
  const regionName = getRegionNameFromProvince(province);
  if (!regionName) return null;
  const normalizedRegion = normalizeText(regionName);
  return regionCodeByName[normalizedRegion] || null;
}

export function getRegionCodeFromName(regionName?: string | null): string | null {
  if (!regionName) return null;
  const normalized = normalizeText(regionName);
  return regionCodeByName[normalized] || null;
}
