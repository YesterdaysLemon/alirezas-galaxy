'use client';

import type { GalaxyId } from '@/data/galaxies';
import { MenuIcon } from './menu-icon';

/** The organic blue canopy in the top corner: wordmark and main menu. */
export function GalaxyCanopy({
  galaxyId,
  travelling,
  solarActive,
  randomDisabled,
  onHome,
  onRandom,
  onAbout,
}: {
  galaxyId: GalaxyId;
  travelling: boolean;
  solarActive: boolean;
  randomDisabled: boolean;
  onHome: () => void;
  onRandom: () => void;
  onAbout: () => void;
}) {
  return (
    <header className="spore-corner" aria-label="Main menu">
      <span className="spore-canopy-spiral" aria-hidden="true" />
      <button
        type="button"
        className="sprawl-mark"
        aria-label="Alireza Afshan — return home"
        onClick={(event) => {
          event.preventDefault();
          onHome();
        }}
      >
        <span>alireza</span>
        <span>afshan</span>
      </button>
      <nav className="spore-menu" aria-label="Primary">
        <button
          type="button"
          disabled={randomDisabled}
          className="spore-menu-item"
          onClick={onRandom}
        >
          <span className="menu-motion-light" aria-hidden="true" />
          <span className="menu-motion-ripple" aria-hidden="true" />
          <MenuIcon name="random" />
          <span className="menu-motion-label">
            {galaxyId === 'home' ? 'random world' : 'random neighbor'}
          </span>
        </button>
        {/* The canopy sits out a system visit; the ship's own HUD takes over. */}
        {!solarActive && (
          <>
            <button
              type="button"
              className="spore-menu-item"
              disabled={travelling}
              onClick={onAbout}
            >
              <span className="menu-motion-light" aria-hidden="true" />
              <span className="menu-motion-ripple" aria-hidden="true" />
              <MenuIcon name="about" />
              <span className="menu-motion-label">about</span>
            </button>
            <a
              className="spore-menu-item"
              href="https://github.com/YesterdaysLemon"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="menu-motion-light" aria-hidden="true" />
              <span className="menu-motion-ripple" aria-hidden="true" />
              <MenuIcon name="github" />
              <span className="menu-motion-label">github</span>
            </a>
          </>
        )}
      </nav>
    </header>
  );
}
