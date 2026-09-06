export const motionFamilies = [
  {
    id: 'modal',
    label: 'Opened comms',
    description:
      'Click to open the full panel. Three ways for the conversation to arrive.',
  },
  {
    id: 'entry',
    label: 'Hover arrivals',
    description: 'Construct the metal. Unfold the glass. Resolve the signal.',
  },
  {
    id: 'world',
    label: 'World cards',
    description: 'A little personality without chasing the click target.',
  },
  {
    id: 'menu',
    label: 'Menu rows',
    description: 'Light and momentum moving through the blue glass.',
  },
  {
    id: 'reply',
    label: 'Reply buttons',
    description: 'Small, deliberate feedback for the next step.',
  },
  {
    id: 'close',
    label: 'The red X',
    description: 'Three ways to make that little mechanism feel satisfying.',
  },
  {
    id: 'footer',
    label: 'Footer controls',
    description: 'Flywheels, tuners, and a waking transmission screen.',
  },
  {
    id: 'beacon',
    label: 'Distant beacons',
    description: 'An invitation from the other side of the galaxy.',
  },
] as const;

export type MotionFamily = (typeof motionFamilies)[number]['id'];
export type MotionProposal = {
  id: string;
  family: MotionFamily;
  name: string;
  note: string;
  timing: string;
};

export const motionProposals: MotionProposal[] = [
  {
    id: 'D1',
    family: 'modal',
    name: 'Docking sequence',
    note: 'Portrait first. The message casing docks beside it, replies slide down, then the readout comes online.',
    timing: '740 ms · portrait → message → replies',
  },
  {
    id: 'D2',
    family: 'modal',
    name: 'Command deck',
    note: 'The upper assembly hinges toward you; a second leaf lowers the reply controls into place.',
    timing: '860 ms · upper hinge → lower leaf → signal',
  },
  {
    id: 'D3',
    family: 'modal',
    name: 'Signal lock',
    note: 'A thin transmission line expands into the casing. The screens briefly tune before the message resolves.',
    timing: '1000 ms · casing → scan → connection',
  },
  {
    id: 'E1',
    family: 'entry',
    name: 'Telescopic signal',
    note: 'The portrait socket assembles, two rails extend, then static clears into the picture and readout.',
    timing: '920 ms · socket → rails → signal',
  },
  {
    id: 'E2',
    family: 'entry',
    name: 'Hinged transmission',
    note: 'A small mechanism opens from nothing. The nameplate unfolds in two leaves before its screens tune in.',
    timing: '1100 ms · construct → unfurl → resolve',
  },
  {
    id: 'E3',
    family: 'entry',
    name: 'Drawn into orbit',
    note: 'The portrait rim draws around its center; a casing grows out of it and a scanline reveals the signal.',
    timing: '1000 ms · rim → casing → scan',
  },
  {
    id: 'W1',
    family: 'world',
    name: 'Soft lift',
    note: 'The whole nameplate rises gently and settles into your attention.',
    timing: '280 ms · soft spring',
  },
  {
    id: 'W2',
    family: 'world',
    name: 'Unfold the signal',
    note: 'The nameplate slides out while its portrait turns a few degrees.',
    timing: '360 ms · staggered',
  },
  {
    id: 'W3',
    family: 'world',
    name: 'Magnetic glass',
    note: 'Move across the preview: the glass leans toward your pointer.',
    timing: '160 ms · pointer-driven',
  },
  {
    id: 'M1',
    family: 'menu',
    name: 'Light arrives',
    note: 'A warm highlight travels across the row before the label advances.',
    timing: '320 ms · ease out',
  },
  {
    id: 'M2',
    family: 'menu',
    name: 'Spring nudge',
    note: 'The row nudges forward, overshoots once, then comes to rest.',
    timing: '460 ms · spring',
  },
  {
    id: 'M3',
    family: 'menu',
    name: 'Glass ripple',
    note: 'A single ring expands from the icon across the selected glass.',
    timing: '620 ms · one pulse',
  },
  {
    id: 'R1',
    family: 'reply',
    name: 'Ready to launch',
    note: 'The button lifts and the little arrow steps forward.',
    timing: '220 ms · crisp',
  },
  {
    id: 'R2',
    family: 'reply',
    name: 'Photon sweep',
    note: 'One narrow reflection crosses the button. No movement under the pointer.',
    timing: '650 ms · light only',
  },
  {
    id: 'R3',
    family: 'reply',
    name: 'Charged edge',
    note: 'The rim warms up while the middle of the button stays grounded.',
    timing: '360 ms · light only',
  },
  {
    id: 'C1',
    family: 'close',
    name: 'Quarter turn',
    note: 'The cross turns inside its socket; the metal rim barely lifts.',
    timing: '300 ms · mechanical',
  },
  {
    id: 'C2',
    family: 'close',
    name: 'Rubber socket',
    note: 'A small elastic wobble gives the red button a more playful feel.',
    timing: '520 ms · elastic',
  },
  {
    id: 'C3',
    family: 'close',
    name: 'Iris focus',
    note: 'An outer ring closes around the button as the red lens brightens.',
    timing: '380 ms · focus',
  },
  {
    id: 'F1',
    family: 'footer',
    name: 'Flywheel',
    note: 'The galaxy mark winds forward inside a steady blue housing.',
    timing: '700 ms · weighted',
  },
  {
    id: 'F2',
    family: 'footer',
    name: 'Tune the channel',
    note: 'The small dial turns and a reflection passes over the readout.',
    timing: '600 ms · coordinated',
  },
  {
    id: 'F3',
    family: 'footer',
    name: 'Console wake',
    note: 'The screen brightens and its four tiny indicators light in sequence.',
    timing: '560 ms · staggered',
  },
  {
    id: 'B1',
    family: 'beacon',
    name: 'Hello, out there',
    note: 'Two restrained signal rings acknowledge your arrival.',
    timing: '900 ms · staggered pulses',
  },
  {
    id: 'B2',
    family: 'beacon',
    name: 'Gravity lens',
    note: 'The outer lens tightens around a slightly brighter star.',
    timing: '380 ms · inward focus',
  },
  {
    id: 'B3',
    family: 'beacon',
    name: 'Orbital sweep',
    note: 'A broken ring makes one slow pass around the signal.',
    timing: '950 ms · orbital',
  },
];

// User-selected direction; keep this separate from editable browser shortlists.
export const confirmedMotionPicks = [
  'E2',
  'W2',
  'M1',
  'M3',
  'R3',
  'C1',
  'F1',
  'B3',
];

export function validMotionPicks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(motionProposals.map(({ id }) => id));
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === 'string' && known.has(id),
      ),
    ),
  ];
}

export function describeMotionPicks(picks: string[]): string {
  return motionProposals
    .filter(({ id }) => picks.includes(id))
    .map(({ id, name }) => `${id} — ${name}`)
    .join('\n');
}
