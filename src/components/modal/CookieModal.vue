<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import {
  cookiesSupported,
  listCookies,
  saveCookie,
  removeCookie,
  clearDomainCookies,
  type CookieRow,
} from '@/core/cookies';
import AppModal from '@/components/common/AppModal.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import EmptyState from '@/components/common/EmptyState.vue';

const ui = useUiStore();
const workspace = useWorkspaceStore();

function guessDomain(): string {
  const url = workspace.active?.request.url?.trim() ?? '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

const domain = ref(guessDomain());
const rows = ref<CookieRow[]>([]);
const loading = ref(false);

const formName = ref('');
const formValue = ref('');
const formPath = ref('/');

const editing = ref<CookieRow | null>(null);
const editValue = ref('');
const editPath = ref('/');

async function query() {
  if (!domain.value.trim()) {
    ui.toast('请输入域名', 'error');
    return;
  }
  loading.value = true;
  try {
    rows.value = await listCookies(domain.value);
  } catch (e) {
    ui.toast((e as Error).message, 'error');
  } finally {
    loading.value = false;
  }
}

async function add() {
  if (!formName.value.trim()) {
    ui.toast('请输入 Cookie 名', 'error');
    return;
  }
  try {
    await saveCookie({
      domain: domain.value.trim(),
      path: formPath.value || '/',
      name: formName.value.trim(),
      value: formValue.value,
    });
    formName.value = '';
    formValue.value = '';
    ui.toast('已添加 Cookie');
    await query();
  } catch (e) {
    ui.toast((e as Error).message, 'error');
  }
}

function startEdit(row: CookieRow) {
  editing.value = row;
  editValue.value = row.value;
  editPath.value = row.path;
}

async function saveEdit() {
  const row = editing.value;
  if (!row) return;
  try {
    await saveCookie({
      domain: row.domain,
      path: editPath.value || '/',
      name: row.name,
      value: editValue.value,
      secure: row.secure,
      httpOnly: row.httpOnly,
    });
    editing.value = null;
    ui.toast('已更新 Cookie');
    await query();
  } catch (e) {
    ui.toast((e as Error).message, 'error');
  }
}

async function del(row: CookieRow) {
  const ok = await ui.askConfirm({
    title: '删除 Cookie',
    message: `确定删除「${row.name}」（${row.domain}）？`,
    okText: '删除',
    danger: true,
  });
  if (!ok) return;
  try {
    await removeCookie(row);
    ui.toast('已删除 Cookie');
    await query();
  } catch (e) {
    ui.toast((e as Error).message, 'error');
  }
}

async function clearAll() {
  const ok = await ui.askConfirm({
    title: '清空该域 Cookie',
    message: `将删除 ${domain.value} 下的全部 ${rows.value.length} 条 Cookie，该操作不可撤销。`,
    okText: '清空',
    danger: true,
  });
  if (!ok) return;
  const n = await clearDomainCookies(domain.value);
  ui.toast(`已清空 ${n} 条 Cookie`);
  await query();
}

async function copyHeader() {
  const text = rows.value.map((r) => `${r.name}=${r.value}`).join('; ');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    ui.toast('已复制 Cookie 请求头');
  } catch {
    ui.toast('复制失败', 'error');
  }
}

function expiresText(row: CookieRow): string {
  if (row.session) return '会话';
  if (!row.expirationDate) return '-';
  return new Date(row.expirationDate * 1000).toLocaleDateString();
}

onMounted(() => {
  if (domain.value.trim()) query();
});
</script>

<template>
  <AppModal title="Cookie 管理" width="880px" @close="ui.closeModal()">
    <div class="cookie-form">
      <div class="domain-bar">
        <input
          v-model="domain"
          class="input domain-input mono"
          placeholder="域名，如 api.example.com 或 .example.com"
          spellcheck="false"
          @keydown.enter="query"
        />
        <button class="btn" :disabled="loading" @click="query">查询</button>
        <button class="btn ghost" :disabled="!rows.length" @click="copyHeader">
          <AppIcon name="copy" :size="13" /> 复制 Cookie 头
        </button>
        <button class="btn ghost danger-hover" :disabled="!rows.length" @click="clearAll">清空该域</button>
      </div>

      <div v-if="!cookiesSupported" class="web-note">
        网页开发模式仅支持读取当前页面同域的 Cookie；完整的查看 / 编辑 / 删除请加载扩展后使用。
      </div>

      <div class="cookie-table">
        <div class="ct-head">
          <span class="c-name">名称</span>
          <span class="c-val">值</span>
          <span class="c-domain">域 / 路径</span>
          <span class="c-flag">属性</span>
          <span class="c-exp">过期</span>
          <span class="c-act" />
        </div>

        <div v-for="row in rows" :key="row.domain + row.path + row.name" class="ct-row">
          <template v-if="editing === row">
            <span class="c-name mono ellip">{{ row.name }}</span>
            <input v-model="editValue" class="input c-val mono" spellcheck="false" @keydown.enter="saveEdit" />
            <input v-model="editPath" class="input c-domain mono" spellcheck="false" @keydown.enter="saveEdit" />
            <span class="c-flag" />
            <span class="c-exp" />
            <span class="c-act">
              <button class="btn small primary" @click="saveEdit">保存</button>
              <button class="btn small" @click="editing = null">取消</button>
            </span>
          </template>
          <template v-else>
            <span class="c-name mono ellip" :title="row.name">{{ row.name }}</span>
            <span class="c-val mono ellip" :title="row.value">{{ row.value }}</span>
            <span class="c-domain mono ellip" :title="`${row.domain} ${row.path}`">{{ row.domain }} {{ row.path }}</span>
            <span class="c-flag">
              <span v-if="row.secure" class="flag">Secure</span>
              <span v-if="row.httpOnly" class="flag">HttpOnly</span>
            </span>
            <span class="c-exp">{{ expiresText(row) }}</span>
            <span class="c-act">
              <button class="btn ghost icon-only" title="编辑" @click="startEdit(row)">
                <AppIcon name="edit" :size="13" />
              </button>
              <button class="btn ghost icon-only danger-hover" title="删除" @click="del(row)">
                <AppIcon name="trash" :size="13" />
              </button>
            </span>
          </template>
        </div>

        <EmptyState v-if="!rows.length && !loading" icon="cookie" text="暂无 Cookie，输入域名查询或直接添加" />
      </div>

      <div class="add-bar">
        <input v-model="formName" class="input" placeholder="Cookie 名" spellcheck="false" />
        <input v-model="formValue" class="input" placeholder="值" spellcheck="false" @keydown.enter="add" />
        <input v-model="formPath" class="input path mono" placeholder="/" spellcheck="false" />
        <button class="btn primary" :disabled="!formName.trim()" @click="add">
          <AppIcon name="plus" :size="13" /> 添加
        </button>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.cookie-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.domain-bar {
  display: flex;
  gap: 8px;
}
.domain-input {
  flex: 1;
  padding: 7px 10px;
}
.danger-hover:hover {
  color: var(--red);
  border-color: rgba(255, 107, 107, 0.4);
}
.web-note {
  font-size: 11.8px;
  color: var(--orange);
  background: rgba(255, 182, 72, 0.08);
  border: 1px solid rgba(255, 182, 72, 0.25);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
}
.cookie-table {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-0);
  max-height: 46vh;
  overflow-y: auto;
}
.ct-head,
.ct-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 200px 128px 92px 84px;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
}
.ct-head {
  position: sticky;
  top: 0;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  font-size: 11.5px;
  color: var(--text-2);
  z-index: 1;
}
.ct-row {
  border-bottom: 1px solid var(--border);
  font-size: 12.3px;
  transition: background 0.12s;
}
.ct-row:last-child {
  border-bottom: none;
}
.ct-row:hover {
  background: var(--bg-2);
}
.ellip {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.c-name {
  font-weight: 550;
  color: var(--text-0);
}
.c-val {
  color: var(--text-1);
}
.c-val.input {
  padding: 4px 8px;
  font-size: 12px;
}
.c-domain {
  color: var(--text-2);
  font-size: 11.8px;
}
.c-domain.input {
  padding: 4px 8px;
  font-size: 12px;
}
.c-flag {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.flag {
  font-size: 10px;
  color: var(--blue);
  background: rgba(85, 162, 255, 0.12);
  border-radius: 4px;
  padding: 0 5px;
  line-height: 16px;
}
.c-exp {
  color: var(--text-2);
  font-size: 11.8px;
}
.c-act {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
}
.add-bar {
  display: flex;
  gap: 8px;
}
.add-bar .input {
  padding: 7px 10px;
}
.add-bar .input:first-child {
  width: 180px;
}
.add-bar .path {
  width: 90px;
}
</style>
