<template lang="pug">
.controls
  button(@click="wsA.play();wsB.play()") Play
  button(@click="wsA.pause();wsB.pause()") Pause
.waves(ref="parent")
  .minimap(ref="mapA")
  .wavesurfer(ref="elA")
  .wavesurfer(ref="elB")
  .minimap(ref="mapB")
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from "vue";
import WaveSurfer, { type WavesurferParams } from "wavesurfer.js";
import Minimap from "wavesurfer.js/dist/plugin/wavesurfer.minimap.js";

// boilerplate
const parent = ref<HTMLElement | null>(null);
const elA = ref<HTMLElement | null>(null);
const elB = ref<HTMLElement | null>(null);
const mapA = ref<HTMLElement | null>(null);
const mapB = ref<HTMLElement | null>(null);
const props = defineProps<{
  srcA: string;
  srcB: string;
  options?: WavesurferParams;
}>();
// create wavesurfer object
const wsA = ref<WaveSurfer | null>(null);
const wsB = ref<WaveSurfer | null>(null);
// load
onMounted(() => {
  // create the 2 instances
  wsA.value = WaveSurfer.create({
    ...(props.options || {
      waveColor: "red",
      progressColor: "purple",
      scrollParent: true,
      // backend: "MediaElement",
      mediaControls: true,
    }),
    container: elA?.value,
    plugins: [
      // WaveSurfer.minimap({
      //   container: mapA?.value,
      //   waveColor: "gray",
      //   progressColor: "white",
      //   height: 30,
      //   showRegions: true,
      //   regionsMinWidth: 0.5,
      //   regionsMaxWidth: 5.0,
      //   regions: [],
      // }),
    ],
  });
  wsB.value = WaveSurfer.create({
    ...(props.options || {
      waveColor: "blue",
      progressColor: "purple",
      scrollParent: true,
      // backend: "MediaElement",
      mediaControls: true,
      plugins: [
        // WaveSurfer.minimap({
        //   container: mapB?.value,
        //   waveColor: "gray",
        //   progressColor: "white",
        //   height: 30,
        //   showRegions: true,
        //   regionsMinWidth: 0.5,
        //   regionsMaxWidth: 5.0,
        //   regions: [],
        // }),
      ],
    }),
    container: elB?.value,
  });
  // load both songs
  wsA.value.load(props.srcA);
  wsB.value.load(props.srcB);
});
onBeforeUnmount(() => {
  wsA?.value?.destroy();
  wsB?.value?.destroy();
});
</script>

<style lang="scss" scoped>
.wavesurfer {
  width: 100%;
  height: 100px;
}
</style>
