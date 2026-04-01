// Recovery script for stuck leads
// Finds leads with status=processing for > 30 minutes and marks them as error
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/recover-stuck-leads.ts

import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  console.log('[Recovery] Buscando leads travados (status=processing, criados antes de', thirtyMinAgo, ')...');

  const { data: stuckLeads, error } = await supabase
    .from('leads')
    .select('id, name, product, region, status, created_at')
    .eq('status', 'processing')
    .lt('created_at', thirtyMinAgo);

  if (error) {
    console.error('[Recovery] Erro ao buscar:', error.message);
    process.exit(1);
  }

  if (!stuckLeads || stuckLeads.length === 0) {
    console.log('[Recovery] Nenhum lead travado encontrado.');
    return;
  }

  console.log(`[Recovery] Encontrados ${stuckLeads.length} leads travados:`);
  for (const lead of stuckLeads) {
    const age = Math.round((Date.now() - new Date(lead.created_at).getTime()) / 60000);
    console.log(`  - ${lead.id} | ${lead.name || lead.product} | ${age} min | ${lead.region?.split(',')[0]}`);
  }

  // Mark as done with empty display (status='error' may not exist in schema)
  for (const lead of stuckLeads) {
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'done',
        diagnosis_display: {
          terms: [], totalVolume: 0, avgCpc: 0, marketLow: 0, marketHigh: 0,
          influencePercent: 0, source: 'recovered', confidence: 'low',
          pipeline: { version: 'recovered', durationMs: 0, sourcesUsed: [], sourcesUnavailable: ['stuck_recovery'] },
          _error: `Lead stuck in processing for ${Math.round((Date.now() - new Date(lead.created_at).getTime()) / 60000)} minutes`,
        },
      })
      .eq('id', lead.id);

    if (updateError) {
      console.error(`[Recovery] Erro ao atualizar ${lead.id}:`, updateError.message);
    } else {
      console.log(`[Recovery] ✓ ${lead.id} recuperado (status=done com display vazio)`);
    }
  }

  console.log(`[Recovery] ${stuckLeads.length} leads recuperados — mostrarão resultado vazio com opção de retry.`);
}

main().catch(console.error);
