import { createAuth0, useAuth0 } from "@auth0/auth0-vue";
import axios from "axios";
import type { TrackData } from "./stores/store";

export function formatDuration(ms: number) {
  const secs = ms / 1000;
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs - hours * 3600) / 60);
  const seconds = (secs - hours * 3600 - minutes * 60).toLocaleString("en-GB", {
    minimumIntegerDigits: 2,
    maximumFractionDigits: 0,
    useGrouping: false,
  });

  return (hours > 0 ? hours + ":" : "") + minutes + ":" + seconds;
}

// Key/mode come from AudioMuse as a note name + scale, already converted by the
// backend to a pitch class 0-11 and mode (0 = minor, 1 = major) before they get
// here, so the tables below stay the same.
const keys = [
  "C", // 0
  "D♭", // 1
  "D", // 2
  "E♭", // 3
  "E", // 4
  "F", // 5
  "G♭", // 6
  "G", // 7
  "A♭", // 8
  "A", // 9
  "B♭", // 10
  "B", // 11
];
export function formatKey(key: number, mode: number) {
  if (key === undefined || key === null || key < 0 || key > keys.length - 1) return "N/A";
  return `${keys[key]}`
    .split("/")
    .map((c) => c + (mode === 0 ? "m" : ""))
    .join("/");
}

const camelotColours = [
  "#ee82d9", // C
  "#86f24f", // C#/D♭
  "#9fb6ff", // D
  "#ffa07c", // D#/E♭
  "#00ebeb", // E
  "#ff81b4", // F
  "#3cee81", // F#/G♭
  "#ce8fff", // G
  "#dfca74", // G#/A♭
  "#56d9f9", // A
  "#ff8894", // A#/B♭
  "#00edca", // B
];

export function getCamelotColour(key: number, mode: number) {
  if (key < 0 || key > camelotColours.length - 1) return null;
  // A minor mode, or A in the camelot wheel is the same colour as the parallel major
  // To find a minor mode's colour we need to find its parallel Major since the colours are indexed by major mode
  // A mode's parallel major is found 3 semitones down from the minor
  // Eg: C = Am
  // C = colours[0], A = colours[0 - 3]
  // The possibility of finding negative index values is solved by adding the length of the colours array to the initial index
  // 0 + 12 - 3 = 9 = A
  // This of course causes the opposite problem of causing an array out of bounds if the calculated index is not negative
  // To solve this we apply the modulus operator, which will return a value that's always within the array's bounds
  // Finally, since we only need to apply this in case the mode is === 0 (minor),
  // modeVal store the modifier. 3 if it is a minor key, 0 for major, which is then subtracted off of the key
  const modeVal = mode === 0 ? 3 : 0;
  const index = (key + camelotColours.length + modeVal) % camelotColours.length;
  return camelotColours[index];
}

const camelot = [
  8, // C
  3, // C#/D♭
  10, // D
  5, // D#/E♭
  12, // E
  7, // F
  2, // F#/G♭
  9, // G
  4, // G#/A♭
  11, // A
  6, // A#/B♭
  1, // B
];
export function getCamelot(key: number, mode: number) {
  if (key < 0 || key > camelot.length - 1) return null;
  // The above operation for colour needs to be reversed for the numbers
  // The same number which represents a major key is used for the parallel minor
  // Therefore if we have the key of Am for example, we actually need the number 8
  // which is the number for C
  const modeVal = mode === 0 ? 3 : 0;
  const index = (key + camelotColours.length + modeVal) % camelotColours.length;
  return camelot[index] + (mode === 0 ? "A" : "B");
}

// Pitch doesn't drift equally up or down. On a turntable, slowing a song by 50% will drift the pitch
// by a whole octave, because the frequencies will now be half.
// On the other hand, bringing a song up 50% will not result in an octave higher.
// For that we would have to bring the pitch up by 100%.
// The formula to calculate the number of semitones of the pitch change is:
// T = log2(S) x 12
// Where T is the number of semitones and S is the playback speed (expressed as a decimal number. eg: +50% = 1.5 speed)
// 12 represents the number of semitones in an octave
export function getPitchDrift(percent: number) {
  // Transform the percentage into a decimal speed value
  const speed = 1 + percent / 100;
  // Apply the formula
  const semitones = Math.log2(speed) * 12;
  return semitones;
}

// Util function to get new key from pitch drift in one go
export function getNewKey(key: number, drift: number) {
  const newKey = key + getPitchDrift(drift);
  // Wrap into a pitch class 0-11 (there are 12 semitones, not 11)
  return ((Math.round(newKey) % 12) + 12) % 12;
}

// Util function to get the circleOfFifths/camelotWheel distance 2 keys are from each other
export function getRelativeMajor(key: number, mode: number) {
  return mode === 1 ? key : (key + 3) % 12;
}

export const circleOfFifths = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
export function harmonicDistance(a: TrackData, b: TrackData) {
  if (a?.audioFeatures?.key == null || b?.audioFeatures?.key == null) {
    return Number.MAX_SAFE_INTEGER;
  }
  const keyA = a.audioFeatures.key;
  const keyB = b.audioFeatures.key;
  // mode is set alongside key by the backend; default to minor just in case
  const modeA = a.audioFeatures.mode ?? 0;
  const modeB = b.audioFeatures.mode ?? 0;

  // Get the keys as their relative major so we don't have to consider minor keys
  const majorKeyA = getRelativeMajor(keyA, modeA);
  const majorKeyB = getRelativeMajor(keyB, modeB);

  // Calculate the harmonic distance
  const positionA = circleOfFifths[majorKeyA % 12];
  const positionB = circleOfFifths[majorKeyB % 12];
  const distance = Math.abs(positionA - positionB);
  return Math.min(distance, 12 - distance); // Circular distance
}

// Create a shared auth0 client instance
export const auth0 = createAuth0({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: { redirect_uri: window.location.origin },
});

export const api = axios.create({ baseURL: "/api" });
// Add a request interceptor to add the token for every request
api.interceptors.request.use(function (config) {
  const origConfig = config;
  return auth0
    .getAccessTokenSilently()
    .then((token) => {
      origConfig.headers.Authorization = `Bearer ${token}`;
      return Promise.resolve(origConfig);
    })
    .catch((error) => Promise.reject(error));
});

export function truncate(str: string, size: number, ellipsis = "...") {
  if (str.length <= size) return str;
  return `${str.substring(0, size)}${ellipsis}`;
}
