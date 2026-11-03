import { describe, it, expect } from 'vitest';
import {
  generateSetId,
  generateSetName,
  createSilenceStream,
  combineStreams,
} from '../util/helpers.js';
import { once } from 'events';
import { Readable } from 'stream';

describe('generateSetId', () => {
  it('returns 8 lowercase hex characters', () => {
    const id = generateSetId();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is unique across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, generateSetId));
    expect(ids.size).toBe(50);
  });
});

describe('generateSetName', () => {
  it('date mode returns a "d mmm" formatted date', () => {
    const name = generateSetName(true);
    // e.g. "3 Nov" — day without leading zero, short month
    expect(name).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/);
  });

  it('otherwise returns "<adjective> <noun>" from the curated lists', () => {
    const name = generateSetName(false);
    const [adj, noun] = name.split(' ');
    expect(adj).toBeTruthy();
    expect(noun).toBeTruthy();
    // q check: not a date
    expect(name).not.toMatch(/\d/);
  });
});

describe('createSilenceStream', () => {
  it('ends (pushes null) after the requested number of seconds', async () => {
    const stream = createSilenceStream(0.05);
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    await once(stream, 'end');
    expect(chunks).toEqual([]); // silence: no data, just termination
  });
});

describe('combineStreams', () => {
  it('concatenates sources in order', async () => {
    const a = Readable.from(Buffer.from('abc'));
    const b = Readable.from(Buffer.from('def'));
    const combined = combineStreams([a, b]);
    const out = [];
    combined.on('data', (c) => out.push(c));
    await once(combined, 'end');
    expect(Buffer.concat(out).toString()).toBe('abcdef');
  });

  it('destroys the stream with the error when a source fails', async () => {
    const good = Readable.from(Buffer.from('x'));
    const bad = new Readable({
      read() {
        this.destroy(new Error('boom'));
      },
    });
    const combined = combineStreams([good, bad]);
    const [err] = await once(combined, 'error');
    expect(err.message).toBe('boom');
  });
});
