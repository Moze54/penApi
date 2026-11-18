// Postman Collection v2.1 解析：保留文件夹树 → 项目树
import type { AuthConfig, BodyConfig, HttpMethod, KV, RequestConfig } from '@/types';
import { HTTP_METHODS } from '@/types';
import { uid } from './util';

export interface PostmanNode {
  type: 'folder' | 'request';
  name: string;
  children?: PostmanNode[];
  request?: RequestConfig;
}

export interface PostmanParseResult {
  name: string;
  nodes: PostmanNode[];
  issues: string[];
  folderCount: number;
  requestCount: number;
}

interface PmQuery {
  key?: string;
  value?: string;
  disabled?: boolean;
}

interface PmUrlObject {
  raw?: string;
  protocol?: string;
  host?: string[] | string;
  path?: string[] | string;
  query?: PmQuery[];
}

interface PmHeader {
  key?: string;
  value?: string;
  disabled?: boolean;
}

interface PmFormRow {
  key?: string;
  value?: string;
  disabled?: boolean;
  type?: string;
  src?: unknown;
}

interface PmBody {
  mode?: string;
  raw?: string;
  urlencoded?: PmFormRow[];
  formdata?: PmFormRow[];
  options?: { raw?: { language?: string } };
}

interface PmAuthParam {
  key?: string;
  value?: string;
}

interface PmAuth {
  type?: string;
  bearer?: PmAuthParam[];
  basic?: PmAuthParam[];
}

interface PmRequest {
  method?: string;
  url?: string | PmUrlObject;
  header?: PmHeader[];
  body?: PmBody;
  auth?: PmAuth;
}

interface PmItem {
  name?: string;
  item?: PmItem[];
  request?: PmRequest;
}

function newRow(key: string, value: string, enabled: boolean): KV {
  return { id: uid(), key, value, enabled, type: 'text', file: null };
}

function urlOf(u: PmRequest['url']): string {
  if (typeof u === 'string') return u.trim();
  if (!u || typeof u !== 'object') return '';
  if (typeof u.raw === 'string' && u.raw.trim()) return u.raw.trim();
  const host = Array.isArray(u.host) ? u.host.join('.') : typeof u.host === 'string' ? u.host : '';
  const path = Array.isArray(u.path) ? u.path.join('/') : typeof u.path === 'string' ? u.path : '';
  if (!host) return '';
  return `${u.protocol ?? 'https'}://${host}${path ? '/' + path : ''}`;
}

function convertBody(pm: PmBody | undefined, headers: KV[], issues: string[]): BodyConfig {
  const base: BodyConfig = { type: 'none', rawType: 'json', raw: '', form: [] };
  if (!pm || !pm.mode) return base;

  if (pm.mode === 'raw') {
    base.type = 'raw';
    base.raw = typeof pm.raw === 'string' ? pm.raw : '';
    const lang = pm.options?.raw?.language?.toLowerCase() ?? '';
    const ct = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value.toLowerCase() ?? '';
    if (lang === 'xml' || ct.includes('xml')) base.rawType = 'xml';
    else if (lang === 'html' || ct.includes('html')) base.rawType = 'html';
    else if (lang === 'javascript' || ct.includes('javascript')) base.rawType = 'javascript';
    else if (lang === 'json' || ct.includes('json') || /^[[{]/.test(base.raw.trim())) base.rawType = 'json';
    else base.rawType = 'text';
    return base;
  }

  if (pm.mode === 'urlencoded' && Array.isArray(pm.urlencoded)) {
    base.type = 'urlencoded';
    for (const row of pm.urlencoded) {
      if (!row || !row.key) continue;
      base.form.push(newRow(row.key, row.value ?? '', row.disabled !== true));
    }
    return base;
  }

  if (pm.mode === 'formdata' && Array.isArray(pm.formdata)) {
    base.type = 'form-data';
    let hasFile = false;
    for (const row of pm.formdata) {
      if (!row || !row.key) continue;
      const isFile = row.type === 'file';
      if (isFile) hasFile = true;
      const kv = newRow(row.key, isFile ? '' : row.value ?? '', row.disabled !== true);
      if (isFile) {
        kv.type = 'file';
        kv.fileName = typeof row.src === 'string' ? row.src.split('/').pop() || '文件' : '文件';
      }
      base.form.push(kv);
    }
    if (hasFile) issues.push('form-data 中的文件项仅保留文件名提示，导入后需重新选择文件');
    return base;
  }

  issues.push(`body.mode "${pm.mode}" 暂不支持，已按无请求体处理`);
  return base;
}

function findAuthParam(list: PmAuthParam[] | undefined, keys: string[]): string {
  if (!Array.isArray(list)) return '';
  const hit = list.find((x) => x && typeof x.key === 'string' && keys.includes(x.key.toLowerCase()));
  return typeof hit?.value === 'string' ? hit.value : '';
}

function convertAuth(pm: PmAuth | undefined, issues: string[]): AuthConfig {
  const base: AuthConfig = { type: 'none', token: '', username: '', password: '' };
  if (!pm || !pm.type) return base;
  const type = pm.type.toLowerCase();
  if (type === 'bearer') {
    base.type = 'bearer';
    base.token = findAuthParam(pm.bearer, ['token']);
    return base;
  }
  if (type === 'basic') {
    base.type = 'basic';
    base.username = findAuthParam(pm.basic, ['username']);
    base.password = findAuthParam(pm.basic, ['password']);
    return base;
  }
  issues.push(`认证类型 "${pm.type}" 暂不支持，已按无认证处理`);
  return base;
}

function convertRequest(pm: PmRequest, issues: string[]): RequestConfig | null {
  const url = urlOf(pm.url);
  if (!url) {
    issues.push('存在缺少 url 的请求，已跳过');
    return null;
  }

  let method: HttpMethod = 'GET';
  const m = typeof pm.method === 'string' ? pm.method.toUpperCase() : '';
  if (m) {
    if ((HTTP_METHODS as string[]).includes(m)) method = m as HttpMethod;
    else issues.push(`方法 "${m}" 无法识别，已按 GET 处理`);
  }

  const params: KV[] = [];
  if (pm.url && typeof pm.url === 'object' && Array.isArray(pm.url.query)) {
    for (const q of pm.url.query) {
      if (!q || !q.key) continue;
      params.push(newRow(q.key, q.value ?? '', q.disabled !== true));
    }
  }

  const headers: KV[] = [];
  if (Array.isArray(pm.header)) {
    for (const h of pm.header) {
      if (!h || !h.key) continue;
      headers.push(newRow(h.key, h.value ?? '', h.disabled !== true));
    }
  }

  return {
    kind: 'http',
    method,
    url,
    params,
    headers,
    body: convertBody(pm.body, headers, issues),
    auth: convertAuth(pm.auth, issues),
    tests: [],
    extracts: [],
  };
}

/** 解析 Postman 集合 JSON，永不抛异常 */
export function parsePostmanCollection(text: string): PostmanParseResult {
  const result: PostmanParseResult = {
    name: 'Postman 导入',
    nodes: [],
    issues: [],
    folderCount: 0,
    requestCount: 0,
  };

  if (!text.trim()) {
    result.issues.push('内容为空，请粘贴 Postman 集合 JSON');
    return result;
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    result.issues.push(`JSON 解析失败：${(e as Error).message}`);
    return result;
  }

  const root = data as { info?: { name?: string; schema?: string }; item?: unknown; auth?: PmAuth; variable?: unknown };
  if (!root || !Array.isArray(root.item)) {
    result.issues.push('不是有效的 Postman 集合：缺少 item 数组（请使用 Collection v2.1 导出格式）');
    return result;
  }
  if (typeof root.info?.name === 'string' && root.info.name.trim()) {
    result.name = root.info.name.trim();
  }

  const walk = (items: PmItem[]): PostmanNode[] => {
    const out: PostmanNode[] = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '未命名';
      if (Array.isArray(item.item)) {
        result.folderCount++;
        out.push({ type: 'folder', name, children: walk(item.item) });
      } else if (item.request) {
        const req = convertRequest(item.request, result.issues);
        if (!req) continue;
        result.requestCount++;
        out.push({ type: 'request', name, request: req });
      }
    }
    return out;
  };

  result.nodes = walk(root.item as PmItem[]);
  if (!result.requestCount) result.issues.push('集合中没有可导入的请求');
  return result;
}
