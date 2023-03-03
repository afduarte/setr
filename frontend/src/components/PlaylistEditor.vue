<template lang="pug">
.playlist
  draggable(v-model="playlist", item-key="id", :disabled="lock || tempoFocused")
    template(#item="{element, index}")
      track-display(
        :track="element",
        :prev="prev(index)",
        :next="next(index)",
        :locked="lock",
        @mouseover-tempo="tempoFocused = true",
        @mouseleave-tempo="tempoFocused = false",
        @cross-click="$emit('track-click', {track:t, index:index})",
      )
</template>
<script lang="ts" setup>
import { useStore, type TrackData } from "@/stores/store";
import { computed, ref } from "vue";
import TrackDisplay from "./TrackDisplay.vue";
import draggable from "vuedraggable";
import { storeToRefs } from "pinia";
const props = defineProps<{ lock?: boolean }>();
const store = useStore();
const { playlist } = storeToRefs(store);
defineEmits(["track-click"]);
const tempoFocused = ref(false);
const prev = computed(
  () => (i: number) => i > 0 ? playlist.value[i - 1] : undefined
);
const next = computed(
  () => (i: number) =>
    i <= playlist.value.length - 1 ? playlist.value[i + 1] : undefined
);
</script>
<style lang="scss" scoped>
.playlist {
  max-height: 85vh;
  overflow-y: scroll;
}
</style>
