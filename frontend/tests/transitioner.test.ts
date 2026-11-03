import { vi } from 'vitest';

vi.mock('@auth0/auth0-vue', () => ({
  createAuth0: () => ({ getAccessTokenSilently: async () => 'test-token' }),
  useAuth0: () => ({}),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTransitionerStore } from '@/stores/transitioner';
import { track, feature, enhanced } from './fixtures';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('transitioner store (WIP)', () => {
  it('starts empty', () => {
    const store = useTransitionerStore();
    expect(store.trackA).toBeNull();
    expect(store.trackB).toBeNull();
  });

  it('holds A and B decks separately', () => {
    const store = useTransitionerStore();
    const a = enhanced(track('a', { features: feature({ tempo: 128 }) }));
    const b = enhanced(track('b', { features: feature({ tempo: 128 }) }));
    store.setTrackA(a);
    store.setTrackB(b);
    expect(store.trackA.id).toBe('a');
    expect(store.trackB.id).toBe('b');
  });

  it('clears both decks', () => {
    const store = useTransitionerStore();
    store.setTrackA(enhanced(track('a')));
    store.setTrackB(enhanced(track('b')));
    store.clear();
    expect(store.trackA).toBeNull();
    expect(store.trackB).toBeNull();
  });
});
