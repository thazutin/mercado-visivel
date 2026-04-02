import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface ProductionBrief {
  id?: string;
  lead_id: string;
  week_number: number;
  title: string;
  format: 'reels' | 'carrossel' | 'foto_unica' | 'stories_sequencia';
  strategic_intent: string;
  purchase_journey_stage: string;
  temporal_hook?: string;
  script: {
    hook: string;
    body: string;
    cta: string;
  };
  visual_direction: {
    style: string;
    shots: string[];
    references: string;
    caption_suggestion: string;
  };
  production_notes: {
    duration_seconds?: number;
    slide_count?: number;
    equipment: string;
    editing_complexity: 'simples' | 'medio' | 'profissional';
    estimated_time: string;
  };
  generated_at: string;
}

const RETAIL_CALENDAR: Record<string, { name: string; months: number[] }[]> = {
  jan: [{ name: "Liquidações de Ano Novo", months: [1] }, { name: "Volta às aulas", months: [1, 2] }],
  feb: [{ name: "Carnaval", months: [2] }, { name: "Dia dos Namorados (Valentine's Day BR)", months: [2] }],
  mar: [{ name: "Dia Internacional da Mulher (8/3)", months: [3] }, { name: "Início do outono", months: [3] }],
  apr: [{ name: "Páscoa", months: [4] }, { name: "Dia do Consumidor (15/3)", months: [3, 4] }],
  may: [{ name: "Dia das Mães (2º domingo)", months: [5] }, { name: "Dia do Trabalhador (1/5)", months: [5] }],
  jun: [{ name: "Dia dos Namorados (12/6)", months: [6] }, { name: "Festa Junina", months: [6] }],
  jul: [{ name: "Férias escolares", months: [7] }, { name: "Amazon Prime Day", months: [7] }],
  aug: [{ name: "Dia dos Pais (2º domingo)", months: [8] }, { name: "Dia do Soldado", months: [8] }],
  sep: [{ name: "Dia do Cliente (15/9)", months: [9] }, { name: "Primavera", months: [9] }],
  oct: [{ name: "Dia das Crianças (12/10)", months: [10] }, { name: "Halloween (31/10)", months: [10] }],
  nov: [{ name: "Black Friday (última sexta)", months: [11] }, { name: "Cyber Monday", months: [11] }],
  dec: [{ name: "Natal (25/12)", months: [12] }, { name: "Réveillon", months: [12] }],
};

function getUpcomingEvents(count = 3): string[] {
  const now = new Date();
  const events: string[] = [];

  for (let i = 0; i <= 2; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = date.toLocaleString('en', { month: 'short' }).toLowerCase();
    const monthEvents = RETAIL_CALENDAR[monthKey] || [];
    events.push(...monthEvents.map(e => e.name));
  }

  return events.slice(0, count);
}

export async function generateProductionBriefs(
  leadId: string,
  lead: {
    product: string;
    region: string;
    differentiator?: string;
    instagram?: string;
    site?: string;
    client_type?: string;
  },
  diagnosisData: any,
  weekNumber = 1,
): Promise<ProductionBrief[]> {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const supabase = getSupabase();

  const upcomingEvents = getUpcomingEvents(3);
  const shortRegion = (lead.region || '').split(',')[0].trim();

  const maps = diagnosisData?.influence?.rawGoogle?.mapsPresence || null;
  const ig = diagnosisData?.influence?.rawInstagram?.businessProfile || null;
  const topTerms = (diagnosisData?.volumes?.termVolumes || [])
    .sort((a: any, b: any) => (b.monthlyVolume || 0) - (a.monthlyVolume || 0))
    .slice(0, 5)
    .map((t: any) => `"${t.term}" (${t.monthlyVolume}/mês)`)
    .join(', ');

  const prompt = `Você é um estrategista de conteúdo e diretor criativo especialista em negócios locais brasileiros.

NEGÓCIO: ${lead.product} em ${shortRegion}
Diferencial: "${lead.differentiator || 'não informado'}"
Instagram: ${lead.instagram ? `@${lead.instagram} (${ig?.followers || 0} seguidores)` : 'sem Instagram'}
Site: ${lead.site || 'sem site'}
Google Maps: ${maps?.found ? `${maps.rating}★ com ${maps.reviewCount} avaliações` : 'não cadastrado'}
Termos mais buscados: ${topTerms || 'não disponível'}
Tipo de cliente: ${lead.client_type || 'b2c'}

EVENTOS PRÓXIMOS (próximos 60-90 dias):
${upcomingEvents.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Crie 3 briefings de produção de conteúdo para este negócio. Cada briefing deve ser para uma peça que uma produtora/agência/freelancer possa executar.

REGRAS:
- Cada briefing deve ter objetivo de negócio claro e diferente dos outros (ex: um para atrair novos clientes, um para converter quem já conhece, um para fidelizar)
- Pelo menos 1 briefing deve aproveitar um evento/data dos próximos 60 dias
- Roteiros devem ser específicos para ${lead.product} em ${shortRegion} — nada genérico
- Formatos: varie entre reels, carrossel e foto/stories
- Tom: direto, sem jargão de marketing, como um vizinho que entende de negócio

Responda APENAS em JSON — array com 3 objetos:
[
  {
    "title": "título criativo do conteúdo",
    "format": "reels|carrossel|foto_unica|stories_sequencia",
    "strategic_intent": "por que este conteúdo especificamente aumenta probabilidade de venda para este negócio",
    "purchase_journey_stage": "awareness|consideracao|decisao|retencao",
    "temporal_hook": "evento ou data que justifica fazer agora (ou null)",
    "script": {
      "hook": "primeiros 3 segundos do vídeo OU primeira frase do carrossel — deve parar o scroll",
      "body": "roteiro completo — para reels: descrição cena a cena; para carrossel: texto de cada slide numerado; para foto: descrição da cena + legenda",
      "cta": "chamada para ação específica e natural (não 'clique no link da bio')"
    },
    "visual_direction": {
      "style": "estilo visual específico (ex: dia a dia do negócio, bastidores, resultado antes/depois, depoimento de cliente)",
      "shots": ["take 1: descrição", "take 2: descrição"],
      "references": "descrição de referências visuais sem citar marcas concorrentes",
      "caption_suggestion": "legenda completa com emojis e hashtags relevantes para ${shortRegion}"
    },
    "production_notes": {
      "duration_seconds": 30,
      "slide_count": null,
      "equipment": "celular com boa iluminação natural basta",
      "editing_complexity": "simples|medio|profissional",
      "estimated_time": "2-3 horas de produção"
    }
  }
]

Gere APENAS o JSON.`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    temperature: 0.6,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  const parsed: any[] = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());

  const briefs: ProductionBrief[] = parsed.map((b: any) => ({
    lead_id: leadId,
    week_number: weekNumber,
    title: b.title,
    format: b.format,
    strategic_intent: b.strategic_intent,
    purchase_journey_stage: b.purchase_journey_stage,
    temporal_hook: b.temporal_hook || null,
    script: b.script,
    visual_direction: b.visual_direction,
    production_notes: b.production_notes,
    generated_at: new Date().toISOString(),
  }));

  await supabase
    .from('production_briefs')
    .delete()
    .eq('lead_id', leadId)
    .eq('week_number', weekNumber);

  const { error } = await supabase.from('production_briefs').insert(briefs);
  if (error) throw new Error(`production_briefs insert falhou: ${error.message}`);

  console.log(`[ProductionBriefs] ${briefs.length} briefings gerados para lead ${leadId} (semana ${weekNumber})`);
  return briefs;
}
