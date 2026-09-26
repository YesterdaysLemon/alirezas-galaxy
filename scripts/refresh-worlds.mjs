import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  classifyNewWorlds,
  awaitingHome,
  familySignature,
  labelWorlds,
  rehomeOverflow,
} from './classify-worlds.mjs';

export const GRACE_MS = 7 * 86400000;
const source = 'https://deploy.alirezaafshan.com/api/topology';

export function publicUrl(value) {
  try {
    const url = new URL(value);
    const label = url.hostname.replace(/\.alirezaafshan\.com$/, '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !/^[a-z0-9-]+\.alirezaafshan\.com$/.test(url.hostname) ||
      /(^|-)(mail|smtp|imap|admin|internal|staging|stage|dev|test|vpn|api)(-|$)/.test(
        label,
      ) ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

// Active families live in data/families.json; classification may add one.
const familyIds = new Set(
  JSON.parse(await readFile('data/families.json', 'utf8')).active.map(
    (family) => family.id,
  ),
);

function hasAddress(project) {
  return (
    project &&
    Number.isSafeInteger(project.orbitSlot) &&
    project.orbitSlot >= 0 &&
    (familyIds.has(project.systemId) ||
      (project.id === 'portfolio' &&
        project.systemId === 'home' &&
        project.orbitSlot === 0))
  );
}

/** Registry addresses win; state tombstones outlive health, URLs and publication. */
export function assignMembership(projects, previous, state) {
  const assignments = new Map();
  for (const project of previous)
    if (hasAddress(project)) assignments.set(project.id, project);
  for (const [id, entry] of Object.entries(state)) {
    const address = { ...entry, id };
    if (hasAddress(address)) assignments.set(id, address);
  }
  for (const project of projects) {
    if (project.systemId !== undefined || project.orbitSlot !== undefined) {
      if (!hasAddress(project))
        throw new Error(`Invalid system address for ${project.id}`);
      assignments.set(project.id, project);
    }
  }
  const occupied = new Map();
  let nextFrontierSlot = 0;
  const take = (key, id) => {
    if (occupied.has(key) && occupied.get(key) !== id)
      throw new Error(`Duplicate system address ${key}`);
    occupied.set(key, id);
    const [systemId, slot] = key.split('/');
    if (systemId === 'frontier')
      nextFrontierSlot = Math.max(nextFrontierSlot, Number(slot) + 1);
  };
  for (const [id, project] of assignments)
    take(`${project.systemId}/${project.orbitSlot}`, id);
  // A moved world's old addresses are never handed to anyone else.
  for (const [id, entry] of Object.entries(state))
    for (const former of entry.formerAddresses ?? []) take(former, id);
  const byId = new Map(previous.map((project) => [project.id, project]));
  for (const project of projects) byId.set(project.id, project);
  // Code-unit order, so addresses never depend on the runner's locale.
  for (const id of [...byId.keys()].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    if (!assignments.has(id)) {
      if (!Number.isSafeInteger(nextFrontierSlot))
        throw new Error('Frontier address space exhausted');
      assignments.set(id, {
        systemId: 'frontier',
        orbitSlot: nextFrontierSlot++,
      });
    }
  }
  return assignments;
}

export function candidates(registry, topology) {
  if (
    registry.version !== 1 ||
    !Array.isArray(registry.projects) ||
    !Array.isArray(registry.deniedIds) ||
    !Array.isArray(topology.apps)
  ) {
    throw new Error(
      'Invalid registry or discovery source; retaining last-known-good catalog',
    );
  }
  const byUrl = new Map();
  const addresses = new Set();
  const ids = new Set();
  // Registry ordering and authored metadata win over remote labels.
  for (const project of registry.projects) {
    const url = publicUrl(project.url);
    if (!hasAddress(project))
      throw new Error(
        `Missing or invalid registry system address for ${project.id}`,
      );
    const address = `${project.systemId}/${project.orbitSlot}`;
    if (addresses.has(address))
      throw new Error(`Duplicate registry system address ${address}`);
    addresses.add(address);
    if (!url || ids.has(project.id) || byUrl.has(url))
      throw new Error('Invalid or duplicate registry project');
    ids.add(project.id);
    if (!registry.deniedIds.includes(project.id))
      byUrl.set(url, { ...project, url });
  }
  // apps[].url is Deploy Manager's explicit publicUrl opt-in. Routes alone do not opt in.
  for (const app of [...topology.apps].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), 'en'),
  )) {
    const url = publicUrl(app.url);
    if (
      !url ||
      registry.deniedIds.includes(app.id) ||
      byUrl.has(url) ||
      ids.has(app.id)
    )
      continue;
    if (
      !/^[a-z0-9-]{1,60}$/.test(app.id) ||
      typeof app.name !== 'string' ||
      typeof app.description !== 'string'
    )
      continue;
    ids.add(app.id);
    byUrl.set(url, {
      id: app.id,
      name: app.name.slice(0, 80),
      kind: 'Public project',
      url,
      description: app.description.slice(0, 300),
      relationship: 'owned',
      hosting: 'first-party',
      status: 'live',
      glyph: '✦',
    });
  }
  return [...byUrl.values()];
}

export function reconcile(
  projects,
  previous,
  state,
  health,
  now = Date.now(),
  deniedIds = [],
) {
  const assignments = assignMembership(projects, previous, state);
  // Retired IDs retain address tombstones; their slots must never be recycled.
  const nextState = { ...state };
  const worlds = [];
  const currentIds = new Set(projects.map((p) => p.id));
  const previousById = new Map(
    previous.map((project) => [project.id, project]),
  );
  for (const project of [
    ...projects,
    ...previous.filter((p) => !currentIds.has(p.id)),
  ]) {
    const { systemId, orbitSlot } = assignments.get(project.id);
    if (deniedIds.includes(project.id)) {
      nextState[project.id] = { ...state[project.id], systemId, orbitSlot };
      continue;
    }
    const priorWorld = previousById.get(project.id);
    const old = priorWorld?.url === project.url ? priorWorld : undefined;
    const healthy = currentIds.has(project.id) && health[project.id] === true;
    const prior =
      state[project.id]?.url === project.url ? state[project.id] : {};
    const failedSince = healthy
      ? null
      : (prior.failedSince ?? new Date(now).toISOString());
    const everHealthy =
      healthy ||
      prior.everHealthy === true ||
      (Boolean(old) && old.status !== 'preview');
    const { formerAddresses, rehomeSignature } = state[project.id] ?? {};
    nextState[project.id] = {
      url: project.url,
      everHealthy,
      failedSince,
      systemId,
      orbitSlot,
      ...(formerAddresses ? { formerAddresses } : {}),
      ...(rehomeSignature ? { rehomeSignature } : {}),
    };
    const { showPending, ...world } = project;
    if (healthy)
      worlds.push({
        ...world,
        systemId,
        orbitSlot,
        status: world.status === 'sleeping' ? 'sleeping' : 'live',
      });
    else if (old && now - Date.parse(failedSince) < GRACE_MS)
      worlds.push({ ...old, systemId, orbitSlot });
    else if (showPending && !everHealthy)
      worlds.push({ ...world, systemId, orbitSlot, status: 'preview' });
  }
  return { worlds, state: nextState };
}

async function probe(url) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Galaxy-public-world-discovery/1.0' },
    });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

async function saveChanged(path, value) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if ((await readFile(path, 'utf8').catch(() => '')) === text) return false;
  await writeFile(path + '.tmp', text);
  await rename(path + '.tmp', path);
  return true;
}

/**
 * New healthy worlds with no address are placed by Jev when a key is present
 * (TYPESAFE_API_KEY); without one they fall back to Frontier as before.
 * Applies addresses to the candidate projects, which then behave exactly like
 * reviewed registry addresses, and records every decision.
 */
async function classify(projects, previous, state, health) {
  const key = process.env.TYPESAFE_API_KEY?.trim();
  const addressed = new Set([
    ...previous.filter(hasAddress).map((p) => p.id),
    ...Object.entries(state)
      .filter(([id, entry]) => hasAddress({ ...entry, id }))
      .map(([id]) => id),
  ]);
  const newWorlds = projects.filter(
    (p) =>
      p.systemId === undefined && !addressed.has(p.id) && health[p.id] === true,
  );
  if (!key || !newWorlds.length) return [];
  const familyData = JSON.parse(await readFile('data/families.json', 'utf8'));
  const addresses = [
    ...Object.values(state),
    ...previous,
    ...projects.filter(hasAddress),
  ].filter((entry) => Number.isSafeInteger(entry.orbitSlot));
  const catalog = [...previous, ...projects.filter(hasAddress)];
  const { placements, terrain, families, log } = await classifyNewWorlds({
    newWorlds,
    familyData,
    catalog,
    addresses,
    key,
  });
  for (const project of projects) {
    const address = placements.get(project.id);
    if (address) Object.assign(project, address);
  }
  return saveJevOutcome(families, terrain, log);
}

/** Record families, appearance and every decision, and summarize them. */
async function saveJevOutcome(families, terrain, log) {
  for (const family of families.active) familyIds.add(family.id);
  await saveChanged('data/families.json', families);
  const known = JSON.parse(
    await readFile('data/world-terrain.json', 'utf8').catch(() => '{}'),
  );
  // A world keeps the look it already has; new answers only fill gaps.
  for (const [id, entry] of Object.entries(terrain))
    known[id] = { ...entry, ...known[id] };
  await saveChanged('data/world-terrain.json', known);
  const history = JSON.parse(
    await readFile('data/world-classifications.json', 'utf8').catch(() => '[]'),
  );
  await saveChanged('data/world-classifications.json', [...history, ...log]);
  return log.map((entry) => ({
    id: entry.id,
    ...entry.decision,
    ...(entry.error ? { error: entry.error } : {}),
  }));
}

/**
 * Give discovered worlds (kind "Public project") a short kind, once each.
 * Only the label is asked, so this never moves a world.
 */
async function label(projects, health) {
  const key = process.env.TYPESAFE_API_KEY?.trim();
  if (!key) return [];
  const known = JSON.parse(
    await readFile('data/world-terrain.json', 'utf8').catch(() => '{}'),
  );
  const unnamed = projects.filter(
    (project) =>
      project.kind === 'Public project' &&
      health[project.id] === true &&
      known[project.id]?.label === undefined,
  );
  if (!unnamed.length) return [];
  const { labels, log } = await labelWorlds({ worlds: unnamed, key });
  for (const [id, value] of Object.entries(labels))
    known[id] = { ...known[id], label: value };
  await saveChanged('data/world-terrain.json', known);
  const history = JSON.parse(
    await readFile('data/world-classifications.json', 'utf8').catch(() => '[]'),
  );
  await saveChanged('data/world-classifications.json', [...history, ...log]);
  return log.map((entry) => ({ id: entry.id, ...entry.decision }));
}

/**
 * Drain the hidden sister systems and settle Frontier. Discovered worlds past
 * their family's visible lanes, or waiting on Frontier, are re-asked, but only
 * when the families have changed since they were last asked; each move keeps
 * the old address as a former address. Reviewed registry worlds are never moved here: their
 * addresses belong to the registry (a unit test keeps them in view).
 */
async function rehome(projects, previous, state, health) {
  const key = process.env.TYPESAFE_API_KEY?.trim();
  if (!key) return [];
  const familyData = JSON.parse(await readFile('data/families.json', 'utf8'));
  const addresses = [
    ...Object.values(state),
    ...previous,
    ...projects.filter(hasAddress),
  ];
  const signature = familySignature(familyData, addresses);
  const reviewed = new Set(projects.filter(hasAddress).map((p) => p.id));
  const byId = new Map(previous.map((world) => [world.id, world]));
  const stuck = Object.entries(state)
    .map(([id, entry]) => ({ ...byId.get(id), ...entry, id }))
    .filter(
      (world) =>
        hasAddress(world) &&
        awaitingHome(world) &&
        !reviewed.has(world.id) &&
        health[world.id] === true &&
        world.rehomeSignature !== signature,
    );
  if (!stuck.length) return [];
  const catalog = [...previous, ...projects.filter(hasAddress)];
  const { moves, families, terrain, log } = await rehomeOverflow({
    worlds: stuck,
    familyData,
    catalog,
    addresses,
    key,
  });
  const settled = familySignature(families, [
    ...addresses,
    ...[...moves.values()].map((move) => move.to),
  ]);
  for (const world of stuck) {
    const entry = state[world.id];
    const move = moves.get(world.id);
    if (move) {
      entry.formerAddresses = [...(entry.formerAddresses ?? []), move.from];
      Object.assign(entry, move.to);
      const shown = byId.get(world.id);
      if (shown) Object.assign(shown, move.to);
    }
    entry.rehomeSignature = settled;
  }
  return saveJevOutcome(families, terrain, log);
}

export async function refresh() {
  const registry = JSON.parse(
    await readFile('data/world-registry.json', 'utf8'),
  );
  const previous = JSON.parse(
    await readFile('data/worlds.generated.json', 'utf8'),
  );
  const state = JSON.parse(
    await readFile('data/world-discovery-state.json', 'utf8').catch(() => '{}'),
  );
  const response = await fetch(source, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok)
    throw new Error(`Discovery source failed: ${response.status}`);
  const topology = await response.json();
  const projects = candidates(registry, topology);
  const health = {};
  // Four bounded requests at a time; no browser-time network discovery.
  for (let start = 0; start < projects.length; start += 4) {
    await Promise.all(
      projects.slice(start, start + 4).map(async (p) => {
        health[p.id] = await probe(p.url);
      }),
    );
  }
  const classified = await classify(projects, previous, state, health);
  const rehomed = await rehome(projects, previous, state, health);
  const labelled = await label(projects, health);
  const result = reconcile(
    projects,
    previous,
    state,
    health,
    Date.now(),
    registry.deniedIds,
  );
  await saveChanged('data/worlds.generated.json', result.worlds);
  await saveChanged('data/world-discovery-state.json', result.state);
  console.log(
    JSON.stringify({
      source,
      classified,
      rehomed,
      labelled,
      worlds: result.worlds.map((w) => ({ id: w.id, status: w.status })),
      unhealthy: projects.filter((p) => !health[p.id]).map((p) => p.id),
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await refresh();
