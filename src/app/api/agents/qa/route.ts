import { NextRequest, NextResponse } from 'next/server';
import { runDataChecks, runVisualChecks, type CheckResult } from '@/lib/agents/qa-agent';

export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '');
  const internalSecret = req.headers.get('x-internal-secret');
  return (
    cronSecret === process.env.CRON_SECRET ||
    internalSecret === process.env.INTERNAL_API_SECRET
  );
}

async function sendQAEmail(subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nelson QA <entrega@virolocal.com>',
      to: 'thazutin@gmail.com',
      subject,
      html,
    }),
  });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[QA Agent] Starting full QA run...');
  const t0 = Date.now();

  // Run data checks
  const { checks: dataChecks, testLeadId } = await runDataChecks();
  console.log(`[QA Agent] Data checks done: ${dataChecks.length} checks`);

  // Run visual checks
  const visualChecks = await runVisualChecks();
  console.log(`[QA Agent] Visual checks done: ${visualChecks.length} checks`);

  const allChecks = [...dataChecks, ...visualChecks];
  const passed = allChecks.filter(c => c.status === 'pass').length;
  const failed = allChecks.filter(c => c.status === 'fail').length;
  const warned = allChecks.filter(c => c.status === 'warn').length;
  const skipped = allChecks.filter(c => c.status === 'skip').length;
  const totalMs = Date.now() - t0;

  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  // Build email
  const statusIcon = failed > 0 ? '🚨' : '✅';
  const subject = failed > 0
    ? `🚨 QA Virô — ${failed} falha${failed > 1 ? 's' : ''} detectada${failed > 1 ? 's' : ''} · ${timestamp}`
    : `✅ QA Virô — tudo ok · ${timestamp}`;

  const checkRows = allChecks.map(c => {
    const icon = c.status === 'pass' ? '✅' : c.status === 'fail' ? '❌' : c.status === 'warn' ? '⚠️' : '⏭️';
    const color = c.status === 'pass' ? '#1D9E75' : c.status === 'fail' ? '#E24B4A' : c.status === 'warn' ? '#CF8523' : '#888';
    return `<tr style="border-bottom:1px solid #E8E4DE;">
      <td style="padding:10px 8px;font-size:13px;">${icon} ${c.name}</td>
      <td style="padding:10px 8px;font-size:12px;color:${color};font-weight:600;">${c.status.toUpperCase()}</td>
      <td style="padding:10px 8px;font-size:12px;color:#888;">${c.detail}</td>
    </tr>`;
  }).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto;background:#F7F5F2;padding:32px;">
      <p style="font-size:22px;font-weight:700;color:#161618;margin:0 0 4px;">${statusIcon} QA Report</p>
      <p style="font-size:13px;color:#888;margin:0 0 24px;">${timestamp} · ${(totalMs / 1000).toFixed(1)}s total</p>

      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="background:#E1F5EE;border-radius:8px;padding:16px;flex:1;text-align:center;">
          <p style="font-size:24px;font-weight:700;color:#1D9E75;margin:0;">${passed}</p>
          <p style="font-size:11px;color:#0F6E56;margin:4px 0 0;">passed</p>
        </div>
        <div style="background:#FCEBEB;border-radius:8px;padding:16px;flex:1;text-align:center;">
          <p style="font-size:24px;font-weight:700;color:#E24B4A;margin:0;">${failed}</p>
          <p style="font-size:11px;color:#A32D2D;margin:4px 0 0;">failed</p>
        </div>
        <div style="background:#FAEEDA;border-radius:8px;padding:16px;flex:1;text-align:center;">
          <p style="font-size:24px;font-weight:700;color:#CF8523;margin:0;">${warned}</p>
          <p style="font-size:11px;color:#854F0B;margin:4px 0 0;">warnings</p>
        </div>
        <div style="background:#F0EDE8;border-radius:8px;padding:16px;flex:1;text-align:center;">
          <p style="font-size:24px;font-weight:700;color:#888;margin:0;">${skipped}</p>
          <p style="font-size:11px;color:#666;margin:4px 0 0;">skipped</p>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#161618;">
          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#888;">CHECK</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#888;">STATUS</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#888;">DETALHE</th>
        </tr></thead>
        <tbody>${checkRows}</tbody>
      </table>

      <p style="font-size:12px;color:#aaa;margin:24px 0 0;text-align:center;">Virô QA Agent · automático · 2x/dia</p>
    </div>
  `;

  await sendQAEmail(subject, html);
  console.log(`[QA Agent] Report sent. ${passed} pass, ${failed} fail, ${warned} warn, ${skipped} skip`);

  return NextResponse.json({
    ok: true,
    timestamp,
    totalMs,
    summary: { passed, failed, warned, skipped },
    checks: allChecks,
    testLeadId,
  });
}
