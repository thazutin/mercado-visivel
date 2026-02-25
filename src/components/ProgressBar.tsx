"use client";

export default function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: i < step ? "#D4582A" : "#E5E0D8",
          transition: "background 0.4s ease",
        }} />
      ))}
    </div>
  );
}
