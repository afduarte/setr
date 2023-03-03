<template lang="pug">
.tags
  smart-tagz(
    autosuggest
    editable
    inputPlaceholder="Tags..."
    :sources="options"
    :allowPaste="{delimiter: ','}"
    :allowDuplicates="false",
    :theme="colours"
    )
</template>
<script setup lang="ts">
import { SmartTagz } from "smart-tagz";
import "smart-tagz/dist/smart-tagz.css";
const options = ["HipHop", "Dancy"];
const colours = {
  primary: "var(--color-primary)",
  background: "var(--color-background-soft)",
  tagTextColor: "var(--color-text)",
};
</script>
<style lang="scss" scoped>
.tags-main{
  padding: 2px;
}
</style>