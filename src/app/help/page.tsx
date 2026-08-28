'use client';

import { AnnotatedShot, ShotCard } from '@/components/AnnotatedShot';
import { HELP_SECTIONS, pick, type Block } from '@/lib/help-content';
import { useStore } from '@/lib/store';
import type { Lang } from '@/lib/types';

function BlockView({ block, lang }: { block: Block; lang: Lang }) {
  switch (block.kind) {
    case 'shot':
      return (
        <AnnotatedShot shot={block.shot} steps={block.steps.map((step) => pick(step, lang))} />
      );

    case 'gallery':
      return (
        <div className="grid gap-5 sm:grid-cols-2">
          {block.items.map((item) => (
            <ShotCard
              key={item.shot}
              shot={item.shot}
              label={pick(item.label, lang)}
              text={pick(item.text, lang)}
            />
          ))}
        </div>
      );

    case 'list':
      return (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-medium">{pick(block.title, lang)}</p>
          <ul className="mt-2 space-y-1.5">
            {block.items.map((item, index) => (
              <li key={index} className="flex gap-2 text-[0.95rem] leading-relaxed">
                <span aria-hidden className="text-accent">
                  •
                </span>
                <span>{pick(item, lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case 'note':
      return (
        <p className="rounded-xl bg-accent-soft p-4 text-[0.95rem] leading-relaxed text-foreground">
          {pick(block.text, lang)}
        </p>
      );
  }
}

export default function HelpPage() {
  const { t, settings } = useStore();
  const lang = settings.lang;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('helpTitle')}</h1>
        <p className="text-muted leading-relaxed">{t('helpIntro')}</p>
        <p className="text-sm text-muted">{t('helpStepHint')}</p>
      </header>

      <nav className="rounded-2xl border border-border bg-surface p-4 print:hidden">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted">{t('helpContents')}</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {HELP_SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-muted"
              >
                <span aria-hidden>{section.emoji}</span>
                {pick(section.title, lang)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {HELP_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-32 space-y-4">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <span aria-hidden>{section.emoji}</span>
              {pick(section.title, lang)}
            </h2>
            <p className="text-muted leading-relaxed">{pick(section.intro, lang)}</p>
          </div>

          {section.blocks.map((block, index) => (
            <BlockView key={index} block={block} lang={lang} />
          ))}
        </section>
      ))}

      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border border-border px-4 py-2 text-sm print:hidden"
      >
        {t('helpPrint')}
      </button>
    </div>
  );
}
