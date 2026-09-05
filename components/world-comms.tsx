'use client';

import type { CSSProperties, RefObject } from 'react';
import type { Destination } from '@/data/worlds';
import { worldComms } from '@/data/world-comms';

const worldStyle = (world: Destination) =>
  ({
    '--world-color': `#${world.color.toString(16).padStart(6, '0')}`,
  }) as CSSProperties;

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
      </div>
    </div>
  );
}

export function WorldPreview({
  world,
  previewRef,
  hint,
  onInspect,
}: {
  world: Destination;
  previewRef: RefObject<HTMLButtonElement | null>;
  hint: boolean;
  onInspect: () => void;
}) {
  return (
    <button
      type="button"
      ref={previewRef}
      className={`world-preview ${hint ? 'is-hover-hint' : ''}`}
      data-world-id={world.id}
      aria-label={`Inspect ${world.name}`}
      aria-hidden={hint || undefined}
      tabIndex={hint ? -1 : undefined}
      onClick={onInspect}
      style={worldStyle(world)}
    >
      <Portrait world={world} compact />
      <span className="world-preview-screen">
        <span className="world-preview-label">{world.name}</span>
        <span className="world-preview-address">
          {new URL(world.url).hostname.replace(/^www\./, '')}
        </span>
      </span>
    </button>
  );
}

export function WorldComms({
  world,
  detailRef,
  external,
  onClose,
}: {
  world: Destination;
  detailRef: RefObject<HTMLElement | null>;
  external: boolean;
  onClose: () => void;
}) {
  const message = worldComms[world.id];
  return (
    <section
      ref={detailRef}
      className="world-detail"
      data-world-id={world.id}
      aria-label={`Selected world: ${world.name}`}
      style={worldStyle(world)}
    >
      <span className="comms-chassis" aria-hidden="true" />
      <div className="comms-top">
        <Portrait world={world} />
        <div className="world-detail-wing">
          <span className="comms-title-mount" aria-hidden="true" />
          <h2 title={world.name}>{world.name}</h2>
          <span className="world-kind">{world.kind}</span>
          <p>{message?.intro ?? world.description}</p>
          <span className="world-address">
            {new URL(world.url).hostname.replace(/^www\./, '')}
          </span>
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
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          className="world-play"
          aria-label={`Launch ${world.name}`}
        >
          <span aria-hidden="true" className="comms-response-arrow">
            ▸
          </span>
          <span>open world</span>
          {external && <span className="sr-only"> (opens in a new tab)</span>}
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
      </div>
      <button
        type="button"
        className="world-close"
        aria-label="Close world details"
        onClick={onClose}
      >
        ×
      </button>
      <span className="comms-fasteners" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    </section>
  );
}
