import { PassThrough, Readable } from 'stream';

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