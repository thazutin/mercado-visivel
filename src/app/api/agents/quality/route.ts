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

async function sendQualityEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nelson <entrega@virolocal.com>',
      to,
      subject,
      html,
    }),
  });
}

interface Issue {
  leadId: string;
  negocio: string;
  segmento: string;
  cidade: string;
  createdAt: string;
  problems: string[];
  severity: 'critical' | 'warning';
  url: string;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[QualityAgent] Iniciando verificação diária...');

  const supabase = getSupabase();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, name, product, region, status, created_at, plan_status, diagnosis_display')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (leadsError) {
    console.error('[QualityAgent] Erro ao buscar leads:', leadsError);
    return NextResponse.json({ error: leadsError.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    console.log('[QualityAgent] Nenhum lead nas últimas 48h');
    return NextResponse.json({ ok: true, checked: 0, issues: 0 });
  }

  console.log(`[QualityAgent] Verificando ${leads.length} leads...`);

  const leadIds = leads.map(l => l.id);

  const { data: diagnoses } = await supabase
    .from('diagnoses')
    .select('lead_id, macro_context')
    .in('lead_id', leadIds);

  const { data: checklists } = await supabase
    .from('checklists')
    .select('lead_id')
    .in('lead_id', leadIds);

  const checklistLeadIds = new Set((checklists || []).map(c => c.lead_id));
  const diagMap = new Map((diagnoses || []).map(d => [d.lead_id, d]));

  const issues: Issue[] = [];

  for (const lead of leads) {
    const problems: string[] = [];
    const display = lead.diagnosis_display as any;
    const proj = display?.projecaoFinanceira;
    const diag = diagMap.get(lead.id);
    const hasChecklist = checklistLeadIds.has(lead.id);

    const ageMinutes = (Date.now() - new Date(lead.created_at).getTime()) / 60000;

    // 1. Pipeline travado
    if (lead.status === 'processing' && ageMinutes > 10) {
      problems.push(`Pipeline travado há ${Math.round(ageMinutes)} min (status=processing)`);
    }

    // 2. Lead done sem diagnóstico
    if (lead.status === 'done' && !display) {
      problems.push('Lead status=done mas sem diagnosis_display');
    }

    // 3. familiasGap > familiasTotal
    if (proj) {
      const familiasTotal = display?.audiencia?.audienciaTarget || 0;
      if (proj.familiasGap > familiasTotal && familiasTotal > 0) {
        problems.push(`familiasGap (${proj.familiasGap}) > audienciaTarget (${familiasTotal})`);
      }
      if (proj.familiasGap <= 0) {
        problems.push(`familiasGap = ${proj.familiasGap} — hero mostrará "+0"`);
      }
      if (proj.familiasAtual === proj.familiasPotencial && proj.familiasAtual > 0) {
        problems.push(`familiasAtual = familiasPotencial = ${proj.familiasAtual}`);
      }
    }

    // 4. Score zerado
    if (display?.influenceBreakdown4D) {
      const bd = display.influenceBreakdown4D;
      if (bd.d1_descoberta === 0 && bd.d2_credibilidade === 0 && bd.d3_presenca === 0) {
        problems.push('Score 0 em todos os pilares');
      }
    }

    // 5. plan_status travado
    if (lead.plan_status === 'generating' && ageMinutes > 20) {
      problems.push(`plan_status=generating há ${Math.round(ageMinutes)} min`);
    }

    // 6. Plano ready sem checklist
    if (lead.plan_status === 'ready' && !hasChecklist) {
      problems.push('plan_status=ready mas sem checklists');
    }

    // 7. macro_context fallback
    const macro = diag?.macro_context as any;
    if (macro?.summary && (
      macro.summary.includes('não disponível') ||
      macro.summary.includes('em breve') ||
      macro.summary.length < 50
    )) {
      problems.push('macro_context com fallback genérico');
    }

    // 8. Instagram broken
    if (display?.instagram?.dataAvailable && display?.instagram?.followers === 0) {
      problems.push('Instagram dataAvailable=true mas followers=0');
    }

    if (problems.length > 0) {
      const severity: 'critical' | 'warning' = problems.some(p =>
        p.includes('travado') || p.includes('Score 0') || p.includes('familiasGap')
      ) ? 'critical' : 'warning';

      issues.push({
        leadId: lead.id,
        negocio: lead.name || lead.product || 'Sem nome',
        segmento: lead.product || '',
        cidade: lead.region?.split(',')[0]?.trim() || '',
        createdAt: new Date(lead.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        problems,
        severity,
        url: `https://virolocal.com/resultado/${lead.id}`,
      });
    }
  }

  console.log(`[QualityAgent] ${leads.length} leads verificados, ${issues.length} com problemas`);

  // Síntese com Claude
  let synthesis = '';
  if (issues.length > 0) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const issuesSummary = issues.map(i =>
        `- ${i.negocio} (${i.segmento}): ${i.problems.join('; ')}`
      ).join('\n');

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Agente de qualidade do Virô. Analise estes problemas dos últimos diagnósticos:
1. Padrão recorrente?
2. Problema mais crítico?
3. Hipótese de root cause?

${issuesSummary}

Responda em 3-4 frases diretas.`,
        }],
      });
      synthesis = response.content.filter(c => c.type === 'text').map(c => c.text).join('');
    } catch (err) {
      console.warn('[QualityAgent] Síntese falhou:', err);
      synthesis = '';
    }
  }

  // Email
  const criticals = issues.filter(i => i.severity === 'critical');
  const warnings = issues.filter(i => i.severity === 'warning');

  if (issues.length === 0) {
    await sendQualityEmail(
      'thazutin@gmail.com',
      `✅ Qualidade Virô — ${leads.length} diagnósticos OK`,
      `<p style="font-family:sans-serif;color:#161618;"><strong>${leads.length} diagnósticos</strong> nas últimas 48h — nenhum problema detectado.</p><p style="font-family:sans-serif;color:#888;font-size:13px;">Virô Quality Agent · ${new Date().toLocaleDateString('pt-BR')}</p>`,
    );
  } else {
    const issueRows = issues.map(i => `
      <tr style="border-bottom:1px solid #E8E4DE;">
        <td style="padding:12px 8px;font-family:sans-serif;font-size:13px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i.severity === 'critical' ? '#E24B4A' : '#CF8523'};margin-right:6px;vertical-align:middle;"></span>
          <a href="${i.url}" style="color:#161618;font-weight:600;text-decoration:none;">${i.negocio}</a><br>
          <span style="color:#888;font-size:12px;">${i.segmento} · ${i.cidade} · ${i.createdAt}</span>
        </td>
        <td style="padding:12px 8px;font-family:sans-serif;font-size:12px;color:#444;">${i.problems.map(p => `• ${p}`).join('<br>')}</td>
      </tr>`).join('');

    await sendQualityEmail(
      'thazutin@gmail.com',
      `⚠️ Qualidade Virô — ${criticals.length} críticos, ${warnings.length} avisos`,
      `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;background:#F7F5F2;padding:32px;">
        <p style="font-size:20px;font-weight:700;color:#161618;margin:0 0 4px;">Relatório de Qualidade</p>
        <p style="font-size:13px;color:#888;margin:0 0 24px;">${leads.length} diagnósticos · últimas 48h · ${new Date().toLocaleDateString('pt-BR')}</p>
        <div style="display:flex;gap:12px;margin-bottom:24px;">
          <div style="background:#FCEBEB;border-radius:8px;padding:16px 20px;flex:1;"><p style="font-size:24px;font-weight:700;color:#E24B4A;margin:0;">${criticals.length}</p><p style="font-size:12px;color:#A32D2D;margin:4px 0 0;">críticos</p></div>
          <div style="background:#FAEEDA;border-radius:8px;padding:16px 20px;flex:1;"><p style="font-size:24px;font-weight:700;color:#CF8523;margin:0;">${warnings.length}</p><p style="font-size:12px;color:#854F0B;margin:4px 0 0;">avisos</p></div>
          <div style="background:#E1F5EE;border-radius:8px;padding:16px 20px;flex:1;"><p style="font-size:24px;font-weight:700;color:#1D9E75;margin:0;">${leads.length - issues.length}</p><p style="font-size:12px;color:#0F6E56;margin:4px 0 0;">ok</p></div>
        </div>
        ${synthesis ? `<div style="background:white;border-left:3px solid #CF8523;border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px;"><p style="font-size:11px;font-weight:600;color:#CF8523;letter-spacing:0.08em;margin:0 0 8px;">ANÁLISE DO NELSON</p><p style="font-size:14px;color:#161618;margin:0;line-height:1.6;">${synthesis}</p></div>` : ''}
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;">
          <thead><tr style="background:#161618;"><th style="padding:12px 8px;text-align:left;font-size:11px;color:#888;letter-spacing:0.08em;font-weight:500;">NEGÓCIO</th><th style="padding:12px 8px;text-align:left;font-size:11px;color:#888;letter-spacing:0.08em;font-weight:500;">PROBLEMAS</th></tr></thead>
          <tbody>${issueRows}</tbody>
        </table>
        <p style="font-size:12px;color:#aaa;margin:24px 0 0;text-align:center;">Virô Quality Agent · automático · diário</p>
      </div>`,
    );
  }

  return NextResponse.json({
    ok: true,
    checked: leads.length,
    issues: issues.length,
    criticals: criticals.length,
  });
}
