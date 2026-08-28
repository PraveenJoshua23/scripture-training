'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import hotspots from '@/lib/help-hotspots.json';

interface Marker {
  key: string;
  n: number;
  /** All four in percent of the image, so the overlay scales with it. */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Shot {
  key: string;
  image: string;
  width: number;
  height: number;
  markers: Marker[];
}

const SHOTS = (hotspots as { shots: Record<string, Shot> }).shots;

export function getShot(key: string): Shot | undefined {
  return SHOTS[key];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function Badge({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums ring-2 ring-background transition-colors ${
        active ? 'bg-foreground text-background' : 'bg-accent text-white'
      }`}
    >
      {n}
    </span>
  );
}

/**
 * A screenshot with numbered boxes drawn over the controls it explains.
 *
 * The screenshots themselves carry no drawing, so one image serves English and
 * Tamil alike; the boxes come from `help-hotspots.json`, which the capture
 * script writes from the live layout. Picking a step highlights its box, which
 * is the whole point of the page for a reader who cannot yet name the buttons.
 */
export function AnnotatedShot({ shot, steps }: { shot: string; steps: string[] }) {
  const { t } = useStore();
  const [active, setActive] = useState<number | null>(null);
  const data = getShot(shot);

  if (!data) {
    return <p className="text-sm text-muted">{t('helpMissing')}</p>;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,340px)_1fr] sm:items-start">
      <figure className="relative mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no loader */}
        <img
          src={data.image}
          alt=""
          width={data.width}
          height={data.height}
          loading="lazy"
          decoding="async"
          className="block w-full"
        />

        {data.markers.map((marker) => {
          const on = active === marker.n;
          return (
            <span key={marker.key} aria-hidden>
              <span
                className={`absolute rounded-md border-2 transition-all ${
                  on
                    ? 'border-foreground bg-foreground/10'
                    : active === null
                      ? 'border-accent/70'
                      : 'border-accent/25'
                }`}
                style={{
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  width: `${marker.w}%`,
                  height: `${marker.h}%`,
                }}
              />
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  // Centred on the box's left edge rather than its corner: it
                  // covers less of what it points at, and two boxes stacked
                  // close together get their badges pushed apart.
                  left: `${clamp(marker.x, 5, 95)}%`,
                  top: `${clamp(marker.y + marker.h / 2, 3, 97)}%`,
                }}
              >
                <Badge n={marker.n} active={on} />
              </span>
            </span>
          );
        })}
      </figure>

      <ol className="space-y-2">
        {steps.map((step, index) => {
          const n = index + 1;
          const on = active === n;
          return (
            <li key={n}>
              <button
                type="button"
                onClick={() => setActive(on ? null : n)}
                onMouseEnter={() => setActive(n)}
                onMouseLeave={() => setActive(null)}
                className={`flex w-full gap-3 rounded-xl p-2 text-left transition-colors ${
                  on ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                }`}
              >
                <Badge n={n} active={on} />
                <span className="text-[0.95rem] leading-relaxed">{step}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A plain captioned screenshot — used where one picture needs no callouts. */
export function ShotCard({ shot, label, text }: { shot: string; label: string; text: string }) {
  const data = getShot(shot);
  if (!data) return null;

  return (
    <figure className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no loader */}
        <img
          src={data.image}
          alt=""
          width={data.width}
          height={data.height}
          loading="lazy"
          decoding="async"
          className="block w-full"
        />
      </div>
      <figcaption>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted">{text}</p>
      </figcaption>
    </figure>
  );
}
