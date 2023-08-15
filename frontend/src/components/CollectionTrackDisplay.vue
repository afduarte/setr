<template lang="pug">
.track(v-if="track")
  .name(:title="inner.name")
    p {{ truncate(inner.name, 30) }}
  .rest
    p 
      fa-icon(icon="fa-clock")
      | {{ humaniseDuration(inner.duration_ms) }}
    p 
      b BPM: 
      | {{ humaniseBPM(inner?.audioFeatures?.tempo) }}
    .harmonic
      p 
        fa-icon(icon="fa-music")
        | {{ humaniseKey(inner?.audioFeatures?.key, inner?.audioFeatures?.mode) }}
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
  truncate,
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
  return bpm.toFixed(1);
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
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  border-bottom: 2px solid #cccccc;
  .rest {
    b {
      font-weight: bold;
    }
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    width: 100%;
    svg {
      margin-right: 5px;
    }
    .harmonic {
      b {
        font-weight: normal;
      }
      display: grid;
      grid-template-columns: 1.3fr 1fr;
    }
  }
  p.camelot {
    text-align: right;
    width: 100%;
    color: #000000;
    justify-self: flex-end;
  }
}
</style>
