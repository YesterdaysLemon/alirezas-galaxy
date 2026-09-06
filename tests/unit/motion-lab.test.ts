import { describe, expect, it } from 'vitest';
import {
  describeMotionPicks,
  confirmedMotionPicks,
  motionFamilies,
  motionProposals,
  validMotionPicks,
} from '../../data/motion-lab';

describe('motion lab proposals', () => {
  it('offers three distinct proposals for each of eight component families', () => {
    expect(motionProposals).toHaveLength(24);
    expect(new Set(motionProposals.map(({ id }) => id)).size).toBe(24);
    for (const family of motionFamilies) {
      expect(
        motionProposals.filter(({ family: id }) => id === family.id),
      ).toHaveLength(3);
    }
  });
  it('preserves the user-selected direction separately from new arrival choices', () => {
    expect(confirmedMotionPicks).toEqual([
      'E2',
      'W2',
      'M1',
      'M3',
      'R3',
      'C1',
      'F1',
      'B3',
    ]);
    expect(validMotionPicks(confirmedMotionPicks)).toEqual(
      confirmedMotionPicks,
    );
  });
  it('accepts only known, unique picks from browser preferences', () => {
    expect(validMotionPicks(['W1', 'W1', 'F3', 'unknown', null, 3])).toEqual([
      'W1',
      'F3',
    ]);
    expect(validMotionPicks({ W1: true })).toEqual([]);
  });
  it('copies unambiguous IDs and names in lab order', () => {
    expect(describeMotionPicks(['F3', 'W1'])).toBe(
      'W1 — Soft lift\nF3 — Console wake',
    );
    expect(describeMotionPicks([])).toBe('');
  });
});
