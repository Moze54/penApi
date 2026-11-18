<script setup lang="ts">
import { computed, ref } from 'vue';
import { useHistoryStore } from '@/stores/history';
import { useWorkspaceStore } from '@/stores/workspace';
import { useUiStore } from '@/stores/ui';
import { openCtxMenu } from '@/core/menu';
import { HTTP_METHODS, type HistoryRecord, type HttpMethod } from '@/types';
import { formatDateTime } from '@/core/util';
import AppIcon from '@/components/common/AppIcon.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import Dropdown from '@/components/common/Dropdown.vue';

const history = useHistoryStore();
const workspace = useWorkspaceStore();
const ui = useUiStore();

const search = ref('');
const methodFilter = ref<'ALL' | HttpMethod>('ALL');

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase();
  return history.records.filter((r) => {
    if (methodFilter.value !== 'ALL' && r.request.method !== methodFilter.value) return false;
    if (!kw) return true;
    return (
      r.name.toLowerCase().includes(kw) || r.request.url.toLowerCase().includes(kw)
    );
  });
});

interface Group {
  label: string;
  records: HistoryRecord[];
}

const groups = computed<Group[]>(() => {
  const map = new Map<string, HistoryRecord[]>();
  for (const r of filtered.value) {
    const label = dayLabel(r.ts);
    const list = map.get(label) ?? [];
    list.push(r);
    map.set(label, list);
  }
  return [...map.entries()].map(([label, records]) => ({ label, records }));
});

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return '今天';
  if (sameDay(d, yesterday)) return '昨天';
  const p = (n: number) => String(n).padStart(2, '0');
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}年${md}`;
}

function timeOf(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function open(r: HistoryRecord) {
  workspace.openHistoryRecord(r);
}

function itemCtx(e: MouseEvent, r: HistoryRecord) {
  openCtxMenu(e, [
    { label: '打开', icon: 'link', action: () => open(r) },
    { label: '删除记录', icon: 'trash', danger: true, action: () => history.remove(r.id) },
    { separator: true, label: '' },
    { label: '清空全部历史', icon: 'trash', danger: true, action: () => clearAll() },
  ]);
}

async function clearAll() {
  const ok = await ui.askConfirm({
    title: '清空历史',
    message: `将删除全部 ${history.records.length} 条历史记录，该操作不可恢复。`,
    okText: '清空',
    danger: true,
  });
  if (ok) {
    history.clear();
    ui.toast('历史已清空');
  }
}
</script>

<template>
  <div class="history-list">
    <div class="filter-bar">
      <div class="search-box">
        <AppIcon name="search" :size="14" />
        <input v-model="search" class="input search-input" placeholder="搜索历史" spellcheck="false" />
      </div>
      <Dropdown
        v-model="methodFilter"
        :options="[{ value: 'ALL', label: '全部方法' }, ...HTTP_METHODS.map((m) => ({ value: m, label: m }))]"
        colorful
        width="100%"
      />
    </div>

    <div class="records-area">
      <EmptyState v-if="groups.length === 0" icon="clock" text="暂无历史记录" />
      <div v-for="g in groups" :key="g.label" class="record-group">
        <div class="group-label">
          <span>{{ g.label }}</span>
          <span class="group-count">{{ g.records.length }}</span>
        </div>
        <div
          v-for="r in g.records"
          :key="r.id"
          class="record-row"
          @click="open(r)"
          @contextmenu="itemCtx($event, r)"
        >
          <span class="chip method" :class="r.request.kind === 'ws' ? 'ws' : r.request.method.toLowerCase()">
            {{ r.request.kind === 'ws' ? 'WS' : r.request.method }}
          </span>
          <div class="record-main">
            <div class="record-name">{{ r.name }}</div>
            <div class="record-url">{{ r.request.url }}</div>
          </div>
          <span class="record-time">{{ timeOf(r.ts) }}</span>
        </div>
      </div>
    </div>

    <div class="history-foot" v-if="history.records.length">
      <button class="btn small danger" @click="clearAll">
        <AppIcon name="trash" :size="12" /> 清空全部
      </button>
      <span class="text-dim total-hint" :title="`最早记录：${history.records.length ? formatDateTime(history.records[history.records.length - 1].ts) : ''}`">
        共 {{ history.records.length }} 条
      </span>
    </div>
  </div>
</template>

<style scoped>
.history-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px 8px;
  flex-shrink: 0;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-2);
}
.search-input {
  flex: 1;
  padding: 5px 9px;
  font-size: 12.5px;
}
.method-select {
  font-size: 12.5px;
}
.records-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 8px;
}
.group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-2);
  font-size: 12px;
  padding: 10px 6px 4px;
}
.group-count {
  background: var(--bg-3);
  border-radius: 8px;
  font-size: 11px;
  padding: 0 7px;
}
.record-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.record-row:hover {
  background: var(--bg-2);
}
.record-main {
  flex: 1;
  min-width: 0;
}
.record-name {
  font-size: 12.6px;
  color: var(--text-0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.record-url {
  font-size: 11.5px;
  color: var(--text-2);
  font-family: var(--mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.record-time {
  font-size: 11px;
  color: var(--text-2);
  flex-shrink: 0;
}
.record-row .chip.method {
  flex-shrink: 0;
  font-size: 10px;
  padding: 0 5px;
}
.history-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg-1);
}
.total-hint {
  font-size: 12px;
}
</style>
