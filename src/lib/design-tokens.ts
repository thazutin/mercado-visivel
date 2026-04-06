// Design Tokens — fonte única de verdade para cores, fontes, espaçamentos e ícones
// Importar em todos os componentes em vez de definir V inline

export const V = {
  // Neutros — Stone palette (warm, professional)
  night: "#1C1917",
  graphite: "#292524",
  slate: "#78716C",
  zinc: "#A8A29E",
  ash: "#A8A29E",
  mist: "#D6D3D1",
  fog: "#E7E5E3",
  cloud: "#F5F5F4",
  white: "#FAFAF9",

  // Marca — paleta do logo Virô (marrom escuro / dourado quente / cream)
  amber: "#C9913A",
  amberSoft: "#D4A65A",
  amberWash: "rgba(201,145,58,0.06)",
  teal: "#0F766E",
  tealWash: "rgba(15,118,110,0.06)",
  coral: "#9B3B30",
  coralWash: "rgba(155,59,48,0.06)",

  // Fontes
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
} as const;

// Ícones dos pilares — centralizados para fácil troca
// Para desativar emojis: trocar valores por '' (string vazia)
// Para usar SVG: substituir por componente React
export const ICONS = {
  visibilidade: '🔍',
  credibilidade: '⭐',
  presencaDigital: '📣',
  // Process steps
  step1: '📋',
  step2: '🔍',
  step3: '📊',
  step4: '📝',
  step5: '🔄',
} as const;

// Cores dos pilares — fonte única
export const PILAR_COLORS = {
  visibilidade: V.teal,
  credibilidade: V.amber,
  presencaDigital: V.slate,
} as const;
