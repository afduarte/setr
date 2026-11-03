// Helpers shared by backend tests. Modules (cache.js, user.js, audiomuse.js)
// capture STORAGE at import time, so isolation is achieved by wiping the
// directory contents between test files rather than changing the path.
import fs from 'fs/promises';
import path from 'path';

export async function resetStorage() {
  const dir = process.env.STORAGE;
  const entries = await fs.readdir(dir);
  await Promise.all(
    entries.map((e) => fs.rm(path.join(dir, e), { recursive: true, force: true }))
  );
}
