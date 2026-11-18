<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import AppIcon from './AppIcon.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    width?: string;
    /** 关闭时是否需要确认（由父级在拦截 close 事件时自行处理） */
  }>(),
  { width: '560px' },
);
const emit = defineEmits<{ close: [] }>();

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
void props;
</script>

<template>
  <Teleport to="body">
    <div class="modal-mask" @mousedown.self="emit('close')">
      <div class="modal-panel" :style="{ width }">
        <header class="modal-head">
          <h3>{{ title }}</h3>
          <button class="btn ghost icon-only" title="关闭" @click="emit('close')">
            <AppIcon name="close" :size="15" />
          </button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal-foot">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 14, 0.62);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 9vh 24px 24px;
  z-index: 100;
}
.modal-panel {
  background: var(--bg-1);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  max-width: calc(100vw - 48px);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  animation: pop-in 0.16s ease;
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 13px;
  border-bottom: 1px solid var(--border);
}
.modal-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0.3px;
}
.modal-body {
  padding: 16px 18px;
  overflow-y: auto;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--border);
}
</style>
