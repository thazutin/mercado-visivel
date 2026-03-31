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

async function sendProductEmail(to: string, subject: string, html: string) {
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

  console.log('[ProductAgent] Iniciando briefing semanal...');
  const supabase = getSupabase();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // ── SEÇÃO 1 — Leads e conversão ────────────────────────────────────────

  const [
    { data: leadsThisWeek },
    { data: leadsLastWeek },
    { data: paidThisWeek },
    { data: paidLastWeek },
  ] = await Promise.all([
    supabase.from('leads').select('id, product, region, status, plan_status, created_at, client_type')
      .gte('created_at', weekAgo.toISOString()),
    supabase.from('leads').select('id, plan_status, created_at')
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString()),
    supabase.from('leads').select('id, product, region')
      .gte('created_at', weekAgo.toISOString())
      .eq('plan_status', 'ready'),
    supabase.from('leads').select('id')
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString())
      .eq('plan_status', 'ready'),
  ]);

  const totalThisWeek = leadsThisWeek?.length || 0;
  const totalLastWeek = leadsLastWeek?.length || 0;
  const paidThisWeekCount = paidThisWeek?.length || 0;
  const paidLastWeekCount = paidLastWeek?.length || 0;

  const conversionThisWeek = totalThisWeek > 0 ? ((paidThisWeekCount / totalThisWeek) * 100).toFixed(1) : '0';
  const conversionLastWeek = totalLastWeek > 0 ? ((paidLastWeekCount / totalLastWeek) * 100).toFixed(1) : '0';

  // Segmentos mais comuns
  const segmentDist: Record<string, number> = {};
  for (const lead of leadsThisWeek || []) {
    const seg = lead.product?.split(' ').slice(0, 3).join(' ') || 'desconhecido';
    segmentDist[seg] = (segmentDist[seg] || 0) + 1;
  }
  const topSegments = Object.entries(segmentDist).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // plan_status distribution
  const planStatusDist: Record<string, number> = {};
  for (const lead of leadsThisWeek || []) {
    const ps = lead.plan_status || 'none';
    planStatusDist[ps] = (planStatusDist[ps] || 0) + 1;
  }

  // ── SEÇÃO 2 — Saúde do produto ─────────────────────────────────────────

  const stuckLeads = (leadsThisWeek || []).filter(l => {
    if (l.status !== 'processing') return false;
    const ageMin = (now.getTime() - new Date(l.created_at).getTime()) / 60000;
    return ageMin > 10;
  });

  const { data: diagnosesThisWeek } = await supabase
    .from('diagnoses').select('lead_id, macro_context')
    .gte('created_at', weekAgo.toISOString());

  const macroFallbackCount = (diagnosesThisWeek || []).filter(d => {
    const mc = d.macro_context as any;
    return mc?.summary?.includes('não disponível') || mc?.summary?.length < 50;
  }).length;

  // ── SEÇÃO 3 — Comportamento pós-pagamento ──────────────────────────────

  const { data: checklistsThisWeek } = await supabase
    .from('checklists').select('lead_id, completed, dimensao')
    .gte('created_at', weekAgo.toISOString());

  let totalItems = checklistsThisWeek?.length || 0;
  let completedItems = (checklistsThisWeek || []).filter(c => c.completed).length;
  const completionRate = totalItems > 0 ? ((completedItems / totalItems) * 100).toFixed(1) : '0';

  // Por pilar
  const pilarDist: Record<string, { total: number; completed: number }> = {};
  for (const item of checklistsThisWeek || []) {
    const pilar = item.dimensao || 'sem_pilar';
    if (!pilarDist[pilar]) pilarDist[pilar] = { total: 0, completed: 0 };
    pilarDist[pilar].total++;
    if (item.completed) pilarDist[pilar].completed++;
  }

  // ── SEÇÃO 4 — Emails enviados ──────────────────────────────────────────

  let emailsSent = 0;
  try {
    const resendRes = await fetch('https://api.resend.com/emails?limit=100', {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (resendRes.ok) {
      const resendData = await resendRes.json();
      emailsSent = ((resendData.data || []) as any[]).filter((e: any) => {
        const sent = new Date(e.created_at);
        return sent >= weekAgo && sent <= now;
      }).length;
    }
  } catch { /* ignore */ }

  // ── SÍNTESE COM CLAUDE SONNET ──────────────────────────────────────────

  let synthesis: { resumo: string; prioridades: Array<{ titulo: string; problema: string; impacto: string; prompt_claude_code: string }> } | null = null;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const contextForClaude = `Você é o agente de produto do Virô, SaaS de diagnóstico de mercado local.
Produto: diagnóstico gratuito (~40s) + plano pago R$497 (15-20 atividades).

DADOS DA SEMANA (${weekAgo.toLocaleDateString('pt-BR')} a ${now.toLocaleDateString('pt-BR')}):
- Leads: ${totalThisWeek} (anterior: ${totalLastWeek}, delta: ${totalThisWeek - totalLastWeek > 0 ? '+' : ''}${totalThisWeek - totalLastWeek})
- Conversão: ${conversionThisWeek}% (anterior: ${conversionLastWeek}%)
- Pagamentos: ${paidThisWeekCount} (anterior: ${paidLastWeekCount})
- Plan status: ${JSON.stringify(planStatusDist)}
- Top segmentos: ${topSegments.map(([s, n]) => `${s} (${n})`).join(', ')}
- Leads travados: ${stuckLeads.length}
- Macro fallback: ${macroFallbackCount}/${diagnosesThisWeek?.length || 0}
- Emails: ${emailsSent}
- Checklists: ${totalItems} itens, ${completedItems} concluídos (${completionRate}%)
- Por pilar: ${JSON.stringify(pilarDist)}

Analise e produza:
1. RESUMO: 3-4 frases sobre o estado do produto. Direto — o que está bem, o que está mal.
2. PRIORIDADES: 3 prioridades ordenadas por impacto. Para cada:
   - titulo (max 8 palavras)
   - problema (1 frase com dados)
   - impacto (1 frase)
   - prompt_claude_code: prompt COMPLETO para colar no Claude Code e implementar

JSON apenas:
{"resumo":"...","prioridades":[{"titulo":"...","problema":"...","impacto":"...","prompt_claude_code":"..."}]}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: contextForClaude }],
    });
    const text = response.content.filter(c => c.type === 'text').map(c => c.text).join('');
    synthesis = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  } catch (err) {
    console.error('[ProductAgent] Síntese falhou:', err);
  }

  // ── EMAIL ───────────────────────────────────────────────────────────────

  const deltaLeads = totalThisWeek - totalLastWeek;
  const deltaConv = parseFloat(conversionThisWeek) - parseFloat(conversionLastWeek);

  const metricCards = [
    { label: 'Leads', value: String(totalThisWeek), delta: deltaLeads, pct: false },
    { label: 'Conversão', value: conversionThisWeek + '%', delta: deltaConv, pct: true },
    { label: 'Pagamentos', value: String(paidThisWeekCount), delta: paidThisWeekCount - paidLastWeekCount, pct: false },
    { label: 'Itens concluídos', value: completionRate + '%', delta: null, pct: false },
  ].map(m => `<div style="background:white;border-radius:8px;padding:16px;text-align:center;">
    <p style="font-size:22px;font-weight:700;color:#161618;margin:0;">${m.value}</p>
    <p style="font-size:11px;color:#888;margin:4px 0 0;">${m.label}</p>
    ${m.delta !== null ? `<p style="font-size:11px;margin:4px 0 0;color:${m.delta > 0 ? '#1D9E75' : m.delta < 0 ? '#E24B4A' : '#888'}">${m.delta > 0 ? '+' : ''}${m.pct ? m.delta.toFixed(1) + '%' : m.delta} vs anterior</p>` : ''}
  </div>`).join('');

  const priorityBlocks = (synthesis?.prioridades || []).map((p, i) => {
    const colors = ['#E24B4A', '#CF8523', '#1D9E75'];
    const bgs = ['#FCEBEB', '#FAEEDA', '#E1F5EE'];
    const fgs = ['#A32D2D', '#854F0B', '#0F6E56'];
    return `<div style="background:white;border-radius:8px;padding:20px;margin-bottom:16px;border-left:3px solid ${colors[i]};">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="background:${bgs[i]};color:${fgs[i]};font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;">#${i + 1}</span>
        <span style="font-size:16px;font-weight:700;color:#161618;">${p.titulo}</span>
      </div>
      <p style="font-size:13px;color:#444;margin:0 0 4px;"><strong>Problema:</strong> ${p.problema}</p>
      <p style="font-size:13px;color:#444;margin:0 0 16px;"><strong>Impacto:</strong> ${p.impacto}</p>
      <div style="background:#F7F5F2;border-radius:6px;padding:14px;">
        <p style="font-size:10px;font-weight:600;color:#CF8523;letter-spacing:0.08em;margin:0 0 8px;">PROMPT PARA O CLAUDE CODE</p>
        <pre style="font-size:11px;color:#444;margin:0;white-space:pre-wrap;font-family:monospace;line-height:1.6;">${p.prompt_claude_code}</pre>
      </div>
    </div>`;
  }).join('');

  const segmentRows = topSegments.map(([seg, count]) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F0EDE8;"><span style="font-size:13px;color:#444;">${seg}</span><span style="font-size:13px;font-weight:600;color:#161618;">${count}</span></div>`
  ).join('');

  await sendProductEmail(
    'thazutin@gmail.com',
    `📊 Produto Virô — semana de ${weekAgo.toLocaleDateString('pt-BR')}`,
    `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;background:#F7F5F2;padding:32px;">
      <p style="font-size:22px;font-weight:700;color:#161618;margin:0 0 4px;">Briefing Semanal de Produto</p>
      <p style="font-size:13px;color:#888;margin:0 0 28px;">${weekAgo.toLocaleDateString('pt-BR')} → ${now.toLocaleDateString('pt-BR')}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:24px;">${metricCards}</div>
      ${synthesis?.resumo ? `<div style="background:white;border-left:3px solid #CF8523;border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px;"><p style="font-size:11px;font-weight:600;color:#CF8523;letter-spacing:0.08em;margin:0 0 8px;">ANÁLISE DO NELSON</p><p style="font-size:14px;color:#161618;margin:0;line-height:1.6;">${synthesis.resumo}</p></div>` : ''}
      <div style="background:white;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="font-size:13px;font-weight:600;color:#161618;margin:0 0 12px;">SAÚDE DO PRODUTO</p>
        <table style="width:100%;font-size:13px;">
          <tr><td style="color:#888;padding:4px 0;">Leads travados</td><td style="text-align:right;font-weight:600;color:${stuckLeads.length > 0 ? '#E24B4A' : '#1D9E75'}">${stuckLeads.length}</td></tr>
          <tr><td style="color:#888;padding:4px 0;">Macro fallback</td><td style="text-align:right;font-weight:600;color:${macroFallbackCount > 0 ? '#CF8523' : '#1D9E75'}">${macroFallbackCount}/${diagnosesThisWeek?.length || 0}</td></tr>
          <tr><td style="color:#888;padding:4px 0;">Emails enviados</td><td style="text-align:right;font-weight:600;color:#161618;">${emailsSent}</td></tr>
          <tr><td style="color:#888;padding:4px 0;">Planos gerados</td><td style="text-align:right;font-weight:600;color:#161618;">${paidThisWeekCount}</td></tr>
        </table>
      </div>
      ${topSegments.length > 0 ? `<div style="background:white;border-radius:8px;padding:20px;margin-bottom:24px;"><p style="font-size:13px;font-weight:600;color:#161618;margin:0 0 12px;">TOP SEGMENTOS</p>${segmentRows}</div>` : ''}
      <p style="font-size:16px;font-weight:700;color:#161618;margin:0 0 16px;">3 Prioridades desta semana</p>
      ${priorityBlocks}
      <p style="font-size:12px;color:#aaa;margin:24px 0 0;text-align:center;">Virô Product Agent · semanal · segundas-feiras</p>
    </div>`,
  );

  console.log('[ProductAgent] Briefing enviado');

  return NextResponse.json({
    ok: true,
    period: { from: weekAgo.toISOString(), to: now.toISOString() },
    metrics: { leads: totalThisWeek, paid: paidThisWeekCount, conversion: conversionThisWeek, stuck: stuckLeads.length },
  });
}
