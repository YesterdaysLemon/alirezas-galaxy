'use client';

/* oxlint-disable next/no-img-element -- Reuse the site's exact artwork in the lab. */
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
import { destinations } from '@/data/worlds';
import { WorldComms } from '@/components/world-comms';
import { CommsPresence } from '@/components/comms-presence';
import {
  confirmedMotionPicks,
  describeMotionPicks,
  motionFamilies,
  motionProposals,
  validMotionPicks,
  type MotionFamily,
} from '@/data/motion-lab';

const PICKS_KEY = 'galaxy-motion-lab-picks-v1';
const pickListeners = new Set<() => void>();
let sessionPicks = '[]';
function readPicks() {
  try {
    return localStorage.getItem(PICKS_KEY) ?? sessionPicks;
  } catch {
    return sessionPicks;
  }
}
function subscribePicks(listener: () => void) {
  pickListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    pickListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
function savePicks(picks: string[]) {
  sessionPicks = JSON.stringify(picks);
  try {
    localStorage.setItem(PICKS_KEY, sessionPicks);
  } catch {
    /* Session-only picks still work. */
  }
  pickListeners.forEach((listener) => listener());
}
function subscribeMotion(listener: () => void) {
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
const readMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverPicks = () => '[]';
const serverMotion = () => false;

function Specimen({ family }: { family: MotionFamily }) {
  if (family === 'world' || family === 'entry')
    return (
      <span
        className={`world-preview ml-world${family === 'entry' ? ' ml-entry' : ''}`}
        data-world-id="portfolio"
      >
        <span className="world-preview-orbit">
          <span className="world-preview-face">
            <img src={destinations[0].iconSrc} alt="" />
            {family === 'entry' && <span className="ml-entry-static" />}
          </span>
        </span>
        <span className="world-preview-screen">
          <span className="world-preview-label">
            <span className="ml-name-text">Alireza Afshan</span>
            {family === 'entry' && <span className="ml-entry-static" />}
          </span>
          <span className="world-preview-address">
            <span className="world-preview-address-text">
              portfolio.alirezaafshan.com
            </span>
            {family === 'entry' && <span className="ml-entry-static" />}
          </span>
        </span>
      </span>
    );
  if (family === 'menu')
    return (
      <span className="spore-menu-item ml-menu">
        <span className="ml-menu-light" />
        <img src="/spiral-galaxy.svg" className="ml-menu-icon" alt="" />
        <span className="ml-menu-label">random world</span>
      </span>
    );
  if (family === 'reply')
    return (
      <span className="world-replies ml-replies">
        <span className="world-play">
          <span className="comms-response-arrow">▸</span>open world
        </span>
        <span className="comms-fasteners">
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>
    );
  if (family === 'close')
    return (
      <span className="ml-close-mount">
        <span className="ml-close-halo" />
        <span className="world-close">
          <span className="ml-close-symbol">×</span>
        </span>
      </span>
    );
  if (family === 'footer')
    return (
      <span className="ml-footer">
        <span className="dock-orb">
          <img src="/spiral-galaxy.svg" alt="" />
        </span>
        <span className="dock-console">
          <span className="dock-mode-lights">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="ml-readout">signal received</span>
          <span className="dock-tuner">↻</span>
        </span>
      </span>
    );
  return (
    <span className="ml-beacon">
      <img className="ml-far-galaxy" src="/spiral-galaxy.svg" alt="" />
      <span className="ml-beacon-ring ml-ring-one" />
      <span className="ml-beacon-ring ml-ring-two" />
      <svg viewBox="0 0 24 24" className="ml-beacon-star">
        <path d="M12 1 14.5 9.5 23 12 14.5 14.5 12 23 9.5 14.5 1 12 9.5 9.5Z" />
      </svg>
    </span>
  );
}

function ModalSpecimen() {
  const detailRef = useRef<HTMLElement>(null);
  return (
    <WorldComms
      world={destinations[0]}
      detailRef={detailRef}
      onClose={() => undefined}
    />
  );
}

function HandoffBench({ reduced }: { reduced: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const previewRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  return (
    <section
      className="ml-handoff"
      aria-label="Arrival and departure playground"
    >
      <h2>Arrive, leave, interrupt</h2>
      <p>
        Hover between worlds, then move away. Click a world to open comms;
        switch or close at any point.
      </p>
      <div
        className="ml-handoff-choices"
        onPointerLeave={() => {
          if (!opened) setSelected(null);
        }}
      >
        {destinations.slice(0, 3).map((world, index) => (
          <button
            key={world.id}
            type="button"
            onPointerEnter={() => setSelected(index)}
            onFocus={() => setSelected(index)}
            onClick={() => {
              setSelected(index);
              setOpened(true);
            }}
          >
            {world.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setOpened(false);
            setSelected(null);
          }}
        >
          Close / clear
        </button>
      </div>
      <div className="ml-handoff-stage spore-shell">
        <CommsPresence
          kind="preview"
          reducedMotion={reduced}
          world={!opened && selected !== null ? destinations[selected] : null}
          anchorRef={previewRef}
          onAction={() => setOpened(true)}
        />
        <CommsPresence
          kind="detail"
          reducedMotion={reduced}
          world={opened && selected !== null ? destinations[selected] : null}
          anchorRef={detailRef}
          onAction={() => {
            setOpened(false);
            setSelected(null);
          }}
        />
      </div>
    </section>
  );
}

export function MotionLab() {
  const [filter, setFilter] = useState<MotionFamily | 'all' | 'picks'>('modal');
  const savedPicks = useSyncExternalStore(
    subscribePicks,
    readPicks,
    serverPicks,
  );
  let picks: string[] = [];
  try {
    picks = validMotionPicks(JSON.parse(savedPicks));
  } catch {
    /* Ignore malformed saved preferences. */
  }
  const [speed, setSpeed] = useState('1');
  const systemReduced = useSyncExternalStore(
    subscribeMotion,
    readMotion,
    serverMotion,
  );
  const [previewReduced, setPreviewReduced] = useState(false);
  const [replay, setReplay] = useState<{ id: string; ready: boolean } | null>(
    null,
  );
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayFrame = useRef(0);
  const reduced = systemReduced || previewReduced;

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimationFrame(replayFrame.current);
    };
  }, []);

  function play(id: string) {
    if (timer.current) clearTimeout(timer.current);
    cancelAnimationFrame(replayFrame.current);
    setReplay({ id, ready: false });
    replayFrame.current = requestAnimationFrame(() => {
      replayFrame.current = requestAnimationFrame(() => {
        setReplay({ id, ready: true });
        timer.current = setTimeout(
          () => setReplay(null),
          (id.startsWith('D') || id === 'all' ? 6000 : 2100) / Number(speed),
        );
      });
    });
  }

  function choose(id: string) {
    savePicks(
      picks.includes(id) ? picks.filter((pick) => pick !== id) : [...picks, id],
    );
    setMessage('');
  }

  async function copyPicks() {
    try {
      await navigator.clipboard.writeText(describeMotionPicks(picks));
      setMessage('Copied. Paste your picks into our conversation :3');
    } catch {
      setMessage(
        'Clipboard unavailable—tell me the letter-and-number IDs beside your picks.',
      );
    }
  }

  const visible = motionProposals.filter(
    (proposal) =>
      filter === 'all' ||
      (filter === 'picks'
        ? picks.includes(proposal.id)
        : proposal.family === filter),
  );

  return (
    <main
      className="motion-lab"
      data-reduced={reduced}
      style={{ '--ml-time': 1 / Number(speed) } as CSSProperties}
    >
      <div className="ml-workbench">
        <header className="ml-header">
          <div>
            <Link
              className="ml-back"
              href="/#galaxy"
              target="_blank"
              rel="noopener noreferrer"
            >
              ← back to the galaxy
            </Link>
            <h1>
              Motion lab <span>03</span>
            </h1>
            <p>
              Hover, focus, or tap a preview. Keep the ones that feel right.
            </p>
          </div>
          <div className="ml-status">
            <span />
            {confirmedMotionPicks.length} motions applied locally · panel
            options below
          </div>
        </header>

        <HandoffBench reduced={reduced} />

        <div className="ml-controls" aria-label="Motion lab controls">
          <nav className="ml-filters" aria-label="Component filters">
            <button
              type="button"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All {motionProposals.length}
            </button>
            {motionFamilies.map((family) => (
              <button
                type="button"
                key={family.id}
                aria-pressed={filter === family.id}
                onClick={() => setFilter(family.id)}
              >
                {family.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={filter === 'picks'}
              onClick={() => setFilter('picks')}
            >
              Shortlist ({picks.length})
            </button>
          </nav>
          <div className="ml-playback">
            <button
              type="button"
              className="ml-replay-all"
              onClick={() => play('all')}
            >
              ▷ Replay shown
            </button>
            <label>
              Speed{' '}
              <select
                aria-label="Playback speed"
                value={speed}
                onChange={(event) => {
                  if (timer.current) clearTimeout(timer.current);
                  cancelAnimationFrame(replayFrame.current);
                  setSpeed(event.target.value);
                  setReplay(null);
                }}
              >
                <option value="1">1×</option>
                <option value="0.5">½×</option>
                <option value="0.25">¼×</option>
              </select>
            </label>
            <label className="ml-reduced">
              <input
                type="checkbox"
                checked={reduced}
                disabled={systemReduced}
                onChange={(event) => setPreviewReduced(event.target.checked)}
              />
              Reduced motion{systemReduced ? ' · system' : ''}
            </label>
            <button
              type="button"
              className="ml-copy"
              disabled={!picks.length}
              onClick={copyPicks}
            >
              Copy {picks.length ? picks.length : ''} picks
            </button>
          </div>
        </div>

        <output className="ml-announcement" aria-live="polite">
          {message ||
            `${visible.length} previews · selections stay in this browser · motion is experimental`}
        </output>

        <p className="ml-confirmed">
          Your direction: {confirmedMotionPicks.join(' · ')}{' '}
          <span>— implemented in the local galaxy.</span>
        </p>

        {visible.length === 0 && (
          <div className="ml-empty">
            <h2>A little quiet in here.</h2>
            <p>Use “Keep” beneath any preview to add it to your shortlist.</p>
            <button type="button" onClick={() => setFilter('all')}>
              See all proposals
            </button>
          </div>
        )}

        {motionFamilies.map((family) => {
          const proposals = visible.filter(
            (proposal) => proposal.family === family.id,
          );
          if (!proposals.length) return null;
          return (
            <section
              className="ml-family"
              key={family.id}
              aria-labelledby={`ml-family-${family.id}`}
            >
              <div className="ml-family-heading">
                <h2 id={`ml-family-${family.id}`}>{family.label}</h2>
                <p>{family.description}</p>
              </div>
              <div className="ml-grid">
                {proposals.map((proposal) => {
                  const playing =
                    replay?.id === 'all' || replay?.id === proposal.id;
                  return (
                    <article
                      className="ml-card"
                      key={proposal.id}
                      data-picked={picks.includes(proposal.id)}
                    >
                      {proposal.family === 'modal' ? (
                        <div
                          className="ml-stage ml-modal-stage"
                          data-effect={proposal.id}
                          data-replay={playing && replay?.ready}
                          data-rest={playing && !replay?.ready}
                        >
                          <span className="ml-stage-grid" aria-hidden="true" />
                          <span className="ml-modal-rest" aria-hidden="true">
                            <Specimen family="world" />
                          </span>
                          <div className="ml-specimen" aria-hidden="true" inert>
                            <ModalSpecimen />
                          </div>
                          <button
                            type="button"
                            className="ml-modal-trigger"
                            aria-label={`Preview ${proposal.id}: ${proposal.name}`}
                            onClick={() => play(proposal.id)}
                          />
                          <span className="ml-stage-hint" aria-hidden="true">
                            click to open / replay
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="ml-stage"
                          data-effect={proposal.id}
                          data-replay={playing && replay?.ready}
                          data-rest={playing && !replay?.ready}
                          aria-label={`Preview ${proposal.id}: ${proposal.name}`}
                          onClick={() => play(proposal.id)}
                          onPointerMove={(event) => {
                            if (proposal.id !== 'W3') return;
                            const rect =
                              event.currentTarget.getBoundingClientRect();
                            event.currentTarget.style.setProperty(
                              '--px',
                              String(
                                ((event.clientX - rect.left) / rect.width) * 2 -
                                  1,
                              ),
                            );
                            event.currentTarget.style.setProperty(
                              '--py',
                              String(
                                ((event.clientY - rect.top) / rect.height) * 2 -
                                  1,
                              ),
                            );
                          }}
                          onPointerLeave={(event) => {
                            event.currentTarget.style.setProperty('--px', '0');
                            event.currentTarget.style.setProperty('--py', '0');
                          }}
                        >
                          <span className="ml-stage-grid" aria-hidden="true" />
                          {proposal.family === 'entry' && (
                            <span
                              className="ml-entry-prompt"
                              aria-hidden="true"
                            >
                              hover to establish a signal
                            </span>
                          )}
                          <span className="ml-specimen" aria-hidden="true">
                            <Specimen family={proposal.family} />
                          </span>
                          <span className="ml-stage-hint" aria-hidden="true">
                            hover / tap
                          </span>
                        </button>
                      )}
                      <div className="ml-card-info">
                        <div className="ml-card-title">
                          <span className="ml-id">{proposal.id}</span>
                          <h3>{proposal.name}</h3>
                          <button
                            type="button"
                            className="ml-keep"
                            aria-pressed={picks.includes(proposal.id)}
                            aria-label={`Keep ${proposal.id}: ${proposal.name}`}
                            onClick={() => choose(proposal.id)}
                          >
                            {picks.includes(proposal.id) ? '✓ Kept' : '+ Keep'}
                          </button>
                        </div>
                        <p>{proposal.note}</p>
                        <span className="ml-timing">{proposal.timing}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
        <footer className="ml-footnote">
          The hit areas stay still. Only the artwork moves. Playground links
          open in new tabs. The interruption playground uses the real local
          motions; the comparison tiles remain alternatives.
        </footer>
      </div>
    </main>
  );
}
