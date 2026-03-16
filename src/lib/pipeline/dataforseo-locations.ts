/**
 * dataforseo-locations.ts
 *
 * Sistema progressivo de geo-targeting para DataForSEO.
 * Resolve a região do lead em múltiplos níveis (cidade → região metro → UF → país)
 * para permitir fallback inteligente quando dados de volume não existem no nível mais granular.
 */

// ---------------------------------------------------------------------------
// Normalização de nomes de cidade
// ---------------------------------------------------------------------------

/** Remove acentos, converte para minúsculas e strip espaços extras */
export function normalizeCityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritical marks
    .toLowerCase()
    .replace(/[''`]/g, '')           // remove apóstrofos
    .replace(/\s+/g, ' ')           // colapsa espaços
    .trim();
}

// ---------------------------------------------------------------------------
// Códigos de localização DataForSEO — nível cidade
// ---------------------------------------------------------------------------
// Chaves já normalizadas (sem acento, minúsculas).
// Fonte: https://api.dataforseo.com/v3/serp/google/locations (filtrado por country_iso_code=BR)

const CITY_LOCATION_CODES: Record<string, number> = {
  // --- Grande São Paulo ---
  'sao paulo': 1001773,
  'guarulhos': 1001736,
  'osasco': 1001754,
  'barueri': 1001724,
  'carapicuiba': 1031549,
  'cotia': 1001731,
  'itapecerica da serra': 1031711,
  'embu': 1031616,
  'taboao da serra': 1032086,
  'ferraz de vasconcelos': 1031630,
  'itaquaquecetuba': 1031720,
  'suzano': 1001777,
  'mogi das cruzes': 1031822,

  // --- ABC Paulista ---
  'maua': 1031811,
  'santo andre': 1001765,
  'sao bernardo do campo': 1001767,
  'sao caetano do sul': 9197259,
  'diadema': 1031606,
  'ribeirao pires': 1001762,
  'rio grande da serra': 1031974,

  // --- Interior SP ---
  'campinas': 1001729,
  'jundiai': 1001743,
  'sorocaba': 1001776,
  'ribeirao preto': 1001763,

  // --- Baixada Santista ---
  'santos': 1001766,
  'sao vicente': 1001775,
  'guaruja': 1031666,
  'praia grande': 1031945,
  'cubatao': 1001732,

  // --- Rio de Janeiro ---
  'rio de janeiro': 1001649,
  'niteroi': 1001650,
  'duque de caxias': 1031613,
  'nova iguacu': 1001652,
  'sao goncalo': 1032056,

  // --- Capitais ---
  'belo horizonte': 1001561,
  'curitiba': 1001590,
  'porto alegre': 1001598,
  'salvador': 1001531,
  'recife': 1001586,
  'fortaleza': 1001541,
  'brasilia': 1001538,
  'manaus': 1001511,
  'goiania': 1001543,
  'florianopolis': 1001584,
  'vitoria': 1001608,
  'natal': 1001577,
  'joao pessoa': 1001568,
  'maceio': 1001506,
  'aracaju': 1001526,
  'sao luis': 1001573,
  'teresina': 1001600,
  'belem': 1001533,
  'campo grande': 1001564,
  'cuiaba': 1001592,
};

// ---------------------------------------------------------------------------
// Códigos de UF (estado) — DataForSEO
// ---------------------------------------------------------------------------

export const UF_LOCATION_CODES: Record<string, number> = {
  AC: 20015, AL: 20017, AP: 20019, AM: 20021, BA: 20023,
  CE: 20025, DF: 20027, ES: 20029, GO: 20031, MA: 20033,
  MT: 20035, MS: 20037, MG: 20039, PA: 20041, PB: 20043,
  PR: 20045, PE: 20047, PI: 20049, RJ: 20051, RN: 20053,
  RS: 20055, RO: 20057, RR: 20059, SC: 20061, SP: 20063,
  SE: 20065, TO: 20067,
};

/** Código de país: Brasil */
export const BRAZIL_LOCATION_CODE = 2076;

// ---------------------------------------------------------------------------
// Agrupamentos regionais (regiões metropolitanas)
// ---------------------------------------------------------------------------

const REGIONAL_GROUPS: Record<string, string[]> = {
  'ABC Paulista': [
    'Maua', 'Santo Andre', 'Sao Bernardo do Campo', 'Sao Caetano do Sul',
    'Diadema', 'Ribeirao Pires', 'Rio Grande da Serra',
  ],
  'Grande SP Oeste': [
    'Osasco', 'Barueri', 'Carapicuiba', 'Cotia', 'Itapecerica da Serra',
    'Embu', 'Taboao da Serra', 'Jandira', 'Santana de Parnaiba',
  ],
  'Grande SP Leste': [
    'Guarulhos', 'Mogi das Cruzes', 'Suzano', 'Itaquaquecetuba',
    'Ferraz de Vasconcelos', 'Poa', 'Aruja',
  ],
  'Baixada Santista': [
    'Santos', 'Sao Vicente', 'Guaruja', 'Praia Grande', 'Cubatao',
    'Mongagua', 'Peruibe', 'Bertioga', 'Itanhaem',
  ],
  'Baixada Fluminense': [
    'Duque de Caxias', 'Nova Iguacu', 'Sao Joao de Meriti', 'Belford Roxo',
    'Nilopolis', 'Mesquita', 'Queimados', 'Japeri', 'Mage',
  ],
  'Grande Niteroi': [
    'Niteroi', 'Sao Goncalo', 'Itaborai', 'Marica',
  ],
  'Grande Campinas': [
    'Campinas', 'Sumare', 'Hortolandia', 'Indaiatuba', 'Paulinia',
    'Valinhos', 'Vinhedo', 'Americana', 'Santa Barbara d\'Oeste',
  ],
  'Grande BH': [
    'Belo Horizonte', 'Contagem', 'Betim', 'Ribeirao das Neves',
    'Santa Luzia', 'Ibirite', 'Sabara',
  ],
  'Grande Curitiba': [
    'Curitiba', 'Sao Jose dos Pinhais', 'Colombo', 'Araucaria',
    'Pinhais', 'Campo Largo', 'Almirante Tamandare',
  ],
  'Grande Porto Alegre': [
    'Porto Alegre', 'Canoas', 'Novo Hamburgo', 'Sao Leopoldo',
    'Gravata', 'Viamao', 'Alvorada', 'Cachoeirinha',
  ],
  'Grande Recife': [
    'Recife', 'Jaboatao dos Guararapes', 'Olinda', 'Paulista',
    'Cabo de Santo Agostinho', 'Camaragibe',
  ],
  'Grande Salvador': [
    'Salvador', 'Camacari', 'Lauro de Freitas', 'Simoes Filho', 'Candeias',
  ],
  'Grande Fortaleza': [
    'Fortaleza', 'Caucaia', 'Maracanau', 'Maranguape', 'Pacatuba',
  ],
  'Grande Goiania': [
    'Goiania', 'Aparecida de Goiania', 'Anapolis', 'Trindade', 'Senador Canedo',
  ],
};

// ---------------------------------------------------------------------------
// Mapa de cidade normalizada → nome do grupo (gerado uma vez)
// ---------------------------------------------------------------------------

const cityToGroupMap: Map<string, string> = new Map();
for (const [groupName, cities] of Object.entries(REGIONAL_GROUPS)) {
  for (const city of cities) {
    cityToGroupMap.set(normalizeCityName(city), groupName);
  }
}

// ---------------------------------------------------------------------------
// Funções de consulta
// ---------------------------------------------------------------------------

/**
 * Tenta encontrar uma cidade no texto da região e retorna o código DataForSEO.
 * Busca primeiro match exato, depois busca parcial (a cidade contida na região).
 */
export function getCityLocationCode(
  region: string,
): { code: number; cityName: string } | null {
  const normalized = normalizeCityName(region);

  // 1. Match exato (região é só o nome da cidade, talvez com UF)
  //    ex: "maua, sp" → tenta "maua, sp", depois tenta "maua"
  for (const [city, code] of Object.entries(CITY_LOCATION_CODES)) {
    if (normalized === city) {
      return { code, cityName: city };
    }
  }

  // 2. Match parcial — a cidade aparece como substring da região
  //    Ordenamos por tamanho decrescente para preferir matches mais específicos
  //    ex: "Sao Bernardo do Campo" antes de "Campo"
  const sortedCities = Object.entries(CITY_LOCATION_CODES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [city, code] of sortedCities) {
    // Verifica se a cidade aparece como palavra inteira na região
    const regex = new RegExp(`\\b${escapeRegex(city)}\\b`);
    if (regex.test(normalized)) {
      return { code, cityName: city };
    }
  }

  return null;
}

/**
 * Encontra o grupo regional ao qual a cidade pertence.
 * Aceita nome com ou sem acentos.
 */
export function getRegionalGroup(
  cityName: string,
): { groupName: string; cities: string[] } | null {
  const normalized = normalizeCityName(cityName);
  const groupName = cityToGroupMap.get(normalized);
  if (!groupName) return null;
  return { groupName, cities: REGIONAL_GROUPS[groupName] };
}

/**
 * Retorna todos os códigos de localização disponíveis para um grupo regional.
 * Cidades sem código no mapa são omitidas.
 */
export function getRegionalGroupCodes(
  groupName: string,
): { cityName: string; code: number }[] {
  const cities = REGIONAL_GROUPS[groupName];
  if (!cities) return [];

  const results: { cityName: string; code: number }[] = [];
  for (const city of cities) {
    const normalized = normalizeCityName(city);
    const code = CITY_LOCATION_CODES[normalized];
    if (code) {
      results.push({ cityName: city, code });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Função principal: resolução hierárquica de localização
// ---------------------------------------------------------------------------

export interface LocationLevel {
  level: 'city' | 'regional' | 'state' | 'country';
  label: string;
  locationCodes: number[];
}

/**
 * Resolve a string de região em uma hierarquia de níveis de localização,
 * do mais específico (cidade) ao mais genérico (país).
 *
 * Exemplo: "Mauá, SP" →
 *   city     → [1031811]
 *   regional → [1031811, 1001765, 1001767, ...]  (ABC Paulista)
 *   state    → [20063]  (SP)
 *   country  → [2076]   (Brasil)
 *
 * Níveis sem dados disponíveis são omitidos.
 */
export function resolveLocationHierarchy(region: string): {
  levels: LocationLevel[];
} {
  const levels: LocationLevel[] = [];

  // --- Nível 1: Cidade ---
  const cityMatch = getCityLocationCode(region);
  if (cityMatch) {
    levels.push({
      level: 'city',
      label: cityMatch.cityName,
      locationCodes: [cityMatch.code],
    });

    // --- Nível 2: Região metropolitana ---
    const group = getRegionalGroup(cityMatch.cityName);
    if (group) {
      const groupCodes = getRegionalGroupCodes(group.groupName);
      if (groupCodes.length > 0) {
        levels.push({
          level: 'regional',
          label: group.groupName,
          locationCodes: groupCodes.map((c) => c.code),
        });
      }
    }
  }

  // --- Nível 3: Estado (UF) ---
  const ufMatch = region.match(
    /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/,
  );
  if (ufMatch) {
    const uf = ufMatch[1];
    const ufCode = UF_LOCATION_CODES[uf];
    if (ufCode) {
      levels.push({
        level: 'state',
        label: uf,
        locationCodes: [ufCode],
      });
    }
  }

  // --- Nível 4: País (sempre presente) ---
  levels.push({
    level: 'country',
    label: 'Brasil',
    locationCodes: [BRAZIL_LOCATION_CODE],
  });

  return { levels };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escapa caracteres especiais de regex */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
