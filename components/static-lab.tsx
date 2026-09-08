'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { WorldPreview } from './world-comms';
import { destinations } from '@/data/worlds';
import {
  staticEffects,
  staticRevealDelay,
  type StaticEffectId,
} from '@/data/static-lab';

export function StaticLab() {
  const [effect, setEffect] = useState<StaticEffectId>('S8');
  const [minimum, setMinimum] = useState(500);
  const [load, setLoad] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [scale, setScale] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [tint, setTint] = useState('ice');
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hold, setHold] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [replay, setReplay] = useState(0);
  const [copied, setCopied] = useState('');
  const previewRef = useRef<HTMLButtonElement | null>(null);
  const selected = staticEffects.find((item) => item.id === effect)!;
  const ready = !hold && resolved;

  useEffect(() => {
    const syncVisibility = () => setHidden(document.hidden);
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () =>
      document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  useEffect(() => {
    if (hold) return;
    const timer = setTimeout(
      () => setResolved(true),
      staticRevealDelay(minimum, load),
    );
    return () => clearTimeout(timer);
  }, [replay, hold, minimum, load]);

  function startReplay() {
    setResolved(false);
    setHold(false);
    setReplay((value) => value + 1);
  }

  async function copySettings() {
    const settings = `${effect} ${selected.name} | static ${minimum}ms minimum | ${speed.toFixed(1)}x speed | ${scale.toFixed(1)}x grain | ${contrast.toFixed(1)}x contrast | ${tint}`;
    try {
      await navigator.clipboard.writeText(settings);
      setCopied('Copied! Paste your pick into our chat.');
    } catch {
      setCopied(settings);
    }
  }

  return (
    <main
      className="static-lab"
      data-paused={paused || hidden}
      data-tint={tint}
      style={
        {
          '--sl-tick': `${180 / speed}ms`,
          '--sl-roll': `${1600 / speed}ms`,
          '--sl-scale': scale,
          '--sl-contrast': contrast,
        } as CSSProperties
      }
    >
      <div className="sl-workbench">
        <header className="sl-header">
          <div>
            <nav>
              <Link href="/#galaxy">← Galaxy</Link>
              <Link href="/motion-lab">Motion lab ↗</Link>
            </nav>
            <h1>
              Static lab <span>COMMS / 04</span>
            </h1>
            <p>Find your favorite kind of bad reception.</p>
          </div>
          <span className="sl-local">Experiment only · galaxy unchanged</span>
        </header>

        <div className="sl-layout">
          <section
            className="sl-preview"
            aria-label="Static effect preview"
            data-effect={effect}
            data-ready={ready}
          >
            <div className="sl-preview-heading">
              <span>
                {effect} / {selected.name}
              </span>
              <output>
                {ready
                  ? 'SIGNAL ACQUIRED'
                  : hold
                    ? 'HOLDING STATIC'
                    : 'ACQUIRING…'}
              </output>
            </div>
            <div className="sl-monitor">
              <div className="sl-transmission">
                <span>TRANSMISSION RECEIVED</span>
                <strong>hello, world.</strong>
                <span>Alireza’s Galaxy / channel 01</span>
              </div>
              <span
                className="comms-screen-static sl-texture"
                aria-hidden="true"
              />
            </div>
            <div className="sl-card-stage">
              <span className="sl-caption">
                ON YOUR HOVER CARD · CLICK TO REPLAY
              </span>
              <WorldPreview
                world={destinations[0]}
                previewRef={previewRef}
                hint={false}
                contentReady={ready}
                onInspect={startReplay}
              />
            </div>
            <div className="sl-playback">
              <button
                type="button"
                className="sl-primary"
                onClick={startReplay}
              >
                ↻ Replay reveal
              </button>
              <button
                type="button"
                aria-pressed={hold}
                onClick={() => {
                  if (hold) startReplay();
                  else {
                    setHold(true);
                    setResolved(false);
                  }
                }}
              >
                Hold static
              </button>
              <button
                type="button"
                aria-pressed={paused}
                onClick={() => setPaused(!paused)}
              >
                {paused ? 'Resume texture' : 'Pause texture'}
              </button>
            </div>
            <p className="sl-note">
              {selected.description} Replay uses a simulated load of {load}ms
              and a {minimum}ms minimum; reveal at{' '}
              {staticRevealDelay(minimum, load)}ms.
            </p>
          </section>

          <aside className="sl-controls" aria-label="Static tuning">
            <h2>Tune the receiver</h2>
            <label>
              Minimum static <output>{(minimum / 1000).toFixed(2)}s</output>
              <input
                type="range"
                min="100"
                max="1500"
                step="50"
                value={minimum}
                onChange={(e) => {
                  setMinimum(Number(e.target.value));
                  setResolved(false);
                }}
              />
            </label>
            <label>
              Simulated icon load{' '}
              <output>
                {load === 0 ? 'cached' : `${(load / 1000).toFixed(2)}s`}
              </output>
              <input
                type="range"
                min="0"
                max="2500"
                step="100"
                value={load}
                onChange={(e) => {
                  setLoad(Number(e.target.value));
                  setResolved(false);
                }}
              />
            </label>
            <label>
              Texture speed <output>{speed.toFixed(1)}×</output>
              <input
                type="range"
                min="0.3"
                max="2"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </label>
            <label>
              Grain size <output>{scale.toFixed(1)}×</output>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              />
            </label>
            <label>
              Contrast <output>{contrast.toFixed(1)}×</output>
              <input
                type="range"
                min="0.4"
                max="1.5"
                step="0.1"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
              />
            </label>
            <label>
              Tint
              <select value={tint} onChange={(e) => setTint(e.target.value)}>
                <option value="ice">Ice blue</option>
                <option value="green">Terminal green</option>
                <option value="amber">Amber phosphor</option>
                <option value="mono">Monochrome</option>
              </select>
            </label>
            <button type="button" onClick={copySettings}>
              Copy this recipe ↗
            </button>
            <output className="sl-copy">
              {copied || 'Copy a recipe to tell me what you like.'}
            </output>
          </aside>
        </div>

        <section className="sl-presets" aria-label="Choose a static effect">
          {staticEffects.map((item) => (
            <button
              type="button"
              key={item.id}
              data-effect={item.id}
              aria-pressed={effect === item.id}
              onClick={() => {
                setEffect(item.id);
                setCopied('');
                if (!hold) startReplay();
              }}
            >
              <span className="sl-swatch" aria-hidden="true">
                <span className="comms-screen-static sl-texture" />
              </span>
              <span className="sl-preset-title">
                <span>{item.id}</span>
                {item.name}
              </span>
              <span className="sl-preset-description">{item.description}</span>
            </button>
          ))}
        </section>
        <footer className="sl-footer">
          Reduced-motion settings keep textures still. Pause texture freezes the
          pattern; the reveal timer continues. Your recipe is not applied to the
          galaxy.
        </footer>
      </div>
    </main>
  );
}
