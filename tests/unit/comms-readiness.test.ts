import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncCommsIdentity, watchCommsAssets } from '../../lib/comms-readiness';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorldPreview } from '../../components/world-comms';
import { destinations } from '../../data/worlds';

class Icon extends EventTarget {
  complete = false;
  naturalWidth = 0;
  style = { display: '' };
  decode = vi.fn(() => Promise.resolve());
}
const rootFor = (...icons: Icon[]) =>
  ({ querySelectorAll: () => icons }) as unknown as HTMLElement;
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
afterEach(() => vi.useRealTimers());

describe('comms readiness gate', () => {
  it('never hands the portfolio DOM to another star while React is catching up', () => {
    const element = { dataset: { worldId: 'portfolio' } } as Pick<
      HTMLElement,
      'dataset'
    >;
    expect(syncCommsIdentity(element, 'aquarium')).toBe(false);
    expect(element.dataset.positionReady).toBe('false');
    element.dataset.worldId = 'aquarium';
    expect(syncCommsIdentity(element, 'aquarium')).toBe(true);
    element.dataset.phase = 'leaving';
    expect(syncCommsIdentity(element, 'aquarium')).toBe(false);
    expect(syncCommsIdentity(element, undefined)).toBe(false);
  });
  it('starts server markup behind the hydration gate', () => {
    const html = renderToStaticMarkup(
      createElement(WorldPreview, {
        world: destinations[0],
        previewRef: { current: null },
        hint: false,
        onInspect() {},
      }),
    );
    expect(html).toContain('data-content-ready="false"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('class="comms-screen-static"');
  });
  it('waits for a slow icon and its decode, rather than the entrance duration', async () => {
    vi.useFakeTimers();
    const icon = new Icon();
    let decoded!: () => void;
    icon.decode.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          decoded = resolve;
        }),
    );
    const ready = vi.fn();
    watchCommsAssets(rootFor(icon), ready);
    await vi.advanceTimersByTimeAsync(900);
    expect(ready).not.toHaveBeenCalled();
    icon.naturalWidth = 32;
    icon.dispatchEvent(new Event('load'));
    await flush();
    expect(ready).not.toHaveBeenCalled();
    decoded();
    await flush();
    expect(ready).toHaveBeenCalledOnce();
  });
  it('holds cached icons and glyph-only cards behind static for 500ms', async () => {
    vi.useFakeTimers();
    const icon = new Icon();
    icon.complete = true;
    icon.naturalWidth = 32;
    const cached = vi.fn();
    const glyph = vi.fn();
    watchCommsAssets(rootFor(icon), cached);
    watchCommsAssets(rootFor(), glyph);
    await flush();
    expect(cached).not.toHaveBeenCalled();
    expect(glyph).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(499);
    expect(cached).not.toHaveBeenCalled();
    expect(glyph).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(cached).toHaveBeenCalledOnce();
    expect(glyph).toHaveBeenCalledOnce();
  });
  it('falls back for failed or stalled icons, and ignores late events', async () => {
    vi.useFakeTimers();
    for (const failWithEvent of [true, false]) {
      const icon = new Icon();
      const ready = vi.fn();
      watchCommsAssets(rootFor(icon), ready);
      if (failWithEvent) {
        icon.dispatchEvent(new Event('error'));
        await flush();
        expect(ready).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(500);
      } else await vi.advanceTimersByTimeAsync(2000);
      await flush();
      expect(icon.style.display).toBe('none');
      expect(ready).toHaveBeenCalledOnce();
      icon.naturalWidth = 32;
      icon.dispatchEvent(new Event('load'));
      await flush();
      expect(ready).toHaveBeenCalledOnce();
    }
  });
  it('cancels readiness when a card is replaced', async () => {
    vi.useFakeTimers();
    const icon = new Icon();
    const ready = vi.fn();
    const cancel = watchCommsAssets(rootFor(icon), ready);
    cancel();
    icon.naturalWidth = 32;
    icon.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(ready).not.toHaveBeenCalled();
    expect(icon.style.display).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels the minimum static timer even when a cached icon is already ready', async () => {
    vi.useFakeTimers();
    const icon = new Icon();
    icon.complete = true;
    icon.naturalWidth = 32;
    const ready = vi.fn();
    const cancel = watchCommsAssets(rootFor(icon), ready);
    await vi.advanceTimersByTimeAsync(250);
    cancel();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ready).not.toHaveBeenCalled();
  });
});
