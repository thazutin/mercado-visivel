// ============================================================================
// Virô — Error Handling Utilities
// Retry logic, error reporting, graceful degradation
// ============================================================================
// File: src/lib/error-handling.ts

// ─── RETRY WITH BACKOFF ──────────────────────────────────────────────

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxRetries) {
        console.error(`[${label}] All ${maxRetries} attempts failed:`, lastError.message);
        throw lastError;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      console.warn(`[${label}] Attempt ${attempt}/${maxRetries} failed: ${lastError.message}. Retrying in ${delay}ms...`);
      onRetry?.(attempt, lastError);
      await sleep(delay);
    }
  }

  throw lastError;
}

// ─── SAFE EXECUTE (never throws) ─────────────────────────────────────

interface SafeResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  durationMs: number;
}

export async function safeExecute<T>(
  fn: () => Promise<T>,
  label: string,
  timeoutMs?: number
): Promise<SafeResult<T>> {
  const start = Date.now();
  try {
    const promise = fn();
    const result = timeoutMs
      ? await Promise.race([
          promise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ])
      : await promise;

    return {
      ok: true,
      data: result,
      error: null,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[${label}] Failed:`, error);
    return {
      ok: false,
      data: null,
      error,
      durationMs: Date.now() - start,
    };
  }
}

// ─── PIPELINE ERROR REPORTING ────────────────────────────────────────

export interface PipelineError {
  step: string;
  source: string;
  error: string;
  recoverable: boolean;
  fallbackUsed: string;
  timestamp: string;
}

const pipelineErrors: PipelineError[] = [];

export function reportPipelineError(error: Omit<PipelineError, "timestamp">): void {
  const entry: PipelineError = {
    ...error,
    timestamp: new Date().toISOString(),
  };
  pipelineErrors.push(entry);

  // Log for monitoring
  console.error(`[PipelineError] ${error.step} (${error.source}): ${error.error} | Recoverable: ${error.recoverable} | Fallback: ${error.fallbackUsed}`);

  // If Sentry is configured, send there too
  if (typeof globalThis !== "undefined" && (globalThis as any).Sentry) {
    (globalThis as any).Sentry.captureException(new Error(`Pipeline: ${error.step} — ${error.error}`), {
      tags: { step: error.step, source: error.source, recoverable: String(error.recoverable) },
      extra: { fallbackUsed: error.fallbackUsed },
    });
  }
}

export function getPipelineErrors(): PipelineError[] {
  return [...pipelineErrors];
}

export function clearPipelineErrors(): void {
  pipelineErrors.length = 0;
}

// ─── ALERT SYSTEM (for admin notification) ───────────────────────────

export interface Alert {
  type: "error" | "warning" | "info";
  source: string;
  message: string;
  leadId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

/**
 * Send an alert to admin. Currently logs + saves to Supabase.
 * Future: Slack webhook, email to admin, etc.
 */
export async function sendAlert(alert: Omit<Alert, "timestamp">): Promise<void> {
  const entry: Alert = { ...alert, timestamp: new Date().toISOString() };

  console.log(`[Alert] ${alert.type.toUpperCase()}: ${alert.source} — ${alert.message}`);

  // Save to Supabase events table as a trackable event
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    await supabase.from("events").insert({
      lead_id: alert.leadId || null,
      event_type: "feedback_submitted", // Reusing closest event type
      metadata: {
        _is_alert: true,
        alert_type: alert.type,
        alert_source: alert.source,
        alert_message: alert.message,
        ...alert.metadata,
      },
    });
  } catch {
    // Alerts failing should never break anything
  }
}

// ─── UTILS ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validates that required env vars are set.
 * Returns missing vars or empty array if all present.
 */
export function validateEnvVars(required: string[]): string[] {
  return required.filter((key) => !process.env[key]);
}
