import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '');
  const internalSecret = req.headers.get('x-internal-secret');
  return (
    cronSecret === process.env.CRON_SECRET ||
    internalSecret === process.env.INTERNAL_API_SECRET
  );
}

async function sendContentEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: 'Nelson <entrega@virolocal.com>', to, subject, html }),
  });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[ContentAgent] Iniciando geração quinzenal...');
  const supabase = getSupabase();

  const now = new Date();
  const fortnightAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // ── COLETA DE INSUMOS ──────────────────────────────────────────────────

  const { data: recentLeads } = await supabase
    .from('leads')
    .select('id, product, region, client_type, plan_status, created_at, diagnosis_display')
    .gte('created_at', fortnightAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  // Segmentos
  const segmentCount: Record<string, number> = {};
  for (const lead of recentLeads || []) {
    const seg = lead.product || 'desconhecido';
    segmentCount[seg] = (segmentCount[seg] || 0) + 1;
  }
  const topSegments = Object.entries(segmentCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Casos interessantes (anonimizados)
  interface InterestingCase {
    segmento: string;
    cidade: string;
    score: number;
    pilarBaixo: string;
    scoreBaixo: number;
    pilarAlto: string;
    scoreAlto: number;
    familiasGap: number;
    buscasMensais: number;
  }
  const interestingCases: InterestingCase[] = [];

  for (const lead of recentLeads || []) {
    const display = lead.diagnosis_display as any;
    if (!display) continue;

    const bd = display.influenceBreakdown4D || display.influenceBreakdown;
    const proj = display.projecaoFinanceira;
    if (!bd || !proj) continue;

    const score = display.influencePercent || 0;
    const buscas = display.totalVolume || 0;
    const familiasGap = proj.familiasGap || 0;

    if (familiasGap < 50 || score === 0 || buscas < 30) continue;

    const pilares = [
      { nome: 'Descoberta', score: bd.d1_descoberta ?? bd.d1_discovery ?? 0 },
      { nome: 'Credibilidade', score: bd.d2_credibilidade ?? bd.d2_credibility ?? 0 },
      { nome: 'Cultura', score: bd.d3_presenca ?? bd.d3_reach ?? 0 },
    ];
    const sorted = [...pilares].sort((a, b) => a.score - b.score);
    if (sorted[sorted.length - 1].score - sorted[0].score < 15) continue;

    interestingCases.push({
      segmento: lead.product || 'negócio local',
      cidade: lead.region?.split(',')[0]?.trim() || 'cidade',
      score,
      pilarBaixo: sorted[0].nome,
      scoreBaixo: sorted[0].score,
      pilarAlto: sorted[sorted.length - 1].nome,
      scoreAlto: sorted[sorted.length - 1].score,
      familiasGap,
      buscasMensais: buscas,
    });
  }

  const bestCase = interestingCases.sort((a, b) =>
    (b.scoreAlto - b.scoreBaixo) - (a.scoreAlto - a.scoreBaixo)
  )[0] || null;

  const totalBuscasAnalisadas = (recentLeads || []).reduce((sum, l) => {
    return sum + ((l.diagnosis_display as any)?.totalVolume || 0);
  }, 0);

  // ── INSIGHTS DOS PLANOS PAGOS (conectar conteúdo ao plano) ────────────
  const paidLeadIds = (recentLeads || [])
    .filter(l => l.plan_status === 'ready')
    .map(l => l.id);

  let planInsights = '';
  if (paidLeadIds.length > 0) {
    const { data: plans } = await supabase
      .from('plans')
      .select('content')
      .in('lead_id', paidLeadIds.slice(0, 5))
      .eq('status', 'ready');

    if (plans && plans.length > 0) {
      const topActions = plans.flatMap((p: any) =>
        (p.content?.itensEstruturantes || []).slice(0, 3)
      ).map((item: any) => item.titulo || item.title || '').filter(Boolean).slice(0, 10);

      const topKeywords = plans.flatMap((p: any) =>
        (p.content?.itensEstruturantes || []).flatMap((item: any) => item.keywords || [])
      ).slice(0, 15);

      if (topActions.length > 0) {
        const uniqueKeywords = Array.from(new Set(topKeywords));
        planInsights = `
- Ações mais recomendadas nos planos: ${topActions.join(', ')}
- Keywords dos planos: ${uniqueKeywords.join(', ')}`;
      }
    }
  }

  // ── GERAÇÃO DOS 3 POSTS COM CLAUDE SONNET ─────────────────────────────

  const context = `Você é o ghostwriter do Thales Zutin, fundador do Virô (virolocal.com).
14 anos de experiência em marketing em multinacionais. Fundou Virô para dar a pequenos negócios a inteligência de mercado que só grandes empresas tinham.

VOZ: direto, sem jargão ("engajamento", "ROI"), baseado em dados reais, tem opinião, fala de execução não teoria. Tom: executivo que fundou startup.

DADOS REAIS (últimas 2 semanas):
- ${recentLeads?.length || 0} diagnósticos gerados
- Top segmentos: ${topSegments.map(([s, n]) => `${s} (${n})`).join(', ') || 'nenhum'}
- Buscas analisadas: ${totalBuscasAnalisadas.toLocaleString('pt-BR')}/mês
${bestCase ? `- Caso real: ${bestCase.segmento} em ${bestCase.cidade} — score ${bestCase.score}/100, ${bestCase.pilarAlto}: ${bestCase.scoreAlto} vs ${bestCase.pilarBaixo}: ${bestCase.scoreBaixo}, gap +${bestCase.familiasGap.toLocaleString('pt-BR')} pessoas, ${bestCase.buscasMensais.toLocaleString('pt-BR')} buscas/mês` : '- Nenhum caso com contraste suficiente esta quinzena'}${planInsights}

Gere 3 posts LinkedIn (JSON):

POST 1 — DADO DE MERCADO: número real → contexto → insight → provocação. Sem mencionar Virô.
POST 2 — CASO ANONIMIZADO: situação → dados → ação → resultado. Pode mencionar Virô no final.
POST 3 — INSIGHT CONTRAINTUITIVO: provocação → argumento com dado → conclusão acionável. Sem Virô.

REGRAS: max 1300 chars/post, max 3 hashtags, max 2 emojis, hook na 1a linha, parágrafos curtos, nunca começar com "Eu" ou "Hoje quero falar".

JSON apenas:
{"posts":[{"tipo":"dado_mercado","titulo":"...","hook":"1a linha","corpo":"texto completo","melhor_dia":"terça","melhor_horario":"8h"}]}`;

  let posts: Array<{
    tipo: string; titulo: string; hook: string; corpo: string;
    caracteres: number; melhor_dia: string; melhor_horario: string;
  }> = [];

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: context }],
    });
    const text = response.content.filter(c => c.type === 'text').map(c => c.text).join('');
    const parsed = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
    posts = (parsed.posts || []).map((p: any) => ({ ...p, caracteres: (p.corpo || '').length }));
  } catch (err) {
    console.error('[ContentAgent] Geração falhou:', err);
  }

  // ── EMAIL ───────────────────────────────────────────────────────────────

  const tipoLabel: Record<string, string> = {
    dado_mercado: '📊 Dado de Mercado',
    caso_uso: '🏪 Caso de Uso',
    caso_anonimizado: '🏪 Caso de Uso',
    insight_posicionamento: '💡 Insight',
    insight: '💡 Insight',
  };
  const corLabel: Record<string, string> = {
    dado_mercado: '#1D9E75',
    caso_uso: '#CF8523',
    caso_anonimizado: '#CF8523',
    insight_posicionamento: '#7F77DD',
    insight: '#7F77DD',
  };

  const postBlocks = posts.map((post) => `
    <div style="background:white;border-radius:8px;padding:24px;margin-bottom:20px;border-top:3px solid ${corLabel[post.tipo] || '#161618'};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <span style="font-size:13px;font-weight:600;color:${corLabel[post.tipo] || '#161618'};">${tipoLabel[post.tipo] || post.tipo}</span>
        <span style="font-size:11px;color:#888;">${post.melhor_dia} · ${post.melhor_horario} · ${post.caracteres} chars</span>
      </div>
      <p style="font-size:13px;font-weight:700;color:#161618;margin:0 0 12px;border-left:2px solid #E8E4DE;padding-left:10px;">${post.hook}</p>
      <div style="background:#F7F5F2;border-radius:6px;padding:16px;margin-bottom:16px;">
        <pre style="font-size:13px;color:#444;margin:0;white-space:pre-wrap;font-family:inherit;line-height:1.7;">${post.corpo}</pre>
      </div>
      <a href="https://www.linkedin.com/feed/" target="_blank" style="background:#0A66C2;color:white;font-size:12px;font-weight:600;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Publicar no LinkedIn →</a>
      <span style="font-size:11px;color:#aaa;margin-left:8px;">(copie o texto antes)</span>
    </div>
  `).join('');

  await sendContentEmail(
    'thazutin@gmail.com',
    `✍️ Conteúdo Virô — 3 posts prontos · ${now.toLocaleDateString('pt-BR')}`,
    `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;background:#F7F5F2;padding:32px;">
      <p style="font-size:22px;font-weight:700;color:#161618;margin:0 0 4px;">3 Posts para LinkedIn</p>
      <p style="font-size:13px;color:#888;margin:0 0 8px;">Dados reais do Virô · ${fortnightAgo.toLocaleDateString('pt-BR')} → ${now.toLocaleDateString('pt-BR')}</p>
      <p style="font-size:12px;color:#aaa;margin:0 0 28px;">${recentLeads?.length || 0} diagnósticos · ${totalBuscasAnalisadas.toLocaleString('pt-BR')} buscas/mês · top: ${topSegments[0]?.[0] || '—'}</p>
      ${postBlocks}
      <div style="background:#161618;border-radius:8px;padding:16px;text-align:center;margin-top:8px;">
        <p style="font-size:12px;color:#888;margin:0 0 4px;">Revise antes de publicar — rascunhos baseados em dados reais.</p>
        <p style="font-size:11px;color:#555;margin:0;">Virô Content Agent · quinzenal</p>
      </div>
    </div>`,
  );

  console.log(`[ContentAgent] ${posts.length} posts gerados e enviados`);

  return NextResponse.json({
    ok: true,
    posts: posts.length,
    insumos: { leads: recentLeads?.length || 0, casos: interestingCases.length, totalBuscas: totalBuscasAnalisadas },
  });
}
