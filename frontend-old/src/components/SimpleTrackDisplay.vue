<template lang="pug">
.track(v-if="track")
  p {{ inner.name }}
  p {{ humaniseDuration(inner.duration_ms) }}
  .tempo
    p {{ humaniseBPM(inner?.audioFeatures?.tempo) }}
  p {{ humaniseKey(inner?.audioFeatures?.key, inner?.audioFeatures?.mode) }}
  p.camelot(:style="camelotStyle(inner?.audioFeatures?.key, inner?.audioFeatures?.mode)") 
    b {{ camelotNumber(inner?.audioFeatures?.key, inner?.audioFeatures?.mode) }}
</template>
<script lang="ts" setup>
import type { TrackData } from "@/stores/store";
import {
  formatDuration,
  formatKey,
  getCamelot,
  getCamelotColour,
} from "@/utils";
import { ref, toRef } from "vue";
const props = defineProps<{ track: TrackData }>();

const inner = toRef(props, "track");

function humaniseDuration(ms?: number) {
  if (!ms) return "---";
  return formatDuration(ms);
}
function humaniseKey(key?: number, mode?: number) {
  if (key === undefined || mode === undefined) return "---";
  return formatKey(key, mode);
}
function humaniseBPM(bpm?: number) {
  if (!bpm) return "---";
  return bpm.toFixed(2);
}
function camelotNumber(key?: number, mode?: number) {
  if (key === undefined || mode === undefined) return "--";
  return getCamelot(key, mode);
}
function camelotStyle(key: number, mode?: number) {
  if (key === undefined || mode === undefined)
    return { backgroundColor: "transparent" };
  return { backgroundColor: getCamelotColour(key, mode) };
}
function halveBPM() {
  if (inner?.value?.audioFeatures?.tempo) {
    inner.value.audioFeatures.tempo = inner.value.audioFeatures.tempo / 2;
  }
}
function doubleBPM() {
  if (inner?.value?.audioFeatures?.tempo) {
    inner.value.audioFeatures.tempo = inner.value.audioFeatures.tempo * 2;
  }
}
</script>
<style lang="scss" scoped>
.track {
  display: grid;
  grid-template-columns: 30fr 7fr 15fr 10fr 10fr;
  align-items: center;
  border-top: 2px solid #cccccc;
  .tempo {
    display: flex;
    flex-direction: row;

    p {
      text-align: center;
      width: 6ch;
    }
  }
  p.camelot {
    color: #000000;
  }
}
</style>
