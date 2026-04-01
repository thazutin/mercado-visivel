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

  // Mark as error
  const ids = stuckLeads.map(l => l.id);
  const { error: updateError } = await supabase
    .from('leads')
    .update({ status: 'error' })
    .in('id', ids);

  if (updateError) {
    console.error('[Recovery] Erro ao atualizar:', updateError.message);
    process.exit(1);
  }

  console.log(`[Recovery] ${ids.length} leads marcados como status=error`);
  console.log('[Recovery] Esses leads mostrarão mensagem de erro para o usuário.');
}

main().catch(console.error);
