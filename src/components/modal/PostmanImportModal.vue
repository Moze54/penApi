<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { parsePostmanCollection, type PostmanNode, type PostmanParseResult } from '@/core/postman';
import { persistClone } from '@/core/request';
import AppModal from '@/components/common/AppModal.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const library = useLibraryStore();
const ui = useUiStore();

const text = ref('');
const parsed = ref<PostmanParseResult | null>(null);
const projectName = ref('');
/** 上次自动填充的项目名，用户手改后不再覆盖 */
let lastAutoName = '';

function applyParse(r: PostmanParseResult) {
  parsed.value = r;
  if (!projectName.value.trim() || projectName.value === lastAutoName) {
    projectName.value = r.name;
    lastAutoName = r.name;
  }
}

function doParse() {
  applyParse(parsePostmanCollection(text.value));
}

// 输入 / 粘贴后自动解析（防抖）
let parseTimer: number | undefined;
watch(text, (v) => {
  if (parseTimer) window.clearTimeout(parseTimer);
  if (!v.trim()) {
    parsed.value = null;
    return;
  }
  parseTimer = window.setTimeout(() => {
    applyParse(parsePostmanCollection(text.value));
  }, 250);
});
onUnmounted(() => {
  if (parseTimer) window.clearTimeout(parseTimer);
});

const importable = computed(() => (parsed.value?.requestCount ?? 0) > 0);

function doImport() {
  const r = parsed.value;
  if (!r || !r.requestCount) return;
  const pname = projectName.value.trim() || r.name;
  const project = library.createProject(pname);

  const create = (nodes: PostmanNode[], parentId: string | null) => {
    for (const n of nodes) {
      if (n.type === 'folder') {
        const folder = library.createNode({
          projectId: project.id,
          parentId,
          type: 'folder',
          name: n.name,
        });
        create(n.children ?? [], folder.id);
      } else if (n.request) {
        library.createNode({
          projectId: project.id,
          parentId,
          type: 'request',
          name: n.name,
          request: persistClone(n.request),
        });
      }
    }
  };
  create(r.nodes, null);

  ui.closeModal();
  ui.toast(`已导入项目「${pname}」：${r.requestCount} 个接口 · ${r.folderCount} 个文件夹`);
}
</script>

<template>
  <AppModal title="导入 Postman 集合" width="640px" @close="ui.closeModal()">
    <div class="pm-form">
      <textarea
        v-model="text"
        class="input json-text"
        placeholder="粘贴 Postman 导出的 Collection JSON（v2.1 格式）"
        spellcheck="false"
      />

      <div class="parse-bar">
        <button class="btn small" @click="doParse">
          <AppIcon name="braces" :size="13" /> 解析预览
        </button>
        <span v-if="parsed" class="parse-count">
          接口 {{ parsed.requestCount }} 个 · 文件夹 {{ parsed.folderCount }} 个 · 提示
          {{ parsed.issues.length }} 条
        </span>
      </div>

      <template v-if="parsed">
        <label class="field">
          <span class="field-label">项目名</span>
          <input
            v-model="projectName"
            class="input"
            placeholder="导入后的项目名称"
            spellcheck="false"
            @keydown.enter="importable && doImport()"
          />
        </label>
        <div v-if="parsed.issues.length" class="issue-list">
          <div v-for="(iss, i) in parsed.issues" :key="i" class="issue-row">
            <AppIcon name="alert" :size="12" />
            <span>{{ iss }}</span>
          </div>
        </div>
        <div v-if="importable" class="ok-note">
          将以新项目「{{ projectName.trim() || parsed.name }}」导入，原文件夹层级完整保留。
        </div>
      </template>

      <div class="fmt-hint">
        获取方式：Postman → 集合右侧「…」→ Export → 选择 Collection v2.1 → 复制导出的 JSON 内容粘贴到这里。
      </div>
    </div>

    <template #footer>
      <button class="btn" @click="ui.closeModal()">取消</button>
      <button class="btn primary" :disabled="!importable" @click="doImport">
        导入{{ importable ? ` ${parsed!.requestCount} 个接口` : '' }}
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.pm-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.json-text {
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.6;
  min-height: 150px;
  resize: vertical;
}
.parse-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.parse-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-1);
}
.field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.field-label {
  width: 48px;
  color: var(--text-1);
  font-size: 12.5px;
  flex-shrink: 0;
  text-align: right;
}
.field .input {
  flex: 1;
  padding: 7px 10px;
}
.issue-list {
  border: 1px solid rgba(255, 182, 72, 0.25);
  background: rgba(255, 182, 72, 0.06);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 110px;
  overflow-y: auto;
}
.issue-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.8px;
  color: var(--orange);
}
.ok-note {
  font-size: 12px;
  color: var(--green);
}
.fmt-hint {
  font-size: 11.5px;
  color: var(--text-2);
}
</style>
