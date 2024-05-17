<template lang="pug">
main.container
  .live-view
    .header
      h2 Live View
    live-view-display(:albums="hydratedCollection", :current="current", :played="playedSongs", :suggestions="suggestions")
</template>
<script setup lang="ts">
import { useStore, type EnhancedAlbum, type EnhancedTrack } from "@/stores/store";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { computed, ref } from "vue";
import { useLiveStore } from "@/stores/liveStore";
import LiveViewDisplay from "@/components/LiveViewDisplay.vue";

const store = useStore();
const { userData, albums } = storeToRefs(store);
const liveStore = useLiveStore();
const { suggestions, playedSongs, current } = storeToRefs(liveStore);
const router = useRouter();
const hydratedCollection = computed(() =>
  userData.value.collection.map((a) => {
    const h = albums.value[a.id];
    if (h) {
      return { ...h, tags: a.tags } as EnhancedAlbum;
    }
  })
);
</script>
<style lang="scss" scoped>
.container {
  width: 100%;
  padding-top: 20px;
  display: grid;
  grid-template-columns: 1fr;
  &.collection {
    grid-template-columns: 10fr 1fr;
  }
  &.live {
    grid-template-columns: 1fr 10fr;
  }
  &.collection.live {
    grid-template-columns: 7fr 10fr;
  }
  .header {
    display: flex;
    flex-direction: row;
  }
}

.caret {
  border: none;
  background: none;
  font-size: 3rem;
}
</style>
