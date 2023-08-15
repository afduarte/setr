<template lang="pug">
.set-card.new(v-if="!set")
  fa-icon(icon="fa-plus")
.set-card(v-else)
  .name
    button(@click="$emit('edit-click')")
      fa-icon(icon="fa-pencil fa-lg")
    p {{ set.name }}
    button(@click.stop="$emit('bin-click')")
      fa-icon.red-icon(icon="fa-trash fa-lg")
  .stats
    p {{ set.tracks.length }} songs
    p {{ stringDate }}
</template>
<script setup lang="ts">
import type { Set } from "@/stores/store";
import { computed, ref, toRefs } from "vue";

const props = defineProps<{
  set: Set | null;
}>();
const { set } = toRefs(props);
const stringDate = computed(() =>
  set.value
    ? new Date(set.value.created).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null
);
</script>
<style scoped>
.set-card {
  text-align: center;
  border: 1px solid var(--color-text);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 5px;
}
.set-card:hover {
  transform: scale(1.05);
}
.set-card.new {
  font-size: 5em;
}
.set-card .name {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
</style>
