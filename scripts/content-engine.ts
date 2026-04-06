// ============================================================================
// Virô Content Engine — Generates Instagram cards from real local businesses
// Run: npx tsx scripts/content-engine.ts
// ============================================================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as path from 'path';
import * as fs from 'fs';

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const CITY = 'São Paulo';
const CATEGORY = 'padaria'; // Match against SECTOR_BENCHMARKS categories
const MAX_BUSINESSES = 5;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY_SERVER || '';
const OUTPUT_DIR = path.join(process.cwd(), 'output', 'cards');

// ─── CATEGORY MAPPING ────────────────────────────────────────────────────────
// Human-readable search terms for Google Places
const CATEGORY_SEARCH_TERMS: Record<string, string> = {
  clinica_estetica: 'clínica de estética',
  odontologia: 'dentista',
  veterinaria: 'veterinária pet shop',
  psicologia_terapia: 'psicólogo terapeuta',
  medicina_geral: 'clínica médica',
  advocacia: 'escritório de advocacia',
  contabilidade: 'escritório de contabilidade',
  arquitetura_design: 'escritório de arquitetura',
  consultoria: 'consultoria empresarial',
  marketing_agencia: 'agência de marketing',
  academia_studio: 'academia',
  salao_barbearia: 'salão de beleza barbearia',
  spa_massagem: 'spa massagem',
  restaurante: 'restaurante',
  cafeteria_padaria: 'padaria cafeteria',
  delivery_food: 'delivery comida',
  escola_curso: 'escola curso',
  educacao_infantil: 'educação infantil creche',
  reforma_construcao: 'construtora reforma',
  energia_solar: 'energia solar',
  limpeza_manutencao: 'limpeza manutenção',
  imobiliaria: 'imobiliária',
  ecommerce_nicho: 'loja online',
  varejo_fisico: 'loja varejo',
  moda_vestuario: 'loja de roupas',
  ti_software: 'empresa de software',
  automotivo: 'oficina mecânica',
  turismo_hotel: 'hotel pousada',
  eventos_festas: 'buffet eventos',
  seguranca: 'empresa de segurança',
  // Simple names also work
  padaria: 'padaria',
  pizzaria: 'pizzaria',
  barbearia: 'barbearia',
  farmacia: 'farmácia',
  floricultura: 'floricultura',
};

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
  rating: number;
  user_ratings_total: number;
}

interface AnalysisResult {
  score: number;
  monthly_searches: number;
  competitors_count: number;
  potential_customers: number;
  opportunity_customers: number;
}

// ─── 1. PLACES FETCHER ──────────────────────────────────────────────────────

async function fetchPlaces(category: string, city: string): Promise<PlaceResult[]> {
  const searchTerm = CATEGORY_SEARCH_TERMS[category] || category;
  const query = `${searchTerm} em ${city}`;
  console.log(`\n🔍 Buscando: "${query}"`);

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=pt-BR&key=${GOOGLE_API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK') {
    console.error(`❌ Places API error: ${data.status} — ${data.error_message || ''}`);
    return [];
  }

  const places: PlaceResult[] = (data.results || []).slice(0, MAX_BUSINESSES).map((p: any) => ({
    place_id: p.place_id,
    name: p.name,
    formatted_address: p.formatted_address,
    lat: p.geometry?.location?.lat,
    lng: p.geometry?.location?.lng,
    rating: p.rating || 0,
    user_ratings_total: p.user_ratings_total || 0,
  }));

  console.log(`   Encontrados: ${places.length} negócios`);
  return places;
}

// ─── 2. STREET VIEW PULLER ──────────────────────────────────────────────────

async function fetchStreetView(lat: number, lng: number): Promise<Buffer | null> {
  // First check metadata to see if Street View is available
  const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${GOOGLE_API_KEY}`;
  const metaRes = await fetch(metaUrl);
  const meta = await metaRes.json();

  if (meta.status !== 'OK') {
    return null;
  }

  const imgUrl = `https://maps.googleapis.com/maps/api/streetview?size=1080x1080&location=${lat},${lng}&fov=90&heading=0&pitch=0&key=${GOOGLE_API_KEY}`;
  const imgRes = await fetch(imgUrl);

  if (!imgRes.ok) return null;

  const arrayBuffer = await imgRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── 3. VIRÔ ANALYZER (simplified standalone) ───────────────────────────────

async function analyzeBusinessSimple(place: PlaceResult, category: string): Promise<AnalysisResult> {
  // Try to call the real pipeline
  try {
    const { runInstantAnalysis } = await import('../src/lib/analysis');
    const formData: any = {
      businessName: place.name,
      product: CATEGORY_SEARCH_TERMS[category] || category,
      region: place.formatted_address,
      address: place.formatted_address,
      placeId: place.place_id,
      lat: place.lat,
      lng: place.lng,
      email: 'content-engine@virolocal.com',
      whatsapp: '',
      clientType: 'b2c',
      differentiator: '',
      instagram: '',
      linkedin: '',
      site: '',
      noInstagram: true,
      customerDescription: '',
      channels: [],
      digitalPresence: [],
      competitors: [],
      ticket: '',
      challenge: '',
      freeText: '',
      locale: 'pt',
    };

    const result = await runInstantAnalysis(formData, 'pt');
    const influence = result.influence?.influence;
    const volumes = result.volumes;

    return {
      score: Math.round(influence?.totalInfluence || 0),
      monthly_searches: volumes?.totalMonthlyVolume || 0,
      competitors_count: (result as any).competitionIndex?.activeCompetitors || 0,
      potential_customers: (result as any).audiencia?.audienciaTarget || Math.round((volumes?.totalMonthlyVolume || 500) * 0.15),
      opportunity_customers: (result as any).projecaoFinanceira?.familiasGap || 0,
    };
  } catch (err) {
    console.log(`   ⚠️ Pipeline completo indisponível, usando estimativas: ${(err as Error).message?.slice(0, 60)}`);

    // Fallback: simple estimates based on rating and reviews
    const score = Math.min(100, Math.round((place.rating / 5) * 60 + Math.min(place.user_ratings_total / 10, 40)));
    const monthly_searches = 500; // conservative default
    const potential_customers = Math.round(monthly_searches * 0.15);
    const opportunity_customers = Math.round(potential_customers * (1 - score / 100) * 0.3);

    return {
      score,
      monthly_searches,
      competitors_count: 10, // conservative default
      potential_customers,
      opportunity_customers: Math.max(opportunity_customers, 10),
    };
  }
}

// ─── 4. CARD GENERATOR ──────────────────────────────────────────────────────

function buildCardHTML(place: PlaceResult, analysis: AnalysisResult, streetViewBase64: string): string {
  const shortAddress = place.formatted_address.split(',').slice(0, 2).join(',').trim();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px; height: 1080px; overflow: hidden;
      font-family: 'Inter', -apple-system, sans-serif;
      background: url(data:image/jpeg;base64,${streetViewBase64}) center/cover no-repeat;
    }
    .overlay {
      width: 100%; height: 100%;
      background: linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.88) 65%, rgba(0,0,0,0.92) 100%);
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 60px;
    }
    .logo { display: flex; align-items: baseline; gap: 10px; }
    .logo-name { font-size: 28px; font-weight: 700; color: #FFFFFF; }
    .logo-tag { font-size: 14px; color: #CF8523; letter-spacing: 0.1em; text-transform: uppercase; }
    .business { margin-top: auto; padding-bottom: 20px; }
    .biz-name { font-size: 48px; font-weight: 900; color: #FFFFFF; line-height: 1.15; margin-bottom: 8px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .biz-address { font-size: 22px; color: #A0A0A0; }
    .separator { width: 100%; height: 2px; background: #CF8523; margin: 24px 0; }
    .metrics { display: flex; flex-direction: column; gap: 16px; }
    .metric { font-size: 26px; color: #FFFFFF; display: flex; align-items: center; gap: 14px; }
    .metric-icon { font-size: 26px; flex-shrink: 0; width: 36px; text-align: center; }
    .cta { margin-top: auto; }
    .cta-main { font-size: 32px; font-weight: 700; color: #FFFFFF; line-height: 1.4; }
    .cta-link { font-size: 24px; color: #CF8523; margin-top: 16px; }
    .footer { font-size: 16px; color: #A0A0A0; text-align: center; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="overlay">
    <div class="logo">
      <span class="logo-name">virô</span>
      <span class="logo-tag">inteligência local</span>
    </div>

    <div class="business">
      <div class="biz-name">${escapeHtml(place.name)}</div>
      <div class="biz-address">${escapeHtml(shortAddress)}</div>
    </div>

    <div class="separator"></div>

    <div class="metrics">
      <div class="metric">
        <span class="metric-icon">👥</span>
        <span>${analysis.potential_customers.toLocaleString('pt-BR')} pessoas que podem comprar</span>
      </div>
      <div class="metric">
        <span class="metric-icon">🔍</span>
        <span>${analysis.monthly_searches.toLocaleString('pt-BR')} buscas/mês</span>
      </div>
      <div class="metric">
        <span class="metric-icon">🏪</span>
        <span>${analysis.competitors_count} concorrentes diretos na região</span>
      </div>
      <div class="metric">
        <span class="metric-icon">📈</span>
        <span>Oportunidade: +${analysis.opportunity_customers} clientes/mês sem investimento</span>
      </div>
    </div>

    <div class="separator"></div>

    <div class="cta">
      <div class="cta-main">Tem oportunidade aqui.<br>E no seu negócio também.</div>
      <div class="cta-link">Desbloqueie o como → virolocal.com</div>
    </div>

    <div class="footer">Análise gerada por Virô</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function generateCardPNG(html: string, outputPath: string): Promise<void> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Wait for font to load
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({ path: outputPath, type: 'png' });
  await browser.close();
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Virô Content Engine ===');
  console.log(`Categoria: ${CATEGORY} | Cidade: ${CITY}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY não configurada. Adicione ao .env.local');
    process.exit(1);
  }

  // Ensure output dir
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Fetch places
  const places = await fetchPlaces(CATEGORY, CITY);
  if (places.length === 0) {
    console.error('❌ Nenhum negócio encontrado.');
    process.exit(1);
  }

  let generated = 0;
  let skipped = 0;

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    const idx = `[${i + 1}/${places.length}]`;

    try {
      // 2. Street View
      console.log(`${idx} Buscando Street View para: ${place.name}...`);
      const streetViewBuf = await fetchStreetView(place.lat, place.lng);

      if (!streetViewBuf) {
        console.log(`${idx} ⚠️ Sem Street View — pulando`);
        skipped++;
        await sleep(200);
        continue;
      }

      const streetViewBase64 = streetViewBuf.toString('base64');

      // 3. Analyze
      console.log(`${idx} Rodando análise Virô...`);
      const analysis = await analyzeBusinessSimple(place, CATEGORY);
      console.log(`${idx}   Score: ${analysis.score} | Buscas: ${analysis.monthly_searches} | Oportunidade: +${analysis.opportunity_customers}`);

      // 4. Generate card
      console.log(`${idx} Gerando card...`);
      const html = buildCardHTML(place, analysis, streetViewBase64);
      const outputPath = path.join(OUTPUT_DIR, `${place.place_id.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`);
      await generateCardPNG(html, outputPath);

      console.log(`${idx} ✓ Salvo em ${outputPath}`);
      generated++;
    } catch (err) {
      console.error(`${idx} ❌ Erro: ${(err as Error).message}`);
      skipped++;
    }

    // Rate limit
    await sleep(200);
  }

  console.log(`\n=== Resultado ===`);
  console.log(`Cards gerados: ${generated}/${places.length}`);
  console.log(`Pulados: ${skipped}`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
