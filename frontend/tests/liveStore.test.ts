import { vi } from 'vitest';

vi.mock('@auth0/auth0-vue', () => ({
  createAuth0: () => ({ getAccessTokenSilently: async () => 'test-token' }),
  useAuth0: () => ({}),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useLiveStore, rank } from '@/stores/liveStore';
import { useStore } from '@/stores/store';
import { track, feature, enhanced } from './fixtures';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('rank (pure function)', () => {
  it('returns MAX_SAFE_INTEGER when either track has no analysis', () => {
    const a = track('a', { features: feature() });
    const b = track('b'); // no audioFeatures
    expect(rank(a, b, [])).toBe(Number.MAX_SAFE_INTEGER);
    expect(rank(b, a, [])).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('is 0 for identical tracks (same bpm/key/mood) not yet played', () => {
    const a = track('a', { features: feature({ key: 0, mode: 1 }) });
    const b = track('b', { features: feature({ key: 0, mode: 1 }) });
    expect(rank(a, b, [])).toBe(0);
  });

  it('weights bpm differences (0.5 per semitone... per BPM unit)', () => {
    const a = track('a', { features: feature({ tempo: 100, key: 0, mode: 1 }) });
    const b = track('b', { features: feature({ tempo: 110, key: 0, mode: 1 }) });
    expect(rank(a, b, [])).toBeCloseTo(5, 6); // 0.5 * 10
  });

  it('adds the played penalty of exactly 10 for already-played tracks', () => {
    const a = track('a', { features: feature({ key: 0, mode: 1 }) });
    const b = track('b', { features: feature({ key: 0, mode: 1 }) });
    expect(rank(a, b, [])).toBe(0);
    expect(rank(a, b, [enhanced(b)])).toBe(10);
  });

  it('penalises harmonic distance weighted by 0.3/circle step', () => {
    const a = track('a', { features: feature({ key: 0, mode: 1 }) }); // C
    const b = track('b', { features: feature({ key: 6, mode: 1 }) }); // F#: distance 6
    expect(rank(a, b, [])).toBeCloseTo(0.3 * 6, 6);
  });

  it('combines mood differences', () => {
    const a = track('a', { features: feature({ key: 0, mode: 1, danceability: 1, energy: 1, valence: 1 }) });
    const b = track('b', { features: feature({ key: 0, mode: 1, danceability: 0, energy: 0, valence: 0 }) });
    // 0.1 * (1 + 1 + 1)
    expect(rank(a, b, [])).toBeCloseTo(0.3, 6);
  });
});

describe('suggestions getter', () => {
  it('ranks other tracks against the current track via rank()', () => {
    const live = useLiveStore();
    const main = useStore();
    main.albums = {
      al: {
        ...track('x').album as any,
        id: 'al',
        tracks: [],
      },
    } as any;
    main.albums = {
      al: {
        id: 'al',
        name: 'al',
        album_type: 'album' as const,
        artists: [],
        release_date: '',
        images: [],
        total_tracks: 3,
        type: 'album',
        uri: '',
        tags: [],
        tracks: [
          track('current', { features: feature({ tempo: 128, key: 0, mode: 1 }) }),
          track('close', { features: feature({ tempo: 128, key: 0, mode: 1 }) }),
          track('far', { features: feature({ tempo: 200, key: 6, mode: 1 }) }),
        ],
      },
    } as any;
    live.current = enhanced(track('current', { features: feature({ tempo: 128, key: 0, mode: 1 }) }));

    const suggestions = live.suggestions;
    expect(suggestions.map((s) => s.id)).toEqual(['close', 'far']);
    expect(suggestions[0]).toMatchObject({ adjustment: 0, note: '' });
  });

  it('excludes the current track itself and returns [] without a current track', () => {
    const live = useLiveStore();
    expect(live.suggestions).toEqual([]);
  });
});
