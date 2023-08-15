<template lang="pug">
main
  .header
    h1 Collection
    button(@click="showSearch = true") Add Album
  .grid
    album-grid(:albums="hydratedCollection", @album-delete="store.removeFromCollection($event.id)")
search-modal(:show="showSearch", @close="showSearch = false")
</template>
<script setup lang="ts">
import { useStore, type EnhancedAlbum } from "@/stores/store";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import AlbumGrid from "@/components/AlbumGrid.vue";
import SearchModal from "@/components/SearchModal.vue";
import { computed, ref } from "vue";

const store = useStore();
const { userData, albums } = storeToRefs(store);
const router = useRouter();
const showSearch = ref(false);
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

</style>
