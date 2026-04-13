// ============================================================================
// Virô Radar — Canal Solar Integration (SCRAPE REAL)
// Busca integradores de energia solar por região via WordPress AJAX.
// Sem inferência. Dados reais ou not_found.
// ============================================================================

export interface CanalSolarResult {
  found: boolean;
  integrators: Array<{
    name: string;
    city?: string;
    state?: string;
    distance?: number;
  }>;
  totalInRegion: number;
  source: 'canal_solar_scrape' | 'not_found';
}

/**
 * Busca integradores de energia solar no Canal Solar por geolocalização.
 * Usa o WordPress Store Locator AJAX endpoint.
 */
export async function searchCanalSolar(
  lat: number,
  lng: number,
  radiusKm: number = 100,
): Promise<CanalSolarResult> {
  try {
    const formData = new URLSearchParams({
      action: 'wpsl_store_search',
      lat: String(lat),
      lng: String(lng),
      max_results: '50',
      search_radius: String(radiusKm),
      autoload: '0',
    });

    const res = await fetch('https://canalsolar.com.br/wp-admin/admin-ajax.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://canalsolar.com.br',
        'Referer': 'https://canalsolar.com.br/integradores-mapa/',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[CanalSolar] AJAX returned ${res.status}`);
      return { found: false, integrators: [], totalInRegion: 0, source: 'not_found' };
    }

    const data = await res.json();

    // WordPress Store Locator retorna array de lojas ou objeto com success + data
    const stores = Array.isArray(data) ? data : (data.data || data.stores || []);

    if (!Array.isArray(stores) || stores.length === 0) {
      return { found: false, integrators: [], totalInRegion: 0, source: 'not_found' };
    }

    const integrators = stores.map((s: any) => ({
      name: s.store || s.name || s.title || '',
      city: s.city || s.cidade || '',
      state: s.state || s.estado || '',
      distance: s.distance ? parseFloat(s.distance) : undefined,
    })).filter((i: any) => i.name);

    console.log(`[CanalSolar] Found ${integrators.length} integrators near ${lat},${lng}`);

    return {
      found: integrators.length > 0,
      integrators: integrators.slice(0, 20),
      totalInRegion: integrators.length,
      source: 'canal_solar_scrape',
    };
  } catch (err) {
    console.warn(`[CanalSolar] Error:`, (err as Error).message);
    return { found: false, integrators: [], totalInRegion: 0, source: 'not_found' };
  }
}
