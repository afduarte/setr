import type { TrackData, AudioFeature, EnhancedTrack } from '@/stores/store';

export function feature(partial: Partial<AudioFeature> = {}): AudioFeature {
  return {
    tempo: 128,
    duration_ms: 200000,
    ...partial,
  };
}

export function track(id: string, opts: Partial<TrackData> & { features?: AudioFeature } = {}): TrackData {
  const { features, ...rest } = opts;
  return {
    id,
    name: `Track ${id}`,
    artists: [{ id: 'a1', name: 'Artist', href: '', external_urls: {}, type: 'artist', uri: '' }],
    album: 'Album',
    disc_number: 1,
    duration_ms: features?.duration_ms ?? 200000,
    explicit: false,
    external_urls: {},
    href: '',
    is_local: false,
    preview_url: '',
    track_number: 1,
    type: 'track',
    uri: `jellyfin:track:${id}`,
    audioFeatures: features,
    ...rest,
  } as TrackData;
}

export function enhanced(t: TrackData, adjustment = 0, note = ''): EnhancedTrack {
  return { ...t, adjustment, note };
}
