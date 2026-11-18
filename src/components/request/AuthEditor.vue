<script setup lang="ts">
import { computed } from 'vue';
import type { AuthConfig } from '@/types';

const props = defineProps<{ auth: AuthConfig }>();
const emit = defineEmits<{ change: [] }>();

const OPTIONS = [
  { value: 'none', label: '无认证' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
] as const;

function setType(t: AuthConfig['type']) {
  props.auth.type = t;
  emit('change');
}

const desc = computed(() => {
  if (props.auth.type === 'bearer') return '请求头将添加 Authorization: Bearer <token>';
  if (props.auth.type === 'basic') return '请求头将添加 Authorization: Basic <base64(用户名:密码)>';
  return '不添加认证信息';
});
</script>

<template>
  <div class="auth-editor">
    <div class="type-pills">
      <button
        v-for="o in OPTIONS"
        :key="o.value"
        class="pill"
        :class="{ on: auth.type === o.value }"
        @click="setType(o.value)"
      >
        {{ o.label }}
      </button>
    </div>

    <div class="auth-form">
      <div class="auth-desc">{{ desc }}</div>

      <label v-if="auth.type === 'bearer'" class="field">
        <span class="field-label">Token</span>
        <input
          v-model="auth.token"
          class="input mono"
          placeholder="粘贴访问令牌"
          spellcheck="false"
          @input="emit('change')"
        />
      </label>

      <template v-if="auth.type === 'basic'">
        <label class="field">
          <span class="field-label">用户名</span>
          <input
            v-model="auth.username"
            class="input mono"
            placeholder="username"
            spellcheck="false"
            autocomplete="off"
            @input="emit('change')"
          />
        </label>
        <label class="field">
          <span class="field-label">密码</span>
          <input
            v-model="auth.password"
            class="input mono"
            type="password"
            placeholder="password"
            autocomplete="off"
            @input="emit('change')"
          />
        </label>
      </template>
    </div>
  </div>
</template>

<style scoped>
.auth-editor {
  padding-bottom: 14px;
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
.auth-form {
  padding: 4px 14px 0;
  max-width: 560px;
}
.auth-desc {
  color: var(--text-2);
  font-size: 12px;
  margin-bottom: 10px;
}
.field {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.field-label {
  width: 64px;
  color: var(--text-1);
  font-size: 12.5px;
  flex-shrink: 0;
  text-align: right;
}
.field .input {
  flex: 1;
  padding: 6px 10px;
  font-size: 12.5px;
}
</style>
