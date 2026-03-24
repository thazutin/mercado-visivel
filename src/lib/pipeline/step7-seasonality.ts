// ============================================================================
// Step 7 — Seasonality
// Usa monthlyTrend do pipelineResult (Google Ads KP já retorna série mensal)
// Fallback: DataForSEO se monthlyTrend vazio
// File: src/lib/pipeline/step7-seasonality.ts
// ============================================================================

import type { SeasonalityData, TermVolumeData } from '../types/pipeline.types'

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

// ── Source 1: monthlyTrend já coletado pelo Google Ads KP ──────────────────
export function buildSeasonalityFromTermVolumes(
  termVolumes: TermVolumeData[],
): SeasonalityData | null {
  // Pega os top 3 termos com dados mensais
  const withTrend = termVolumes
    .filter(t => Array.isArray(t.monthlyTrend) && t.monthlyTrend.length >= 6)
    .slice(0, 3)

  if (withTrend.length === 0) return null

  // monthlyTrend está ordenado cronologicamente (mais antigo → mais recente)
  // Normaliza para 12 posições
  const seriesLength = Math.max(...withTrend.map(t => t.monthlyTrend.length))
  const normalized = withTrend.map(t => {
    const pad = seriesLength - t.monthlyTrend.length
    return [...Array(pad).fill(0), ...t.monthlyTrend.map(m => m.volume)]
  })

  // Média entre termos para cada mês
  const avgSeries = Array.from({ length: seriesLength }, (_, i) => {
    const vals = normalized.map(s => s[i] ?? 0)
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  })

  // Últimos 12 meses
  const last12 = avgSeries.slice(-12)

  // Descobrir qual mês do calendário corresponde ao último índice
  // Google Ads retorna até o mês anterior ao atual
  const now = new Date()
  const endMonth = now.getMonth() // 0-based, mês anterior ao atual

  const months = last12.map((volume, i) => {
    const monthIndex = (endMonth - (11 - i) + 12) % 12
    return { month: MONTH_NAMES[monthIndex], volume }
  })

  let peak = months[0]
  let low = months[0]
  for (const m of months) {
    if (m.volume > peak.volume) peak = m
    if (m.volume < low.volume) low = m
  }

  return {
    months,
    peak_month: peak.month,
    low_month: low.month,
  }
}

// ── Source 2: DataForSEO (fallback se não houver monthlyTrend) ─────────────
export async function executeStep7Seasonality(
  terms: string[],
  termVolumes?: TermVolumeData[],
): Promise<SeasonalityData | null> {

  // Tenta usar dados já coletados primeiro
  if (termVolumes && termVolumes.length > 0) {
    const fromVolumes = buildSeasonalityFromTermVolumes(termVolumes)
    if (fromVolumes) {
      console.log(`[step7-seasonality] OK via monthlyTrend: peak=${fromVolumes.peak_month}, low=${fromVolumes.low_month}`)
      return fromVolumes
    }
    console.warn('[step7-seasonality] monthlyTrend vazio ou insuficiente — tentando DataForSEO')
  }

  // Fallback: DataForSEO
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    console.warn('[step7-seasonality] DataForSEO não configurado — sem fallback disponível')
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
        body: JSON.stringify([{
          keywords: topTerms,
          language_code: 'pt',
          location_code: 2076,
        }]),
      }
    )

    if (!res.ok) {
      console.error(`[step7-seasonality] DataForSEO HTTP ${res.status}`)
      return null
    }

    const data = await res.json()
    const monthlyMap = new Map<string, number[]>()

    for (const task of data?.tasks || []) {
      for (const item of task?.result || []) {
        if (!Array.isArray(item?.monthly_searches)) continue
        for (const m of item.monthly_searches) {
          const key = `${m.year}-${String(m.month).padStart(2, '0')}`
          if (!monthlyMap.has(key)) monthlyMap.set(key, [])
          monthlyMap.get(key)!.push(m.search_volume ?? 0)
        }
      }
    }

    if (monthlyMap.size === 0) {
      console.warn('[step7-seasonality] DataForSEO: sem dados mensais')
      return null
    }

    const sorted = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)

    const months = sorted.map(([key, volumes]) => {
      const avgVolume = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length)
      const monthNum = parseInt(key.split('-')[1], 10)
      return { month: MONTH_NAMES[monthNum - 1] || key, volume: avgVolume }
    })

    if (months.length === 0) return null

    let peak = months[0], low = months[0]
    for (const m of months) {
      if (m.volume > peak.volume) peak = m
      if (m.volume < low.volume) low = m
    }

    console.log(`[step7-seasonality] DataForSEO OK: peak=${peak.month}(${peak.volume}), low=${low.month}(${low.volume})`)
    return { months, peak_month: peak.month, low_month: low.month }

  } catch (err) {
    console.error('[step7-seasonality] Erro:', err)
    return null
  }
}
