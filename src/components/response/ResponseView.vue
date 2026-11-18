<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { AssertResult, ExtractResult, ResponseSnapshot } from '@/types';
import { formatSize, formatTime } from '@/core/util';
import AppIcon from '@/components/common/AppIcon.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import JsonTree from './JsonTree.vue';

const props = defineProps<{
  response?: ResponseSnapshot;
  sending: boolean;
  assertResults?: AssertResult[];
  extractResults?: ExtractResult[];
}>();

const emit = defineEmits<{
  resend: [];
  toast: [msg: string, type?: 'ok' | 'error' | 'info'];
}>();

type ViewTab = 'body' | 'res-headers' | 'req-headers';
type BodyMode = 'pretty' | 'raw' | 'preview';

const viewTab = ref<ViewTab>('body');
const bodyMode = ref<BodyMode>('raw');

const parsedJson = computed<unknown | undefined>(() => {
  const resp = props.response;
  if (!resp?.body) return undefined;
  const t = resp.body.trim();
  const looksJson = resp.contentType.includes('json') || /^[[{]/.test(t);
  if (!looksJson) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
});

const isImage = computed(() => !!props.response?.contentType.startsWith('image/'));
const isHtml = computed(() => !!props.response?.contentType.includes('text/html'));
const canPretty = computed(() => parsedJson.value !== undefined);
const canPreview = computed(() => isImage.value || isHtml.value);
const rawBody = computed(() => props.response?.body ?? '');

/** 响应变化时自动选择最合适的查看方式 */
watch(
  () => props.response,
  (resp) => {
    if (!resp) return;
    viewTab.value = 'body';
    if (isImage.value) bodyMode.value = 'preview';
    else if (canPretty.value) bodyMode.value = 'pretty';
    else bodyMode.value = 'raw';
    assertOpen.value = failCount.value > 0;
  },
);

// ---- 断言结果 ----
const assertOpen = ref(Boolean());
const total = computed(() => (props.assertResults ?? []).length);
const passCount = computed(() => (props.assertResults ?? []).filter((r) => r.passed).length);
const failCount = computed(() => total.value - passCount.value);
const extractOkCount = computed(() => (props.extractResults ?? []).filter((r) => r.ok).length);
const hasResults = computed(() => total.value > 0 || (props.extractResults ?? []).length > 0);

const statusClass = computed(() => {
  const s = props.response?.status ?? 0;
  if (props.response?.error) return 'st-error';
  if (s >= 200 && s < 300) return 'st-2xx';
  if (s >= 300 && s < 400) return 'st-3xx';
  if (s >= 400 && s < 500) return 'st-4xx';
  if (s >= 500) return 'st-5xx';
  return 'st-error';
});

function timeClass(ms: number): string {
  if (ms < 500) return 'time-fast';
  if (ms < 1500) return 'time-mid';
  return 'time-slow';
}

async function copyBody() {
  try {
    await navigator.clipboard.writeText(props.response?.body ?? '');
    emit('toast', '已复制响应内容');
  } catch {
    emit('toast', '复制失败', 'error');
  }
}
</script>

<template>
  <div class="response-view">
    <!-- 发送中：顶部细进度条 -->
    <div v-if="sending" class="thin-progress" />

    <!-- 无响应 -->
    <EmptyState
      v-if="!response && !sending"
      icon="send"
      text="点击「发送」后这里展示响应内容"
    />

    <!-- 请求中提示 -->
    <div v-else-if="sending" class="sending-hint">
      <span class="spinner" />
      <span>请求已发出，等待响应…</span>
    </div>

    <template v-else-if="response">
      <!-- 元信息行 -->
      <div class="meta-bar">
        <span v-if="response.error" class="chip st-error">请求失败</span>
        <span v-else class="chip" :class="statusClass">
          {{ response.status }} {{ response.statusText }}
        </span>
        <span class="meta-item" :class="timeClass(response.time)">{{ formatTime(response.time) }}</span>
        <span class="meta-item">{{ formatSize(response.bodySize) }}</span>
        <span v-if="response.redirected" class="meta-item dim" :title="response.finalUrl">
          已重定向
        </span>
        <button
          v-if="hasResults"
          class="chip assert-chip"
          :class="failCount ? 'as-fail' : 'as-ok'"
          :title="assertOpen ? '收起断言详情' : '展开断言详情'"
          @click="assertOpen = !assertOpen"
        >
          <template v-if="total > 0">断言 {{ passCount }}/{{ total }}</template>
          <template v-if="total > 0 && (extractResults?.length ?? 0) > 0"> · </template>
          <template v-if="(extractResults?.length ?? 0) > 0">
            提取 {{ extractOkCount }}/{{ extractResults!.length }}
          </template>
        </button>
        <div class="meta-space" />
        <button v-if="!response.error" class="btn ghost icon-only" title="复制响应内容" @click="copyBody">
          <AppIcon name="copy" :size="13" />
        </button>
        <button class="btn ghost icon-only" title="重新发送" @click="emit('resend')">
          <AppIcon name="refresh" :size="13" />
        </button>
      </div>

      <!-- 断言结果详情 -->
      <div v-if="assertOpen && hasResults" class="assert-panel">
        <div v-for="r in assertResults" :key="r.ruleId" class="assert-item" :class="r.passed ? 'ok' : 'bad'">
          <AppIcon :name="r.passed ? 'check' : 'close'" :size="12" />
          <span class="assert-label">{{ r.label }}</span>
          <span class="assert-msg">{{ r.message }}</span>
        </div>
        <div
          v-for="r in extractResults"
          :key="'x' + r.ruleId"
          class="assert-item"
          :class="r.ok ? 'ok' : 'bad'"
        >
          <AppIcon :name="r.ok ? 'check' : 'close'" :size="12" />
          <span class="assert-label">提取 {{ r.varName }}</span>
          <span class="assert-msg">{{ r.ok ? '= ' + r.value : '未取到值' }}</span>
        </div>
      </div>

      <!-- 错误信息 -->
      <div v-if="response.error" class="error-box">
        <AppIcon name="alert" :size="15" />
        <span>{{ response.error }}</span>
      </div>

      <template v-else>
        <!-- 视图切换 -->
        <div class="view-tabs">
          <button class="vtab" :class="{ on: viewTab === 'body' }" @click="viewTab = 'body'">响应体</button>
          <button class="vtab" :class="{ on: viewTab === 'res-headers' }" @click="viewTab = 'res-headers'">
            响应头 <span class="vtab-count">{{ response.headers.length }}</span>
          </button>
          <button class="vtab" :class="{ on: viewTab === 'req-headers' }" @click="viewTab = 'req-headers'">
            请求头 <span class="vtab-count">{{ response.requestHeaders.length }}</span>
          </button>

          <template v-if="viewTab === 'body'">
            <div class="meta-space" />
            <button v-if="canPretty" class="vtab mode" :class="{ on: bodyMode === 'pretty' }" @click="bodyMode = 'pretty'">
              格式化
            </button>
            <button v-if="canPreview" class="vtab mode" :class="{ on: bodyMode === 'preview' }" @click="bodyMode = 'preview'">
              预览
            </button>
            <button class="vtab mode" :class="{ on: bodyMode === 'raw' }" @click="bodyMode = 'raw'">
              原始
            </button>
          </template>
        </div>

        <div class="view-content">
          <!-- 响应体 -->
          <template v-if="viewTab === 'body'">
            <div v-if="response.truncated" class="truncate-tip">
              响应内容超过 1 MB，为节省存储未保留正文；如需查看请重新发送。
            </div>
            <template v-else>
              <div v-if="bodyMode === 'pretty' && canPretty" class="json-wrap">
                <JsonTree :data="parsedJson" :depth="0" />
              </div>
              <div v-else-if="bodyMode === 'preview' && isImage && response.dataUrl" class="preview-wrap">
                <img :src="response.dataUrl" alt="响应图片预览" />
              </div>
              <iframe
                v-else-if="bodyMode === 'preview' && isHtml"
                class="html-preview"
                sandbox="allow-same-origin"
                :srcdoc="rawBody"
              />
              <pre v-else class="raw-wrap">{{ rawBody || '(空响应体)' }}</pre>
            </template>
          </template>

          <!-- 响应头 / 请求头 -->
          <template v-else>
            <div class="headers-grid">
              <template v-for="[k, v] in viewTab === 'res-headers' ? response.headers : response.requestHeaders" :key="k + v">
                <div class="h-key">{{ k }}</div>
                <div class="h-val">{{ v }}</div>
              </template>
              <div
                v-if="(viewTab === 'res-headers' ? response.headers : response.requestHeaders).length === 0"
                class="h-empty"
              >
                无内容
              </div>
            </div>
            <div v-if="viewTab === 'req-headers'" class="req-note">
              以上为请求配置生成的请求头；Host、User-Agent、Cookie 等受限头由浏览器自动处理。
            </div>
          </template>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.response-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.sending-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-1);
  padding: 18px 16px;
}
.meta-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 8px;
  flex-wrap: wrap;
}
.meta-space {
  flex: 1;
}
.meta-item {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-1);
}
.meta-bar .chip::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.meta-item.dim {
  color: var(--text-2);
}
.assert-chip {
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.as-ok {
  color: var(--green);
  background: rgba(63, 206, 142, 0.13);
}
.as-fail {
  color: var(--red);
  background: rgba(255, 107, 107, 0.13);
}
.assert-panel {
  margin: 0 16px 8px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-1);
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 132px;
  overflow-y: auto;
  flex-shrink: 0;
  animation: fade-in 0.15s ease;
}
.assert-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  min-width: 0;
}
.assert-item.ok {
  color: var(--text-1);
}
.assert-item.ok :deep(svg) {
  color: var(--green);
}
.assert-item.bad {
  color: var(--text-0);
}
.assert-item.bad :deep(svg) {
  color: var(--red);
}
.assert-label {
  font-weight: 550;
  flex-shrink: 0;
}
.assert-msg {
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.st-2xx {
  color: var(--green);
  background: rgba(74, 222, 128, 0.12);
}
.st-3xx {
  color: var(--blue);
  background: rgba(56, 189, 248, 0.12);
}
.st-4xx {
  color: var(--orange);
  background: rgba(251, 191, 36, 0.12);
}
.st-5xx,
.st-error {
  color: var(--red);
  background: rgba(248, 113, 113, 0.12);
}
.error-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 4px 14px 12px;
  padding: 10px 12px;
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.08);
  border-radius: 8px;
  color: var(--red);
  word-break: break-all;
}
.view-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
}
.vtab {
  background: transparent;
  border: none;
  color: var(--text-1);
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12.5px;
  border-bottom: 2px solid transparent;
}
.vtab:hover {
  color: var(--text-0);
}
.vtab.on {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.vtab.mode {
  padding: 4px 10px;
  margin-bottom: 3px;
  border-radius: 5px;
}
.vtab.mode.on {
  background: var(--accent-dim);
}
.vtab-count {
  color: var(--text-2);
  font-size: 11px;
}
.view-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 14px 14px;
}
.json-wrap {
  min-width: 0;
}
.raw-wrap {
  margin: 0;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-0);
}
.preview-wrap {
  display: flex;
  justify-content: center;
  padding: 12px;
}
.preview-wrap img {
  max-width: 100%;
  border-radius: 6px;
}
.html-preview {
  width: 100%;
  height: 100%;
  min-height: 220px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}
.truncate-tip {
  color: var(--orange);
  font-size: 12.5px;
  padding: 8px 0;
}
.headers-grid {
  display: grid;
  grid-template-columns: minmax(140px, max-content) 1fr;
  gap: 3px 16px;
  font-family: var(--mono);
  font-size: 12.3px;
}
.h-key {
  color: #7dd3fc;
  word-break: break-all;
}
.h-val {
  color: var(--text-1);
  word-break: break-all;
}
.h-empty {
  grid-column: 1 / -1;
  color: var(--text-2);
}
.req-note {
  margin-top: 10px;
  color: var(--text-2);
  font-size: 11.8px;
}
.time-fast {
  color: var(--green);
}
.time-mid {
  color: var(--orange);
}
.time-slow {
  color: var(--red);
}
</style>
