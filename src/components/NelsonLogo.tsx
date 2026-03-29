export function NelsonLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/nelson.svg"
      alt="Virô"
      width={size}
      height={size}
      style={{ display: 'block' }}
    />
  );
}
