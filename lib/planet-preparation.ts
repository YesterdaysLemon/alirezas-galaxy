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
  worker: Worker;
};

const POOL_SIZE = Math.max(
  1,
  Math.min(3, Math.floor((globalThis.navigator?.hardwareConcurrency ?? 2) / 2)),
);

/**
 * A small instance-scoped worker pool (worlds generate in parallel), with
 * abortable row-sized work on older/restricted browsers.
 */
export class PlanetPreparation {
  private workers: Worker[] = [];
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
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.failed = true;
    for (const [id, job] of this.pending) {
      this.pending.delete(id);
      job.signal.removeEventListener('abort', job.abort);
      this.fallback(job.planet, job.signal).then(job.resolve, job.reject);
    }
  }

  private spawn() {
    const worker = new Worker(
      new URL('./planet-preparation.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (
      event: MessageEvent<{ id: number; data?: PlanetBuffers; error?: string }>,
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
    worker.onerror = (event) => {
      event.preventDefault();
      this.failWorker();
    };
    worker.onmessageerror = () => this.failWorker();
    this.workers.push(worker);
    return worker;
  }

  /** The least-loaded worker, spawning up to the pool size on demand. */
  private pick() {
    const load = new Map<Worker, number>(this.workers.map((w) => [w, 0]));
    for (const job of this.pending.values())
      load.set(job.worker, (load.get(job.worker) ?? 0) + 1);
    let best: Worker | null = null,
      least = Infinity;
    for (const [worker, count] of load)
      if (count < least) {
        least = count;
        best = worker;
      }
    if (best && (least === 0 || this.workers.length >= POOL_SIZE)) return best;
    return this.spawn();
  }

  generate(planet: PlanetRecipe, signal: AbortSignal): Promise<PlanetBuffers> {
    if (this.disposed || signal.aborted)
      return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    let worker: Worker | null = null;
    if (!this.failed)
      try {
        worker = this.pick();
      } catch {
        this.failWorker();
      }
    if (!worker) return this.fallback(planet, signal);
    const { promise, resolve, reject } = Promise.withResolvers<PlanetBuffers>();
    const id = ++this.sequence;
    const assigned = worker;
    const abort = () => {
      this.pending.delete(id);
      reject(new DOMException('Cancelled', 'AbortError'));
      // Stop abandoned terrain immediately if nothing retained needs this worker.
      if (![...this.pending.values()].some((job) => job.worker === assigned)) {
        assigned.terminate();
        this.workers = this.workers.filter((w) => w !== assigned);
      }
    };
    this.pending.set(id, { planet, signal, resolve, reject, abort, worker });
    signal.addEventListener('abort', abort, { once: true });
    try {
      worker.postMessage({ id, planet });
    } catch {
      this.failWorker();
    }
    return promise;
  }

  dispose() {
    this.disposed = true;
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    for (const job of this.pending.values()) {
      job.signal.removeEventListener('abort', job.abort);
      job.reject(new DOMException('Cancelled', 'AbortError'));
    }
    this.pending.clear();
  }
}
