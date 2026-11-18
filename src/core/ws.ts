import type { WsMessage } from '@/types';
import { uid } from './util';

export interface WsCallbacks {
  onOpen: (url: string) => void;
  onMessage: (msg: WsMessage) => void;
  onClose: (code: number, reason: string) => void;
  onError: (message: string) => void;
}

/** WebSocket 客户端封装：连接管理 + 收发消息回调 */
export class WsClient {
  private ws: WebSocket | null = null;

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string, cb: WsCallbacks): void {
    this.close();
    let proto = url.trim();
    if (!proto) {
      cb.onError('请输入 WebSocket 地址（ws:// 或 wss://）');
      return;
    }
    if (!/^wss?:\/\//i.test(proto)) {
      // 允许缺省协议，默认 wss（https 页面不能连 ws://）
      proto = ('wss://' + proto.replace(/^\/+/, ''));
    }
    let socket: WebSocket;
    try {
      socket = new WebSocket(proto);
    } catch (e) {
      cb.onError(`连接失败：${(e as Error).message || '地址无效'}`);
      return;
    }
    this.ws = socket;

    socket.onopen = () => cb.onOpen(socket.url || proto);
    socket.onmessage = (ev) => {
      const text = typeof ev.data === 'string' ? ev.data : `[二进制消息 ${ev.data?.size ?? ev.data?.byteLength ?? '?'} 字节]`;
      cb.onMessage({ id: uid(), direction: 'recv', text, ts: Date.now() });
    };
    socket.onclose = (ev) => {
      if (this.ws === socket) this.ws = null;
      cb.onClose(ev.code, ev.reason);
    };
    socket.onerror = () => {
      cb.onError('连接出错：地址不可达或协议被拒绝（https 页面须使用 wss://）');
    };
  }

  send(text: string): boolean {
    if (!this.isOpen || !this.ws) return false;
    this.ws.send(text);
    return true;
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.onopen = null;
      try {
        ws.close();
      } catch (_) {}
    }
  }
}
