<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useWorkspaceStore } from '@/stores/workspace';
import { useUiStore } from '@/stores/ui';
import { persistClone } from '@/core/request';
import AppModal from '@/components/common/AppModal.vue';
import Dropdown from '@/components/common/Dropdown.vue';
import type { SaveRequestPayload } from '@/stores/ui';

const library = useLibraryStore();
const workspace = useWorkspaceStore();
const ui = useUiStore();

const payload = ui.modalPayload as SaveRequestPayload;
const tab = computed(() => workspace.tabs.find((t) => t.id === payload?.tabId));

const sortedProjects = computed(() => [...library.projects].sort((a, b) => a.order - b.order));

const projectId = ref(sortedProjects.value[0]?.id ?? '');
const parentId = ref<string>('root');
const name = ref(tab.value?.title ?? '');

/** 当前选中项目下的文件夹（含根目录项） */
const folders = computed(() =>
  library
    .childrenOf(projectId.value, null)
    .filter((n) => n.type === 'folder'),
);

const projectOptions = computed(() => sortedProjects.value.map((p) => ({ value: p.id, label: p.name })));
const folderOptions = computed(() => [
  { value: 'root', label: '根目录' },
  ...folders.value.map((f) => ({ value: f.id, label: f.name })),
]);

function onProjectChange() {
  parentId.value = 'root';
}

function save() {
  if (!tab.value) {
    ui.closeModal();
    return;
  }
  if (!name.value.trim()) {
    ui.toast('请输入接口名称', 'error');
    return;
  }
  if (!projectId.value) {
    ui.toast('请先创建项目', 'error');
    return;
  }
  const node = library.createNode({
    projectId: projectId.value,
    parentId: parentId.value === 'root' ? null : parentId.value,
    type: 'request',
    name: name.value,
    request: persistClone(tab.value.request),
  });
  workspace.attachToNode(tab.value.id, node.id);
  ui.closeModal();
  ui.toast('已保存到接口库');
}
</script>

<template>
  <AppModal title="保存接口" width="460px" @close="ui.closeModal()">
    <div class="save-form" v-if="sortedProjects.length">
      <label class="field">
        <span class="field-label">项目</span>
        <Dropdown v-model="projectId" :options="projectOptions" width="100%" @update:model-value="onProjectChange" />
      </label>
      <label class="field">
        <span class="field-label">位置</span>
        <Dropdown v-model="parentId" :options="folderOptions" width="100%" />
      </label>
      <label class="field">
        <span class="field-label">名称</span>
        <input v-model="name" class="input" placeholder="接口名称" spellcheck="false" @keydown.enter="save" />
      </label>
    </div>
    <div v-else class="no-project">还没有项目，请先在左侧「新建项目」。</div>

    <template #footer>
      <button class="btn" @click="ui.closeModal()">取消</button>
      <button class="btn primary" :disabled="!sortedProjects.length" @click="save">保存</button>
    </template>
  </AppModal>
</template>

<style scoped>
.save-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
.field :deep(.dd-root) {
  flex: 1;
  min-width: 0;
}
.field :deep(.dd-trigger) {
  width: 100%;
  padding: 7px 10px;
}
.no-project {
  color: var(--text-2);
  text-align: center;
  padding: 16px 0;
}
</style>
