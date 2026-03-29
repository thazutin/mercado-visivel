export function NelsonLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40"
      fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Corpo principal — marrom escuro */}
      <ellipse cx="22" cy="26" rx="12" ry="8" fill="#3D2B1A"/>
      {/* Cauda */}
      <path d="M10 26 L4 30 L8 24 Z" fill="#3D2B1A"/>
      {/* Peito âmbar */}
      <ellipse cx="24" cy="27" rx="8" ry="6" fill="#CF8523"/>
      {/* Cabeça */}
      <ellipse cx="13" cy="18" rx="7" ry="6" fill="#3D2B1A"/>
      {/* Bico */}
      <path d="M6 18 L10 16.5 L10 19.5 Z" fill="#5C3D1E"/>
      {/* Óculos — lente esquerda */}
      <circle cx="11" cy="17" r="2.2"
        stroke="#CF8523" strokeWidth="1.2" fill="none"/>
      {/* Óculos — lente direita */}
      <circle cx="15.5" cy="17" r="2.2"
        stroke="#CF8523" strokeWidth="1.2" fill="none"/>
      {/* Ponte dos óculos */}
      <line x1="13.2" y1="17" x2="13.3" y2="17"
        stroke="#CF8523" strokeWidth="1.2"/>
      {/* Olho */}
      <circle cx="10.5" cy="16.5" r="0.7" fill="#CF8523"/>
    </svg>
  );
}
