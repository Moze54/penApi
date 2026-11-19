import { defineStore } from 'pinia';
import type { ApiNode, Project, RequestConfig } from '@/types';
import { db, SKEYS, asArray } from '@/storage/db';
import { normalizeRequest } from '@/core/normalize';
import { uid, debounce } from '@/core/util';

interface LibraryState {
  projects: Project[];
  nodes: ApiNode[];
  loaded: boolean;
  /** 当前选中的项目（侧栏高亮，导入/新建接口的默认落点） */
  activeProjectId: string;
  /** 批量选择中的节点 id */
  selection: string[];
  /** Shift 连选的锚点 */
  lastSelectedId: string;
}

export type DropPos = 'before' | 'after' | 'inside';

export const useLibraryStore = defineStore('library', {
  state: (): LibraryState => ({
    projects: [],
    nodes: [],
    loaded: false,
    activeProjectId: '',
    selection: [],
    lastSelectedId: '',
  }),

  getters: {
    activeProject(state): Project | null {
      return state.projects.find((p) => p.id === state.activeProjectId) ?? null;
    },
  },

  actions: {
    async load() {
      const [rawProjects, rawNodes] = await Promise.all([
        db.get<unknown>(SKEYS.projects, []),
        db.get<unknown>(SKEYS.nodes, []),
      ]);
      const projects = asArray<Project>(rawProjects);
      const nodes = asArray<ApiNode>(rawNodes);
      this.projects = projects ?? [];
      let fixed = !Array.isArray(rawProjects) || !Array.isArray(rawNodes);
      // 逐条归一化请求配置：修复历史版本写坏的内嵌数组（params/headers/body.form 等）
      this.nodes = (nodes ?? []).map((node) => {
        if (!node || typeof node !== 'object') {
          fixed = true;
          return node;
        }
        if (node.type !== 'request') return node;
        const norm = normalizeRequest(node.request);
        if (!norm.fixed) return node;
        fixed = true;
        return { ...node, request: norm.value };
      });
      // 恢复/校正当前项目
      if (!this.projects.some((p) => p.id === this.activeProjectId)) {
        this.activeProjectId = [...this.projects].sort((a, b) => a.order - b.order)[0]?.id ?? '';
      }
      this.loaded = true;
      // 能还原的恢复数据，不能还原的回写空值，立即落盘自愈
      if (fixed) {
        console.warn('[penapi] 检测到坏形状存储数据，已自动修复', SKEYS.projects, SKEYS.nodes);
        this.persistProjects();
        this.persistNodes();
        this.flushPersist();
      }
    },

    persistProjects() {
      queuePersistProjects(this.projects);
    },
    persistNodes() {
      queuePersistNodes(this.nodes);
    },
    /** 关键操作（批量导入等）后立即落盘，不等防抖窗口 */
    flushPersist() {
      queuePersistProjects.flush();
      queuePersistNodes.flush();
    },

    // ---- 项目 ----

    /** 选中项目（侧栏高亮 + 导入默认落点） */
    selectProject(id: string) {
      if (this.projects.some((p) => p.id === id)) this.activeProjectId = id;
    },

    /** 导入位置默认值：选中了单个文件夹时用它，否则项目根目录（返回 'root'） */
    defaultParentFor(projectId: string): string {
      if (this.selection.length !== 1) return 'root';
      const only = this.nodeById(this.selection[0]);
      return only && only.projectId === projectId && only.type === 'folder' ? only.id : 'root';
    },

    // ---- 批量选择 ----

    isSelected(id: string): boolean {
      return this.selection.includes(id);
    },

    toggleSelect(id: string) {
      if (this.selection.includes(id)) this.selection = this.selection.filter((x) => x !== id);
      else this.selection = [...this.selection, id];
      this.lastSelectedId = id;
    },

    /** Shift 连选：同一父级下从锚点到目标的范围；跨父级则只选目标 */
    selectRange(targetId: string) {
      const target = this.nodeById(targetId);
      if (!target) return;
      const anchor = this.lastSelectedId ? this.nodeById(this.lastSelectedId) : undefined;
      if (!anchor || anchor.projectId !== target.projectId || anchor.parentId !== target.parentId) {
        this.selection = [targetId];
      } else {
        const siblings = this.childrenOf(target.projectId, target.parentId).map((n) => n.id);
        const a = siblings.indexOf(anchor.id);
        const b = siblings.indexOf(targetId);
        if (a < 0 || b < 0) this.selection = [targetId];
        else {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          this.selection = siblings.slice(lo, hi + 1);
        }
      }
      this.lastSelectedId = targetId;
    },

    clearSelection() {
      this.selection = [];
      this.lastSelectedId = '';
    },

    /** 批量删除：传入的 id 连同其全部子级一起删除 */
    deleteNodes(ids: string[]) {
      const all = new Set<string>();
      for (const id of ids) {
        all.add(id);
        for (const d of this.collectDescendants(id)) all.add(d);
      }
      this.nodes = this.nodes.filter((n) => !all.has(n.id));
      this.selection = this.selection.filter((id) => !all.has(id));
      this.persistNodes();
    },

    createProject(name: string, desc = ''): Project {
      const p: Project = {
        id: uid(),
        name: name.trim() || '未命名项目',
        desc,
        order: this.projects.length,
        createdAt: Date.now(),
      };
      this.projects.push(p);
      this.activeProjectId = p.id;
      this.persistProjects();
      return p;
    },

    renameProject(id: string, name: string) {
      const p = this.projects.find((x) => x.id === id);
      if (p && name.trim()) {
        p.name = name.trim();
        this.persistProjects();
      }
    },

    deleteProject(id: string) {
      this.projects = this.projects.filter((p) => p.id !== id);
      const ids = new Set(this.nodes.filter((n) => n.projectId === id).map((n) => n.id));
      this.nodes = this.nodes.filter((n) => !ids.has(n.id));
      this.selection = this.selection.filter((nid) => !ids.has(nid));
      if (this.activeProjectId === id) {
        this.activeProjectId = [...this.projects].sort((a, b) => a.order - b.order)[0]?.id ?? '';
      }
      this.persistProjects();
      this.persistNodes();
    },

    moveProject(id: string, dir: -1 | 1) {
      const sorted = [...this.projects].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((p) => p.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= sorted.length) return;
      const [item] = sorted.splice(idx, 1);
      sorted.splice(to, 0, item);
      sorted.forEach((p, i) => (p.order = i));
      this.projects.sort((a, b) => a.order - b.order);
      this.persistProjects();
    },

    // ---- 节点 ----

    childrenOf(projectId: string, parentId: string | null): ApiNode[] {
      return this.nodes
        .filter((n) => n.projectId === projectId && n.parentId === parentId)
        .sort((a, b) => a.order - b.order);
    },

    nodeById(id: string): ApiNode | undefined {
      return this.nodes.find((n) => n.id === id);
    },

    createNode(opts: {
      projectId: string;
      parentId: string | null;
      type: ApiNode['type'];
      name: string;
      request?: RequestConfig;
    }): ApiNode {
      const node: ApiNode = {
        id: uid(),
        projectId: opts.projectId,
        parentId: opts.parentId,
        type: opts.type,
        name: opts.name.trim() || (opts.type === 'folder' ? '新建文件夹' : '未命名接口'),
        order: this.childrenOf(opts.projectId, opts.parentId).length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expanded: opts.type === 'folder' ? true : undefined,
        request: opts.request,
      };
      this.nodes.push(node);
      this.activeProjectId = opts.projectId;
      this.persistNodes();
      return node;
    },

    renameNode(id: string, name: string) {
      const n = this.nodeById(id);
      if (n && name.trim()) {
        n.name = name.trim();
        n.updatedAt = Date.now();
        this.persistNodes();
      }
    },

    updateNodeRequest(id: string, request: RequestConfig) {
      const n = this.nodeById(id);
      if (n) {
        n.request = request;
        n.updatedAt = Date.now();
        this.persistNodes();
      }
    },

    toggleExpand(id: string) {
      const n = this.nodeById(id);
      if (n && n.type === 'folder') {
        n.expanded = !n.expanded;
        this.persistNodes();
      }
    },

    deleteNode(id: string) {
      const ids = this.collectDescendants(id);
      ids.add(id);
      this.nodes = this.nodes.filter((n) => !ids.has(n.id));
      this.selection = this.selection.filter((nid) => !ids.has(nid));
      this.persistNodes();
    },

    /** 复制节点（递归复制子级），返回新节点 */
    duplicateNode(id: string): ApiNode | undefined {
      const src = this.nodeById(id);
      if (!src) return undefined;

      const copyRecursive = (node: ApiNode, parentId: string | null): ApiNode => {
        const clone: ApiNode = {
          ...JSON.parse(JSON.stringify(node)),
          id: uid(),
          parentId,
          order: this.childrenOf(node.projectId, parentId).length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        if (node.type === 'request') clone.name = `${node.name} 副本`;
        this.nodes.push(clone);
        for (const child of this.childrenOf(node.projectId, node.id)) {
          copyRecursive(child, clone.id);
        }
        return clone;
      };

      const newRoot = copyRecursive(src, src.parentId);

      // 把副本排到原节点紧后面
      const siblings = this.childrenOf(src.projectId, src.parentId);
      const fromIdx = siblings.findIndex((n) => n.id === newRoot.id);
      const toIdx = siblings.findIndex((n) => n.id === id);
      if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx + 1) {
        const [item] = siblings.splice(fromIdx, 1);
        siblings.splice(toIdx + 1, 0, item);
      }
      siblings.forEach((n, i) => (n.order = i));

      this.persistNodes();
      return newRoot;
    },

    /** 拖拽移动：pos=before/after 同级插入；inside 放入目标文件夹末尾 */
    moveNode(dragId: string, targetId: string, pos: DropPos): boolean {
      const drag = this.nodeById(dragId);
      const target = this.nodeById(targetId);
      if (!drag || !target || drag.id === target.id) return false;
      if (drag.projectId !== target.projectId) return false; // 不跨项目拖拽
      if (this.collectDescendants(dragId).has(target.id)) return false; // 不能移入自己的子级

      if (pos === 'inside' && target.type !== 'folder') pos = 'after';

      if (pos === 'inside') {
        drag.parentId = target.id;
        const children = this.childrenOf(target.projectId, target.id).filter((n) => n.id !== dragId);
        children.forEach((n, i) => (n.order = i));
        drag.order = children.length;
        if (target.type === 'folder' && !target.expanded) target.expanded = true;
      } else {
        drag.parentId = target.parentId;
        const siblings = this.childrenOf(target.projectId, target.parentId).filter(
          (n) => n.id !== dragId,
        );
        const idx = siblings.findIndex((n) => n.id === targetId);
        if (idx < 0) return false;
        siblings.splice(pos === 'before' ? idx : idx + 1, 0, drag);
        siblings.forEach((n, i) => (n.order = i));
      }
      this.persistNodes();
      return true;
    },

    /** 收集某节点的全部后代 id */
    collectDescendants(id: string): Set<string> {
      const result = new Set<string>();
      const walk = (parentId: string) => {
        for (const child of this.nodes.filter((n) => n.parentId === parentId)) {
          result.add(child.id);
          walk(child.id);
        }
      };
      walk(id);
      return result;
    },

    /** 备份导入 */
    importAll(projects: Project[], nodes: ApiNode[]) {
      this.projects = projects;
      this.nodes = nodes;
      this.selection = [];
      if (!projects.some((p) => p.id === this.activeProjectId)) {
        this.activeProjectId = [...projects].sort((a, b) => a.order - b.order)[0]?.id ?? '';
      }
      this.persistProjects();
      this.persistNodes();
    },
  },
});

const queuePersistProjects = debounce((projects: Project[]) => {
  db.set(SKEYS.projects, projects);
}, 300);
const queuePersistNodes = debounce((nodes: ApiNode[]) => {
  db.set(SKEYS.nodes, nodes);
}, 300);
