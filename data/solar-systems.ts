/** Art direction is fictional. Project identities and destinations are real. */
export type PlanetRecipe = {
  id: string;
  name: string;
  kind: string;
  description: string;
  url?: string;
  seed: number;
  terrain: 'folds' | 'desert' | 'garden' | 'ocean' | 'culture' | 'gas';
  colors: [string, string, string, string];
  atmosphere: string;
  radius: number;
  orbit: number;
  phase: number;
  moons?: number;
  rings?: boolean;
};

export const patternsSystem = {
  id: 'patterns-and-life',
  name: 'Patterns & Life',
  subtitle: 'Small worlds. Emergent things.',
  starName: 'Lumen',
  planets: [
    {
      id: 'celegans-lab',
      name: 'C. elegans Lab',
      kind: 'Connectome desert',
      description:
        'A tiny nervous system, a whole moving body. Amber dunes and branching mineral seams.',
      url: 'https://worm.alirezaafshan.com',
      seed: 302,
      terrain: 'desert',
      colors: ['#713826', '#b9733d', '#e5ae65', '#ffe6ad'],
      atmosphere: '#ffc773',
      radius: 0.7,
      orbit: 5.2,
      phase: 2.85,
    },
    {
      id: 'plato',
      name: 'Plato',
      kind: 'Living membrane',
      description:
        'Patterns, possible minds, and falsifiable experiments. A blue world of folded, breathing terrain.',
      url: 'https://plato.alirezaafshan.com',
      seed: 4313,
      terrain: 'folds',
      colors: ['#17375c', '#4d7294', '#99b7bd', '#e4e0c8'],
      atmosphere: '#87d7ff',
      radius: 1.08,
      orbit: 8.5,
      phase: 0.4,
      moons: 1,
    },
    {
      id: 'proof-bonsai',
      name: 'Proof Bonsai',
      kind: 'Branching garden',
      description:
        'A living map of proof progress and open branches. Mossy continents divided by pale river valleys.',
      url: 'https://proof-bonsai.alirezaafshan.com',
      seed: 811,
      terrain: 'garden',
      colors: ['#1d596b', '#427d45', '#90b465', '#e9deb1'],
      atmosphere: '#bde5a3',
      radius: 0.98,
      orbit: 12.1,
      phase: 4.1,
    },
    {
      id: 'aquarium',
      name: 'Aquarium',
      kind: 'Archipelago world',
      description:
        'A small fish tank that became a little ecosystem. Turquoise shallows, deep oceans, and island chains.',
      url: 'https://fish.alirezaafshan.com',
      seed: 7109,
      terrain: 'ocean',
      colors: ['#072b68', '#087eab', '#62c3c1', '#f3dfb3'],
      atmosphere: '#7fcfff',
      radius: 1.22,
      orbit: 16.3,
      phase: 2.28,
      moons: 2,
    },
    {
      id: 'agar-protocol',
      name: 'Agar Protocol',
      kind: 'Culture planet',
      description:
        'Evolving digital lineages in a petri dish. Violet basins and luminous colonies spreading across the crust.',
      url: 'https://agar.alirezaafshan.com',
      seed: 9173,
      terrain: 'culture',
      colors: ['#302246', '#694e80', '#c791b7', '#f3ddb1'],
      atmosphere: '#e4aeff',
      radius: 0.94,
      orbit: 20.4,
      phase: 5.1,
    },
    {
      id: 'nacre',
      name: 'Nacre',
      kind: 'Ringed gas giant',
      description:
        'An uninhabited outer giant. Pearlescent cloud bands, a broad ring system, and two cold moons.',
      seed: 66013,
      terrain: 'gas',
      colors: ['#665b8d', '#a492ae', '#e1b59b', '#f5dfba'],
      atmosphere: '#e5d3ff',
      radius: 2.05,
      orbit: 27.4,
      phase: 0.3,
      moons: 2,
      rings: true,
    },
  ] satisfies PlanetRecipe[],
};

export function planetPosition(
  planet: Pick<PlanetRecipe, 'orbit' | 'phase'>,
  time = 0,
) {
  const angle = planet.phase + (time * 0.028) / Math.sqrt(planet.orbit);
  return {
    x: Math.cos(angle) * planet.orbit,
    y: 0,
    z: Math.sin(angle) * planet.orbit,
  };
}
