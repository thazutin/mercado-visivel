// ============================================================================
// Form Adapter — Converte LeadFormData (frontend) → FormInput (pipeline)
// Isola o form do pipeline: se o form mudar, só este arquivo muda.
// ============================================================================

import type { LeadFormData } from "./schema";
import type { FormInput, DigitalAsset, CompetitorInput } from "../types/pipeline.types";

export function adaptFormToInput(form: LeadFormData, locale: string): FormInput {
  // --- Digital Assets ---
  const digitalAssets: DigitalAsset[] = [];

  if (form.instagram) {
    digitalAssets.push({
      type: "instagram",
      identifier: form.instagram.replace("@", "").trim(),
    });
  }

  if (form.site) {
    digitalAssets.push({
      type: "website",
      identifier: form.site.trim(),
    });
  }

  // Derive from digitalPresence selections
  const presenceMap: Record<string, DigitalAsset["type"]> = {
    "Google Maps / Perfil da Empresa": "google_maps",
    "Google Maps / Business Profile": "google_maps",
    "Google Maps / Perfil de Negocio": "google_maps",
    "TikTok": "tiktok",
    "YouTube": "youtube",
  };

  for (const presence of form.digitalPresence) {
    const assetType = presenceMap[presence];
    if (assetType && !digitalAssets.find(a => a.type === assetType)) {
      digitalAssets.push({ type: assetType, identifier: "" });
    }
  }

  // --- Competitors ---
  const competitors: CompetitorInput[] = form.competitors
    .filter(c => {
      if (typeof c === "string") return c.trim().length > 0;
      return c.name?.trim().length > 0;
    })
    .map(c => {
      if (typeof c === "string") {
        return { name: c.trim() };
      }
      return {
        name: c.name.trim(),
        instagram: c.instagram?.replace("@", "").trim() || undefined,
      };
    });

  // --- Ticket ---
  // Convert from string/number to numeric value
  let ticket = 0;
  if (typeof form.ticket === "number") {
    ticket = form.ticket;
  } else if (typeof form.ticket === "string") {
    const parsed = parseFloat(form.ticket.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!isNaN(parsed)) {
      ticket = parsed;
    } else {
      // Legacy range values fallback
      const rangeMap: Record<string, number> = {
        low: 30,
        mid1: 150,
        mid2: 500,
        high1: 2500,
        high2: 7500,
      };
      ticket = rangeMap[form.ticket] || 0;
    }
  }

  // --- Locale mapping ---
  const localeMap: Record<string, "pt-BR" | "en" | "es"> = {
    pt: "pt-BR",
    en: "en",
    es: "es",
  };

  return {
    businessName: (form as any).name || "",
    product: form.product,
    customerDescription: form.customerDescription || "",
    region: form.region,
    address: form.address || undefined,
    ticket,
    clientType: (form as any).clientType || 'b2c',
    customerSources: form.channels,
    digitalAssets,
    differentiator: form.differentiator,
    competitors,
    challenge: form.challenge,
    freeText: form.freeText || undefined,
    locale: localeMap[locale] || "pt-BR",
    submittedAt: new Date().toISOString(),
  };
}
