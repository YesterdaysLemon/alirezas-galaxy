/** React owns content; the scene must not position an old card at a new star. */
export function syncCommsIdentity(
  element: Pick<HTMLElement, 'dataset'>,
  worldId: string | undefined,
) {
  const matches =
    Boolean(worldId) &&
    element.dataset.worldId === worldId &&
    element.dataset.phase !== 'leaving';
  element.dataset.positionReady = String(matches);
  return matches;
}

/** Keep a half-second of static, and wait longer when icons still need decoding. */
export function watchCommsAssets(root: HTMLElement, onReady: () => void) {
  let cancelled = false;
  const cleanups: Array<() => void> = [];
  // Run alongside asset loading, not after it. Keep this at a real 500ms,
  // independent of the faster UI motion rate, even for cached or glyph-only cards.
  const minimumStatic = new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 500);
    cleanups.push(() => clearTimeout(timeout));
  });
  const pending = Array.from(root.querySelectorAll('img')).map(
    (image) =>
      new Promise<void>((resolve) => {
        let settled = false;
        const finish = (failed = false) => {
          if (settled || cancelled) return;
          settled = true;
          cleanup();
          if (failed) image.style.display = 'none'; // reveal this world's glyph
          resolve();
        };
        const loaded = () => {
          if (!image.naturalWidth) {
            finish(true);
            return;
          }
          if (typeof image.decode === 'function') {
            image.decode().then(
              () => finish(),
              () => finish(true),
            );
          } else finish();
        };
        const failed = () => finish(true);
        // A stalled third-party favicon must never hold the card hostage.
        const timeout = setTimeout(failed, 2000);
        const cleanup = () => {
          clearTimeout(timeout);
          image.removeEventListener('load', loaded);
          image.removeEventListener('error', failed);
        };
        cleanups.push(cleanup);
        image.addEventListener('load', loaded);
        image.addEventListener('error', failed);
        if (image.complete) loaded();
      }),
  );
  Promise.all([minimumStatic, ...pending]).then(() => {
    if (!cancelled) onReady();
  });
  return () => {
    cancelled = true;
    cleanups.forEach((cleanup) => cleanup());
  };
}
