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
      const tracks = Object.values(store.allTracks).map((track) => ({
        track,
        rank: rank(state.current, track, state.playedSongs),
      }));
    },
  },
});

function rank(a: TrackData, b: TrackData, playedSongs: EnhancedTrack[]) {
  const aFeatures = a?.audioFeatures;
  const bFeatures = b?.audioFeatures;
  if (!aFeatures || !bFeatures) return Number.MAX_SAFE_INTEGER;
  const bpmWeight = 0.5;
  const camelotWeight = 0.3;
  const danceabilityWeight = 0.1;
  const energyWeight = 0.1;
  const valenceWeight = 0.1;
  const playedPenalty = 10;

  const bpmDiff = Math.abs(aFeatures.tempo - bFeatures?.tempo);
  const harmonicDist = harmonicDistance(a, b);
  const danceDiff = Math.abs(aFeatures.danceability - bFeatures.danceability);
  const energyDiff = Math.abs(aFeatures.energy - bFeatures.energy);
  const valenceDiff = Math.abs(aFeatures.valence - bFeatures.valence);
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
