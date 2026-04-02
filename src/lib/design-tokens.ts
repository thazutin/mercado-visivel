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
=======
  // Neutros
  night: "#161618",
  graphite: "#232326",
  slate: "#E8E4DE",
  zinc: "#888880",
  ash: "#888880",
  mist: "#C8C8D0",
  fog: "#E8E4DE",
  cloud: "#F7F5F2",
  white: "#FFFFFF",

  // Marca
  amber: "#CF8523",
  amberSoft: "#E6A445",
  amberWash: "rgba(207,133,35,0.06)",
  teal: "#1D9E75",
  tealWash: "rgba(29,158,117,0.08)",
  coral: "#D9534F",
  coralWash: "rgba(217,83,79,0.06)",
>>>>>>> 9321ecb (feat: pipeline resilience, copy/UI cleanup, data evolution & B2B companies)

  // Fontes
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
} as const;
