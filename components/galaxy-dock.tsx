'use client';

/* oxlint-disable next/no-img-element -- Keep the local SVG unmodified in Vinext. */

import { useState, type RefObject } from 'react';
import type { Destination } from '@/data/worlds';
import type { GalaxyId } from '@/data/galaxies';
import { getQuoteOfTheDay, quotationCollection } from '@/data/transmissions';
import { DockHousing } from './dock-housing';

/**
 * The utility dock: the spin/next orb, whose spiral the scene turns with the
 * galaxy, and a four-channel footer transmission.
 */
export function GalaxyDock({
  galaxyId,
  worlds,
  activeIndex,
  expanded,
  disabled,
  iconRef,
  onAdvance,
  onNudge,
}: {
  galaxyId: GalaxyId;
  worlds: Destination[];
  activeIndex: number;
  expanded: boolean;
  disabled: boolean;
  iconRef: RefObject<HTMLImageElement | null>;
  onAdvance: () => void;
  /** A hover or keyboard focus gives the spiral a small nudge. */
  onNudge: () => void;
}) {
  const [transmission, setTransmission] = useState(0);
  const dailyQuote = getQuoteOfTheDay();
  return (
    <div className="spore-dock" aria-label="Galaxy controls">
      <DockHousing />
      <div className="dock-buttons">
        <button
          type="button"
          aria-label={
            expanded
              ? worlds.length > 1
                ? `Next world: ${worlds[(activeIndex + 1) % worlds.length].name}`
                : 'Only world in this galaxy'
              : 'Spin the galaxy faster'
          }
          title={
            expanded
              ? worlds.length > 1
                ? 'Go to the next world'
                : 'Only world in this galaxy'
              : 'Spin the galaxy faster'
          }
          // The dock sits out a system visit; its icon holds still as it leaves.
          data-action={expanded ? 'next' : 'spin'}
          disabled={disabled || (expanded && worlds.length < 2)}
          className="dock-orb"
          onClick={onAdvance}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse' || event.pointerType === 'pen')
              onNudge();
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(':focus-visible')) onNudge();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" data-icon="next-world">
            <path d="M5 5.8c0-.9.9-1.3 1.6-.8l8.3 6.2c.6.4.6 1.2 0 1.6L6.6 19c-.7.5-1.6.1-1.6-.8V5.8Z" />
            <rect x="17" y="5" width="3" height="14" rx="1.5" />
          </svg>
          <span className="dock-flywheel">
            <img
              ref={iconRef}
              aria-hidden="true"
              data-icon="spore-main-menu-spiral"
              src={
                galaxyId === 'webring'
                  ? '/spiral-galaxy-3.svg'
                  : '/spiral-galaxy.svg'
              }
              alt=""
              width={44}
              height={44}
            />
          </span>
        </button>
        <button
          type="button"
          aria-label="Show next footer transmission"
          aria-controls="dock-transmission"
          className="dock-tuner"
          title="Cycle transmissions: credit, quote, source, contact"
          onClick={() => setTransmission((current) => (current + 1) % 4)}
        >
          <svg
            aria-hidden="true"
            data-icon="cycle-transmission"
            viewBox="0 0 24 24"
          >
            {[0, 1, 2, 3].map((mode) => (
              <rect
                key={mode}
                x={mode % 2 ? 13 : 5}
                y={mode > 1 ? 13 : 5}
                width="6"
                height="6"
                rx=".8"
                className={transmission === mode ? 'is-active' : undefined}
              />
            ))}
          </svg>
        </button>
      </div>
      <div
        className="dock-console"
        data-mode={
          transmission === 1
            ? 'quote'
            : transmission === 2
              ? 'source'
              : transmission === 3
                ? 'contact'
                : 'credit'
        }
      >
        {transmission === 3 ? (
          <a
            id="dock-transmission"
            href="mailto:mail@alirezaafshan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="dock-message"
            data-mode="contact"
            aria-label="Contact me by email"
          >
            <span className="dock-text">contact me ↗</span>
          </a>
        ) : transmission === 2 ? (
          <a
            id="dock-transmission"
            href={quotationCollection.url}
            target="_blank"
            rel="noopener noreferrer"
            className="dock-message"
            data-mode="source"
            aria-label={`Open ${quotationCollection.label}`}
            title={quotationCollection.label}
          >
            <span className="dock-text">open bartlett&apos;s quotations ↗</span>
          </a>
        ) : (
          <output
            id="dock-transmission"
            className="dock-message"
            data-mode={transmission === 1 ? 'quote' : 'credit'}
            aria-live="polite"
            title={
              transmission === 1
                ? `“${dailyQuote.text}” — ${dailyQuote.author}`
                : '© alireza afshan · 2026'
            }
          >
            <span className="dock-text">
              {transmission === 1
                ? `“${dailyQuote.text}” — ${dailyQuote.author}`
                : '© alireza afshan · 2026'}
            </span>
          </output>
        )}
      </div>
    </div>
  );
}
