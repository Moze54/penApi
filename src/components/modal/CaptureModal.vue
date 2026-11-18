<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import {
  captureSupported,
  clearCaptured,
  getCaptureOn,
  listCaptured,
  setCaptureOn,
  toRequestConfig,
  type CaptureRecord,
} from '@/core/capture';
import { persistClone } from '@/core/request';
import AppModal from '@/components/common/AppModal.vue';
import Dropdown from '@/components/common/Dropdown.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const library = useLibraryStore();
const ui = useUiStore();

const sortedProjects = computed(() => [...library.projects].sort((a, b) => a.order - b.order));
const projectId = ref(sortedProjects.value[0]?.id ?? '');
const parentId = ref('root');

const projectOptions = computed(() => sortedProjects.value.map((p) => ({ value: p.id, label: p.name })));
const folderOptions = computed(() => [
  { value: 'root', label: '根目录' },
  ...library
    .childrenOf(projectId.value, null)
    .filter((n) => n.type === 'folder')
    .map((f) => ({ value: f.id, label: f.name })),
]);

function onProjectChange() {
  parentId.value = 'root';
}

const capturing = ref(false);
const records = ref<CaptureRecord[]>([]);
const selected = ref<string[]>([]);
let timer: number | undefined;

async function refresh() {
  if (!captureSupported) return;
  try {
    records.value = await listCaptured();
  } catch {
    /* 忽略轮询错误 */
  }
}

async function toggleCapture() {
  try {
    await setCaptureOn(!capturing.value);
    capturing.value = !capturing.value;
    ui.toast(capturing.value ? '已开始捕获页面请求' : '已暂停捕获', 'info');
  } catch (e) {
    ui.toast((e as Error).message, 'error');
  }
}

async function clearAll() {
  const ok = await ui.askConfirm({
    title: '清空抓包记录',
    message: `将清空当前已捕获的全部 ${records.value.length} 条请求。`,
    okText: '清空',
    danger: true,
  });
  if (!ok) return;
  await clearCaptured();
  records.value = [];
  selected.value = [];
  ui.toast('已清空抓包记录');
}

function isSelected(id: string): boolean {
  return selected.value.includes(id);
}

function toggleSelect(id: string) {
  if (isSelected(id)) selected.value = selected.value.filter((x) => x !== id);
  else selected.value = [...selected.value, id];
}

const selectedCount = computed(() => selected.value.length);

function selectAll() {
  if (selected.value.length === records.value.length) selected.value = [];
  else selected.value = records.value.map((r) => r.id);
}

function statusClass(r: CaptureRecord): string {
  if (r.error) return 'st-err';
  if (r.status == null) return 'st-pending';
  if (r.status >= 200 && r.status < 300) return 'st-ok';
  if (r.status >= 400) return 'st-err';
  return 'st-mid';
}

function shortUrl(u: string): string {
  try {
    const url = new URL(u);
    return url.host + url.pathname + url.search;
  } catch {
    return u;
  }
}

function nameOf(rec: CaptureRecord): string {
  try {
    const url = new URL(rec.url);
    return `${rec.method} ${url.pathname}`;
  } catch {
    return `${rec.method} ${rec.url}`;
  }
}

function importSelected() {
  if (!selected.value.length) return;
  if (!projectId.value) {
    ui.toast('请先创建项目', 'error');
    return;
  }
  const baseParent = parentId.value === 'root' ? null : parentId.value;
  if (baseParent) {
    const target = library.nodeById(baseParent);
    if (target && target.type === 'folder' && !target.expanded) target.expanded = true;
  }
  const picked = records.value.filter((r) => selected.value.includes(r.id));
  for (const rec of picked) {
    library.createNode({
      projectId: projectId.value,
      parentId: baseParent,
      type: 'request',
      name: nameOf(rec),
      request: persistClone(toRequestConfig(rec)),
    });
  }
  selected.value = [];
  ui.toast(`已导入 ${picked.length} 个接口到项目`);
}

onMounted(async () => {
  if (!captureSupported) return;
  capturing.value = await getCaptureOn();
  await refresh();
  timer = window.setInterval(refresh, 1200);
});

onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <AppModal title="页面抓包导入" width="900px" @close="ui.closeModal()">
    <div v-if="!captureSupported" class="no-support">
      <AppIcon name="alert" :size="16" />
      <div>
        <div class="ns-title">网页开发模式不支持抓包</div>
        <div class="ns-desc">
          抓包依赖浏览器扩展的 webRequest 能力，请在「扩展管理」中加载 dist 目录后，从插件页面使用。
        </div>
      </div>
    </div>

    <div v-else class="capture-form">
      <div class="cap-bar">
        <button class="btn" :class="{ primary: !capturing }" @click="toggleCapture">
          <AppIcon :name="capturing ? 'clock' : 'bolt'" :size="13" />
          {{ capturing ? '暂停捕获' : '开始捕获' }}
        </button>
        <span class="cap-state" :class="{ live: capturing }">
          <span class="state-dot" />
          {{ capturing ? '捕获中' : '已暂停' }}
        </span>
        <span class="cap-count">{{ records.length }} 条记录</span>
        <div class="cap-space" />
        <button class="btn small ghost" :disabled="!records.length" @click="selectAll">
          {{ selected.length === records.length && records.length ? '取消全选' : '全选' }}
        </button>
        <button class="btn small ghost danger-hover" :disabled="!records.length" @click="clearAll">
          清空
        </button>
      </div>

      <div class="cap-hint">
        开启后，在本浏览器其他标签页触发的 API 请求（XHR / fetch）会实时出现在下方列表；选中后一键转为接口。
      </div>

      <div class="rec-list">
        <div
          v-for="r in records"
          :key="r.id"
          class="rec-row"
          :class="{ on: isSelected(r.id) }"
          @click="toggleSelect(r.id)"
        >
          <input type="checkbox" class="rec-check" :checked="isSelected(r.id)" @click.stop="toggleSelect(r.id)" />
          <span class="chip rec-method" :class="r.method.toLowerCase()">{{ r.method }}</span>
          <span class="rec-status" :class="statusClass(r)">
            {{ r.error ? 'ERR' : r.status ?? '…' }}
          </span>
          <span class="rec-url mono" :title="r.url">{{ shortUrl(r.url) }}</span>
          <span v-if="r.time != null" class="rec-time">{{ r.time }}ms</span>
        </div>
        <div v-if="!records.length" class="rec-empty">
          {{ capturing ? '等待页面请求…在其他标签页操作你的业务系统试试' : '点击「开始捕获」后，这里会实时显示页面 API 请求' }}
        </div>
      </div>

      <div class="loc-row">
        <label class="field">
          <span class="field-label">项目</span>
          <Dropdown v-model="projectId" :options="projectOptions" width="100%" @update:model-value="onProjectChange" />
        </label>
        <label class="field">
          <span class="field-label">位置</span>
          <Dropdown v-model="parentId" :options="folderOptions" width="100%" />
        </label>
      </div>
    </div>

    <template #footer>
      <button class="btn" @click="ui.closeModal()">关闭</button>
      <button
        class="btn primary"
        :disabled="!captureSupported || !selectedCount"
        @click="importSelected"
      >
        导入选中的 {{ selectedCount || 0 }} 个接口
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.capture-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cap-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cap-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
}
.state-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-2);
}
.cap-state.live {
  color: var(--green);
}
.cap-state.live .state-dot {
  background: var(--green);
  animation: breathe 1.6s ease-in-out infinite;
}
@keyframes breathe {
  50% {
    opacity: 0.3;
  }
}
.cap-count {
  font-size: 12px;
  color: var(--text-2);
}
.cap-space {
  flex: 1;
}
.danger-hover:hover {
  color: var(--red);
  border-color: rgba(255, 107, 107, 0.4);
}
.cap-hint {
  font-size: 11.5px;
  color: var(--text-2);
}
.rec-list {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-0);
  height: 300px;
  overflow-y: auto;
}
.rec-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 12px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  font-size: 12.3px;
  transition: background 0.12s;
  min-width: 0;
}
.rec-row:hover {
  background: var(--bg-2);
}
.rec-row.on {
  background: var(--accent-dim);
}
.rec-check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.rec-method {
  min-width: 58px;
  justify-content: center;
  font-size: 10.5px;
  padding: 1px 6px;
  flex-shrink: 0;
}
.rec-status {
  width: 34px;
  text-align: center;
  font-family: var(--mono);
  font-size: 11.5px;
  flex-shrink: 0;
}
.st-ok {
  color: var(--green);
}
.st-err {
  color: var(--red);
}
.st-mid {
  color: var(--orange);
}
.st-pending {
  color: var(--text-2);
}
.rec-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-1);
  font-size: 11.8px;
}
.rec-time {
  color: var(--text-2);
  font-family: var(--mono);
  font-size: 11px;
  flex-shrink: 0;
}
.rec-empty {
  color: var(--text-2);
  text-align: center;
  padding: 40px 0;
  font-size: 12.5px;
}
.loc-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.field-label {
  width: 36px;
  color: var(--text-1);
  font-size: 12.5px;
  flex-shrink: 0;
  text-align: right;
}
.field :deep(.dd-root) {
  flex: 1;
  min-width: 0;
}
.field :deep(.dd-trigger) {
  width: 100%;
}
.no-support {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 18px 16px;
  border: 1px solid rgba(255, 182, 72, 0.25);
  background: rgba(255, 182, 72, 0.06);
  border-radius: var(--radius-sm);
  color: var(--orange);
}
.ns-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-0);
}
.ns-desc {
  font-size: 12px;
  color: var(--text-1);
  line-height: 1.6;
}
</style>
