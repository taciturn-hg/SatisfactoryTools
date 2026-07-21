<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from '@/components/common/AppHeader.vue'
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.app-main {
  flex: 1;
  overflow: hidden;
}
</style>
