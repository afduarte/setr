// utils.ts builds an Auth0 client and axios instance at import time; stub the
// Auth0 module so importing the module under test doesn't need real config.
import { vi } from 'vitest';

vi.mock('@auth0/auth0-vue', () => ({
  createAuth0: () => ({ getAccessTokenSilently: async () => 'test-token' }),
  useAuth0: () => ({}),
}));

import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatKey,
  getCamelot,
  getCamelotColour,
  getPitchDrift,
  getNewKey,
  getRelativeMajor,
  harmonicDistance,
  circleOfFifths,
  truncate,
} from '@/utils';
import { track, feature } from './fixtures';

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59000)).toBe('0:59');
    expect(formatDuration(91000)).toBe('1:31');
  });
  it('shows hours when present (minutes not zero-padded in the hour position — quirk)', () => {
    expect(formatDuration(4500000)).toBe('1:15:00');
    expect(formatDuration(3600000)).toBe('1:0:00');
  });
});

describe('formatKey', () => {
  it('renders flats, not sharps', () => {
    expect(formatKey(0, 1)).toBe('C');
    expect(formatKey(1, 1)).toBe('D♭');
    expect(formatKey(9, 0)).toBe('Am');
    expect(formatKey(11, 1)).toBe('B');
  });
  it('returns N/A for out of range or missing keys', () => {
    expect(formatKey(-1, 1)).toBe('N/A');
    expect(formatKey(12, 1)).toBe('N/A');
    expect(formatKey(undefined as any, 0)).toBe('N/A');
    expect(formatKey(null as any, 0)).toBe('N/A');
  });
});

describe('getCamelot', () => {
  it('maps major keys to the B wheel', () => {
    expect(getCamelot(0, 1)).toBe('8B'); // C = 8B
    expect(getCamelot(7, 1)).toBe('9B'); // G = 9B
    expect(getCamelot(4, 1)).toBe('12B'); // E = 12B
  });
  it('shares the number with the parallel major for minor keys (A wheel)', () => {
    expect(getCamelot(9, 0)).toBe('8A'); // Am = 8A
    expect(getCamelot(0, 0)).toBe('5A'); // Cm = 5A
  });
  it('returns null outside the wheel', () => {
    expect(getCamelot(-1, 1)).toBeNull();
    expect(getCamelot(12, 1)).toBeNull();
  });
});

describe('getCamelotColour', () => {
  it('minor keys use the colour of their parallel major', () => {
    expect(getCamelotColour(0, 1)).toBe('#ee82d9'); // C
    expect(getCamelotColour(9, 0)).toBe('#ee82d9'); // Am shares C's colour
  });
  it('returns null outside range', () => {
    expect(getCamelotColour(-1, 1)).toBeNull();
  });
});

describe('getPitchDrift', () => {
  it('is zero for no speed change', () => {
    expect(getPitchDrift(0)).toBeCloseTo(0, 10);
  });
  it('scales logarithmically: doubling speed = +12 semitones, half speed = -12', () => {
    expect(getPitchDrift(100)).toBeCloseTo(12, 6);
    expect(getPitchDrift(-50)).toBeCloseTo(-12, 6);
  });
  it('+50% is not half an octave', () => {
    expect(getPitchDrift(50)).toBeCloseTo(Math.log2(1.5) * 12, 6);
  });
});

describe('getNewKey', () => {
  it('wraps into 0-11 for both drift directions', () => {
    expect(getNewKey(0, 100)).toBe(0); // +12 semitones wraps to the same key
    expect(getNewKey(0, -100)).toBeNaN(); // -100% = stop: log2(0) = -Infinity → NaN (documented quirk)
    expect(getNewKey(0, 50)).toBe(7); // +50% ≈ +7 semitones (C -> G)
    expect(getNewKey(9, -50)).toBe(9); // half speed = -12 semitones wraps to the same key
    expect(getNewKey(5, 100)).toBe(5); // F up an octave is still F
  });
});

describe('getRelativeMajor', () => {
  it('is a no-op for major keys', () => {
    expect(getRelativeMajor(0, 1)).toBe(0);
    expect(getRelativeMajor(7, 1)).toBe(7);
  });
  it('shifts a minor key 3 semitones up', () => {
    expect(getRelativeMajor(9, 0)).toBe(0); // Am -> C
    expect(getRelativeMajor(2, 0)).toBe(5); // Dm -> F
    expect(getRelativeMajor(10, 0)).toBe(1); // B♭m -> D♭ (wraps)
  });
});

describe('harmonicDistance', () => {
  const t = (key: number | undefined, mode: number | undefined) => track('x' + key, { features: feature({ key, mode }) });

  it('is 0 for identical keys', () => {
    expect(harmonicDistance(t(0, 1), t(0, 1))).toBe(0);
  });

  it('uses circle-of-fifths circular distance on relative majors', () => {
    expect(harmonicDistance(t(0, 1), t(7, 1))).toBe(1); // C -> G adjacent
    expect(harmonicDistance(t(9, 0), t(0, 1))).toBe(0); // Am vs C (same relative major)
    expect(harmonicDistance(t(0, 1), t(6, 1))).toBe(6); // C vs F#: max distance
  });

  it('measures across, not through, the circle', () => {
    // C and A# are 2 and 10 → circular distance 2
    expect(harmonicDistance(t(0, 1), t(10, 1))).toBe(2);
  });

  it('returns MAX_SAFE_INTEGER when either side has no key (unanalysed)', () => {
    const noKey = track('nk', { features: feature({ tempo: 100 }) });
    expect(harmonicDistance(t(0, 1), noKey)).toBe(Number.MAX_SAFE_INTEGER);
    expect(harmonicDistance(noKey, t(0, 1))).toBe(Number.MAX_SAFE_INTEGER);
    expect(harmonicDistance(noKey, noKey)).toBe(Number.MAX_SAFE_INTEGER);
    expect(harmonicDistance(undefined as any, t(0, 1))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('defaults a missing mode to minor', () => {
    // Am without explicit mode vs C major: same relative major
    expect(harmonicDistance(t(9, undefined), t(0, 1))).toBe(0);
  });
});

describe('circleOfFifths', () => {
  it('is a permutation of pitch classes', () => {
    expect([...circleOfFifths].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe('truncate', () => {
  it('keeps short strings intact', () => {
    expect(truncate('short', 10)).toBe('short');
  });
  it('cuts long strings and appends the ellipsis', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcde...');
    expect(truncate('abcdefghij', 4, '…')).toBe('abcd…');
  });
});
