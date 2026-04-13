import { z } from "zod";

// ─── Lead Form Schema (Simplified — 2 steps) ────────────────────────
export const leadSchema = z.object({
  // Step 1: Sobre o negócio (mínimo absoluto)
  businessName: z.string().min(2, "Nome do negócio é obrigatório"),
  product: z.string().min(2),
  region: z.string().min(2),
  address: z.string().optional().default(""),
  placeId: z.string().optional().default(""),
  lat: z.number().optional(),
  lng: z.number().optional(),

  // Step 2: Contato + presença digital
  name: z.string().optional().default(""),
  email: z.string().email("Email é obrigatório").min(5, "Email é obrigatório"),
  whatsapp: z.string().optional().default(""),
  instagram: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),

  // Selecionado no step 2 do form
  clientType: z.enum(['b2c', 'b2b', 'b2g', 'mixed']).optional().default('b2c'),
  salesChannel: z.enum(['loja_fisica', 'online', 'servico', 'marketplace', 'direto']).optional().default('servico'),

  // Preserved for pipeline compatibility (auto-filled or defaults)
  differentiator: z.string().optional().default(""),
  noInstagram: z.boolean().optional().default(false),
  site: z.string().optional().default(""),
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
  businessName: "",
  product: "",
  region: "",
  address: "",
  placeId: "",
  name: "",
  email: "",
  whatsapp: "",
  instagram: "",
  linkedin: "",
  clientType: "b2c" as const,
  salesChannel: "servico" as const,
  differentiator: "",
  noInstagram: false,
  site: "",
  channels: [],
  digitalPresence: [],
  customerDescription: "",
  competitors: [],
  ticket: "",
  challenge: "",
  freeText: "",
  locale: "pt",
  coupon: "",
};

// ─── Per-step validation ────────────────────────────────────────────
export const stepValidation = {
  step1: (data: LeadFormData) =>
    data.businessName.length >= 2 &&
    data.product.length >= 2 &&
    data.region.length >= 2,
  step2: (data: LeadFormData) =>
    data.email.length >= 5 && data.email.includes("@"),
};
