// Design Tokens — fonte única de verdade para cores, fontes e espaçamentos
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


  // Marca — da logo Virô (marrom/dourado)
  amber: "#B45309",
  amberSoft: "#D97706",
  amberWash: "rgba(180,83,9,0.06)",
  teal: "#0F766E",
  tealWash: "rgba(15,118,110,0.06)",
  coral: "#DC2626",
  coralWash: "rgba(220,38,38,0.06)",

  // Fontes
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
} as const;
