<script setup lang="ts">
import { computed } from 'vue';
import { BODY_TYPES, RAW_TYPES, type BodyConfig } from '@/types';
import KvEditor from '@/components/common/KvEditor.vue';
import Dropdown from '@/components/common/Dropdown.vue';

const props = defineProps<{ body: BodyConfig }>();

const emit = defineEmits<{ change: [] }>();

function setBodyType(t: BodyConfig['type']) {
  props.body.type = t;
  emit('change');
}

function setRawType(t: BodyConfig['rawType']) {
  props.body.rawType = t;
  if (t === 'json') emit('change');
}

const selectedRaw = computed(() => RAW_TYPES.find((r) => r.value === props.body.rawType));

/** JSON 格式化（缩进 2 空格） */
function formatJson() {
  try {
    const parsed = JSON.parse(props.body.raw);
    props.body.raw = JSON.stringify(parsed, null, 2);
    emit('change');
  } catch {
    // 解析失败交给 toast 层；此处简单忽略
  }
}
</script>

<template>
  <div class="body-editor">
    <div class="type-pills">
      <button
        v-for="t in BODY_TYPES"
        :key="t.value"
        class="pill"
        :class="{ on: body.type === t.value }"
        @click="setBodyType(t.value)"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="body.type === 'none'" class="body-hint">该请求不携带请求体</div>

    <template v-else-if="body.type === 'raw'">
      <div class="raw-bar">
        <Dropdown
          :model-value="body.rawType"
          :options="RAW_TYPES.map((r) => ({ value: r.value, label: r.label }))"
          width="110px"
          @update:model-value="(v) => setRawType(v as BodyConfig['rawType'])"
        />
        <span v-if="selectedRaw" class="raw-mime">Content-Type: {{ selectedRaw.mime }}</span>
        <div class="raw-space" />
        <button v-if="body.rawType === 'json'" class="btn small" title="格式化 JSON" @click="formatJson">
          格式化
        </button>
      </div>
      <textarea
        v-model="body.raw"
        class="input mono raw-text"
        placeholder='{"key": "value"}'
        spellcheck="false"
        @input="emit('change')"
      />
    </template>

    <template v-else>
      <div v-if="body.type === 'form-data'" class="body-note">
        文件行：点击行尾「上传」图标切换为文件类型。请求头 Content-Type 由浏览器自动生成。
      </div>
      <KvEditor
        :rows="body.form"
        :allow-file="body.type === 'form-data'"
        add-label="表单项"
        @change="emit('change')"
      />
    </template>
  </div>
</template>

<style scoped>
.body-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.type-pills {
  display: flex;
  gap: 4px;
  padding: 10px 14px 6px;
}
.pill {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-1);
  padding: 3px 12px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.pill:hover {
  border-color: var(--border-strong);
  color: var(--text-0);
}
.pill.on {
  background: var(--accent-dim);
  border-color: var(--accent-line);
  color: var(--accent);
}
.body-hint {
  color: var(--text-2);
  padding: 8px 14px 16px;
  font-size: 12.5px;
}
.body-note {
  color: var(--text-2);
  font-size: 11.8px;
  padding: 2px 14px 6px;
}
.raw-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 14px 6px;
}
.raw-mime {
  font-family: var(--mono);
  font-size: 11.5px;
  color: var(--text-2);
}
.raw-space {
  flex: 1;
}
.raw-text {
  margin: 0 14px 14px;
  min-height: 150px;
  line-height: 1.55;
  font-size: 12.5px;
  white-space: pre;
}
</style>
