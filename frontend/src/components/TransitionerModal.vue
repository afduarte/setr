<template lang="pug">
teleport(to="body")
  template(v-if="show")
    .mask(@click="close")
    .modal(@click="close")
      .container(@click.stop="")
        .tracks
          h2 {{ trackName(store.trackA) }}
          wavesurfer(
            :trackA="store.trackA",
            :trackB="store.trackB",
            :srcA="getURL(store.trackAMeta)", 
            :srcB="getURL(store.trackBMeta)"
            )
          h2 {{ trackName(store.trackB) }}

          

</template>
<script lang="ts" setup>
import Wavesurfer from "@/components/WaveSurfer.vue";
import { getFormattedTrackName, type EnhancedTrack } from "@/stores/store";
import { useTransitionerStore, type TransTrack } from "@/stores/transitioner";

defineProps<{ show: boolean }>();
const emit = defineEmits(["close"]);
const store = useTransitionerStore();

function trackName(t: EnhancedTrack) {
  return getFormattedTrackName(t);
}

function getURL(t: TransTrack) {
  return `/api/transitioner-dl?id=${t.id}`;
}

async function fetchTracks() {
  if (!store.trackA || !store.trackB) return close();
  const aArtist = store.trackA.artists.map((a) => a.name).join();
  const bArtist = store.trackB.artists.map((a) => a.name).join();
  await Promise.all([
    store.search(aArtist, store.trackA.name, "A"),
    store.search(bArtist, store.trackB.name, "B"),
  ]);
}

function close() {
  store.clearSearch();
  emit("close");
}
</script>
<style scoped>
.mask {
  z-index: 9;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--color-background-trans);
}
.modal {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 20fr 1fr;
  z-index: 10;
  position: absolute;
  top: 2%;
}
.container {
  width: 80%;
  grid-column: 2;
  margin: 0 auto;
  padding: 10px;
}
</style>
<style lang="scss" scoped></style>
