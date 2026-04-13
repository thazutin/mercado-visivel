// ============================================================================
// Virô Radar — Growth Machine Generator
// Gera a máquina de crescimento completa: quick wins + pilares estratégicos
// + provocações de crescimento. Tudo baseado em dados reais do diagnóstico
// + blueprint do segmento.
//
// PRINCÍPIOS:
// 1. Quick wins primeiro (otimizar Google, bio Instagram, reviews) — percepção positiva imediata
// 2. Pilares estratégicos são CONTEXTUAIS, não templates — dependem do que os dados dizem
// 3. Provocações vêm dos dados, não da IA — "3 cidades com menos concorrência"
// 4. Todo output tem copy pronto pra copiar/colar
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { BLUEPRINT_MAP } from '@/lib/blueprints';
import type { Blueprint } from '@/lib/blueprints/types';
import type {
  GrowthMachineResult,
  QuickWinAction,
  StrategicPillar,
  GrowthProvocation,
} from './types';

function isoWeek(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

interface GenerateInput {
  lead: {
    id: string;
    name: string;
    product: string;
    region: string;
    instagram?: string;
    site?: string;
    client_type?: string;
  };
  diagnosis: any;        // diagnosis_display from leads table
  blueprintId: string;
  rawData?: any;         // raw_data from diagnoses table (deeper data)
}

// ─── QUICK WINS GENERATOR ─────────────────────────────────────────────────────
// Baseado no blueprint.quickWins + dados reais do diagnóstico.
// Cada ação é específica: "Sua ficha tem 0 fotos" não "Adicione fotos".

function generateQuickWins(
  bp: Blueprint,
  diagnosis: any,
  lead: any,
): QuickWinAction[] {
  const quickWins: QuickWinAction[] = [];
  const maps = diagnosis.maps;
  const ig = diagnosis.instagram;
  const score = diagnosis.influencePercent || 0;

  for (const actionType of bp.quickWins) {
    switch (actionType) {
      case 'otimizar_google_maps': {
        if (!maps?.found) {
          quickWins.push({
            id: 'qw-gmb-create',
            type: actionType,
            title: 'Criar ficha no Google Meu Negócio',
            description: `Seu negócio não foi encontrado no Google Maps. Concorrentes da região já estão lá. Quem busca "${lead.product} em ${lead.region?.split(',')[0]}" não te encontra.`,
            impact: '+15pts Visibilidade',
            timeEstimate: '~20 min',
            steps: [
              'Acesse business.google.com e clique em "Gerenciar agora"',
              `Digite "${lead.name}" e siga o processo de verificação`,
              'Adicione categoria, horários, telefone e endereço',
              'Adicione pelo menos 5 fotos do espaço/produto',
              'Escreva uma descrição com palavras-chave do seu serviço',
            ],
          });
        } else {
          const issues: string[] = [];
          if ((maps.photos || 0) < 5) issues.push(`${maps.photos || 0} fotos (recomendado: 10+)`);
          if (!maps.rating || maps.rating < 4.0) issues.push(`nota ${maps.rating || '?'} (meta: 4.5+)`);
          if ((maps.reviewCount || 0) < 10) issues.push(`apenas ${maps.reviewCount || 0} avaliações`);
          if (issues.length > 0) {
            quickWins.push({
              id: 'qw-gmb-optimize',
              type: actionType,
              title: 'Otimizar ficha do Google Meu Negócio',
              description: `Sua ficha existe mas precisa de ajustes: ${issues.join(', ')}.`,
              impact: '+8pts Credibilidade',
              timeEstimate: '~15 min',
              steps: [
                'Acesse business.google.com e selecione seu perfil',
                (maps.photos || 0) < 5
                  ? `Adicione ${Math.max(5, 10 - (maps.photos || 0))} fotos profissionais do espaço, equipe e produtos`
                  : 'Atualize fotos com imagens recentes',
                'Revise e atualize a descrição com palavras-chave do seu serviço',
                'Confira se horários, telefone e endereço estão corretos',
                'Responda TODAS as avaliações pendentes (veja ação abaixo)',
              ],
            });
          }
        }
        break;
      }

      case 'responder_reviews': {
        if (maps?.found && maps.reviewCount && maps.reviewCount > 0) {
          const unreviewedEstimate = Math.round((maps.reviewCount || 0) * (1 - (diagnosis.influenceBreakdown?.google || 0) / 100));
          quickWins.push({
            id: 'qw-reviews',
            type: actionType,
            title: `Responder avaliações no Google`,
            description: `Você tem ${maps.reviewCount} avaliações. Negócios que respondem recebem 45% mais avaliações novas. Use o co-pilot da Virô pra gerar respostas no seu tom.`,
            impact: '+8pts Credibilidade',
            timeEstimate: '~10 min',
            steps: [
              'Clique em "Gerar respostas" abaixo para criar respostas personalizadas',
              'Revise cada resposta sugerida',
              'Copie e cole direto no Google Meu Negócio',
              'Responda reviews novos toda semana (seu radar vai te avisar)',
            ],
          });
        }
        break;
      }

      case 'capturar_reviews': {
        if (maps?.found && (maps.reviewCount || 0) < 30) {
          quickWins.push({
            id: 'qw-capture-reviews',
            type: actionType,
            title: 'Pedir avaliações aos seus melhores clientes',
            description: `Com ${maps.reviewCount || 0} avaliações, você precisa de mais pra competir. A meta é chegar a 30+ nos próximos 60 dias.`,
            impact: '+6pts Credibilidade',
            timeEstimate: '~10 min',
            steps: [
              'Liste seus 10 melhores clientes recentes',
              'Envie a mensagem pronta abaixo via WhatsApp',
              'Repita com 3-5 clientes novos por semana',
              'Meta: 5 avaliações novas por mês',
            ],
            copyReady: `Olá! Aqui é da equipe ${lead.name || lead.product}. Seu feedback é muito importante pra gente. Poderia deixar uma avaliação rápida no Google? Leva menos de 1 minuto. Muito obrigado! 🙏\n\n[LINK: Cole o link do seu perfil no Google Maps aqui]`,
          });
        }
        break;
      }

      case 'bio_instagram': {
        if (lead.instagram) {
          const igHandle = lead.instagram.replace('@', '');
          const hasData = ig && ig.followers > 0;
          quickWins.push({
            id: 'qw-ig-bio',
            type: actionType,
            title: 'Ajustar bio e perfil do Instagram',
            description: hasData
              ? `@${igHandle} tem ${ig.followers.toLocaleString('pt-BR')} seguidores e engajamento de ${(ig.engagementRate * 100).toFixed(1)}%. Uma bio otimizada pode aumentar conversão em 30%.`
              : `Seu Instagram @${igHandle} precisa de uma bio que comunique claramente o que você faz e como contratar.`,
            impact: '+5pts Presença Digital',
            timeEstimate: '~10 min',
            steps: [
              'Abra seu perfil no Instagram → Editar perfil',
              'Nome: use palavras-chave (ex: "João | Eletricista em Campinas")',
              'Bio: 1ª linha = o que você faz. 2ª linha = pra quem. 3ª linha = CTA',
              'Link: coloque link do WhatsApp ou site',
              'Foto: profissional, rosto ou logo visível',
            ],
          });
        }
        break;
      }

      case 'seo_conteudo': {
        const topTerms = (diagnosis.terms || [])
          .filter((t: any) => t.volume > 0)
          .sort((a: any, b: any) => b.volume - a.volume)
          .slice(0, 3);
        if (topTerms.length > 0) {
          quickWins.push({
            id: 'qw-seo',
            type: actionType,
            title: 'Criar conteúdo SEO para os termos mais buscados',
            description: `Seus termos mais buscados: ${topTerms.map((t: any) => `"${t.term}" (${t.volume}/mês)`).join(', ')}. Criar conteúdo otimizado pra esses termos pode trazer tráfego orgânico.`,
            impact: '+10pts Visibilidade',
            timeEstimate: '~30 min',
            steps: [
              `Crie uma página ou post sobre: "${topTerms[0]?.term}"`,
              'Use o termo no título, primeira frase e subtítulos',
              'Inclua sua localização no texto (Google prioriza resultados locais)',
              'Adicione fotos com alt text descritivo',
              'Publique e compartilhe nas redes sociais',
            ],
          });
        }
        break;
      }

      case 'posts_instagram':
      case 'video_reels':
      case 'landing_page':
      case 'posts_linkedin':
      case 'whatsapp_templates':
      case 'ml_otimizar':
      case 'white_paper':
      case 'email_nurturing':
        // Estas ações serão geradas como pilares estratégicos via Claude, não quick wins
        break;
    }
  }

  return quickWins;
}

// ─── PROVOCATIONS GENERATOR ───────────────────────────────────────────────────
// Baseadas puramente em dados reais. Cada provocação é uma oportunidade detectada.

function generateProvocations(
  bp: Blueprint,
  diagnosis: any,
  lead: any,
): GrowthProvocation[] {
  const provocations: GrowthProvocation[] = [];
  const maps = diagnosis.maps;
  const competitors = diagnosis.competitorInstagram || [];
  const terms = diagnosis.terms || [];

  // 1. Concorrência fraca detectada
  if (maps?.found && diagnosis.influenceBreakdown) {
    const myScore = diagnosis.influencePercent || 0;
    if (myScore < 30) {
      provocations.push({
        id: 'prov-low-score',
        insight: `Seu score é ${myScore}/100 — abaixo da média do setor. Cada ponto a mais representa mais clientes te encontrando.`,
        dataSource: 'Diagnóstico Virô',
        actionLabel: 'Ver como subir o score',
        analysisType: 'competitor',
      });
    }
  }

  // 2. Termos com volume alto mas sem posição
  const highVolumeNoRank = terms.filter(
    (t: any) => t.volume > 100 && (t.position === '—' || !t.position),
  );
  if (highVolumeNoRank.length > 0) {
    const total = highVolumeNoRank.reduce((s: number, t: any) => s + t.volume, 0);
    provocations.push({
      id: 'prov-serp-gap',
      insight: `${highVolumeNoRank.length} termos com ${total.toLocaleString('pt-BR')} buscas/mês — e você não aparece em nenhum. São clientes buscando seu serviço e encontrando concorrentes.`,
      dataSource: 'SERP Analysis',
      actionLabel: 'Ver como rankear nesses termos',
      analysisType: 'competitor',
    });
  }

  // 3. Concorrentes com mais presença digital
  if (competitors.length > 0) {
    const strongerCompetitors = competitors.filter(
      (c: any) => (c.followers || 0) > (diagnosis.instagram?.followers || 0) * 2,
    );
    if (strongerCompetitors.length > 0) {
      provocations.push({
        id: 'prov-ig-gap',
        insight: `${strongerCompetitors.length} concorrente(s) com mais que o dobro dos seus seguidores no Instagram. O que eles estão fazendo diferente?`,
        dataSource: 'Instagram Analysis',
        actionLabel: 'Analisar concorrentes',
        analysisType: 'competitor',
      });
    }
  }

  // 4. Market gap
  if (diagnosis.audiencia?.audienciaTarget && diagnosis.influencePercent < 50) {
    const alcancaveis = diagnosis.audiencia.audienciaTarget;
    const alcancados = Math.round(alcancaveis * (diagnosis.influencePercent / 100));
    const gap = alcancaveis - alcancados;
    if (gap > 100) {
      provocations.push({
        id: 'prov-market-gap',
        insight: `${gap.toLocaleString('pt-BR')} pessoas na sua região buscam seu serviço e ainda não te conhecem. Esse é o seu mercado acessível.`,
        dataSource: 'IBGE + SERP',
        actionLabel: 'Como alcançar essas pessoas',
        analysisType: 'segment',
      });
    }
  }

  // 5. Sazonalidade (se blueprint indica relevância alta)
  if (bp.seasonalityRelevance === 'high') {
    provocations.push({
      id: 'prov-seasonal',
      insight: `Seu setor tem sazonalidade forte. Preparar conteúdo e campanhas antes dos picos pode triplicar resultados.`,
      dataSource: 'Google Trends (em breve)',
      actionLabel: 'Ver calendário sazonal',
      analysisType: 'seasonal',
    });
  }

  return provocations.slice(0, 5); // Max 5 provocações
}

// ─── STRATEGIC PILLARS GENERATOR ──────────────────────────────────────────────
// Usa Claude pra gerar pilares contextuais baseados no blueprint + dados reais.
// NÃO é template fixo — depende do que os dados dizem.

async function generateStrategicPillars(
  bp: Blueprint,
  diagnosis: any,
  lead: any,
  rawData?: any,
): Promise<StrategicPillar[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // Monta contexto com dados reais
  const maps = diagnosis.maps;
  const ig = diagnosis.instagram;
  const terms = (diagnosis.terms || []).slice(0, 5);
  const competitors = (diagnosis.competitorInstagram || []).slice(0, 3);
  const mapsCompetitors = rawData?.influence?.rawGoogle?.mapsPresence?.mapsCompetitors || [];

  const dataContext = `
NEGÓCIO: ${lead.name || lead.product}
PRODUTO/SERVIÇO: ${lead.product}
REGIÃO: ${lead.region}
BLUEPRINT: ${bp.label}
TIPO CLIENTE: ${bp.primaryClientType}
SCORE ATUAL: ${diagnosis.influencePercent || 0}/100

GOOGLE MAPS:
${maps?.found ? `- Encontrado: sim | Rating: ${maps.rating || '?'} | Reviews: ${maps.reviewCount || 0} | Fotos: ${maps.photos || 0}` : '- NÃO encontrado no Google Maps'}
${mapsCompetitors.length > 0 ? `- Concorrentes Maps: ${mapsCompetitors.slice(0, 3).map((c: any) => `${c.name} (${c.rating || '?'}★, ${c.reviewCount || 0} reviews)`).join(', ')}` : ''}

INSTAGRAM:
${ig ? `- @${ig.handle} | ${ig.followers || 0} seguidores | Engajamento: ${((ig.engagementRate || 0) * 100).toFixed(1)}% | Posts recentes: ${ig.postsLast30d || 0}` : '- Sem Instagram ou não encontrado'}
${competitors.length > 0 ? `- Concorrentes IG: ${competitors.map((c: any) => `@${c.handle} (${c.followers || 0} seg)`).join(', ')}` : ''}

TERMOS DE BUSCA:
${terms.map((t: any) => `- "${t.term}": ${t.volume}/mês, posição: ${t.position}`).join('\n')}

CANAIS PRIORITÁRIOS DO SEGMENTO: ${bp.channels.slice(0, 5).join(', ')}
AÇÕES RELEVANTES: ${bp.actionTypes.join(', ')}
KPI PRINCIPAL: ${bp.primaryKPI}
`.trim();

  const prompt = `Você é o Virô, radar de crescimento para negócios brasileiros. Com base nos DADOS REAIS acima, gere pilares estratégicos de marketing.

REGRAS CRÍTICAS:
1. CADA pilar deve ser baseado em dados reais do diagnóstico — cite números específicos
2. NÃO gere pilares genéricos. Se o negócio não tem Instagram, NÃO gere pilar de Instagram
3. CADA item dentro do pilar deve ter conteúdo PRONTO para copiar/colar
4. Gere apenas pilares que fazem sentido pro segmento (${bp.label})
5. Máximo 4 pilares, mínimo 2
6. Cada pilar tem 2-4 itens com conteúdo pronto
7. Todos os textos em PT-BR, tom profissional mas acessível

FORMATO JSON:
{"pillars":[{
  "id":"pilar-1",
  "type":"content_engine|authority|prospecting|reputation|expansion",
  "title":"Título do Pilar",
  "description":"1-2 frases explicando POR QUE esse pilar, com dado real",
  "channel":"canal_principal",
  "priority":1,
  "items":[{
    "id":"item-1",
    "title":"Nome do item",
    "type":"copy|template|structure|checklist|script",
    "content":"CONTEÚDO COMPLETO PRONTO PRA USAR. Não escreva placeholder — escreva o texto final.",
    "copyable":true
  }],
  "kpi":{"metric":"Métrica específica","target":"Número meta","timeframe":"30 dias"}
}]}

IMPORTANTE: Cada item.content deve ser o TEXTO COMPLETO, não uma descrição do que escrever. Por exemplo:
- Se é um post, escreva O POST inteiro
- Se é um email, escreva O EMAIL inteiro
- Se é uma estrutura de evento, escreva A ESTRUTURA completa
- Se é uma mensagem WhatsApp, escreva A MENSAGEM pronta`;

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      temperature: 0.4,
      messages: [{ role: 'user', content: `${dataContext}\n\n${prompt}` }],
    });

    const text = res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('[GrowthMachine] No JSON found in response');
      return [];
    }

    const parsed = JSON.parse(match[0]);
    const pillars: StrategicPillar[] = (parsed.pillars || []).map((p: any, idx: number) => ({
      id: p.id || `pilar-${idx + 1}`,
      type: p.type || 'content_engine',
      title: p.title || '',
      description: p.description || '',
      channel: p.channel || bp.channels[0] || 'instagram',
      priority: p.priority || idx + 1,
      items: (p.items || []).map((item: any, iIdx: number) => ({
        id: item.id || `item-${iIdx + 1}`,
        title: item.title || '',
        type: item.type || 'copy',
        content: item.content || '',
        copyable: item.copyable !== false,
      })),
      kpi: p.kpi || { metric: bp.primaryKPI, target: 'A definir', timeframe: '30 dias' },
    }));

    return pillars;
  } catch (err) {
    console.error('[GrowthMachine] Strategic pillars generation failed:', (err as Error).message);
    return [];
  }
}

// ─── MAIN GENERATOR ───────────────────────────────────────────────────────────

export async function generateGrowthMachine(
  input: GenerateInput,
): Promise<GrowthMachineResult> {
  const bp = BLUEPRINT_MAP[input.blueprintId];
  if (!bp) {
    throw new Error(`Blueprint ${input.blueprintId} not found`);
  }

  const diagnosis = input.diagnosis || {};
  const lead = input.lead;

  console.log(`[GrowthMachine] Generating for ${lead.product} (${bp.id})...`);
  const t0 = Date.now();

  // 1. Quick wins (sync, fast, no API calls)
  const quickWins = generateQuickWins(bp, diagnosis, lead);
  console.log(`[GrowthMachine] ${quickWins.length} quick wins generated`);

  // 2. Provocations (sync, fast)
  const provocations = generateProvocations(bp, diagnosis, lead);
  console.log(`[GrowthMachine] ${provocations.length} provocations generated`);

  // 3. Strategic pillars (async, Claude Sonnet)
  const strategicPillars = await generateStrategicPillars(bp, diagnosis, lead, input.rawData);
  console.log(`[GrowthMachine] ${strategicPillars.length} strategic pillars generated`);

  // 4. Score benchmark (simples: média do setor = 35 como placeholder até ter dados)
  const currentScore = diagnosis.influencePercent || 0;
  const benchmarkScore = 35; // TODO: calcular benchmark real quando tiver volume de dados
  const shortRegion = (lead.region || '').split(',')[0].trim();

  const result: GrowthMachineResult = {
    blueprintId: bp.id,
    blueprintLabel: bp.label,
    score: {
      current: currentScore,
      benchmark: benchmarkScore,
      benchmarkLabel: bp.benchmarkTemplate
        .replace('{region}', shortRegion)
        .replace('{product}', lead.product),
      gap: benchmarkScore - currentScore,
    },
    quickWins,
    strategicPillars,
    provocations,
    kpis: {
      thirtyDay: `Completar ${quickWins.length} ações rápidas + ativar 1 pilar estratégico`,
      ninetyDay: `Score: ${currentScore} → ${Math.min(currentScore + 25, 100)} | ${bp.primaryKPI}`,
      primaryMetric: bp.primaryKPI,
    },
    generatedAt: new Date().toISOString(),
    weekNumber: isoWeek(),
  };

  console.log(`[GrowthMachine] Complete in ${Date.now() - t0}ms`);
  return result;
}
