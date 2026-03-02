// ============================================================================
// Virô — Clerk Middleware
// Protects /dashboard/* and /admin/* routes
// Public: landing page, API routes for diagnose/checkout/webhook/events/feedback
// ============================================================================
// File: src/middleware.ts

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/diagnose(.*)",
  "/api/checkout(.*)",
  "/api/webhook(.*)",
  "/api/events(.*)",
  "/api/feedback(.*)",
  "/api/cron(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
