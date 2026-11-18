<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';

export interface DropdownOption {
  value: string;
  label: string;
  /** 附加样式类（如方法色 chip-get / chip-post…） */
  colorClass?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: DropdownOption[];
    /** 触发器宽度 */
    width?: string;
    /** 弹层最小宽度，默认与触发器同宽 */
    menuMinWidth?: string;
    /** 选项是否使用方法色文字 */
    colorful?: boolean;
  }>(),
  { width: '', menuMinWidth: '', colorful: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const rootEl = ref<HTMLElement | null>(null);
const triggerEl = ref<HTMLElement | null>(null);
/** 菜单 Teleport 到 body，需独立引用（不在 rootEl 内） */
const menuEl = ref<HTMLElement | null>(null);
const open = ref(Boolean());
const x = ref(0);
const y = ref(0);
const minWidth = ref('0');

const current = computed(() => props.options.find((o) => o.value === props.modelValue));

/** 方法色映射（与 chip 类同源的色板） */
function colorClassOf(value: string): string {
  const map: Record<string, string> = {
    GET: 'c-get',
    POST: 'c-post',
    PUT: 'c-put',
    DELETE: 'c-delete',
    PATCH: 'c-patch',
    HEAD: 'c-neutral',
    OPTIONS: 'c-neutral',
  };
  return map[value] ?? '';
}

async function toggle() {
  if (open.value) {
    open.value = Boolean();
    return;
  }
  const rect = triggerEl.value!.getBoundingClientRect();
  minWidth.value = `${rect.width}px`;
  x.value = rect.left;
  y.value = rect.bottom + 5;
  open.value = true;
  await nextTick(align);
}

async function align() {
  await nextTick();
  const el = menuEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (y.value + r.height > window.innerHeight - 8) {
    // 上翻
    y.value = Math.max(8, triggerEl.value!.getBoundingClientRect().top - r.height - 5);
  }
  if (x.value + r.width > window.innerWidth - 8) {
    x.value = window.innerWidth - r.width - 8;
  }
}

function pick(opt: DropdownOption) {
  emit('update:modelValue', opt.value);
  open.value = Boolean();
}

function onGlobalDown(e: MouseEvent) {
  if (!open.value) return;
  const t = e.target as Node;
  // 触发器区域或 Teleport 出去的菜单内部都算"内部"
  if (rootEl.value?.contains(t) || menuEl.value?.contains(t)) return;
  open.value = Boolean();
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = Boolean();
}

onMounted(() => {
  window.addEventListener('mousedown', onGlobalDown, true);
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', close);
  window.addEventListener('blur', close);
});
onUnmounted(() => {
  window.removeEventListener('mousedown', onGlobalDown, true);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', close);
  window.removeEventListener('blur', close);
});

function close() {
  open.value = Boolean();
}
</script>

<template>
  <div ref="rootEl" class="dd-root">
    <button
      ref="triggerEl"
      type="button"
      class="dd-trigger"
      :class="{ open }"
      :style="width ? { width } : undefined"
      @click="toggle"
    >
      <span class="dd-label" :class="colorful ? colorClassOf(modelValue) : ''">
        {{ current?.label ?? modelValue }}
      </span>
      <AppIcon name="chevron-down" :size="12" class="dd-caret" :class="{ flip: open }" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuEl"
        class="dd-menu"
        :style="{ left: x + 'px', top: y + 'px', minWidth: menuMinWidth || minWidth }"
      >
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="dd-item"
          :class="{ on: opt.value === modelValue }"
          @click="pick(opt)"
        >
          <AppIcon v-if="opt.value === modelValue" name="check" :size="13" class="dd-check" />
          <span v-else class="dd-check-placeholder" />
          <span class="dd-item-label" :class="colorful ? colorClassOf(opt.value) : ''">
            {{ opt.label }}
          </span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.dd-root {
  position: relative;
  display: inline-block;
}
.dd-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-0);
  padding: 6px 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  min-width: 0;
}
.dd-trigger:hover {
  border-color: var(--border-strong);
  background: var(--bg-3);
}
.dd-trigger.open {
  border-color: var(--accent-line);
  box-shadow: 0 0 0 3px var(--accent-dim);
}
.dd-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.dd-caret {
  color: var(--text-2);
  transition: transform 0.15s;
  flex-shrink: 0;
}
.dd-caret.flip {
  transform: rotate(180deg);
}

.dd-menu {
  position: fixed;
  z-index: 210;
  background: var(--bg-2);
  border: 1px solid var(--border-strong);
  border-radius: 9px;
  padding: 4px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  animation: dd-in 0.12s ease;
  max-height: 320px;
  overflow-y: auto;
}
@keyframes dd-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
.dd-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 6px 9px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-0);
  cursor: pointer;
  text-align: left;
  font-size: 12.8px;
}
.dd-item:hover {
  background: var(--bg-3);
}
.dd-item.on {
  background: var(--accent-dim);
}
.dd-check {
  color: var(--accent);
  flex-shrink: 0;
}
.dd-check-placeholder {
  width: 13px;
  flex-shrink: 0;
}
.dd-item-label {
  font-weight: 500;
}
.dd-item.on .dd-item-label {
  font-weight: 650;
}

/* 方法色（与 global.css chip 同源） */
.c-get {
  color: var(--green);
}
.c-post {
  color: var(--blue);
}
.c-put {
  color: var(--orange);
}
.c-delete {
  color: var(--red);
}
.c-patch {
  color: var(--purple);
}
.c-neutral {
  color: var(--text-1);
}
</style>
