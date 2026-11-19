<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useWorkspaceStore } from '@/stores/workspace';
import { useUiStore } from '@/stores/ui';
import { openCtxMenu } from '@/core/menu';
import { newRequest } from '@/core/request';
import { exportSelectionJson, deleteSelection } from '@/core/batch';
import type { Project } from '@/types';
import AppIcon from '@/components/common/AppIcon.vue';
import NodeItem from './NodeItem.vue';

const library = useLibraryStore();
const workspace = useWorkspaceStore();
const ui = useUiStore();

const search = ref('');
const importBtn = ref<HTMLElement | null>(null);

// Esc 取消批量选择
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && library.selection.length) library.clearSelection();
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

function importMenu() {
  const rect = (importBtn.value as HTMLElement).getBoundingClientRect();
  openCtxMenu({ clientX: rect.left, clientY: rect.bottom + 4 } as MouseEvent, [
    {
      label: 'JSON 导入',
      icon: 'braces',
      action: () => ui.openModal('import-apis'),
    },
    {
      label: 'Postman 导入',
      icon: 'upload',
      action: () => ui.openModal('postman-import'),
    },
    {
      label: '页面抓包导入',
      icon: 'globe',
      action: () => ui.openModal('capture'),
    },
  ]);
}

/** 搜索模式：名称或 URL 匹配的节点 + 其祖先 */
const visibleIds = computed(() => {
  const kw = search.value.trim().toLowerCase();
  if (!kw) return null;
  const ids = new Set<string>();
  for (const n of library.nodes) {
    const hit =
      n.name.toLowerCase().includes(kw) ||
      (n.request?.url ?? '').toLowerCase().includes(kw);
    if (hit) {
      ids.add(n.id);
      let p = n.parentId;
      while (p) {
        ids.add(p);
        p = library.nodeById(p)?.parentId ?? null;
      }
    }
  }
  return ids;
});

const sortedProjects = computed(() =>
  [...library.projects].sort((a, b) => a.order - b.order),
);

const projectsWithMatch = computed(() => {
  const ids = visibleIds.value;
  if (!ids) return sortedProjects.value;
  return sortedProjects.value.filter((p) =>
    library.nodes.some((n) => n.projectId === p.id && ids.has(n.id)),
  );
});

function toggleProject(project: Project) {
  project.expanded = project.expanded === false;
  library.persistProjects();
}

function projectCtx(e: MouseEvent, project: Project) {
  openCtxMenu(e, [
    {
      label: '新建接口',
      icon: 'braces',
      action: () => createRequestIn(project.id, null),
    },
    {
      label: '新建文件夹',
      icon: 'folder',
      action: () => createFolderIn(project.id, null),
    },
    { separator: true, label: '' },
    { label: '上移', icon: 'chevron-down', action: () => library.moveProject(project.id, -1) },
    { label: '下移', icon: 'chevron-right', action: () => library.moveProject(project.id, 1) },
    { separator: true, label: '' },
    { label: '重命名', icon: 'edit', action: () => renameProject(project) },
    { label: '删除项目', icon: 'trash', danger: true, action: () => removeProject(project) },
  ]);
}

async function createRequestIn(projectId: string, parentId: string | null, name?: string) {
  let finalName: string | null = name ?? null;
  if (finalName == null) {
    finalName = await ui.askPrompt({
      title: '新建接口',
      label: '接口名称',
      value: '',
      placeholder: '例如：查询用户信息',
      okText: '创建',
    });
    if (finalName == null) return;
  }
  const node = library.createNode({ projectId, parentId, type: 'request', name: finalName, request: newRequest() });
  workspace.openNode(node.id);
}

async function createFolderIn(projectId: string, parentId: string | null) {
  const name = await ui.askPrompt({
    title: '新建文件夹',
    label: '文件夹名称',
    value: '',
    placeholder: '例如：用户模块',
    okText: '创建',
  });
  if (name == null) return;
  library.createNode({ projectId, parentId, type: 'folder', name });
}

async function renameProject(project: Project) {
  const name = await ui.askPrompt({
    title: '重命名项目',
    label: '项目名称',
    value: project.name,
    okText: '保存',
  });
  if (name != null) library.renameProject(project.id, name);
}

async function removeProject(project: Project) {
  const count = library.nodes.filter((n) => n.projectId === project.id).length;
  const ok = await ui.askConfirm({
    title: '删除项目',
    message: `将删除项目「${project.name}」及其 ${count} 个接口/文件夹，该操作不可恢复。`,
    okText: '删除',
    danger: true,
  });
  if (ok) {
    library.deleteProject(project.id);
    ui.toast('项目已删除');
  }
}

async function newProject() {
  const name = await ui.askPrompt({
    title: '新建项目',
    label: '项目名称',
    value: '',
    placeholder: '例如：商城后端',
    okText: '创建',
  });
  if (name == null) return;
  library.createProject(name);
  ui.toast('项目已创建');
}
</script>

<template>
  <div class="project-list">
    <div class="search-box">
      <AppIcon name="search" :size="14" />
      <input v-model="search" class="input search-input" placeholder="搜索接口名称 / URL" spellcheck="false" />
    </div>

    <div class="tree-area" @click.self="library.clearSelection()">
      <div v-if="projectsWithMatch.length === 0" class="tree-empty">
        <template v-if="search">
          <span>未找到匹配的接口</span>
        </template>
        <template v-else>
          <AppIcon name="book" :size="30" />
          <span>还没有项目</span>
          <span class="tree-empty-sub">点击下方「新建项目」开始</span>
        </template>
      </div>

      <div v-for="project in projectsWithMatch" :key="project.id" class="project-block">
        <div
          class="project-head"
          :class="{ on: library.activeProjectId === project.id }"
          @click="library.selectProject(project.id)"
          @contextmenu="projectCtx($event, project)"
        >
          <button class="proj-toggle" :class="{ open: project.expanded !== false }" @click.stop="toggleProject(project)">
            <AppIcon name="chevron-right" :size="12" />
          </button>
          <span class="proj-name" :title="project.desc || project.name">{{ project.name }}</span>
          <button
            class="btn ghost icon-only proj-more"
            title="项目操作"
            @click.stop="projectCtx($event, project)"
          >
            <AppIcon name="more" :size="14" />
          </button>
        </div>

        <div
          v-show="project.expanded !== false"
          class="project-children"
          @drop.prevent
        >
          <NodeItem
            v-for="root in library.childrenOf(project.id, null).filter((n) => !visibleIds || visibleIds.has(n.id))"
            :key="root.id"
            :node="root"
            :depth="0"
            :visible-ids="visibleIds"
            :query="search"
          />
          <div
            v-if="library.childrenOf(project.id, null).length === 0 && !search"
            class="proj-empty"
            @dblclick="createRequestIn(project.id, null)"
          >
            空项目 · 右键或双击新建接口
          </div>
        </div>
      </div>
    </div>

    <div v-if="library.selection.length" class="sel-bar">
      <span class="sel-count">已选 {{ library.selection.length }} 项</span>
      <button class="btn small" title="导出为可回导的 JSON 文件" @click="exportSelectionJson">
        <AppIcon name="download" :size="12" /> 导出
      </button>
      <button class="btn small sel-danger" title="删除选中内容" @click="deleteSelection">
        <AppIcon name="trash" :size="12" /> 删除
      </button>
      <button class="btn small ghost" title="取消选择（Esc）" @click="library.clearSelection()">取消</button>
    </div>

    <div class="sidebar-actions">
      <button class="btn small" @click="newProject">
        <AppIcon name="plus" :size="13" /> 新建项目
      </button>
      <button class="btn small" :disabled="!library.projects.length" @click="() => { const p = library.activeProject ?? projectsWithMatch[0]; if (p) createRequestIn(p.id, null); }">
        <AppIcon name="braces" :size="13" /> 新建接口
      </button>
      <button class="btn small" @click="workspace.openNewRequest('ws')">
        <AppIcon name="bolt" :size="13" /> WebSocket
      </button>
      <button
        ref="importBtn"
        class="btn small"
        :disabled="!library.projects.length"
        title="导入接口：JSON 格式 / Postman 集合"
        @click="importMenu"
      >
        <AppIcon name="download" :size="13" /> 导入
      </button>
    </div>
  </div>
</template>

<style scoped>
.project-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 10px 12px 8px;
  color: var(--text-2);
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  padding: 5px 9px;
  font-size: 12.5px;
}
.tree-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 8px;
}
.sidebar-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg-1);
}
.tree-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-2);
  padding: 42px 12px;
  text-align: center;
}
.tree-empty-sub {
  font-size: 12px;
}
.project-block {
  margin-top: 4px;
}
.project-head {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px 4px 4px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-0);
  font-weight: 600;
  font-size: 12.8px;
  user-select: none;
}
.project-head:hover {
  background: var(--bg-2);
}
.project-head.on {
  background: var(--accent-dim);
  box-shadow: inset 2.5px 0 0 var(--accent);
}
.project-head.on:hover {
  background: var(--accent-dim);
}
.sel-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg-2);
  flex-shrink: 0;
}
.sel-count {
  flex: 1;
  font-size: 12px;
  color: var(--text-1);
  white-space: nowrap;
}
.sel-bar .btn {
  padding: 4px 8px;
  font-size: 11.5px;
}
.sel-danger:hover {
  color: var(--red);
  border-color: rgba(255, 107, 107, 0.4);
}
.proj-toggle {
  background: transparent;
  border: none;
  color: var(--text-2);
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  transition: transform 0.12s;
}
.proj-toggle.open {
  transform: rotate(90deg);
}
.proj-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.proj-more {
  opacity: 0;
}
.project-head:hover .proj-more {
  opacity: 1;
}
.project-children {
  padding-left: 6px;
}
.proj-empty {
  color: var(--text-2);
  font-size: 12px;
  padding: 8px 10px;
}
.sidebar-actions .btn {
  min-width: 0;
  padding: 6px 6px;
  font-size: 12px;
  justify-content: center;
  white-space: nowrap;
  overflow: hidden;
}
</style>
