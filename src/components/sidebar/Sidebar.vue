<script setup lang="ts">
import { ref } from 'vue';
import { useUiStore } from '@/stores/ui';
import AppIcon from '@/components/common/AppIcon.vue';
import ProjectList from './ProjectList.vue';
import HistoryList from './HistoryList.vue';

const ui = useUiStore();

/** 侧栏宽度（可拖拽调节） */
const width = ref(264);
const resizing = ref(false);

function startResize(e: MouseEvent) {
  e.preventDefault();
  resizing.value = true;
  const startX = e.clientX;
  const startW = width.value;
  const onMove = (ev: MouseEvent) => {
    width.value = Math.min(440, Math.max(210, startW + ev.clientX - startX));
  };
  const onUp = () => {
    resizing.value = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
  };
  document.body.style.cursor = 'col-resize';
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
</script>

<template>
  <aside class="sidebar" :style="{ width: width + 'px' }">
    <div class="seg">
      <button
        class="seg-btn"
        :class="{ on: ui.sidebarView === 'library' }"
        @click="ui.sidebarView = 'library'"
      >
        <AppIcon name="book" :size="13" /> 接口库
      </button>
      <button
        class="seg-btn"
        :class="{ on: ui.sidebarView === 'history' }"
        @click="ui.sidebarView = 'history'"
      >
        <AppIcon name="clock" :size="13" /> 历史
      </button>
    </div>

    <div class="sidebar-view">
      <ProjectList v-show="ui.sidebarView === 'library'" />
      <HistoryList v-show="ui.sidebarView === 'history'" />
    </div>

    <div
      class="resize-handle"
      :class="{ active: resizing }"
      @mousedown="startResize"
    />
  </aside>
</template>

<style scoped>
.sidebar {
  position: relative;
  height: 100%;
  background: var(--bg-1);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-width: 210px;
}
.seg {
  display: flex;
  gap: 4px;
  margin: 12px 12px 0;
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 3px;
}
.seg-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-1);
  padding: 5px 0;
  cursor: pointer;
  font-size: 12.5px;
  transition: background 0.15s, color 0.15s;
}
.seg-btn:hover {
  color: var(--text-0);
}
.seg-btn.on {
  background: var(--bg-3);
  color: var(--accent);
}
.sidebar-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}
.resize-handle.active,
.resize-handle:hover {
  background: var(--accent-line);
}
</style>
