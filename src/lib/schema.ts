import { z } from "zod";

// ─── Lead Form Schema ───────────────────────────────────────────────
export const leadSchema = z.object({
  product: z.string().min(2),
  customerDescription: z.string().optional().default(""),
  region: z.string().min(2),
  address: z.string().optional().default(""),
  placeId: z.string().optional().default(""),       // Google Places ID
  lat: z.number().optional(),                        // Latitude from Places
  lng: z.number().optional(),                        // Longitude from Places
  channels: z.array(z.string()).optional().default([]),
  digitalPresence: z.array(z.string()).optional().default([]),
  instagram: z.string().optional().default(""),      // Opcional — só aparece se selecionou Instagram
  site: z.string().optional().default(""),
  differentiator: z.string().min(5, "Descreva o que te diferencia"),
  competitors: z.array(z.object({
    name: z.string(),
    instagram: z.string().optional().default(""),
  })).default([{ name: "", instagram: "" }]),
  ticket: z.union([
    z.string(),
    z.number(),
  ]).default(""),
  challenge: z.string().optional().default(""),
  freeText: z.string().optional().default(""),
  email: z.string().email("Email é obrigatório"),
  whatsapp: z.string().optional().default(""),
  locale: z.string().optional().default("pt"),
  coupon: z.string().optional().default(""),
});

export type LeadFormData = z.infer<typeof leadSchema>;

export const initialFormData: LeadFormData = {
  product: "",
  customerDescription: "",
  region: "",
  address: "",
  placeId: "",
  channels: [],
  digitalPresence: [],
  instagram: "",
  site: "",
  differentiator: "",
  competitors: [{ name: "", instagram: "" }, { name: "", instagram: "" }, { name: "", instagram: "" }],
  ticket: "",
  challenge: "",
  freeText: "",
  email: "",
  whatsapp: "",
  locale: "pt",
  coupon: "",
};

// ─── Per-step validation (for disabling "Continue" button) ────────
// Estes são usados no frontend para habilitar/desabilitar o botão "Continuar"
// A validação real do schema acima é mais permissiva para não bloquear submissões
export const stepValidation = {
  step1: (data: LeadFormData) =>
    data.product.length >= 2 && data.region.length >= 2,
  step2: (_data: LeadFormData) =>
    true,  // Step 2 é sempre válido — instagram e presença digital são opcionais
  step3: (data: LeadFormData) =>
    data.differentiator.length >= 5,
  step4: (data: LeadFormData) =>
    data.email.includes("@"),
};
