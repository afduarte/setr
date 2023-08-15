<template lang="pug">
main
  .header
    h1 Saved Sets
  .sets
    set-card(v-for="s in userData.sets", :set="s", @edit-click="router.push('/app/set/'+s.id)")
    set-card(:set="null", @click="addSet")
</template>
<script setup lang="ts">
import { useStore } from "@/stores/store";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import SetCard from "@/components/SetCard.vue";

const store = useStore();
const { userData, addSet } = storeToRefs(store);
const router = useRouter();
</script>
<style lang="scss" scoped>
.sets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
</style>
