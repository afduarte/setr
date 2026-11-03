<template lang="pug">
teleport(to="body")
  template(v-if="show")
    .mask(@click="close")
    .modal(@click="close")
      .container(@click.stop="")
        .tracks(v-if="store.trackA && store.trackB")
          h2 {{ trackName(store.trackA) }}
          wavesurfer(
            :key="store.trackA.id + '-' + store.trackB.id",
            :trackA="store.trackA",
            :trackB="store.trackB",
            :srcA="streamURL(store.trackA)",
            :srcB="streamURL(store.trackB)"
            )
          h2 {{ trackName(store.trackB) }}
        p(v-else) Pick an A and B track (the A/B buttons on each track) to compare them.
</template>
<script lang="ts" setup>
import Wavesurfer from "@/components/WaveSurfer.vue";
import { getFormattedTrackName, type EnhancedTrack } from "@/stores/store";
import { useTransitionerStore } from "@/stores/transitioner";

defineProps<{ show: boolean }>();
const emit = defineEmits(["close"]);
const store = useTransitionerStore();

function trackName(t: EnhancedTrack) {
  return getFormattedTrackName(t);
}

function streamURL(t: EnhancedTrack | null) {
  return t ? `/api/stream/${t.id}` : "";
}

function close() {
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
