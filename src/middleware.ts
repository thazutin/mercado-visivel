// ============================================================================
// Virô — Clerk Middleware
// Protects /dashboard/* and /admin/* routes
// Rate limiting: /api/diagnose POST apenas — máx 3 submissões por IP/hora
// ============================================================================
// File: src/middleware.ts

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/resultado(.*)",
  "/dashboard(.*)",
  "/api/diagnose(.*)",
  "/api/checkout(.*)",
  "/api/webhook(.*)",
  "/api/events(.*)",
  "/api/feedback(.*)",
  "/api/cron(.*)",
  "/api/agents(.*)",
  "/api/plan(.*)",
  "/api/tasks(.*)",
  "/api/places-autocomplete(.*)",
  "/api/places-details(.*)",
  "/api/contents(.*)",
  "/api/leads(.*)",
  "/api/checklist(.*)",
  "/privacidade",
  "/termos",
]);

// ─── Rate Limit Store (in-memory, por instância Vercel) ───────────────────
// Conta apenas POSTs — GETs de polling não consomem o limite
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) return true;

  entry.count++;
  return false;
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Rate limiting: apenas POST (GET é polling de status, não conta)
  if (req.method === "POST" && req.nextUrl.pathname.startsWith("/api/diagnose")) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em 1 hora." },
        { status: 429 }
      );
    }
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
