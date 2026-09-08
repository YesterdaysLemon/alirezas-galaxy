import { describe, expect, it } from 'vitest';
import { candidates, reconcile, publicUrl, GRACE_MS } from '../../scripts/refresh-worlds.mjs';

const world = {id:'example',name:'Example',url:'https://example.alirezaafshan.com',status:'live',description:'Public app'};
const registry = {version:1,deniedIds:[],projects:[world]};
const day = Date.parse('2026-09-08T00:00:00Z');

describe('daily public world discovery', () => {
  it('only discovers explicitly public app URLs and preserves overrides', () => {
    expect(candidates(registry,{apps:[{...world,name:'Remote name'}, {id:'private',url:null}],city:{routes:[{id:'secret',url:'https://secret.alirezaafshan.com'}]}})).toEqual([world]);
    expect(candidates({...registry,deniedIds:['example']},{apps:[world]})).toEqual([]);
  });
  it('rejects infrastructure, foreign URLs, redirects disguised as paths, and credentials', () => {
    for (const url of ['http://example.alirezaafshan.com','https://admin.alirezaafshan.com','https://mail.alirezaafshan.com','https://foo-staging.alirezaafshan.com','https://example.org','https://user:pass@example.alirezaafshan.com','https://example.alirezaafshan.com/redirect','https://example.alirezaafshan.com:443/?next=internal']) expect(publicUrl(url)).toBeNull();
  });
  it('fails closed on malformed discovery and overflow', () => {
    expect(()=>candidates(registry,{})).toThrow();
    expect(()=>candidates(registry,{apps:Array.from({length:19},(_,i)=>({...world,id:`app-${i}`,url:`https://app-${i}.alirezaafshan.com`}))})).toThrow(/capacity/);
  });
  it('keeps last-known-good during failure grace and removes after seven days', () => {
    const first = reconcile([world],[world],{}, {},day);
    expect(first.worlds).toEqual([world]);
    expect(reconcile([world],first.worlds,first.state,{},day+1000)).toEqual(first);
    expect(reconcile([world],first.worlds,first.state,{},day+GRACE_MS).worlds).toEqual([]);
    expect(reconcile([world],[],first.state,{example:true},day+GRACE_MS).worlds).toEqual([world]);
  });
  it('graces source removal but immediately honors explicit denial', () => {
    const first=reconcile([], [world],{}, {},day);
    expect(first.worlds).toEqual([world]);
    expect(reconcile([],first.worlds,first.state,{},day+GRACE_MS).worlds).toEqual([]);
    expect(reconcile([],first.worlds,first.state,{},day,['example']).worlds).toEqual([]);
  });
  it('seeds a pending world without falsely claiming health and promotes when healthy', () => {
    const pending={...world,status:'preview',showPending:true};
    const first=reconcile([pending],[],{}, {},day);
    expect(first.worlds[0].status).toBe('preview');
    expect(reconcile([pending],first.worlds,first.state,{},day+GRACE_MS).worlds[0].status).toBe('preview');
    expect(reconcile([pending],first.worlds,first.state,{example:true},day).worlds[0].status).toBe('live');
    expect(reconcile([world],[],{}, {},day).worlds).toEqual([]);
  });
});
