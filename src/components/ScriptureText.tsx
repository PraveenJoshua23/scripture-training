'use client';

import { useStore } from '@/lib/store';

/** Renders verse text at the user's chosen size with the right script face. */
export function ScriptureText({
  text,
  className = '',
  children,
}: {
  text?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { settings } = useStore();

  return (
    <p
      className={`scripture-${settings.lang} leading-relaxed ${className}`}
      style={{ fontSize: `${settings.fontSize}px` }}
      lang={settings.lang}
    >
      {children ?? text}
    </p>
  );
}
