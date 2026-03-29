export function NelsonLogo({ size = 32, variant = 'dark' }: { size?: number; variant?: 'dark' | 'light' }) {
  return (
    <img
      src={variant === 'light' ? '/nelson-light.svg' : '/nelson.svg'}
      alt="Virô"
      width={size}
      height={size}
      style={{ display: 'block' }}
    />
  );
}
