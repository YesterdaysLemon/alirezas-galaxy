'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { webring } from '@/data/webring';

type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  portalRef: RefObject<HTMLButtonElement | null>;
};

export function WebringPanel({ open, onOpen, onClose, portalRef }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <>
      <button
        ref={portalRef}
        type="button"
        className="webring-portal"
        aria-label="Explore the web ring"
        aria-controls="webring-panel"
        aria-expanded={open}
        onClick={open ? onClose : onOpen}
      >
        <span className="webring-portal-orbit" aria-hidden="true" />
        <span className="webring-portal-label">
          web ring <span aria-hidden="true">↗</span>
        </span>
      </button>
      {open && (
        <dialog
          open
          id="webring-panel"
          className="webring-panel"
          aria-labelledby="webring-title"
        >
          <p className="webring-eyebrow">beyond my galaxy</p>
          <h2 id="webring-title">a little web ring</h2>
          <p className="webring-intro">
            Friends, collaborations &amp; rabbit holes worth visiting.
          </p>
          <button
            ref={closeRef}
            type="button"
            className="webring-close"
            aria-label="Close web ring"
            onClick={onClose}
          >
            ×
          </button>
          <ul className="webring-neighbors">
            {webring.map((neighbor) => (
              <li key={neighbor.id}>
                <a
                  href={neighbor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="webring-neighbor"
                >
                  <span className="webring-neighbor-icon" aria-hidden="true">
                    <span>{neighbor.glyph}</span>
                    {neighbor.iconSrc && (
                      // oxlint-disable-next-line next/no-img-element
                      <img
                        src={neighbor.iconSrc}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                    )}
                  </span>
                  <span className="webring-neighbor-copy">
                    <span className="webring-neighbor-kind">
                      {neighbor.kind}
                    </span>
                    <strong>{neighbor.name}</strong>
                    <span>{neighbor.description}</span>
                    <small>
                      {new URL(neighbor.url).hostname.replace(/^www\./, '')}
                    </small>
                  </span>
                  <span className="webring-visit" aria-hidden="true">
                    ↗
                  </span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="webring-footnote">
            a new tab, a new corner of the internet.
          </p>
        </dialog>
      )}
    </>
  );
}
