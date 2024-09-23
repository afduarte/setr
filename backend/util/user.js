import * as url from 'url';
import path from 'path';
import axios from 'axios';
import { readFile, writeFile, access, mkdir } from 'fs/promises'
import { constants } from 'fs';
import Logger from './logger.js';
const AUTH_ENDPOINT = "https://setr.uk.auth0.com"
// Auth0 user fetch function
export async function getUserInfo(token) {
  const { data } = await axios.get(`${AUTH_ENDPOINT}/userinfo`, { 
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if(!data) return null;
  return data;
}

// Middleware that adds token to request
export function tokenMiddleware(req, res, next) {
  const bearerHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (bearerHeader) {
    const bearer = bearerHeader.split(' ');
    const bearerToken = bearer[1];
    req.token = bearerToken;
    next();
  } else {
    // Forbidden
    res.sendStatus(403);
  }
}

// Simple user storage implementation uses disk for storage.
// STORAGE_LOCATION is the place where the data will be stored
const __dirname = url.fileURLToPath(new URL('..', import.meta.url));
const STORAGE_LOCATION = process.env.STORAGE || path.join(__dirname, "data", "users")
// make sure the location exists and is writable
async function init(){
  // check if directory exists
  try{
    await access(STORAGE_LOCATION, constants.F_OK)
    Logger.debug(`User Storage location exists: ${STORAGE_LOCATION}`)
  }catch(e){
    // create it if it doesn't
    await mkdir(STORAGE_LOCATION)
    Logger.debug(`Created User Storage location: ${STORAGE_LOCATION}`)
  }
  // check if directory is writable
  try{
    await access(STORAGE_LOCATION, constants.W_OK)
    Logger.debug(`User Storage location is writable: ${STORAGE_LOCATION}`)
  }catch(e){
    Logger.error(`User Storage directory ${STORAGE_LOCATION} is not writable`)
    process.exit()
  }
  Logger.debug(`User Storage location initialised: ${STORAGE_LOCATION}`)
}
await init();

// createUserifNotExists() simply checks if the file exists on disk and creates it if it doesn't
// This initialises the user file for a first login
async function createUserifNotExists(sub) {
  try {
    await access(path.join(STORAGE_LOCATION, sub), constants.F_OK);
    return; // File exists
  } catch (err) {
    Logger.debug(`Creating user: ${sub}`)
    await saveUserData(sub, {sets:[], collection:[]})
    return; // File does not exist
  }
}

export async function saveUserData(sub, data){
  try {
    await writeFile(path.join(STORAGE_LOCATION, sub), JSON.stringify(data));
    Logger.debug(`Stored user: ${sub}`)
  } catch (err) {
    console.log(err)
    throw new Error(`Failed to store user data in file: ${sub}`);
  }
}

export async function getUserData(sub){
  try {
    await createUserifNotExists(sub);
    const fileData = await readFile(path.join(STORAGE_LOCATION, sub), 'utf-8');
    return JSON.parse(fileData);
  } catch (err) {
    console.log(err)
    throw new Error(`Failed to read user data: ${sub}`);
  }
}