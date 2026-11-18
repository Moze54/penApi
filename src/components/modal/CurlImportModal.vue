<script setup lang="ts">
import { ref } from 'vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { useUiStore } from '@/stores/ui';
import { parseCurl } from '@/core/curl';
import type { RequestConfig } from '@/types';
import AppModal from '@/components/common/AppModal.vue';

const workspace = useWorkspaceStore();
const ui = useUiStore();

const payload = ui.modalPayload as { tabId: string };

const curlText = ref('');
const parsed = ref<RequestConfig | null>(null);
const error = ref('');

function parse() {
  error.value = '';
  parsed.value = null;
  if (!curlText.value.trim()) {
    error.value = '请先粘贴 curl 命令';
    return;
  }
  const result = parseCurl(curlText.value);
  if (result.error) {
    error.value = result.error;
    return;
  }
  parsed.value = result.request;
}

function applyToTab() {
  if (!parsed.value) return;
  const tab = workspace.tabs.find((t) => t.id === payload?.tabId);
  if (!tab) {
    ui.closeModal();
    return;
  }
  // 直接替换请求配置（保留 tab 关联关系）
  tab.request = parsed.value;
  if (tab.title === '未命名请求') {
    try {
      tab.title = new URL(parsed.value.url).host + new URL(parsed.value.url).pathname;
    } catch {
      tab.title = parsed.value.url;
    }
  }
  workspace.touch(tab.id);
  ui.closeModal();
  ui.toast('cURL 已导入到当前标签');
}
</script>

<template>
  <AppModal title="导入 cURL 命令" width="600px" @close="ui.closeModal()">
    <div class="curl-body">
      <div class="curl-hint">
        粘贴完整的 curl 命令（支持 -X / -H / -d / -F / -u 及引号、换行），解析后导入到当前标签覆盖请求配置。
      </div>
      <textarea
        v-model="curlText"
        class="input mono curl-text"
        rows="6"
        placeholder="curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{&quot;name&quot;:&quot;test&quot;}'"
        spellcheck="false"
        @keydown.enter.exact.prevent="parse"
      />
      <div v-if="error" class="curl-error">{{ error }}</div>

      <div v-if="parsed" class="curl-preview">
        <div class="preview-row">
          <span class="preview-label">解析结果</span>
          <span class="chip" :class="parsed.method.toLowerCase()">{{ parsed.method }}</span>
          <span class="preview-url mono">{{ parsed.url }}</span>
        </div>
        <div class="preview-meta">
          {{ parsed.headers.length }} 个请求头
          <template v-if="parsed.body.type === 'raw'"> · raw body {{ parsed.body.raw.length }} 字符</template>
          <template v-else-if="parsed.body.type === 'urlencoded'"> · {{ parsed.body.form.length }} 个表单字段</template>
          <template v-else-if="parsed.body.type === 'form-data'"> · form-data {{ parsed.body.form.length }} 项</template>
          <template v-if="parsed.auth.type !== 'none'"> · 含认证信息</template>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="btn" @click="ui.closeModal()">取消</button>
      <button class="btn" @click="parse">解析预览</button>
      <button class="btn primary" :disabled="!parsed" @click="applyToTab">导入到当前标签</button>
    </template>
  </AppModal>
</template>

<style scoped>
.curl-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.curl-hint {
  color: var(--text-2);
  font-size: 12px;
}
.curl-text {
  font-size: 12.3px;
  line-height: 1.5;
  white-space: pre;
}
.curl-error {
  color: var(--red);
  font-size: 12.5px;
}
.curl-preview {
  border: 1px solid var(--accent-line);
  background: var(--accent-dim);
  border-radius: 8px;
  padding: 10px 12px;
}
.preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.preview-label {
  color: var(--text-2);
  font-size: 12px;
}
.preview-url {
  flex: 1;
  font-size: 12.3px;
  color: var(--text-0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-meta {
  margin-top: 6px;
  color: var(--text-1);
  font-size: 12px;
}
</style>
