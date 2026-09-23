export type MenuIconName = 'random' | 'about' | 'github';

export function MenuIcon({ name }: { name: MenuIconName }) {
  if (name === 'random') {
    return (
      <svg
        className="menu-icon menu-icon-random"
        data-icon="soft-organic-star"
        aria-hidden="true"
        viewBox="0 0 24 24"
      >
        <path d="M12 2.8c2.2 0 3.1 3.1 3.8 5.2 2.1-.8 5.2-1.2 5.9.9.7 2.1-2 3.8-3.8 5.2 1.5 1.7 3.2 4.4 1.4 5.8-1.8 1.3-4.2-.8-6.1-2-1.2 1.9-3.1 4.5-5 3.3-1.9-1.2-.4-4.2.3-6.3-2.2-.5-5.4-1.4-5.2-3.6.2-2.2 3.5-2.5 5.7-2.5.2-2.3.7-6 3-6Z" />
      </svg>
    );
  }

  if (name === 'about') {
    return (
      <svg
        className="menu-icon menu-icon-about"
        data-icon="little-creature"
        aria-hidden="true"
        viewBox="0 0 24 24"
      >
        <path d="M4 13.5c0-5 3.2-9 8-9s8 4 8 9c0 4.4-3.3 6.5-8 6.5s-8-2.1-8-6.5Z" />
        <circle cx="9" cy="11" r="1.6" />
        <circle cx="15" cy="11" r="1.6" />
        <path d="M9 16c2 1.2 4 1.2 6 0M6.2 7 4.6 4.4M17.8 7l1.6-2.6" />
      </svg>
    );
  }

  return (
    <svg
      className="menu-icon menu-icon-github"
      data-icon="github"
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path d="M12 .9a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.16c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.54 0-1.22.44-2.22 1.16-3-.12-.29-.5-1.43.11-2.97 0 0 .94-.3 3.08 1.15A10.7 10.7 0 0 1 12 6.31c.95 0 1.9.13 2.8.38 2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.97.72.78 1.16 1.78 1.16 3 0 4.31-2.64 5.25-5.15 5.53.4.35.76 1.03.76 2.08v3.07c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .9Z" />
    </svg>
  );
}
