// ============================================================================
// Virô — Auth Utilities
// Clerk user management: create after payment, link to lead
// ============================================================================
// File: src/lib/auth.ts

import { clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Create a Clerk user from a lead's email after payment.
 * If user already exists (same email), link the lead to existing user.
 * Returns the Clerk user ID.
 */
export async function createOrLinkClerkUser(leadId: string, email: string): Promise<string> {
  const clerk = await clerkClient();
  const supabase = getSupabase();

  // Check if user already exists
  const existingUsers = await clerk.users.getUserList({
    emailAddress: [email],
  });

  let clerkUserId: string;

  if (existingUsers.data.length > 0) {
    // User exists — link
    clerkUserId = existingUsers.data[0].id;
    console.log(`[Auth] Existing Clerk user found: ${clerkUserId} for ${email}`);
  } else {
    // Create new user with magic link flow
    const newUser = await clerk.users.createUser({
      emailAddress: [email],
      skipPasswordRequirement: true,
    });
    clerkUserId = newUser.id;
    console.log(`[Auth] New Clerk user created: ${clerkUserId} for ${email}`);
  }

  // Link lead to Clerk user
  await supabase
    .from("leads")
    .update({ clerk_user_id: clerkUserId })
    .eq("id", leadId);

  return clerkUserId;
}

/**
 * Get lead IDs associated with a Clerk user (by email).
 * A user might have multiple leads (multiple diagnoses).
 */
export async function getLeadsForUser(clerkUserId: string): Promise<string[]> {
  const supabase = getSupabase();

  // First try direct clerk_user_id match
  const { data: directMatch } = await supabase
    .from("leads")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  if (directMatch && directMatch.length > 0) {
    return directMatch.map((l) => l.id);
  }

  // Fallback: match by email
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(clerkUserId);
  const email = user.emailAddresses[0]?.emailAddress;

  if (!email) return [];

  const { data: emailMatch } = await supabase
    .from("leads")
    .select("id")
    .eq("email", email)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  return emailMatch?.map((l) => l.id) || [];
}

/**
 * Send magic link sign-in email via Clerk.
 * Called after payment to give user access to dashboard.
 */
export async function sendMagicLinkEmail(
  email: string,
  redirectUrl: string
): Promise<void> {
  const clerk = await clerkClient();

  try {
    await clerk.signInTokens.createSignInToken({
      userId: (await clerk.users.getUserList({ emailAddress: [email] })).data[0]?.id || "",
      expiresInSeconds: 60 * 60 * 24 * 7, // 7 days
    });
    console.log(`[Auth] Magic link token created for ${email}`);
  } catch (err) {
    console.error("[Auth] Failed to create sign-in token:", err);
    // Non-fatal — user can still sign in manually
  }
}
