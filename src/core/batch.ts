// 侧栏批量操作：导出选中接口为 JSON（与「JSON 导入」格式互通）、批量删除
import type { ApiNode } from '@/types';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { persistClone } from './request';

/** 与 importer.parseImportJson 兼容的导出条目 */
export interface ExportItem {
  name: string;
  kind: 'http' | 'ws';
  method: string;
  url: string;
  params: { key: string; value: string; enabled: boolean }[];
  headers: { key: string; value: string; enabled: boolean }[];
  body: {
    type: string;
    rawType: string;
    raw: string;
    form: { key: string; value: string; enabled: boolean; type: string }[];
  };
  auth: { type: string; token: string; username: string; password: string };
  folder?: string;
}

/** 最近的文件夹祖先名称（导入时按名称自动建分组） */
function folderOf(node: ApiNode, all: ApiNode[]): string | undefined {
  let parentId = node.parentId;
  let depth = 0;
  while (parentId && depth < 20) {
    const parent = all.find((n) => n.id === parentId);
    if (!parent) break;
    if (parent.type === 'folder') return parent.name;
    parentId = parent.parentId;
    depth++;
  }
  return undefined;
}

/** 展开选中节点（文件夹递归取全部接口），生成导出条目 */
export function buildExportItems(selected: ApiNode[], all: ApiNode[]): ExportItem[] {
  const seen = new Set<string>();
  const requests: ApiNode[] = [];
  const walk = (node: ApiNode) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    if (node.type === 'request' && node.request) requests.push(node);
    for (const child of all.filter((n) => n.parentId === node.id).sort((a, b) => a.order - b.order)) {
      walk(child);
    }
  };
  for (const node of selected) walk(node);

  return requests.map((node) => {
    const r = persistClone(node.request as NonNullable<typeof node.request>);
    return {
      name: node.name,
      kind: r.kind,
      method: r.method,
      url: r.url,
      params: r.params.map(({ key, value, enabled }) => ({ key, value, enabled })),
      headers: r.headers.map(({ key, value, enabled }) => ({ key, value, enabled })),
      body: {
        type: r.body.type,
        rawType: r.body.rawType,
        raw: r.body.raw,
        form: r.body.form.map(({ key, value, enabled, type }) => ({ key, value, enabled, type })),
      },
      auth: { ...r.auth },
      folder: folderOf(node, all),
    };
  });
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 导出当前选中的接口为 JSON 文件，返回导出数量 */
export function exportSelectionJson(): number {
  const library = useLibraryStore();
  const ui = useUiStore();
  const nodes = library.selection
    .map((id) => library.nodeById(id))
    .filter((n): n is ApiNode => !!n);
  const items = buildExportItems(nodes, library.nodes);
  if (!items.length) {
    ui.toast('选中的内容里没有接口', 'error');
    return 0;
  }
  const project = library.activeProject?.name || 'penapi';
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadJson(`${project}-接口-${stamp}.json`, items);
  ui.toast(`已导出 ${items.length} 个接口`);
  return items.length;
}

/** 批量删除当前选中（文件夹连同类容一起删），带确认 */
export async function deleteSelection(): Promise<void> {
  const library = useLibraryStore();
  const ui = useUiStore();
  const total = library.selection.length;
  if (!total) return;
  const ok = await ui.askConfirm({
    title: '删除选中内容',
    message: `将删除选中的 ${total} 项（文件夹会连同其内全部接口），该操作不可恢复。`,
    okText: '删除',
    danger: true,
  });
  if (!ok) return;
  library.deleteNodes([...library.selection]);
  library.clearSelection();
  ui.toast('已删除选中内容');
}
