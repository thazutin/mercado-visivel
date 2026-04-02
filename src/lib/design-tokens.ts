// Design Tokens — fonte única de verdade para cores, fontes e espaçamentos
// Importar em todos os componentes em vez de definir V inline

export const V = {
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

  // Fontes
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
} as const;
