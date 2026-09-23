'use client';

import { useRef, type RefObject } from 'react';
import type { GalaxyId } from '@/data/galaxies';
import { starDiffractionPath } from '@/lib/galaxy/textures';

/**
 * The neighboring galaxy's beacon. The scene positions it each frame; a drag
 * that starts on it steers the galaxy instead of travelling.
 */
export function WebringPortal({
  galaxyId,
  travelling,
  portalRef,
  onTravel,
}: {
  galaxyId: GalaxyId;
  travelling: boolean;
  portalRef: RefObject<HTMLButtonElement | null>;
  onTravel: () => void;
}) {
  const press = useRef({ x: 0, y: 0, moved: false });
  return (
    <button
      ref={portalRef}
      type="button"
      className="webring-portal"
      aria-label={
        galaxyId === 'home' ? 'Travel to the web ring' : 'Return to my galaxy'
      }
      disabled={travelling}
      onPointerDown={(event) => {
        press.current = {
          x: event.clientX,
          y: event.clientY,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        if (
          event.buttons &&
          Math.hypot(
            event.clientX - press.current.x,
            event.clientY - press.current.y,
          ) > 10
        )
          press.current.moved = true;
      }}
      onClick={(event) => {
        if (event.detail > 0 && press.current.moved) return;
        onTravel();
      }}
    >
      <span className="galaxy-signal" aria-hidden="true">
        <i />
        <i />
        <span className="galaxy-signal-orbit" />
        <svg
          className="galaxy-signal-star"
          viewBox="-32 -32 64 64"
          focusable="false"
        >
          <path d={starDiffractionPath} />
          <circle r="5.5" />
        </svg>
      </span>
    </button>
  );
}
