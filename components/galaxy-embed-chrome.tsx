'use client';

/* oxlint-disable next/no-img-element -- Keep the local SVG unmodified in Vinext. */

import {
  solarSystems,
  systemHref,
  type SolarSystem,
} from '@/data/solar-systems';
import type { Destination } from '@/data/worlds';
import type { SolarPhase } from '@/lib/solar/scene';

/** Compact controls around the same galaxy and solar-system scene. */
export function GalaxyEmbedChrome({
  system,
  selected,
  directWorld,
  phase,
  paused,
  unavailable,
  onSystem,
  onSelect,
  onGalaxy,
  onRandom,
  onPause,
}: {
  system: SolarSystem | null;
  selected: number | null;
  directWorld: Destination | null;
  phase: SolarPhase;
  paused: boolean;
  unavailable: boolean;
  onSystem: (id: string) => void;
  onSelect: (index: number | null) => void;
  onGalaxy: () => void;
  onRandom: () => void;
  onPause: () => void;
}) {
  const navigating = phase === 'entering' || phase === 'leaving';
  const world =
    system && selected !== null ? system.planets[selected] : directWorld;
  const fullHref =
    system && phase !== 'leaving'
      ? `/${systemHref(system.id, selected === null ? undefined : system.planets[selected]?.id)}`
      : '/#galaxy';
  const message =
    phase === 'entering'
      ? `Diving toward ${system?.starName}…`
      : phase === 'leaving'
        ? 'Returning to the galaxy…'
        : world
          ? world.description
          : system
            ? `${system.name} · pick a world`
            : 'Everything I build becomes a planet. Pick a star.';

  return (
    <>
      <header className="galaxy-embed-header">
        <h1>
          <img src="/spiral-galaxy.svg" alt="" width={28} height={28} />
          Alireza&apos;s Galaxy
        </h1>
        <button
          type="button"
          className="galaxy-embed-pause"
          onClick={onPause}
          aria-label={paused ? 'Resume motion' : 'Pause motion'}
          aria-pressed={paused}
          title={paused ? 'Resume motion' : 'Pause motion'}
          disabled={unavailable}
        >
          <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
        </button>
        <a
          href={fullHref}
          target="_blank"
          rel="noopener"
          aria-label="Open full galaxy"
        >
          Open ↗
        </a>
      </header>
      <footer className="galaxy-embed-controls" aria-label="Explore the galaxy">
        <div className="galaxy-embed-actions">
          {system || directWorld ? (
            <>
              <button
                type="button"
                className="galaxy-embed-back"
                onClick={onGalaxy}
                disabled={navigating}
                aria-label="Return to the galaxy"
                title="Return to the galaxy"
              >
                ←
              </button>
              {system ? (
                <select
                  aria-label="Choose a world"
                  value={selected ?? ''}
                  disabled={navigating || unavailable}
                  onChange={(event) =>
                    onSelect(
                      event.target.value === ''
                        ? null
                        : Number(event.target.value),
                    )
                  }
                >
                  <option value="">{system.starName} · all worlds</option>
                  {system.planets.map((planet, index) => (
                    <option key={planet.id} value={index}>
                      {planet.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="galaxy-embed-world-name">{world?.name}</span>
              )}
              {world && !navigating && (
                <a
                  className="galaxy-embed-visit"
                  href={world.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${world.name}`}
                >
                  Visit ↗
                </a>
              )}
            </>
          ) : (
            <>
              <select
                aria-label="Choose a star system"
                value=""
                disabled={unavailable}
                onChange={(event) => onSystem(event.target.value)}
              >
                <option value="" disabled>
                  Pick a star…
                </option>
                {solarSystems.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} · {entry.starName}
                  </option>
                ))}
              </select>
              <button type="button" onClick={onRandom} disabled={unavailable}>
                Surprise me
              </button>
            </>
          )}
        </div>
        <p aria-live="polite">{message}</p>
      </footer>
    </>
  );
}
