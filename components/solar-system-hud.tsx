'use client';

import { useState, type CSSProperties } from 'react';
import { patternsSystem } from '../data/solar-systems';
import type { SolarPhase } from '../lib/solar-system-scene';

export function SolarSystemHud({
  phase,
  selected,
  onSelect,
  onExit,
  onPause,
  onZoom,
}: {
  phase: SolarPhase;
  selected: number | null;
  onSelect: (index: number | null) => void;
  onExit: () => void;
  onPause: (paused: boolean) => void;
  onZoom: (factor: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const navigating = phase === 'entering' || phase === 'leaving';
  const planet = selected === null ? null : patternsSystem.planets[selected];
  return (
    <section
      className="solar-hud"
      aria-label="Solar system navigation"
      data-view={planet ? 'planet' : 'system'}
      data-navigating={navigating}
    >
      <header className="solar-heading">
        <button
          type="button"
          className="solar-back solar-metal"
          onClick={onExit}
          disabled={phase === 'leaving'}
          aria-label="Return to the galaxy"
        >
          ‹ <span>Galaxy</span>
        </button>
        <div className="solar-system-name">
          <span className="solar-eyebrow">
            {navigating
              ? phase === 'entering'
                ? 'Approaching star system'
                : 'Returning to galaxy'
              : 'Lumen system'}
          </span>
          <h1>
            Patterns <i>&</i> Life
          </h1>
        </div>
        <span className="solar-classification">
          G2 <span>★</span>
        </span>
      </header>

      <div
        className="solar-world-labels"
        aria-hidden={navigating || selected !== null}
      >
        {patternsSystem.planets.map((body, index) => (
          <button
            type="button"
            key={body.id}
            data-planet-label={body.id}
            className="solar-world-label"
            tabIndex={-1}
            style={{ '--planet-tint': body.atmosphere } as CSSProperties}
            onClick={() => onSelect(index)}
            aria-label={`Approach ${body.name}`}
            disabled={navigating || selected !== null}
          >
            <i />
            <span>{body.name}</span>
          </button>
        ))}
      </div>

      {!navigating && planet && (
        <article
          className="solar-inspector solar-metal"
          aria-label={`Planet: ${planet.name}`}
        >
          <div className="solar-inspector-top">
            <span className="solar-eyebrow">
              World {String(selected! + 1).padStart(2, '0')} ·{' '}
              {planet.url ? 'Signal found' : 'Uninhabited'}
            </span>
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label="Return to system overview"
            >
              ×
            </button>
          </div>
          <h2>{planet.name}</h2>
          <p className="solar-world-kind">{planet.kind}</p>
          <p className="solar-description">{planet.description}</p>
          {planet.url ? (
            <a
              className="solar-launch"
              href={planet.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit {planet.name} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <p className="solar-uninhabited">
              No transmission. Just a world to explore.
            </p>
          )}
        </article>
      )}

      <footer className="solar-console">
        <div className="solar-console-cap">
          <span>
            {planet ? planet.kind : '5 project worlds · 1 outer giant'}
          </span>
          <span className="solar-flight-hint">
            Drag to orbit · scroll to zoom
          </span>
        </div>
        <nav className="solar-orbit-strip solar-metal" aria-label="Planets">
          <button
            type="button"
            className="solar-sun-button"
            onClick={() => onSelect(null)}
            aria-pressed={selected === null}
            disabled={navigating}
            aria-label="System overview"
          >
            <i />
            <span>Lumen</span>
          </button>
          {patternsSystem.planets.map((body, index) => (
            <button
              type="button"
              key={body.id}
              onClick={() => onSelect(index)}
              aria-label={`Explore ${body.name}`}
              aria-pressed={selected === index}
              disabled={navigating}
              style={
                {
                  '--planet-tint': body.atmosphere,
                  '--planet-land': body.colors[2],
                  '--planet-sea': body.colors[0],
                } as CSSProperties
              }
            >
              <i className={`solar-mini-planet terrain-${body.terrain}`} />
              <span>
                {body.name === 'C. elegans Lab'
                  ? 'C. elegans'
                  : body.name === 'Agar Protocol'
                    ? 'Agar'
                    : body.name}
              </span>
            </button>
          ))}
        </nav>
        <div className="solar-console-foot">
          <span>
            {navigating
              ? 'In transit…'
              : planet
                ? 'Esc · system overview'
                : 'Select a world to approach'}
          </span>
          <span className="solar-console-actions">
            <button
              type="button"
              onClick={() => onZoom(0.85)}
              disabled={navigating}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onZoom(1.18)}
              disabled={navigating}
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(!paused);
                onPause(!paused);
              }}
              aria-pressed={paused}
              aria-label={
                paused ? 'Resume orbital motion' : 'Pause orbital motion'
              }
            >
              {paused ? '▶' : 'Ⅱ'}
            </button>
          </span>
        </div>
      </footer>
      <output className="solar-status sr-only">
        {navigating
          ? phase === 'entering'
            ? 'Entering Patterns and Life'
            : 'Returning to galaxy'
          : planet
            ? `${planet.name}. ${planet.kind}.`
            : 'Patterns and Life system. Select a planet to explore.'}
      </output>
    </section>
  );
}
