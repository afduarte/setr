import { createAuth0, useAuth0 } from "@auth0/auth0-vue";
import axios from "axios";

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

// Spotify displays key as a number between 0 and 11 that represents the 12 keys starting on C
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
  if (key < 0 || key > keys.length - 1) return "N/A";
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
  // Finally, since we only need to apply this in case the mode is === 0 (Spotify's value for a minor key),
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
  // Making sure the value is between 1 and 12
  return (newKey + 11) % 11;
}

export function getSpotifyIDFromURL(s: string) {
  // https://open.spotify.com/album/{id}
  return s.split("/").pop();
}

// Create a shared auth0 client instance
export const auth0 = createAuth0({
  domain: "setr.uk.auth0.com",
  clientId: "qbA6LQKWUmclCFyjqYfJSfH6Wr5RVFST",
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
