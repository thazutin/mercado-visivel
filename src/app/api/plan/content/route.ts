import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function POST(req: NextRequest) {
  const { leadId, itemIndex, contentType } = await req.json();
  if (!leadId || itemIndex == null || !contentType) {
    return NextResponse.json({ error: 'leadId, itemIndex and contentType required' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Load lead + checklist
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

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const ci = display?.competitionIndex;
  const aud = display?.audiencia;
  const totalVol = display?.totalVolume || 0;

  const prompt = `Você é um diretor de conteúdo especialista no mercado de "${lead.product}" em ${shortRegion}.

CONTEXTO DO NEGÓCIO:
- Nome: ${negocio}
- Posição competitiva: ${display?.influencePercent || 0}/100
- Visibilidade: ${display?.influenceBreakdown4D?.d1_descoberta || 0}/100
- Credibilidade: ${display?.influenceBreakdown4D?.d2_credibilidade || 0}/100
- Presença Digital: ${display?.influenceBreakdown4D?.d3_presenca || 0}/100
- Reputação: ${display?.influenceBreakdown4D?.d4_reputacao || 0}/100
${ci ? `- Concorrentes mapeados: ${ci.activeCompetitors} (mercado ${ci.label})` : ''}
${totalVol ? `- Buscas mensais no segmento: ${totalVol.toLocaleString('pt-BR')}` : ''}
${aud ? `- Audiência estimada: ${aud.audienciaTarget?.toLocaleString('pt-BR') || '?'} ${aud.targetProfile || 'pessoas'}` : ''}
${display?.maps?.rating ? `- Google Maps: ★${display.maps.rating} (${display.maps.reviewCount} avaliações)` : ''}

AÇÃO DO PLANO: "${item.titulo || item.title}"
POR QUÊ: "${item.descricao || item.description}"
Keywords: ${(item.keywords || []).join(', ') || 'N/A'}

${contentType === 'blog' || contentType === 'both' ? `
Gere um BLOG POST de alta qualidade:
- Título SEO (max 60 chars) que inclua a região
- Meta description (max 155 chars)
- Texto de 400-600 palavras em primeira pessoa do negócio
- OBRIGATÓRIO: cite pelo menos 2 dados reais (ex: "${totalVol} buscas/mês", "${ci?.activeCompetitors || '?'} concorrentes", "★${display?.maps?.rating || '?'}")
- Tom direto e prático — como um especialista explicando para um amigo
- Conecte à realidade local de ${shortRegion}
` : ''}
${contentType === 'instagram' || contentType === 'both' ? `
Gere um POST DE INSTAGRAM profissional:
- Legenda de até 200 palavras
- Hook forte: comece com um número real ou pergunta provocativa
- 5 hashtags regionais relevantes
- Sugestão de visual (1 frase descrevendo a imagem/vídeo ideal)
- CTA natural (não "clique no link da bio")
` : ''}

Retorne JSON:
{
  ${contentType === 'blog' || contentType === 'both' ? '"blog": {"title":"...","meta_description":"...","body":"..."},' : ''}
  ${contentType === 'instagram' || contentType === 'both' ? '"instagram": {"caption":"...","hashtags":["..."],"visual_suggestion":"..."}' : ''}
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.5,
      system: 'Responda APENAS com JSON válido.',
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
      generated_blog: content.blog || null,
      generated_instagram: content.instagram || null,
    };

    await supabase.from('checklists').update({ items: updatedItems }).eq('lead_id', leadId);

    return NextResponse.json({ ok: true, content });
  } catch (err) {
    console.error('[PlanContent] Generation failed:', (err as Error).message);
    return NextResponse.json({ error: 'Content generation failed', detail: (err as Error).message }, { status: 500 });
  }
}
