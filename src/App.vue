<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useEnvStore } from '@/stores/env';
import { useHistoryStore } from '@/stores/history';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { db, SKEYS, storageKind } from '@/storage/db';
import AppIcon from '@/components/common/AppIcon.vue';
import TopBar from '@/components/layout/TopBar.vue';
import Sidebar from '@/components/sidebar/Sidebar.vue';
import WorkspaceTabs from '@/components/workspace/WorkspaceTabs.vue';
import ContextMenu from '@/components/common/ContextMenu.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import PromptModal from '@/components/common/PromptModal.vue';
import ToastHost from '@/components/common/ToastHost.vue';
import EnvModal from '@/components/modal/EnvModal.vue';
import SettingsModal from '@/components/modal/SettingsModal.vue';
import SaveRequestModal from '@/components/modal/SaveRequestModal.vue';
import CurlImportModal from '@/components/modal/CurlImportModal.vue';
import ImportApisModal from '@/components/modal/ImportApisModal.vue';
import PostmanImportModal from '@/components/modal/PostmanImportModal.vue';
import CodeGenModal from '@/components/modal/CodeGenModal.vue';
import CookieModal from '@/components/modal/CookieModal.vue';
import CaptureModal from '@/components/modal/CaptureModal.vue';

const library = useLibraryStore();
const env = useEnvStore();
const history = useHistoryStore();
const settings = useSettingsStore();
const ui = useUiStore();

const ready = ref(false);

let lastStorageErrAt = 0;
function onStorageError(e: Event) {
  const { key, message } = (e as CustomEvent).detail as { key: string; message: string };
  const now = Date.now();
  if (now - lastStorageErrAt < 4000) return; // 连续失败时节流，避免 toast 刷屏
  lastStorageErrAt = now;
  ui.toast(`数据保存失败（${key}）：${message}，请检查浏览器存储空间`, 'error');
}

onMounted(async () => {
  window.addEventListener('penapi-storage-error', onStorageError);
  await Promise.all([library.load(), env.load(), history.load(), settings.load()]);
  ready.value = true;
  // 启动诊断：各存储键的数据量，F12 可直接判断数据是否落盘
  try {
    const sizes = await Promise.all(
      Object.values(SKEYS).map(async (key) => {
        const v = await db.get<unknown>(key, null);
        const label = key.split('.').pop();
        return `${label}=${Array.isArray(v) ? v.length + '项' : v ? typeof v : '空'}`;
      }),
    );
    console.info(`[penapi] 存储自检 (${storageKind})`, sizes.join(' / '));
  } catch {
    /* 诊断失败不影响功能 */
  }
});
</script>

<template>
  <!-- 启动加载 -->
  <div v-if="!ready" class="splash">
    <img src="/icons/icon128.png" alt="" class="splash-icon" draggable="false" />
    <div class="splash-text">PenApi 加载中…</div>
  </div>

  <div v-else class="app-shell">
    <TopBar />
    <div class="app-body">
      <Sidebar />
      <WorkspaceTabs />
    </div>

    <!-- 全局单实例：右键菜单 / 确认 / 输入 / Toast / 业务弹窗 -->
    <ContextMenu />
    <ConfirmModal />
    <PromptModal />
    <ToastHost />
    <EnvModal v-if="ui.modal === 'env'" />
    <SettingsModal v-if="ui.modal === 'settings'" />
    <SaveRequestModal v-if="ui.modal === 'save-request'" />
    <CurlImportModal v-if="ui.modal === 'curl-import'" />
    <ImportApisModal v-if="ui.modal === 'import-apis'" />
    <PostmanImportModal v-if="ui.modal === 'postman-import'" />
    <CodeGenModal v-if="ui.modal === 'codegen'" />
    <CookieModal v-if="ui.modal === 'cookies'" />
    <CaptureModal v-if="ui.modal === 'capture'" />
  </div>
</template>

<style scoped>
.splash {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--text-1);
}
.splash-icon {
  width: 58px;
  height: 58px;
  border-radius: 14px;
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
.splash-text {
  font-size: 13px;
  letter-spacing: 2px;
}
.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.app-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
</style>
