<template lang="pug">
.playlist
  draggable(v-model="set.tracks", item-key="id", :disabled="lock || tempoFocused", @end="checkIfShouldUpdate")
    template(#item="{element, index}")
      track-display(
        :track="element",
        :transA="transStore.trackA",
        :transB="transStore.trackB",
        :prev="prev(index)",
        :next="next(index)",
        :locked="lock",
        @mouseover-tempo="tempoFocused = true",
        @mouseleave-tempo="tempoFocused = false",
        @cross-click="$emit('track-click', {track:t, index:index})",
        @transitioner-a="transStore.setTrackA",
        @transitioner-b="transStore.setTrackB",
      )
</template>
<script lang="ts" setup>
import { useStore, type TrackData } from "@/stores/store";
import { computed, ref, toRef, watch } from "vue";
import TrackDisplay from "./TrackDisplay.vue";
import draggable from "vuedraggable";
import { storeToRefs } from "pinia";
import { useTransitionerStore } from "@/stores/transitioner";
const props = defineProps<{ lock?: boolean }>();
const store = useStore();
const transStore = useTransitionerStore();
const { set, userData } = storeToRefs(store);
defineEmits(["track-click"]);
const tempoFocused = ref(false);
const prev = computed(
  () => (i: number) => (i > 0 ? set.value.tracks[i - 1] : undefined),
);
const next = computed(
  () => (i: number) =>
    i <= set.value.tracks.length - 1 ? set.value.tracks[i + 1] : undefined
);
// check if the playlist order was changed by dragging. If so, update
function checkIfShouldUpdate() {
  // sanity check, nothing should fall here because adding/removing tracks is handled by the store
  const metaSet = userData.value.sets.find((x) => x.id == set.value.id);
  if (!metaSet) return;
  if (set.value.tracks.length != metaSet.tracks.length) {
    store.updateMetaSet();
    return;
  }
  for (const idx in set.value.tracks) {
    if (set.value.tracks[idx].id != metaSet.tracks[idx].id) {
      store.updateMetaSet();
      return;
    }
  }
}
</script>
<style lang="scss" scoped>
.playlist {
  max-height: 85vh;
  overflow-y: scroll;
}
</style>
