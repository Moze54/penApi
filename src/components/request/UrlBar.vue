<script setup lang="ts">
import { computed, ref } from 'vue';
import type { HttpMethod, TabItem } from '@/types';
import { HTTP_METHODS } from '@/types';
import { useWorkspaceStore } from '@/stores/workspace';
import { useEnvStore } from '@/stores/env';
import { useUiStore } from '@/stores/ui';
import { applyVars } from '@/core/vars';
import { toCurl } from '@/core/curl';
import { openCtxMenu } from '@/core/menu';
import AppIcon from '@/components/common/AppIcon.vue';
import Dropdown from '@/components/common/Dropdown.vue';

const props = defineProps<{ tab: TabItem }>();

const workspace = useWorkspaceStore();
const env = useEnvStore();
const ui = useUiStore();

const moreBtn = ref<HTMLElement | null>(null);

function onMethodChange(m: string) {
  props.tab.request.method = m as HttpMethod;
  workspace.touch(props.tab.id);
}

/** 解析环境变量后的完整 URL 提示 */
const resolvedHint = computed(() => {
  const req = props.tab.request;
  const raw = req.url.trim();
  const applied = applyVars(raw, env.vars);
  if (!applied) return '';
  try {
    const u = new URL(applied);
    for (const p of req.params) {
      if (p.enabled && p.key.trim()) {
        u.searchParams.append(applyVars(p.key, env.vars), applyVars(p.value, env.vars));
      }
    }
    return u.toString() !== raw ? u.toString() : '';
  } catch {
    return '';
  }
});

function send() {
  workspace.send(props.tab.id);
}

function save() {
  if (workspace.saveToNode(props.tab)) {
    ui.toast('已保存');
  } else {
    ui.openModal('save-request', { tabId: props.tab.id });
  }
}

function moreMenu(e: MouseEvent) {
  const rect = (moreBtn.value as HTMLElement).getBoundingClientRect();
  openCtxMenu(
    { clientX: rect.left, clientY: rect.bottom + 4 } as MouseEvent,
    [
      {
        label: '导入 cURL',
        icon: 'terminal',
        action: () => ui.openModal('curl-import', { tabId: props.tab.id }),
      },
      {
        label: '复制为 cURL',
        icon: 'copy',
        action: () => copyCurl(),
      },
      {
        label: '生成代码',
        icon: 'braces',
        action: () => ui.openModal('codegen', { tabId: props.tab.id }),
      },
      { separator: true, label: '' },
      {
        label: props.tab.nodeId ? '另存为…' : '保存到项目…',
        icon: 'save',
        action: () => ui.openModal('save-request', { tabId: props.tab.id }),
      },
    ],
  );
}

async function copyCurl() {
  try {
    await navigator.clipboard.writeText(toCurl(props.tab.request));
    ui.toast('已复制 cURL 命令');
  } catch {
    ui.toast('复制失败', 'error');
  }
}
</script>

<template>
  <div class="url-bar">
    <Dropdown
      :model-value="tab.request.method"
      :options="HTTP_METHODS.map((m) => ({ value: m, label: m }))"
      colorful
      width="104px"
      @update:model-value="onMethodChange"
    />

    <div class="url-input-wrap">
      <input
        v-model="tab.request.url"
        class="input url-input mono"
        placeholder="https://api.example.com/path{{变量可用}}"
        spellcheck="false"
        autofocus
        @input="workspace.touch(tab.id)"
        @keydown.enter.prevent="send"
      />
      <div v-if="resolvedHint" class="resolved-hint" :title="resolvedHint">
        <AppIcon name="link" :size="11" />
        <span class="mono">{{ resolvedHint }}</span>
      </div>
    </div>

    <button class="btn save-btn" title="保存 (Ctrl+S)" @click="save">
      <AppIcon name="save" :size="14" />
    </button>
    <button ref="moreBtn" class="btn icon-only more-btn" title="更多操作" @click="moreMenu">
      <AppIcon name="more" :size="15" />
    </button>
    <button class="btn primary send-btn" :disabled="tab.sending" @click="send">
      <span v-if="tab.sending" class="spinner" />
      <AppIcon v-else name="send" :size="14" />
      发送
    </button>
  </div>
</template>

<style scoped>
.url-bar {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px 4px;
}
.method-select {
  flex-shrink: 0;
}
.url-input-wrap {
  flex: 1;
  position: relative;
  min-width: 0;
}
.url-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
}
.resolved-hint {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 2px);
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-2);
  font-size: 11.5px;
  padding: 1px 2px;
  overflow: hidden;
  white-space: nowrap;
}
.resolved-hint svg {
  flex-shrink: 0;
  color: var(--accent);
}
.resolved-hint span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.url-bar:has(.resolved-hint) {
  padding-bottom: 22px;
}
.save-btn,
.more-btn {
  padding: 8px;
  flex-shrink: 0;
}
.send-btn {
  min-width: 92px;
  padding: 8px 20px;
  border-radius: 21px;
  flex-shrink: 0;
  letter-spacing: 1px;
}
</style>
