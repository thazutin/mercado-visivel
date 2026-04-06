import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function POST(req: NextRequest) {
  const { leadId, itemIndex, contentType } = await req.json();
  if (!leadId || itemIndex == null) {
    return NextResponse.json({ error: 'leadId and itemIndex required' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
  if (!lead || lead.plan_status !== 'ready') {
    return NextResponse.json({ error: 'Lead not found or plan not ready' }, { status: 404 });
  }

  const { data: checklist } = await supabase.from('checklists').select('items').eq('lead_id', leadId).single();
  const items = (checklist?.items || []) as any[];
  const item = items[itemIndex];
  if (!item) {
    return NextResponse.json({ error: `Item at index ${itemIndex} not found` }, { status: 404 });
  }

  const display = lead.diagnosis_display as any;
  const shortRegion = (lead.region || '').split(',')[0].trim();
  const negocio = lead.name || lead.product;
  const actionTitle = (item.titulo || item.title || '').toLowerCase();

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const ci = display?.competitionIndex;
  const maps = display?.maps;
  const totalVol = display?.totalVolume || 0;

  // ─── Detect action type and build contextual prompt ───
  const contextBlock = `NEGÓCIO: ${negocio} (${lead.product}) em ${shortRegion}
Google Maps: ${maps?.found ? `★${maps.rating} · ${maps.reviewCount} avaliações` : 'não encontrado'}
Concorrentes: ${ci?.activeCompetitors || '?'} mapeados
Buscas/mês: ${totalVol.toLocaleString('pt-BR')}
Ação: "${item.titulo || item.title}"
Por quê: "${item.descricao || item.description}"`;

  let prompt: string;

  if (/responder.*review|responder.*avalia/i.test(actionTitle)) {
    // ─── REVIEWS: gerar respostas prontas ───
    prompt = `${contextBlock}

Você é um especialista em reputação online. O negócio "${negocio}" tem ${maps?.reviewCount || 0} avaliações no Google Maps com nota ★${maps?.rating || '?'}.

Gere 10 RESPOSTAS PRONTAS para reviews do Google Maps que o dono pode copiar e colar. Cubra:
- 3 respostas para avaliações 5 estrelas (agradecimento personalizado)
- 3 respostas para avaliações 4 estrelas (agradecimento + convite para voltar)
- 2 respostas para avaliações 3 estrelas (empatia + compromisso de melhoria)
- 2 respostas para avaliações 1-2 estrelas (pedido de desculpas + solução + contato)

Cada resposta deve:
- Mencionar o nome do negócio "${negocio}"
- Ser personalizada (não genérica)
- Ter 2-4 frases
- Tom profissional mas humano

JSON: {"type":"review_responses","title":"Respostas para avaliações do Google","items":[{"rating":5,"context":"Cliente elogiou o produto/serviço","response":"texto pronto para copiar"},...],"tips":["dica prática 1","dica prática 2"]}`;

  } else if (/foto|imagem|visual/i.test(actionTitle)) {
    // ─── FOTOS: checklist de fotos necessárias ───
    prompt = `${contextBlock}

Você é um fotógrafo profissional especializado em negócios locais. O negócio "${negocio}" (${lead.product}) precisa melhorar suas fotos no Google Maps.

Gere um CHECKLIST DE FOTOS que o dono deve tirar e publicar. Para cada foto:
- O que fotografar (específico para ${lead.product})
- Enquadramento e iluminação ideal
- Dica prática de como captar com celular

Cubra: fachada, interior, equipe, produto/serviço principal, detalhes, ambiente, bastidores.

JSON: {"type":"photo_checklist","title":"Fotos para o perfil do Google Maps","items":[{"foto":"Fachada do estabelecimento","como_captar":"Tire de frente, durante o dia, com a placa visível...","dica":"Use modo HDR do celular para equilibrar sombras"},...],"tips":["dica geral 1","dica geral 2"]}`;

  } else if (/qr\s*code|pesquisa|feedback|nps/i.test(actionTitle)) {
    // ─── QR CODE / PESQUISA: passo-a-passo prático ───
    prompt = `${contextBlock}

Você é um especialista em experiência do cliente. O negócio "${negocio}" quer implementar um sistema de coleta de feedback/avaliações.

Gere um GUIA PRÁTICO completo:
1. Como gerar o QR code (ferramenta gratuita, passo-a-passo)
2. Onde colocar (locais estratégicos no estabelecimento)
3. O que perguntar (perguntas prontas)
4. Como analisar as respostas
5. Como transformar feedback em ação

JSON: {"type":"practical_guide","title":"Guia: Sistema de feedback com QR Code","steps":[{"step":"1. Gerar QR Code","detail":"Acesse google.com/maps, busque seu negócio, clique em Compartilhar...","tools":"Google Maps, QR Code Generator (gratuito)"},...],"templates":["texto pronto 1 para plaquinha","texto pronto 2"],"tips":["dica 1","dica 2"]}`;

  } else if (/instagram|perfil|bio|post|stories|reels/i.test(actionTitle)) {
    // ─── INSTAGRAM: bio + primeiros posts ───
    prompt = `${contextBlock}

Você é um social media manager especialista em negócios locais. O negócio "${negocio}" (${lead.product}) precisa configurar/melhorar seu Instagram.

Gere:
1. BIO PRONTA (150 chars max) com localização, proposta de valor e CTA
2. Nome de usuário sugerido (3 opções)
3. 5 PRIMEIROS POSTS com legenda completa + hashtags + sugestão de visual
4. Calendário sugerido (dia e horário para cada post)

Os posts devem seguir arco: apresentação → produto → bastidores → prova social → oferta.

JSON: {"type":"instagram_setup","title":"Setup do Instagram","bio":"bio pronta","username_options":["opção1","opção2","opção3"],"posts":[{"order":1,"theme":"Apresentação","caption":"legenda completa","hashtags":["#tag1"],"visual":"descrição da foto/vídeo","best_day":"segunda 19h"},...],"tips":["dica 1","dica 2"]}`;

  } else if (/site|página|landing|cardápio|menu/i.test(actionTitle)) {
    // ─── SITE: estrutura + textos prontos ───
    prompt = `${contextBlock}

Você é um web designer especialista em sites para negócios locais. O negócio "${negocio}" (${lead.product}) precisa criar um site simples.

Gere a ESTRUTURA COMPLETA do site com textos prontos:
1. Página inicial: headline, sub-headline, CTA
2. Sobre: texto institucional (200 palavras)
3. Serviços/Cardápio: estrutura de categorias
4. Contato: informações essenciais
5. SEO: title tag, meta description, palavras-chave

Todos os textos devem estar prontos para copiar e colar.

JSON: {"type":"site_structure","title":"Estrutura do site","pages":[{"page":"Início","headline":"...","subheadline":"...","cta":"...","body":"texto completo"},...],"seo":{"title_tag":"...","meta_description":"...","keywords":["..."]},"tips":["dica 1","dica 2"]}`;

  } else if (/google|maps|ficha|título|descri[cç]/i.test(actionTitle)) {
    // ─── GOOGLE MAPS: textos para o perfil ───
    prompt = `${contextBlock}

Você é um especialista em Google Meu Negócio. O negócio "${negocio}" (${lead.product}) precisa otimizar seu perfil.

Gere TEXTOS PRONTOS para o perfil:
1. Título otimizado (inclua categoria + localização)
2. Descrição do negócio (750 chars, com palavras-chave)
3. 5 Posts do Google Business (1 por semana)
4. Categorias sugeridas (principal + secundárias)
5. Atributos recomendados

JSON: {"type":"maps_optimization","title":"Otimização do Google Maps","profile":{"title":"...","description":"...","categories":["principal","secundária1"],"attributes":["Wi-Fi","Estacionamento"]},"posts":[{"title":"...","body":"...","cta":"Saiba mais"},...],"tips":["dica 1","dica 2"]}`;

  } else if (/youtube|canal|vídeo|video|roteiro/i.test(actionTitle)) {
    // ─── YOUTUBE: roteiros prontos ───
    prompt = `${contextBlock}

Você é um roteirista de conteúdo para YouTube especializado em negócios locais.

Gere uma SÉRIE DE 5 VÍDEOS com roteiros semi-prontos:
- Cada vídeo: título, duração sugerida, gancho (primeiros 10s), roteiro (bullet points), CTA
- Temas conectados ao negócio "${negocio}" e ao segmento "${lead.product}"
- Formato: educativo + demonstrativo (mostrar o dia-a-dia)

JSON: {"type":"youtube_series","title":"Série YouTube: ${negocio}","videos":[{"order":1,"title":"...","duration":"3-5 min","hook":"primeiros 10 segundos","script_points":["ponto 1","ponto 2"],"cta":"...","thumbnail_idea":"..."},...],"tips":["dica 1","dica 2"]}`;

  } else if (/whatsapp|mensag|comunica/i.test(actionTitle)) {
    // ─── WHATSAPP: templates de mensagem ───
    prompt = `${contextBlock}

Você é um especialista em comunicação por WhatsApp para negócios locais.

Gere 8 TEMPLATES DE MENSAGEM prontos para copiar:
1. Boas-vindas (primeiro contato)
2. Confirmação de agendamento/pedido
3. Lembrete (24h antes)
4. Pós-atendimento (pedido de feedback)
5. Promoção/oferta especial
6. Reativação de cliente inativo
7. Resposta a dúvida frequente
8. Encerramento de atendimento

JSON: {"type":"whatsapp_templates","title":"Templates WhatsApp","templates":[{"scenario":"Boas-vindas","message":"texto pronto","when_to_use":"Quando cliente entra em contato pela primeira vez"},...],"tips":["dica 1","dica 2"]}`;

  } else {
    // ─── GENÉRICO: guia prático de execução ───
    prompt = `${contextBlock}

Você é um consultor de marketing local. O dono do negócio "${negocio}" precisa executar esta ação: "${item.titulo || item.title}".

Gere um GUIA PRÁTICO DE EXECUÇÃO com:
1. 5-8 passos detalhados (cada passo = o que fazer + como fazer + quanto tempo leva)
2. Templates/textos prontos para copiar (quando aplicável)
3. Ferramentas recomendadas (gratuitas quando possível)
4. Erros comuns a evitar
5. Como medir o resultado

NÃO gere blog post ou post de Instagram. Gere o COMO FAZER da ação.

JSON: {"type":"practical_guide","title":"Guia: ${item.titulo || item.title}","steps":[{"step":"1. Passo","detail":"Explicação detalhada de como fazer","time":"15 min","tools":"ferramenta X (gratuita)"},...],"templates":["texto pronto 1"],"tips":["dica 1","dica 2"]}`;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      temperature: 0.5,
      system: 'Responda APENAS com JSON válido. Gere conteúdo PRÁTICO e ACIONÁVEL — o dono do negócio precisa poder copiar, colar e executar.',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content.filter(c => c.type === 'text').map(c => c.text).join('');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const content = JSON.parse(start >= 0 ? raw.slice(start, end + 1) : raw);

    // Update item in checklist JSONB
    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      content_generated: true,
      generated_content: content,
      // Keep legacy fields for backward compat
      generated_blog: content.type === 'blog' ? content : null,
      generated_instagram: content.type === 'instagram' ? content : null,
    };

    await supabase.from('checklists').update({ items: updatedItems }).eq('lead_id', leadId);

    return NextResponse.json({ ok: true, content });
  } catch (err) {
    console.error('[PlanContent] Generation failed:', (err as Error).message);
    return NextResponse.json({ error: 'Content generation failed', detail: (err as Error).message }, { status: 500 });
  }
}
