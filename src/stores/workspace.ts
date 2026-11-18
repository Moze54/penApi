import { defineStore } from 'pinia';
import type { HistoryRecord, TabItem, WsMessage } from '@/types';
import { useLibraryStore } from './library';
import { useEnvStore } from './env';
import { useHistoryStore } from './history';
import { useSettingsStore } from './settings';
import { useUiStore } from './ui';
import { cloneRequest, newRequest, persistClone } from '@/core/request';
import { sendRequest } from '@/core/requester';
import { ensureAssertFields, runAssertions, runExtracts } from '@/core/assert';
import { WsClient } from '@/core/ws';
import { uid } from '@/core/util';

interface WorkspaceState {
  tabs: TabItem[];
  activeId: string | null;
}

/** WebSocket 客户端为不可序列化对象，挂在模块级 Map */
const wsClients = new Map<string, WsClient>();

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.host + u.pathname;
  } catch {
    return url || '未命名请求';
  }
}

export const useWorkspaceStore = defineStore('workspace', {
  state: (): WorkspaceState => ({
    tabs: [],
    activeId: null,
  }),

  getters: {
    active(state): TabItem | undefined {
      return state.tabs.find((t) => t.id === state.activeId);
    },
  },

  actions: {
    // ---- 打开标签 ----

    openNode(nodeId: string) {
      const library = useLibraryStore();
      const node = library.nodeById(nodeId);
      if (!node || node.type !== 'request') return;

      const existing = this.tabs.find((t) => t.nodeId === node.id);
      if (existing) {
        this.activeId = existing.id;
        return;
      }
      const request = cloneRequest(node.request ?? newRequest());
      ensureAssertFields(request);
      const tab: TabItem = {
        id: uid(),
        kind: request.kind,
        title: node.name,
        nodeId: node.id,
        dirty: false,
        request,
        sending: false,
      };
      if (request.kind === 'ws') {
        tab.ws = { status: 'idle', url: request.url, messages: [] };
      }
      this.tabs.push(tab);
      this.activeId = tab.id;
    },

    openNewRequest(kind: 'http' | 'ws') {
      const tab: TabItem = {
        id: uid(),
        kind,
        title: kind === 'ws' ? 'WebSocket 调试' : '未命名请求',
        nodeId: null,
        dirty: false,
        request: newRequest(kind),
        sending: false,
      };
      if (kind === 'ws') {
        tab.ws = { status: 'idle', url: '', messages: [] };
      }
      this.tabs.push(tab);
      this.activeId = tab.id;
    },

    openHistoryRecord(rec: HistoryRecord) {
      const request = cloneRequest(rec.request);
      ensureAssertFields(request);
      const tab: TabItem = {
        id: uid(),
        kind: rec.request.kind,
        title: rec.name || hostOf(rec.request.url),
        nodeId: null,
        dirty: false,
        request,
        response: rec.response,
        sending: false,
      };
      if (tab.kind === 'ws') {
        tab.ws = { status: 'idle', url: rec.request.url, messages: [] };
      }
      this.tabs.push(tab);
      this.activeId = tab.id;
    },

    setActive(id: string) {
      this.activeId = id;
    },

    closeTab(id: string) {
      const client = wsClients.get(id);
      if (client) {
        client.close();
        wsClients.delete(id);
      }
      const idx = this.tabs.findIndex((t) => t.id === id);
      if (idx < 0) return;
      this.tabs.splice(idx, 1);
      if (this.activeId === id) {
        const next = this.tabs[idx] ?? this.tabs[idx - 1];
        this.activeId = next?.id ?? null;
      }
    },

    closeOthers(id: string) {
      this.tabs = this.tabs.filter((t) => t.id === id);
      wsClients.forEach((client, key) => {
        if (!this.tabs.some((t) => t.id === key)) {
          client.close();
          wsClients.delete(key);
        }
      });
      this.activeId = id;
    },

    touch(id: string) {
      const tab = this.tabs.find((t) => t.id === id);
      if (tab) tab.dirty = true;
    },

    setTitle(id: string, title: string) {
      const tab = this.tabs.find((t) => t.id === id);
      if (tab) tab.title = title;
    },

    /** tab 已关联节点时直接保存回接口树 */
    saveToNode(tab: TabItem): boolean {
      if (!tab.nodeId) return false;
      useLibraryStore().updateNodeRequest(tab.nodeId, persistClone(tab.request));
      tab.dirty = false;
      return true;
    },

    /** 保存后关联新节点（另存为） */
    attachToNode(tabId: string, nodeId: string) {
      const tab = this.tabs.find((t) => t.id === tabId);
      if (!tab) return;
      tab.nodeId = nodeId;
      tab.dirty = false;
      const node = useLibraryStore().nodeById(nodeId);
      if (node) tab.title = node.name;
    },

    // ---- HTTP 发送 ----

    async send(tabId: string) {
      const tab = this.tabs.find((t) => t.id === tabId);
      if (!tab || tab.kind !== 'http' || tab.sending) return;

      const env = useEnvStore();
      const settings = useSettingsStore();
      const library = useLibraryStore();

      tab.sending = true;
      tab.response = undefined;
      const res = await sendRequest(tab.request, {
        vars: env.vars,
        timeoutSec: settings.settings.timeout,
      });
      tab.response = res;
      tab.sending = false;

      // 断言校验 + 后置变量提取
      tab.assertResults = runAssertions(tab.request.tests ?? [], res);
      const extractResults = runExtracts(tab.request.extracts ?? [], res);
      tab.extractResults = extractResults;
      const okExtracts = extractResults.filter((r) => r.ok);
      if (okExtracts.length) {
        const saved = env.setVarValues(Object.fromEntries(okExtracts.map((r) => [r.varName, r.value])));
        if (saved) {
          useUiStore().toast(`已提取变量：${okExtracts.map((r) => r.varName).join('、')}`, 'info');
        } else {
          useUiStore().toast('提取到变量但未选择环境，未保存（顶栏可切换环境）', 'error');
        }
      }

      const node = tab.nodeId ? library.nodeById(tab.nodeId) : undefined;
      useHistoryStore().add({
        id: uid(),
        kind: 'http',
        projectId: node?.projectId ?? null,
        name: tab.title || hostOf(tab.request.url),
        request: persistClone(tab.request),
        response: res,
        ts: Date.now(),
      });
    },

    // ---- WebSocket ----

    wsConnect(tabId: string) {
      const tab = this.tabs.find((t) => t.id === tabId);
      if (!tab || !tab.ws) return;
      if (!tab.request.url.trim()) {
        useUiStore().toast('请输入 WebSocket 地址', 'error');
        return;
      }

      const old = wsClients.get(tabId);
      if (old) {
        old.close();
        wsClients.delete(tabId);
      }

      const client = new WsClient();
      wsClients.set(tabId, client);
      tab.ws.status = 'connecting';

      const pushMsg = (m: WsMessage) => tab.ws?.messages.push(m);

      client.connect(tab.request.url, {
        onOpen: (url) => {
          if (!tab.ws) return;
          tab.ws.status = 'open';
          tab.ws.url = url;
          pushMsg({ id: uid(), direction: 'sys', text: `已连接 ${url}`, ts: Date.now() });
          this.recordWsHistory(tab);
        },
        onMessage: (m) => pushMsg(m),
        onClose: (code, reason) => {
          if (!tab.ws) return;
          tab.ws.status = 'closed';
          pushMsg({
            id: uid(),
            direction: 'sys',
            text: `连接已关闭（${code}${reason ? ` ${reason}` : ''}）`,
            ts: Date.now(),
          });
        },
        onError: (msg) => {
          if (!tab.ws) return;
          tab.ws.status = 'error';
          pushMsg({ id: uid(), direction: 'sys', text: msg, ts: Date.now() });
        },
      });
    },

    wsDisconnect(tabId: string) {
      const tab = this.tabs.find((t) => t.id === tabId);
      const client = wsClients.get(tabId);
      if (client) {
        client.close();
        wsClients.delete(tabId);
      }
      if (tab?.ws && (tab.ws.status === 'open' || tab.ws.status === 'connecting')) {
        tab.ws.status = 'closed';
        tab.ws.messages.push({
          id: uid(),
          direction: 'sys',
          text: '已手动断开连接',
          ts: Date.now(),
        });
      }
    },

    wsSend(tabId: string, text: string): boolean {
      const tab = this.tabs.find((t) => t.id === tabId);
      const client = wsClients.get(tabId);
      if (!tab || !client || !client.isOpen) return false;
      if (!client.send(text)) return false;
      tab.ws?.messages.push({ id: uid(), direction: 'send', text, ts: Date.now() });
      return true;
    },

    clearWsMessages(tabId: string) {
      const tab = this.tabs.find((t) => t.id === tabId);
      if (tab?.ws) tab.ws.messages = [];
    },

    recordWsHistory(tab: TabItem) {
      const library = useLibraryStore();
      const node = tab.nodeId ? library.nodeById(tab.nodeId) : undefined;
      useHistoryStore().add({
        id: uid(),
        kind: 'ws',
        projectId: node?.projectId ?? null,
        name: tab.title || hostOf(tab.request.url),
        request: persistClone(tab.request),
        ts: Date.now(),
      });
    },
  },
});
