<script setup lang="ts">
import { ref } from 'vue';
import { useEnvStore } from '@/stores/env';
import { useUiStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { storageKind } from '@/storage/db';
import { openCtxMenu } from '@/core/menu';
import AppIcon from '@/components/common/AppIcon.vue';

const env = useEnvStore();
const ui = useUiStore();
const workspace = useWorkspaceStore();

const envBtn = ref<HTMLElement | null>(null);

function envMenu(e: MouseEvent) {
  const rect = (envBtn.value as HTMLElement).getBoundingClientRect();
  const items = [
    {
      label: '不使用环境',
      icon: env.activeEnvId === '' ? 'check' : undefined,
      action: () => env.setActive(''),
    },
    ...env.envs.map((en) => ({
      label: en.name,
      icon: env.activeEnvId === en.id ? 'check' : undefined,
      action: () => env.setActive(en.id),
    })),
    { separator: true, label: '' },
    {
      label: '管理环境变量…',
      icon: 'globe',
      action: () => ui.openModal('env'),
    },
  ];
  openCtxMenu({ clientX: rect.left, clientY: rect.bottom + 4 } as MouseEvent, items);
}
</script>

<template>
  <header class="top-bar">
    <div class="brand">
      <img src="/icons/icon48.png" alt="PenApi" class="brand-logo" draggable="false" />
      <span class="brand-name">PenApi</span>
      <span v-if="storageKind === 'web'" class="dev-badge" title="当前以普通网页方式运行，数据保存于 localStorage">开发模式</span>
    </div>

    <button ref="envBtn" class="env-btn" :class="{ on: !!env.active }" @click="envMenu">
      <AppIcon name="globe" :size="13" />
      <span>{{ env.active ? env.active.name : '环境' }}</span>
      <span v-if="env.active" class="env-count">{{ Object.keys(env.vars).length }}</span>
    </button>

    <div class="top-space" />

    <button class="btn ghost icon-only" title="Cookie 管理" @click="ui.openModal('cookies')">
      <AppIcon name="cookie" :size="15" />
    </button>
    <button class="btn ghost icon-only" title="WebSocket 调试" @click="workspace.openNewRequest('ws')">
      <AppIcon name="bolt" :size="15" />
    </button>
    <button class="btn ghost icon-only" title="设置 / 备份" @click="ui.openModal('settings')">
      <AppIcon name="settings" :size="15" />
    </button>
  </header>
</template>

<style scoped>
.top-bar {
  height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  user-select: none;
  padding-right: 6px;
}
.brand-logo {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: block;
}
.brand-name {
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-0);
}
.dev-badge {
  font-size: 10.5px;
  color: var(--orange);
  border: 1px solid rgba(251, 191, 36, 0.4);
  background: rgba(251, 191, 36, 0.1);
  border-radius: 4px;
  padding: 0 6px;
}
.env-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-1);
  padding: 3px 12px;
  cursor: pointer;
  font-size: 12.3px;
  transition: all 0.15s;
}
.env-btn:hover {
  border-color: var(--border-strong);
  color: var(--text-0);
}
.env-btn.on {
  color: var(--accent);
  border-color: var(--accent-line);
  background: var(--accent-dim);
}
.env-count {
  font-size: 10.5px;
  background: var(--bg-3);
  border-radius: 8px;
  padding: 0 6px;
}
.top-space {
  flex: 1;
}
</style>
