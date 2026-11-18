<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { TabItem } from '@/types';
import { useWorkspaceStore } from '@/stores/workspace';
import { useUiStore } from '@/stores/ui';
import UrlBar from '@/components/request/UrlBar.vue';
import KvEditor from '@/components/common/KvEditor.vue';
import BodyEditor from '@/components/request/BodyEditor.vue';
import AuthEditor from '@/components/request/AuthEditor.vue';
import AssertEditor from '@/components/request/AssertEditor.vue';
import ResponseView from '@/components/response/ResponseView.vue';

const props = defineProps<{ tab: TabItem }>();

const workspace = useWorkspaceStore();
const ui = useUiStore();

type ReqTab = 'params' | 'body' | 'headers' | 'auth' | 'assert';
const activeReqTab = ref<ReqTab>('params');

// 任意请求配置修改 → 标记未保存
watch(
  () => props.tab.request,
  () => workspace.touch(props.tab.id),
  { deep: true },
);

const enabledParamCount = computed(
  () => props.tab.request.params.filter((p) => p.enabled && p.key.trim()).length,
);
const enabledHeaderCount = computed(
  () => props.tab.request.headers.filter((h) => h.enabled && h.key.trim()).length,
);
const bodyTabLabel = computed(() => {
  const t = props.tab.request.body.type;
  if (t === 'none') return '请求体';
  if (t === 'raw') return `请求体 (${props.tab.request.body.rawType.toUpperCase()})`;
  return `请求体 (${t})`;
});
const assertCount = computed(
  () =>
    (props.tab.request.tests ?? []).filter((t) => t.enabled).length +
    (props.tab.request.extracts ?? []).filter((e) => e.enabled).length,
);

// ---- 上下分屏拖拽 ----
const paneEl = ref<HTMLElement | null>(null);
const editorPct = ref(46);

function startSplit(e: MouseEvent) {
  e.preventDefault();
  const el = paneEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const onMove = (ev: MouseEvent) => {
    const pct = ((ev.clientY - rect.top) / rect.height) * 100;
    editorPct.value = Math.min(78, Math.max(22, pct));
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
  };
  document.body.style.cursor = 'row-resize';
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// ---- 快捷键：Ctrl+Enter 发送 / Ctrl+S 保存 ----
function onKey(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    workspace.send(props.tab.id);
  } else if (e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (workspace.saveToNode(props.tab)) {
      ui.toast('已保存');
    } else {
      ui.openModal('save-request', { tabId: props.tab.id });
    }
  }
}
onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));

function resend() {
  workspace.send(props.tab.id);
}
</script>

<template>
  <div ref="paneEl" class="http-pane">
    <UrlBar :tab="tab" />

    <!-- 请求编辑器 -->
    <div class="req-editor" :style="{ flexBasis: editorPct + '%' }">
      <div class="req-tabs">
        <button class="rtab" :class="{ on: activeReqTab === 'params' }" @click="activeReqTab = 'params'">
          参数 <span v-if="enabledParamCount" class="rtab-badge">{{ enabledParamCount }}</span>
        </button>
        <button class="rtab" :class="{ on: activeReqTab === 'body' }" @click="activeReqTab = 'body'">
          {{ bodyTabLabel }}
        </button>
        <button class="rtab" :class="{ on: activeReqTab === 'headers' }" @click="activeReqTab = 'headers'">
          请求头 <span v-if="enabledHeaderCount" class="rtab-badge">{{ enabledHeaderCount }}</span>
        </button>
        <button class="rtab" :class="{ on: activeReqTab === 'auth' }" @click="activeReqTab = 'auth'">
          认证
        </button>
        <button class="rtab" :class="{ on: activeReqTab === 'assert' }" @click="activeReqTab = 'assert'">
          断言 <span v-if="assertCount" class="rtab-badge">{{ assertCount }}</span>
        </button>
      </div>

      <div class="req-content">
        <KvEditor
          v-show="activeReqTab === 'params'"
          :rows="tab.request.params"
          key-placeholder="参数名"
          value-placeholder="参数值"
          add-label="参数"
          @change="workspace.touch(tab.id)"
        />
        <BodyEditor
          v-show="activeReqTab === 'body'"
          :body="tab.request.body"
          @change="workspace.touch(tab.id)"
        />
        <div v-show="activeReqTab === 'headers'" class="headers-wrap">
          <KvEditor
            :rows="tab.request.headers"
            key-placeholder="Header 名称"
            value-placeholder="Header 值"
            add-label="请求头"
            @change="workspace.touch(tab.id)"
          />
          <div class="headers-note">
            Host、User-Agent、Cookie 等受限头由浏览器控制，自定义值可能被忽略；请求头名称与值含中文等非 ASCII
            字符时浏览器会拒绝发送，请将中文字段放入请求体或查询参数。
          </div>
        </div>
        <AuthEditor
          v-show="activeReqTab === 'auth'"
          :auth="tab.request.auth"
          @change="workspace.touch(tab.id)"
        />
        <AssertEditor
          v-show="activeReqTab === 'assert'"
          :request="tab.request"
          @change="workspace.touch(tab.id)"
        />
      </div>
    </div>

    <!-- 分隔条 -->
    <div class="splitter" @mousedown="startSplit" />

    <!-- 响应区 -->
    <div class="resp-area">
      <ResponseView
        :response="tab.response"
        :sending="tab.sending"
        :assert-results="tab.assertResults"
        :extract-results="tab.extractResults"
        @resend="resend"
        @toast="(msg, type) => ui.toast(msg, type ?? 'ok')"
      />
    </div>
  </div>
</template>

<style scoped>
.http-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.req-editor {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 150px;
  overflow: hidden;
}
.req-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 10px 0;
  border-bottom: 1px solid var(--border);
}
.rtab {
  background: transparent;
  border: none;
  color: var(--text-1);
  padding: 6px 13px;
  cursor: pointer;
  font-size: 12.8px;
  border-bottom: 2px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.rtab:hover {
  color: var(--text-0);
}
.rtab.on {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.rtab-badge {
  background: var(--accent-dim);
  color: var(--accent);
  border-radius: 8px;
  font-size: 10.5px;
  padding: 0 6px;
}
.req-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.headers-wrap {
  padding-bottom: 8px;
}
.headers-note {
  color: var(--text-2);
  font-size: 11.5px;
  padding: 6px 16px 0;
}
.splitter {
  height: 5px;
  cursor: row-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
}
.splitter:hover {
  background: var(--accent-dim);
}
.resp-area {
  flex: 1;
  min-height: 0;
  border-top: 1px solid var(--border);
  background: var(--bg-0);
}
</style>
