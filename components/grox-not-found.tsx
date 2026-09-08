'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { watchCommsAssets } from '@/lib/comms-readiness';
import { shouldPlayGroxPortrait } from '@/lib/grox-encounter';
import { GalaxyIndex } from './galaxy-index';

export const GROX_TRANSMISSIONS = {
  arrival: {
    headline: 'You have made a fatal navigational error.',
    message:
      'There is no world at these coordinates. You have entered Grox space. Your presence is neither required nor tolerated.',
    farewell: 'Turn your pathetic little ship around. Leave. Now.',
    hostility: -100,
  },
  peace: {
    headline: 'We were having peace. Then you arrived.',
    message:
      'Your continued existence here is making it worse. We suggest you correct this navigational error immediately.',
    farewell: 'This is your last warning.',
    hostility: -101,
  },
} as const;

function Fasteners() {
  return (
    <span className="grox-fasteners" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function GroxNotFound() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [arrived, setArrived] = useState(false);
  const [ready, setReady] = useState(false);
  const [offeredPeace, setOfferedPeace] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [returned, setReturned] = useState(false);
  const onArrival = useCallback(() => setArrived(true), []);
  const leave = useCallback(() => {
    dialogRef.current?.close();
    videoRef.current?.pause();
    setLeaving(true);
  }, []);
  const onReturn = useCallback(() => {
    setReturned(true);
    // The live scene is now the normal galaxy; retain its canvas and pose.
    window.history.replaceState(window.history.state, '', '/#galaxy');
  }, []);
  const transmission = GROX_TRANSMISSIONS[offeredPeace ? 'peace' : 'arrival'];

  useEffect(() => {
    if (leaving || returned) return;
    // A missing WebGL context must never prevent a usable 404/exit.
    const fallback = window.setTimeout(onArrival, 4500);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !dialogRef.current?.open) leave();
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener('keydown', onEscape);
    };
  }, [onArrival, leave, leaving, returned]);

  useEffect(() => {
    if (!returned) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>('#galaxy .sprawl-mark')
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [returned]);

  useEffect(() => {
    if (!arrived || leaving || returned) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    const stopWatching = watchCommsAssets(dialog, () => setReady(true));
    return () => {
      stopWatching();
      if (typeof dialog.close === 'function') dialog.close();
    };
  }, [arrived, leaving, returned]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !arrived || videoFailed || leaving || returned) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPlayback = () => {
      video.muted = true;
      if (
        shouldPlayGroxPortrait(
          motion.matches,
          document.visibilityState === 'visible',
        )
      )
        void video.play().catch(() => undefined);
      else video.pause();
    };
    syncPlayback();
    document.addEventListener('visibilitychange', syncPlayback);
    motion.addEventListener('change', syncPlayback);
    return () => {
      video.pause();
      document.removeEventListener('visibilitychange', syncPlayback);
      motion.removeEventListener('change', syncPlayback);
    };
  }, [arrived, videoFailed, leaving, returned]);

  return (
    <div
      className={returned ? 'grox-returned' : 'grox-sector'}
      data-arrived={arrived}
      data-leaving={leaving}
    >
      <GalaxyIndex
        groxEncounter
        groxLeaving={leaving}
        onGroxArrival={onArrival}
        onGroxReturn={onReturn}
      />
      {!arrived && !leaving && (
        <div className="grox-approach-status">
          <output>
            <strong>404 · Unknown coordinates</strong>
            <span>Approaching a restricted star system…</span>
          </output>
          <button type="button" onClick={onArrival}>
            Open transmission
          </button>
        </div>
      )}
      <noscript>
        <div className="grox-no-script">
          404 · You have entered Grox space.{' '}
          <Link href="/#galaxy">Return to the galaxy.</Link>
        </div>
      </noscript>
      <dialog
        ref={dialogRef}
        className="grox-dialog"
        aria-labelledby="grox-title"
        aria-describedby="grox-warning"
        data-ready={ready}
        data-peace={offeredPeace}
        onCancel={(event) => {
          event.preventDefault();
          leave();
        }}
      >
        <section className="grox-console">
          <header className="grox-empire-tab">
            <h1 id="grox-title">
              <span className="grox-empire-icon" aria-hidden="true">
                🚀
              </span>
              The Grox Empire
            </h1>
            <span
              className="grox-mood"
              title={`Hostile: ${transmission.hostility}`}
              aria-label={`Hostile. Relationship: ${transmission.hostility}`}
            >
              😠
            </span>
          </header>
          <div className="grox-portrait-frame">
            <div className="grox-portrait-screen">
              <span className="grox-portrait-fallback">VISUAL SIGNAL LOST</span>
              {videoFailed ? (
                // oxlint-disable-next-line next/no-img-element
                <img
                  src="/not-found/grox-portrait.png"
                  width="1254"
                  height="1254"
                  alt="The Grox commander glaring at the incoming transmission."
                />
              ) : (
                <video
                  ref={videoRef}
                  src="/not-found/grox-angry.mp4"
                  poster="/not-found/grox-angry-poster.jpg"
                  width="416"
                  height="520"
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-label="Original game footage of an angry Grox commander gesturing and talking. Silent portrait animation."
                  onError={() => setVideoFailed(true)}
                />
              )}
              <div className="grox-static" aria-hidden="true" />
            </div>
          </div>
          <div className="grox-message-frame">
            <Fasteners />
            <div className="grox-message-screen">
              <div
                className="grox-message"
                aria-live="polite"
                aria-atomic="true"
              >
                <h2 id="grox-warning">{transmission.headline}</h2>
                <p>{transmission.message}</p>
                <p>{transmission.farewell}</p>
              </div>
              <div className="grox-static" aria-hidden="true" />
              <span className="grox-error-code">
                404 · Coordinates not found
              </span>
            </div>
          </div>
          <nav className="grox-reply-frame" aria-label="Reply to the Grox">
            <Fasteners />
            <div className="grox-reply-screen">
              <div className="grox-replies">
                <button
                  type="button"
                  className="grox-reply"
                  aria-disabled={offeredPeace}
                  onClick={() => {
                    if (!offeredPeace) setOfferedPeace(true);
                  }}
                >
                  {offeredPeace ? 'Peace offer rejected.' : 'We come in peace.'}
                </button>
                <Link
                  href="/#galaxy"
                  className="grox-reply"
                  onClick={(event) => {
                    if (
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.shiftKey &&
                      !event.altKey &&
                      event.button === 0
                    ) {
                      event.preventDefault();
                      leave();
                    }
                  }}
                  aria-label="Fine. We were leaving anyway. Return to the galaxy."
                >
                  Fine. We were leaving anyway.
                </Link>
              </div>
              <div className="grox-reply-footer">
                <Link
                  href="/#galaxy"
                  className="grox-goodbye"
                  onClick={(event) => {
                    if (
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.shiftKey &&
                      !event.altKey &&
                      event.button === 0
                    ) {
                      event.preventDefault();
                      leave();
                    }
                  }}
                  aria-label="Goodbye. End transmission and return to the galaxy."
                >
                  Goodbye
                </Link>
              </div>
            </div>
          </nav>
        </section>
      </dialog>
    </div>
  );
}
