// ============================================================================
// Virô — Weekly Re-scrape
// Collects fresh SERP, Maps, and Instagram data for an active lead.
// Saves as snapshot. Does NOT re-run term generation (terms are stable).
// ============================================================================
// File: src/lib/pipeline/weekly-rescrape.ts

import {
  createApifySerpScraper,
  createApifyMapsScraper,
  createApifyInstagramScraper,
} from "./external-services";

import {
  calculateGoogleInfluence,
  calculateInstagramInfluence,
  calculateCompositeInfluence,
} from "../models/influence-score";

import type {
  SerpPosition,
  MapsPresence,
  InstagramProfile,
  TermVolumeData,
  WebInfluence,
} from "../types/pipeline.types";

interface RescrapeInput {
  leadId: string;
  product: string;
  region: string;
  instagram: string;
  site: string;
  competitors: { name: string; instagram?: string }[];
  // Terms from original diagnosis (reuse, don't regenerate)
  terms: string[];
  // Term volumes from original (or latest snapshot)
  termVolumes: TermVolumeData[];
}

interface RescrapeResult {
  serpPositions: SerpPosition[];
  mapsPresence: MapsPresence | null;
  instagramProfiles: InstagramProfile[];
  influenceScore: number;
  influenceBreakdown: {
    google: number;
    instagram: number;
    web: number;
  };
  sourcesUsed: string[];
  sourcesUnavailable: string[];
  durationMs: number;
  // Full raw data for snapshot storage
  rawData: any;
}

export async function weeklyRescrape(input: RescrapeInput): Promise<RescrapeResult> {
  const startTime = Date.now();
  const sourcesUsed: string[] = [];
  const sourcesUnavailable: string[] = [];

  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    throw new Error("APIFY_API_TOKEN not configured");
  }

  const apifyConfig = { apiToken: apifyToken };
  const serpScraper = createApifySerpScraper(apifyConfig);
  const mapsScraper = createApifyMapsScraper(apifyConfig);
  const instagramScraper = createApifyInstagramScraper(apifyConfig);

  // ─── Extract handles ───
  const instagramHandles: string[] = [];
  if (input.instagram) {
    instagramHandles.push(
      input.instagram.replace("@", "").replace("https://www.instagram.com/", "").replace("/", "")
    );
  }
  for (const c of input.competitors) {
    if (c.instagram) {
      instagramHandles.push(
        c.instagram.replace("@", "").replace("https://www.instagram.com/", "").replace("/", "")
      );
    }
  }

  // ─── Extract domain ───
  const siteDomain = input.site
    ? (() => {
        try {
          return new URL(
            input.site.startsWith("http") ? input.site : `https://${input.site}`
          ).hostname.replace("www.", "");
        } catch {
          return undefined;
        }
      })()
    : undefined;

  // ─── Run all scrapers in parallel (max 10 terms to save credits) ───
  const topTerms = input.terms.slice(0, 10);

  console.log(
    `[Rescrape] Starting for lead ${input.leadId}: ${topTerms.length} terms, ${instagramHandles.length} IG handles`
  );

  const [serpResult, mapsResult, igResult] = await Promise.allSettled([
    serpScraper(topTerms, input.region, siteDomain).then((r) => {
      sourcesUsed.push("apify_serp");
      return r;
    }),
    mapsScraper(input.product, input.region).then((r) => {
      sourcesUsed.push("apify_maps");
      return r;
    }),
    instagramHandles.length > 0
      ? instagramScraper(instagramHandles).then((r) => {
          sourcesUsed.push("apify_instagram");
          return r;
        })
      : Promise.resolve([]),
  ]);

  const serpPositions: SerpPosition[] =
    serpResult.status === "fulfilled" ? serpResult.value : [];
  const mapsPresence: MapsPresence | null =
    mapsResult.status === "fulfilled" ? mapsResult.value : null;
  const instagramProfiles: InstagramProfile[] =
    igResult.status === "fulfilled" ? igResult.value : [];

  if (serpResult.status === "rejected") {
    console.warn("[Rescrape] SERP failed:", serpResult.reason?.message);
    sourcesUnavailable.push("serp");
  }
  if (mapsResult.status === "rejected") {
    console.warn("[Rescrape] Maps failed:", mapsResult.reason?.message);
    sourcesUnavailable.push("maps");
  }
  if (igResult.status === "rejected") {
    console.warn("[Rescrape] Instagram failed:", igResult.reason?.message);
    sourcesUnavailable.push("instagram");
  }

  // ─── Calculate influence score ───
  const googleInfluence = calculateGoogleInfluence(
    serpPositions,
    mapsPresence,
    input.termVolumes
  );

  const businessHandle = input.instagram
    ? input.instagram.replace("@", "").replace("https://www.instagram.com/", "").replace("/", "")
    : "";

  const businessProfile = instagramProfiles.find((p) => p.handle === businessHandle) || {
    handle: businessHandle,
    name: "",
    isBusinessProfile: false,
    followers: 0,
    reachAbsolute: 0,
    reachRelative: 0,
    engagementRate: 0,
    postsLast30d: 0,
    avgLikesLast30d: 0,
    avgViewsReelsLast30d: 0,
    recentPostsCount: 0,
    recentAvgReach: 0,
    recentEngagementRate: 0,
    bio: "",
    lastPostsCaptions: [],
    isPrivate: false,
    dataAvailable: false,
  };

  const competitorProfiles = instagramProfiles.filter((p) => p.handle !== businessHandle);

  const instagramInfluence = calculateInstagramInfluence(businessProfile, competitorProfiles);
  const webInfluence: WebInfluence = { available: false };

  const compositeResult = calculateCompositeInfluence(
    googleInfluence,
    instagramInfluence,
    webInfluence
  );

  const durationMs = Date.now() - startTime;

  console.log(
    `[Rescrape] Done for ${input.leadId} in ${durationMs}ms | Influence: ${compositeResult.influence.totalInfluence}% | Sources: ${sourcesUsed.join(", ")}`
  );

  return {
    serpPositions,
    mapsPresence,
    instagramProfiles,
    influenceScore: compositeResult.influence.totalInfluence,
    influenceBreakdown: {
      google: compositeResult.influence.google.score,
      instagram: compositeResult.influence.instagram.score,
      web: compositeResult.influence.web.score,
    },
    sourcesUsed,
    sourcesUnavailable,
    durationMs,
    rawData: {
      serpPositions,
      mapsPresence,
      instagramProfile: businessProfile,
      instagramCompetitors: competitorProfiles,
      influence: compositeResult,
      termVolumes: input.termVolumes,
    },
  };
}
