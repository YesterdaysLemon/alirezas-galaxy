'use client';

import type { CSSProperties, RefObject } from 'react';
import type { Destination } from '@/data/worlds';
import { worldComms } from '@/data/world-comms';

const worldStyle = (world: Destination) =>
  ({
    '--world-color': `#${world.color.toString(16).padStart(6, '0')}`,
  }) as CSSProperties;

function PanelFasteners() {
  return (
    <span className="comms-fasteners" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function Portrait({
  world,
  compact = false,
}: {
  world: Destination;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? 'world-preview-orbit' : 'world-orbit'}
      aria-hidden="true"
    >
      <div className={compact ? 'world-preview-face' : 'world-face'}>
        <span>{world.glyph}</span>
        {world.iconSrc && (
          // oxlint-disable-next-line next/no-img-element
          <img
            key={world.iconSrc}
            src={world.iconSrc}
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
  );
}

export function WorldPreview({
  world,
  previewRef,
  hint,
  leaving = false,
  onInspect,
}: {
  world: Destination;
  previewRef: RefObject<HTMLButtonElement | null>;
  hint: boolean;
  leaving?: boolean;
  onInspect: () => void;
}) {
  return (
    <button
      type="button"
      ref={previewRef}
      className={`world-preview ${hint ? 'is-hover-hint' : ''}`}
      data-world-id={world.id}
      aria-label={`Inspect ${world.name}`}
      aria-hidden={hint || leaving || undefined}
      inert={leaving || undefined}
      data-phase={leaving ? 'leaving' : undefined}
      tabIndex={hint || leaving ? -1 : undefined}
      onClick={onInspect}
      style={worldStyle(world)}
    >
      <span className="preview-motion">
        <span className="preview-orbit-arrival">
          <Portrait world={world} compact />
        </span>
        <span className="world-preview-screen">
          <span className="world-preview-label">
            <span className="world-preview-name-text">{world.name}</span>
            <span className="comms-screen-static" aria-hidden="true" />
          </span>
          <span className="world-preview-address">
            <span className="world-preview-address-text">
              {new URL(world.url).hostname.replace(/^www\./, '')}
            </span>
            <span className="comms-screen-static" aria-hidden="true" />
          </span>
        </span>
      </span>
    </button>
  );
}

export function WorldComms({
  world,
  detailRef,
  leaving = false,
  onClose,
}: {
  world: Destination;
  detailRef: RefObject<HTMLElement | null>;
  leaving?: boolean;
  onClose: () => void;
}) {
  const message = worldComms[world.id];
  return (
    <section
      ref={detailRef}
      className="world-detail"
      data-world-id={world.id}
      aria-label={`Selected world: ${world.name}`}
      aria-hidden={leaving || undefined}
      inert={leaving || undefined}
      data-phase={leaving ? 'leaving' : undefined}
      style={worldStyle(world)}
    >
      <div className="comms-top">
        <Portrait world={world} />
        <div className="world-detail-wing">
          <span className="comms-title-mount" aria-hidden="true" />
          <h2 title={world.name}>{world.name}</h2>
          <span className="world-kind">
            {world.kind}{world.status === 'preview' ? ' · preview' : ''}
          </span>
          <p>{message?.intro ?? world.description}</p>
          <span className="world-address">
            {new URL(world.url).hostname.replace(/^www\./, '')}
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
        <a
          href={world.url}
          target="_blank"
          rel="noopener noreferrer"
          className="world-play"
          aria-label={`Launch ${world.name}`}
        >
          <span aria-hidden="true" className="comms-response-arrow">
            ▸
          </span>
          <span>open world</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        {message?.source && (
          <a
            href={message.source}
            target="_blank"
            rel="noopener noreferrer"
            className="world-source"
            aria-label={`View source for ${world.name} (opens in a new tab)`}
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
        aria-label="Close world details"
        onClick={onClose}
      >
        <span className="world-close-symbol" aria-hidden="true">
          ×
        </span>
      </button>
    </section>
  );
}
