<template>
  <div class="container">
    <h2>Life is better when you log in</h2>
    <button @click="loginWithRedirect()">Log in</button>
  </div>
</template>
<script setup lang="ts">
import { useAuth0 } from "@auth0/auth0-vue";
const { loginWithRedirect } = useAuth0();
</script>
