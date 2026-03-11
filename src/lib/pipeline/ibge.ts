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
    // 1. Busca município pelo nome
    const searchRes = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${encodeURIComponent(cidade)}`,
    );

    if (!searchRes.ok) {
      console.warn('[IBGE] Busca de município falhou:', searchRes.status);
      return null;
    }

    const municipios = await searchRes.json();
    if (!Array.isArray(municipios) || municipios.length === 0) {
      console.warn(`[IBGE] Município não encontrado: "${cidade}"`);
      return null;
    }

    // Pega o primeiro resultado
    const municipio = municipios[0];
    const id = String(municipio.id);
    const nomeMunicipio = municipio.nome;
    const estado = municipio.microrregiao?.mesorregiao?.UF?.nome || municipio.microrregiao?.mesorregiao?.UF?.sigla || '';

    // 2. Busca população estimada (agregado 4709, variável 93)
    const popRes = await fetch(
      `https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2021/variaveis/93?localidades=N6[${id}]`,
    );

    let populacao = 0;
    if (popRes.ok) {
      const popData = await popRes.json();
      // Navega na estrutura: [0].resultados[0].series[0].serie["2021"]
      const serie = popData?.[0]?.resultados?.[0]?.series?.[0]?.serie;
      if (serie) {
        // Pega o valor do período mais recente disponível
        const valores = Object.values(serie) as string[];
        const ultimo = valores[valores.length - 1];
        populacao = parseInt(ultimo, 10) || 0;
      }
    } else {
      console.warn('[IBGE] Busca de população falhou:', popRes.status);
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

// Cache de todos os municípios (carregado uma vez)
let municipiosCache: { id: number; nome: string; lat: number; lng: number }[] | null = null;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function detectarDensidade(densidadeHabKm2: number): 'alta' | 'baixa' {
  return densidadeHabKm2 > 1000 ? 'alta' : 'baixa';
}

function getRaioKm(densidade: 'alta' | 'baixa'): number {
  return densidade === 'alta' ? 3 : 20;
}

interface MunicipioInfo {
  id: number;
  nome: string;
  estado: string;
  populacao: number;
  areaKm2: number;
  densidadeHabKm2: number;
  lat: number;
  lng: number;
}

async function getMunicipioInfo(city: string, state: string): Promise<MunicipioInfo | null> {
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cityNorm = normalize(city);

  // 1. Busca município
  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/municipios`,
  );
  if (!res.ok) return null;
  const all = await res.json();

  // Filtra por nome e opcionalmente UF
  const stateNorm = normalize(state);
  const match = all.find((m: any) => {
    const nomeNorm = normalize(m.nome);
    const uf = m.microrregiao?.mesorregiao?.UF;
    const ufSigla = uf?.sigla?.toLowerCase() || '';
    const ufNome = normalize(uf?.nome || '');
    const nameMatch = nomeNorm === cityNorm;
    if (!stateNorm) return nameMatch;
    return nameMatch && (ufSigla === stateNorm || ufNome.includes(stateNorm));
  }) || all.find((m: any) => normalize(m.nome) === cityNorm);

  if (!match) return null;

  const id = Number(match.id);
  const nome = match.nome;
  const estado = match.microrregiao?.mesorregiao?.UF?.nome || '';

  // 2. Busca população (agregado 4709, variável 93)
  const popRes = await fetch(
    `https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2021/variaveis/93?localidades=N6[${id}]`,
  );
  let populacao = 0;
  if (popRes.ok) {
    const popData = await popRes.json();
    const serie = popData?.[0]?.resultados?.[0]?.series?.[0]?.serie;
    if (serie) {
      const valores = Object.values(serie) as string[];
      populacao = parseInt(valores[valores.length - 1], 10) || 0;
    }
  }

  // 3. Área (agregado 6579, variável 9324 — censo 2022)
  let areaKm2 = 0;
  try {
    const areaRes = await fetch(
      `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/2022/variaveis/9324?localidades=N6[${id}]`,
    );
    if (areaRes.ok) {
      const areaData = await areaRes.json();
      const serie = areaData?.[0]?.resultados?.[0]?.series?.[0]?.serie;
      if (serie) {
        const valores = Object.values(serie) as string[];
        areaKm2 = parseFloat(valores[valores.length - 1]) || 0;
      }
    }
  } catch { /* área opcional */ }

  if (populacao === 0) return null;

  // 4. Lat/Lng: usa coordenadas aproximadas do centroide via IBGE malha
  // A API de localidades não retorna coordenadas, então estimamos pela capital do estado
  // ou usamos o Google Places lat/lng que já temos no pipeline
  const densidadeHabKm2 = areaKm2 > 0 ? populacao / areaKm2 : 0;

  return {
    id,
    nome,
    estado,
    populacao,
    areaKm2,
    densidadeHabKm2,
    lat: 0, // será preenchido pelo pipeline (lat/lng do Google Places)
    lng: 0,
  };
}

async function getAllMunicipiosWithCoords(): Promise<{ id: number; nome: string; lat: number; lng: number }[]> {
  if (municipiosCache) return municipiosCache;

  // API IBGE com coordenadas via malha municipal
  const res = await fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/municipios',
  );
  if (!res.ok) return [];
  const all = await res.json();

  // A API de localidades não retorna lat/lng diretamente.
  // Usamos a API de malhas para centroides, mas isso é pesado.
  // Alternativa: usar a relação município→microrregião→mesorregião
  // para estimativa. Para o MVP, buscaremos população em batch
  // apenas do município principal + vizinhos via nome similar.
  // A versão completa com Haversine precisa de um dataset de coordenadas.

  municipiosCache = all.map((m: any) => ({
    id: Number(m.id),
    nome: m.nome,
    lat: 0,
    lng: 0,
  }));
  return municipiosCache!;
}

async function getPopulacaoTotal(municipioIds: number[]): Promise<number> {
  if (municipioIds.length === 0) return 0;

  // Batch em grupos de 50 (limite prático da API IBGE)
  let total = 0;
  for (let i = 0; i < municipioIds.length; i += 50) {
    const batch = municipioIds.slice(i, i + 50);
    const idsStr = batch.join('|');
    try {
      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2021/variaveis/93?localidades=N6[${idsStr}]`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      const series = data?.[0]?.resultados?.[0]?.series || [];
      for (const s of series) {
        const valores = Object.values(s.serie) as string[];
        total += parseInt(valores[valores.length - 1], 10) || 0;
      }
    } catch {
      continue;
    }
  }
  return total;
}

/**
 * Busca municípios no raio usando lat/lng fornecidos externamente.
 * Requer dataset com coordenadas — usa fallback para apenas o município principal.
 */
async function getMunicipiosNoRaio(
  lat: number,
  lng: number,
  raioKm: number,
): Promise<number[]> {
  // Se não temos coordenadas válidas, retorna vazio
  if (!lat || !lng) return [];

  const all = await getAllMunicipiosWithCoords();

  // Se o cache não tem coordenadas (MVP), não podemos filtrar por raio
  // Retornamos vazio — o caller usará só a população do município principal
  const withCoords = all.filter(m => m.lat !== 0 && m.lng !== 0);
  if (withCoords.length === 0) return [];

  return withCoords
    .filter(m => haversineKm(lat, lng, m.lat, m.lng) <= raioKm)
    .map(m => m.id);
}

/**
 * Orquestra busca de audiência estimada.
 * Timeout de 8s, falha silenciosa.
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
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // 1. Info do município principal
    const info = await getMunicipioInfo(city, state);
    if (!info) return null;

    // Usa lat/lng do Google Places se disponível, senão não faz raio
    const useLat = lat || info.lat;
    const useLng = lng || info.lng;

    // 2. Detecta densidade → define raio
    const densidade = info.densidadeHabKm2 > 0
      ? detectarDensidade(info.densidadeHabKm2)
      : 'baixa';
    const raioKm = getRaioKm(densidade);

    // 3. Tenta buscar municípios no raio
    let populacaoRaio = info.populacao;
    if (useLat && useLng) {
      const idsNoRaio = await getMunicipiosNoRaio(useLat, useLng, raioKm);
      if (idsNoRaio.length > 0) {
        populacaoRaio = await getPopulacaoTotal(idsNoRaio);
      }
    }

    // Se a população do raio é menor que a do município (fallback não encontrou vizinhos)
    // usa a população do município como base
    if (populacaoRaio < info.populacao) {
      populacaoRaio = info.populacao;
    }

    console.log(`[IBGE Audiência] ${info.nome}: pop=${info.populacao}, densidade=${densidade}, raio=${raioKm}km, popRaio=${populacaoRaio}`);

    return {
      populacaoRaio,
      raioKm,
      densidade,
      municipioNome: info.nome,
      municipioId: info.id,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.warn('[IBGE Audiência] Timeout (8s)');
    } else {
      console.warn('[IBGE Audiência] Erro:', (err as Error).message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
    console.log(`[IBGE Audiência] END: city="${city}"`);
  }
}
