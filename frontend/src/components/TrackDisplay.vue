<template lang="pug">
.wrapper(v-if="track")
  .track
    p.cross(@click="controlledEmit('cross-click')") {{ locked ? '' : '❌' }}
    p(:title="artistNames") {{ inner.name }}
    p {{ humaniseDuration(adjustedDuration) }}
    .tempo(@mouseover="controlledEmit('mouseover-tempo')", @mouseleave="controlledEmit('mouseleave-tempo')", @click.stop="")
      .tempos
        p BPM:
        p {{ humaniseBPM(adjustedTempo) }}
        p {{ humaniseAdjustment(inner.adjustment) }}
      vue-slider(v-model="inner.adjustment", 
        :min="-50",
        :max="50",
        :interval="0.5",
        tooltip="none",
        :tooltip-formatter="'{value}%'",
        direction="ltr",
        width="100%",
        :disabled="locked"
      )
    p Key: {{ humaniseKey(adjustedKey, inner?.audioFeatures?.mode) }}
    //- .transitioner
    //-   p Transitioner
    //-   button(:class="{active: track.id == transA?.id}", @click.stop="$emit('transitioner-a', track)") A
    //-   button(:class="{active: track.id == transB?.id}", @click.stop="$emit('transitioner-b', track)") B
    p(:contenteditable="!locked", @input="inner.note = $event.target.innerText") {{ inner.note }}
  p.camelot(:style="camelotStyle(adjustedKey, inner?.audioFeatures?.mode)") 
    b {{ camelotNumber(adjustedKey, inner?.audioFeatures?.mode) }}

</template>
<script lang="ts" setup>
import type { EnhancedTrack } from "@/stores/store";
import VueSlider from "vue-slider-component";
import "vue-slider-component/theme/antd.css";
import {
  formatDuration,
  formatKey,
  getCamelot,
  getCamelotColour,
  getNewKey,
} from "@/utils";
import { computed, ref, toRef } from "vue";
// Before we start:
// This component mutates a track's adjustment directly. This is so we don't have to handle the complexities of passing those messages around.
// For now no other code uses the tracks in the playlist and they are copies of the originals so there are no side effects
// But this is a reminder in case at some point that changes

const emit = defineEmits([
  "mouseover-tempo",
  "mouseleave-tempo",
  "cross-click",
  "transitioner-a",
  "transitioner-b",
]);
const props = defineProps<{
  track: EnhancedTrack;
  transA: EnhancedTrack | null;
  transB: EnhancedTrack | null;
  prev?: EnhancedTrack | undefined;
  next?: EnhancedTrack | undefined;
  locked?: boolean;
}>();

const inner = toRef(props, "track");
const adjustedTempo = computed(() => {
  const speed = 1 + inner.value.adjustment / 100;
  const tempo = inner.value.audioFeatures?.tempo;
  if (!tempo) return undefined;
  return tempo * speed;
});
const adjustedDuration = computed(() => {
  const speed = 1 + inner.value.adjustment / 100;
  const dur = inner.value.duration_ms;
  if (!dur) return undefined;
  return dur / speed;
});
const prevCompare = computed(() => {
  if (!adjustedTempo.value || !props.prev?.audioFeatures?.tempo) return "---";
  return BPMCompare(adjustedTempo.value, props.prev.audioFeatures.tempo);
});
const nextCompare = computed(() => {
  if (!adjustedTempo.value || !props.next?.audioFeatures?.tempo) return "---";
  return BPMCompare(adjustedTempo.value, props.next.audioFeatures.tempo);
});
const adjustedKey = computed(() => {
  const key = inner.value.audioFeatures?.key;
  if (key === undefined) return "---";
  const newKey = getNewKey(key, inner.value.adjustment);
  return Math.round(newKey);
});
const artistNames = computed(() => {
  return inner.value.artists?.map((a) => a.name).join(", ");
});

function humaniseDuration(ms?: number) {
  if (!ms) return "---";
  return formatDuration(ms);
}
function humaniseKey(key?: number, mode?: number) {
  if (key === undefined || mode === undefined) return "---";
  return formatKey(Math.floor(key), mode);
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
function humaniseAdjustment(a: number) {
  if (a == 0) return "";
  if (a > 0) return `+${a}%`;
  return `${a}%`;
}
function BPMCompare(a: number, b: number) {
  const tempo = a;
  const diff = tempo - b;
  const percent = (diff / tempo) * 100;
  if (diff < 0) return `${percent.toFixed(1)}%`;
  return `+${percent.toFixed(1)}%`;
}
function controlledEmit(evt: any, ...args: any[]) {
  if (!props.locked) emit(evt, ...args);
}
</script>
<style lang="scss" scoped>
.wrapper {
  display: grid;
  grid-template-columns: 90fr 5fr;
  .camelot {
    text-align: center;
    color: #000000;
  }
  .track {
    display: grid;
    grid-template-columns: 2fr 15fr 3fr 10fr 4fr 10fr;
    align-items: center;

    .tempo {
      display: flex;
      flex-direction: column;
      align-items: center;
      .vue-slider {
        padding: 8px 5px;
      }
      .tempos {
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: center;
        p {
          text-align: center;
          width: 6ch;
        }
      }
    }
    p.camelot {
      color: #333333;
    }
    .controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      p {
        cursor: pointer;
      }
    }
    textarea {
      resize: vertical;
    }
  }
}
.cross {
  cursor: pointer;
}
</style>
<style scoped>
.track {
  border-top: 2px solid var(--color-text);
}
.track button.active {
  background-color: var(--color-text);
  color: var(--color-background-mute);
}
</style>
