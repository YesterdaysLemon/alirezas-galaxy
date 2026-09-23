import type { PlanetRecipe } from '../data/solar-systems';
import { generatePlanetBuffers, type PlanetBuffers } from './planet-textures';

export function preparationTurn(signal: AbortSignal): Promise<void> {
  if (signal.aborted)
    return Promise.reject(new DOMException('Cancelled', 'AbortError'));
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const abort = () => {
    clearTimeout(timer);
    reject(new DOMException('Cancelled', 'AbortError'));
  };
  const timer = setTimeout(() => {
    signal.removeEventListener('abort', abort);
    resolve();
  }, 0);
  signal.addEventListener('abort', abort, { once: true });
  return promise;
}

type Pending = {
  planet: PlanetRecipe;
  signal: AbortSignal;
  resolve: (data: PlanetBuffers) => void;
  reject: (reason: unknown) => void;
  abort: () => void;
};

/** Instance-scoped worker, with abortable row-sized work on older/restricted browsers. */
export class PlanetPreparation {
  private worker: Worker | null = null;
  private failed = false;
  private disposed = false;
  private sequence = 0;
  private pending = new Map<number, Pending>();

  private async fallback(planet: PlanetRecipe, signal: AbortSignal) {
    const generator = generatePlanetBuffers(planet);
    try {
      for (;;) {
        await preparationTurn(signal);
        const deadline = performance.now() + 3;
        do {
          const step = generator.next();
          if (step.done) return step.value;
        } while (performance.now() < deadline);
      }
    } finally {
      generator.return(undefined as never);
    }
  }

  private failWorker() {
    this.worker?.terminate();
    this.worker = null;
    this.failed = true;
    for (const [id, job] of this.pending) {
      this.pending.delete(id);
      job.signal.removeEventListener('abort', job.abort);
      this.fallback(job.planet, job.signal).then(job.resolve, job.reject);
    }
  }

  generate(planet: PlanetRecipe, signal: AbortSignal): Promise<PlanetBuffers> {
    if (this.disposed || signal.aborted)
      return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    if (!this.worker && !this.failed) {
      try {
        this.worker = new Worker(
          new URL('./planet-preparation.worker.ts', import.meta.url),
          { type: 'module' },
        );
        this.worker.onmessage = (
          event: MessageEvent<{
            id: number;
            data?: PlanetBuffers;
            error?: string;
          }>,
        ) => {
          const job = this.pending.get(event.data.id);
          if (!job) return;
          this.pending.delete(event.data.id);
          job.signal.removeEventListener('abort', job.abort);
          if (event.data.data) job.resolve(event.data.data);
          else {
            this.fallback(job.planet, job.signal).then(job.resolve, job.reject);
            this.failWorker();
          }
        };
        this.worker.onerror = (event) => {
          event.preventDefault();
          this.failWorker();
        };
        this.worker.onmessageerror = () => this.failWorker();
      } catch {
        this.failWorker();
      }
    }
    if (!this.worker) return this.fallback(planet, signal);
    const { promise, resolve, reject } = Promise.withResolvers<PlanetBuffers>();
    const id = ++this.sequence;
    const abort = () => {
      this.pending.delete(id);
      reject(new DOMException('Cancelled', 'AbortError'));
      // Stop abandoned terrain immediately if no retained system needs the worker.
      if (!this.pending.size) {
        this.worker?.terminate();
        this.worker = null;
      }
    };
    this.pending.set(id, { planet, signal, resolve, reject, abort });
    signal.addEventListener('abort', abort, { once: true });
    try {
      this.worker!.postMessage({ id, planet });
    } catch {
      this.failWorker();
    }
    return promise;
  }

  dispose() {
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
    for (const job of this.pending.values()) {
      job.signal.removeEventListener('abort', job.abort);
      job.reject(new DOMException('Cancelled', 'AbortError'));
    }
    this.pending.clear();
  }
}
