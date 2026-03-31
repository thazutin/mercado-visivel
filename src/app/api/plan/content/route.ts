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

  const prompt = `Você é um especialista em marketing local para "${lead.product}" em ${shortRegion}.
Negócio: ${negocio}
Score atual: ${display?.influencePercent || 0}/100
Principais gaps: ${display?.influenceBreakdown4D ? `D1=${display.influenceBreakdown4D.d1_descoberta || 0} D2=${display.influenceBreakdown4D.d2_credibilidade || 0} D3=${display.influenceBreakdown4D.d3_presenca || 0}` : 'N/A'}

Item do plano: "${item.titulo || item.title}"
Descrição: "${item.descricao || item.description}"
Keywords: ${(item.keywords || []).join(', ') || 'N/A'}
Gancho: "${item.content_hook || ''}"

${contentType === 'blog' || contentType === 'both' ? `
Gere um BLOG POST:
- Título SEO (max 60 chars)
- Meta description (max 155 chars)
- Texto de 300-500 palavras em primeira pessoa do negócio
- Tom direto e prático, sem jargão de marketing
- Use as keywords naturalmente no texto
- Conecte à realidade local de ${shortRegion}
` : ''}
${contentType === 'instagram' || contentType === 'both' ? `
Gere um POST DE INSTAGRAM:
- Legenda de até 150 palavras
- 5 hashtags relevantes
- Sugestão de visual (1 frase descrevendo a imagem ideal)
- Hook forte na primeira linha
- Tom próximo, como se falasse com vizinhos
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
      temperature: 0.3,
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
