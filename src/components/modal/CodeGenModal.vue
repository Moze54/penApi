<script setup lang="ts">
import { computed, ref } from 'vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { useEnvStore } from '@/stores/env';
import { useUiStore } from '@/stores/ui';
import { generateCode, CODEGEN_LANGS, type CodegenLang } from '@/core/codegen';
import type { CodegenPayload } from '@/stores/ui';
import AppModal from '@/components/common/AppModal.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const workspace = useWorkspaceStore();
const env = useEnvStore();
const ui = useUiStore();

const payload = ui.modalPayload as CodegenPayload;
const tab = computed(() => workspace.tabs.find((t) => t.id === payload?.tabId));

const lang = ref<CodegenLang>('fetch');

const code = computed(() => {
  if (!tab.value) return '';
  return generateCode(tab.value.request, env.vars, lang.value);
});

async function copy() {
  if (!code.value) return;
  try {
    await navigator.clipboard.writeText(code.value);
    ui.toast('已复制代码');
  } catch {
    ui.toast('复制失败', 'error');
  }
}
</script>

<template>
  <AppModal :title="`生成代码${tab ? ' · ' + tab.title : ''}`" width="760px" @close="ui.closeModal()">
    <div class="codegen">
      <div class="lang-bar">
        <button
          v-for="l in CODEGEN_LANGS"
          :key="l.value"
          class="lang-btn"
          :class="{ on: lang === l.value }"
          @click="lang = l.value"
        >
          {{ l.label }}
        </button>
      </div>
      <pre class="code-block">{{ code || '（请求为空，无法生成）' }}</pre>
      <div class="code-hint">
        代码已按当前环境变量替换后的实际值生成；如含文件上传，表单文件需在目标代码中自行指定。
      </div>
    </div>

    <template #footer>
      <button class="btn" @click="ui.closeModal()">关闭</button>
      <button class="btn primary" :disabled="!code" @click="copy">
        <AppIcon name="copy" :size="13" /> 复制代码
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.codegen {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lang-bar {
  display: flex;
  gap: 4px;
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 3px;
  align-self: flex-start;
}
.lang-btn {
  background: transparent;
  border: none;
  color: var(--text-1);
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12.5px;
  transition: background 0.12s, color 0.12s;
}
.lang-btn:hover {
  color: var(--text-0);
}
.lang-btn.on {
  background: var(--accent-dim);
  color: var(--accent);
  font-weight: 600;
}
.code-block {
  margin: 0;
  padding: 12px 14px;
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: var(--mono);
  font-size: 12.3px;
  line-height: 1.65;
  color: var(--text-0);
  overflow: auto;
  max-height: 48vh;
  white-space: pre-wrap;
  word-break: break-all;
}
.code-hint {
  font-size: 11.5px;
  color: var(--text-2);
}
</style>
