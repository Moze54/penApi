<script setup lang="ts">
import { ref } from 'vue';
import type { KV } from '@/types';
import { newKV } from '@/core/kv';
import AppIcon from './AppIcon.vue';

const props = withDefaults(
  defineProps<{
    rows: KV[];
    keyPlaceholder?: string;
    valuePlaceholder?: string;
    /** 是否允许文件类型行（form-data） */
    allowFile?: boolean;
    addLabel?: string;
  }>(),
  {
    keyPlaceholder: '键',
    valuePlaceholder: '值',
    allowFile: false,
    addLabel: '一行',
  },
);

const emit = defineEmits<{ change: [] }>();

const fileInputEl = ref<HTMLInputElement | null>(null);
let pendingFileRow: KV | null = null;

function changed() {
  emit('change');
}

function addRow() {
  props.rows.push(newKV());
  changed();
}

function removeRow(row: KV) {
  const idx = props.rows.indexOf(row);
  if (idx >= 0) props.rows.splice(idx, 1);
  changed();
}

function toggleType(row: KV) {
  row.type = row.type === 'file' ? 'text' : 'file';
  if (row.type === 'text') {
    row.file = null;
    row.fileName = undefined;
    row.value = '';
  } else {
    row.value = row.fileName ?? '';
  }
  changed();
}

function pickFile(row: KV) {
  pendingFileRow = row;
  fileInputEl.value?.click();
}

function onFileChosen(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f && pendingFileRow) {
    pendingFileRow.file = f;
    pendingFileRow.fileName = f.name;
    pendingFileRow.value = f.name;
    changed();
  }
  pendingFileRow = null;
  input.value = '';
}
</script>

<template>
  <div class="kv-editor">
    <div v-if="rows.length === 0" class="kv-empty">暂无内容</div>

    <div v-for="row of rows" :key="row.id" class="kv-row">
      <input v-model="row.enabled" type="checkbox" title="启用/禁用" @change="changed" />

      <template v-if="row.type === 'file'">
        <input
          class="input mono kv-key"
          v-model="row.key"
          placeholder="键"
          spellcheck="false"
          @input="changed"
        />
        <div class="kv-filecell">
          <button class="btn small" :title="row.fileName ?? '选择文件'" @click="pickFile(row)">
            <AppIcon name="upload" :size="12" />
            <span class="kv-filename">{{ row.fileName || '选择文件' }}</span>
          </button>
        </div>
      </template>
      <template v-else>
        <input
          class="input mono kv-key"
          v-model="row.key"
          :placeholder="keyPlaceholder"
          spellcheck="false"
          @input="changed"
        />
        <input
          class="input mono kv-value"
          v-model="row.value"
          :placeholder="valuePlaceholder"
          spellcheck="false"
          @input="changed"
        />
      </template>

      <div class="kv-ops">
        <button
          v-if="allowFile"
          class="btn ghost icon-only"
          :title="row.type === 'file' ? '切换为文本' : '切换为文件'"
          @click="toggleType(row)"
        >
          <AppIcon :name="row.type === 'file' ? 'file' : 'upload'" :size="13" />
        </button>
        <button class="btn ghost icon-only" title="删除本行" @click="removeRow(row)">
          <AppIcon name="trash" :size="13" />
        </button>
      </div>
    </div>

    <button class="kv-add" @click="addRow">
      <AppIcon name="plus" :size="12" />
      添加{{ addLabel }}
    </button>

    <input ref="fileInputEl" type="file" hidden @change="onFileChosen" />
  </div>
</template>

<style scoped>
.kv-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
}
.kv-empty {
  color: var(--text-2);
  font-size: 12px;
  padding: 2px 0 4px;
}
.kv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 4px;
  margin: 0 -4px;
  border-radius: 6px;
  transition: background 0.12s;
}
.kv-row:hover {
  background: var(--bg-2);
}
.kv-row input[type='checkbox'] {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.kv-row .btn.ghost.icon-only:hover {
  color: var(--red);
}
.kv-key,
.kv-value {
  flex: 1;
  padding: 5px 9px;
  font-size: 12.5px;
}
.kv-filecell {
  flex: 1;
  min-width: 0;
  display: flex;
}
.kv-filename {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kv-ops {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s;
}
.kv-row:hover .kv-ops {
  opacity: 1;
}
.kv-add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  background: transparent;
  border: none;
  color: var(--accent);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 5px;
  font-size: 12.5px;
}
.kv-add:hover {
  background: var(--accent-dim);
}
</style>
