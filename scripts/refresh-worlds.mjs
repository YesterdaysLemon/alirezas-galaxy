import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const MAX_WORLDS = 18;
export const GRACE_MS = 7 * 86400000;
const source = 'https://deploy.alirezaafshan.com/api/topology';

export function publicUrl(value) {
  try {
    const url = new URL(value);
    const label = url.hostname.replace(/\.alirezaafshan\.com$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !/^[a-z0-9-]+\.alirezaafshan\.com$/.test(url.hostname) ||
        /(^|-)(mail|smtp|imap|admin|internal|staging|stage|dev|test|vpn|api)(-|$)/.test(label) ||
        url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

export function candidates(registry, topology) {
  if (registry.version !== 1 || !Array.isArray(registry.projects) ||
      !Array.isArray(registry.deniedIds) || !Array.isArray(topology.apps)) {
    throw new Error('Invalid registry or discovery source; retaining last-known-good catalog');
  }
  const byUrl = new Map();
  const ids = new Set();
  // Registry ordering and authored metadata win over remote labels.
  for (const project of registry.projects) {
    const url = publicUrl(project.url);
    if (!url || ids.has(project.id) || byUrl.has(url)) throw new Error('Invalid or duplicate registry project');
    ids.add(project.id);
    if (!registry.deniedIds.includes(project.id)) byUrl.set(url, { ...project, url });
  }
  // apps[].url is Deploy Manager's explicit publicUrl opt-in. Routes alone do not opt in.
  for (const app of [...topology.apps].sort((a,b) => String(a.id).localeCompare(String(b.id), 'en'))) {
    const url = publicUrl(app.url);
    if (!url || registry.deniedIds.includes(app.id) || byUrl.has(url) || ids.has(app.id)) continue;
    if (!/^[a-z0-9-]{1,60}$/.test(app.id) || typeof app.name !== 'string' || typeof app.description !== 'string') continue;
    ids.add(app.id);
    byUrl.set(url, {id:app.id,name:app.name.slice(0,80),kind:'Public project',url,
      description:app.description.slice(0,300),relationship:'owned',hosting:'first-party',status:'live',glyph:'✦'});
  }
  if (byUrl.size > MAX_WORLDS) throw new Error(`World capacity ${MAX_WORLDS} exceeded; review layout before publishing`);
  return [...byUrl.values()];
}

export function reconcile(projects, previous, state, health, now = Date.now(), deniedIds = []) {
  const nextState = {};
  const worlds = [];
  const currentIds = new Set(projects.map(p => p.id));
  for (const project of [...projects, ...previous.filter(p => !currentIds.has(p.id))]) {
    if (deniedIds.includes(project.id)) continue;
    const old = previous.find(p => p.id === project.id && p.url === project.url);
    const healthy = currentIds.has(project.id) && health[project.id] === true;
    const prior = state[project.id]?.url === project.url ? state[project.id] : {};
    const failedSince = healthy ? null : prior.failedSince ?? new Date(now).toISOString();
    const everHealthy = healthy || prior.everHealthy === true || (Boolean(old) && old.status !== 'preview');
    nextState[project.id] = {url:project.url,everHealthy,failedSince};
    const {showPending, ...world} = project;
    if (healthy) worlds.push({...world,status: world.status === 'sleeping' ? 'sleeping' : 'live'});
    else if (old && now - Date.parse(failedSince) < GRACE_MS) worlds.push(old);
    else if (showPending && !everHealthy) worlds.push({...world,status:'preview'});
  }
  if (worlds.length > MAX_WORLDS) throw new Error('Removal grace exceeds world capacity; retaining previous catalog');
  return {worlds,state:nextState};
}

async function probe(url) {
  try {
    const response = await fetch(url, {redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'Galaxy-public-world-discovery/1.0'}});
    await response.body?.cancel();
    return response.ok;
  } catch { return false; }
}

async function saveChanged(path, value) {
  const text = JSON.stringify(value,null,2)+'\n';
  if (await readFile(path,'utf8').catch(() => '') === text) return false;
  await writeFile(path+'.tmp',text);
  await rename(path+'.tmp',path);
  return true;
}

export async function refresh() {
  const registry = JSON.parse(await readFile('data/world-registry.json','utf8'));
  const previous = JSON.parse(await readFile('data/worlds.generated.json','utf8'));
  const state = JSON.parse(await readFile('data/world-discovery-state.json','utf8').catch(() => '{}'));
  const response = await fetch(source,{signal:AbortSignal.timeout(15000),redirect:'error'});
  if (!response.ok) throw new Error(`Discovery source failed: ${response.status}`);
  const topology = await response.json();
  const projects = candidates(registry,topology);
  const health = {};
  // Four bounded requests at a time; no browser-time network discovery.
  for (let start=0;start<projects.length;start+=4) {
    await Promise.all(projects.slice(start,start+4).map(async p => { health[p.id] = await probe(p.url); }));
  }
  const result = reconcile(projects,previous,state,health,Date.now(),registry.deniedIds);
  await saveChanged('data/worlds.generated.json',result.worlds);
  await saveChanged('data/world-discovery-state.json',result.state);
  console.log(JSON.stringify({source,worlds:result.worlds.map(w=>({id:w.id,status:w.status})),unhealthy:projects.filter(p=>!health[p.id]).map(p=>p.id)}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await refresh();
