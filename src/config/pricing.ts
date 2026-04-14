// Pricing — fonte única de verdade para todos os valores exibidos no produto
// Stripe cobra via CHECKOUT_AMOUNT (env var, centavos). Este arquivo controla apenas o display.

export const PRICING = {
  plan: {
    brl: 49700,
    display: 'R$497',
    displayFull: 'R$ 497',
    label: 'pagamento único',
  },
  subscription: {
    brl: 24700,
    display: 'R$247/mês',
    label: 'assinatura mensal',
  },
  international: {
    usd: 19900,
    display: '$199',
    label: 'one-time payment',
  },
} as const;
