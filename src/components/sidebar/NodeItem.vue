<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useWorkspaceStore } from '@/stores/workspace';
import { useUiStore } from '@/stores/ui';
import { openCtxMenu } from '@/core/menu';
import { toCurl } from '@/core/curl';
import type { ApiNode } from '@/types';
import AppIcon from '@/components/common/AppIcon.vue';

const props = defineProps<{
  node: ApiNode;
  depth: number;
  /** 搜索模式下的可见 id 集合；null 表示非搜索模式 */
  visibleIds: Set<string> | null;
  query: string;
}>();

const library = useLibraryStore();
const workspace = useWorkspaceStore();
const ui = useUiStore();

const rowEl = ref<HTMLElement | null>(null);
const dropPos = ref<'before' | 'after' | 'inside' | null>(null);

const isFolder = computed(() => props.node.type === 'folder');
/** 搜索模式下强制展开 */
const expanded = computed(() =>
  props.visibleIds ? true : (props.node.expanded ?? false),
);
const visible = computed(() => !props.visibleIds || props.visibleIds.has(props.node.id));

const children = computed(() =>
  expanded.value && visible.value
    ? library.childrenOf(props.node.projectId, props.node.id).filter((n) => !props.visibleIds || props.visibleIds.has(n.id))
    : [],
);

const childCount = computed(() => {
  if (!isFolder.value) return 0;
  let count = 0;
  const walk = (id: string) => {
    for (const child of library.nodes.filter((n) => n.parentId === id)) {
      if (child.type === 'request') count++;
      else walk(child.id);
    }
  };
  walk(props.node.id);
  return count;
});

function openNode() {
  if (isFolder.value) {
    if (!props.visibleIds) library.toggleExpand(props.node.id);
  } else {
    workspace.openNode(props.node.id);
  }
}

function ctxMenu(e: MouseEvent) {
  const items = isFolder.value
    ? [
        { label: '新建接口', icon: 'braces', action: () => newRequestIn(props.node) },
        { label: '新建文件夹', icon: 'folder', action: () => newFolderIn(props.node) },
        { separator: true, label: '' },
        { label: '重命名', icon: 'edit', action: () => rename() },
        { label: '创建副本', icon: 'copy', action: () => duplicate() },
        { separator: true, label: '' },
        { label: '删除', icon: 'trash', danger: true, action: () => remove() },
      ]
    : [
        { label: '打开', icon: 'link', action: () => workspace.openNode(props.node.id) },
        { label: '重命名', icon: 'edit', action: () => rename() },
        { label: '创建副本', icon: 'copy', action: () => duplicate() },
        { label: '复制为 cURL', icon: 'terminal', action: () => copyCurl() },
        { separator: true, label: '' },
        { label: '删除', icon: 'trash', danger: true, action: () => remove() },
      ];
  openCtxMenu(e, items);
}

async function newRequestIn(folder: ApiNode) {
  const name = await ui.askPrompt({
    title: '新建接口',
    label: '接口名称',
    value: '',
    placeholder: '例如：查询用户信息',
    okText: '创建',
  });
  if (name == null) return;
  const node = library.createNode({
    projectId: folder.projectId,
    parentId: folder.id,
    type: 'request',
    name,
  });
  if (!folder.expanded) {
    folder.expanded = true;
    library.persistNodes();
  }
  workspace.openNode(node.id);
}

async function newFolderIn(folder: ApiNode) {
  const name = await ui.askPrompt({
    title: '新建文件夹',
    label: '文件夹名称',
    value: '',
    placeholder: '例如：用户模块',
    okText: '创建',
  });
  if (name == null) return;
  library.createNode({
    projectId: folder.projectId,
    parentId: folder.id,
    type: 'folder',
    name,
  });
}

async function rename() {
  const name = await ui.askPrompt({
    title: isFolder.value ? '重命名文件夹' : '重命名接口',
    label: '名称',
    value: props.node.name,
    okText: '保存',
  });
  if (name != null) library.renameNode(props.node.id, name);
}

function duplicate() {
  library.duplicateNode(props.node.id);
  ui.toast('已创建副本');
}

async function remove() {
  const ok = await ui.askConfirm({
    title: isFolder.value ? '删除文件夹' : '删除接口',
    message: isFolder.value
      ? `将删除「${props.node.name}」及其全部内容，该操作不可恢复。`
      : `确定删除接口「${props.node.name}」吗？`,
    okText: '删除',
    danger: true,
  });
  if (ok) {
    library.deleteNode(props.node.id);
    ui.toast('已删除');
  }
}

async function copyCurl() {
  if (!props.node.request) return;
  try {
    await navigator.clipboard.writeText(toCurl(props.node.request));
    ui.toast('已复制 cURL 命令');
  } catch {
    ui.toast('复制失败', 'error');
  }
}

// ---- 拖拽 ----

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/penapi-node', props.node.id);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('text/penapi-node')) return;
  e.preventDefault();
  const el = rowEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const ratio = (e.clientY - rect.top) / rect.height;
  const pos =
    isFolder.value
      ? ratio < 0.3
        ? 'before'
        : ratio > 0.7
          ? 'after'
          : 'inside'
      : ratio < 0.5
        ? 'before'
        : 'after';
  dropPos.value = pos;
}

function onDragLeave() {
  dropPos.value = null;
}

function onDrop(e: DragEvent) {
  const dragId = e.dataTransfer?.getData('text/penapi-node');
  const pos = dropPos.value;
  dropPos.value = null;
  if (!dragId || !pos || dragId === props.node.id) return;
  library.moveNode(dragId, props.node.id, pos);
}
</script>

<template>
  <div v-if="visible" class="node-item">
    <div
      ref="rowEl"
      class="node-row"
      :class="[
        { folder: isFolder, active: workspace.active?.nodeId === node.id },
        dropPos ? `drop-${dropPos}` : '',
      ]"
      :style="{ paddingLeft: 8 + depth * 14 + 'px' }"
      draggable="true"
      @click="openNode"
      @contextmenu="ctxMenu"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <span class="node-chevron" :class="{ open: expanded }" v-if="isFolder">
        <AppIcon name="chevron-right" :size="12" />
      </span>
      <span v-else class="node-chevron no-icon" />
      <span class="chip method" v-if="node.request && node.request.kind === 'http'">
        {{ node.request.method }}
      </span>
      <span class="chip method ws" v-else-if="node.request && node.request.kind === 'ws'">WS</span>
      <AppIcon v-if="isFolder" name="folder" :size="14" class="node-icon" />
      <span class="node-name" :title="node.name">{{ node.name }}</span>
      <span v-if="isFolder && childCount" class="node-count">{{ childCount }}</span>
    </div>

    <NodeItem
      v-for="child in children"
      :key="child.id"
      :node="child"
      :depth="depth + 1"
      :visible-ids="visibleIds"
      :query="query"
    />
  </div>
</template>

<style scoped>
.node-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding-right: 8px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-1);
  border: 1px solid transparent;
  user-select: none;
  position: relative;
}
.node-row:hover {
  background: var(--bg-2);
  color: var(--text-0);
}
.node-row.active {
  background: var(--accent-dim);
  color: var(--text-0);
}
.node-row.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2.5px;
  border-radius: 2px;
  background: var(--accent);
}
.node-row.active .node-name {
  color: var(--text-0);
  font-weight: 600;
}
.node-chevron {
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  transition: transform 0.12s;
  flex-shrink: 0;
}
.node-chevron.open {
  transform: rotate(90deg);
}
.node-chevron.no-icon {
  visibility: hidden;
}
.node-icon {
  color: var(--text-2);
}
.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.8px;
  min-width: 0;
}
.node-count {
  font-size: 11px;
  color: var(--text-2);
}
.node-row .chip.method {
  flex-shrink: 0;
  font-size: 10px;
  padding: 0 5px;
}

/* 拖拽指示 */
.node-row.drop-before {
  border-top: 2px solid var(--accent);
}
.node-row.drop-after {
  border-bottom: 2px solid var(--accent);
}
.node-row.drop-inside {
  background: var(--accent-dim);
  border-color: var(--accent-line);
}
</style>
