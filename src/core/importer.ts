// 接口 JSON 导入解析器
// 固定格式：顶层为单个接口对象或接口对象数组；字段详见 README「JSON 导入格式」
import type { AuthType, HttpMethod, KV, RawType, RequestConfig } from '@/types';
import { HTTP_METHODS } from '@/types';
import { uid } from './util';

export interface ParsedApi {
  name: string;
  kind: 'http' | 'ws';
  method: HttpMethod;
  url: string;
  params: KV[];
  headers: KV[];
  body: RequestConfig['body'];
  auth: RequestConfig['auth'];
  /** 可选：导入到指定名称的子文件夹（不存在则自动创建） */
  folder?: string;
  warnings: string[];
}

export interface ImportIssue {
  index: number;
  name: string;
  message: string;
}

export interface ParseResult {
  items: ParsedApi[];
  issues: ImportIssue[];
}

const RAW_TYPE_MAP: Record<string, RawType> = {
  json: 'json',
  text: 'text',
  plain: 'text',
  xml: 'xml',
  html: 'html',
  javascript: 'javascript',
  js: 'javascript',
};

const BODY_TYPE_ALIAS: Record<string, RequestConfig['body']['type']> = {
  json: 'raw',
  text: 'raw',
  xml: 'raw',
  html: 'raw',
  javascript: 'raw',
  raw: 'raw',
  none: 'none',
  form: 'form-data',
  'form-data': 'form-data',
  formdata: 'form-data',
  urlencoded: 'urlencoded',
  'x-www-form-urlencoded': 'urlencoded',
};

const AUTH_TYPES: AuthType[] = ['none', 'bearer', 'basic'];

/** 解析导入文本，永不抛异常 */
export function parseImportJson(text: string): ParseResult {
  const items: ParsedApi[] = [];
  const issues: ImportIssue[] = [];

  if (!text.trim()) {
    issues.push({ index: 0, name: '-', message: '内容为空，请粘贴 JSON' });
    return { items, issues };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    issues.push({ index: 0, name: '-', message: `JSON 解析失败：${(e as Error).message}` });
    return { items, issues };
  }

  const list: unknown[] = Array.isArray(data) ? data : [data];
  if (!Array.isArray(data) && (typeof data !== 'object' || data === null)) {
    issues.push({ index: 0, name: '-', message: '格式不正确：顶层应为接口对象或接口对象数组' });
    return { items, issues };
  }

  list.forEach((entry, i) => {
    const name = typeof (entry as Record<string, unknown>)?.name === 'string' ? (entry as Record<string, unknown>).name as string : `#${i + 1}`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      issues.push({ index: i, name, message: '不是接口对象' });
      return;
    }
    const obj = entry as Record<string, unknown>;
    const warnings: string[] = [];

    // URL 必填
    const url = typeof obj.url === 'string' ? obj.url.trim() : '';
    if (!url) {
      issues.push({ index: i, name, message: '缺少 url 字段，已跳过' });
      return;
    }

    // kind
    let kind: 'http' | 'ws' = 'http';
    if (obj.kind === 'ws' || obj.kind === 'websocket') kind = 'ws';

    // method
    let method: HttpMethod = 'GET';
    const rawMethod = typeof obj.method === 'string' ? obj.method.trim().toUpperCase() : '';
    if (rawMethod) {
      if (!kind || kind === 'http') {
        if ((HTTP_METHODS as string[]).includes(rawMethod)) {
          method = rawMethod as HttpMethod;
        } else {
          method = 'GET';
          warnings.push(`method "${rawMethod}" 无法识别，已按 GET 处理`);
        }
      }
    }

    const params = parseKvList(obj.params, warnings, 'params');
    const headers = parseKvList(obj.headers, warnings, 'headers');

    // body
    const body = parseBody(obj.body, warnings);

    // auth
    const auth = parseAuth(obj.auth, warnings);

    // folder
    const folder = typeof obj.folder === 'string' && obj.folder.trim() ? obj.folder.trim() : undefined;

    items.push({
      name: name.trim() || '未命名接口',
      kind,
      method,
      url,
      params,
      headers,
      body,
      auth,
      folder,
      warnings,
    });
  });

  return { items, issues };
}

/** 键值对列表：接受 [{key,value,enabled?}] 或 {k:v} 映射 */
function parseKvList(raw: unknown, warnings: string[], field: string): KV[] {
  if (raw == null) return [];
  const rows: KV[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        const key = typeof o.key === 'string' ? o.key : typeof o.name === 'string' ? (o.name as string) : '';
        const value = typeof o.value === 'string' ? o.value : String(o.value ?? '');
        if (!key.trim()) continue;
        rows.push({
          id: uid(),
          key,
          value,
          enabled: o.enabled !== false,
          type: o.type === 'file' ? 'file' : 'text',
          file: null,
        });
      } else if (typeof item === 'string' && item.includes(':')) {
        const idx = item.indexOf(':');
        rows.push({
          id: uid(),
          key: item.slice(0, idx).trim(),
          value: item.slice(idx + 1).trim(),
          enabled: true,
          type: 'text',
          file: null,
        });
      }
    }
    return rows;
  }

  if (typeof raw === 'object') {
    // { "Accept": "application/json" } 映射形式
    warnings.push(`${field} 建议使用 [{key, value}] 数组形式，已按对象映射解析`);
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      rows.push({ id: uid(), key: k, value: String(v), enabled: true, type: 'text', file: null });
    }
  }
  return rows;
}

function parseBody(raw: unknown, warnings: string[]): RequestConfig['body'] {
  const base = (): RequestConfig['body'] => ({ type: 'none', rawType: 'json', raw: '', form: [] });

  if (raw == null) return base();

  // 字符串 → 视为 raw JSON 内容
  if (typeof raw === 'string') {
    const b = base();
    b.type = 'raw';
    b.rawType = 'json';
    b.raw = raw;
    return b;
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push('body 格式无法识别，已忽略');
    return base();
  }

  const o = raw as Record<string, unknown>;
  const b = base();
  const rawTypeRaw = typeof o.rawType === 'string' ? o.rawType.toLowerCase() : typeof o.type === 'string' ? o.type.toLowerCase() : '';
  const bodyTypeRaw = typeof o.type === 'string' ? o.type.toLowerCase() : '';

  // type: none/raw/form-data/urlencoded 或直接写 json/text 等（视为 raw 的子类型）
  let type: RequestConfig['body']['type'] | undefined;
  if (bodyTypeRaw) {
    if (bodyTypeRaw in BODY_TYPE_ALIAS) type = BODY_TYPE_ALIAS[bodyTypeRaw];
    else warnings.push(`body.type "${bodyTypeRaw}" 无法识别，已按内容推断`);
  }

  const form = parseKvList(o.form ?? o.formData, warnings, 'body.form');

  if (type == null) {
    // 按内容推断
    if (typeof o.raw === 'string' && o.raw.trim()) type = 'raw';
    else if (form.length) type = 'form-data';
    else type = 'none';
  }

  b.type = type;
  if (type === 'raw') {
    const rt = rawTypeRaw && rawTypeRaw in RAW_TYPE_MAP ? RAW_TYPE_MAP[rawTypeRaw] : 'json';
    b.rawType = rt;
    b.raw = typeof o.raw === 'string' ? o.raw : '';
    if (type === 'raw' && !b.raw.trim()) warnings.push('body.type 为 raw 但未提供 raw 内容');
  } else if (type === 'form-data' || type === 'urlencoded') {
    b.form = form;
    if (!b.form.length) warnings.push(`body.type 为 ${type} 但未提供 form 字段`);
  }
  return b;
}

function parseAuth(raw: unknown, warnings: string[]): RequestConfig['auth'] {
  const base = (): RequestConfig['auth'] => ({ type: 'none', token: '', username: '', password: '' });
  if (raw == null) return base();
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push('auth 格式无法识别，已忽略');
    return base();
  }
  const o = raw as Record<string, unknown>;
  const typeRaw = typeof o.type === 'string' ? o.type.toLowerCase() : '';
  const a = base();
  if (!AUTH_TYPES.includes(typeRaw as AuthType)) {
    if (typeRaw) warnings.push(`auth.type "${typeRaw}" 无法识别，已按无认证处理`);
    return a;
  }
  a.type = typeRaw as AuthType;
  if (a.type === 'bearer') a.token = typeof o.token === 'string' ? o.token : '';
  if (a.type === 'basic') {
    a.username = typeof o.username === 'string' ? o.username : '';
    a.password = typeof o.password === 'string' ? o.password : '';
  }
  return a;
}

/** 示例格式文本（弹窗内展示） */
export const IMPORT_EXAMPLE = `[
  {
    "name": "查询用户信息",
    "method": "GET",
    "url": "https://api.example.com/users",
    "params": [{ "key": "page", "value": "1" }],
    "headers": [{ "key": "Authorization", "value": "Bearer xxx" }]
  },
  {
    "name": "创建用户",
    "method": "POST",
    "url": "https://api.example.com/users",
    "headers": [{ "key": "Content-Type", "value": "application/json" }],
    "body": { "type": "json", "raw": "{\\"name\\": \\"张三\\"}" },
    "auth": { "type": "bearer", "token": "xxx" },
    "folder": "用户模块"
  }
]`;
