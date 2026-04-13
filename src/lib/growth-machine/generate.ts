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
    challenge?: string;   // growth goal from form (frequencia, market_share, etc)
    ticket?: string;
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

      case 'posts_instagram': {
        if (lead.instagram && ig) {
          const postsPerMonth = ig.postsLast30d || 0;
          if (postsPerMonth < 8) {
            quickWins.push({
              id: 'qw-ig-frequency',
              type: actionType,
              title: `Aumentar frequência de posts no Instagram`,
              description: `Você postou ${postsPerMonth} vezes nos últimos 30 dias. Meta mínima: 3x por semana. Consistência é mais importante que perfeição.`,
              impact: '+6pts Presença Digital',
              timeEstimate: '~30 min/semana',
              steps: [
                'Defina 3 dias fixos da semana pra postar (ex: seg, qua, sex)',
                'Alterne formatos: 1 carrossel educativo + 1 reel mostrando bastidores + 1 post de depoimento',
                'Use as hashtags do seu setor + localização na legenda',
                'Poste entre 11h-13h ou 18h-20h (horários de pico)',
              ],
            });
          }
        }
        break;
      }

      case 'whatsapp_templates': {
        quickWins.push({
          id: 'qw-whatsapp',
          type: actionType,
          title: 'Criar mensagens prontas de atendimento no WhatsApp',
          description: `82% dos consumidores brasileiros preferem WhatsApp pra contato com negócios. Mensagens prontas agilizam atendimento e fecham mais vendas.`,
          impact: '+4pts Presença Digital',
          timeEstimate: '~15 min',
          steps: [
            'Abra WhatsApp Business → Ferramentas → Respostas rápidas',
            'Crie atalho /oi → mensagem de boas-vindas com cardápio/serviços',
            'Crie atalho /preco → tabela de preços resumida',
            'Crie atalho /local → endereço + horário + link do Maps',
          ],
          copyReady: `Olá! 👋 Obrigado por entrar em contato com ${lead.name || lead.product}.\n\nComo posso ajudar?\n\n📋 Nossos serviços: [liste os principais]\n📍 ${lead.region?.split(',')[0] || 'Sua cidade'}\n⏰ Seg-Sex 8h-18h\n\nRespondo em até 10 minutos!`,
        });
        break;
      }

      case 'landing_page': {
        if (!lead.site) {
          quickWins.push({
            id: 'qw-landing',
            type: actionType,
            title: 'Criar uma página simples na internet',
            description: `Você não tem site. 70% dos consumidores pesquisam online antes de comprar. Uma página simples no Carrd.co (gratuito) resolve em 30 min.`,
            impact: '+10pts Visibilidade',
            timeEstimate: '~30 min',
            steps: [
              'Acesse carrd.co e crie uma conta gratuita',
              'Escolha um template de negócio local',
              'Preencha: nome, o que faz, fotos, endereço, WhatsApp',
              'Publique e adicione o link no Instagram e Google Meu Negócio',
            ],
          });
        }
        break;
      }

      case 'posts_linkedin': {
        if (bp.primaryClientType === 'b2b' || bp.primaryClientType === 'mixed') {
          quickWins.push({
            id: 'qw-linkedin',
            type: actionType,
            title: 'Publicar primeiro post no LinkedIn da empresa',
            description: `LinkedIn é o canal #1 pra B2B no Brasil. Um post bem feito alcança 5-10x mais pessoas que email frio.`,
            impact: '+6pts Visibilidade',
            timeEstimate: '~15 min',
            steps: [
              'Crie ou atualize a Company Page no LinkedIn',
              'Publique um post sobre um case de sucesso ou dado do seu setor',
              'Peça para 3 funcionários curtirem e comentarem',
              'Repita 2x por semana com dados reais do seu mercado',
            ],
          });
        }
        break;
      }

      case 'video_reels':
      case 'white_paper':
      case 'email_nurturing':
        break;

      case 'ml_otimizar': {
        const ml = diagnosis.expandedData?.mercadoLivre;
        if (ml?.found) {
          const rep = ml.reputation;
          quickWins.push({
            id: 'qw-ml',
            type: actionType,
            title: `Otimizar perfil no Mercado Livre`,
            description: rep
              ? `Perfil encontrado: ${ml.sellerName}. ${rep.powerSellerStatus ? `Status: ${rep.powerSellerStatus}.` : ''} ${rep.transactions ? `${rep.transactions} vendas.` : ''} ${rep.ratings ? `Avaliação: ${rep.ratings.positive}% positiva.` : ''}`
              : `Seu perfil ${ml.sellerName || ''} foi encontrado no ML.`,
            impact: '+8pts Visibilidade',
            timeEstimate: '~20 min',
            steps: [
              'Revise título e descrição dos seus anúncios com palavras-chave do seu produto',
              'Adicione fotos profissionais (fundo branco, múltiplos ângulos)',
              'Responda todas as perguntas de compradores em até 1h',
              'Ofereça frete grátis quando possível (aumenta visibilidade no algoritmo)',
            ],
          });
        }
        break;
      }

      case 'ifood_otimizar': {
        const ifood = diagnosis.expandedData?.ifood;
        if (ifood?.found) {
          quickWins.push({
            id: 'qw-ifood',
            type: actionType,
            title: `Otimizar perfil no iFood`,
            description: `Seu restaurante foi encontrado no iFood${ifood.url ? '' : ' (via busca)'}. Otimize pra aparecer melhor nas buscas.`,
            impact: '+8pts Visibilidade',
            timeEstimate: '~20 min',
            steps: [
              'Atualize fotos do cardápio (fotos profissionais vendem até 30% mais)',
              'Revise descrições dos pratos com detalhes que diferenciam',
              'Ajuste tempo de entrega pra faixa realista (não prometa menos do que consegue)',
              'Responda TODAS as avaliações — positivas e negativas',
            ],
          });
        }
        break;
      }
    }
  }

  // Quick wins extras baseados em expandedData
  const expanded = diagnosis.expandedData || {};

  // Reclame Aqui
  if (expanded.reclameAqui?.found && expanded.reclameAqui.score !== undefined) {
    const ra = expanded.reclameAqui;
    if (ra.score < 7) {
      quickWins.push({
        id: 'qw-reclame-aqui',
        type: 'responder_reviews',
        title: `Melhorar reputação no Reclame Aqui`,
        description: `Nota ${ra.score}/10 no Reclame Aqui${ra.reputation ? ` (${ra.reputation})` : ''}. ${ra.responseRate ? `Taxa de resposta: ${ra.responseRate}%.` : ''} ${ra.totalComplaints ? `${ra.totalComplaints} reclamações registradas.` : ''}`,
        impact: '+6pts Credibilidade',
        timeEstimate: '~30 min',
        steps: [
          `Acesse ${ra.url || 'reclameaqui.com.br'} e responda reclamações pendentes`,
          'Priorize reclamações sem resposta (impactam mais o score)',
          'Tom: empático, solução concreta, sem defensividade',
          'Meta: taxa de resposta acima de 90% e score acima de 7.5',
        ],
      });
    }
  }

  // Sazonalidade
  if (expanded.seasonality?.seasonalityStrength === 'high' && expanded.seasonality.source === 'google_trends_apify') {
    quickWins.push({
      id: 'qw-seasonality',
      type: 'calendario_sazonal',
      title: `Preparar pro pico: ${expanded.seasonality.bestMonths?.[0] || 'próximo mês'}`,
      description: expanded.seasonality.summary || 'Seu setor tem sazonalidade forte.',
      impact: '+5pts Visibilidade',
      timeEstimate: '~15 min',
      steps: [
        `Mês de pico: ${expanded.seasonality.bestMonths?.join(', ') || 'verificar'}. Prepare conteúdo e estoque com antecedência.`,
        `Mês de vale: ${expanded.seasonality.worstMonths?.join(', ') || 'verificar'}. Promoções e fidelização.`,
        'Agende posts e campanhas 2-4 semanas antes do pico',
      ],
    });
  }

  // Quick wins baseados no challenge do form (diversifica com base no objetivo do dono)
  if (lead.challenge) {
    switch (lead.challenge) {
      case 'frequencia': {
        quickWins.push({
          id: 'qw-challenge-freq',
          type: 'whatsapp_templates',
          title: 'Criar campanha de recompra via WhatsApp',
          description: 'Clientes que já compraram são 5x mais baratos de ativar. Uma mensagem no timing certo traz de volta.',
          impact: '+5pts Fidelização',
          timeEstimate: '~15 min',
          steps: [
            'Liste 20 clientes que compraram nos últimos 60 dias',
            'Envie a mensagem pronta abaixo via WhatsApp',
            'Repita a cada 30 dias com oferta ou novidade diferente',
          ],
          copyReady: `Oi! Aqui é da ${lead.name || lead.product}. 😊\n\nFaz um tempo que você veio e queria te contar que temos novidades!\n\n[DESCREVA A NOVIDADE]\n\nQuer agendar? É só responder essa mensagem. 💬`,
        });
        break;
      }
      case 'cross_sell': {
        quickWins.push({
          id: 'qw-challenge-cross',
          type: 'whatsapp_templates',
          title: 'Montar combo ou pacote para aumentar ticket',
          description: `${lead.ticket ? `Ticket médio atual: R$${lead.ticket}. ` : ''}Combos aumentam o valor médio em até 30%. Monte um pacote dos seus itens mais vendidos.`,
          impact: '+5pts Receita',
          timeEstimate: '~20 min',
          steps: [
            'Identifique os 3 produtos/serviços mais vendidos',
            'Crie 2 combos com desconto de 10-15% vs compra separada',
            'Divulgue no cardápio/catálogo e no WhatsApp',
            'Treine equipe pra oferecer o combo em todo atendimento',
          ],
        });
        break;
      }
      case 'market_share': {
        const region = lead.region?.split(',')[0] || 'sua região';
        quickWins.push({
          id: 'qw-challenge-share',
          type: 'seo_conteudo',
          title: `Aparecer antes dos concorrentes em "${region}"`,
          description: 'Quem aparece primeiro no Google captura 75% dos cliques. Invista 30 min pra garantir sua posição.',
          impact: '+8pts Visibilidade',
          timeEstimate: '~30 min',
          steps: [
            'Responda todas as avaliações do Google (respostas ativas sobem seu ranking)',
            `Publique 1 post por semana mencionando "${region}" no texto`,
            'Peça pra 5 clientes satisfeitos deixarem avaliação esta semana',
            'Atualize fotos e horários no Google Meu Negócio',
          ],
        });
        break;
      }
      case 'awareness': {
        quickWins.push({
          id: 'qw-challenge-aware',
          type: 'posts_instagram',
          title: 'Criar conteúdo que atrai quem ainda não te conhece',
          description: 'Posts educativos e de bastidores alcançam 3x mais pessoas que posts de venda. Mostre o processo, não só o produto.',
          impact: '+7pts Alcance',
          timeEstimate: '~20 min',
          steps: [
            'Grave 1 vídeo curto (30-60s) mostrando seu dia a dia de trabalho',
            'Publique como Reel com legenda que responda uma dúvida comum do seu cliente',
            'Use 3-5 hashtags locais + do seu setor',
            'Repita 2x por semana alternando: bastidores, antes/depois, dica rápida',
          ],
        });
        break;
      }
      case 'expansao_geo': {
        quickWins.push({
          id: 'qw-challenge-geo',
          type: 'seo_conteudo',
          title: 'Aparecer nas buscas de novas regiões',
          description: 'Crie páginas ou posts direcionados às regiões que você quer alcançar. Google prioriza conteúdo com localização.',
          impact: '+8pts Expansão',
          timeEstimate: '~30 min',
          steps: [
            'Liste 3 bairros ou cidades vizinhas que você quer alcançar',
            `Crie 1 post/página pra cada: "${lead.product} em [REGIÃO]"`,
            'Inclua endereço de atendimento ou área de cobertura',
            'Adicione as regiões na descrição do Google Meu Negócio',
          ],
        });
        break;
      }
      case 'novo_canal': {
        if (!lead.site) {
          quickWins.push({
            id: 'qw-challenge-canal',
            type: 'landing_page',
            title: 'Criar presença online pra vender por canal novo',
            description: 'Você quer vender por um novo canal. O primeiro passo é ter uma página online profissional pra receber esses clientes.',
            impact: '+10pts Visibilidade',
            timeEstimate: '~30 min',
            steps: [
              'Escolha a plataforma do novo canal (iFood, ML, delivery próprio, loja online)',
              'Crie um perfil profissional com fotos, descrições e preços',
              'Divulgue o novo canal pra sua base de clientes atual via WhatsApp',
              'Acompanhe os primeiros 30 dias e ajuste preços/fotos conforme feedback',
            ],
          });
        }
        break;
      }
      case 'novo_produto': {
        quickWins.push({
          id: 'qw-challenge-produto',
          type: 'posts_instagram',
          title: 'Validar novo produto/serviço antes de lançar',
          description: 'Antes de investir em estoque ou estrutura, valide a demanda. Um post-teste custa R$0 e dá dados reais.',
          impact: '+5pts Validação',
          timeEstimate: '~15 min',
          steps: [
            'Crie um post/story apresentando a ideia do novo produto',
            'Pergunte diretamente: "Vocês gostariam de [PRODUTO]? Responde aqui 👇"',
            'Se tiver mais de 10 respostas positivas em 48h, vale o investimento',
            'Ofereça condição especial pros primeiros 10 clientes (cria urgência + valida preço)',
          ],
        });
        break;
      }
      case 'novo_segmento': {
        quickWins.push({
          id: 'qw-challenge-segmento',
          type: 'seo_conteudo',
          title: 'Criar conteúdo para atrair novo perfil de cliente',
          description: 'Pra vender pra um público novo, você precisa falar a língua dele. Crie conteúdo específico pra esse perfil.',
          impact: '+6pts Alcance',
          timeEstimate: '~20 min',
          steps: [
            'Defina o novo perfil: quem é, o que busca, onde está',
            `Crie 1 post respondendo a principal dúvida desse público sobre "${lead.product}"`,
            'Use linguagem e exemplos que falem com esse perfil específico',
            'Teste como anúncio segmentado (R$10/dia por 7 dias) pra medir interesse',
          ],
        });
        break;
      }
    }
  }

  // Instagram gaps reais
  if (expanded.instagramExpanded?.gaps?.length > 0) {
    const igGaps = expanded.instagramExpanded.gaps;
    quickWins.push({
      id: 'qw-ig-gaps',
      type: 'posts_instagram',
      title: `Fechar ${igGaps.length} gap(s) no Instagram vs concorrentes`,
      description: igGaps[0],
      impact: '+6pts Presença Digital',
      timeEstimate: '~20 min',
      steps: igGaps.slice(0, 4).map((g: string, i: number) => `${i + 1}. ${g}`),
    });
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

  // Mapa de challenge pra contexto em PT
  const challengeLabels: Record<string, string> = {
    frequencia: 'Fazer o cliente voltar mais vezes',
    cross_sell: 'Fazer o cliente comprar mais itens',
    market_share: 'Tirar clientes dos concorrentes',
    awareness: 'Ser encontrado por quem ainda não conhece o negócio',
    novo_segmento: 'Vender pra um público diferente do atual',
    expansao_geo: 'Expandir pra novas regiões',
    novo_canal: 'Vender por um canal novo',
    novo_produto: 'Lançar produto ou serviço novo',
  };
  const challengeContext = lead.challenge && challengeLabels[lead.challenge]
    ? `\nOBJETIVO PRINCIPAL DO DONO: ${challengeLabels[lead.challenge]}`
    : '';

  const dataContext = `
NEGÓCIO: ${lead.name || lead.product}
PRODUTO/SERVIÇO: ${lead.product}
REGIÃO: ${lead.region}
BLUEPRINT: ${bp.label}
TIPO CLIENTE: ${bp.primaryClientType}
SCORE ATUAL: ${diagnosis.influencePercent || 0}/100${challengeContext}
${lead.ticket ? `TICKET MÉDIO: R$${lead.ticket}` : ''}

GOOGLE MAPS:
${maps?.found ? `- Encontrado: sim | Rating: ${maps.rating || '?'} | Reviews: ${maps.reviewCount || 0} | Fotos: ${maps.photos || 0}` : '- NÃO encontrado no Google Maps'}
${mapsCompetitors.length > 0 ? `- Concorrentes Maps: ${mapsCompetitors.slice(0, 3).map((c: any) => `${c.name} (${c.rating || '?'}★, ${c.reviewCount || 0} reviews)`).join(', ')}` : ''}

INSTAGRAM:
${ig ? `- @${ig.handle} | ${ig.followers || 0} seguidores | Engajamento: ${((ig.engagementRate || 0) * 100).toFixed(1)}% | Posts recentes: ${ig.postsLast30d || 0}` : '- Sem Instagram ou não encontrado'}
${competitors.length > 0 ? `- Concorrentes IG: ${competitors.map((c: any) => `@${c.handle} (${c.followers || 0} seg)`).join(', ')}` : ''}

TERMOS DE BUSCA:
${terms.map((t: any) => `- "${t.term}": ${t.volume}/mês, posição: ${t.position}`).join('\n')}

CANAIS PRIORITÁRIOS DO SEGMENTO: ${bp.channels.slice(0, 5).join(', ')}
KPI PRINCIPAL: ${bp.primaryKPI}

DADOS EXPANDIDOS (REAIS, coletados de fontes públicas):
${diagnosis.expandedData?.reclameAqui?.found ? `- Reclame Aqui: nota ${diagnosis.expandedData.reclameAqui.score}/10, ${diagnosis.expandedData.reclameAqui.reputation || 'sem classificação'}` : ''}
${diagnosis.expandedData?.ifood?.found ? `- iFood: encontrado${diagnosis.expandedData.ifood.url ? ` (${diagnosis.expandedData.ifood.url})` : ''}` : ''}
${diagnosis.expandedData?.mercadoLivre?.found ? `- Mercado Livre: ${diagnosis.expandedData.mercadoLivre.sellerName || 'encontrado'}${diagnosis.expandedData.mercadoLivre.reputation ? `, ${diagnosis.expandedData.mercadoLivre.reputation.transactions} vendas, ${diagnosis.expandedData.mercadoLivre.reputation.ratings?.positive}% positivas` : ''}` : ''}
${diagnosis.expandedData?.adsTransparency?.searched ? `- Google Ads: ${diagnosis.expandedData.adsTransparency.termsWithAds}/${diagnosis.expandedData.adsTransparency.totalTerms} termos com ads` : ''}
${diagnosis.expandedData?.seasonality?.source === 'google_trends_apify' ? `- Sazonalidade: pico em ${diagnosis.expandedData.seasonality.bestMonths?.join(', ')}, vale em ${diagnosis.expandedData.seasonality.worstMonths?.join(', ')}` : ''}
${diagnosis.expandedData?.instagramExpanded?.gaps?.length > 0 ? `- Instagram gaps: ${diagnosis.expandedData.instagramExpanded.gaps.slice(0, 2).join('; ')}` : ''}
${diagnosis.expandedData?.linkedin?.companyPage?.found ? `- LinkedIn: company page encontrada` : ''}
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
8. ${challengeContext ? `O PRIMEIRO PILAR deve ser diretamente ligado ao objetivo do dono: "${challengeLabels[lead.challenge || ''] || ''}"` : 'Priorize pilares pelos gaps mais críticos detectados nos dados'}

FORMATO JSON:
{"pillars":[{
  "id":"pilar-1",
  "type":"content_engine|authority|prospecting|reputation|expansion",
  "title":"Título curto e direto",
  "description":"POR QUE esse pilar conecta com o objetivo do dono. Cite dados reais.",
  "channel":"canal_principal",
  "priority":1,
  "items":[{
    "id":"item-1",
    "title":"Etapa clara (ex: Responder reviews negativos, Publicar post de autoridade)",
    "type":"copy|template|structure|checklist|script",
    "content":"CONTEÚDO COMPLETO PRONTO PRA USAR. Não escreva placeholder — escreva o texto final.",
    "copyable":true
  }],
  "kpi":{"metric":"Métrica específica do pilar","target":"Número meta realista","timeframe":"30 dias"}
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
