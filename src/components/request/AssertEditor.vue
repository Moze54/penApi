<script setup lang="ts">
import type { AssertOp, AssertRule, AssertType, RequestConfig } from '@/types';
import { newAssertRule, newExtractRule, ASSERT_OP_LABELS, ASSERT_TYPE_LABELS } from '@/core/assert';
import Dropdown from '@/components/common/Dropdown.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const props = defineProps<{ request: RequestConfig }>();
const emit = defineEmits<{ change: [] }>();

if (!props.request.tests) props.request.tests = [];
if (!props.request.extracts) props.request.extracts = [];
const tests = props.request.tests;
const extracts = props.request.extracts;

const TYPE_OPTIONS = (Object.keys(ASSERT_TYPE_LABELS) as AssertType[]).map((k) => ({
  value: k,
  label: ASSERT_TYPE_LABELS[k],
}));
const OP_OPTIONS = (Object.keys(ASSERT_OP_LABELS) as AssertOp[]).map((k) => ({
  value: k,
  label: ASSERT_OP_LABELS[k],
}));

function setType(rule: AssertRule, type: AssertType) {
  rule.type = type;
  if (type === 'status' && !rule.value.trim()) rule.value = '200';
  if (type === 'time' && !rule.value.trim()) rule.value = '500';
  if (type === 'status' || type === 'time') rule.target = '';
  emit('change');
}

function placeholderOf(rule: AssertRule): string {
  if (rule.type === 'status') return '状态码，如 200';
  if (rule.type === 'time') return '最大毫秒数，如 500';
  return '期望值';
}

function addTest() {
  tests.push(newAssertRule());
  emit('change');
}

function removeTest(rule: AssertRule) {
  const idx = tests.indexOf(rule);
  if (idx >= 0) tests.splice(idx, 1);
  emit('change');
}

function addExtract() {
  extracts.push(newExtractRule());
  emit('change');
}

function removeExtract(rule: (typeof extracts)[number]) {
  const idx = extracts.indexOf(rule);
  if (idx >= 0) extracts.splice(idx, 1);
  emit('change');
}
</script>

<template>
  <div class="assert-editor">
    <!-- 断言 -->
    <div class="az-section">
      <div class="az-head">
        <span class="az-title">断言</span>
        <span class="az-hint">发送后自动校验响应，失败项在响应区标红</span>
      </div>
      <div v-for="rule in tests" :key="rule.id" class="az-row">
        <input v-model="rule.enabled" type="checkbox" class="az-check" @change="emit('change')" />
        <Dropdown
          :model-value="rule.type"
          :options="TYPE_OPTIONS"
          width="104px"
          @update:model-value="(v) => setType(rule, v as AssertType)"
        />
        <input
          v-if="rule.type === 'jsonpath' || rule.type === 'header'"
          v-model="rule.target"
          class="input az-input target"
          :placeholder="rule.type === 'jsonpath' ? 'JSON 路径，如 data.token' : 'Header 名称'"
          spellcheck="false"
          @input="emit('change')"
        />
        <Dropdown
          :model-value="rule.op"
          :options="OP_OPTIONS"
          width="92px"
          @update:model-value="(v) => { rule.op = v as AssertOp; emit('change'); }"
        />
        <input
          v-if="rule.op !== 'exists'"
          v-model="rule.value"
          class="input az-input"
          :placeholder="placeholderOf(rule)"
          spellcheck="false"
          @input="emit('change')"
        />
        <button class="btn ghost icon-only az-del" title="删除断言" @click="removeTest(rule)">
          <AppIcon name="trash" :size="13" />
        </button>
      </div>
      <button class="btn small az-add" @click="addTest"><AppIcon name="plus" :size="12" /> 添加断言</button>
    </div>

    <!-- 提取变量 -->
    <div class="az-section">
      <div class="az-head">
        <span class="az-title">提取变量</span>
        <span class="az-hint" v-pre>从响应 JSON 提取值写入当前环境变量（{{键名}} 可直接引用）</span>
      </div>
      <div v-for="rule in extracts" :key="rule.id" class="az-row">
        <input v-model="rule.enabled" type="checkbox" class="az-check" @change="emit('change')" />
        <input
          v-model="rule.path"
          class="input az-input target"
          placeholder="JSON 路径，如 data.token"
          spellcheck="false"
          @input="emit('change')"
        />
        <span class="az-arrow">→</span>
        <input
          v-model="rule.varName"
          class="input az-input"
          placeholder="变量名，如 token"
          spellcheck="false"
          @input="emit('change')"
        />
        <button class="btn ghost icon-only az-del" title="删除提取" @click="removeExtract(rule)">
          <AppIcon name="trash" :size="13" />
        </button>
      </div>
      <button class="btn small az-add" @click="addExtract"><AppIcon name="plus" :size="12" /> 添加提取</button>
    </div>
  </div>
</template>

<style scoped>
.assert-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 16px 14px;
}
.az-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.az-section + .az-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}
.az-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 3px;
}
.az-title {
  font-size: 13px;
  font-weight: 620;
  color: var(--text-0);
}
.az-hint {
  font-size: 11.5px;
  color: var(--text-2);
}
.az-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 4px;
  margin: 0 -4px;
  border-radius: 6px;
  transition: background 0.12s;
}
.az-row:hover {
  background: var(--bg-2);
}
.az-check {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.az-input {
  flex: 1;
  min-width: 0;
  padding: 5px 9px;
  font-size: 12.5px;
}
.az-input.target {
  flex: 1.4;
}
.az-arrow {
  color: var(--accent);
  flex-shrink: 0;
  font-size: 13px;
}
.az-del {
  flex-shrink: 0;
}
.az-del:hover {
  color: var(--red);
}
.az-add {
  align-self: flex-start;
  color: var(--text-1);
}
.az-add:hover {
  color: var(--accent);
  border-color: var(--accent-line);
}
</style>
