import { defineStore } from "pinia";
import {
  useStore,
  type EnhancedTrack,
  type AlbumData,
  type TrackData,
} from "./store";
import { harmonicDistance } from "@/utils";

export const useLiveStore = defineStore("liveStore", {
  state() {
    return {
      current: {} as EnhancedTrack,
      playedSongs: [] as EnhancedTrack[],
      search: "",
    };
  },
  actions: {},
  getters: {
    suggestions(state) {
      const store = useStore();
      if (!state.current?.id) return [] as EnhancedTrack[];
      return Object.values(store.allTracks)
        .filter((track) => track.id !== state.current.id)
        .map((track) => ({
          track,
          rank: rank(state.current, track, state.playedSongs),
        }))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 50)
        .map((x) => ({
          ...(x.track as TrackData),
          adjustment: 0,
          note: "",
        })) as EnhancedTrack[];
    },
  },
});

// Exported as a pure function so the ranking maths can be unit-tested and
// reused (e.g. by the transitioner) without a store instance.
export function rank(a: TrackData, b: TrackData, playedSongs: EnhancedTrack[]) {
  const aFeatures = a?.audioFeatures;
  const bFeatures = b?.audioFeatures;
  if (!aFeatures || !bFeatures) return Number.MAX_SAFE_INTEGER;
  const bpmWeight = 0.5;
  const camelotWeight = 0.3;
  const danceabilityWeight = 0.1;
  const energyWeight = 0.1;
  const valenceWeight = 0.1;
  const playedPenalty = 10;

  const bpmDiff = Math.abs((aFeatures.tempo ?? 0) - (bFeatures.tempo ?? 0));
  const harmonicDist = harmonicDistance(a, b);
  const danceDiff = Math.abs((aFeatures?.danceability ?? 0) - (bFeatures?.danceability ?? 0));
  const energyDiff = Math.abs((aFeatures?.energy ?? 0) - (bFeatures?.energy ?? 0));
  const valenceDiff = Math.abs((aFeatures?.valence ?? 0) - (bFeatures?.valence ?? 0));
  const played = playedSongs.find((x) => x.id == b.id) ? playedPenalty : 0;

  return (
    bpmWeight * bpmDiff +
    camelotWeight * harmonicDist +
    danceabilityWeight * danceDiff +
    energyWeight * energyDiff +
    valenceWeight * valenceDiff +
    played
  );
}
