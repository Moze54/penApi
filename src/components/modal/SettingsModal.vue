<script setup lang="ts">
import { ref } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useLibraryStore } from '@/stores/library';
import { useEnvStore } from '@/stores/env';
import { useHistoryStore } from '@/stores/history';
import { useUiStore } from '@/stores/ui';
import { storageKind } from '@/storage/db';
import AppModal from '@/components/common/AppModal.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const settings = useSettingsStore();
const library = useLibraryStore();
const env = useEnvStore();
const history = useHistoryStore();
const ui = useUiStore();

const fileInput = ref<HTMLInputElement | null>(null);

function numVal(v: string, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function updateTimeout(v: string) {
  settings.update({ timeout: numVal(v, 1, 600, 30) });
}
function updateHistoryLimit(v: string) {
  settings.update({ historyLimit: numVal(v, 10, 5000, 500) });
}

function exportBackup() {
  const data = {
    app: 'penapi',
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: library.projects,
    nodes: library.nodes,
    envs: env.envs,
    history: history.records,
    settings: settings.settings,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  a.href = url;
  a.download = `penapi-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  ui.toast('备份已导出');
}

function pickImport() {
  fileInput.value?.click();
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data?.app !== 'penapi' || !Array.isArray(data.projects) || !Array.isArray(data.nodes)) {
      ui.toast('文件格式不正确：不是 PenApi 备份文件', 'error');
      return;
    }
    const ok = await ui.askConfirm({
      title: '导入备份',
      message: `导入将覆盖当前全部数据（${data.projects.length} 个项目 / ${data.nodes.length} 个接口 / ${Array.isArray(data.history) ? data.history.length : 0} 条历史），确定继续吗？`,
      okText: '导入',
      danger: true,
    });
    if (!ok) return;
    library.importAll(data.projects, data.nodes);
    env.importAll(Array.isArray(data.envs) ? data.envs : []);
    history.importAll(Array.isArray(data.history) ? data.history : []);
    settings.importAll(data.settings ?? {});
    ui.toast('备份导入完成');
  } catch (err) {
    ui.toast(`导入失败：${(err as Error).message}`, 'error');
  }
}

async function clearAllData() {
  const ok = await ui.askConfirm({
    title: '清空全部数据',
    message: '将删除所有项目、接口、环境变量与历史记录，该操作不可恢复，建议先导出备份。',
    okText: '清空',
    danger: true,
  });
  if (!ok) return;
  library.importAll([], []);
  env.importAll([]);
  history.importAll([]);
  ui.toast('数据已清空');
}
</script>

<template>
  <AppModal title="设置与备份" width="520px" @close="ui.closeModal()">
    <div class="settings-body">
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">请求超时</div>
          <div class="setting-desc">超过该时间未响应自动中断（1 - 600 秒）</div>
        </div>
        <input
          class="input num-input"
          type="number"
          min="1"
          max="600"
          :value="settings.settings.timeout"
          @change="updateTimeout(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">历史保留条数</div>
          <div class="setting-desc">超出后自动清理最旧记录（10 - 5000 条）</div>
        </div>
        <input
          class="input num-input"
          type="number"
          min="10"
          max="5000"
          :value="settings.settings.historyLimit"
          @change="updateHistoryLimit(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="setting-sep" />

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">数据存储</div>
          <div class="setting-desc">
            {{ storageKind === 'extension' ? '浏览器扩展本地存储（chrome.storage.local）' : '网页模式：浏览器 localStorage（开发调试用）' }}
          </div>
        </div>
      </div>

      <div class="backup-actions">
        <button class="btn" @click="exportBackup">
          <AppIcon name="download" :size="13" /> 导出备份
        </button>
        <button class="btn" @click="pickImport">
          <AppIcon name="upload" :size="13" /> 导入备份
        </button>
        <button class="btn danger" @click="clearAllData">
          <AppIcon name="trash" :size="13" /> 清空全部数据
        </button>
      </div>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImportFile" />
    </div>

    <template #footer>
      <button class="btn primary" @click="ui.closeModal()">完成</button>
    </template>
  </AppModal>
</template>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 0;
}
.setting-info {
  flex: 1;
}
.setting-label {
  font-size: 13px;
  color: var(--text-0);
}
.setting-desc {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
}
.num-input {
  width: 92px;
  padding: 6px 10px;
  font-size: 13px;
}
.setting-sep {
  height: 1px;
  background: var(--border);
  margin: 8px 0;
}
.backup-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}
</style>
