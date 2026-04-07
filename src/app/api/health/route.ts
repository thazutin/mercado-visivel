// ============================================================================
// /api/health — Pre-flight + during-launch health probe
// Pings every external dependency and reports status, latency and balance
// where possible. Auth: x-internal-secret OR ?secret= OR Bearer token.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface DepResult {
  name: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
  balance?: string;
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "");
  const internalSecret =
    req.headers.get("x-internal-secret") ||
    new URL(req.url).searchParams.get("secret");
  return (
    (!!cronSecret && cronSecret === process.env.CRON_SECRET) ||
    (!!internalSecret && internalSecret === process.env.INTERNAL_API_SECRET)
  );
}

async function timed<T>(name: string, fn: () => Promise<T>): Promise<DepResult & { raw?: T }> {
  const start = Date.now();
  try {
    const raw = await fn();
    return { name, ok: true, latencyMs: Date.now() - start, raw };
  } catch (err) {
    return {
      name,
      ok: false,
      latencyMs: Date.now() - start,
      detail: (err as Error).message?.slice(0, 200) || "unknown error",
    };
  }
}

async function checkSupabase(): Promise<DepResult> {
  return timed("supabase", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("missing env");
    const sb = createClient(url, key);
    const { error } = await sb.from("leads").select("id").limit(1);
    if (error) throw error;
    return true;
  });
}

async function checkAnthropic(): Promise<DepResult> {
  return timed("anthropic", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("missing env");
    // /v1/models é o ping mais barato e rápido (não consome créditos)
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  });
}

async function checkApify(): Promise<DepResult> {
  const start = Date.now();
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error("missing env");
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${token}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const usd = data?.data?.usageCycle?.usageUsd ?? null;
    const limit = data?.data?.plan?.maxMonthlyUsageUsd ?? null;
    const balance = limit != null && usd != null ? `$${(limit - usd).toFixed(2)} restantes (gasto $${usd.toFixed(2)} de $${limit})` : undefined;
    return {
      name: "apify",
      ok: true,
      latencyMs: Date.now() - start,
      balance,
    };
  } catch (err) {
    return {
      name: "apify",
      ok: false,
      latencyMs: Date.now() - start,
      detail: (err as Error).message?.slice(0, 200),
    };
  }
}

async function checkDataForSEO(): Promise<DepResult> {
  const start = Date.now();
  try {
    const login = process.env.DATAFORSEO_LOGIN;
    const pwd = process.env.DATAFORSEO_PASSWORD;
    if (!login || !pwd) throw new Error("missing env");
    const auth = Buffer.from(`${login}:${pwd}`).toString("base64");
    const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const balance = data?.tasks?.[0]?.result?.[0]?.money?.balance;
    return {
      name: "dataforseo",
      ok: true,
      latencyMs: Date.now() - start,
      balance: typeof balance === "number" ? `$${balance.toFixed(2)} restantes` : undefined,
    };
  } catch (err) {
    return {
      name: "dataforseo",
      ok: false,
      latencyMs: Date.now() - start,
      detail: (err as Error).message?.slice(0, 200),
    };
  }
}

async function checkResend(): Promise<DepResult> {
  return timed("resend", async () => {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("missing env");
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  });
}

async function checkStripe(): Promise<DepResult> {
  return timed("stripe", async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("missing env");
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  });
}

async function checkGooglePlaces(): Promise<DepResult> {
  return timed("google_places", async () => {
    const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY_SERVER;
    if (!key) throw new Error("missing env");
    // Geocode mais barato — não consome créditos pra um query trivial
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=-23.5505,-46.6333&key=${key}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === "REQUEST_DENIED") throw new Error(data.error_message || "REQUEST_DENIED");
    return true;
  });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  const checks = await Promise.all([
    checkSupabase(),
    checkAnthropic(),
    checkApify(),
    checkDataForSEO(),
    checkResend(),
    checkStripe(),
    checkGooglePlaces(),
  ]);

  const ok = checks.every((c) => c.ok);
  const paused = process.env.VIRO_DIAGNOSE_PAUSED === "true";

  return NextResponse.json(
    {
      ok,
      paused,
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - t0,
      checks: checks.map(({ name, ok, latencyMs, detail, balance }) => ({
        name,
        ok,
        latencyMs,
        ...(detail && { detail }),
        ...(balance && { balance }),
      })),
    },
    { status: ok ? 200 : 503 },
  );
}
