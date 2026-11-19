import type { RequestConfig, RequestKind } from '@/types';
import { newKV } from './kv';

/** 新建空白请求配置 */
export function newRequest(kind: RequestKind = 'http'): RequestConfig {
  return {
    kind,
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { type: kind === 'ws' ? 'none' : 'none', rawType: 'json', raw: '', form: [] },
    auth: { type: 'none', token: '', username: '', password: '' },
    tests: [],
    extracts: [],
  };
}

/** 持久化用深拷贝：剥离运行时 File 对象 */
export function persistClone(req: RequestConfig): RequestConfig {
  const clone = JSON.parse(JSON.stringify(req)) as RequestConfig;
  // 防御：历史版本曾把数组写成对象，这里兜底保证结构可遍历
  if (!clone.body || typeof clone.body !== 'object') {
    clone.body = { type: 'none', rawType: 'json', raw: '', form: [] };
  }
  if (!Array.isArray(clone.body.form)) clone.body.form = [];
  for (const row of clone.body.form) {
    row.file = null;
  }
  if (!Array.isArray(clone.params)) clone.params = [];
  if (!Array.isArray(clone.headers)) clone.headers = [];
  return clone;
}

/** 深拷贝请求（保留结构，不含 File 内容） */
export function cloneRequest(req: RequestConfig): RequestConfig {
  return persistClone(req);
}
