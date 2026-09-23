'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { PlanetRecipe, SolarSystem } from '../data/solar-systems';
import { worldCatalog, type CatalogWorld } from '../data/worlds';
import { WorldPreview } from './world-comms';
import type { SolarPhase } from '../lib/solar-system-scene';
import { surfaceHeight } from '../lib/planet-textures';

const projectsById: Record<string, CatalogWorld | undefined> =
  Object.fromEntries(worldCatalog.map((world) => [world.id, world]));

const planetPortraits = new WeakMap<PlanetRecipe, ImageData>();

function planetPortrait(planet?: PlanetRecipe, starColor = '#ffda8b') {
  const cached = planet && planetPortraits.get(planet);
  if (cached) return cached;
  const size = 64;
  const image = new ImageData(size, size);
  const palette = (
    planet?.colors ?? [starColor, starColor, '#fff0b2', '#fff9db']
  ).map((hex) => {
    const color = Number.parseInt(hex.slice(1), 16);
    return [(color >>> 16) & 255, (color >>> 8) & 255, color & 255];
  });
  for (let v = 0; v < size; v++)
    for (let u = 0; u < size; u++) {
      const x = (u + 0.5 - size / 2) / (size / 2 - 1);
      const y = (size / 2 - v - 0.5) / (size / 2 - 1);
      const radius = Math.hypot(x, y);
      if (radius >= 1) continue;
      const z = Math.sqrt(1 - radius * radius);
      const height = planet ? surfaceHeight(x, y, z, planet) : 0;
      let value = planet
        ? Math.max(0, Math.min(0.999, (height - 0.23) * 2.2)) * 3
        : 1.4 + z * 1.5;
      if (planet?.terrain === 'garden')
        value =
          height < 0.4
            ? Math.max(0, height - 0.2) * 2
            : 1 + Math.min(1.99, (height - 0.4) * 5);
      if (planet?.terrain === 'ocean')
        value =
          height < 0.565
            ? Math.max(0, height - 0.28) * 4
            : 2 + Math.min(0.99, (height - 0.565) * 14);
      const base = Math.floor(value),
        blend = value - base;
      const light = planet
        ? 0.18 + 0.82 * Math.max(0, -x * 0.5 + y * 0.55 + z * 0.7)
        : 0.78 + z * 0.2;
      const index = (v * size + u) * 4;
      for (let channel = 0; channel < 3; channel++)
        image.data[index + channel] =
          (palette[base][channel] * (1 - blend) +
            palette[Math.min(3, base + 1)][channel] * blend) *
          light;
      image.data[index + 3] = Math.min(1, ((1 - radius) * size) / 2) * 255;
    }
  if (planet) planetPortraits.set(planet, image);
  return image;
}

function SolarPlanetMark({
  planet,
  color,
}: {
  planet?: PlanetRecipe;
  color?: string;
}) {
  const draw = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      // Software-backed pixel upload avoids first-use CSS gradient/shadow shaders.
      canvas
        ?.getContext('2d', { willReadFrequently: true })
        ?.putImageData(planetPortrait(planet, color), 0, 0);
    },
    [planet, color],
  );
  return (
    <i
      className="solar-mini-planet"
      data-rings={planet?.rings || undefined}
      aria-hidden="true"
    >
      <canvas ref={draw} width={64} height={64} />
    </i>
  );
}

function planetStyle(planet: PlanetRecipe): CSSProperties {
  return {
    '--planet-tint': planet.atmosphere,
    '--planet-light': planet.colors[3],
  } as CSSProperties;
}

export function SolarSystemHud({
  system,
  systems,
  phase,
  selected,
  hovered,
  paused,
  onSelect,
  onHover,
  onSystemIntent,
  onSystemChange,
  onExit,
  onPause,
  onZoom,
}: {
  system: SolarSystem;
  systems: SolarSystem[];
  phase: SolarPhase;
  selected: number | null;
  hovered: number | null;
  paused: boolean;
  onSelect: (index: number | null) => void;
  onHover: (index: number | null) => void;
  onSystemIntent: (id: string) => void;
  onSystemChange: (id: string) => void;
  onExit: () => void;
  onPause: (paused: boolean) => void;
  onZoom: (factor: number) => void;
}) {
  const [chartOpen, setChartOpen] = useState(false);
  const chartId = useId();
  const chartButton = useRef<HTMLButtonElement>(null);
  const chart = useRef<HTMLElement>(null);
  const orbitStrip = useRef<HTMLElement>(null);
  const navigating = phase === 'entering' || phase === 'leaving';
  const planet = selected === null ? null : system.planets[selected];
  const projectCount = system.planets.filter((body) => body.url).length;
  const hoverPlanet =
    hovered === null || navigating || chartOpen
      ? null
      : system.planets[hovered];
  const hoverProject = hoverPlanet?.projectId
    ? projectsById[hoverPlanet.projectId]
    : null;
  const previewWorld =
    hoverPlanet && (!hoverPlanet.projectId || hoverProject)
      ? {
          id: hoverProject?.id ?? hoverPlanet.id,
          name: hoverProject?.name ?? hoverPlanet.name,
          kind: hoverProject?.kind ?? hoverPlanet.kind,
          url: hoverProject?.url,
          iconSrc: hoverProject?.iconSrc,
          glyph: hoverProject?.glyph ?? hoverPlanet.name.charAt(0),
          color:
            hoverProject?.color ??
            Number.parseInt(hoverPlanet.atmosphere.slice(1), 16),
        }
      : null;

  const approach = (index: number | null) => {
    onHover(null);
    onSelect(index);
  };
  const leavePreview = (target: EventTarget | null) => {
    if (
      target instanceof Element &&
      target.closest(
        '[data-solar-preview], [data-solar-hover], [data-galaxy-canvas]',
      )
    )
      return;
    onHover(null);
  };

  useEffect(() => {
    if ((chartOpen || navigating) && hovered !== null) onHover(null);
  }, [chartOpen, navigating, hovered, onHover]);

  useEffect(() => {
    if (!chartOpen) return;
    chart.current
      ?.querySelector<HTMLButtonElement>('[aria-current="true"]')
      ?.focus();
    const onChartKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setChartOpen(false);
        chartButton.current?.focus();
        return;
      }
      if (!chart.current?.contains(document.activeElement)) return;
      if (
        ![
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Home',
          'End',
        ].includes(event.key)
      )
        return;
      const entries = [
        ...chart.current.querySelectorAll<HTMLButtonElement>(
          '.solar-chart-list button:not(:disabled)',
        ),
      ];
      if (!entries.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const current = entries.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? entries.length - 1
            : (Math.max(0, current) +
                (event.key === 'ArrowUp' || event.key === 'ArrowLeft'
                  ? -1
                  : 1) +
                entries.length) %
              entries.length;
      entries[next].focus();
    };
    // Capture before scene shortcuts: chart navigation never moves or exits a world.
    window.addEventListener('keydown', onChartKey, true);
    return () => window.removeEventListener('keydown', onChartKey, true);
  }, [chartOpen]);

  useEffect(() => {
    const active = orbitStrip.current?.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]',
    );
    if (!active || !orbitStrip.current) return;
    const strip = orbitStrip.current;
    const left = active.offsetLeft;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    else if (left + active.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = left + active.offsetWidth - strip.clientWidth;
    }
  }, [system.id, selected]);

  return (
    <section
      className="solar-hud"
      aria-label="Solar system navigation"
      data-view={planet ? 'planet' : 'system'}
      data-navigating={navigating}
      style={{ '--star-color': system.star.color } as CSSProperties}
    >
      <header className="solar-heading solar-metal">
        <button
          type="button"
          className="solar-back"
          onClick={onExit}
          disabled={phase === 'leaving'}
          aria-label="Return to the galaxy"
        >
          <span aria-hidden="true">‹</span> Galaxy
        </button>
        <div className="solar-system-name">
          <span className="solar-eyebrow">
            {navigating
              ? phase === 'entering'
                ? 'Approaching system'
                : 'Returning to galaxy'
              : `${system.starName} · ${system.star.classification}`}
          </span>
          <h1>{system.name}</h1>
        </div>
        <button
          ref={chartButton}
          type="button"
          className="solar-chart-toggle"
          aria-label="Choose solar system"
          aria-expanded={chartOpen}
          aria-controls={chartId}
          onClick={() => {
            onHover(null);
            setChartOpen(!chartOpen);
          }}
          disabled={navigating}
        >
          <span aria-hidden="true">✧</span>
          <span>Systems</span>
          <span aria-hidden="true">{chartOpen ? '▴' : '▾'}</span>
        </button>
      </header>

      {chartOpen && (
        <nav
          ref={chart}
          id={chartId}
          className="solar-system-chart solar-metal"
          aria-label="Solar systems"
        >
          <div className="solar-chart-heading">
            <span className="solar-eyebrow">
              System chart · {systems.length} systems
            </span>
            <button
              type="button"
              aria-label="Close system chart"
              onClick={() => {
                setChartOpen(false);
                chartButton.current?.focus();
              }}
            >
              ×
            </button>
          </div>
          <div className="solar-chart-list">
            {systems.map((entry) => (
              <button
                type="button"
                key={entry.id}
                aria-label={`Enter ${entry.name}`}
                aria-current={entry.id === system.id ? 'true' : undefined}
                disabled={navigating}
                style={{ '--star-color': entry.star.color } as CSSProperties}
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'touch') onSystemIntent(entry.id);
                }}
                onFocus={() => onSystemIntent(entry.id)}
                onClick={() => {
                  setChartOpen(false);
                  chartButton.current?.focus();
                  if (entry.id !== system.id) onSystemChange(entry.id);
                }}
              >
                <i className="solar-chart-star" aria-hidden="true" />
                <span className="solar-chart-name">
                  <strong>{entry.name}</strong>
                  <small>
                    {entry.starName} · {entry.star.classification}
                  </small>
                </span>
                <span className="solar-chart-count">
                  {entry.planets.length} worlds
                  <small>
                    {entry.planets.filter((body) => body.url).length} projects
                  </small>
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <div
        className="solar-world-labels"
        aria-hidden={navigating || selected !== null}
      >
        {system.planets.map((body, index) => (
          <button
            type="button"
            key={`${system.id}/${body.id}`}
            data-planet-label={body.id}
            data-solar-hover={index}
            data-attention={hovered === index || undefined}
            className="solar-world-label"
            tabIndex={-1}
            style={planetStyle(body)}
            onPointerEnter={(event) => {
              if (event.pointerType !== 'touch') onHover(index);
            }}
            onPointerLeave={(event) => leavePreview(event.relatedTarget)}
            onFocus={() => onHover(index)}
            onBlur={(event) => leavePreview(event.relatedTarget)}
            onClick={() => approach(index)}
            aria-label={`Approach ${body.name}`}
            disabled={navigating || selected !== null}
          >
            <i aria-hidden="true" />
            <span>{body.shortName || body.name}</span>
          </button>
        ))}
      </div>

      {previewWorld && hovered !== null && (
        <div
          key={`${system.id}/${previewWorld.id}`}
          className="solar-world-preview"
          data-solar-preview
          data-planet-index={hovered}
          onPointerEnter={(event) => {
            if (event.pointerType !== 'touch') onHover(hovered);
          }}
          onPointerLeave={(event) => leavePreview(event.relatedTarget)}
          onFocus={() => onHover(hovered)}
          onBlur={(event) => leavePreview(event.relatedTarget)}
        >
          <WorldPreview
            world={previewWorld}
            hint={false}
            contentReady
            positionReady
            inspectLabel={`Approach ${previewWorld.name}`}
            onInspect={() => approach(hovered)}
          />
        </div>
      )}

      <footer className="solar-console">
        {!navigating && planet && (
          <article
            className="solar-inspector solar-metal"
            aria-label={`Planet: ${planet.name}`}
          >
            <div className="solar-inspector-top">
              <span className="solar-eyebrow">
                {planet.url ? 'Transmission linked' : 'Uninhabited'} ·{' '}
                {system.starName}
              </span>
              <button
                type="button"
                onClick={() => approach(null)}
                aria-label="Return to system overview"
              >
                ×
              </button>
            </div>
            <div className="solar-inspector-screen">
              <div
                className="solar-world-portrait"
                style={planetStyle(planet)}
                aria-hidden="true"
              >
                <SolarPlanetMark planet={planet} />
              </div>
              <div className="solar-world-identity">
                <h2>{planet.name}</h2>
                <p className="solar-world-kind">{planet.kind}</p>
              </div>
              <p className="solar-description">{planet.description}</p>
            </div>
            {planet.url ? (
              <a
                className="solar-launch"
                href={planet.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${planet.name}`}
              >
                <span>Visit {planet.shortName || planet.name}</span>
                <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <p className="solar-uninhabited">Uninhabited · no transmission</p>
            )}
          </article>
        )}
        <div className="solar-console-body solar-metal">
          <div className="solar-console-cap">
            <span>
              {system.starName} <b>·</b> {system.planets.length} worlds <b>·</b>{' '}
              {projectCount} projects
            </span>
            <span className="solar-flight-hint">
              Drag to orbit · scroll to zoom
            </span>
          </div>
          <nav
            ref={orbitStrip}
            className="solar-orbit-strip"
            aria-label="Planets"
          >
            <button
              type="button"
              className="solar-sun-button"
              onClick={() => approach(null)}
              aria-pressed={selected === null}
              disabled={navigating}
              aria-label="System overview"
            >
              <SolarPlanetMark color={system.star.color} />
              <span>{system.starName}</span>
            </button>
            {system.planets.map((body, index) => (
              <button
                type="button"
                key={`${system.id}/${body.id}`}
                data-solar-hover={index}
                data-attention={hovered === index || undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'touch') onHover(index);
                }}
                onPointerLeave={(event) => leavePreview(event.relatedTarget)}
                onFocus={() => onHover(index)}
                onBlur={(event) => leavePreview(event.relatedTarget)}
                onClick={() => approach(index)}
                aria-label={`Explore ${body.name}`}
                aria-pressed={selected === index}
                disabled={navigating}
                style={planetStyle(body)}
              >
                <SolarPlanetMark planet={body} />
                <span>{body.shortName || body.name}</span>
              </button>
            ))}
          </nav>
          <div className="solar-console-foot">
            <span>
              {navigating
                ? phase === 'entering'
                  ? 'Approach vector engaged'
                  : 'Galaxy course engaged'
                : planet
                  ? 'Esc · system overview'
                  : system.star.classification + ' · system overview'}
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
                onClick={() => onPause(!paused)}
                disabled={navigating}
                aria-pressed={paused}
                aria-label={
                  paused ? 'Resume orbital motion' : 'Pause orbital motion'
                }
              >
                {paused ? '▶' : 'Ⅱ'}
              </button>
            </span>
          </div>
        </div>
      </footer>
      <output className="solar-status sr-only">
        {navigating
          ? phase === 'entering'
            ? `Entering ${system.name}`
            : 'Returning to galaxy'
          : planet
            ? `${planet.name}. ${planet.kind}.`
            : `${system.name} system. ${system.planets.length} worlds.`}
      </output>
    </section>
  );
}
