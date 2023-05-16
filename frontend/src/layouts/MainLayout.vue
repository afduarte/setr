<template lang="pug">
nav
  router-link(to="/app/") Editor
  router-link(to="/app/csv") Upload CSV
  router-link(to="/logout") Logout
main
  router-view
</template>
