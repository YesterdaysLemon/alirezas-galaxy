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
import { worldComms } from '../data/world-comms';
import { PanelFasteners, WorldPreview } from './world-comms';
import type { SolarPhase } from '../lib/solar/scene';
import { drawPlanetMark } from '../lib/planet-marks';

const projectsById: Record<string, CatalogWorld | undefined> =
  Object.fromEntries(worldCatalog.map((world) => [world.id, world]));

function SolarPlanetMark({
  planet,
  color = '#ffda8b',
  size = 64,
}: {
  planet?: PlanetRecipe;
  color?: string;
  size?: number;
}) {
  const draw = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas) drawPlanetMark(canvas, planet, color);
    },
    [planet, color],
  );
  return (
    <i className="solar-mini-planet" aria-hidden="true">
      <canvas ref={draw} width={size} height={size} />
    </i>
  );
}

function planetStyle(planet: PlanetRecipe): CSSProperties {
  return {
    '--planet-tint': planet.atmosphere,
    '--planet-light': planet.colors[3],
    '--world-color': planet.atmosphere,
  } as CSSProperties;
}

/** The galaxy's own comms casing, carrying a transmission from the selected world. */
function PlanetComms({
  planet,
  system,
  onClose,
}: {
  planet: PlanetRecipe;
  system: SolarSystem;
  onClose: () => void;
}) {
  const project = planet.projectId ? projectsById[planet.projectId] : undefined;
  const message = planet.projectId ? worldComms[planet.projectId] : undefined;
  const [tuned, setTuned] = useState(false);
  useEffect(() => {
    // A brief carrier sweep before the picture locks, as in the galaxy comms.
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setTuned(true), reduce ? 0 : 280);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <article
      className="world-detail solar-comms"
      aria-label={`Planet: ${planet.name}`}
      data-world-id={planet.id}
      data-content-ready={tuned}
      data-position-ready="true"
      style={planetStyle(planet)}
    >
      <div className="comms-top">
        <div className="world-orbit" aria-hidden="true">
          <div className="world-face solar-comms-face">
            <SolarPlanetMark planet={planet} size={112} />
            {project?.iconSrc && (
              // oxlint-disable-next-line next/no-img-element
              <img
                className="solar-comms-badge"
                src={project.iconSrc}
                alt=""
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
            <span className="comms-screen-static" aria-hidden="true" />
          </div>
        </div>
        <div className="world-detail-wing">
          <span className="comms-title-mount" aria-hidden="true" />
          <h2 title={planet.name}>{planet.name}</h2>
          <span className="world-kind">
            {planet.kind} · orbiting {system.starName}
            {planet.status === 'preview' ? ' · preview' : ''}
          </span>
          <p>{message?.intro ?? planet.description}</p>
          <span className="world-address">
            {planet.url
              ? new URL(planet.url).hostname.replace(/^www\./, '')
              : 'Uninhabited · no transmission'}
          </span>
          <PanelFasteners />
          <span className="comms-screen-static" aria-hidden="true" />
        </div>
      </div>
      <div className="comms-coupler" aria-hidden="true">
        <i />
        <b />
        <i />
      </div>
      <div className="world-replies">
        <span className="comms-screen-static" aria-hidden="true" />
        {planet.url ? (
          <a
            href={planet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="world-play"
            aria-label={`Visit ${planet.name}`}
          >
            <span aria-hidden="true" className="comms-response-arrow">
              ▸
            </span>
            <span>
              {planet.status === 'preview' ? 'preview world' : 'open world'}
            </span>
          </a>
        ) : (
          <p className="world-play solar-silent">
            <span>no answer · scenic world</span>
          </p>
        )}
        {message?.source && (
          <a
            href={message.source}
            target="_blank"
            rel="noopener noreferrer"
            className="world-source"
            aria-label={`View source for ${planet.name} (opens in a new tab)`}
          >
            <span aria-hidden="true" className="comms-response-arrow">
              ↗
            </span>
            <span>view source</span>
          </a>
        )}
        <PanelFasteners />
      </div>
      <button
        type="button"
        className="world-close"
        aria-label="Return to system overview"
        onClick={onClose}
      >
        <span className="world-close-symbol" aria-hidden="true">
          ×
        </span>
      </button>
    </article>
  );
}

const inhabited = (system: SolarSystem) =>
  system.planets.filter((body) => body.url).length;

const GALAXY_ICON =
  'M12 12c0-1.7 2.4-2.1 3.3-.6 1.3 2.1-1 4.6-3.6 4.3-3.6-.4-4.9-4.9-2.6-7.6 3-3.4 8.8-2.2 10 2.3';

function Readout({
  system,
  planet,
}: {
  system: SolarSystem;
  planet: PlanetRecipe | null;
}) {
  if (!planet)
    return (
      <div className="solar-readout" aria-live="polite">
        <strong>{system.starName}</strong>
        <span>{system.star.classification}</span>
        <span className="solar-chips">
          <i>{system.planets.length} worlds</i>
          <i>{system.planets.filter((body) => body.url).length} inhabited</i>
        </span>
      </div>
    );
  const moons = planet.moons ?? 0;
  return (
    <div className="solar-readout" aria-live="polite">
      <strong>{planet.name}</strong>
      <span>{planet.kind}</span>
      <span className="solar-chips">
        <i
          data-tone={
            planet.url
              ? planet.status === 'preview'
                ? 'amber'
                : 'lime'
              : 'dim'
          }
        >
          {planet.url
            ? planet.status === 'preview'
              ? 'preview'
              : 'live world'
            : 'scenic'}
        </i>
        {moons > 0 && <i>{moons === 1 ? '1 moon' : `${moons} moons`}</i>}
        {planet.rings && <i>rings</i>}
      </span>
    </div>
  );
}

export function SolarSystemHud({
  system,
  systems,
  phase,
  selected,
  hovered,
  paused,
  randomDisabled,
  onSelect,
  onHover,
  onSystemIntent,
  onSystemChange,
  onPause,
  onZoom,
  onExit,
  onRandom,
  onScopePick,
}: {
  system: SolarSystem;
  systems: SolarSystem[];
  phase: SolarPhase;
  selected: number | null;
  hovered: number | null;
  paused: boolean;
  randomDisabled: boolean;
  onSelect: (index: number | null) => void;
  onHover: (index: number | null) => void;
  onSystemIntent: (id: string) => void;
  onSystemChange: (id: string) => void;
  onPause: (paused: boolean) => void;
  onZoom: (factor: number) => void;
  onExit: () => void;
  onRandom: () => void;
  onScopePick: (clientX: number, clientY: number) => number | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const helm = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const slots = useRef<HTMLElement>(null);
  const scope = useRef<HTMLCanvasElement>(null);
  const navigating = phase === 'entering' || phase === 'leaving';
  const planet = selected === null ? null : system.planets[selected];
  const focus =
    hovered !== null && !navigating
      ? system.planets[hovered]
      : (planet ?? null);
  const hoverPlanet =
    hovered === null || navigating ? null : system.planets[hovered];
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
    // React reports the canvas's nearest React-owned ancestor, the stage, as
    // the related target; the scene then keeps or clears hover by picking.
    if (
      target instanceof Element &&
      target.closest(
        '[data-solar-preview], [data-solar-hover], [data-galaxy-canvas], [data-galaxy-stage]',
      )
    )
      return;
    onHover(null);
  };
  // The menu never outlives a flight in or out.
  const showMenu = menuOpen && !navigating;
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (navigating && hovered !== null) onHover(null);
  }, [navigating, hovered, onHover]);

  useEffect(() => {
    if (!showMenu) return;
    // A pointer anywhere outside the helm closes the ship menu.
    const onPointerDown = (event: PointerEvent) => {
      if (
        !(event.target instanceof Node) ||
        !helm.current?.contains(event.target)
      )
        setMenuOpen(false);
    };
    // Escape closes only the menu: marking it handled keeps the scene's own
    // Escape (planet, then galaxy) from also firing.
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setMenuOpen(false);
      menuButton.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [showMenu]);

  useEffect(() => {
    // Crisp radar at the device's pixel density.
    const canvas = scope.current;
    if (!canvas) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.round(canvas.clientWidth * ratio);
    if (size && canvas.width !== size) canvas.width = canvas.height = size;
  });

  useEffect(() => {
    const active = slots.current?.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]',
    );
    if (!active || !slots.current) return;
    const strip = slots.current;
    const left = active.offsetLeft;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    else if (left + active.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = left + active.offsetWidth - strip.clientWidth;
    }
  }, [system.id, selected]);

  // Laid out after Spore's space-stage HUD: everything hugs the bottom edge.
  // Left, the helm: system tab and galaxy button over the radar, zoom rocker
  // on its rim, and the menu spiral and pause on the rail. Right, the worlds
  // tray and a portrait of whatever the scout is looking at.
  return (
    <section
      className="solar-hud"
      aria-label="Solar system navigation"
      data-view={planet ? 'planet' : 'system'}
      data-navigating={navigating}
      data-phase={phase}
      style={{ '--star-color': system.star.color } as CSSProperties}
    >
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

      {!navigating && planet && (
        <PlanetComms
          key={planet.id}
          planet={planet}
          system={system}
          onClose={() => approach(null)}
        />
      )}

      <footer className="solar-console">
        <span className="solar-rail" aria-hidden="true" />
        <div className="solar-helm" ref={helm}>
          <div className="solar-nametab">
            <i className="solar-nametab-star" aria-hidden="true" />
            <span className="solar-nametab-text">
              <h1>{system.name}</h1>
              <span>
                {phase === 'entering'
                  ? `approaching ${system.starName}`
                  : phase === 'leaving'
                    ? 'returning to the galaxy'
                    : `${system.starName} · ${system.star.classification}`}
              </span>
            </span>
            <button
              type="button"
              className="solar-round solar-galaxy-button"
              aria-label="Return to the galaxy"
              title="Galaxy map"
              disabled={phase === 'leaving'}
              onClick={onExit}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={GALAXY_ICON} />
              </svg>
            </button>
          </div>

          {!navigating && (
            <div className="solar-scope">
              <canvas
                ref={scope}
                data-solar-scope
                data-solar-hover
                width={148}
                height={148}
                aria-hidden="true"
                onPointerMove={(event) => {
                  if (event.pointerType === 'touch') return;
                  const index = onScopePick(event.clientX, event.clientY);
                  if (index !== null) onHover(index);
                }}
                onPointerLeave={(event) => leavePreview(event.relatedTarget)}
                onClick={(event) => {
                  const index = onScopePick(event.clientX, event.clientY);
                  if (index !== null) approach(index);
                }}
              />
              <span className="solar-scope-bezel" aria-hidden="true" />
              <div className="solar-zoom">
                <button
                  type="button"
                  aria-label="Zoom in"
                  title="Closer"
                  onClick={() => onZoom(0.78)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 6v12M6 12h12" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Zoom out"
                  title="Wider"
                  onClick={() => onZoom(1.28)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 12h12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="solar-bar">
            <button
              ref={menuButton}
              type="button"
              className="solar-spiral"
              aria-label="Ship menu"
              aria-expanded={showMenu}
              aria-controls={menuId}
              disabled={navigating}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={GALAXY_ICON} />
                <path d="M4.2 14.6c1.3 3.6 5.7 5.7 9.6 4.4" />
              </svg>
            </button>
            <button
              type="button"
              className="solar-round"
              onClick={() => onPause(!paused)}
              aria-pressed={paused}
              aria-label={
                paused ? 'Resume orbital motion' : 'Pause orbital motion'
              }
              title={paused ? 'Resume' : 'Hold orbits'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {paused ? (
                  <path className="is-filled" d="M8 6.5v11l9-5.5Z" />
                ) : (
                  <path d="M9 7v10M15 7v10" />
                )}
              </svg>
            </button>
          </div>

          {showMenu && (
            <div className="solar-menu" id={menuId}>
              <button
                type="button"
                className="solar-menu-item"
                disabled={randomDisabled}
                onClick={() => {
                  closeMenu();
                  onRandom();
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.8c2.2 0 3.1 3.1 3.8 5.2 2.1-.8 5.2-1.2 5.9.9.7 2.1-2 3.8-3.8 5.2 1.5 1.7 3.2 4.4 1.4 5.8-1.8 1.3-4.2-.8-6.1-2-1.2 1.9-3.1 4.5-5 3.3-1.9-1.2-.4-4.2.3-6.3-2.2-.5-5.4-1.4-5.2-3.6.2-2.2 3.5-2.5 5.7-2.5.2-2.3.7-6 3-6Z" />
                </svg>
                random world
              </button>
              <h2>star systems</h2>
              <nav aria-label="Solar systems">
                {systems.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    className="solar-star-slot"
                    aria-label={`Enter ${entry.name}`}
                    aria-current={entry.id === system.id ? 'true' : undefined}
                    style={
                      { '--star-color': entry.star.color } as CSSProperties
                    }
                    onPointerEnter={(event) => {
                      if (event.pointerType !== 'touch')
                        onSystemIntent(entry.id);
                    }}
                    onFocus={() => onSystemIntent(entry.id)}
                    onClick={() => {
                      closeMenu();
                      if (entry.id !== system.id) onSystemChange(entry.id);
                    }}
                  >
                    <i aria-hidden="true" />
                    <span>
                      <strong>{entry.name}</strong>
                      <small>
                        {entry.starName} ·{' '}
                        {inhabited(entry) === 1
                          ? '1 world'
                          : `${inhabited(entry)} worlds`}
                      </small>
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>

        {!navigating && (
          <div className="solar-deck">
            <Readout system={system} planet={focus} />
            <div className="solar-tray">
              <nav ref={slots} className="solar-slots" aria-label="Planets">
                <button
                  type="button"
                  className="solar-socket solar-sun-button"
                  onClick={() => approach(null)}
                  aria-pressed={selected === null}
                  aria-label="System overview"
                  title={`${system.starName} · system overview`}
                >
                  <SolarPlanetMark color={system.star.color} size={52} />
                </button>
                {system.planets.map((body, index) => (
                  <button
                    type="button"
                    key={`${system.id}/${body.id}`}
                    className="solar-socket"
                    data-solar-hover={index}
                    data-attention={hovered === index || undefined}
                    onPointerEnter={(event) => {
                      if (event.pointerType !== 'touch') onHover(index);
                    }}
                    onPointerLeave={(event) =>
                      leavePreview(event.relatedTarget)
                    }
                    onFocus={() => onHover(index)}
                    onBlur={(event) => leavePreview(event.relatedTarget)}
                    onClick={() => approach(index)}
                    aria-label={`Explore ${body.name}`}
                    aria-pressed={selected === index}
                    style={planetStyle(body)}
                  >
                    <SolarPlanetMark planet={body} size={52} />
                  </button>
                ))}
              </nav>
              <div className="solar-card" aria-hidden="true">
                <SolarPlanetMark
                  key={focus?.id ?? 'star'}
                  planet={focus ?? undefined}
                  color={system.star.color}
                  size={96}
                />
              </div>
            </div>
          </div>
        )}
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
