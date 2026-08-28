'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import type { StringKey } from '@/lib/i18n';
import { resolveTheme, useSystemTheme } from '@/lib/theme';

/**
 * `prefetch: false` on /help is deliberate. Prefetching pulls the route's RSC
 * payload, which carries the help screenshots' <img> tags — enough for the
 * browser to start downloading a few hundred KB of PNGs on every other page,
 * for a page most visits never open. The screenshots should cost nothing until
 * someone actually asks for help.
 */
const LINKS: { href: string; key: StringKey; prefetch?: false }[] = [
  { href: '/', key: 'home' },
  { href: '/typing', key: 'typing' },
  { href: '/blanks', key: 'blanks' },
  { href: '/voice', key: 'voice' },
  { href: '/listening', key: 'listening' },
  { href: '/test', key: 'test' },
  { href: '/review', key: 'review' },
  { href: '/help', key: 'help', prefetch: false },
];

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function ThemeToggle() {
  const { t, settings, setSettings } = useStore();
  const system = useSystemTheme();
  const effective = resolveTheme(settings.theme, system);

  return (
    <button
      type="button"
      onClick={() => setSettings({ theme: effective === 'dark' ? 'light' : 'dark' })}
      data-help="theme"
      title={effective === 'dark' ? t('switchToLight') : t('switchToDark')}
      aria-label={effective === 'dark' ? t('switchToLight') : t('switchToDark')}
      className="w-9 h-9 grid place-items-center rounded-full border border-border text-muted hover:text-foreground hover:bg-surface-muted transition-colors"
    >
      {effective === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export function Nav() {
  const { t, settings, setLang } = useStore();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link href="/" className="font-semibold tracking-tight shrink-0">
          {t('appName')}
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          <div data-help="lang" className="flex items-center gap-1 rounded-full border border-border p-0.5">
            {(['en', 'ta'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLang(lang)}
                aria-pressed={settings.lang === lang}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  settings.lang === lang
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {lang === 'en' ? 'EN' : 'தமிழ்'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <nav className="max-w-3xl mx-auto px-2 pb-2 overflow-x-auto">
        <ul data-help="modes" className="flex gap-1 text-sm w-max min-w-full">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch={link.prefetch}
                  aria-current={active ? 'page' : undefined}
                  className={`block px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-accent-soft text-accent font-medium'
                      : 'text-muted hover:bg-surface-muted hover:text-foreground'
                  }`}
                >
                  {t(link.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
