<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { useUiStore } from '@/stores/ui';
import { openCtxMenu } from '@/core/menu';
import { storageKind } from '@/storage/db';
import AppIcon from '@/components/common/AppIcon.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import HttpPane from '@/components/request/HttpPane.vue';
import WsPane from '@/components/ws/WsPane.vue';

const workspace = useWorkspaceStore();
const ui = useUiStore();

const plusBtn = ref<HTMLElement | null>(null);
const tabScroll = ref<HTMLElement | null>(null);

/** 滚轮在标签条上转化为横向滚动（滚动条已隐藏） */
function onTabWheel(e: WheelEvent) {
  const el = tabScroll.value;
  if (!el || el.scrollWidth <= el.clientWidth) return;
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }
}

// 切换标签时把活动标签滚入可视区
watch(
  () => workspace.activeId,
  () => {
    nextTick(() => {
      const el = tabScroll.value?.querySelector('.wtab.on');
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  },
);

function newMenu(e: MouseEvent) {
  const rect = (plusBtn.value as HTMLElement).getBoundingClientRect();
  openCtxMenu(
    { clientX: rect.left, clientY: rect.bottom + 4 } as MouseEvent,
    [
      { label: '新建 HTTP 请求', icon: 'braces', action: () => workspace.openNewRequest('http') },
      { label: '新建 WebSocket 调试', icon: 'bolt', action: () => workspace.openNewRequest('ws') },
    ],
  );
}

function tabCtx(e: MouseEvent, tabId: string) {
  openCtxMenu(e, [
    { label: '关闭标签', icon: 'close', action: () => workspace.closeTab(tabId) },
    {
      label: '关闭其他标签',
      icon: 'close',
      disabled: workspace.tabs.length <= 1,
      action: () => workspace.closeOthers(tabId),
    },
  ]);
}
</script>

<template>
  <div class="workspace">
    <!-- 标签条 -->
    <div class="tab-strip">
      <div ref="tabScroll" class="tab-scroll" @wheel="onTabWheel">
        <div
          v-for="t in workspace.tabs"
          :key="t.id"
          class="wtab"
          :class="{ on: t.id === workspace.activeId }"
          :title="t.title"
          @click="workspace.setActive(t.id)"
          @contextmenu="tabCtx($event, t.id)"
          @mousedown.middle.prevent="workspace.closeTab(t.id)"
        >
          <span class="chip method small-chip" v-if="t.kind === 'http'">
            {{ t.request.method }}
          </span>
          <AppIcon v-else name="bolt" :size="12" class="ws-ico" />
          <span class="wtab-title">{{ t.title }}</span>
          <span v-if="t.dirty" class="dirty-dot" title="未保存" />
          <button class="wtab-close" title="关闭" @click.stop="workspace.closeTab(t.id)">
            <AppIcon name="close" :size="11" />
          </button>
        </div>
      </div>
      <button ref="plusBtn" class="btn ghost icon-only plus-btn" title="新建请求" @click="newMenu">
        <AppIcon name="plus" :size="15" />
      </button>
    </div>

    <!-- 内容区 -->
    <div class="tab-content">
      <template v-if="workspace.active">
        <HttpPane v-if="workspace.active.kind === 'http'" :tab="workspace.active" />
        <WsPane v-else :tab="workspace.active" />
      </template>
      <div v-else class="welcome">
        <img src="/icons/icon128.png" alt="" class="welcome-logo" draggable="false" />
        <h2>PenApi 接口调试</h2>
        <p>本地项目分组 · 环境变量 · 历史记录 · cURL / WebSocket</p>
        <div class="welcome-features">
          <span class="feature"><AppIcon name="braces" :size="14" />HTTP 全类型</span>
          <span class="feature"><AppIcon name="bolt" :size="14" />WebSocket</span>
          <span class="feature"><AppIcon name="globe" :size="14" />环境变量</span>
          <span class="feature"><AppIcon name="terminal" :size="14" />cURL 导入</span>
        </div>
        <div class="welcome-actions">
          <button class="btn primary" @click="workspace.openNewRequest('http')">
            <AppIcon name="plus" :size="14" /> 新建请求
          </button>
          <button class="btn" @click="ui.sidebarView = 'library'">
            <AppIcon name="book" :size="14" /> 打开接口库
          </button>
        </div>
        <div class="welcome-tips">
          <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 发送</span>
          <span><kbd>Ctrl</kbd>+<kbd>S</kbd> 保存接口</span>
          <span v-if="storageKind === 'web'" class="tip-dim">网页开发模式：数据存于浏览器 localStorage</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workspace {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.tab-strip {
  display: flex;
  align-items: center;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  padding: 7px 8px;
  gap: 4px;
  flex-shrink: 0;
}
.tab-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.tab-scroll::-webkit-scrollbar {
  display: none;
  height: 0;
  width: 0;
}
.wtab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px 5px 9px;
  border-radius: 7px;
  border: 1px solid transparent;
  color: var(--text-2);
  cursor: pointer;
  max-width: 200px;
  flex-shrink: 0;
  font-size: 12.6px;
  user-select: none;
  transition:
    background 0.12s,
    border-color 0.12s,
    color 0.12s;
}
.wtab:hover {
  background: var(--bg-2);
  color: var(--text-1);
}
.wtab.on {
  background: var(--accent-dim);
  border-color: var(--accent-line);
  color: var(--text-0);
}
.wtab.on .wtab-title {
  color: var(--text-0);
  font-weight: 600;
}
.wtab.on .wtab-close {
  color: var(--text-1);
}
.wtab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.small-chip {
  font-size: 10px;
  padding: 0 5px;
  flex-shrink: 0;
}
.ws-ico {
  color: var(--accent);
  flex-shrink: 0;
}
.dirty-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--orange);
  flex-shrink: 0;
}
.wtab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--text-2);
  cursor: pointer;
  flex-shrink: 0;
}
.wtab-close:hover {
  background: var(--bg-3);
  color: var(--text-0);
}
.plus-btn {
  flex-shrink: 0;
}
.tab-content {
  flex: 1;
  min-height: 0;
  background: var(--bg-0);
}
.welcome {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-1);
}
.welcome-logo {
  width: 76px;
  height: 76px;
  border-radius: 18px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  margin-bottom: 6px;
}
.welcome h2 {
  margin: 0;
  font-size: 21px;
  color: var(--text-0);
  font-weight: 700;
  letter-spacing: 1px;
}
.welcome p {
  margin: 0;
  color: var(--text-2);
  font-size: 12.8px;
}
.welcome-features {
  display: flex;
  gap: 22px;
  margin-top: 8px;
}
.feature {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-1);
  font-size: 12.3px;
}
.feature svg {
  color: var(--accent);
}
.welcome-actions {
  display: flex;
  gap: 12px;
  margin-top: 14px;
}
.welcome-actions .btn {
  padding: 8px 20px;
}
.welcome-tips {
  display: flex;
  gap: 18px;
  margin-top: 16px;
  color: var(--text-2);
  font-size: 12px;
}
kbd {
  background: var(--bg-2);
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  padding: 1px 6px;
  font-size: 11px;
  font-family: var(--mono);
}
.tip-dim {
  opacity: 0.6;
}
</style>
