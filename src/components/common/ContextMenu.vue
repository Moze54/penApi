<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ctxMenu, closeCtxMenu } from '@/core/menu';
import AppIcon from './AppIcon.vue';

const panelEl = ref<HTMLElement | null>(null);

async function place() {
  await nextTick();
  const el = panelEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  let x = ctxMenu.x;
  let y = ctxMenu.y;
  if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
  if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
  el.style.left = `${Math.max(8, x)}px`;
  el.style.top = `${Math.max(8, y)}px`;
}

function onGlobalDown(e: MouseEvent) {
  if (ctxMenu.show && panelEl.value && !panelEl.value.contains(e.target as Node)) {
    closeCtxMenu();
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeCtxMenu();
}

watch(() => ctxMenu.show, (v) => v && place());
onMounted(() => {
  window.addEventListener('mousedown', onGlobalDown, true);
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', closeCtxMenu);
  window.addEventListener('blur', closeCtxMenu);
});
onUnmounted(() => {
  window.removeEventListener('mousedown', onGlobalDown, true);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', closeCtxMenu);
  window.removeEventListener('blur', closeCtxMenu);
});

function run(item: (typeof ctxMenu)['items'][number]) {
  if (item.disabled || item.separator) return;
  closeCtxMenu();
  item.action?.();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="ctxMenu.show" ref="panelEl" class="ctx-menu">
      <template v-for="(item, i) in ctxMenu.items" :key="i">
        <div v-if="item.separator" class="ctx-sep" />
        <button
          v-else
          class="ctx-item"
          :class="{ danger: item.danger, disabled: item.disabled }"
          @click="run(item)"
        >
          <AppIcon v-if="item.icon" :name="item.icon" :size="14" />
          <span>{{ item.label }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 200;
  min-width: 156px;
  background: var(--bg-2);
  border: 1px solid var(--border-strong);
  border-radius: 9px;
  padding: 5px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  animation: ctx-in 0.12s ease;
}
@keyframes ctx-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: var(--text-0);
  cursor: pointer;
  text-align: left;
  font-size: 12.5px;
}
.ctx-item span {
  flex: 1;
}
.ctx-item:hover {
  background: var(--bg-3);
}
.ctx-item.danger {
  color: var(--red);
}
.ctx-item.danger:hover {
  background: rgba(248, 113, 113, 0.1);
}
.ctx-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ctx-item.disabled:hover {
  background: transparent;
}
.ctx-sep {
  height: 1px;
  margin: 5px 6px;
  background: var(--border);
}
</style>
