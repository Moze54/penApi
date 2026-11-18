<script setup lang="ts">
import { useUiStore } from '@/stores/ui';
import AppIcon from './AppIcon.vue';

const ui = useUiStore();

const ICON: Record<string, string> = { ok: 'check', error: 'alert', info: 'link' };
</script>

<template>
  <Teleport to="body">
    <div class="toast-host">
      <TransitionGroup name="toast">
        <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.type">
          <AppIcon :name="ICON[t.type] ?? 'check'" :size="14" />
          <span>{{ t.text }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 300;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-radius: 8px;
  background: var(--bg-2);
  border: 1px solid var(--border-strong);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  font-size: 13px;
}
.toast.ok {
  color: var(--green);
  border-color: rgba(74, 222, 128, 0.35);
}
.toast.error {
  color: var(--red);
  border-color: rgba(248, 113, 113, 0.35);
}
.toast.info {
  color: var(--accent);
  border-color: var(--accent-line);
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
