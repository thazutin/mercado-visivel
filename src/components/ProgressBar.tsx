"use client";

const T = {
  accent: "#f0a030",
  border: "#222233",
};

export default function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1 mb-10">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="flex-1 h-[3px] rounded-sm transition-colors duration-500"
          style={{ background: i < step ? T.accent : T.border }}
        />
      ))}
    </div>
  );
}
