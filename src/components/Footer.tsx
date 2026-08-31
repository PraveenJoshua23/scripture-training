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
        {dataset?.version === 'NASB' && (
          <p>
            Scripture quotations taken from the New American Standard Bible® (NASB® 1995)
            Copyright © 1960, 1971, 1977, 1995 by The Lockman Foundation. Used by permission. All
            rights reserved.{' '}
            <a
              href="https://www.Lockman.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              www.Lockman.org
            </a>
          </p>
        )}
        <p>{t('internalNote')}</p>
      </div>
    </footer>
  );
}
