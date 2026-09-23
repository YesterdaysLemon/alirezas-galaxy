// Autonomous placement of new public worlds with Jev (TypeSafe AI).
//
// Jev answers typed questions only: a Choice returns the highest-weight option
// and a probability for every option. One request asks three questions about a
// new world: which family it joins (or none), which curated theme should open
// as a new family if none fits, and which kind of world it is. Confident
// answers are applied without review; anything else falls back to Frontier.
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

const NONE = 'none-of-these';

function describeFamily(family, worlds) {
  const members = worlds
    .filter((world) => world.systemId === family.id)
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
 * @returns {{ place: 'family' | 'new-family' | 'frontier', familyId?: string, themeId?: string, terrain: string }}
 */
export function decide(answers, { canOpenFamily }) {
  const family = answers.family;
  const terrain = answers.kind.choice;
  const weight = family.probabilities[family.choice];
  if (family.choice !== NONE && weight >= FAMILY_THRESHOLD)
    return { place: 'family', familyId: family.choice, terrain };
  const theme = answers.theme;
  if (
    family.choice === NONE &&
    weight >= NEW_FAMILY_THRESHOLD &&
    canOpenFamily &&
    theme &&
    theme.probabilities[theme.choice] >= THEME_THRESHOLD
  )
    return { place: 'new-family', themeId: theme.choice, terrain };
  return { place: 'frontier', terrain };
}

/** Next never-used slot in a family: past every member and tombstone. */
export function nextSlot(familyId, addresses) {
  let next = 0;
  for (const address of addresses)
    if (address.systemId === familyId)
      next = Math.max(next, address.orbitSlot + 1);
  return next;
}

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
  const families = structuredClone(familyData);
  const known = [...addresses];
  const worlds = [...catalog];
  const placements = new Map();
  const terrain = {};
  const log = [];
  for (const project of newWorlds) {
    const summary = await homepageSummary(project.url, fetchImpl);
    const request = jevRequest(
      project,
      summary,
      families.active,
      families.themes,
      worlds,
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
    worlds.push({ ...project, ...address });
    if (decision.terrain) terrain[project.id] = { terrain: decision.terrain };
    entry.decision = { place: decision.place, ...address };
    log.push(entry);
  }
  return { placements, terrain, families, log };
}
