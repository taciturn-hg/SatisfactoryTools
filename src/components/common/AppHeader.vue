<script setup lang="ts">
import AppLogo from '@/components/common/AppLogo.vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

function navigateTo(name: string) {
  router.push({ name })
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <AppLogo />
      <nav class="header-nav">
        <div class="nav-dropdown">
          <span class="nav-item nav-dropdown-trigger">工厂计划 ▾</span>
          <div class="nav-dropdown-menu">
            <button
              class="nav-dropdown-item"
              :class="{ active: route.name === 'production-plan' }"
              @click="navigateTo('production-plan')"
            >
              生产计划
            </button>
            <button
              class="nav-dropdown-item"
              :class="{ active: route.name === 'power-plan' }"
              @click="navigateTo('power-plan')"
            >
              发电计划
            </button>
          </div>
        </div>
      </nav>
    </div>
    <div class="header-right">
      <select class="lang-select">
        <option value="zh-CN">简体中文</option>
      </select>
      <a
        class="github-link"
        href="https://github.com/taciturn-hg/SatisfactoryTools"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub ▸
      </a>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: calc(100vh / 12);
  min-height: 48px;
  max-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 0;
}

.header-left {
  display: flex;
  align-items: center;
  height: 100%;
}

.header-nav {
  display: flex;
  align-items: center;
  height: 100%;
}

.nav-dropdown {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
}

.nav-dropdown-trigger {
  cursor: pointer;
  padding: 0 16px;
}

.nav-dropdown:hover .nav-dropdown-menu {
  display: flex;
}

.nav-dropdown-menu {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  min-width: 120px;
  z-index: var(--z-modal);
  overflow: hidden;
}

.nav-dropdown-item {
  padding: 10px 16px;
  font-size: 14px;
  color: var(--text-primary);
  text-align: left;
  white-space: nowrap;
  transition: background var(--transition-fast);
}
.nav-dropdown-item:hover {
  background: var(--bg-tertiary);
}
.nav-dropdown-item.active {
  color: var(--color-primary);
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 16px;
}

.lang-select {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.github-link {
  padding: 4px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}
.github-link:hover {
  color: var(--text-primary);
  border-color: var(--border-color-light);
}
</style>
