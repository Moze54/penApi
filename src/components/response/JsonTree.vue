<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{ data: unknown; name?: string; depth?: number }>(),
  { name: '', depth: 0 },
);

const isArr = computed(() => Array.isArray(props.data));
const isObj = computed(
  () => !isArr.value && typeof props.data === 'object' && props.data !== null,
);
const isBranch = computed(() => isArr.value || isObj.value);

const entries = computed<[string, unknown][]>(() => {
  if (isArr.value) return (props.data as unknown[]).map((v, i) => [String(i), v]);
  if (isObj.value) return Object.entries(props.data as Record<string, unknown>);
  return [];
});

/** 第 3 层起默认折叠，避免大响应刷屏 */
const collapsed = ref(props.depth >= 2);

const summary = computed(() =>
  isArr.value ? `[…] ${entries.value.length} 项` : `{…} ${entries.value.length} 个属性`,
);

function valueClass(v: unknown): string {
  if (typeof v === 'string') return 'v-str';
  if (typeof v === 'number') return 'v-num';
  if (typeof v === 'boolean') return 'v-bool';
  return 'v-null';
}

function valueText(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === null) return 'null';
  return String(v);
}
</script>

<template>
  <div class="json-node" :style="{ paddingLeft: depth === 0 ? 0 : '14px' }">
    <template v-if="isBranch">
      <button class="node-line" @click="collapsed = !collapsed">
        <span class="arrow" :class="{ open: !collapsed }">▸</span>
        <span v-if="name !== ''" class="key">{{ name }}</span>
        <span v-if="name !== ''" class="colon">:</span>
        <span class="bracket">{{ isArr ? '[' : '{' }}</span>
        <span v-if="collapsed" class="summary">{{ summary }}</span>
        <span v-else />
        <span v-if="collapsed" class="bracket">{{ isArr ? ']' : '}' }}</span>
      </button>
      <template v-if="!collapsed">
        <JsonTree
          v-for="[k, v] in entries"
          :key="k"
          :data="v"
          :name="k"
          :depth="depth + 1"
        />
        <div class="close-line" :style="{ paddingLeft: '14px' }">
          <span class="bracket">{{ isArr ? ']' : '}' }}</span>
        </div>
      </template>
    </template>
    <template v-else>
      <div class="leaf-line">
        <span v-if="name !== ''" class="key">{{ name }}</span>
        <span v-if="name !== ''" class="colon">:</span>
        <span class="value" :class="valueClass(data)">{{ valueText(data) }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.json-node {
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.55;
}
.node-line,
.leaf-line,
.close-line {
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}
.node-line {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 1px 0;
  text-align: left;
  width: 100%;
}
.node-line:hover {
  background: rgba(255, 255, 255, 0.03);
}
.arrow {
  display: inline-block;
  color: var(--text-2);
  font-size: 10px;
  transition: transform 0.12s;
  transform-origin: 40% 55%;
}
.arrow.open {
  transform: rotate(90deg);
}
.key {
  color: #7da7ff;
}
.colon {
  color: var(--text-2);
}
.bracket {
  color: var(--text-1);
}
.summary {
  color: var(--text-2);
  font-size: 11.5px;
}
.value.v-str {
  color: #86efac;
}
.value.v-num {
  color: var(--orange);
}
.value.v-bool {
  color: var(--purple);
}
.value.v-null {
  color: var(--text-2);
}
</style>
