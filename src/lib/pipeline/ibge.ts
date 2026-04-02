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
type DensityLevel = 'very_high' | 'high' | 'medium' | 'low' | 'rural';

function detectarDensidade(populacao: number, densidadeHabKm2?: number): DensityLevel {
  if (populacao >= 1_000_000 || (densidadeHabKm2 && densidadeHabKm2 > 3000)) return 'very_high';
  if (populacao >= 500_000 || (densidadeHabKm2 && densidadeHabKm2 > 1000)) return 'high';
  if (populacao >= 100_000 || (densidadeHabKm2 && densidadeHabKm2 > 200)) return 'medium';
  if (populacao >= 20_000) return 'low';
  return 'rural';
}

function calculateDynamicRadius(
  densityLevel: DensityLevel,
  businessCategory: string,
): number {
  const baseRadius: Record<DensityLevel, number> = {
    very_high: 1,
    high: 3,
    medium: 5,
    low: 10,
    rural: 20,
  };

  const segmentMultiplier = (category: string): number => {
    const lower = category.toLowerCase();

    // ── Deslocamento diário / rotina (vai todo dia ou toda semana) ──
    // Raio funcional: 20min deslocamento. very_high(1km)×3=3km, high(3km)×3=9km
    if (/escola|educa|creche|berçário|bercario|infantil|colégio|colegio|academia|ginástica|ginastica|pilates|yoga|natação|natacao|crossfit|musculação|musculacao/.test(lower)) return 3;

    // ── Alimentação (vai a pé, muito local) ──
    if (/restaurante|lanchonete|padaria|café|cafe|cafeteria|bar|pizzaria|hamburguer|sushi|kilo|comida|marmita|bistrô|bistro/.test(lower)) return 0.5;

    // ── Saúde recorrente (mensal/quinzenal) ──
    if (/fisioterapia|psicolog|nutricion|fonoaudiolog|terapia|clínica|clinica|reabilitação|reabilitacao/.test(lower)) return 2;

    // ── Beleza e estética (mensal, tolerância média) ──
    if (/salão|salao|barbearia|cabeleireir|estética|estetica|manicure|pedicure|sobrancelha|depilação|depilacao|spa|massagem|estudio de beleza/.test(lower)) return 1.5;

    // ── Saúde ocasional (trimestral/semestral) ──
    if (/dentist|ortodont|oftalmo|dermatolog|ortopedi|cardiolog|hospital|urgência|urgencia|pronto.socorro/.test(lower)) return 1.5;

    // ── Varejo / serviços do dia a dia ──
    if (/farmácia|farmacia|mercado|supermercado|hortifruti|açougue|acougue|lavanderia|sapataria|conserto|reparo|dedetiz/.test(lower)) return 1;

    // ── Serviços técnicos/profissionais (vai 1x, não importa distância) ──
    if (/arquitet|advogad|contábil|contabil|contador|engenhei|consultor|designer|developer|programad|marketing|fotograf|videomaker/.test(lower)) return 2;

    // ── B2B/B2G — raio amplo (regional/nacional) ──
    if (/indústria|industria|distribuidora|atacado|fornecedor|logística|logistica|transporte|importadora|exportadora|treinamento corporativo|consultoria empresarial/.test(lower)) return 4;

    // Padrão: serviços locais genéricos
    return 1;
  };

  const base = baseRadius[densityLevel] ?? 3;
  const multiplier = segmentMultiplier(businessCategory);
  const radius = base * multiplier;

  // Cap entre 1km e 20km
  return Math.min(Math.max(Math.round(radius), 1), 20);
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

async function fetchWorldPopRadius(lat: number, lng: number, raioKm: number): Promise<number | null> {
  // WorldPop API: população num raio circular em torno de lat/lng
  // Documentação: https://api.worldpop.org/v1/services/stats
  try {
    const geojson = JSON.stringify({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat]  // WorldPop usa [lng, lat]
      },
      properties: { radius: raioKm }
    });

    const url = `https://api.worldpop.org/v1/services/stats?dataset=wpgp&year=2020&geojson=${encodeURIComponent(geojson)}&runasync=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn(`[WorldPop] HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    // Resposta: { status: "200", data: { total_population: 12345.67 } }
    const pop = data?.data?.total_population;
    if (typeof pop === 'number' && pop > 0) {
      console.log(`[WorldPop] lat=${lat}, lng=${lng}, raio=${raioKm}km → pop=${Math.round(pop)}`);
      return Math.round(pop);
    }
    console.warn('[WorldPop] Resposta sem total_population:', JSON.stringify(data).slice(0, 200));
    return null;
  } catch (err) {
    console.warn('[WorldPop] Erro:', (err as Error).message);
    return null;
  }
}

async function inferirTargetAudiencia(
  businessCategory: string,
  populacaoRaio: number,
  ticketMedio?: number,
): Promise<{ percentualMin: number; percentualMax: number; percentualBase: number; rationale: string; targetProfile: string }> {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const ticketContext = ticketMedio
      ? `Ticket médio do negócio: R$${ticketMedio}. Use isso para calibrar o corte de renda — ticket alto = público menor e mais selecionado.`
      : '';

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: `Para o negócio "${businessCategory}" no Brasil, estime o percentual da população total que é público-alvo real (pode pagar e tem necessidade).

${ticketContext}

Considere: faixa etária relevante, poder aquisitivo necessário, frequência de necessidade do serviço/produto.
Seja conservador — é melhor subestimar do que inflar.

Responda APENAS em JSON:
{
  "percentualMin": 0.03,
  "percentualMax": 0.09,
  "percentualBase": 0.06,
  "targetProfile": "descrição do perfil em 1 frase",
  "rationale": "por que estes percentuais (2 frases)"
}`
      }],
    });

    const text = response.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    const parsed = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
    console.log(`[Target] ${businessCategory}: ${parsed.percentualMin*100}%-${parsed.percentualMax*100}% (base ${parsed.percentualBase*100}%)`);
    return parsed;
  } catch (err) {
    console.warn('[Target] Inferência falhou, usando fallback conservador:', (err as Error).message);
    return { percentualMin: 0.05, percentualMax: 0.15, percentualBase: 0.08, rationale: 'Estimativa conservadora padrão', targetProfile: 'Público-alvo do negócio' };
  }
}

async function inferirFinanceiro(
  businessCategory: string,
  region: string,
): Promise<{ ticketMedio: number; taxaConversao: number; ticketRationale: string }> {
  // Prioridade 1: tabela curada de benchmarks (instantâneo, custo zero)
  const { getFinancialBenchmark } = await import('@/config/sector-benchmarks');
  const benchmark = getFinancialBenchmark(businessCategory);
  if (benchmark.fromBenchmark) {
    console.log(`[Financeiro] Benchmark encontrado para "${businessCategory}": ticket=${benchmark.ticketMedio}, conversão=${benchmark.taxaConversao}`);
    return benchmark;
  }

  // Prioridade 2: Claude Haiku (fallback para categorias não mapeadas)
  console.log(`[Financeiro] Categoria "${businessCategory}" não mapeada, usando Claude Haiku...`);
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: `Para o negócio "${businessCategory}" em ${region.split(',')[0]}, Brasil, estime:
1. Ticket médio mensal por cliente (valor que um cliente paga por mês ou por compra recorrente)
2. Taxa de conversão típica (% de pessoas que buscam e efetivamente compram/contratam)

Use benchmarks reais do mercado brasileiro. Seja conservador.

Responda APENAS em JSON:
{
  "ticketMedio": 450,
  "taxaConversao": 0.03,
  "ticketRationale": "mensalidade típica de escola infantil particular em SP: R$2.000-4.000, usando R$2.500 como base conservadora. Conversão 3% típica para serviços educacionais locais."
}`
      }],
    });
    const text = response.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  } catch {
    return { ticketMedio: 500, taxaConversao: 0.03, ticketRationale: 'Estimativa conservadora padrão' };
  }
}

// Capitais e cidades grandes com população conhecida (fallback quando IBGE está fora)
const POPULACAO_CONHECIDA: Record<string, { pop: number; densidade: DensityLevel }> = {
  'são paulo': { pop: 11_451_000, densidade: 'very_high' },
  'sao paulo': { pop: 11_451_000, densidade: 'very_high' },
  'rio de janeiro': { pop: 6_211_000, densidade: 'very_high' },
  'brasília': { pop: 2_817_000, densidade: 'very_high' },
  'brasilia': { pop: 2_817_000, densidade: 'very_high' },
  'salvador': { pop: 2_418_000, densidade: 'very_high' },
  'fortaleza': { pop: 2_428_000, densidade: 'very_high' },
  'belo horizonte': { pop: 2_315_000, densidade: 'very_high' },
  'manaus': { pop: 2_063_000, densidade: 'very_high' },
  'curitiba': { pop: 1_773_000, densidade: 'very_high' },
  'recife': { pop: 1_488_000, densidade: 'very_high' },
  'goiânia': { pop: 1_437_000, densidade: 'very_high' },
  'goiania': { pop: 1_437_000, densidade: 'very_high' },
  'belém': { pop: 1_303_000, densidade: 'very_high' },
  'belem': { pop: 1_303_000, densidade: 'very_high' },
  'porto alegre': { pop: 1_332_000, densidade: 'very_high' },
  'guarulhos': { pop: 1_292_000, densidade: 'very_high' },
  'campinas': { pop: 1_139_000, densidade: 'very_high' },
  'são luís': { pop: 1_037_000, densidade: 'very_high' },
  'sao luis': { pop: 1_037_000, densidade: 'very_high' },
  'maceió': { pop: 932_000, densidade: 'high' },
  'maceio': { pop: 932_000, densidade: 'high' },
  'santo andré': { pop: 748_000, densidade: 'high' },
  'santo andre': { pop: 748_000, densidade: 'high' },
  'mauá': { pop: 477_000, densidade: 'high' },
  'maua': { pop: 477_000, densidade: 'high' },
  'osasco': { pop: 699_000, densidade: 'high' },
  'ribeirão preto': { pop: 720_000, densidade: 'high' },
  'ribeirao preto': { pop: 720_000, densidade: 'high' },
  'sorocaba': { pop: 695_000, densidade: 'high' },
  'londrina': { pop: 580_000, densidade: 'high' },
  'niterói': { pop: 487_000, densidade: 'high' },
  'niteroi': { pop: 487_000, densidade: 'high' },
  'joinville': { pop: 616_000, densidade: 'high' },
  'florianópolis': { pop: 537_000, densidade: 'high' },
  'florianopolis': { pop: 537_000, densidade: 'high' },
};

/**
 * Estimativa de fallback quando IBGE está indisponível.
 * Usa tabela de cidades conhecidas ou estimativa genérica.
 */
function estimarPorDensidade(city: string, businessCategory?: string): AudienciaEstimada {
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cityNorm = normalize(city);

  const known = POPULACAO_CONHECIDA[cityNorm];
  if (known) {
    const raioKm = calculateDynamicRadius(known.densidade, businessCategory || '');
    console.log(`[IBGE Fallback] Cidade conhecida: ${city} → pop=${known.pop}, raio=${raioKm}km, densidade=${known.densidade}`);
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
  const raioKm = calculateDynamicRadius('medium', businessCategory || '');
  console.log(`[IBGE Fallback] Cidade desconhecida: ${city} → estimativa genérica ${estimativa}, raio=${raioKm}km`);
  return {
    populacaoRaio: estimativa,
    raioKm,
    densidade: 'medium',
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
  businessCategory?: string,
): Promise<AudienciaEstimada | null> {
  console.log(`[IBGE Audiência] START: city="${city}", state="${state}", nacional=${nacional}, lat=${lat}, lng=${lng}`);
  if (nacional) {
    // Para nacional, inferir benchmark competitivo via Claude
    // Mercado nacional tem muito mais concorrentes — penaliza relativização
    let benchmarkNacional = { totalCompetidores: 50, descricao: 'mercado nacional competitivo' };
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        temperature: 0,
        messages: [{
          role: 'user',
          content: `Para o segmento "${businessCategory || 'negócio'}" no Brasil, estime quantas empresas competem digitalmente de forma nacional (têm site ativo, presença no Google, investem em marketing digital).

Considere:
- Agências, consultorias e serviços digitais B2B: geralmente 500-2000 players
- Treinamentos corporativos, RH, tecnologia: geralmente 300-1000 players
- Indústria, distribuição, logística: geralmente 200-800 players
- Nichos muito específicos: geralmente 100-400 players

Responda APENAS em JSON sem explicação:
{"totalCompetidores": 500, "descricao": "descrição curta do mercado"}`,
        }],
      });
      const text = response.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
      benchmarkNacional = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
    } catch { /* usa fallback */ }

    console.log(`[IBGE Nacional] benchmark: ${benchmarkNacional.totalCompetidores} competidores — ${benchmarkNacional.descricao}`);

    return {
      populacaoRaio: POPULACAO_BRASIL,
      raioKm: null,
      densidade: 'nacional',
      municipioNome: 'Brasil',
      municipioId: 0,
      benchmarkNacionalCompetidores: benchmarkNacional.totalCompetidores,
      benchmarkNacionalDescricao: benchmarkNacional.descricao,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s — chamadas IBGE são filtradas por nome agora

  try {
    // 1. Info do município principal
    const info = await getMunicipioInfo(city, state);
    if (!info) {
      console.warn(`[IBGE Audiência] getMunicipioInfo retornou null para city="${city}" — usando estimativa por densidade`);
      return estimarPorDensidade(city, businessCategory);
    }
    console.log(`[IBGE Audiência] Município: ${info.nome}, pop=${info.populacao}, area=${info.areaKm2}km², densidade=${info.densidadeHabKm2.toFixed(0)} hab/km²`);

    // 2. Detecta densidade → define raio dinâmico por segmento
    const densidade = detectarDensidade(info.populacao, info.densidadeHabKm2 > 0 ? info.densidadeHabKm2 : undefined);
    const raioKm = calculateDynamicRadius(densidade, businessCategory || '');
    console.log(`[pipeline] raio calculado: ${raioKm}km para "${businessCategory || 'genérico'}" em ${densidade}`);

    // 3. População do raio — WorldPop API para população real no raio
    let populacaoRaio = 0;
    let populacaoSource = 'ibge_municipal';

    // Usa lat/lng do form (passado como param) ou do geocoding do município
    const resolvedLat = (lat && lat !== 0) ? lat : info.lat;
    const resolvedLng = (lng && lng !== 0) ? lng : info.lng;

    if (resolvedLat && resolvedLng && resolvedLat !== 0 && resolvedLng !== 0) {
      const worldPopResult = await fetchWorldPopRadius(resolvedLat, resolvedLng, raioKm);
      if (worldPopResult && worldPopResult > 0) {
        populacaoRaio = worldPopResult;
        populacaoSource = 'worldpop';
        console.log(`[IBGE Audiência] WorldPop: ${populacaoRaio} pessoas no raio de ${raioKm}km`);
      }
    }

    // Fallback: proporção de área (melhor que município inteiro)
    if (populacaoRaio === 0) {
      if (info.areaKm2 > 0) {
        const areaRaio = Math.PI * raioKm * raioKm;
        const proporcao = Math.min(areaRaio / info.areaKm2, 1);
        populacaoRaio = Math.round(info.populacao * proporcao);
        populacaoSource = 'ibge_area_prop';
        console.log(`[IBGE Audiência] Fallback proporção área: ${populacaoRaio} (raio=${areaRaio.toFixed(1)}km², município=${info.areaKm2}km²)`);
      } else {
        // Último fallback: município inteiro (comportamento antigo)
        populacaoRaio = info.populacao;
        populacaoSource = 'ibge_municipal_full';
      }
    }

    // Inferir target demográfico + financeiro via Claude (em paralelo)
    const [targetInferido, financeiro] = await Promise.all([
      inferirTargetAudiencia(businessCategory || '', populacaoRaio, undefined),
      inferirFinanceiro(businessCategory || '', city),
    ]);
    const audienciaTarget = Math.round(populacaoRaio * targetInferido.percentualBase);
    const audienciaTargetMin = Math.round(populacaoRaio * targetInferido.percentualMin);
    const audienciaTargetMax = Math.round(populacaoRaio * targetInferido.percentualMax);

    console.log(`[IBGE Audiência] Target: ${audienciaTargetMin}-${audienciaTargetMax} (base ${audienciaTarget}) | perfil: ${targetInferido.targetProfile}`);
    console.log(`[IBGE Audiência] Financeiro: ticket=R$${financeiro.ticketMedio}, conversão=${(financeiro.taxaConversao*100).toFixed(1)}%`);
    console.log(`[IBGE Audiência] ${info.nome}: pop=${info.populacao} (IBGE ${info.ibgeAno}), densidade=${densidade}, raio=${raioKm}km, popRaio=${populacaoRaio} (${populacaoSource})`);
    console.log(`[IBGE VERIFICAÇÃO] Resumo: município=${info.nome}/${info.uf}, id=${info.id}, pop=${info.populacao}, area=${info.areaKm2}km², densidade_hab_km2=${info.densidadeHabKm2.toFixed(0)}, lat=${info.lat}, lng=${info.lng}, raio=${raioKm}km, popRaio=${populacaoRaio}, ibgeAno=${info.ibgeAno}, source=${populacaoSource}`);

    return {
      populacaoRaio,
      populacaoMunicipio: info.populacao,
      raioKm,
      densidade,
      municipioNome: info.nome,
      municipioId: info.id,
      ibgeAno: info.ibgeAno,
      audienciaTarget,
      audienciaTargetMin,
      audienciaTargetMax,
      targetProfile: targetInferido.targetProfile,
      targetRationale: targetInferido.rationale,
      populacaoSource,
      ticketMedio: financeiro.ticketMedio,
      taxaConversao: financeiro.taxaConversao,
      ticketRationale: financeiro.ticketRationale,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.warn('[IBGE Audiência] Timeout');
    } else {
      console.warn('[IBGE Audiência] Erro:', (err as Error).message);
    }
    return estimarPorDensidade(city, businessCategory);
  } finally {
    clearTimeout(timeout);
    console.log(`[IBGE Audiência] END: city="${city}"`);
  }
}
