// ============================================================================
// Virô — Diff Engine
// Compares snapshot N vs snapshot N-1 and produces structured changes
// Used by weekly cron to feed Claude briefing generation
// ============================================================================
// File: src/lib/pipeline/diff-engine.ts

export interface DiffChange {
  category: "serp" | "maps" | "instagram" | "volume" | "influence";
  direction: "up" | "down" | "neutral";
  metric: string;
  previousValue: any;
  currentValue: any;
  description: string;
  significance: "high" | "medium" | "low";
}

export interface SnapshotDiff {
  weekNumber: number;
  previousWeek: number;
  changes: DiffChange[];
  summary: {
    totalChanges: number;
    improvements: number;
    declines: number;
    neutral: number;
    significantChanges: number;
  };
}

/**
 * Compare two raw snapshots and extract meaningful changes.
 * Each snapshot.data is the raw pipeline output (same shape as Momento1Result).
 */
export function calculateDiff(
  currentData: any,
  previousData: any,
  currentWeek: number,
  previousWeek: number
): SnapshotDiff {
  const changes: DiffChange[] = [];

  // ─── SERP POSITION CHANGES ─────────────────────────────────────────
  const currSerp = extractSerpPositions(currentData);
  const prevSerp = extractSerpPositions(previousData);

  for (const [term, currPos] of Object.entries(currSerp)) {
    const prevPos = prevSerp[term];
    if (prevPos === undefined) continue; // New term, skip

    const curr = currPos as number | null;
    const prev = prevPos as number | null;

    if (curr !== null && prev !== null && curr !== prev) {
      const improved = curr < prev;
      changes.push({
        category: "serp",
        direction: improved ? "up" : "down",
        metric: `Posição Google: "${term}"`,
        previousValue: prev,
        currentValue: curr,
        description: improved
          ? `"${term}" subiu de posição ${prev} para ${curr} no Google`
          : `"${term}" caiu de posição ${prev} para ${curr} no Google`,
        significance: Math.abs(curr - prev) >= 3 ? "high" : "medium",
      });
    } else if (curr !== null && prev === null) {
      changes.push({
        category: "serp",
        direction: "up",
        metric: `Posição Google: "${term}"`,
        previousValue: null,
        currentValue: curr,
        description: `"${term}" apareceu na posição ${curr} do Google (antes não aparecia)`,
        significance: "high",
      });
    } else if (curr === null && prev !== null) {
      changes.push({
        category: "serp",
        direction: "down",
        metric: `Posição Google: "${term}"`,
        previousValue: prev,
        currentValue: null,
        description: `"${term}" saiu dos resultados do Google (antes estava na posição ${prev})`,
        significance: "high",
      });
    }
  }

  // ─── GOOGLE MAPS CHANGES ───────────────────────────────────────────
  const currMaps = extractMapsData(currentData);
  const prevMaps = extractMapsData(previousData);

  if (currMaps && prevMaps) {
    // Rating change
    if (currMaps.rating !== prevMaps.rating && currMaps.rating && prevMaps.rating) {
      changes.push({
        category: "maps",
        direction: currMaps.rating > prevMaps.rating ? "up" : "down",
        metric: "Nota Google Maps",
        previousValue: prevMaps.rating,
        currentValue: currMaps.rating,
        description: `Nota no Google Maps: ${prevMaps.rating} → ${currMaps.rating}`,
        significance: Math.abs(currMaps.rating - prevMaps.rating) >= 0.3 ? "high" : "low",
      });
    }

    // Review count change
    if (currMaps.reviewCount && prevMaps.reviewCount && currMaps.reviewCount !== prevMaps.reviewCount) {
      const newReviews = currMaps.reviewCount - prevMaps.reviewCount;
      if (newReviews > 0) {
        changes.push({
          category: "maps",
          direction: "up",
          metric: "Reviews Google Maps",
          previousValue: prevMaps.reviewCount,
          currentValue: currMaps.reviewCount,
          description: `+${newReviews} nova${newReviews > 1 ? "s" : ""} avaliação${newReviews > 1 ? "ões" : ""} no Google Maps (total: ${currMaps.reviewCount})`,
          significance: newReviews >= 3 ? "medium" : "low",
        });
      }
    }
  }

  // ─── INSTAGRAM CHANGES ─────────────────────────────────────────────
  const currIg = extractInstagramData(currentData);
  const prevIg = extractInstagramData(previousData);

  if (currIg && prevIg && currIg.dataAvailable && prevIg.dataAvailable) {
    // Followers
    if (currIg.followers !== prevIg.followers) {
      const diff = currIg.followers - prevIg.followers;
      const pct = prevIg.followers > 0
        ? Math.round((diff / prevIg.followers) * 100)
        : 0;
      changes.push({
        category: "instagram",
        direction: diff > 0 ? "up" : "down",
        metric: "Seguidores Instagram",
        previousValue: prevIg.followers,
        currentValue: currIg.followers,
        description: `Seguidores: ${prevIg.followers.toLocaleString("pt-BR")} → ${currIg.followers.toLocaleString("pt-BR")} (${diff > 0 ? "+" : ""}${diff}, ${pct > 0 ? "+" : ""}${pct}%)`,
        significance: Math.abs(pct) >= 5 ? "high" : Math.abs(pct) >= 2 ? "medium" : "low",
      });
    }

    // Engagement rate
    if (currIg.engagementRate !== prevIg.engagementRate) {
      const currPct = (currIg.engagementRate * 100).toFixed(1);
      const prevPct = (prevIg.engagementRate * 100).toFixed(1);
      if (currPct !== prevPct) {
        changes.push({
          category: "instagram",
          direction: currIg.engagementRate > prevIg.engagementRate ? "up" : "down",
          metric: "Engagement Instagram",
          previousValue: prevIg.engagementRate,
          currentValue: currIg.engagementRate,
          description: `Taxa de engajamento: ${prevPct}% → ${currPct}%`,
          significance: Math.abs(currIg.engagementRate - prevIg.engagementRate) >= 0.01 ? "medium" : "low",
        });
      }
    }

    // Posts frequency
    if (currIg.postsLast30d !== prevIg.postsLast30d) {
      changes.push({
        category: "instagram",
        direction: currIg.postsLast30d > prevIg.postsLast30d ? "up" : "down",
        metric: "Posts últimos 30 dias",
        previousValue: prevIg.postsLast30d,
        currentValue: currIg.postsLast30d,
        description: `Posts nos últimos 30 dias: ${prevIg.postsLast30d} → ${currIg.postsLast30d}`,
        significance: "low",
      });
    }
  }

  // ─── INFLUENCE SCORE CHANGE ────────────────────────────────────────
  const currInfluence = extractInfluence(currentData);
  const prevInfluence = extractInfluence(previousData);

  if (currInfluence !== null && prevInfluence !== null && currInfluence !== prevInfluence) {
    const diff = currInfluence - prevInfluence;
    changes.push({
      category: "influence",
      direction: diff > 0 ? "up" : "down",
      metric: "Influence Score",
      previousValue: prevInfluence,
      currentValue: currInfluence,
      description: `Influência digital: ${prevInfluence}% → ${currInfluence}% (${diff > 0 ? "+" : ""}${diff}pp)`,
      significance: Math.abs(diff) >= 5 ? "high" : Math.abs(diff) >= 2 ? "medium" : "low",
    });
  }

  // ─── BUILD SUMMARY ─────────────────────────────────────────────────
  const improvements = changes.filter((c) => c.direction === "up").length;
  const declines = changes.filter((c) => c.direction === "down").length;
  const neutral = changes.filter((c) => c.direction === "neutral").length;
  const significantChanges = changes.filter((c) => c.significance === "high").length;

  return {
    weekNumber: currentWeek,
    previousWeek,
    changes,
    summary: {
      totalChanges: changes.length,
      improvements,
      declines,
      neutral,
      significantChanges,
    },
  };
}

// ─── DATA EXTRACTORS ─────────────────────────────────────────────────

function extractSerpPositions(data: any): Record<string, number | null> {
  const positions: Record<string, number | null> = {};
  const serp =
    data?.influence?.influence?.rawGoogle?.serpPositions ||
    data?.serpPositions ||
    [];

  for (const sp of serp) {
    if (sp.term) {
      positions[sp.term.toLowerCase()] = sp.position || null;
    }
  }
  return positions;
}

function extractMapsData(data: any): { rating: number | null; reviewCount: number | null } | null {
  const maps =
    data?.influence?.influence?.rawGoogle?.mapsPresence ||
    data?.mapsPresence ||
    null;

  if (!maps || !maps.found) return null;
  return {
    rating: maps.rating || null,
    reviewCount: maps.reviewCount || null,
  };
}

function extractInstagramData(data: any): any | null {
  return (
    data?.influence?.influence?.rawInstagram?.profile ||
    data?.instagramProfile ||
    null
  );
}

function extractInfluence(data: any): number | null {
  return (
    data?.influence?.influence?.totalInfluence ??
    data?.totalInfluence ??
    null
  );
}
