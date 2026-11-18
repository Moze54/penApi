<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const inputEl = ref<HTMLInputElement | null>(null);
const value = ref('');

watch(
  () => ui.prompt,
  async (p) => {
    if (p) {
      value.value = p.value;
      await nextTick();
      inputEl.value?.focus();
      inputEl.value?.select();
    }
  },
  { immediate: true },
);

function ok() {
  const v = value.value.trim();
  ui.resolvePrompt(v === '' ? null : v);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.prompt" class="modal-mask" @mousedown.self="ui.resolvePrompt(null)">
      <div class="prompt-panel" @keydown.enter="ok">
        <h3>{{ ui.prompt.title }}</h3>
        <label v-if="ui.prompt.label" class="prompt-label">{{ ui.prompt.label }}</label>
        <input
          ref="inputEl"
          v-model="value"
          class="input"
          :placeholder="ui.prompt.placeholder ?? ''"
          spellcheck="false"
        />
        <div class="prompt-actions">
          <button class="btn" @click="ui.resolvePrompt(null)">取消</button>
          <button class="btn primary" @click="ok">{{ ui.prompt.okText ?? '确定' }}</button>
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
  align-items: flex-start;
  justify-content: center;
  padding-top: 22vh;
  z-index: 120;
}
.prompt-panel {
  width: 420px;
  max-width: calc(100vw - 48px);
  background: var(--bg-1);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  padding: 20px 22px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  animation: pop 0.16s ease;
}
@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
}
h3 {
  margin: 0 0 14px;
  font-size: 14.5px;
}
.prompt-label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-1);
  font-size: 12.5px;
}
.input {
  width: 100%;
  padding: 8px 12px;
}
.prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.prompt-actions .btn {
  padding: 7px 16px;
}
</style>
