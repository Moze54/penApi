<script setup lang="ts">
import { useUiStore } from '@/stores/ui';
import AppIcon from './AppIcon.vue';

const ui = useUiStore();
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.confirm" class="modal-mask" @mousedown.self="ui.resolveConfirm(false)">
      <div class="confirm-panel">
        <div class="confirm-icon" :class="{ danger: ui.confirm.danger }">
          <AppIcon :name="ui.confirm.danger ? 'alert' : 'alert'" :size="22" />
        </div>
        <h3>{{ ui.confirm.title }}</h3>
        <p class="confirm-message">{{ ui.confirm.message }}</p>
        <div class="confirm-actions">
          <button class="btn" @click="ui.resolveConfirm(false)">取消</button>
          <button
            class="btn"
            :class="ui.confirm.danger ? 'danger' : 'primary'"
            @click="ui.resolveConfirm(true)"
          >
            {{ ui.confirm.okText ?? '确定' }}
          </button>
        </div>
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
  align-items: center;
  justify-content: center;
  z-index: 130;
}
.confirm-panel {
  width: 400px;
  max-width: calc(100vw - 48px);
  background: var(--bg-1);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  padding: 24px 24px 20px;
  text-align: center;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  animation: pop 0.16s ease;
}
@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
}
.confirm-icon {
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--orange);
  background: rgba(251, 191, 36, 0.12);
}
.confirm-icon.danger {
  color: var(--red);
  background: rgba(248, 113, 113, 0.12);
}
h3 {
  margin: 0 0 8px;
  font-size: 15px;
}
.confirm-message {
  margin: 0 0 20px;
  color: var(--text-1);
  word-break: break-all;
}
.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}
.confirm-actions .btn {
  min-width: 96px;
  padding: 8px 16px;
}
</style>
