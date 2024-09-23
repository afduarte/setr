<template lang="pug">
nav
  router-link(to="/app/csv") Upload CSV
  router-link(to="/app/sets") Sets
  router-link(to="/app/collection") Collection
  router-link(to="/app/live") Live View
  router-link(to="/logout") Logout
main
  router-view
</template>
<style scoped lang="scss">
nav {
  margin-top: 5px;
  display: flex;
  gap: 20px;
  a {
    padding: 5px;
    border-radius: 5px;
  }
}
</style>
<style scoped>
nav a {
  border: 2px solid var(--color-primary);
  text-decoration: none;
  color: var(--color-text);
  transition: 0.4s;
}
</style>