import { z } from "zod";

// ─── Lead Form Schema (Simplified — 2 steps) ────────────────────────
export const leadSchema = z.object({
  // Step 1: Sobre o negócio
  product: z.string().min(2),
  differentiator: z.string().optional().default(""),
  instagram: z.string().optional().default(""),
  noInstagram: z.boolean().optional().default(false),
  site: z.string().optional().default(""),
  region: z.string().min(2),
  address: z.string().optional().default(""),
  placeId: z.string().optional().default(""),
  lat: z.number().optional(),
  lng: z.number().optional(),
  clientType: z.enum(['b2c', 'b2b']).optional().default('b2c'),

  // Step 2: Contato
  email: z.string().email("Email é obrigatório"),
  whatsapp: z.string().min(10, "WhatsApp é obrigatório"),

  // Preserved for pipeline compatibility (auto-filled or defaults)
  customerDescription: z.string().optional().default(""),
  channels: z.array(z.string()).optional().default([]),
  digitalPresence: z.array(z.string()).optional().default([]),
  competitors: z.array(z.object({
    name: z.string(),
    instagram: z.string().optional().default(""),
  })).default([]),
  ticket: z.union([z.string(), z.number()]).default(""),
  challenge: z.string().optional().default(""),
  freeText: z.string().optional().default(""),
  locale: z.string().optional().default("pt"),
  coupon: z.string().optional().default(""),
});

export type LeadFormData = z.infer<typeof leadSchema>;

export const initialFormData: LeadFormData = {
  product: "",
  differentiator: "",
  instagram: "",
  noInstagram: false,
  site: "",
  region: "",
  address: "",
  placeId: "",
  clientType: "b2c" as const,
  channels: [],
  digitalPresence: [],
  customerDescription: "",
  competitors: [],
  ticket: "",
  challenge: "",
  freeText: "",
  email: "",
  whatsapp: "",
  locale: "pt",
  coupon: "",
};

// ─── Per-step validation ────────────────────────────────────────────
export const stepValidation = {
  step1: (data: LeadFormData) =>
    data.product.length >= 2 &&
    data.region.length >= 2 &&
    (data.noInstagram || data.instagram.length >= 2),
  step2: (data: LeadFormData) =>
    data.email.includes("@") && data.whatsapp.length >= 10,
};
