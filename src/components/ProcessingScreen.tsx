"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/hooks/useLocale";

const V = {
  night: "#161618",
  graphite: "#232326",
  slate: "#3A3A40",
  zinc: "#6E6E78",
  ash: "#9E9EA8",
  mist: "#C8C8D0",
  fog: "#EAEAEE",
  cloud: "#F4F4F7",
  white: "#FEFEFF",
  amber: "#CF8523",
  amberWash: "rgba(207,133,35,0.08)",
  teal: "#2D9B83",
  tealWash: "rgba(45,155,131,0.08)",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

interface Props {
  product: string;
  region?: string;
  businessName?: string;
  onComplete: () => void;
  steps?: string[];
}

export default function ProcessingScreen({ product, region, businessName, onComplete, steps: _customSteps }: Props) {
  const { t } = useLocale();
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);

  const facts: { text: string; source: string }[] = t.processingFacts || [];
  const messages: string[] = t.processingMessages || [];

  const [factIdx, setFactIdx] = useState(() => Math.floor(Math.random() * Math.max(facts.length, 1)));
  const [factVisible, setFactVisible] = useState(true);

  // Progress ring animation: 0→100 over 60s
  useEffect(() => {
    const duration = 60_000;
    const interval = 100;
    const step = 100 / (duration / interval);
    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          onComplete();
          return 100;
        }
        return next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, []);

  // Rotating processing message every 4s
  useEffect(() => {
    if (messages.length === 0) return;
    const interval = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIdx(prev => (prev + 1) % messages.length);
        setMsgVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, [messages.length]);

  // Fact carousel every 8s
  useEffect(() => {
    if (facts.length === 0) return;
    const interval = setInterval(() => {
      setFactVisible(false);
      setTimeout(() => {
        setFactIdx(prev => (prev + 1) % facts.length);
        setFactVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, [facts.length]);

  const displayName = businessName || product;
  const currentFact = facts[factIdx] || { text: "", source: "" };

  // SVG ring
  const size = 160;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div id="viro-processing-screen" style={{
      minHeight: "100vh",
      background: V.night,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
    }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        {/* Title */}
        <h2 style={{
          fontFamily: V.display, fontSize: 22, fontWeight: 700,
          color: V.white, letterSpacing: "-0.03em", marginBottom: 6,
        }}>
          {t.processingTitle(displayName)}
        </h2>
        {region && (
          <p style={{ color: V.ash, fontSize: 13, margin: "0 0 8px" }}>
            {region}
          </p>
        )}
        <p style={{ color: V.zinc, fontSize: 12, fontFamily: V.mono, marginBottom: 32 }}>
          {t.processingWait}
        </p>

        {/* Progress Ring */}
        <div style={{ position: "relative", width: size, height: size, margin: "0 auto 24px" }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={V.graphite} strokeWidth={strokeWidth} />
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={V.amber} strokeWidth={strokeWidth}
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.1s linear" }} />
          </svg>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: 36, animation: "spin 3s linear infinite" }}>
            🔍
          </div>
        </div>

        {/* Rotating message */}
        <div style={{ minHeight: 24, marginBottom: 32 }}>
          <p style={{
            fontSize: 14, color: V.mist, fontFamily: V.body,
            opacity: msgVisible ? 1 : 0, transition: "opacity 0.3s ease", margin: 0,
          }}>
            {messages[msgIdx] || ""}
          </p>
        </div>

        {/* Fact card */}
        {currentFact.text && (
          <div style={{
            padding: "16px 20px", background: V.graphite, borderRadius: 10,
            border: `1px solid ${V.slate}`, minHeight: 76,
            display: "flex", flexDirection: "column", justifyContent: "center",
          }}>
            <div style={{ opacity: factVisible ? 1 : 0, transition: "opacity 0.4s ease" }}>
              <p style={{ fontSize: 13, color: V.white, margin: "0 0 6px", lineHeight: 1.5, fontFamily: V.body }}>
                {currentFact.text}
              </p>
              <p style={{ fontSize: 10, color: V.ash, margin: 0, fontFamily: V.mono, letterSpacing: "0.02em", opacity: 0.7 }}>
                {t.processingSource}: {currentFact.source}
              </p>
            </div>
          </div>
        )}

        {/* Notification */}
        <p style={{ color: V.ash, fontSize: 11, fontFamily: V.body, marginTop: 20 }}>
          {t.processingEmailNote}
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
