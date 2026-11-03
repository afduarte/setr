<template lang="pug">
.controls
  button(@click="wsA.play();wsB.play()") Play
  button(@click="wsA.pause();wsB.pause()") Pause
.waves(ref="parent")
  .wave
    .vol
      vue-slider(v-model="volA", :min="0",:max="1", :interval="0.1", direction="btt", height="100%")
    .rest
      p {{ ((trackA?.audioFeatures?.tempo || 0) * rateA).toFixed(2) }} ({{ (trackA?.adjustment || 0) }})
      vue-slider(v-model="trackA.adjustment", :min="-50",:max="50", :interval="0.1", direction="ltr", width="50%")
      .minimap(ref="mapA")
      .wavesurfer(ref="elA")
  .wave
    .vol
      vue-slider(v-model="volB", :min="0",:max="1", :interval="0.1", direction="btt", height="100%")
    .rest
      .wavesurfer(ref="elB")
      .minimap(ref="mapB")
      vue-slider(v-model="trackB.adjustment", :min="-50", :max="50", :interval="0.1", direction="ltr", width="50%")
      p {{ ((trackB?.audioFeatures?.tempo || 0) * rateB).toFixed(2) }} ({{ (trackB?.adjustment || 0)}})
</template>

<script setup lang="ts">
import type { EnhancedTrack } from "@/stores/store";
import {
  ref,
  onBeforeUnmount,
  onMounted,
  computed,
  watch,
  type Ref,
} from "vue";
import WaveSurfer from "wavesurfer.js";
import Minimap from "wavesurfer.js/dist/plugins/minimap.js";
import VueSlider from "vue-slider-component";
import "vue-slider-component/theme/antd.css";
import { useScrollDrag } from "@/composables/useScrollDrag";

// boilerplate
const parent = ref<HTMLElement | null>(null);
const elA = ref<HTMLElement | null>(null);
const elB = ref<HTMLElement | null>(null);
const mapA = ref<HTMLElement | null>(null);
const mapB = ref<HTMLElement | null>(null);
const volA = ref(0.5);
const volB = ref(0.5);
const props = defineProps<{
  trackA: EnhancedTrack;
  trackB: EnhancedTrack;
  srcA: string;
  srcB: string;
}>();
// create wavesurfer object
const wsA = ref<WaveSurfer | null>(null);
const wsB = ref<WaveSurfer | null>(null);
const rateA = computed(() => 1 + props.trackA.adjustment / 100);
const rateB = computed(() => 1 + props.trackB.adjustment / 100);
// watch rates to change speed
watch(rateA, (newVal: number) => wsA?.value?.setPlaybackRate(newVal));
watch(rateB, (newVal: number) => wsB?.value?.setPlaybackRate(newVal));
// watch volumes to change volume
watch(volA, (newVal: number) => wsA?.value?.setVolume(newVal));
watch(volB, (newVal: number) => wsB?.value?.setVolume(newVal));
// load
onMounted(() => {
  if (!elA.value || !elB.value) return;
  const baseOptions: any = {
    backend: "WebAudio",
    waveColor: "#00eeffbb",
    progressColor: "purple",
    scrollParent: true,
    fillParent: false,
    hideScrollBar: true,
    autoCenter: true,
    interact: false,
    mediaControls: true,
    maxCanvasWidth: 40000,
    barGap: 1,
    barHeight: 1,
    barMinHeight: 1,
    barWidth: 1,
    height: 150,
  };
  // create the 2 instances
  wsA.value = WaveSurfer.create({
    ...baseOptions,
    container: elA.value,
    audioRate: rateA.value,
    plugins: [
      Minimap.create({
        container: mapA.value as HTMLElement,
        waveColor: "gray",
        progressColor: "white",
        height: 50,
      }),
    ],
  });
  const childWaveA = ref(elA?.value?.querySelector("wave"));
  if (childWaveA.value) {
    useScrollDrag(childWaveA as Ref<HTMLElement>);
  }
  wsB.value = WaveSurfer.create({
    ...baseOptions,
    container: elB.value,
    audioRate: rateB.value,
    plugins: [
      Minimap.create({
        container: mapB.value as HTMLElement,
        waveColor: "gray",
        progressColor: "white",
        height: 30,
      }),
    ],
  });
  const childWaveB = ref(elB?.value?.querySelector("wave"));
  if (childWaveB.value) {
    useScrollDrag(childWaveB as Ref<HTMLElement>);
  }
  // load both songs
  wsA.value.load(props.srcA);
  wsB.value.load(props.srcB);
  // trigger the centerplayhead funciton on waveform-ready
  wsA.value.on("ready", () => centerplayhead(wsA.value));
  wsB.value.on("ready", () => centerplayhead(wsB.value));
});

function centerplayhead(ws: any) {
  if (!ws) return;
  try {
    // Guarded: the WebAudio backend may not expose getPeaks/setPeaks in every
    // wavesurfer.js version. The waveform still renders without the offset.
    const backend: any = (ws as any).backend;
    if (!backend?.getPeaks || !backend?.setPeaks) return;
    const sampleRate = 1000;
    const numberOfSamples = sampleRate * ws.getDuration();
    const peaks = backend.getPeaks(numberOfSamples);
    const silence = Array(sampleRate * 5 * 2).fill(0);
    backend.setPeaks(silence.concat(peaks));
  } catch (e) {
    console.warn("centerplayhead skipped", e);
  }
}
onBeforeUnmount(() => {
  wsA?.value?.destroy();
  wsB?.value?.destroy();
});
</script>

<style lang="scss" scoped>
.wave {
  display: grid;
  grid-template-columns: 1fr 40fr;
}
.wavesurfer {
  width: 100%;
  canvas {
    left: 50% !important;
  }
}
</style>
