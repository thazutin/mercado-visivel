import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        "bg-card": "#111118",
        "bg-card-hover": "#16161f",
        accent: "#f0a030",
        "accent-glow": "rgba(240, 160, 48, 0.13)",
        "accent-soft": "#f7c46c",
        green: "#00d4aa",
        "green-glow": "rgba(0, 212, 170, 0.15)",
        "t-text": "#e8e8f0",
        "t-muted": "#8888a0",
        "t-dim": "#555568",
        "t-border": "#222233",
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'Space Mono'", "monospace"],
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease forwards",
        "fade-up-delay": "fadeUp 0.6s ease 0.15s forwards",
        spin: "spin 0.8s linear infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
