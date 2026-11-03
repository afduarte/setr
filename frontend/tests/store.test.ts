import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@auth0/auth0-vue', () => ({
  createAuth0: () => ({ getAccessTokenSilently: async () => 'test-token' }),
  useAuth0: () => ({}),
}));

import { createPinia, setActivePinia } from 'pinia';
import {
  useStore,
  getSortingString,
  getFormattedTrackName,
  type EnhancedAlbum,
  type Set,
  type UserData,
} from '@/stores/store';
import { api } from '@/utils';
import { track, feature } from './fixtures';

const album = (id: string, trackIds: string[], tags: string[] = []): EnhancedAlbum =>
  ({
    id,
    name: `Album ${id}`,
    artists: [{ id: 'a1', name: 'Artist', href: '', external_urls: {}, type: 'artist', uri: '' }],
    album_type: 'album',
    available_markets: [],
    external_urls: {},
    href: '',
    release_date: '2020',
    release_date_precision: 'year',
    popularity: 0,
    type: 'album',
    uri: `jellyfin:album:${id}`,
    images: [],
    total_tracks: trackIds.length,
    tracks: trackIds.map((t) => track(t)),
    tags,
  }) as EnhancedAlbum;

const blankUser: UserData = { sets: [], collection: [] };

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe('getSortingString', () => {
  it('sorts by artist (stripped of "The"/"Various Artists"), year, title', () => {
    expect(getSortingString({
      name: 'Abbey Road',
      artists: [{ id: 'x', name: 'The Beatles', href: '', external_urls: {}, type: 'artist', uri: '' }],
      release_date: '1969-01-01',
    } as any)).toBe('Beatles1969Abbey Road');
  });

  it('strips "Various Artists": an empty artist falls back to the title', () => {
    expect(getSortingString({
      name: '99 Music',
      artists: [{ id: 'x', name: 'Various Artists', href: '', external_urls: {}, type: 'artist', uri: '' }],
      release_date: '2020',
    } as any)).toBe('#9 Music2020#9 Music'); // artist empty → title twice; leading digit → '#'
  });

  it('falls back to the name alone when artists are missing entirely', () => {
    // The `if (!a.artists)` branch returns just the mangled name (no year/title suffix)
    expect(getSortingString({ name: 'Solo', release_date: '' } as any)).toBe('Solo');
  });
});

describe('getFormattedTrackName', () => {
  it('joins artist names and the title', () => {
    const t = track('t1', { name: 'Song Name', artists: [{ name: 'A' }, { name: 'B' }] as any });
    expect(getFormattedTrackName(t)).toBe('A,B - Song Name');
  });
});

describe('getters', () => {
  it('allTracks indexes every track across all albums', () => {
    const store = useStore();
    store.albums = { al1: album('al1', ['t1', 't2']), al2: album('al2', ['t3']) } as any;
    const all = store.allTracks;
    expect(Object.keys(all).sort()).toEqual(['t1', 't2', 't3']);
  });

  it('getAlbumIdForTrack resolves the album id for a track', () => {
    const store = useStore();
    store.albums = { al1: album('al1', ['t1']) } as any;
    store.trackToAlbum = { t1: 'al1' };
    expect(store.getAlbumIdForTrack('t1')).toBe('al1');
    expect(store.getAlbumIdForTrack('nope')).toBeUndefined();
  });
});

describe('processHydratedCollection', () => {
  it('builds the album index, track→album index and tag set in one pass', () => {
    const store = useStore();
    store.userData = {
      sets: [],
      collection: [album('c1', ['t1', 't2'], ['funk']), album('c2', [], ['soul', 'funk'])],
    };
    store.processHydratedCollection();
    expect(Object.keys(store.albums)).toEqual(['c1', 'c2']);
    expect(store.trackToAlbum).toEqual({ t1: 'c1', t2: 'c1' });
    expect([...store.albumTags].sort()).toEqual(['funk', 'soul']);
  });

  it('is a no-op without a collection', () => {
    const store = useStore();
    store.processHydratedCollection();
    expect(store.albums).toEqual({});
  });
});

describe('loadSet', () => {
  it('hydrates a persisted set from the album index and applies note/adjustment', () => {
    const store = useStore();
    store.albums = { al1: album('al1', ['t1', 't2']) } as any;
    store.trackToAlbum = { t1: 'al1', t2: 'al1' };
    const meta: Set = { id: 's1', name: 'A set', created: 1, tracks: [{ id: 't2', adjustment: 5, note: 'bring it up' }, { id: 'unknown', adjustment: 0, note: '' }] };
    store.loadSet(meta);
    expect(store.set.id).toBe('s1');
    expect(store.set.tracks).toHaveLength(1); // unknown id dropped
    expect(store.set.tracks[0]).toMatchObject({ id: 't2', adjustment: 5, note: 'bring it up' });
  });
});

describe('addTrack / removeTrack / updateMetaSet', () => {
  beforeEach(() => {
    // addTrack/removeTrack call updateMetaSet → saveUserData internally
    vi.spyOn(api, 'post').mockResolvedValue({ data: blankUser } as any);
    vi.spyOn(api, 'get').mockResolvedValue({ data: blankUser } as any);
  });

  it('addTrack makes the track enhanced (note "", adjustment 0)', async () => {
    const store = useStore();
    store.userData = { sets: [], collection: [] }; // no saved set → no persist
    store.set = { id: 's1', name: 'X', created: 1, tracks: [] };
    await store.addTrack(track('t1'));
    expect(store.set.tracks[0]).toMatchObject({ id: 't1', note: '', adjustment: 0 });
  });

  it('removeTrack splices by click index', async () => {
    const store = useStore();
    store.userData = { sets: [], collection: [] };
    store.set = { id: 's1', name: 'X', created: 1, tracks: [track('t1'), track('t2')].map((t) => ({ ...t, note: '', adjustment: 0 })) } as any;
    await store.removeTrack({ track: store.set.tracks[0] as any, index: 0 });
    expect(store.set.tracks.map((t) => (t as any).id)).toEqual(['t2']);
  });

  it('updateMetaSet syncs TrackMeta into userData.sets and persists (saveUserData)', async () => {
    const store = useStore();
    store.userData = { sets: [{ id: 's1', name: 'X', created: 1, tracks: [] }], collection: [] };
    store.set = { id: 's1', name: 'X', created: 1, tracks: [{ ...track('t1'), note: 'n', adjustment: 3 }] as any };

    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: blankUser });
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: store.userData });
    await store.updateMetaSet();

    expect(post).toHaveBeenCalledWith('/user', {
      sets: store.userData.sets,
      collection: [], // dehydrated to {id, tags}
    });
    expect(get).toHaveBeenCalledWith('/user', { params: { c: true } });
    expect(store.userData.sets[0].tracks).toEqual([{ id: 't1', note: 'n', adjustment: 3 }]);
  });

  it('updateMetaSet does nothing for an unsaved set (no matching set id)', async () => {
    const store = useStore();
    store.userData = { sets: [], collection: [] };
    store.set = { id: 'unsaved', name: 'X', created: 1, tracks: [] };
    const post = vi.spyOn(api, 'post');
    await store.updateMetaSet();
    expect(post).not.toHaveBeenCalled();
  });
});

describe('API-backed actions', () => {
  it('getUserData(hydrate) requests hydrated user data and indexes it', async () => {
    const store = useStore();
    const data: UserData = { sets: [], collection: [album('c1', ['t1'], ['tag'])] };
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data });
    await store.getUserData();
    expect(get).toHaveBeenCalledWith('/user', { params: { c: true } });
    expect(Object.keys(store.albums)).toEqual(['c1']);
  });

  it('getUserData(false) keeps the collection dehydrated', async () => {
    const store = useStore();
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: blankUser });
    await store.getUserData(false);
    expect(get).toHaveBeenCalledWith('/user', { params: {} });
    expect(store.albums).toEqual({});
  });

  it('saveUserData posts a dehydrated collection ({id, tags} only)', async () => {
    const store = useStore();
    store.userData = { sets: [], collection: [album('c1', ['t1'], ['tag'])] };
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: blankUser });
    vi.spyOn(api, 'get').mockResolvedValue({ data: blankUser });
    await store.saveUserData();
    expect(post).toHaveBeenCalledWith('/user', { sets: [], collection: [{ id: 'c1', tags: ['tag'] }] });
  });

  it('search stores the results in searchResults', async () => {
    const store = useStore();
    vi.spyOn(api, 'get').mockResolvedValue({ data: [album('s1', [] as string[])] });
    await store.search('daft');
    expect(store.searchResults).toHaveLength(1);
  });

  it('clearSearch empties searchResults', () => {
    const store = useStore();
    store.searchResults = [album('s1', [])];
    store.clearSearch();
    expect(store.searchResults).toEqual([]);
  });

  it('addAlbum indexes the album and its tracks', async () => {
    const store = useStore();
    const data = album('new1', ['t9']);
    delete (data as any).tags;
    vi.spyOn(api, 'get').mockResolvedValue({ data });
    await store.addAlbum('new1');
    expect(store.albums['new1'].tags).toEqual([]);
    expect(store.trackToAlbum['t9']).toBe('new1');
  });

  it('getAllAlbums applies empty tags for the import screen', async () => {
    const store = useStore();
    vi.spyOn(api, 'get').mockResolvedValue({ data: [album('a1', [])] });
    await store.getAllAlbums();
    expect(store.allAlbums[0].tags).toEqual([]);
  });

  it('importAlbums posts the ids and does a dehydrated refresh', async () => {
    const store = useStore();
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: blankUser });
    await store.importAlbums(['x', 'y']);
    expect(post).toHaveBeenCalledWith('/user/collection/add', { ids: ['x', 'y'] });
    expect(get).toHaveBeenCalledWith('/user', { params: {} });
  });

  it('removeFromCollection drops the album and its tracks from the indexes', async () => {
    const store = useStore();
    store.userData = { sets: [], collection: [album('c9', ['t1'])] };
    store.albums = { c9: album('c9', ['t1']) } as any;
    store.trackToAlbum = { t1: 'c9' };
    vi.spyOn(api, 'put').mockResolvedValue({ data: { sets: [], collection: [] } });
    await store.removeFromCollection('c9');
    expect(store.albums).toEqual({});
    expect(store.trackToAlbum).toEqual({});
  });

  it('addSet replaces userData with the server response', async () => {
    const store = useStore();
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { sets: [{ id: 'new', name: 'N', created: 1, tracks: [] }], collection: [] },
    });
    await store.addSet();
    expect(post).toHaveBeenCalledWith('/user/set/new'); // the old '?c=treu' typo is gone
    expect(store.userData.sets[0].id).toBe('new');
  });
});

describe('track tagging flow', () => {
  it('audioFeatures survive display through allTracks', () => {
    const store = useStore();
    const withFeat = album('c1', []);
    (withFeat.tracks as any) = [
      { ...track('t1', { features: feature({ key: 0, mode: 1 }) }) },
    ];
    store.albums = { c1: withFeat } as any;
    expect(store.allTracks['t1'].audioFeatures.key).toBe(0);
  });
});
