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

      case 'video_reels': {
        if (lead.instagram) {
          const igHandle = (lead.instagram || '').replace('@', '');
          const hasReelsData = ig && ig.avgViews !== undefined;
          const avgViews = ig?.avgViews || 0;
          const reelsOutperform = avgViews > (ig?.avgLikes || 0) * 2;
          quickWins.push({
            id: 'qw-reels',
            type: actionType,
            title: hasReelsData && avgViews > 0
              ? `Aumentar alcance dos Reels${reelsOutperform ? ' (já performam bem!)' : ''}`
              : 'Gravar seu primeiro Reel no Instagram',
            description: hasReelsData && avgViews > 0
              ? `@${igHandle}: ${avgViews.toLocaleString('pt-BR')} views médios por Reel${reelsOutperform ? ' — seus Reels já alcançam mais que posts estáticos. Dobre a aposta.' : '. Reels alcançam 2-3x mais pessoas que fotos. Poste pelo menos 2 por semana.'}`
              : `@${igHandle} ainda não tem Reels. Reels alcançam 2-3x mais pessoas que posts estáticos no Instagram.`,
            impact: '+7pts Alcance',
            timeEstimate: '~20 min',
            steps: [
              `Grave um vídeo de 30-60s mostrando bastidores de ${lead.product}`,
              'Use áudio em alta no Instagram (toque "Áudios" na aba Reels)',
              'Legenda: comece com pergunta ou dado curioso pra prender atenção',
              'Poste entre 11h-13h ou 18h-20h. Meta: 2 Reels por semana',
            ],
            copyReady: `🎬 Você sabia que [dado curioso sobre ${lead.product}]?\n\nA maioria das pessoas não sabe disso, mas...\n\n[Mostre o processo/produto em ação]\n\nSiga @${igHandle} pra mais dicas de ${lead.product.split(' ')[0]}! 💡`,
          });
        }
        break;
      }

      case 'white_paper': {
        if (bp.primaryClientType === 'b2b' || bp.primaryClientType === 'mixed') {
          const topTerms = (diagnosis.terms || [])
            .filter((t: any) => t.volume > 0)
            .sort((a: any, b: any) => b.volume - a.volume);
          const topTerm = topTerms[0];
          const region = lead.region?.split(',')[0] || 'sua região';
          quickWins.push({
            id: 'qw-whitepaper',
            type: actionType,
            title: topTerm
              ? `Criar guia técnico: "${topTerm.term}"`
              : `Criar material de autoridade sobre ${lead.product}`,
            description: topTerm
              ? `"${topTerm.term}" tem ${topTerm.volume.toLocaleString('pt-BR')} buscas/mês${topTerm.cpc ? ` e CPC de R$${topTerm.cpc.toFixed(2)}` : ''}. Um guia técnico sobre esse tema posiciona você como referência e gera leads qualificados.`
              : `Um material técnico sobre ${lead.product} em ${region} posiciona você como autoridade no setor.`,
            impact: '+8pts Autoridade',
            timeEstimate: '~45 min',
            steps: [
              `Escolha o tema: ${topTerm ? `"${topTerm.term}"` : `tendências de ${lead.product}`}`,
              'Estruture: Problema → Dados do mercado → Sua solução → CTA',
              'Adicione dados reais (cite fontes como IBGE, pesquisas do setor)',
              'Distribua via LinkedIn, email e como download no site',
            ],
            copyReady: `# Como escolher ${lead.product} em ${region}\n\n## O desafio\n[Descreva o principal problema que seu cliente enfrenta]\n\n## O que os dados mostram\n${topTerm ? `- ${topTerm.volume.toLocaleString('pt-BR')} pessoas buscam "${topTerm.term}" todo mês` : ''}\n- [Adicione 2-3 dados do seu setor]\n\n## A solução\n[Explique como ${lead.name || lead.product} resolve esse problema]\n\n## Próximo passo\nFale com nossa equipe: [WhatsApp/email]`,
          });
        }
        break;
      }

      case 'email_nurturing': {
        if (bp.primaryClientType === 'b2b' || bp.primaryClientType === 'mixed') {
          const b2bCount = (diagnosis.b2bCompanies || []).length;
          const region = lead.region?.split(',')[0] || 'sua região';
          quickWins.push({
            id: 'qw-email-nurturing',
            type: actionType,
            title: 'Criar sequência de 3 emails para converter leads',
            description: b2bCount > 0
              ? `${b2bCount} empresas na região podem ser prospects. Uma sequência de 3 emails converte 3x mais que email frio único.`
              : `Empresas em ${region} buscam ${lead.product}. Uma sequência de 3 emails educa e converte sem ser invasivo.`,
            impact: '+6pts Conversão',
            timeEstimate: '~30 min',
            steps: [
              'Email 1 (Dia 0): Valor — compartilhe um insight útil sem vender nada',
              'Email 2 (Dia 3): Prova — case de sucesso ou resultado real de um cliente',
              'Email 3 (Dia 7): Proposta — oferta direta com CTA claro',
              'Envie pra lista de contatos ou prospects do LinkedIn',
            ],
            copyReady: `Assunto: ${lead.product} — o que as empresas de ${region} estão fazendo diferente\n\nOlá [Nome],\n\nTrabalho com ${lead.product} em ${region} e notei algo interessante:\n\n[Insira um dado real do seu setor — ex: "78% das empresas do setor ainda não..."]\n\nSe isso faz sentido pro seu negócio, posso compartilhar como estamos ajudando empresas como a sua.\n\nAbs,\n${lead.name || 'Equipe ' + lead.product}`,
          });
        }
        break;
      }

      case 'calendario_sazonal': {
        const seasonality = diagnosis.expandedData?.seasonality;
        if (seasonality?.source === 'google_trends_apify' && seasonality.bestMonths?.length > 0) {
          quickWins.push({
            id: 'qw-calendario-sazonal',
            type: actionType,
            title: `Montar calendário sazonal: preparar pro pico em ${seasonality.bestMonths[0]}`,
            description: `${seasonality.summary || `Pico em ${seasonality.bestMonths.join(', ')}. Vale em ${seasonality.worstMonths?.join(', ') || '?'}.`} Quem se prepara antes do pico captura 3x mais demanda.`,
            impact: '+5pts Estratégia',
            timeEstimate: '~20 min',
            steps: [
              `Mês de pico: ${seasonality.bestMonths.join(', ')}. Prepare conteúdo e estoque 4 semanas antes.`,
              `Mês de vale: ${seasonality.worstMonths?.join(', ') || 'verificar'}. Foque em fidelização e promoções.`,
              'Crie 1 campanha específica pra cada mês de pico (post + oferta + WhatsApp)',
              'Agende posts com antecedência usando Meta Business Suite',
            ],
          });
        } else if (bp.seasonalityRelevance === 'high') {
          quickWins.push({
            id: 'qw-calendario-sazonal-manual',
            type: actionType,
            title: 'Identificar meses de pico do seu setor',
            description: `Seu setor (${bp.label}) tem sazonalidade forte. Saber quando a demanda sobe e desce é a base de qualquer planejamento.`,
            impact: '+4pts Estratégia',
            timeEstimate: '~15 min',
            steps: [
              'Acesse Google Trends e busque seus termos principais',
              'Anote os meses de pico e vale dos últimos 2 anos',
              'Prepare conteúdo e ofertas 4 semanas antes de cada pico',
              'No vale, foque em fidelização (ex: programa de indicação)',
            ],
          });
        }
        break;
      }

      case 'comparativo_expansao': {
        const aud = diagnosis.audiencia;
        const proj = diagnosis.projecaoFinanceira;
        if (aud?.audienciaTarget || proj?.familiasGap) {
          const region = lead.region?.split(',')[0] || 'sua região';
          quickWins.push({
            id: 'qw-comparativo-expansao',
            type: actionType,
            title: 'Mapear oportunidades de expansão geográfica',
            description: [
              aud?.populacaoRaio ? `${aud.populacaoRaio.toLocaleString('pt-BR')} pessoas no raio de atuação` : '',
              aud?.audienciaTarget ? `${aud.audienciaTarget.toLocaleString('pt-BR')} no perfil-alvo` : '',
              proj?.familiasGap ? `${proj.familiasGap.toLocaleString('pt-BR')} famílias não atendidas` : '',
            ].filter(Boolean).join('. ') + `. Analise onde estão as oportunidades perto de ${region}.`,
            impact: '+8pts Expansão',
            timeEstimate: '~20 min',
            steps: [
              'Liste 3 bairros ou cidades vizinhas com menos concorrência',
              `Teste anúncio segmentado por região (R$10/dia, 7 dias) pra "${lead.product} em [REGIÃO]"`,
              'Compare custo por lead entre regiões — a mais barata tem mais oportunidade',
              'Considere ponto de atendimento ou parceiro local na região vencedora',
            ],
          });
        }
        break;
      }

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

  // ─── QUICK WINS DATA-DRIVEN (baseados em dados disponíveis) ─────────────────

  // AI Visibility
  if (diagnosis.aiVisibility) {
    const ai = diagnosis.aiVisibility;
    if (ai.score < 30) {
      quickWins.push({
        id: 'qw-ai-visibility',
        type: 'seo_conteudo',
        title: 'Aparecer nas respostas de ChatGPT e Gemini',
        description: `Visibilidade IA: ${ai.score}/100. ${ai.likelyMentioned ? 'Você é mencionado, mas com baixa frequência.' : `Quando alguém pergunta sobre "${lead.product} em ${lead.region?.split(',')[0]}" pra IA, você NÃO aparece.`}`,
        impact: '+10pts Descoberta Digital',
        timeEstimate: '~30 min',
        steps: [
          'Crie conteúdo no formato pergunta-resposta (FAQ) no seu site ou blog',
          'Cadastre-se em diretórios e sites de avaliação do seu setor',
          'Gere mais reviews no Google (IAs usam reviews como fonte)',
          'Publique artigos com dados e referências (IAs priorizam conteúdo autoritativo)',
        ],
      });
    } else if (ai.score < 70) {
      quickWins.push({
        id: 'qw-ai-visibility-mid',
        type: 'seo_conteudo',
        title: 'Fortalecer presença nas respostas de IA',
        description: `Visibilidade IA: ${ai.score}/100. ${ai.summary || 'Você aparece em algumas consultas mas pode melhorar.'}${ai.competitorMentions ? ` ${ai.competitorMentions} menções de concorrentes detectadas.` : ''}`,
        impact: '+6pts Descoberta Digital',
        timeEstimate: '~20 min',
        steps: [
          'Aumente volume de reviews (>50 no Google = maior chance de citação)',
          'Crie conteúdo autoritativo com dados reais do seu setor',
          'Garanta que seu site tem dados estruturados (Schema.org)',
        ],
      });
    }
  }

  // SERP Local Pack
  if (diagnosis.serpSummary?.hasLocalPack && maps?.found && !maps.inLocalPack) {
    quickWins.push({
      id: 'qw-serp-localpack',
      type: 'otimizar_google_maps',
      title: 'Entrar no top 3 do mapa do Google (Local Pack)',
      description: `Seus termos mostram mapa no Google, mas você não está nos 3 primeiros. ${diagnosis.serpSummary.termsRanked || 0} de ${diagnosis.serpSummary.termsScraped || 0} termos com posição — quem está no Local Pack captura 44% dos cliques.`,
      impact: '+12pts Visibilidade',
      timeEstimate: '~30 min',
      steps: [
        'Complete 100% da ficha do Google Meu Negócio (descrição, horários, fotos, serviços)',
        'Peça 5 avaliações novas esta semana (quantidade recente pesa no ranking)',
        'Publique 1 Google Post por semana sobre seus serviços',
        'Confirme que seu endereço e telefone são idênticos em todos os cadastros online (NAP consistency)',
      ],
    });
  }

  // Ads Transparency
  if (expanded.adsTransparency?.searched) {
    const ads = expanded.adsTransparency;
    if (ads.termsWithAds > 0) {
      quickWins.push({
        id: 'qw-ads-opportunity',
        type: 'google_ads_setup',
        title: `Testar Google Ads: ${ads.termsWithAds} termos com anúncios de concorrentes`,
        description: `${ads.termsWithAds} de ${ads.totalTerms} termos já têm anúncios de concorrentes. Se eles investem, há retorno comprovado. Teste com R$10/dia por 7 dias.`,
        impact: '+8pts Visibilidade Paga',
        timeEstimate: '~30 min',
        steps: [
          'Crie conta no Google Ads (ads.google.com)',
          `Crie campanha de pesquisa com os termos que já têm ads`,
          'Defina orçamento diário de R$10-20 e região de atuação',
          'Após 7 dias, avalie: custo por clique, cliques, e contatos gerados',
        ],
      });
    } else if (ads.totalTerms > 0) {
      quickWins.push({
        id: 'qw-ads-blueocean',
        type: 'google_ads_setup',
        title: 'Oceano azul: nenhum concorrente anuncia nos seus termos',
        description: `Nenhum dos ${ads.totalTerms} termos analisados tem anúncio de concorrente. Você pode ser o primeiro — CPC tende a ser muito baixo sem competição.`,
        impact: '+10pts Oportunidade',
        timeEstimate: '~30 min',
        steps: [
          'Crie conta no Google Ads (ads.google.com)',
          `Anuncie nos seus termos principais com R$10/dia`,
          'Sem concorrência, seu custo por clique será muito baixo',
          'Monitore por 7 dias e escale se tiver resultado',
        ],
      });
    }
  }

  // Competitor IG deep analysis
  const competitors = diagnosis.competitorInstagram || [];
  if (competitors.length > 0 && ig) {
    const myEngagement = ig.engagementRate || 0;
    const myPosts = ig.postsLast30d || 0;
    const engagementLeader = competitors.find((c: any) => (c.engagementRate || 0) > myEngagement * 2);
    const frequencyLeader = competitors.find((c: any) => (c.postsLast30d || 0) > Math.max(myPosts, 4) * 2);

    if (engagementLeader) {
      quickWins.push({
        id: 'qw-ig-engagement-gap',
        type: 'posts_instagram',
        title: `Analisar engajamento do @${engagementLeader.handle}`,
        description: `@${engagementLeader.handle} tem engajamento de ${((engagementLeader.engagementRate || 0) * 100).toFixed(1)}% vs seu ${(myEngagement * 100).toFixed(1)}%. Analise os últimos 10 posts dele pra entender o que funciona.`,
        impact: '+6pts Engajamento',
        timeEstimate: '~15 min',
        steps: [
          `Abra @${engagementLeader.handle} e veja os 10 posts com mais curtidas`,
          'Anote: formato (carrossel, reel, foto), tema, horário, legenda',
          'Identifique 2-3 padrões que se repetem nos posts de sucesso',
          'Adapte esses padrões pro seu conteúdo (não copie, adapte)',
        ],
      });
    }

    if (frequencyLeader && !engagementLeader) {
      quickWins.push({
        id: 'qw-ig-frequency-gap',
        type: 'posts_instagram',
        title: `Igualar frequência do @${frequencyLeader.handle}`,
        description: `@${frequencyLeader.handle} posta ${frequencyLeader.postsLast30d || 0}x/mês vs seus ${myPosts}. Consistência é o fator #1 no algoritmo do Instagram.`,
        impact: '+5pts Presença',
        timeEstimate: '~15 min/semana',
        steps: [
          `Meta: postar pelo menos ${Math.min(Math.ceil((frequencyLeader.postsLast30d || 8) / 2), 12)}x por mês`,
          'Defina dias fixos e crie conteúdo em lote (1h por semana)',
          'Alterne: 1 educativo + 1 bastidores + 1 depoimento',
          'Use agendamento do Instagram ou Meta Business Suite',
        ],
      });
    }
  }

  // 4D Score Levers — max 2 weakest dimensions
  const breakdown = diagnosis.influenceBreakdown;
  if (breakdown) {
    const dimensions = [
      { key: 'd1_descoberta', label: 'Descoberta', score: breakdown.d1_descoberta, fix: 'SEO + Google Maps + presença em diretórios' },
      { key: 'd2_credibilidade', label: 'Credibilidade', score: breakdown.d2_credibilidade, fix: 'reviews + rating + tempo de resposta' },
      { key: 'd3_presenca', label: 'Presença Digital', score: breakdown.d3_presenca, fix: 'frequência de posts + variedade de canais' },
      { key: 'd4_reputacao', label: 'Reputação', score: breakdown.d4_reputacao, fix: 'responder reclamações + prova social + cases' },
    ].filter(d => typeof d.score === 'number' && d.score < 4)
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .slice(0, 2);

    for (const dim of dimensions) {
      const levers = (breakdown.levers || []).filter((l: any) => l.dimension === dim.key);
      quickWins.push({
        id: `qw-4d-${dim.key}`,
        type: 'seo_conteudo',
        title: `Subir ${dim.label} de ${dim.score}/10 para ${Math.min((dim.score || 0) + 3, 10)}/10`,
        description: `Sua dimensão de ${dim.label} está em ${dim.score}/10 — a mais fraca. Foco: ${dim.fix}.${levers.length > 0 ? ` Alavancas: ${levers.map((l: any) => l.label || l.action).join(', ')}.` : ''}`,
        impact: `+${Math.round(((10 - (dim.score || 0)) / 10) * 15)}pts ${dim.label}`,
        timeEstimate: '~20 min',
        steps: levers.length > 0
          ? levers.slice(0, 4).map((l: any, i: number) => `${i + 1}. ${l.label || l.action}`)
          : [
            `Identifique o que mais impacta ${dim.label} no seu caso`,
            dim.fix,
            'Execute 1 ação por semana e meça o impacto no score',
          ],
      });
    }
  }

  // Market Gap (audiência + projeção financeira)
  if (diagnosis.audiencia?.audienciaTarget && diagnosis.projecaoFinanceira?.familiasGap) {
    const gap = diagnosis.projecaoFinanceira.familiasGap;
    const mercado = diagnosis.projecaoFinanceira.mercadoTotal;
    if (gap > 100) {
      quickWins.push({
        id: 'qw-market-gap',
        type: 'prospeccao_b2b',
        title: `${gap.toLocaleString('pt-BR')} famílias no seu mercado ainda não te conhecem`,
        description: `Mercado total estimado: R$${mercado ? mercado.toLocaleString('pt-BR') : '?'}. ${diagnosis.audiencia.audienciaTarget.toLocaleString('pt-BR')} pessoas no perfil-alvo, ${gap.toLocaleString('pt-BR')} não atendidas. Comece pelo canal mais eficiente.`,
        impact: '+8pts Oportunidade',
        timeEstimate: '~20 min',
        steps: [
          'Identifique onde essas pessoas estão (Google, Instagram, WhatsApp, boca a boca)',
          'Crie 1 conteúdo direcionado pra cada canal principal',
          'Teste anúncio segmentado por bairro/região (R$10/dia)',
          'Meça: custo por contato em cada canal. Dobre o investimento no melhor.',
        ],
      });
    }
  }

  // PNCP (Licitações governamentais)
  if (diagnosis.pncp && (diagnosis.pncp.tenders?.length > 0 || diagnosis.pncp.companies?.length > 0)) {
    quickWins.push({
      id: 'qw-pncp',
      type: 'prospeccao_b2b',
      title: 'Explorar licitações públicas no seu setor',
      description: `Foram encontradas oportunidades de compras governamentais para ${lead.product} na sua região. Empresas que vendem pro governo têm receita previsível.`,
      impact: '+8pts Receita B2G',
      timeEstimate: '~30 min',
      steps: [
        'Cadastre-se no ComprasGov.br (portal de compras do governo)',
        `Configure alertas para "${lead.product}" na sua região`,
        'Prepare documentação: CNPJ, certidões, atestados de capacidade',
        'Participe da primeira licitação como experiência — o processo fica mais fácil depois',
      ],
    });
  }

  // B2B Companies (prospects identificados)
  if ((diagnosis.b2bCompanies || []).length > 0) {
    const count = diagnosis.b2bCompanies.length;
    quickWins.push({
      id: 'qw-b2b-prospects',
      type: 'prospeccao_b2b',
      title: `Prospectar ${count} empresa${count > 1 ? 's' : ''} identificada${count > 1 ? 's' : ''} na região`,
      description: `${count} empresa${count > 1 ? 's' : ''} na sua região ${count > 1 ? 'são potenciais clientes' : 'é potencial cliente'} para ${lead.product}. Abordagem direta funciona quando o prospect é relevante.`,
      impact: '+8pts Prospecção',
      timeEstimate: '~20 min',
      steps: [
        `Priorize as ${Math.min(count, 5)} empresas mais alinhadas ao seu perfil`,
        'Pesquise cada uma no LinkedIn — encontre o decisor',
        'Envie mensagem personalizada (veja template abaixo)',
        'Follow-up em 3 dias se não responder',
      ],
      copyReady: `Olá [Nome],\n\nSou ${lead.name ? `da ${lead.name}` : `especialista em ${lead.product}`} em ${lead.region?.split(',')[0] || 'sua região'}.\n\nNotei que [observação específica sobre a empresa do prospect] e acredito que podemos ajudar com [benefício principal].\n\nPodemos conversar 15 min esta semana?\n\nAbs,\n${lead.name || lead.product}`,
    });
  }

  // LinkedIn Company Page (B2B sem página)
  if (expanded.linkedin && !expanded.linkedin.companyPage?.found && (bp.primaryClientType === 'b2b' || bp.primaryClientType === 'mixed')) {
    quickWins.push({
      id: 'qw-linkedin-create',
      type: 'posts_linkedin',
      title: 'Criar Company Page no LinkedIn',
      description: `Não encontramos página de empresa no LinkedIn. Para B2B, LinkedIn é o canal #1 de prospecção no Brasil — 65M de profissionais ativos.`,
      impact: '+8pts Presença B2B',
      timeEstimate: '~20 min',
      steps: [
        'Acesse linkedin.com/company/setup/new e crie a página',
        `Nome: "${lead.name || lead.product}" | Setor: ${bp.label}`,
        'Complete: logo, banner, descrição, site, região de atuação',
        'Publique 1 post por semana sobre seu setor (dado, case, insight)',
      ],
    });
  }

  // Reclame Aqui selo positivo (complementa o existing que só pega score < 7)
  if (expanded.reclameAqui?.found && (expanded.reclameAqui.score || 0) >= 7) {
    quickWins.push({
      id: 'qw-reclame-aqui-badge',
      type: 'responder_reviews',
      title: 'Usar nota do Reclame Aqui como prova social',
      description: `Nota ${expanded.reclameAqui.score}/10${expanded.reclameAqui.reputation ? ` (${expanded.reclameAqui.reputation})` : ''} no Reclame Aqui. Isso é um ativo de credibilidade — 92% dos consumidores consultam o RA antes de comprar.`,
      impact: '+4pts Credibilidade',
      timeEstimate: '~10 min',
      steps: [
        'Capture um screenshot da sua nota no Reclame Aqui',
        'Adicione no site, Instagram (destaques) e assinatura de email',
        'Mencione nas respostas de WhatsApp: "Nota X no Reclame Aqui"',
        'Mantenha taxa de resposta acima de 90% pra não perder o selo',
      ],
    });
  }

  // Competition Index
  if (diagnosis.competitionIndex) {
    const ci = typeof diagnosis.competitionIndex === 'number' ? diagnosis.competitionIndex : null;
    if (ci !== null && ci < 30) {
      quickWins.push({
        id: 'qw-competition-low',
        type: 'seo_conteudo',
        title: 'Aproveitar: baixa concorrência digital no seu mercado',
        description: `Índice de competição: ${ci}/100 (baixo). Janela de oportunidade — quem dominar agora terá vantagem quando outros entrarem.`,
        impact: '+6pts Estratégia',
        timeEstimate: '~20 min',
        steps: [
          'Reclame todas as propriedades digitais: Google Maps, Instagram, site, LinkedIn',
          'Seja o primeiro a anunciar no Google Ads (CPC baixo sem concorrência)',
          'Domine reviews: meta de 50+ avaliações antes dos concorrentes',
          'Crie conteúdo SEO pros termos principais — sem competição, rankeamento é rápido',
        ],
      });
    } else if (ci !== null && ci > 70) {
      quickWins.push({
        id: 'qw-competition-high',
        type: 'seo_conteudo',
        title: 'Diferenciar-se num mercado competitivo',
        description: `Índice de competição: ${ci}/100 (alto). Competir por preço é insustentável — foque em especialização e credibilidade.`,
        impact: '+6pts Diferenciação',
        timeEstimate: '~20 min',
        steps: [
          'Escolha 1 nicho específico dentro do seu setor (ex: "pizzaria artesanal" não "pizzaria")',
          'Crie conteúdo que demonstre expertise nesse nicho',
          'Invista em reviews e prova social — é o diferencial mais difícil de copiar',
          'Foque em atendimento excepcional (respondibilidade, personalização)',
        ],
      });
    }
  }

  // Setor-específicos: ANEEL, Canal Solar, Anatel
  if (expanded.aneel?.gd?.found) {
    const gd = expanded.aneel.gd;
    quickWins.push({
      id: 'qw-aneel-gd',
      type: 'prospeccao_b2b',
      title: `Prospectar no mercado de geração distribuída: ${gd.totalUsinas || '?'} usinas na região`,
      description: `${gd.totalUsinas?.toLocaleString('pt-BR') || '?'} usinas de geração distribuída em ${gd.municipio || lead.region?.split(',')[0]}. Potência total: ${gd.potenciaTotal ? gd.potenciaTotal.toLocaleString('pt-BR') + ' kW' : 'dados disponíveis'}.`,
      impact: '+8pts Prospecção Setorial',
      timeEstimate: '~20 min',
      steps: [
        'Use os dados da ANEEL pra identificar oportunidades de manutenção/ampliação',
        'Crie proposta específica pra quem já tem usina (upsell)',
        'Prospecte empresas que ainda não têm geração distribuída (new business)',
      ],
    });
  }

  if (expanded.canalSolar?.found) {
    const cs = expanded.canalSolar;
    quickWins.push({
      id: 'qw-canal-solar',
      type: 'prospeccao_b2b',
      title: `Analisar ${cs.integradores?.length || '?'} integradores solares próximos`,
      description: `${cs.integradores?.length || '?'} integradores de energia solar num raio de 100km. Mapeie como concorrentes ou parceiros.`,
      impact: '+6pts Inteligência Competitiva',
      timeEstimate: '~15 min',
      steps: [
        'Analise os integradores listados: porte, especialização, região de atuação',
        'Identifique lacunas: regiões não atendidas, serviços que eles não oferecem',
        'Considere parcerias com integradores complementares',
      ],
    });
  }

  if (expanded.anatel?.found) {
    const ant = expanded.anatel;
    quickWins.push({
      id: 'qw-anatel',
      type: 'seo_conteudo',
      title: `Posicionar-se no mercado de ${ant.municipio}: ${ant.totalAcessos?.toLocaleString('pt-BR') || '?'} acessos banda larga`,
      description: `${ant.totalPrestadoras || '?'} prestadoras em ${ant.municipio}. ${ant.prestadoras?.[0] ? `Líder: ${ant.prestadoras[0].nome} (${ant.prestadoras[0].marketShare}% market share).` : ''} Identifique seu espaço.`,
      impact: '+8pts Inteligência Competitiva',
      timeEstimate: '~20 min',
      steps: [
        `Analise sua participação vs ${ant.prestadoras?.[0]?.nome || 'líder do mercado'}`,
        'Identifique regiões/bairros com menos cobertura dos grandes (oportunidade)',
        'Destaque seu diferencial vs grandes operadoras (atendimento local, suporte rápido)',
        'Crie landing page segmentada por bairro/região',
      ],
    });
  }

  // ─── GARANTIA DE MÍNIMO + DEDUP ──────────────────────────────────────────────

  if (quickWins.length < 6) {
    const existingIds = new Set(quickWins.map(q => q.id));

    if (!existingIds.has('qw-review-link') && maps?.found) {
      quickWins.push({
        id: 'qw-review-link',
        type: 'capturar_reviews',
        title: 'Criar link curto para pedir avaliações',
        description: `Link direto para avaliação no Google facilita pedir reviews. Imprima como QR code no balcão ou inclua no WhatsApp.`,
        impact: '+4pts Credibilidade',
        timeEstimate: '~5 min',
        steps: [
          'Busque seu negócio no Google e clique em "Escrever avaliação"',
          'Copie a URL da página de avaliação',
          'Encurte com bit.ly e gere QR code (qr-code-generator.com)',
          'Coloque o QR code no balcão, cardápio ou nota fiscal',
        ],
      });
    }

    if (!existingIds.has('qw-whatsapp-catalog') && quickWins.length < 6) {
      quickWins.push({
        id: 'qw-whatsapp-catalog',
        type: 'whatsapp_templates',
        title: 'Montar catálogo no WhatsApp Business',
        description: 'Catálogo no WhatsApp permite que clientes vejam produtos/serviços sem sair do chat. 72% dos brasileiros preferem WhatsApp pra contato comercial.',
        impact: '+4pts Conversão',
        timeEstimate: '~20 min',
        steps: [
          'Abra WhatsApp Business → Ferramentas de negócios → Catálogo',
          'Adicione seus 5-10 produtos/serviços principais com foto e preço',
          'Compartilhe o catálogo no Instagram bio e Google Maps',
        ],
      });
    }

    if (!existingIds.has('qw-google-posts') && maps?.found && (maps.rating || 0) >= 4.0 && quickWins.length < 6) {
      quickWins.push({
        id: 'qw-google-posts',
        type: 'otimizar_google_maps',
        title: 'Publicar Google Post na sua ficha',
        description: `Sua ficha tem nota ${maps.rating}. Google Posts aparecem direto na busca e mantêm sua ficha ativa no algoritmo.`,
        impact: '+3pts Visibilidade',
        timeEstimate: '~10 min',
        steps: [
          'Acesse business.google.com → Posts',
          'Publique uma novidade, oferta ou evento',
          'Inclua foto + CTA (Ligar, WhatsApp, Agendar)',
          'Repita 1x por semana (posts expiram em 7 dias)',
        ],
      });
    }

    if (quickWins.length < 6) {
      const weakestD = breakdown ? [
        { label: 'Descoberta', score: breakdown.d1_descoberta },
        { label: 'Credibilidade', score: breakdown.d2_credibilidade },
        { label: 'Presença', score: breakdown.d3_presenca },
        { label: 'Reputação', score: breakdown.d4_reputacao },
      ].filter(d => typeof d.score === 'number').sort((a, b) => (a.score || 0) - (b.score || 0))[0] : null;

      quickWins.push({
        id: 'qw-audit',
        type: 'seo_conteudo',
        title: 'Fazer auditoria rápida da presença digital',
        description: `Score atual: ${score}/100.${weakestD ? ` Dimensão mais fraca: ${weakestD.label} (${weakestD.score}/10).` : ''} Veja exatamente onde ganhar pontos.`,
        impact: '+5pts Score Geral',
        timeEstimate: '~15 min',
        steps: [
          'Busque seu negócio no Google e veja como aparece (Maps, orgânico, ads)',
          'Compare com os 3 primeiros concorrentes que aparecem',
          `Foque na dimensão mais fraca: ${weakestD?.label || 'verifique no diagnóstico'}`,
          'Execute 1 ação por semana e acompanhe a evolução no radar',
        ],
      });
    }
  }

  // Dedup por id
  const seen = new Set<string>();
  return quickWins.filter(qw => {
    if (seen.has(qw.id)) return false;
    seen.add(qw.id);
    return true;
  });
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
