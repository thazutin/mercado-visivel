import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Types ──────────────────────────────────────────────────────────────
export interface Lead {
  id?: string;
  created_at?: string;
  email: string;
  site?: string;
  instagram?: string;
  other_social?: string;
  google_maps?: string;
  product: string;
  region: string;
  ticket?: string;
  channels?: string[];
  differentiator?: string;
  competitors?: string[];
  challenge?: string;
  client_type?: string;
  name?: string;
  linkedin?: string;
  status: "pending" | "processing" | "done" | "paid";
}

export interface DiagnosisResult {
  id?: string;
  lead_id: string;
  created_at?: string;
  terms: SearchTerm[];
  total_volume: number;
  avg_cpc: number;
  market_low: number;
  market_high: number;
  influence_percent: number;
  source: string;
  confidence: string;
}

export interface SearchTerm {
  term: string;
  volume: number;
  cpc: number;
  position: string;
}

// ─── Database Operations ────────────────────────────────────────────────
export async function insertLead(lead: Omit<Lead, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("leads")
    .insert(lead)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLeadStatus(id: string, status: Lead["status"]) {
  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

export async function insertDiagnosis(result: Omit<DiagnosisResult, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("diagnoses")
    .insert(result)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getDiagnosis(leadId: string) {
  const { data, error } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("lead_id", leadId)
    .single();

  if (error) throw error;
  return data as DiagnosisResult;
}
