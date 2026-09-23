'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import { solarSystems, type PlanetRecipe } from '@/data/solar-systems';
import { surfaceTuning } from '@/lib/planet-textures';
import { PlanetPreparation } from '@/lib/planet-preparation';
import { createWorldBody } from '@/lib/solar/bodies';
import { drawPlanetMark } from '@/lib/planet-marks';

type Terrain = PlanetRecipe['terrain'];
type Tuning = ReturnType<typeof surfaceTuning>;
type Draft = Pick<
  PlanetRecipe,
  'seed' | 'terrain' | 'colors' | 'atmosphere' | 'rings'
> & { surface: Tuning };

const STORAGE_KEY = 'planet-lab-drafts-v1';
const terrains: { id: Terrain; label: string }[] = [
  { id: 'ocean', label: 'ocean world' },
  { id: 'garden', label: 'garden world' },
  { id: 'desert', label: 'desert world' },
  { id: 'folds', label: 'ice world' },
  { id: 'culture', label: 'colony world' },
  { id: 'gas', label: 'gas giant' },
];
const sliders: {
  key: keyof Tuning;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
}[] = [
  {
    key: 'sea',
    label: 'sea',
    min: 0,
    max: 0.95,
    step: 0.01,
    hint: 'share of surface below sea level',
  },
  {
    key: 'continents',
    label: 'continents',
    min: 0.6,
    max: 3.2,
    step: 0.05,
    hint: 'lower = fewer, bigger landmasses',
  },
  {
    key: 'ice',
    label: 'ice',
    min: 0,
    max: 1,
    step: 0.01,
    hint: 'polar cap reach',
  },
  {
    key: 'clouds',
    label: 'clouds',
    min: 0,
    max: 1,
    step: 0.01,
    hint: 'cloud cover',
  },
  {
    key: 'relief',
    label: 'relief',
    min: 0,
    max: 2.5,
    step: 0.05,
    hint: 'height of terrain in 3D',
  },
  {
    key: 'detail',
    label: 'detail',
    min: 0,
    max: 1,
    step: 0.01,
    hint: 'dunes, ridges, colonies, bands',
  },
];

const worlds = solarSystems.flatMap((system) =>
  system.planets.map((planet) => ({ system, planet })),
);

function draftOf(planet: PlanetRecipe): Draft {
  return {
    seed: planet.seed,
    terrain: planet.terrain,
    colors: [...planet.colors],
    atmosphere: planet.atmosphere,
    rings: planet.rings,
    surface: surfaceTuning(planet),
  };
}

function readDrafts(): Record<string, Draft> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** The pasteable entry for `authoredTerrain` in data/solar-systems.ts. */
function recipeSnippet(planet: PlanetRecipe, draft: Draft) {
  const surface = Object.entries(draft.surface)
    .map(([key, value]) => `${key}: ${round(value)}`)
    .join(', ');
  const lines = [
    `  seed: ${draft.seed},`,
    `  terrain: '${draft.terrain}',`,
    `  colors: [${draft.colors.map((c) => `'${c}'`).join(', ')}],`,
    `  atmosphere: '${draft.atmosphere}',`,
    `  radius: ${planet.radius},`,
    `  phase: ${planet.phase},`,
    ...(planet.moons ? [`  moons: ${planet.moons},`] : []),
    ...(draft.rings ? ['  rings: true,'] : []),
    `  surface: { ${surface} },`,
  ];
  return `// authoredTerrain in data/solar-systems.ts\n'${planet.id}': {\n${lines.map((l) => `  ${l}`).join('\n')}\n},`;
}

function Mark({ planet, size }: { planet: PlanetRecipe; size: number }) {
  const draw = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas) drawPlanetMark(canvas, planet, '#ffda8b');
    },
    [planet],
  );
  return <canvas ref={draw} width={size} height={size} aria-hidden="true" />;
}

function WorldView({ planet }: { planet: PlanetRecipe }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    pivot: THREE.Group;
    star: THREE.Vector3;
    preparation: PlanetPreparation;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 1.2, 9.5);
    camera.lookAt(0, 0, 0);
    // The same lighting recipe as a system: hemisphere fill plus the star.
    scene.add(new THREE.HemisphereLight(0x899bc5, 0x171122, 0.62));
    const star = new THREE.Vector3(-30, 12, 22);
    const light = new THREE.PointLight(0xffe2a0, 3.8, 0, 0);
    light.position.copy(star);
    scene.add(light);
    const pivot = new THREE.Group();
    scene.add(pivot);
    const preparation = new PlanetPreparation();
    stage.current = { renderer, scene, camera, pivot, star, preparation };
    const fit = () => {
      const size = element.clientWidth;
      renderer.setSize(size, size, false);
      renderer.domElement.style.width =
        renderer.domElement.style.height = `${size}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const loop = () => {
      if (!reduce) pivot.rotation.y += 0.0035;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      preparation.dispose();
      pivot.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as
          | THREE.MeshStandardMaterial
          | undefined;
        material?.map?.dispose();
        material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      stage.current = null;
    };
  }, []);

  useEffect(() => {
    const current = stage.current;
    if (!current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setBusy(true);
      // Normalize size so every world fills the same frame.
      const preview = { ...planet, radius: 2.4 };
      current.preparation
        .generate(preview, controller.signal)
        .then((buffers) => {
          const body = createWorldBody(preview, buffers, current.star);
          const old = [...current.pivot.children];
          current.pivot.clear();
          for (const object of old)
            object.traverse((child) => {
              const mesh = child as THREE.Mesh;
              mesh.geometry?.dispose();
              const material = mesh.material as
                | THREE.MeshStandardMaterial
                | undefined;
              if (material) {
                for (const value of Object.values(material))
                  if (value instanceof THREE.Texture) value.dispose();
                material.dispose();
              }
            });
          current.pivot.add(body.surface, body.atmosphere, body.clouds);
          setBusy(false);
        })
        .catch(() => undefined);
    }, 160);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [planet]);

  return (
    <div className="lab-world" ref={host} data-busy={busy}>
      <span className="lab-world-status">
        {busy ? 'generating…' : 'live 3D'}
      </span>
    </div>
  );
}

export function PlanetLab() {
  const [selectedId, setSelectedId] = useState(worlds[0].planet.id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrafts(readDrafts()));
    return () => cancelAnimationFrame(frame);
  }, []);
  const entry = worlds.find(({ planet }) => planet.id === selectedId)!;
  const shipped = entry.planet;
  const draft = drafts[selectedId] ?? draftOf(shipped);
  const edited = Boolean(drafts[selectedId]);
  const planet = useMemo<PlanetRecipe>(
    () => ({ ...shipped, ...draft, surface: draft.surface }),
    [shipped, draft],
  );

  const update = (next: Partial<Draft>) => {
    const merged = { ...draft, ...next };
    const all = { ...drafts, [selectedId]: merged };
    setDrafts(all);
    setCopied(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Drafts are a convenience; the copy button is the durable path.
    }
  };
  const reset = () => {
    const all = { ...drafts };
    delete all[selectedId];
    setDrafts(all);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Ignore unavailable storage.
    }
  };
  const snippet = recipeSnippet(shipped, draft);

  return (
    <main className="planet-lab">
      <header className="lab-head">
        <div>
          <h1>planet lab</h1>
          <p>
            Tune a world, then copy its recipe into{' '}
            <code>data/solar-systems.ts</code>. Drafts stay in this browser;
            nothing ships until the recipe is committed.
          </p>
        </div>
        <Link href="/">back to the galaxy</Link>
      </header>

      <nav className="lab-worlds" aria-label="Worlds">
        {solarSystems.map((system) => (
          <section key={system.id}>
            <h2>{system.name}</h2>
            {system.planets.map((body) => {
              const bodyDraft = drafts[body.id];
              const shown = bodyDraft
                ? { ...body, ...bodyDraft, surface: bodyDraft.surface }
                : body;
              return (
                <button
                  type="button"
                  key={body.id}
                  aria-pressed={body.id === selectedId}
                  onClick={() => {
                    setSelectedId(body.id);
                    setCopied(false);
                  }}
                >
                  <Mark planet={shown} size={36} />
                  <span>{body.name}</span>
                  {bodyDraft && <i>edited</i>}
                </button>
              );
            })}
          </section>
        ))}
      </nav>

      <section className="lab-stage" aria-label={`${shipped.name} preview`}>
        <WorldView planet={planet} />
        <div className="lab-marks">
          <figure>
            <Mark planet={planet} size={112} />
            <figcaption>comms portrait</figcaption>
          </figure>
          <figure>
            <Mark planet={planet} size={52} />
            <figcaption>console socket</figcaption>
          </figure>
        </div>
      </section>

      <section className="lab-controls" aria-label="Surface controls">
        <h2>
          {shipped.name}
          {edited && <small> · edited</small>}
        </h2>
        <label>
          <span>type</span>
          <select
            value={draft.terrain}
            onChange={(event) =>
              update({
                terrain: event.target.value as Terrain,
                surface: surfaceTuning({
                  ...planet,
                  terrain: event.target.value as Terrain,
                  surface: undefined,
                }),
              })
            }
          >
            {terrains.map((terrain) => (
              <option key={terrain.id} value={terrain.id}>
                {terrain.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>seed</span>
          <span className="lab-seed">
            <input
              type="number"
              value={draft.seed}
              onChange={(event) =>
                update({ seed: Math.trunc(Number(event.target.value) || 0) })
              }
            />
            <button
              type="button"
              onClick={() =>
                update({ seed: Math.floor(Math.random() * 99999) })
              }
            >
              reroll
            </button>
          </span>
        </label>
        <fieldset className="lab-palette">
          <legend>palette</legend>
          {draft.colors.map((color, index) => (
            <input
              key={index}
              type="color"
              aria-label={`palette color ${index + 1}`}
              value={color}
              onChange={(event) => {
                const colors = [...draft.colors] as Draft['colors'];
                colors[index] = event.target.value;
                update({ colors });
              }}
            />
          ))}
          <input
            type="color"
            aria-label="atmosphere color"
            title="atmosphere"
            value={draft.atmosphere}
            onChange={(event) => update({ atmosphere: event.target.value })}
          />
        </fieldset>
        {sliders.map((slider) => (
          <label key={slider.key} className="lab-slider" title={slider.hint}>
            <span>
              {slider.label}
              <output>{round(draft.surface[slider.key])}</output>
            </span>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={draft.surface[slider.key]}
              onChange={(event) =>
                update({
                  surface: {
                    ...draft.surface,
                    [slider.key]: Number(event.target.value),
                  },
                })
              }
            />
          </label>
        ))}
        <label className="lab-check">
          <input
            type="checkbox"
            checked={Boolean(draft.rings)}
            onChange={(event) => update({ rings: event.target.checked })}
          />
          <span>rings (icons and portraits)</span>
        </label>
        <div className="lab-actions">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(snippet);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'copied ✓' : 'copy recipe'}
          </button>
          <button type="button" onClick={reset} disabled={!edited}>
            reset to shipped
          </button>
        </div>
        <pre className="lab-snippet" aria-label="Recipe">
          {snippet}
        </pre>
      </section>
    </main>
  );
}
