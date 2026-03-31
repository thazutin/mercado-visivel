import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '');
  const internalSecret = req.headers.get('x-internal-secret');
  return (
    cronSecret === process.env.CRON_SECRET ||
    internalSecret === process.env.INTERNAL_API_SECRET
  );
}

async function sendCopyEmail(to: string, subject: string, html: string) {
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

interface CopyIssue {
  file: string;
  line: number;
  lineContent: string;
  term: string;
  replace: string;
  context: string;
  type: 'forbidden' | 'voice';
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CopyAgent] Iniciando verificação...');

  const rulesPath = join(process.cwd(), 'src/config/copy-rules.json');
  if (!existsSync(rulesPath)) {
    return NextResponse.json({ error: 'copy-rules.json não encontrado' }, { status: 500 });
  }
  const rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));

  const issues: CopyIssue[] = [];
  const checkedFiles: string[] = [];
  const missingFiles: string[] = [];

  for (const relPath of rules.files_to_check) {
    const fullPath = join(process.cwd(), relPath);

    if (!existsSync(fullPath)) {
      missingFiles.push(relPath);
      continue;
    }

    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    checkedFiles.push(relPath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Skip comments, imports, and agent-ignored lines
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('import') ||
        trimmed.includes('copy-rules') ||
        trimmed.includes('COPY_AGENT_IGNORE')
      ) continue;

      for (const rule of rules.forbidden) {
        const termLower = rule.term.toLowerCase();
        const lineLower = line.toLowerCase();

        // Only detect in string literals or JSX content
        const inString =
          lineLower.includes(`"${termLower}`) ||
          lineLower.includes(`'${termLower}`) ||
          lineLower.includes(`\`${termLower}`) ||
          lineLower.includes(`>${termLower}`);

        if (inString) {
          issues.push({
            file: relPath,
            line: lineNum,
            lineContent: line.trim().slice(0, 120),
            term: rule.term,
            replace: rule.replace || '',
            context: rule.context,
            type: 'forbidden',
          });
        }
      }
    }
  }

  console.log(`[CopyAgent] ${checkedFiles.length} arquivos, ${issues.length} issues`);

  // Claude synthesis
  let synthesis = '';
  if (issues.length > 0) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const issuesSummary = issues
        .slice(0, 20)
        .map(i => `- "${i.term}" em ${i.file}:${i.line}`)
        .join('\n');

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Agente de copy do Virô. Analise estas ocorrências de terminologia incorreta:
1. Qual arquivo tem mais regressões?
2. Há padrão (ex: sempre em emails, sempre em CTAs)?
3. Prioridade de correção?

${issuesSummary}

2-3 frases diretas.`,
        }],
      });
      synthesis = response.content.filter(c => c.type === 'text').map(c => c.text).join('');
    } catch (err) {
      console.warn('[CopyAgent] Síntese falhou:', err);
    }
  }

  // Email
  if (issues.length === 0) {
    await sendCopyEmail(
      'thazutin@gmail.com',
      `✅ Copy Virô — ${checkedFiles.length} arquivos OK`,
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
        <p style="font-size:18px;font-weight:700;color:#161618;margin:0 0 8px;">Copy consistente ✅</p>
        <p style="color:#888;font-size:13px;margin:0 0 16px;">${checkedFiles.length} arquivos verificados · nenhuma regressão detectada</p>
        <p style="color:#888;font-size:12px;">Virô Copy Agent · ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>`,
    );
  } else {
    const byFile = issues.reduce((acc, issue) => {
      if (!acc[issue.file]) acc[issue.file] = [];
      acc[issue.file].push(issue);
      return acc;
    }, {} as Record<string, CopyIssue[]>);

    const fileBlocks = Object.entries(byFile).map(([file, fileIssues]) => `
      <div style="margin-bottom:20px;">
        <p style="font-size:12px;font-family:monospace;background:#F0EDE8;padding:6px 10px;border-radius:4px;color:#444;margin:0 0 8px;">${file}</p>
        <table style="width:100%;border-collapse:collapse;">
          ${fileIssues.map(i => `
            <tr style="border-bottom:1px solid #F0EDE8;">
              <td style="padding:8px 4px;font-size:12px;color:#888;font-family:monospace;width:40px;">L${i.line}</td>
              <td style="padding:8px 4px;">
                <span style="background:#FCEBEB;color:#A32D2D;font-size:12px;padding:2px 6px;border-radius:4px;font-family:monospace;">"${i.term}"</span>
                ${i.replace ? `<span style="color:#888;font-size:12px;margin:0 4px;">→</span><span style="background:#E1F5EE;color:#0F6E56;font-size:12px;padding:2px 6px;border-radius:4px;font-family:monospace;">"${i.replace}"</span>` : '<span style="color:#888;font-size:12px;margin-left:4px;">(remover)</span>'}
                <br><span style="font-size:11px;color:#aaa;font-family:monospace;">${i.lineContent}</span>
              </td>
            </tr>
          `).join('')}
        </table>
      </div>
    `).join('');

    await sendCopyEmail(
      'thazutin@gmail.com',
      `⚠️ Copy Virô — ${issues.length} regressões em ${Object.keys(byFile).length} arquivos`,
      `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;background:#F7F5F2;padding:32px;">
        <p style="font-size:20px;font-weight:700;color:#161618;margin:0 0 4px;">Relatório de Copy</p>
        <p style="font-size:13px;color:#888;margin:0 0 24px;">${checkedFiles.length} arquivos · ${issues.length} regressões · ${new Date().toLocaleDateString('pt-BR')}</p>
        ${synthesis ? `<div style="background:white;border-left:3px solid #CF8523;border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px;"><p style="font-size:11px;font-weight:600;color:#CF8523;letter-spacing:0.08em;margin:0 0 8px;">ANÁLISE DO NELSON</p><p style="font-size:14px;color:#161618;margin:0;line-height:1.6;">${synthesis}</p></div>` : ''}
        <div style="background:white;border-radius:8px;padding:20px;">${fileBlocks}</div>
        <p style="font-size:12px;color:#aaa;margin:24px 0 0;text-align:center;">Virô Copy Agent · semanal · segundas-feiras</p>
      </div>`,
    );
  }

  const byFileCount = issues.reduce((acc, i) => {
    acc[i.file] = (acc[i.file] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    ok: true,
    checked: checkedFiles.length,
    missing: missingFiles.length,
    issues: issues.length,
    byFile: byFileCount,
  });
}
