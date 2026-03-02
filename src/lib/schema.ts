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
  instagram: z.string().min(2, "Instagram é obrigatório"),
  site: z.string().optional().default(""),
  differentiator: z.string().min(5, "Descreva o que te diferencia"),
  competitors: z.array(z.object({
    name: z.string(),
    instagram: z.string().optional().default(""),
  })).min(1).refine(
    (arr) => arr.length > 0 && arr[0].name.length >= 2,
    { message: "Informe pelo menos 1 concorrente" }
  ),
  ticket: z.union([
    z.string().min(1, "Ticket médio é obrigatório"),
    z.number().positive("Ticket deve ser maior que zero"),
  ]),
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
    data.instagram.length >= 2,
  step3: (data: LeadFormData) =>
    data.differentiator.length >= 5 &&
    data.competitors.length > 0 &&
    data.competitors[0].name.length >= 2 &&
    (typeof data.ticket === "number" ? data.ticket > 0 : data.ticket.length >= 1),
  step4: (data: LeadFormData) =>
    data.email.includes("@") && data.whatsapp.length >= 10,
};
