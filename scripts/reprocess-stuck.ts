// Reprocessa um lead stuck em processing
// Busca os dados do lead no Supabase e re-dispara o pipeline
//
// Usage: npx tsx scripts/reprocess-stuck.ts <leadId>

async function main() {
  const leadId = process.argv[2];
  if (!leadId) {
    console.error('Usage: npx tsx scripts/reprocess-stuck.ts <leadId>');
    process.exit(1);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://virolocal.com';
  const secret = process.env.INTERNAL_API_SECRET || '6a70a743-043e-42cc-b286-ba0acc7375e8';

  console.log(`[Reprocess] Checking lead ${leadId}...`);

  // Check current status
  const statusRes = await fetch(`${baseUrl}/api/diagnose?leadId=${leadId}`);
  const statusData = await statusRes.json();
  console.log(`[Reprocess] Current status:`, statusData);

  if (statusData.status === 'done' && statusData.diagnosis_display) {
    console.log('[Reprocess] Lead already has diagnosis_display — skipping');
    return;
  }

  // Try to trigger plan/generate which re-reads the lead and processes
  console.log(`[Reprocess] Triggering plan/generate for ${leadId}...`);
  const res = await fetch(`${baseUrl}/api/plan/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ leadId }),
  });

  const text = await res.text();
  console.log(`[Reprocess] Response: ${res.status} — ${text.slice(0, 300)}`);
}

main().catch(console.error);
