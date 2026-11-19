<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { parseImportJson, IMPORT_EXAMPLE, type ParseResult } from '@/core/importer';
import type { RequestConfig } from '@/types';
import AppModal from '@/components/common/AppModal.vue';
import Dropdown from '@/components/common/Dropdown.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const library = useLibraryStore();
const ui = useUiStore();

const sortedProjects = computed(() => [...library.projects].sort((a, b) => a.order - b.order));
// 默认导入到侧栏当前选中的项目；若选中了单个文件夹，默认位置为该文件夹
const defaultProjectId =
  library.activeProjectId && sortedProjects.value.some((p) => p.id === library.activeProjectId)
    ? library.activeProjectId
    : sortedProjects.value[0]?.id ?? '';
const projectId = ref(defaultProjectId);
const parentId = ref(library.defaultParentFor(defaultProjectId));

const projectOptions = computed(() => sortedProjects.value.map((p) => ({ value: p.id, label: p.name })));
const folderOptions = computed(() => [
  { value: 'root', label: '根目录' },
  ...library
    .childrenOf(projectId.value, null)
    .filter((n) => n.type === 'folder')
    .map((f) => ({ value: f.id, label: f.name })),
]);

const text = ref('');
const parsed = ref<ParseResult | null>(null);
const showExample = ref(false);

function onProjectChange() {
  parentId.value = 'root';
  parsed.value = null;
}

function doParse() {
  parsed.value = parseImportJson(text.value);
}

// 输入 / 粘贴后自动解析（防抖），粘贴完即可直接导入
let parseTimer: number | undefined;
watch(text, (v) => {
  if (parseTimer) window.clearTimeout(parseTimer);
  if (!v.trim()) {
    parsed.value = null;
    return;
  }
  parseTimer = window.setTimeout(() => {
    parsed.value = parseImportJson(text.value);
  }, 250);
});
onUnmounted(() => {
  if (parseTimer) window.clearTimeout(parseTimer);
});

const importable = computed(() => (parsed.value?.items.length ?? 0) > 0);

function chipClass(kind: 'http' | 'ws', method: string): string {
  return kind === 'ws' ? 'ws' : method.toLowerCase();
}

function doImport() {
  const result = parsed.value;
  if (!result || !result.items.length) return;
  if (!projectId.value) {
    ui.toast('请先创建项目', 'error');
    return;
  }
  const baseParent = parentId.value === 'root' ? null : parentId.value;
  // 展开目标文件夹，导入后立即可见
  if (baseParent) {
    const target = library.nodeById(baseParent);
    if (target && target.type === 'folder' && !target.expanded) target.expanded = true;
  }

  let created = 0;
  for (const item of result.items) {
    let parent = baseParent;
    // JSON 的 folder 字段：在所选位置下按名称复用/创建子文件夹
    if (item.folder) {
      const existing = library
        .childrenOf(projectId.value, parent)
        .find((n) => n.type === 'folder' && n.name === item.folder);
      if (existing) {
        parent = existing.id;
      } else {
        const folder = library.createNode({
          projectId: projectId.value,
          parentId: parent,
          type: 'folder',
          name: item.folder,
        });
        folder.expanded = true;
        parent = folder.id;
      }
    }
    const request: RequestConfig = {
      kind: item.kind,
      method: item.method,
      url: item.url,
      params: item.params,
      headers: item.headers,
      body: item.body,
      auth: item.auth,
    };
    library.createNode({
      projectId: projectId.value,
      parentId: parent,
      type: 'request',
      name: item.name,
      request,
    });
    created++;
  }

  // 批量导入是关键操作，立即落盘，不等防抖窗口
  library.flushPersist();
  ui.closeModal();
  ui.toast(`已导入 ${created} 个接口` + (result.issues.length ? `，跳过 ${result.issues.length} 条异常项` : ''));
}
</script>

<template>
  <AppModal title="JSON 导入接口" width="640px" @close="ui.closeModal()">
    <div v-if="sortedProjects.length" class="import-form">
      <div class="loc-row">
        <label class="field">
          <span class="field-label">项目</span>
          <Dropdown v-model="projectId" :options="projectOptions" width="100%" @update:model-value="onProjectChange" />
        </label>
        <label class="field">
          <span class="field-label">位置</span>
          <Dropdown v-model="parentId" :options="folderOptions" width="100%" />
        </label>
      </div>

      <textarea
        v-model="text"
        class="input json-text"
        placeholder='粘贴 JSON：单个接口对象，或接口对象数组'
        spellcheck="false"
      />

      <div class="parse-bar">
        <button class="btn small" @click="doParse">
          <AppIcon name="braces" :size="13" /> 解析预览
        </button>
        <button class="btn small ghost" @click="showExample = !showExample">
          {{ showExample ? '收起示例' : '格式示例' }}
        </button>
        <span v-if="parsed" class="parse-count">
          可导入 {{ parsed.items.length }} 个 · 异常 {{ parsed.issues.length }} 条
        </span>
      </div>

      <pre v-if="showExample" class="example-block">{{ IMPORT_EXAMPLE }}</pre>

      <div v-if="parsed" class="preview">
        <template v-for="(it, i) in parsed.items" :key="i">
          <div class="preview-row">
            <span class="chip" :class="chipClass(it.kind, it.method)">{{ it.kind === 'ws' ? 'WS' : it.method }}</span>
            <span class="preview-name">{{ it.name }}</span>
            <span class="preview-url">{{ it.url }}</span>
            <span v-if="it.folder" class="preview-folder">→ {{ it.folder }}</span>
          </div>
          <div v-if="it.warnings.length" class="preview-warn">{{ it.warnings.join('；') }}</div>
        </template>
        <div v-for="(iss, i) in parsed.issues" :key="'e' + i" class="preview-row issue">
          <AppIcon name="alert" :size="13" />
          <span class="issue-text">{{ iss.name }}：{{ iss.message }}</span>
        </div>
      </div>
    </div>
    <div v-else class="no-project">还没有项目，请先在左侧「新建项目」。</div>

    <template #footer>
      <button class="btn" @click="ui.closeModal()">取消</button>
      <button class="btn primary" :disabled="!importable" @click="doImport">
        导入{{ importable ? ` ${parsed!.items.length} 个接口` : '' }}
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.import-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.loc-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.field-label {
  width: 36px;
  color: var(--text-1);
  font-size: 12.5px;
  flex-shrink: 0;
  text-align: right;
}
.field :deep(.dd-root) {
  flex: 1;
  min-width: 0;
}
.field :deep(.dd-trigger) {
  width: 100%;
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
.example-block {
  margin: 0;
  padding: 10px 12px;
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: var(--mono);
  font-size: 11.8px;
  line-height: 1.55;
  color: var(--text-1);
  overflow: auto;
  max-height: 200px;
  white-space: pre-wrap;
}
.preview {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-0);
  padding: 6px 8px;
  max-height: 210px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 12.5px;
  min-width: 0;
}
.preview-row .chip {
  flex-shrink: 0;
  min-width: 46px;
  justify-content: center;
  font-size: 10.5px;
  padding: 1px 6px;
}
.preview-name {
  color: var(--text-0);
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 34%;
  flex-shrink: 0;
}
.preview-url {
  font-family: var(--mono);
  font-size: 11.8px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.preview-folder {
  color: var(--accent);
  font-size: 11.5px;
  flex-shrink: 0;
}
.preview-warn {
  padding: 0 6px 4px 62px;
  font-size: 11.5px;
  color: var(--orange);
}
.preview-row.issue {
  color: var(--red);
  font-size: 12px;
}
.issue-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.no-project {
  color: var(--text-2);
  text-align: center;
  padding: 16px 0;
}
</style>
