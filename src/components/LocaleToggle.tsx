'use client';

import type { Locale } from '@/lib/i18n';

const LOCALE_LABELS: Record<Locale, string> = {
  pt: 'PT',
  en: 'EN',
  es: 'ES',
};

interface LocaleToggleProps {
  locale: Locale;
  onChange: (locale: Locale) => void;
}

export default function LocaleToggle({ locale, onChange }: LocaleToggleProps) {
  const locales: Locale[] = ['pt', 'en', 'es'];

  return (
    <div style={{ display: 'flex', gap: 2, borderRadius: 8, background: 'rgba(0,0,0,0.05)', padding: 2 }}>
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: locale === l ? 700 : 500,
            color: locale === l ? '#FEFEFF' : '#6E6E78',
            background: locale === l ? '#161618' : 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.15s',
            letterSpacing: '0.04em',
          }}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
