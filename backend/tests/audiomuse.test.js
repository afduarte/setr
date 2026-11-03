import { describe, it, expect } from 'vitest';
import { toAudioFeatures } from '../util/audiomuse.js';

describe('toAudioFeatures', () => {
  it('maps note to pitch class and scale to mode', () => {
    const f = toAudioFeatures({ key: 'C', scale: 'major', tempo: 128 });
    expect(f.key).toBe(0);
    expect(f.mode).toBe(1);
    expect(f.tempo).toBe(128);
  });

  it('maps minor scales to mode 0', () => {
    const f = toAudioFeatures({ key: 'A', scale: 'minor', tempo: 100 });
    expect(f.key).toBe(9);
    expect(f.mode).toBe(0);
  });

  it('handles sharps and case variants', () => {
    expect(toAudioFeatures({ key: 'C#', scale: 'maj', tempo: 1 }).key).toBe(1);
    expect(toAudioFeatures({ key: 'Bb', scale: 'minor', tempo: 1 }).key).toBe(10);
    expect(toAudioFeatures({ key: 'eb', scale: 'min', tempo: 1 }).key).toBe(3);
    expect(toAudioFeatures({ key: 'g#', scale: 'maj', tempo: 1 }).key).toBe(8);
  });

  it('also accepts flats and unicode flat signs', () => {
    expect(toAudioFeatures({ key: 'Db', scale: 'major', tempo: 1 }).key).toBe(1);
    expect(toAudioFeatures({ key: 'D♭', scale: 'major', tempo: 1 }).key).toBe(1);
    expect(toAudioFeatures({ key: 'E♭', scale: 'major', tempo: 1 }).key).toBe(3);
  });

  it('never sets key without mode (and vice versa) so the frontend cannot crash on a half-key', () => {
    // Unparseable note -> no key/mode at all
    const bad = toAudioFeatures({ key: 'H', scale: 'major', tempo: 120 });
    expect('key' in bad).toBe(false);
    expect('mode' in bad).toBe(false);

    // Unparseable scale still yields mode (defaults to minor) together with key
    const oddScale = toAudioFeatures({ key: 'F', scale: 'whatever', tempo: 120 });
    expect(oddScale.key).toBe(5);
    expect(oddScale.mode).toBe(0);
  });

  it('returns undefined for a null/missing entry', () => {
    expect(toAudioFeatures(null)).toBeUndefined();
    expect(toAudioFeatures(undefined)).toBeUndefined();
  });

  it('uses the Jellyfin duration when provided, else the entry duration', () => {
    const withDuration = toAudioFeatures({ key: 'C', scale: 'major', tempo: 1, duration: 5000 }, 42000);
    expect(withDuration.duration_ms).toBe(42000);

    const fallback = toAudioFeatures({ key: 'C', scale: 'major', tempo: 1, duration: 5000 });
    expect(fallback.duration_ms).toBe(5000);

    const neither = toAudioFeatures({ key: 'C', scale: 'major', tempo: 1 });
    expect(neither.duration_ms).toBe(0);
  });

  it('only includes optional fields when they are finite', () => {
    const f = toAudioFeatures({ key: 'C', scale: 'major', tempo: 1, energy: 0.5, other_features: 'danceable:0.8,happy:0.3' });
    expect(f.energy).toBe(0.5);
    expect(f.danceability).toBe(0.8);
    expect(f.valence).toBe(0.3);

    const empty = toAudioFeatures({ key: 'C', scale: 'major', tempo: 1 });
    expect('energy' in empty).toBe(false);
    expect('danceability' in empty).toBe(false);
    expect('valence' in empty).toBe(false);
  });

  it('coerces non-numeric tempo to 0', () => {
    expect(toAudioFeatures({ key: 'C', scale: 'major', tempo: 'fast' }).tempo).toBe(0);
  });

  it('keeps non-numeric mood values as strings and lowercases keys', () => {
    const f = toAudioFeatures({ key: 'C', scale: 'major', tempo: 1, other_features: 'Genre:Rock' });
    // Genre is not mapped to a feature, but parsing must not throw
    expect(f.danceability).toBeUndefined();
  });
});
