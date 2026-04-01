import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runInstantAnalysis, buildDisplayData } from '@/lib/analysis';
import { notifyDiagnosisReady } from '@/lib/notify';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  const supabase = getSupabase();
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  console.log(`[Reprocess] Starting for lead ${leadId}: ${lead.name || lead.product}`);

  // Build formData from lead record — ensure all arrays/fields have safe defaults
  const formData: any = {
    businessName: lead.name || lead.product,
    product: lead.product,
    region: lead.region,
    name: lead.name || '',
    email: lead.email || '',
    whatsapp: lead.whatsapp || '',
    instagram: lead.instagram || '',
    linkedin: lead.linkedin || '',
    site: lead.site || '',
    address: lead.address || '',
    placeId: lead.place_id || '',
    lat: lead.lat || 0,
    lng: lead.lng || 0,
    differentiator: lead.differentiator || '',
    clientType: lead.client_type || 'b2c',
    ticket: lead.ticket || '',
    competitors: Array.isArray(lead.competitors) ? lead.competitors : [],
    channels: Array.isArray(lead.channels) ? lead.channels : [],
    digitalPresence: [],
    customerDescription: lead.customer_description || '',
    noInstagram: false,
    challenge: lead.challenge || '',
    freeText: lead.free_text || '',
    locale: lead.locale || 'pt',
    coupon: '',
  };

  try {
    // Run pipeline
    const pipelineResult = await runInstantAnalysis(formData, formData.locale);
    pipelineResult.leadId = leadId;

    // Build display using shared buildDisplayData (same logic as diagnose route)
    const display: any = buildDisplayData(pipelineResult);

    // Save to Supabase
    const { error: updateError } = await supabase
      .from('leads')
      .update({ status: 'done', diagnosis_display: display, client_type: pipelineResult.clientType || 'b2c' })
      .eq('id', leadId);

    if (updateError) {
      console.error('[Reprocess] Update failed:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Send email
    try {
      await notifyDiagnosisReady({
        email: lead.email,
        whatsapp: lead.whatsapp || '',
        leadId,
        product: lead.product,
        region: lead.region,
        influencePercent: display.influencePercent,
        searchVolume: display.totalVolume,
        projecaoFinanceira: display.projecaoFinanceira,
        name: lead.name || lead.product,
        demandType: display.demandType,
      });
      console.log('[Reprocess] Email sent');
    } catch (emailErr) {
      console.warn('[Reprocess] Email failed (non-fatal):', emailErr);
    }

    console.log(`[Reprocess] Done for ${leadId}: score=${display.influencePercent}`);
    return NextResponse.json({ ok: true, leadId, influencePercent: display.influencePercent });
  } catch (err) {
    console.error('[Reprocess] Pipeline failed:', err);
    // Still mark as done so it doesn't stay stuck
    await supabase.from('leads').update({
      status: 'done',
      diagnosis_display: { terms: [], totalVolume: 0, influencePercent: 0, _error: (err as Error).message },
    }).eq('id', leadId);
    return NextResponse.json({ error: (err as Error).message, leadId }, { status: 500 });
  }
}
