'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import type { StringKey } from '@/lib/i18n';

const LINKS: { href: string; key: StringKey }[] = [
  { href: '/', key: 'home' },
  { href: '/typing', key: 'typing' },
  { href: '/blanks', key: 'blanks' },
  { href: '/voice', key: 'voice' },
  { href: '/listening', key: 'listening' },
  { href: '/test', key: 'test' },
  { href: '/review', key: 'review' },
];

export function Nav() {
  const { t, settings, setLang } = useStore();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link href="/" className="font-semibold tracking-tight shrink-0">
          {t('appName')}
        </Link>

        <div className="ml-auto flex items-center gap-1 rounded-full border border-border p-0.5">
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

      <nav className="max-w-3xl mx-auto px-2 pb-2 overflow-x-auto">
        <ul className="flex gap-1 text-sm w-max min-w-full">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
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
