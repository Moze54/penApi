<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { TabItem } from '@/types';
import { useWorkspaceStore } from '@/stores/workspace';
import { useUiStore } from '@/stores/ui';
import AppIcon from '@/components/common/AppIcon.vue';

const props = defineProps<{ tab: TabItem }>();

const workspace = useWorkspaceStore();
const ui = useUiStore();

const messageInput = ref('');
const logEl = ref<HTMLElement | null>(null);

const STATUS_TEXT: Record<string, string> = {
  idle: '未连接',
  connecting: '连接中',
  open: '已连接',
  closed: '已断开',
  error: '连接错误',
};

const canSend = () => props.tab.ws?.status === 'open';

function connect() {
  workspace.wsConnect(props.tab.id);
}

function disconnect() {
  workspace.wsDisconnect(props.tab.id);
}

function send() {
  const text = messageInput.value;
  if (!text.trim() || !canSend()) return;
  const ok = workspace.wsSend(props.tab.id, text);
  if (ok) {
    messageInput.value = '';
    scrollToBottom();
  } else {
    ui.toast('发送失败：连接未就绪', 'error');
  }
}

function onInputKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

function scrollToBottom() {
  nextTick(() => {
    const el = logEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

watch(
  () => props.tab.ws?.messages.length,
  () => scrollToBottom(),
);
</script>

<template>
  <div class="ws-pane">
    <!-- 连接栏 -->
    <div class="ws-bar">
      <span class="ws-status" :class="tab.ws?.status" :title="STATUS_TEXT[tab.ws?.status ?? 'idle']" />
      <input
        v-model="tab.request.url"
        class="input mono ws-url"
        placeholder="wss://echo.example.com/ws"
        spellcheck="false"
        :disabled="tab.ws?.status === 'open' || tab.ws?.status === 'connecting'"
      />
      <button v-if="tab.ws?.status === 'open' || tab.ws?.status === 'connecting'" class="btn danger" @click="disconnect">
        断开
      </button>
      <button v-else class="btn primary" :disabled="!tab.request.url.trim()" @click="connect">
        <AppIcon name="bolt" :size="13" />
        连接
      </button>
      <button class="btn ghost icon-only" title="清空消息日志" @click="workspace.clearWsMessages(tab.id)">
        <AppIcon name="trash" :size="14" />
      </button>
    </div>

    <!-- 消息时间线 -->
    <div ref="logEl" class="ws-log">
      <div v-if="!tab.ws?.messages.length" class="ws-log-empty">
        <AppIcon name="bolt" :size="30" />
        <span>输入地址后点击「连接」，收发消息都会显示在这里</span>
      </div>
      <div
        v-for="m in tab.ws?.messages"
        :key="m.id"
        class="ws-msg"
        :class="m.direction"
      >
        <div v-if="m.direction === 'sys'" class="ws-sys">{{ m.text }}</div>
        <template v-else>
          <span class="ws-dir">{{ m.direction === 'send' ? '发送' : '接收' }}</span>
          <pre class="ws-text">{{ m.text }}</pre>
          <span class="ws-time">{{ new Date(m.ts).toLocaleTimeString('zh-CN', { hour12: false }) }}</span>
        </template>
      </div>
    </div>

    <!-- 发送区 -->
    <div class="ws-send">
      <textarea
        v-model="messageInput"
        class="input mono ws-input"
        rows="3"
        placeholder="输入要发送的消息，Enter 发送，Shift+Enter 换行"
        spellcheck="false"
        @keydown="onInputKey"
      />
      <button class="btn primary ws-send-btn" :disabled="!canSend() || !messageInput.trim()" @click="send">
        <AppIcon name="send" :size="13" />
        发送
      </button>
    </div>
  </div>
</template>

<style scoped>
.ws-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.ws-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 8px;
}
.ws-status {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-2);
}
.ws-status.open {
  background: var(--green);
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.7);
  animation: breathe 2s ease-in-out infinite;
}
.ws-status.connecting {
  background: var(--orange);
  animation: breathe 1s ease-in-out infinite;
}
.ws-status.closed {
  background: var(--text-2);
}
.ws-status.error {
  background: var(--red);
}
@keyframes breathe {
  50% {
    opacity: 0.45;
  }
}
.ws-url {
  flex: 1;
  padding: 8px 12px;
  font-size: 13px;
}
.ws-url:disabled {
  opacity: 0.7;
}
.ws-log {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ws-log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-2);
  height: 100%;
  text-align: center;
}
.ws-msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.ws-msg.send {
  flex-direction: row-reverse;
}
.ws-sys {
  align-self: center;
  color: var(--text-2);
  font-size: 11.5px;
  padding: 2px 10px;
  background: var(--bg-2);
  border-radius: 10px;
}
.ws-dir {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 2px;
}
.send .ws-dir {
  color: var(--accent);
  background: var(--accent-dim);
}
.recv .ws-dir {
  color: var(--green);
  background: rgba(74, 222, 128, 0.12);
}
.ws-text {
  margin: 0;
  font-family: var(--mono);
  font-size: 12.3px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-0);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 6px 11px;
  max-width: 72%;
}
.send .ws-text {
  border-color: var(--accent-line);
  background: var(--accent-dim);
}
.ws-time {
  color: var(--text-2);
  font-size: 10.5px;
  margin-top: 4px;
  flex-shrink: 0;
}
.ws-send {
  display: flex;
  gap: 8px;
  padding: 10px 14px 14px;
  border-top: 1px solid var(--border);
}
.ws-input {
  flex: 1;
  resize: none;
  font-size: 12.5px;
  line-height: 1.5;
}
.ws-send-btn {
  align-self: flex-end;
  min-width: 80px;
  padding: 8px 14px;
}
</style>
