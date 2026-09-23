import { describe, expect, it } from 'vitest';
import {
  candidates,
  reconcile,
  publicUrl,
  GRACE_MS,
} from '../../scripts/refresh-worlds.mjs';

const world = {
  id: 'example',
  name: 'Example',
  url: 'https://example.alirezaafshan.com',
  status: 'live',
  description: 'Public app',
  systemId: 'patterns-and-life',
  orbitSlot: 0,
};
const registry = { version: 1, deniedIds: [], projects: [world] };
const day = Date.parse('2026-09-08T00:00:00Z');

describe('daily public world discovery', () => {
  it('only discovers explicitly public app URLs and preserves registry authority', () => {
    expect(
      candidates(registry, {
        apps: [
          { ...world, name: 'Remote name', systemId: 'frontier', orbitSlot: 9 },
          { id: 'private', url: null },
        ],
        city: {
          routes: [{ id: 'secret', url: 'https://secret.alirezaafshan.com' }],
        },
      }),
    ).toEqual([world]);
    expect(
      candidates({ ...registry, deniedIds: ['example'] }, { apps: [world] }),
    ).toEqual([]);
    const remote = candidates({ ...registry, projects: [] }, { apps: [world] });
    expect(remote[0].systemId).toBeUndefined();
    expect(remote[0].orbitSlot).toBeUndefined();
  });

  it('rejects infrastructure, foreign URLs, redirects disguised as paths, and credentials', () => {
    for (const url of [
      'http://example.alirezaafshan.com',
      'https://admin.alirezaafshan.com',
      'https://mail.alirezaafshan.com',
      'https://foo-staging.alirezaafshan.com',
      'https://example.org',
      'https://user:pass@example.alirezaafshan.com',
      'https://example.alirezaafshan.com/redirect',
      'https://example.alirezaafshan.com:443/?next=internal',
    ])
      expect(publicUrl(url)).toBeNull();
    expect(() =>
      candidates(
        {
          ...registry,
          projects: [{ ...world, url: 'https://admin.alirezaafshan.com' }],
        },
        { apps: [] },
      ),
    ).toThrow();
  });

  it('fails closed on malformed sources and conflicting authored addresses, not catalog size', () => {
    expect(() => candidates(registry, {})).toThrow();
    expect(() =>
      candidates(
        {
          ...registry,
          projects: [
            world,
            { ...world, id: 'other', url: 'https://other.alirezaafshan.com' },
          ],
        },
        { apps: [] },
      ),
    ).toThrow(/address/);
    const discovered = candidates(registry, {
      apps: Array.from({ length: 37 }, (_, index) => ({
        ...world,
        id: `app-${index}`,
        url: `https://app-${index}.alirezaafshan.com`,
      })),
    });
    const healthy = Object.fromEntries(
      discovered.map((project) => [project.id, true]),
    );
    const result = reconcile(discovered, [], {}, healthy, day);
    expect(
      result.worlds
        .map((project) => project.id)
        .sort((a, b) => a.localeCompare(b)),
    ).toEqual(
      discovered
        .map((project) => project.id)
        .sort((a, b) => a.localeCompare(b)),
    );
    expect(
      new Set(
        result.worlds.map(
          (project) => `${project.systemId}/${project.orbitSlot}`,
        ),
      ).size,
    ).toBe(discovered.length);
  });

  it('keeps last-known-good during failure grace and removes after seven days', () => {
    const first = reconcile([world], [world], {}, {}, day);
    expect(first.worlds).toEqual([world]);
    expect(
      reconcile([world], first.worlds, first.state, {}, day + 1000),
    ).toEqual(first);
    expect(
      reconcile([world], first.worlds, first.state, {}, day + GRACE_MS).worlds,
    ).toEqual([]);
    expect(
      reconcile([world], [], first.state, { example: true }, day + GRACE_MS)
        .worlds,
    ).toEqual([world]);
  });

  it('graces source removal but immediately honors explicit denial', () => {
    const first = reconcile([], [world], {}, {}, day);
    expect(first.worlds).toEqual([world]);
    expect(
      reconcile([], first.worlds, first.state, {}, day + GRACE_MS).worlds,
    ).toEqual([]);
    expect(
      reconcile([], first.worlds, first.state, {}, day, ['example']).worlds,
    ).toEqual([]);
  });

  it('seeds a pending world without falsely claiming health and promotes when healthy', () => {
    const pending = { ...world, status: 'preview', showPending: true };
    const first = reconcile([pending], [], {}, {}, day);
    expect(first.worlds[0].status).toBe('preview');
    expect(
      reconcile([pending], first.worlds, first.state, {}, day + GRACE_MS)
        .worlds[0].status,
    ).toBe('preview');
    expect(
      reconcile([pending], first.worlds, first.state, { example: true }, day)
        .worlds[0].status,
    ).toBe('live');
    expect(reconcile([world], [], {}, {}, day).worlds).toEqual([]);
  });

  it('preserves Frontier slots through rename, URL changes, retirement and insertion before existing IDs', () => {
    const remote = (id: string) => ({
      id,
      name: id,
      description: 'Public',
      url: `https://${id}.alirezaafshan.com`,
      status: 'live',
    });
    const initialProjects = [remote('beta'), remote('gamma')];
    const initial = reconcile(
      initialProjects,
      [],
      {},
      { beta: true, gamma: true },
      day,
    );
    const reordered = reconcile(
      [...initialProjects].reverse(),
      [],
      {},
      { beta: true, gamma: true },
      day,
    );
    expect(reordered.state).toEqual(initial.state);
    const betaAddress = {
      systemId: initial.worlds[0].systemId,
      orbitSlot: initial.worlds[0].orbitSlot,
    };
    const failed = reconcile(
      initialProjects,
      initial.worlds,
      initial.state,
      { gamma: true },
      day + 1,
    );
    const retired = reconcile(
      [remote('gamma')],
      failed.worlds,
      failed.state,
      { gamma: true },
      day + 1 + GRACE_MS,
    );
    expect(retired.worlds.map((project) => project.id)).toEqual(['gamma']);
    const empty = reconcile([], [], retired.state, {}, day + 2 * GRACE_MS);
    expect(empty.state.beta).toMatchObject(betaAddress);
    const renamed = {
      ...remote('beta'),
      name: 'Tools and Infrastructure',
      url: 'https://changed.alirezaafshan.com',
    };
    const revived = reconcile(
      [remote('alpha'), renamed, remote('gamma')],
      [],
      empty.state,
      { alpha: true, beta: true, gamma: true },
      day + 3 * GRACE_MS,
    );
    expect(
      revived.worlds.find((project) => project.id === 'beta'),
    ).toMatchObject({ ...betaAddress, name: renamed.name, url: renamed.url });
    expect(
      revived.worlds.find((project) => project.id === 'gamma'),
    ).toMatchObject({
      systemId: initial.worlds[1].systemId,
      orbitSlot: initial.worlds[1].orbitSlot,
    });
    expect(
      revived.worlds.find((project) => project.id === 'alpha')!.orbitSlot,
    ).toBeGreaterThan(
      Math.max(...initial.worlds.map((project) => project.orbitSlot)),
    );
  });
});
