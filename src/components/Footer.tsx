'use client';

import { useStore } from '@/lib/store';

export function Footer() {
  const { t, dataset } = useStore();

  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 text-xs text-muted space-y-1">
        {dataset && (
          <p>
            {t('attribution')}: {dataset.versionLabel} ({dataset.version}) — {dataset.license}.
          </p>
        )}
        <p>{t('internalNote')}</p>
      </div>
    </footer>
  );
}
