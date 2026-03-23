// ============================================================================
// IBGE Municipal Data — Dados demográficos + audiência estimada
// Busca população, raio geográfico e tamanho de audiência via API do IBGE
// ============================================================================

import type { IBGEData, AudienciaEstimada } from '../types/pipeline.types';

// Estados brasileiros para detectar se a região é BR
const ESTADOS_BR = [
  'acre', 'alagoas', 'amapá', 'amapa', 'amazonas', 'bahia', 'ceará', 'ceara',
  'distrito federal', 'espírito santo', 'espirito santo', 'goiás', 'goias',
  'maranhão', 'maranhao', 'mato grosso', 'mato grosso do sul', 'minas gerais',
  'pará', 'para', 'paraíba', 'paraiba', 'paraná', 'parana', 'pernambuco',
  'piauí', 'piaui', 'rio de janeiro', 'rio grande do norte', 'rio grande do sul',
  'rondônia', 'rondonia', 'roraima', 'santa catarina', 'são paulo', 'sao paulo',
  'sergipe', 'tocantins',
];

const SIGLAS_UF = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

function isRegiaoBrasileira(region: string): boolean {
  const normalized = region.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Verifica nome de estado
  for (const estado of ESTADOS_BR) {
    const estadoNorm = estado.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(estadoNorm)) return true;
  }

  // Verifica sigla de UF (ex: "São Paulo, SP" ou "Curitiba - PR")
  for (const sigla of SIGLAS_UF) {
    // Procura sigla isolada (não como parte de outra palavra)
    const regex = new RegExp(`\\b${sigla}\\b`);
    if (regex.test(region)) return true;
  }

  // Palavras-chave brasileiras comuns em endereços
  if (/brasil|brazil/i.test(normalized)) return true;

  return false;
}

function extractCidadeFromRegion(region: string): string {
  // Pega a primeira parte antes de vírgula, traço ou parênteses
  return region.split(/[,\-–(]/)[0].trim();
}

export async function getIBGEMunicipalData(cityOrRegion: string, originalRegion?: string): Promise<IBGEData | null> {
  // Verifica se é BR usando a região original (com estado/sigla) OU a cidade extraída
  const regionToCheck = originalRegion || cityOrRegion;
  if (!isRegiaoBrasileira(regionToCheck)) {
    return null;
  }

  const cidade = extractCidadeFromRegion(cityOrRegion);
  if (!cidade || cidade.length < 2) return null;

  try {
    // 1. Busca município — extrai UF da região original e usa endpoint filtrado
    const ufMatch = (originalRegion || cityOrRegion).match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
    const uf = ufMatch ? ufMatch[1] : '';
    const apiUrl = uf
      ? `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
      : `https://servicodados.ibge.gov.br/api/v1/localidades/municipios`;
    const searchRes = await fetch(apiUrl);

    if (!searchRes.ok) {
      console.warn('[IBGE] Busca de município falhou:', searchRes.status);
      return null;
    }

    const allMunicipios = await searchRes.json();
    if (!Array.isArray(allMunicipios) || allMunicipios.length === 0) {
      console.warn(`[IBGE] Nenhum município retornado`);
      return null;
    }

    // Filtra por nome (a API não filtra por ?nome=)
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cidadeNorm = normalize(cidade);
    const municipio = allMunicipios.find((m: any) => normalize(m.nome) === cidadeNorm);
    if (!municipio) {
      console.warn(`[IBGE] Município "${cidade}" não encontrado em ${allMunicipios.length} candidatos (UF=${uf || 'todos'})`);
      return null;
    }

    const id = String(municipio.id);
    const nomeMunicipio = municipio.nome;
    const estado = municipio.microrregiao?.mesorregiao?.UF?.nome || municipio.microrregiao?.mesorregiao?.UF?.sigla || '';
    console.log(`[IBGE] Município encontrado: ${nomeMunicipio} (id=${id}, UF=${uf || estado})`);

    // 2. Busca população — tenta estimativas (6579) e censo (1301) como fallback
    let populacao = 0;

    // 2a. Estimativas populacionais (agregado 6579, variável 9324)
    for (const ano of ['2024', '2023', '2022']) {
      try {
        const popRes = await fetch(
          `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/${ano}/variaveis/9324?localidades=N6[${id}]`,
        );
        if (popRes.ok) {
          const popData = await popRes.json();
          const serie = popData?.[0]?.resultados?.[0]?.series?.[0]?.serie;
          if (serie) {
            const valores = Object.values(serie) as string[];
            const ultimo = valores[valores.length - 1];
            const parsed = parseInt(ultimo, 10);
            if (parsed > 0) {
              populacao = parsed;
              console.log(`[IBGE] População ${nomeMunicipio}: ${populacao} (estimativa ${ano})`);
              break;
            }
          }
        }
      } catch (err) {
        console.warn(`[IBGE] Estimativa ${ano} falhou para ${nomeMunicipio}:`, (err as Error).message);
      }
    }

    // 2b. Fallback: Censo 2022 (agregado 1301, variável 93)
    if (populacao === 0) {
      try {
        const censoRes = await fetch(
          `https://servicodados.ibge.gov.br/api/v3/agregados/1301/periodos/2022/variaveis/93?localidades=N6[${id}]`,
        );
        if (censoRes.ok) {
          const censoData = await censoRes.json();
          const serie = censoData?.[0]?.resultados?.[0]?.series?.[0]?.serie;
          if (serie) {
            const valores = Object.values(serie) as string[];
            const parsed = parseInt(valores[valores.length - 1], 10);
            if (parsed > 0) {
              populacao = parsed;
              console.log(`[IBGE] População ${nomeMunicipio}: ${populacao} (Censo 2022)`);
            }
          }
        }
      } catch (err) {
        console.warn(`[IBGE] Censo 2022 falhou para ${nomeMunicipio}:`, (err as Error).message);
      }
    }

    if (populacao === 0) {
      console.warn(`[IBGE] População não disponível para ${nomeMunicipio}`);
      return null;
    }

    return {
      municipio: nomeMunicipio,
      estado,
      populacao,
      codigoIBGE: id,
    };
  } catch (err) {
    console.error('[IBGE] Erro ao consultar API:', err);
    return null;
  }
}

// ============================================================================
// Audiência estimada — raio geográfico + população
// ============================================================================

const POPULACAO_BRASIL = 215_000_000;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Detecta densidade usando população como proxy principal.
 * No Brasil, municípios com >100k habitantes são praticamente todos urbanos.
 * A API IBGE de área territorial retorna valores inconsistentes,
 * então usamos população como indicador mais confiável.
 */
function detectarDensidade(populacao: number, densidadeHabKm2?: number): 'alta' | 'baixa' {
  // Primeiro: população é proxy confiável
  if (populacao >= 500_000) return 'alta';
  if (populacao < 100_000) return 'baixa';
  // Faixa intermediária: usa densidade se disponível
  if (densidadeHabKm2 && densidadeHabKm2 > 500) return 'alta';
  return 'baixa';
}

function getRaioKm(densidade: 'alta' | 'baixa'): number {
  return densidade === 'alta' ? 3 : 10;
}

interface MunicipioInfo {
  id: number;
  nome: string;
  uf: string;
  estado: string;
  populacao: number;
  ibgeAno: number;
  areaKm2: number;
  densidadeHabKm2: number;
  lat: number;
  lng: number;
}

/**
 * Geocode via Nominatim (OpenStreetMap) — fallback para obter lat/lng do município.
 */
export async function geocodeNominatim(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({
      city,
      country: 'Brazil',
      format: 'json',
      limit: '1',
    });
    if (state) params.set('state', state);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { 'User-Agent': 'ViroLocal/1.0 (contato@virolocal.com)' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(`[IBGE Nominatim] ${city}, ${state} → lat=${lat}, lng=${lng}`);
        return { lat, lng };
      }
    }
    return null;
  } catch (err) {
    console.warn('[IBGE Nominatim] Geocoding falhou:', (err as Error).message);
    return null;
  }
}

async function getMunicipioInfo(city: string, state: string): Promise<MunicipioInfo | null> {
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cityNorm = normalize(city);

  // Remove abreviações comuns de nomes de cidade (R. → Rio, S. → São, Sta. → Santa, etc.)
  const expandedCity = city
    .replace(/^R\.\s*/i, 'Rio ')
    .replace(/^S\.\s*/i, 'São ')
    .replace(/^Sta\.\s*/i, 'Santa ')
    .replace(/^Sto\.\s*/i, 'Santo ')
    .trim();
  const expandedCityNorm = normalize(expandedCity);

  console.log(`[IBGE getMunicipioInfo] city="${city}", expanded="${expandedCity}", state="${state}"`);

  // 1. Busca municípios — usa endpoint por UF se disponível (644 results vs 5571)
  // NOTA: ?nome= na API IBGE NÃO filtra, retorna todos. Por isso filtramos em memória.
  const isUF = /^[A-Z]{2}$/.test(state);
  const apiUrl = isUF
    ? `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios`
    : `https://servicodados.ibge.gov.br/api/v1/localidades/municipios`;
  console.log(`[IBGE getMunicipioInfo] Endpoint: ${isUF ? `estados/${state}` : 'todos'}`);
  const res = await fetch(apiUrl);
  if (!res.ok) {
    console.warn(`[IBGE getMunicipioInfo] Busca falhou: HTTP ${res.status}`);
    return null;
  }
  const candidates = await res.json();
  console.log(`[IBGE getMunicipioInfo] ${candidates.length} candidatos (${isUF ? `UF=${state}` : 'todos'})`);

  if (!Array.isArray(candidates) || candidates.length === 0) {
    console.warn(`[IBGE getMunicipioInfo] Nenhum município encontrado para "${expandedCity}"`);
    return null;
  }

  // Filtra por nome exato e opcionalmente UF
  const stateNorm = normalize(state);
  const match = candidates.find((m: any) => {
    const nomeNorm = normalize(m.nome);
    const uf = m.microrregiao?.mesorregiao?.UF;
    const ufSigla = uf?.sigla?.toLowerCase() || '';
    const ufNome = normalize(uf?.nome || '');
    const nameMatch = nomeNorm === expandedCityNorm || nomeNorm === cityNorm;
    if (!stateNorm) return nameMatch;
    return nameMatch && (ufSigla === stateNorm || ufNome.includes(stateNorm));
  }) || candidates.find((m: any) => {
    const nomeNorm = normalize(m.nome);
    return nomeNorm === expandedCityNorm || nomeNorm === cityNorm;
  });

  if (!match) return null;
  const uf = match.microrregiao?.mesorregiao?.UF;
  const ufSigla = uf?.sigla || '';
  const ufNome = uf?.nome || '';
  console.log(`[IBGE getMunicipioInfo] Match: ${match.nome} (id=${match.id}, UF=${ufSigla}/${ufNome})`);

  const id = Number(match.id);
  const nome = match.nome;
  const estado = ufNome;

  // 2. Busca população — estimativas (6579) + censo (1301) como fallback
  let populacao = 0;
  let ibgeAno = 0;

  // 2a. Estimativas populacionais (agregado 6579, variável 9324)
  for (const ano of ['2024', '2023', '2022']) {
    try {
      const popRes = await fetch(
        `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/${ano}/variaveis/9324?localidades=N6[${id}]`,
      );
      if (popRes.ok) {
        const popData = await popRes.json();
        const serie = popData?.[0]?.resultados?.[0]?.series?.[0]?.serie;
        if (serie) {
          const valores = Object.values(serie) as string[];
          const parsed = parseInt(valores[valores.length - 1], 10);
          if (parsed > 0) {
            populacao = parsed;
            ibgeAno = parseInt(ano, 10);
            console.log(`[IBGE getMunicipioInfo] População ${nome}: ${populacao} (estimativa ${ano})`);
            break;
          }
        }
      }
    } catch (err) {
      console.warn(`[IBGE getMunicipioInfo] Estimativa ${ano} falhou para ${nome}:`, (err as Error).message);
    }
  }

  // 2b. Fallback: Censo 2022 (agregado 1301, variável 93)
  if (populacao === 0) {
    try {
      const censoRes = await fetch(
        `https://servicodados.ibge.gov.br/api/v3/agregados/1301/periodos/2022/variaveis/93?localidades=N6[${id}]`,
      );
      if (censoRes.ok) {
        const censoData = await censoRes.json();
        const serie = censoData?.[0]?.resultados?.[0]?.series?.[0]?.serie;
        if (serie) {
          const valores = Object.values(serie) as string[];
          const parsed = parseInt(valores[valores.length - 1], 10);
          if (parsed > 0) {
            populacao = parsed;
            ibgeAno = 2022;
            console.log(`[IBGE getMunicipioInfo] População ${nome}: ${populacao} (Censo 2022)`);
          }
        }
      }
    } catch (err) {
      console.warn(`[IBGE getMunicipioInfo] Censo 2022 falhou para ${nome}:`, (err as Error).message);
    }
  }

  // 3. Área territorial (agregado 4714, variável 614 — Censo 2022)
  let areaKm2 = 0;
  try {
    const areaRes = await fetch(
      `https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/614?localidades=N6[${id}]`,
    );
    if (areaRes.ok) {
      const areaData = await areaRes.json();
      const serie = areaData?.[0]?.resultados?.[0]?.series?.[0]?.serie;
      if (serie) {
        const valores = Object.values(serie) as string[];
        areaKm2 = parseFloat(valores[valores.length - 1]) || 0;
      }
    }
    console.log(`[IBGE getMunicipioInfo] Área ${nome}: ${areaKm2} km²`);
  } catch { /* área opcional */ }

  if (populacao === 0) return null;

  // 4. Lat/Lng via Nominatim (OpenStreetMap geocoding)
  let lat = 0;
  let lng = 0;
  const geo = await geocodeNominatim(nome, estado);
  if (geo) {
    lat = geo.lat;
    lng = geo.lng;
  }

  const densidadeHabKm2 = areaKm2 > 0 ? populacao / areaKm2 : 0;
  console.log(`[IBGE getMunicipioInfo] ${nome}/${ufSigla}: pop=${populacao} (IBGE ${ibgeAno}), area=${areaKm2}km², densidade=${densidadeHabKm2.toFixed(0)}, lat=${lat}, lng=${lng}`);

  return {
    id,
    nome,
    uf: ufSigla,
    estado,
    populacao,
    ibgeAno,
    areaKm2,
    densidadeHabKm2,
    lat,
    lng,
  };
}

/**
 * Busca municípios vizinhos usando a microrregião do IBGE como proxy de proximidade.
 * Municípios na mesma microrregião são geograficamente próximos.
 * Retorna IDs dos vizinhos (excluindo o principal) para buscar população.
 */
async function getMunicipiosVizinhosPorMicrorregiao(
  municipioId: number,
  uf: string,
): Promise<number[]> {
  try {
    // Busca todos municípios da UF
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
    );
    if (!res.ok) return [];
    const municipios = await res.json();

    // Encontra a microrregião do município principal
    const principal = municipios.find((m: any) => Number(m.id) === municipioId);
    if (!principal?.microrregiao?.id) {
      console.warn(`[IBGE Vizinhos] Microrregião não encontrada para id=${municipioId}`);
      return [];
    }
    const microId = principal.microrregiao.id;
    const microNome = principal.microrregiao.nome;

    // Filtra municípios na mesma microrregião
    const vizinhos = municipios
      .filter((m: any) => m.microrregiao?.id === microId && Number(m.id) !== municipioId)
      .map((m: any) => Number(m.id));

    console.log(`[IBGE Vizinhos] Microrregião "${microNome}" (id=${microId}): ${vizinhos.length} vizinhos encontrados`);
    return vizinhos;
  } catch (err) {
    console.warn('[IBGE Vizinhos] Erro:', (err as Error).message);
    return [];
  }
}

async function getPopulacaoTotal(municipioIds: number[]): Promise<number> {
  if (municipioIds.length === 0) return 0;

  // Batch em grupos de 50 (limite prático da API IBGE)
  let total = 0;
  for (let i = 0; i < municipioIds.length; i += 50) {
    const batch = municipioIds.slice(i, i + 50);
    const idsStr = batch.join('|');
    let batchTotal = 0;

    // Tenta estimativas (6579) primeiro, depois censo (1301)
    const endpoints = [
      ...['2024', '2023', '2022'].map(ano => `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/${ano}/variaveis/9324?localidades=N6[${idsStr}]`),
      `https://servicodados.ibge.gov.br/api/v3/agregados/1301/periodos/2022/variaveis/93?localidades=N6[${idsStr}]`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const series = data?.[0]?.resultados?.[0]?.series || [];
        for (const s of series) {
          const valores = Object.values(s.serie) as string[];
          batchTotal += parseInt(valores[valores.length - 1], 10) || 0;
        }
        if (batchTotal > 0) break;
      } catch {
        continue;
      }
    }
    total += batchTotal;
  }
  return total;
}


// Capitais e cidades grandes com população conhecida (fallback quando IBGE está fora)
const POPULACAO_CONHECIDA: Record<string, { pop: number; densidade: 'alta' | 'baixa' }> = {
  'são paulo': { pop: 11_451_000, densidade: 'alta' },
  'sao paulo': { pop: 11_451_000, densidade: 'alta' },
  'rio de janeiro': { pop: 6_211_000, densidade: 'alta' },
  'brasília': { pop: 2_817_000, densidade: 'alta' },
  'brasilia': { pop: 2_817_000, densidade: 'alta' },
  'salvador': { pop: 2_418_000, densidade: 'alta' },
  'fortaleza': { pop: 2_428_000, densidade: 'alta' },
  'belo horizonte': { pop: 2_315_000, densidade: 'alta' },
  'manaus': { pop: 2_063_000, densidade: 'alta' },
  'curitiba': { pop: 1_773_000, densidade: 'alta' },
  'recife': { pop: 1_488_000, densidade: 'alta' },
  'goiânia': { pop: 1_437_000, densidade: 'alta' },
  'goiania': { pop: 1_437_000, densidade: 'alta' },
  'belém': { pop: 1_303_000, densidade: 'alta' },
  'belem': { pop: 1_303_000, densidade: 'alta' },
  'porto alegre': { pop: 1_332_000, densidade: 'alta' },
  'guarulhos': { pop: 1_292_000, densidade: 'alta' },
  'campinas': { pop: 1_139_000, densidade: 'alta' },
  'são luís': { pop: 1_037_000, densidade: 'alta' },
  'sao luis': { pop: 1_037_000, densidade: 'alta' },
  'maceió': { pop: 932_000, densidade: 'alta' },
  'maceio': { pop: 932_000, densidade: 'alta' },
  'santo andré': { pop: 748_000, densidade: 'alta' },
  'santo andre': { pop: 748_000, densidade: 'alta' },
  'mauá': { pop: 477_000, densidade: 'alta' },
  'maua': { pop: 477_000, densidade: 'alta' },
  'osasco': { pop: 699_000, densidade: 'alta' },
  'ribeirão preto': { pop: 720_000, densidade: 'alta' },
  'ribeirao preto': { pop: 720_000, densidade: 'alta' },
  'sorocaba': { pop: 695_000, densidade: 'alta' },
  'londrina': { pop: 580_000, densidade: 'alta' },
  'niterói': { pop: 487_000, densidade: 'alta' },
  'niteroi': { pop: 487_000, densidade: 'alta' },
  'joinville': { pop: 616_000, densidade: 'alta' },
  'florianópolis': { pop: 537_000, densidade: 'alta' },
  'florianopolis': { pop: 537_000, densidade: 'alta' },
};

/**
 * Estimativa de fallback quando IBGE está indisponível.
 * Usa tabela de cidades conhecidas ou estimativa genérica.
 */
function estimarPorDensidade(city: string): AudienciaEstimada {
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cityNorm = normalize(city);

  const known = POPULACAO_CONHECIDA[cityNorm];
  if (known) {
    const raioKm = known.densidade === 'alta' ? 3 : 10;
    console.log(`[IBGE Fallback] Cidade conhecida: ${city} → pop=${known.pop}, raio=${raioKm}km`);
    return {
      populacaoRaio: known.pop,
      raioKm,
      densidade: known.densidade,
      municipioNome: city,
      municipioId: 0,
    };
  }

  // Estimativa genérica: cidade média brasileira ~200k habitantes
  const estimativa = 200_000;
  console.log(`[IBGE Fallback] Cidade desconhecida: ${city} → estimativa genérica ${estimativa}`);
  return {
    populacaoRaio: estimativa,
    raioKm: 5,
    densidade: 'baixa',
    municipioNome: city,
    municipioId: 0,
  };
}

/**
 * Orquestra busca de audiência estimada.
 * Timeout de 15s, fallback para estimativa por densidade.
 */
export async function fetchAudienciaEstimada(
  city: string,
  state: string,
  nacional: boolean,
  lat?: number,
  lng?: number,
): Promise<AudienciaEstimada | null> {
  console.log(`[IBGE Audiência] START: city="${city}", state="${state}", nacional=${nacional}, lat=${lat}, lng=${lng}`);
  if (nacional) {
    return {
      populacaoRaio: POPULACAO_BRASIL,
      raioKm: null,
      densidade: 'nacional',
      municipioNome: 'Brasil',
      municipioId: 0,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s — chamadas IBGE são filtradas por nome agora

  try {
    // 1. Info do município principal
    const info = await getMunicipioInfo(city, state);
    if (!info) {
      console.warn(`[IBGE Audiência] getMunicipioInfo retornou null para city="${city}" — usando estimativa por densidade`);
      return estimarPorDensidade(city);
    }
    console.log(`[IBGE Audiência] Município: ${info.nome}, pop=${info.populacao}, area=${info.areaKm2}km², densidade=${info.densidadeHabKm2.toFixed(0)} hab/km²`);

    // 2. Detecta densidade → define raio
    const densidade = detectarDensidade(info.populacao, info.densidadeHabKm2 > 0 ? info.densidadeHabKm2 : undefined);
    const raioKm = getRaioKm(densidade);

    // 3. População do raio — soma município principal + vizinhos na mesma microrregião
    let populacaoRaio = info.populacao;
    try {
      const vizinhosIds = await getMunicipiosVizinhosPorMicrorregiao(info.id, info.uf);
      if (vizinhosIds.length > 0) {
        const popVizinhos = await getPopulacaoTotal(vizinhosIds);
        if (popVizinhos > 0) {
          populacaoRaio += popVizinhos;
          console.log(`[IBGE Audiência] +${vizinhosIds.length} vizinhos: pop extra=${popVizinhos}, total raio=${populacaoRaio}`);
        }
      }
    } catch (err) {
      console.warn('[IBGE Audiência] Vizinhos falhou, usando só município principal:', (err as Error).message);
    }

    console.log(`[IBGE Audiência] ${info.nome}: pop=${info.populacao} (IBGE ${info.ibgeAno}), densidade=${densidade}, raio=${raioKm}km, popRaio=${populacaoRaio}`);
    console.log(`[IBGE VERIFICAÇÃO] Resumo: município=${info.nome}/${info.uf}, id=${info.id}, pop=${info.populacao}, area=${info.areaKm2}km², densidade_hab_km2=${info.densidadeHabKm2.toFixed(0)}, lat=${info.lat}, lng=${info.lng}, raio=${raioKm}km, popRaio=${populacaoRaio}, ibgeAno=${info.ibgeAno}`);

    return {
      populacaoRaio,
      raioKm,
      densidade,
      municipioNome: info.nome,
      municipioId: info.id,
      ibgeAno: info.ibgeAno,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.warn('[IBGE Audiência] Timeout');
    } else {
      console.warn('[IBGE Audiência] Erro:', (err as Error).message);
    }
    return estimarPorDensidade(city);
  } finally {
    clearTimeout(timeout);
    console.log(`[IBGE Audiência] END: city="${city}"`);
  }
}
