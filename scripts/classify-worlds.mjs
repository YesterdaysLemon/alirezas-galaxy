// Autonomous placement of public worlds with Jev (TypeSafe AI).
//
// Jev answers typed questions only: a Choice returns the highest-weight option
// and a probability for every option. One request asks four questions about a
// world: which family it joins (or none), which curated theme should open as a
// new family if none fits, which kind of planet it becomes, and which kind of
// project it is. Confident answers are applied without review; anything else
// falls back to Frontier.
//
// A family's star shows one system of FAMILY_LANES worlds. A family with no
// free lane is full: a world that belongs there opens its theme as a new
// family instead, so every world stays under a visible star. Worlds that
// overflowed into a family's hidden sister system are re-asked whenever the
// families change, and move as soon as a visible home exists. Moved worlds
// keep their former addresses, which are never handed out again.
//
// Keys come from the environment and are never logged; response bodies and
// error text are never printed.
import { createHash } from 'node:crypto';

export const JEV_MODEL = 'jev-1.13.0';
export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
/** A family pick at or above this weight is applied. */
export const FAMILY_THRESHOLD = 0.45;
/** "None fits" must be this sure, and its theme at least THEME_THRESHOLD. */
export const NEW_FAMILY_THRESHOLD = 0.5;
export const THEME_THRESHOLD = 0.3;
/** A project kind is shown only at or above this weight. */
export const LABEL_THRESHOLD = 0.35;
/** Worlds per system; data/solar-systems.ts PROJECT_SLOTS_PER_SYSTEM agrees. */
export const FAMILY_LANES = 8;

export const TERRAINS = {
  ocean: 'An ocean world: water, sailing, fish, weather, calm and depth.',
  garden:
    'A green continental world: growth, gardens, nature, research that blooms.',
  desert:
    'An arid amber world: dunes, canyons, bodies and anatomy, old and hardy things.',
  folds:
    'A frozen world of pale ridges: precision, notes, rules, cold engineering.',
  culture:
    'A colony world of luminous growths: cells, creatures, agents, emergence.',
  gas: 'A great banded gas giant: loud, large, musical, spectacular.',
};

/**
 * What a discovered project is, for its comms card. Curated worlds carry
 * their own hand-written kinds; discovered ones pick from these.
 */
export const LABELS = {
  'browser-game': 'Browser game',
  simulation: 'Live simulation',
  explainer: 'Animated explainer',
  essay: 'Interactive essay',
  journal: 'Research journal',
  museum: 'Walkable museum',
  tool: 'Working tool',
  infrastructure: 'Infrastructure',
  studio: 'Creative studio',
  music: 'Music and sound',
  visual: 'Visual experiment',
  atlas: 'Map and atlas',
};

const LABEL_CRITERIA = {
  'browser-game': 'A game people play in the browser.',
  simulation: 'A running simulation of a system, organism or world.',
  explainer: 'An animated or interactive explanation of how something works.',
  essay: 'An essay or argument with interactive parts.',
  journal: 'A journal, study or collection of research writing.',
  museum: 'A walkable or browsable collection, museum or archive.',
  tool: 'A practical tool people use to get something done.',
  infrastructure: 'Infrastructure or services that keep other work running.',
  studio: 'A place to make things: an editor, workshop or studio.',
  music: 'Music, sound or performance.',
  visual: 'A visual or graphics experiment.',
  atlas: 'A map, atlas or geographic exploration.',
};

const NONE = 'none-of-these';

function describeFamily(family, worlds) {
  const members = worlds
    .filter(
      (world) =>
        world.systemId === family.id ||
        world.systemId?.startsWith(`${family.id}-`),
    )
    .map((world) => `${world.name} (${world.description})`)
    .slice(0, 12);
  return `${family.name}: ${family.subtitle}${
    members.length ? ` Worlds: ${members.join('; ')}.` : ' No worlds yet.'
  }`;
}

/** The site's own <title> and meta description, from at most 96 KB of HTML. */
export async function homepageSummary(url, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Galaxy-world-classifier/1.0' },
    });
    if (!response.ok) return {};
    const html = (await response.text()).slice(0, 96 * 1024);
    const clean = (text) =>
      text
        ?.replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300);
    const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]);
    const description = clean(
      /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(
        html,
      )?.[1] ??
        /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(
          html,
        )?.[1],
    );
    return { title, description };
  } catch {
    return {};
  }
}

/** One Jev request: family, theme for a new family, and kind of world. */
export function jevRequest(project, summary, families, themes, worlds) {
  const placeable = families.filter((family) => family.id !== 'frontier');
  const familyCriteria = Object.fromEntries(
    placeable.map((family) => [family.id, describeFamily(family, worlds)]),
  );
  familyCriteria[NONE] =
    'None of these families fits this project well; it belongs in a new family.';
  const state = [
    "Alireza Afshan's personal website is a galaxy: each of his public projects is a world, and worlds are grouped into themed star families.",
    `A new project has appeared: ${project.name}.`,
    project.kind && project.kind !== 'Public project'
      ? `Kind: ${project.kind}.`
      : '',
    `Description: ${project.description}`,
    summary.title ? `Its homepage title: ${summary.title}.` : '',
    summary.description ? `Its homepage says: ${summary.description}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const questions = {
    family: {
      type: 'choice',
      instructions:
        'Which existing family should this new project join? Prefer the family whose theme and current worlds it most resembles. Choose none only if it clearly fits no family.',
      criteria: familyCriteria,
    },
    kind: {
      type: 'choice',
      instructions:
        'Which kind of fictional world best suits this project as a planet in the galaxy?',
      criteria: TERRAINS,
    },
    label: {
      type: 'choice',
      instructions: 'What kind of project is this, for a short label?',
      criteria: LABEL_CRITERIA,
    },
  };
  if (themes.length)
    questions.theme = {
      type: 'choice',
      instructions:
        'If this project had to start a new family, which of these themes would it belong to?',
      criteria: Object.fromEntries(
        themes.map((theme) => [theme.id, `${theme.name}: ${theme.subtitle}`]),
      ),
    };
  return { model: JEV_MODEL, state, questions };
}

const sameMembers = (a, b) =>
  a.length === b.length && new Set([...a, ...b]).size === a.length;

/** Validate a Choice answer exactly as the reference client does. */
export function validateChoice(answer, options) {
  const probabilities = answer?.probabilities ?? {};
  if (
    answer?.type !== 'choice' ||
    !sameMembers(Object.keys(probabilities), options)
  )
    throw new Error('Choice schema or option coverage mismatch');
  const values = Object.values(probabilities);
  if (
    values.some(
      (value) =>
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1,
    )
  )
    throw new Error('Nonfinite or out-of-range probability');
  // Rounded weights over five or more options can drift a little from one.
  const total = values.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.02)
    throw new Error('Probabilities do not sum to one');
  for (const option of Object.keys(probabilities))
    probabilities[option] /= total;
  if (
    !(answer.choice in probabilities) ||
    probabilities[answer.choice] <
      Math.max(...Object.values(probabilities)) - 1e-8
  )
    throw new Error('Returned choice is not a maximum');
  return answer;
}

export function validateResponse(response, request) {
  if (response?.model !== JEV_MODEL)
    throw new Error('Response model differs from pinned model');
  const answers = {};
  for (const [name, question] of Object.entries(request.questions))
    answers[name] = validateChoice(
      response.answers?.[name],
      Object.keys(question.criteria),
    );
  return answers;
}

export async function askJev(request, key, fetchImpl = fetch) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await fetchImpl(JEV_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      if (attempt === 3) throw new Error('Jev unreachable');
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      continue;
    }
    if (response.ok) return validateResponse(await response.json(), request);
    await response.body?.cancel();
    const retry = response.status === 429 || response.status >= 500;
    if (!retry || attempt === 3)
      throw new Error(`Jev request failed with HTTP ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
  throw new Error('Jev request failed');
}

/**
 * Turn Jev's answers into a placement. Pure, so it can be tested and audited.
 * A confident pick of a full family opens the world's theme instead.
 * @param {{ canOpenFamily: boolean, isFull?: (familyId: string) => boolean }} options
 * @returns {{ place: 'family' | 'new-family' | 'frontier', familyId?: string, themeId?: string, terrain: string, label?: string, reason?: 'family-full' }}
 */
export function decide(answers, { canOpenFamily, isFull = () => false }) {
  const family = answers.family;
  const terrain = answers.kind.choice;
  const label =
    answers.label &&
    answers.label.probabilities[answers.label.choice] >= LABEL_THRESHOLD
      ? LABELS[answers.label.choice]
      : undefined;
  const weight = family.probabilities[family.choice];
  const confident = family.choice !== NONE && weight >= FAMILY_THRESHOLD;
  if (confident && !isFull(family.choice))
    return { place: 'family', familyId: family.choice, terrain, label };
  const full = confident;
  const theme = answers.theme;
  if (
    (full || (family.choice === NONE && weight >= NEW_FAMILY_THRESHOLD)) &&
    canOpenFamily &&
    theme &&
    theme.probabilities[theme.choice] >= THEME_THRESHOLD
  )
    return {
      place: 'new-family',
      themeId: theme.choice,
      terrain,
      label,
      ...(full ? { reason: 'family-full' } : {}),
    };
  return {
    place: 'frontier',
    terrain,
    label,
    ...(full ? { reason: 'family-full' } : {}),
  };
}

/**
 * Next never-used slot in a family: past every member, tombstone and former
 * address (an entry's `formerAddresses`, as "system/slot" strings).
 */
export function nextSlot(familyId, addresses) {
  let next = 0;
  for (const address of usedAddresses(addresses))
    if (address.systemId === familyId)
      next = Math.max(next, address.orbitSlot + 1);
  return next;
}

/** Every address ever used: current ones and each entry's former addresses. */
export function usedAddresses(entries) {
  const used = [];
  for (const entry of entries) {
    if (Number.isSafeInteger(entry.orbitSlot))
      used.push({ systemId: entry.systemId, orbitSlot: entry.orbitSlot });
    for (const former of entry.formerAddresses ?? []) {
      const [systemId, slot] = former.split('/');
      used.push({ systemId, orbitSlot: Number(slot) });
    }
  }
  return used;
}

/** A family is full once its visible system has no never-used lane. */
export const familyIsFull = (familyId, addresses) =>
  nextSlot(familyId, addresses) >= FAMILY_LANES;

/** The family a system address belongs to: "tools-and-infrastructure-2" → "tools-and-infrastructure". */
export const familyOf = (systemId) => systemId.replace(/-\d+$/, '');

const sha256 = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * Classify every new, unaddressed, healthy world. Mutates nothing it is given;
 * returns addresses to apply, terrain choices, updated families and log lines.
 */
export async function classifyNewWorlds({
  newWorlds,
  familyData,
  catalog,
  addresses,
  key,
  fetchImpl = fetch,
  now = Date.now(),
}) {
  const session = placementSession({ familyData, catalog, addresses, now });
  for (const project of newWorlds) {
    const { entry, decision } = await session.ask(project, key, fetchImpl);
    const address = session.place(project, decision, entry);
    session.log.push({
      ...entry,
      decision: { ...decisionSummary(decision), ...address },
    });
  }
  return session.result();
}

const decisionSummary = (decision) => ({
  place: decision.place,
  ...(decision.reason ? { reason: decision.reason } : {}),
});

/**
 * Shared bookkeeping for one refresh: the evolving family list, every address
 * ever used, the catalog Jev sees, and what was decided.
 */
function placementSession({ familyData, catalog, addresses, now }) {
  const families = structuredClone(familyData);
  const known = usedAddresses(addresses);
  const worlds = [...catalog];
  const placements = new Map();
  const terrain = {};
  const log = [];
  return {
    families,
    log,
    known,
    async ask(project, key, fetchImpl) {
      const summary = await homepageSummary(project.url, fetchImpl);
      const request = jevRequest(
        project,
        summary,
        families.active,
        families.themes,
        worlds.filter((world) => world.id !== project.id),
      );
      const entry = {
        id: project.id,
        classifiedAt: new Date(now).toISOString(),
        model: JEV_MODEL,
        requestSha256: sha256(request),
      };
      let decision;
      try {
        const answers = await askJev(request, key, fetchImpl);
        decision = decide(answers, {
          canOpenFamily: families.active.length < families.maxActive,
          isFull: (familyId) => familyIsFull(familyId, known),
        });
        entry.answers = Object.fromEntries(
          Object.entries(answers).map(([name, answer]) => [
            name,
            {
              choice: answer.choice,
              confidence: answer.confidence,
              probabilities: answer.probabilities,
            },
          ]),
        );
      } catch (error) {
        decision = { place: 'frontier' };
        entry.error = error instanceof Error ? error.message : 'Jev failed';
      }
      return { entry, decision };
    },
    /**
     * Apply a decision: open a family if asked, and take its next lane. A
     * world's look is chosen once, at its first placement; `keepLook` moves
     * it without repainting the planet.
     */
    place(project, decision, entry, { keepLook = false } = {}) {
      let familyId = decision.familyId ?? 'frontier';
      if (decision.place === 'new-family') {
        const theme = families.themes.find((t) => t.id === decision.themeId);
        families.themes = families.themes.filter((t) => t !== theme);
        // New families join before Frontier, which always stays last.
        families.active.splice(families.active.length - 1, 0, theme);
        familyId = theme.id;
        entry.openedFamily = theme.id;
      }
      const address = {
        systemId: familyId,
        orbitSlot: nextSlot(familyId, known),
      };
      known.push(address);
      placements.set(project.id, address);
      const index = worlds.findIndex((world) => world.id === project.id);
      if (index >= 0) worlds.splice(index, 1);
      worlds.push({ ...project, ...address });
      const look =
        decision.terrain && !keepLook ? { terrain: decision.terrain } : {};
      if (look.terrain || decision.label)
        terrain[project.id] = {
          ...look,
          ...(decision.label ? { label: decision.label } : {}),
        };
      return address;
    },
    result() {
      return { placements, terrain, families, log };
    },
  };
}

/**
 * Name what already-placed discovered worlds are, without touching where they
 * live: a request with only the label question. Each world is asked once; an
 * unsure answer is recorded as `label: null` so it is not asked again.
 * @returns {Promise<{ labels: Record<string, string | null>, log: object[] }>}
 */
export async function labelWorlds({
  worlds,
  key,
  fetchImpl = fetch,
  now = Date.now(),
}) {
  const labels = {};
  const log = [];
  for (const world of worlds) {
    const summary = await homepageSummary(world.url, fetchImpl);
    const full = jevRequest(world, summary, [], [], []);
    const request = { ...full, questions: { label: full.questions.label } };
    const entry = {
      id: world.id,
      classifiedAt: new Date(now).toISOString(),
      model: JEV_MODEL,
      requestSha256: sha256(request),
      labelOnly: true,
    };
    try {
      const { label } = await askJev(request, key, fetchImpl);
      const confident = label.probabilities[label.choice] >= LABEL_THRESHOLD;
      labels[world.id] = confident ? LABELS[label.choice] : null;
      entry.answers = {
        label: {
          choice: label.choice,
          confidence: label.confidence,
          probabilities: label.probabilities,
        },
      };
      entry.decision = { label: labels[world.id] };
    } catch (error) {
      entry.error = error instanceof Error ? error.message : 'Jev failed';
    }
    log.push(entry);
  }
  return { labels, log };
}

/** Worlds that overflowed into a family's sister system: slot past its lanes. */
export const overflowing = (world) =>
  Number.isSafeInteger(world.orbitSlot) && world.orbitSlot >= FAMILY_LANES;

/**
 * Worlds still looking for a home: those hidden in a sister system, and those
 * on Frontier, where uncertain worlds wait until a family fits them.
 */
export const awaitingHome = (world) =>
  overflowing(world) || familyOf(world.systemId ?? '') === 'frontier';

/**
 * What the families look like to an overflowing world: re-asking is only
 * worthwhile once this changes.
 */
export function familySignature(familyData, addresses) {
  return familyData.active
    .map((family) =>
      familyIsFull(family.id, addresses) ? `${family.id}:full` : family.id,
    )
    .concat(familyData.active.length < familyData.maxActive ? ['room'] : [])
    .join(',');
}

/**
 * Re-ask Jev about worlds awaiting a home, and move each to the home its
 * answer gives: a family with a free lane, a newly opened family, or, for a
 * world hidden in a sister system, Frontier's visible star. A Frontier world
 * that would only land on Frontier again stays put. Moves record the old
 * address, which is never reused.
 * @returns {Promise<{ moves: Map<string, {from: string, to: {systemId: string, orbitSlot: number}}>, families: any, terrain: any, log: any[], signature: string }>}
 */
export async function rehomeOverflow({
  worlds,
  familyData,
  catalog,
  addresses,
  key,
  fetchImpl = fetch,
  now = Date.now(),
}) {
  const session = placementSession({ familyData, catalog, addresses, now });
  const moves = new Map();
  for (const world of worlds) {
    if (!awaitingHome(world)) continue;
    const { entry, decision } = await session.ask(world, key, fetchImpl);
    const from = `${world.systemId}/${world.orbitSlot}`;
    const stays =
      decision.place === 'frontier' && familyOf(world.systemId) === 'frontier';
    if (stays) {
      session.log.push({
        ...entry,
        rehome: true,
        decision: { ...decisionSummary(decision), stayed: from },
      });
      continue;
    }
    const to = session.place(world, decision, entry, { keepLook: true });
    moves.set(world.id, { from, to });
    session.log.push({
      ...entry,
      rehome: true,
      decision: { ...decisionSummary(decision), from, ...to },
    });
  }
  const { families, terrain, log } = session.result();
  return {
    moves,
    families,
    terrain,
    log,
    signature: familySignature(families, session.known),
  };
}
