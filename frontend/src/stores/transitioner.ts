import { defineStore } from "pinia";
import type { EnhancedTrack } from "./store";

export const useTransitionerStore = defineStore("transitioner", {
  state() {
    return {
      trackA: null as EnhancedTrack | null,
      trackB: null as EnhancedTrack | null,
    };
  },
  actions: {
    setTrackA(t: EnhancedTrack) {
      this.trackA = t;
    },
    setTrackB(t: EnhancedTrack) {
      this.trackB = t;
    },
    clear() {
      this.trackA = null;
      this.trackB = null;
    },
  },
});
