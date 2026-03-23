// ============================================================================
// Step 7 — Seasonality (DataForSEO search volume monthly data)
// Busca sazonalidade usando os primeiros 3 termos do step1
// File: src/lib/pipeline/step7-seasonality.ts
// ============================================================================

import type { SeasonalityData } from '../types/pipeline.types'

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

export async function executeStep7Seasonality(
  terms: string[],
): Promise<SeasonalityData | null> {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    console.warn('[step7-seasonality] DataForSEO não configurado — pulando')
    return null
  }

  const topTerms = terms.slice(0, 3)
  if (topTerms.length === 0) return null

  const baseUrl = 'https://api.dataforseo.com/v3'
  const authHeader =
    'Basic ' +
    Buffer.from(
      `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
    ).toString('base64')

  try {
    const res = await fetch(
      `${baseUrl}/keywords_data/google_ads/search_volume/live`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify([
          {
            keywords: topTerms,
            language_code: 'pt',
            location_code: 2076, // Brazil
          },
        ]),
      }
    )

    if (!res.ok) {
      console.error(`[step7-seasonality] DataForSEO HTTP ${res.status}`)
      return null
    }

    const data = await res.json()

    // Agregar monthly_searches de todos os termos
    const monthlyMap = new Map<string, number[]>()

    const tasks = data?.tasks || []
    for (const task of tasks) {
      const results = task?.result || []
      for (const item of results) {
        const monthly = item?.monthly_searches
        if (!Array.isArray(monthly)) continue

        for (const m of monthly) {
          const key = `${m.year}-${String(m.month).padStart(2, '0')}`
          if (!monthlyMap.has(key)) monthlyMap.set(key, [])
          monthlyMap.get(key)!.push(m.search_volume ?? 0)
        }
      }
    }

    if (monthlyMap.size === 0) {
      console.warn('[step7-seasonality] Sem dados mensais retornados')
      return null
    }

    // Média entre termos, últimos 12 meses
    const sorted = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)

    const months = sorted.map(([key, volumes]) => {
      const avgVolume = Math.round(
        volumes.reduce((a, b) => a + b, 0) / volumes.length
      )
      const monthNum = parseInt(key.split('-')[1], 10)
      return {
        month: MONTH_NAMES[monthNum - 1] || key,
        volume: avgVolume,
      }
    })

    if (months.length === 0) return null

    // Peak e low
    let peak = months[0]
    let low = months[0]
    for (const m of months) {
      if (m.volume > peak.volume) peak = m
      if (m.volume < low.volume) low = m
    }

    const result: SeasonalityData = {
      months,
      peak_month: peak.month,
      low_month: low.month,
    }

    console.log(
      `[step7-seasonality] OK: ${months.length} meses, pico=${peak.month}(${peak.volume}), baixa=${low.month}(${low.volume})`
    )

    return result
  } catch (err) {
    console.error('[step7-seasonality] Erro:', err)
    return null
  }
}
