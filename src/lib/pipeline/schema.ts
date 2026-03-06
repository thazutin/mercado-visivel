import { z } from "zod";

// ─── Lead Form Schema ───────────────────────────────────────────────
export const leadSchema = z.object({
  product: z.string().min(2),
  customerDescription: z.string().optional().default(""),
  region: z.string().min(2),
  address: z.string().optional().default(""),
  placeId: z.string().optional().default(""),
  lat: z.number().optional(),
  lng: z.number().optional(),
  channels: z.array(z.string()).optional().default([]),
  digitalPresence: z.array(z.string()).optional().default([]),
  instagram: z.string().optional().default(""),
  noInstagram: z.boolean().optional().default(false),
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
  whatsapp: z.string().min(10, "WhatsApp é obrigatório"),
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
  noInstagram: false,
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
export const stepValidation = {
  step1: (data: LeadFormData) =>
    data.product.length >= 2 && data.region.length >= 2,
  step2: (data: LeadFormData) =>
    data.noInstagram || data.instagram.length >= 2,
  step3: (data: LeadFormData) =>
    data.differentiator.length >= 5,
  step4: (data: LeadFormData) =>
    data.email.includes("@") && data.whatsapp.length >= 10,
};
