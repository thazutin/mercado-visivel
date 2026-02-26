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
  instagram: z.string().optional().default(""),
  site: z.string().optional().default(""),
  differentiator: z.string().optional().default(""),
  competitors: z.array(z.object({
    name: z.string(),
    instagram: z.string().optional().default(""),
  })).optional().default([{ name: "", instagram: "" }, { name: "", instagram: "" }, { name: "", instagram: "" }]),
  ticket: z.union([z.string(), z.number()]).optional().default(""),
  challenge: z.string().optional().default(""),
  freeText: z.string().optional().default(""),
  email: z.string().email().or(z.literal("")),
  whatsapp: z.string().optional().default(""),       // WhatsApp for CRM
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
