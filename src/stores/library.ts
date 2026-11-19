import { defineStore } from 'pinia';
import type { ApiNode, Project, RequestConfig } from '@/types';
import { db, SKEYS } from '@/storage/db';
import { uid, debounce } from '@/core/util';

interface LibraryState {
  projects: Project[];
  nodes: ApiNode[];
  loaded: boolean;
}

export type DropPos = 'before' | 'after' | 'inside';

export const useLibraryStore = defineStore('library', {
  state: (): LibraryState => ({
    projects: [],
    nodes: [],
    loaded: false,
  }),

  actions: {
    async load() {
      const [projects, nodes] = await Promise.all([
        db.get<Project[]>(SKEYS.projects, []),
        db.get<ApiNode[]>(SKEYS.nodes, []),
      ]);
      this.projects = projects;
      this.nodes = nodes;
      this.loaded = true;
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

    createProject(name: string, desc = ''): Project {
      const p: Project = {
        id: uid(),
        name: name.trim() || '未命名项目',
        desc,
        order: this.projects.length,
        createdAt: Date.now(),
      };
      this.projects.push(p);
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
