import { generatePlanetBuffers } from './planet-textures';
import type { PlanetRecipe } from '../data/solar-systems';

self.onmessage = (
  event: MessageEvent<{ id: number; planet: PlanetRecipe }>,
) => {
  const { id, planet } = event.data;
  try {
    const generator = generatePlanetBuffers(planet);
    let step = generator.next();
    while (!step.done) step = generator.next();
    const data = step.value;
    const transfer = [
      ...data.maps.map((map) => map.buffer),
      data.position.buffer,
      data.normal.buffer,
      data.uv.buffer,
      data.index.buffer,
    ] as ArrayBuffer[];
    self.postMessage({ id, data }, { transfer });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
