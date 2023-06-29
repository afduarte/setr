import path from 'path';
import { readFile, writeFile, access, mkdir } from 'fs/promises'
import { constants } from 'fs';
import { compress, decompress } from 'compress-json';
import Logger from './logger.js';
import * as url from 'url';
// Simple cache implementation uses disk for storage.
// STORAGE_LOCATION is the place where the data will be stored
const __dirname = url.fileURLToPath(new URL('..', import.meta.url));
const STORAGE_LOCATION = process.env.STORAGE || path.join(__dirname, "data", "albums")
// make sure the location exists and is writable
async function init(){
  // check if directory exists
  try{
    await access(STORAGE_LOCATION, constants.F_OK)
    Logger.debug(`Storage location exists: ${STORAGE_LOCATION}`)
  }catch(e){
    // create it if it doesn't
    await mkdir(STORAGE_LOCATION)
    Logger.debug(`Created storage location: ${STORAGE_LOCATION}`)
  }
  // check if directory is writable
  try{
    await access(STORAGE_LOCATION, constants.W_OK)
    Logger.debug(`Storage location is writable: ${STORAGE_LOCATION}`)
  }catch(e){
    Logger.error(`Data directory ${STORAGE_LOCATION} is not writable`)
    process.exit()
  }
  Logger.debug(`Storage location initialised: ${STORAGE_LOCATION}`)
}
await init();
// isCached() simply checks if the file exists on disk
// We create a function in case we ever want to get fancier with the caching
async function isCached(id) {
  try {
    await access(path.join(STORAGE_LOCATION, id), constants.F_OK);
    Logger.debug(`Cache hit: ${id}`)
    return true; // File exists
  } catch (err) {
    Logger.debug(`Cache miss: ${id}`)
    return false; // File does not exist
  }
}

export async function getFromCache(id) {
  if(!await isCached(id)) return null;
  try {
    const fileData = await readFile(path.join(STORAGE_LOCATION, id), 'utf-8');
    const decompressed = decompress(JSON.parse(fileData))
    return decompressed;
  } catch (err) {
    console.log(err)
    throw new Error(`Failed to read file: ${id}`);
  }
}

export async function storeInCache(id, data) {
  if(await isCached(id)) return null;
  try {
    const compressed = compress(data);
    await writeFile(path.join(STORAGE_LOCATION, id), JSON.stringify(compressed));
    Logger.debug(`"Stored id: ${id}`)
  } catch (err) {
    console.log(err)
    throw new Error(`Failed to store data in file: ${id}`);
  }
}

export default { getFromCache, storeInCache };