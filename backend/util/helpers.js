import { PassThrough, Readable } from 'stream';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';


export function combineStreams(streams) {
  const stream = new PassThrough()
  _combineStreams(streams, stream).catch((err) => stream.destroy(err))
  return stream
}

async function _combineStreams(sources, destination) {
  for (const stream of sources) {
    console.log(stream)
    await new Promise((resolve, reject) => {
      stream.pipe(destination, { end: false })
      stream.on('end', resolve)
      stream.on('error', reject)
    })
  }
  destination.emit('end')
}

// export function createSilenceStream(seconds, sampleRate = 44100, channels = 2){
//   const samples = sampleRate * channels * seconds;
//   return Readable.from(Buffer.alloc(samples * 2));
// }

export function createSilenceStream(seconds){
  return new Readable({
    read() {
      setTimeout(() => {
        this.push(null);
      }, seconds * 1000);
    },
  });
}

export function generateSetId() {
  // Generate a UUID
  const uuid = uuidv4();

  // Calculate SHA-256 hash
  const sha256Hash = crypto.createHash('sha256').update(uuid, 'utf8').digest('hex');

  // Extract the first 8 characters
  const result = sha256Hash.substring(0, 8);

  return result;
}

const adjectives = ['Ambient', 'Astral', 'Captivating', 'Celestial', 'Cosmic', 'Electric', 'Enchanted', 'Enigmatic', 'Enveloping', 'Ethereal', 'Euphoric', 'Harmonic', 'Harmonious', 'Hypersonic', 'Hypnotic', 'Illuminated', 'Infinite', 'Luminous', 'Lush', 'Melodic', 'Mesmeric', 'Mystical', 'Radiant', 'Seraphic', 'Serene', 'Sonic', 'Sublime', 'Timeless', 'Tranquil', 'Transcendent', 'Vibrant', 'Vibrational']
const nouns = ['Adventure', 'Alchemy', 'Ambiance', 'Beats', 'Bliss', 'Cadence', 'Dreamscape', 'Echo', 'Echoes', 'Enchantment', 'Exploration', 'Frequencies', 'Fusion', 'Groove', 'Harmonies', 'Harmony', 'Illumination', 'Journey', 'Melodies', 'Mirage', 'Nocturne', 'Odyssey', 'Radiance', 'Reflections', 'Resonance', 'Reverberations', 'Reverie', 'Rhythms', 'Serenade', 'Serenity', 'Sonic', 'Soundscapes', 'Soundwaves', 'Transcendence', 'Voyage', 'Waves', 'Whispers']

export function generateSetName(dateName) {
  if(dateName){
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  const adj = adjectives[Math.floor(Math.random()*adjectives.length)];
  const noun = nouns[Math.floor(Math.random()*nouns.length)];
  return `${adj} ${noun}`
}