import * as THREE from 'three';
import type { ScreenRect, Viewport } from './framing';

/** Slop, in pixels, around the hover card and the path to it. */
const BRIDGE = 24;
/** Minimum gap, in pixels, between the hover card and the view's edges. */
const INSET = 8;

/**
 * The scene's view of the ship HUD's DOM: the canvas's size and position, the
 * bands the helm and worlds tray occupy, the comms casing, and the hover card
 * that it attaches beside a world. Layout is read only after the DOM or a
 * size changes, never in the middle of a frame's style writes.
 */
export class HudOverlay {
  /** The HUD's radar canvas, when mounted; the radar draws into it. */
  scope: HTMLCanvasElement | null = null;
  /** The ship HUD's solid parts, in canvas pixels, as last measured. */
  hudRects: ScreenRect[] = [];
  private preview: HTMLElement | null = null;
  private elementsDirty = true;
  private layoutDirty = true;
  private sizeDirty = true;
  private readonly size: Viewport = { width: 0, height: 0 };
  private readonly observed = new Set<Element>();
  private readonly mutationObserver: MutationObserver;
  private readonly resizeObserver: ResizeObserver;
  private canvasLeft = 0;
  private canvasTop = 0;
  private safeTop = INSET;
  private safeBottom = 0;
  /** The comms casing, which floats beside the footer in short landscapes. */
  private commsBounds: DOMRect | null = null;
  private previewWidth = 0;
  private previewHeight = 0;
  private previewOffsetX = 0;
  private previewOffsetY = 0;
  private previewX = 0;
  private previewY = 0;
  private anchorX = 0;
  private anchorY = 0;
  private previewShown = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: HTMLElement,
    /** Called after a layout change, once the new sizes are measured. */
    private readonly onMeasure: () => void,
  ) {
    this.mutationObserver = new MutationObserver(() => {
      this.elementsDirty = this.layoutDirty = true;
    });
    this.mutationObserver.observe(host, { childList: true, subtree: true });
    this.resizeObserver = new ResizeObserver(() => {
      this.layoutDirty = this.sizeDirty = true;
    });
    this.observe([canvas]);
  }

  /** The canvas's CSS size, read at most once per resize. */
  get viewport(): Viewport {
    if (this.sizeDirty) {
      this.size.width = this.canvas.clientWidth;
      this.size.height = this.canvas.clientHeight;
      this.sizeDirty = false;
    }
    return this.size;
  }

  /** The window resized: size reads must not wait for the observer. */
  resized() {
    this.layoutDirty = this.sizeDirty = true;
  }

  /** HUD parts may have mounted or unmounted. */
  invalidate() {
    this.elementsDirty = true;
  }

  /** Watch exactly these elements for size changes. */
  private observe(elements: Element[]) {
    const wanted = new Set(elements);
    for (const element of this.observed)
      if (!wanted.has(element)) {
        this.resizeObserver.unobserve(element);
        this.observed.delete(element);
      }
    for (const element of wanted)
      if (!this.observed.has(element)) {
        this.resizeObserver.observe(element);
        this.observed.add(element);
      }
  }

  /** Find HUD parts and measure them, if anything changed since last frame. */
  sync() {
    if (this.elementsDirty) {
      this.scope = this.host.querySelector<HTMLCanvasElement>(
        'canvas[data-solar-scope]',
      );
      const preview = this.host.querySelector<HTMLElement>(
        '[data-solar-preview]',
      );
      // Each world's card is a fresh element that starts hidden.
      if (preview !== this.preview) {
        this.preview = preview;
        this.previewShown = false;
      }
      this.elementsDirty = false;
      this.layoutDirty = true;
    }
    if (this.layoutDirty) this.measure();
  }

  private measure() {
    const rect = this.canvas.getBoundingClientRect();
    const watched: Element[] = [this.canvas];
    this.canvasLeft = rect.left;
    this.canvasTop = rect.top;
    this.safeTop = INSET;
    this.safeBottom = rect.height - INSET;
    // The HUD's helm and worlds tray dock along the bottom edge.
    for (const part of this.host.querySelectorAll<HTMLElement>(
      '.solar-helm, .solar-deck',
    )) {
      const bounds = part.getBoundingClientRect();
      if (!bounds.height) continue;
      this.safeBottom = Math.min(
        this.safeBottom,
        bounds.top - rect.top - INSET,
      );
      watched.push(part);
    }
    // The parts the overview keeps its orbits clear of. Not the whole helm:
    // its menu opens over the view without reframing it.
    this.hudRects = [];
    for (const part of this.host.querySelectorAll<HTMLElement>(
      '.solar-nametab, .solar-scope, .solar-bar, .solar-readout, .solar-tray',
    )) {
      const bounds = part.getBoundingClientRect();
      if (!bounds.width || !bounds.height) continue;
      this.hudRects.push({
        left: Math.round(bounds.left - rect.left),
        top: Math.round(bounds.top - rect.top),
        right: Math.round(bounds.right - rect.left),
        bottom: Math.round(bounds.bottom - rect.top),
      });
    }
    const comms = this.host.querySelector<HTMLElement>('.solar-comms');
    this.commsBounds = comms?.getBoundingClientRect() ?? null;
    if (comms) watched.push(comms);
    if (this.scope) watched.push(this.scope);
    if (this.preview) {
      const parent =
        (
          this.preview.offsetParent as HTMLElement | null
        )?.getBoundingClientRect() ?? rect;
      this.previewOffsetX = rect.left - parent.left;
      this.previewOffsetY = rect.top - parent.top;
      const available = Math.max(64, this.safeBottom - this.safeTop);
      const maxHeight = `${available}px`;
      if (this.preview.style.maxHeight !== maxHeight) {
        this.preview.style.maxHeight = maxHeight;
        this.preview.style.overflowY = 'auto';
      }
      const bounds = this.preview.getBoundingClientRect();
      this.previewWidth = bounds.width;
      this.previewHeight = Math.min(bounds.height, available);
      watched.push(this.preview);
    }
    this.observe(watched);
    this.layoutDirty = false;
    this.onMeasure();
  }

  /** Whether the hover card belongs to world `index`. */
  showing(index: number) {
    return !!this.preview && Number(this.preview.dataset.planetIndex) === index;
  }

  hide() {
    if (this.preview) this.preview.style.visibility = 'hidden';
    this.previewShown = false;
  }

  /**
   * Attach the hover card beside a world at (x, y) on the canvas whose disc
   * is `radius` pixels, clear of the HUD.
   */
  place(x: number, y: number, radius: number) {
    const preview = this.preview;
    if (!preview) return;
    const { width } = this.viewport;
    this.anchorX = x;
    this.anchorY = y;
    // Where the card's world sits on the canvas; with no standing labels this
    // is the one DOM record of a world's screen position.
    const anchor = `${Math.round(x)} ${Math.round(y)}`;
    if (preview.dataset.anchor !== anchor) preview.dataset.anchor = anchor;
    const right = x + radius + 16;
    const preferredX =
      right + this.previewWidth < width - INSET
        ? right
        : x - radius - 16 - this.previewWidth;
    this.previewX = THREE.MathUtils.clamp(
      preferredX,
      INSET,
      Math.max(INSET, width - this.previewWidth - INSET),
    );
    this.previewY = THREE.MathUtils.clamp(
      y - this.previewHeight * 0.45,
      this.safeTop,
      Math.max(this.safeTop, this.safeBottom - this.previewHeight),
    );
    // The short-landscape comms casing floats beside, rather than inside, the
    // footer's measured box. Keep the transmission clear of that second panel.
    const comms = this.commsBounds;
    if (
      comms &&
      this.previewX + this.canvasLeft < comms.right + INSET &&
      this.previewX + this.canvasLeft + this.previewWidth >
        comms.left - INSET &&
      this.previewY + this.canvasTop < comms.bottom + INSET &&
      this.previewY + this.canvasTop + this.previewHeight > comms.top - INSET
    ) {
      const above = comms.top - this.canvasTop - INSET - this.previewHeight;
      const left = comms.left - this.canvasLeft - INSET - this.previewWidth;
      if (above >= this.safeTop) this.previewY = above;
      else if (left >= INSET) this.previewX = left;
    }
    const transform = `translate(${this.previewX + this.previewOffsetX}px, ${this.previewY + this.previewOffsetY}px)`;
    if (preview.style.transform !== transform)
      preview.style.transform = transform;
    if (!this.previewShown) {
      preview.style.visibility = 'visible';
      this.previewShown = true;
    }
  }

  /**
   * Whether a pointer is on the hover card or on the path from its world to
   * it, so the reader can cross into the card without losing the hover.
   */
  inBridge(clientX: number, clientY: number) {
    if (!this.preview || !this.previewShown) return false;
    const x = clientX - this.canvasLeft,
      y = clientY - this.canvasTop;
    if (
      x >= this.previewX - BRIDGE &&
      x <= this.previewX + this.previewWidth + BRIDGE &&
      y >= this.previewY - BRIDGE &&
      y <= this.previewY + this.previewHeight + BRIDGE
    )
      return true;
    const endX = THREE.MathUtils.clamp(
      this.anchorX,
      this.previewX,
      this.previewX + this.previewWidth,
    );
    const endY = THREE.MathUtils.clamp(
      this.anchorY,
      this.previewY,
      this.previewY + this.previewHeight,
    );
    const dx = endX - this.anchorX,
      dy = endY - this.anchorY;
    const lengthSquared = dx * dx + dy * dy;
    const along = lengthSquared
      ? THREE.MathUtils.clamp(
          ((x - this.anchorX) * dx + (y - this.anchorY) * dy) / lengthSquared,
          0,
          1,
        )
      : 0;
    return (
      Math.hypot(
        x - this.anchorX - dx * along,
        y - this.anchorY - dy * along,
      ) <= BRIDGE
    );
  }

  dispose() {
    this.mutationObserver.disconnect();
    this.resizeObserver.disconnect();
    this.observed.clear();
  }
}
