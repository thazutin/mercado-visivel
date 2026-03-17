// ============================================================================
// Virô — Clerk Middleware
// Protects /dashboard/* and /admin/* routes
// Rate limiting: /api/diagnose POST apenas — máx 3 submissões por IP/hora
// Locale detection: x-vercel-ip-country → cookie viro_locale
// ============================================================================
// File: src/middleware.ts

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES } from "@/lib/i18n-config";
import { countryToLocale } from "@/lib/i18n-config";

const RATE_LIMIT_MESSAGES: Record<string, string> = {
  pt: "Muitas requisições. Tente novamente em 1 hora.",
  en: "Too many requests. Try again in 1 hour.",
  es: "Demasiadas solicitudes. Inténtalo de nuevo en 1 hora.",
};

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/resultado(.*)",
  "/api/diagnose(.*)",
  "/api/checkout(.*)",
  "/api/webhook(.*)",
  "/api/events(.*)",
  "/api/feedback(.*)",
  "/api/cron(.*)",
  "/api/plan(.*)",
  "/api/tasks(.*)",
  "/api/places-autocomplete(.*)",
  "/api/places-details(.*)",
  "/privacidade",
  "/termos",
]);

// ─── Rate Limit Store (in-memory, por instância Vercel) ───────────────────
// Conta apenas POSTs — GETs de polling não consomem o limite
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 3;
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
  const response = NextResponse.next();

  // ─── Locale detection: IP country → cookie ────────────────────────────
  const existingLocale = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (!existingLocale || !SUPPORTED_LOCALES.includes(existingLocale as any)) {
    const country = req.headers.get("x-vercel-ip-country") || null;
    const detectedLocale = countryToLocale(country);
    response.cookies.set(LOCALE_COOKIE_NAME, detectedLocale, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
    });
  }

  // ─── Rate limiting: apenas POST (GET é polling de status, não conta) ──
  if (req.method === "POST" && req.nextUrl.pathname.startsWith("/api/diagnose")) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      const locale = req.cookies.get(LOCALE_COOKIE_NAME)?.value || "pt";
      const message = RATE_LIMIT_MESSAGES[locale] || RATE_LIMIT_MESSAGES.pt;
      return NextResponse.json(
        { error: message },
        { status: 429 }
      );
    }
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
