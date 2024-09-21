import axios from "axios";
import { defineStore } from "pinia";
import { getFormattedTrackName, type EnhancedTrack } from "./store";

export interface TransTrack {
  id: string;
  title: string;
  thumbnail: string;
}

export const useTransitionerStore = defineStore("transitioner", {
  state() {
    return {
      trackA: null as EnhancedTrack | null,
      trackB: null as EnhancedTrack | null,
      searchResultsA: [] as TransTrack[],
      searchResultsB: [] as TransTrack[],
      chosenAIdx: 0,
      chosenBIdx: 0,
    };
  },
  actions: {
    setTrackA(t: EnhancedTrack) {
      this.trackA = t;
      this.search(t.artists.map((a) => a.name).join(), t.name, "A");
    },
    setTrackB(t: EnhancedTrack) {
      this.trackB = t;
      this.search(t.artists.map((a) => a.name).join(), t.name, "B");
    },
    async search(artist: string, track: string, dest: "A" | "B") {
      const { data } = await axios.get<TransTrack[]>(
        "/api/transitioner-search",
        { params: { artist, track } }
      );
      if (dest === "A") {
        this.searchResultsA = data;
      } else {
        this.searchResultsB = data;
      }
    },
    clearSearch() {
      this.chosenAIdx = 0;
      this.searchResultsA = [];
      this.chosenBIdx = 0;
      this.searchResultsB = [];
    },
  },
  getters: {
    trackAMeta(state) {
      return state.searchResultsA[this.chosenAIdx];
    },
    trackBMeta(state) {
      return state.searchResultsB[this.chosenBIdx];
    },
  },
});
