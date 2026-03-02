// ============================================================================
// Virô — Event Tracking
// Lightweight funnel analytics via Supabase events table
// ============================================================================

import { createClient } from "@supabase/supabase-js";

export type EventType =
  | "page_view"
  | "form_started"
  | "form_step_completed"
  | "form_completed"
  | "instant_value_viewed"
  | "checkout_initiated"
  | "payment_success"
  | "payment_failed"
  | "dashboard_viewed"
  | "briefing_viewed"
  | "email_opened"
  | "feedback_submitted";

interface TrackEventParams {
  eventType: EventType;
  leadId?: string;
  metadata?: Record<string, any>;
  sessionId?: string;
  locale?: string;
}

// ─── SERVER-SIDE TRACKING ────────────────────────────────────────────
// Use in API routes and server components

export async function trackEvent(params: TrackEventParams): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    await supabase.from("events").insert({
      lead_id: params.leadId || null,
      event_type: params.eventType,
      metadata: params.metadata || {},
      session_id: params.sessionId || null,
      locale: params.locale || "pt",
    });
  } catch (err) {
    // Never break the app for analytics
    console.warn("[Events] Track failed:", (err as Error).message);
  }
}

// ─── CLIENT-SIDE TRACKING ────────────────────────────────────────────
// Use in React components — calls /api/events endpoint

export async function trackEventClient(params: TrackEventParams): Promise<void> {
  try {
    // Use sendBeacon for non-blocking fire-and-forget
    const payload = JSON.stringify({
      eventType: params.eventType,
      leadId: params.leadId,
      metadata: params.metadata,
      sessionId: params.sessionId || getSessionId(),
      locale: params.locale,
    });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", payload);
    } else {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {}); // Swallow errors
    }
  } catch {
    // Never break the app for analytics
  }
}

// ─── SESSION ID ──────────────────────────────────────────────────────
// Simple session tracking without cookies — survives within a tab session

let _sessionId: string | null = null;

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  if (_sessionId) return _sessionId;

  // Check sessionStorage first (persists within tab)
  try {
    _sessionId = sessionStorage.getItem("viro_sid");
    if (!_sessionId) {
      _sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem("viro_sid", _sessionId);
    }
  } catch {
    _sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  return _sessionId;
}

// ─── EVENTS API ROUTE ────────────────────────────────────────────────
// This is the /api/events endpoint that the client-side tracker calls.
// Export for use as: src/app/api/events/route.ts

export { trackEvent as serverTrackEvent };
