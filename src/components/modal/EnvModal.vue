<script setup lang="ts">
import { computed, ref } from 'vue';
import { useEnvStore } from '@/stores/env';
import { useUiStore } from '@/stores/ui';
import type { Environment } from '@/types';
import AppModal from '@/components/common/AppModal.vue';
import KvEditor from '@/components/common/KvEditor.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import EmptyState from '@/components/common/EmptyState.vue';

const env = useEnvStore();
const ui = useUiStore();

const selectedId = ref<string>(env.envs[0]?.id ?? '');
const selected = computed<Environment | null>(
  () => env.envs.find((e) => e.id === selectedId.value) ?? null,
);

function select(en: Environment) {
  selectedId.value = en.id;
}

async function addEnv() {
  const name = await ui.askPrompt({
    title: '新建环境',
    label: '环境名称（如：开发 / 测试 / 生产）',
    value: '',
    placeholder: '例如：测试环境',
    okText: '创建',
  });
  if (name == null) return;
  const created = env.createEnv(name);
  selectedId.value = created.id;
}

async function renameEnv() {
  if (!selected.value) return;
  const name = await ui.askPrompt({
    title: '重命名环境',
    label: '环境名称',
    value: selected.value.name,
    okText: '保存',
  });
  if (name != null) env.renameEnv(selected.value.id, name);
}

async function removeEnv() {
  if (!selected.value) return;
  const ok = await ui.askConfirm({
    title: '删除环境',
    message: `确定删除环境「${selected.value.name}」及其全部变量吗？`,
    okText: '删除',
    danger: true,
  });
  if (ok) {
    env.deleteEnv(selected.value.id);
    selectedId.value = env.envs[0]?.id ?? '';
  }
}

function close() {
  ui.closeModal();
}
</script>

<template>
  <AppModal title="环境变量管理" width="760px" @close="ui.closeModal()">
    <div class="env-layout">
      <!-- 左：环境列表 -->
      <div class="env-side">
        <div class="env-side-head">
          <span>环境列表</span>
          <button class="btn ghost icon-only" title="新建环境" @click="addEnv">
            <AppIcon name="plus" :size="13" />
          </button>
        </div>
        <EmptyState v-if="env.envs.length === 0" icon="globe" text="还没有环境" />
        <button
          v-for="en in env.envs"
          :key="en.id"
          class="env-item"
          :class="{ on: en.id === selectedId }"
          @click="select(en)"
        >
          <AppIcon name="globe" :size="13" />
          <span class="env-item-name">{{ en.name }}</span>
          <span class="env-item-count">{{ en.vars.length }}</span>
        </button>
        <div class="env-side-foot" v-if="selected">
          <button class="btn small" @click="renameEnv">
            <AppIcon name="edit" :size="12" /> 重命名
          </button>
          <button class="btn small danger" @click="removeEnv">
            <AppIcon name="trash" :size="12" /> 删除
          </button>
        </div>
      </div>

      <!-- 右：变量编辑 -->
      <div class="env-main">
        <template v-if="selected">
          <div class="env-hint">
            在请求的任意文本（URL / 参数 / 请求头 / Body）中用 <code v-pre>{{变量名}}</code> 引用，发送时自动替换为当前启用环境的值。
          </div>
          <KvEditor
            :rows="selected?.vars ?? []"
            key-placeholder="变量名，如 baseUrl"
            value-placeholder="变量值，如 https://api.test.com"
            add-label="变量"
            @change="env.persist()"
          />
        </template>
        <EmptyState v-else icon="globe" text="选择或新建一个环境" />
      </div>
    </div>

    <template #footer>
      <button class="btn primary" @click="close">完成</button>
    </template>
  </AppModal>
</template>

<style scoped>
.env-layout {
  display: flex;
  gap: 14px;
  min-height: 320px;
}
.env-side {
  width: 190px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding-right: 14px;
  display: flex;
  flex-direction: column;
}
.env-side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-1);
  font-size: 12.5px;
  margin-bottom: 8px;
}
.env-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-1);
  padding: 7px 9px;
  cursor: pointer;
  font-size: 12.8px;
  text-align: left;
}
.env-item:hover {
  background: var(--bg-2);
  color: var(--text-0);
}
.env-item.on {
  background: var(--accent-dim);
  color: var(--accent);
}
.env-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.env-item-count {
  font-size: 11px;
  color: var(--text-2);
}
.env-side-foot {
  margin-top: auto;
  padding-top: 10px;
  display: flex;
  gap: 6px;
}
.env-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.env-hint {
  color: var(--text-2);
  font-size: 12px;
  margin-bottom: 10px;
  line-height: 1.6;
}
.env-hint code {
  font-family: var(--mono);
  color: var(--accent);
  background: var(--accent-dim);
  padding: 0 4px;
  border-radius: 4px;
}
</style>
