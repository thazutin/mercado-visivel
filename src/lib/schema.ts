import { z } from "zod";

export const leadSchema = z.object({
  // Step 1: The business
  product: z.string().min(3, "Descreva seu produto ou serviço"),
  region: z.string().min(3, "Informe sua região"),
  address: z.string().optional().default(""),

  // Step 2: How customers find them
  channels: z.array(z.string()).optional().default([]),
  digitalPresence: z.array(z.string()).optional().default([]),
  instagram: z.string().optional().default(""),
  site: z.string().optional().default(""),

  // Step 3: Business vision
  differentiator: z.string().optional().default(""),
  competitors: z.array(z.string()).optional().default(["", "", ""]),
  ticket: z.string().optional().default(""),

  // Step 4: Final
  challenge: z.string().optional().default(""),
  freeText: z.string().optional().default(""), // Campo aberto — tensões, contexto, voz real
  email: z.string().email("Email inválido"),

  // Meta
  locale: z.string().optional().default("pt"),
  coupon: z.string().optional().default(""),
});

export type LeadFormData = z.infer<typeof leadSchema>;

export const initialFormData: LeadFormData = {
  product: "",
  region: "",
  address: "",
  channels: [],
  digitalPresence: [],
  instagram: "",
  site: "",
  differentiator: "",
  competitors: ["", "", ""],
  ticket: "",
  challenge: "",
  freeText: "",
  email: "",
  locale: "pt",
  coupon: "",
};
