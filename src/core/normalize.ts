// 存储数据归一化（嵌套层自愈）
//
// 历史版本把 Pinia 代理数组直接交给 chrome.storage 序列化，数组被写成
// {0:…,1:…} 形状的普通对象。顶层数组已由 db.ts 的 asArray 还原，但
// request.params / body.form / tests / extracts / env.vars 等嵌套层同样是坏形状，
// 遍历即抛 “xxx is not iterable”。这里在读取时逐字段还原为纯数据，并把
// fixed=true 的结果回写存储，完成自愈。

import type {
  AssertOp,
  AssertRule,
  AssertType,
  AuthConfig,
  AuthType,
  BodyConfig,
  BodyType,
  EnvVar,
  ExtractRule,
  HistoryRecord,
  KV,
  RawType,
  RequestConfig,
  ResponseSnapshot,
} from '@/types';
import { HTTP_METHODS } from '@/types';
import { asArray } from '@/storage/db';
import { uid } from './util';
import { newKV } from './kv';

export interface NormResult<T> {
  value: T;
  /** 检测到坏形状并已修复（调用方应回写存储） */
  fixed: boolean;
}

const BODY_TYPES: BodyType[] = ['none', 'form-data', 'urlencoded', 'raw'];
const RAW_TYPES: RawType[] = ['json', 'text', 'xml', 'html', 'javascript'];
const AUTH_TYPES: AuthType[] = ['none', 'bearer', 'basic'];
const ASSERT_TYPES: AssertType[] = ['status', 'time', 'jsonpath', 'header', 'body'];
const ASSERT_OPS: AssertOp[] = ['eq', 'neq', 'contains', 'exists', 'gt', 'lt'];

function toStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'false' || v === 0 || v === '0') return false;
  if (v === 'true' || v === 1 || v === '1') return true;
  return fallback;
}

function pick<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** 参数 / 请求头 / 表单行 */
export function fixKvRows(raw: unknown): NormResult<KV[]> {
  const list = asArray<Record<string, unknown>>(raw);
  if (!list) return { value: [], fixed: true };
  let fixed = !Array.isArray(raw);
  const value = list.map((item) => {
    if (!item || typeof item !== 'object') {
      fixed = true;
      return newKV();
    }
    const type = item.type === 'file' ? 'file' : 'text';
    if (
      typeof item.id !== 'string' ||
      typeof item.key !== 'string' ||
      typeof item.value !== 'string' ||
      typeof item.enabled !== 'boolean' ||
      (item.type !== 'text' && item.type !== 'file')
    ) {
      fixed = true;
    }
    return {
      id: toStr(item.id) || uid(),
      key: toStr(item.key),
      value: toStr(item.value),
      enabled: toBool(item.enabled, true),
      type,
      fileName: typeof item.fileName === 'string' ? item.fileName : undefined,
      file: null,
    } as KV;
  });
  return { value, fixed };
}

export function normalizeBody(raw: unknown): NormResult<BodyConfig> {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const form = fixKvRows(b.form);
  const type = pick(b.type, BODY_TYPES);
  const rawType = pick(b.rawType, RAW_TYPES);
  const value: BodyConfig = {
    type: type ?? 'none',
    rawType: rawType ?? 'json',
    raw: toStr(b.raw),
    form: form.value,
  };
  const fixed =
    !raw ||
    typeof raw !== 'object' ||
    form.fixed ||
    type === null ||
    rawType === null ||
    typeof b.raw !== 'string';
  return { value, fixed };
}

export function normalizeAuth(raw: unknown): NormResult<AuthConfig> {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const type = pick(a.type, AUTH_TYPES);
  const value: AuthConfig = {
    type: type ?? 'none',
    token: toStr(a.token),
    username: toStr(a.username),
    password: toStr(a.password),
  };
  const fixed =
    !raw ||
    typeof raw !== 'object' ||
    type === null ||
    typeof a.token !== 'string' ||
    typeof a.username !== 'string' ||
    typeof a.password !== 'string';
  return { value, fixed };
}

export function fixAssertRules(raw: unknown): NormResult<AssertRule[]> {
  const list = asArray<Record<string, unknown>>(raw);
  if (!list) return { value: [], fixed: true };
  let fixed = !Array.isArray(raw);
  const value = list.map((item) => {
    if (!item || typeof item !== 'object') {
      fixed = true;
      return { id: uid(), enabled: true, type: 'status', target: '', op: 'eq', value: '' } as AssertRule;
    }
    const type = pick(item.type, ASSERT_TYPES);
    const op = pick(item.op, ASSERT_OPS);
    if (type === null || op === null || typeof item.enabled !== 'boolean') fixed = true;
    return {
      id: toStr(item.id) || uid(),
      enabled: toBool(item.enabled, true),
      type: type ?? 'status',
      target: toStr(item.target),
      op: op ?? 'eq',
      value: toStr(item.value),
    } as AssertRule;
  });
  return { value, fixed };
}

export function fixExtractRules(raw: unknown): NormResult<ExtractRule[]> {
  const list = asArray<Record<string, unknown>>(raw);
  if (!list) return { value: [], fixed: true };
  let fixed = !Array.isArray(raw);
  const value = list.map((item) => {
    if (!item || typeof item !== 'object') {
      fixed = true;
      return { id: uid(), enabled: true, path: '', varName: '' } as ExtractRule;
    }
    if (typeof item.enabled !== 'boolean') fixed = true;
    return {
      id: toStr(item.id) || uid(),
      enabled: toBool(item.enabled, true),
      path: toStr(item.path),
      varName: toStr(item.varName),
    } as ExtractRule;
  });
  return { value, fixed };
}

export function fixEnvVars(raw: unknown): NormResult<EnvVar[]> {
  const list = asArray<Record<string, unknown>>(raw);
  if (!list) return { value: [], fixed: true };
  let fixed = !Array.isArray(raw);
  const value = list.map((item) => {
    if (!item || typeof item !== 'object') {
      fixed = true;
      return { id: uid(), key: '', value: '', enabled: true } as EnvVar;
    }
    if (typeof item.enabled !== 'boolean' || typeof item.key !== 'string') fixed = true;
    return {
      id: toStr(item.id) || uid(),
      key: toStr(item.key),
      value: toStr(item.value),
      enabled: toBool(item.enabled, true),
    } as EnvVar;
  });
  return { value, fixed };
}

/** 单个请求配置（含 params/headers/body.form/auth/tests/extracts 全部嵌套层） */
export function normalizeRequest(raw: unknown): NormResult<RequestConfig> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const params = fixKvRows(r.params);
  const headers = fixKvRows(r.headers);
  const body = normalizeBody(r.body);
  const auth = normalizeAuth(r.auth);
  const tests = fixAssertRules(r.tests);
  const extracts = fixExtractRules(r.extracts);
  const method = pick(r.method, HTTP_METHODS);
  const value: RequestConfig = {
    kind: r.kind === 'ws' ? 'ws' : 'http',
    method: method ?? 'GET',
    url: toStr(r.url),
    params: params.value,
    headers: headers.value,
    body: body.value,
    auth: auth.value,
    tests: tests.value,
    extracts: extracts.value,
  };
  const fixed =
    !raw ||
    typeof raw !== 'object' ||
    method === null ||
    typeof r.url !== 'string' ||
    params.fixed ||
    headers.fixed ||
    body.fixed ||
    auth.fixed ||
    tests.fixed ||
    extracts.fixed;
  return { value, fixed };
}

/** 历史记录（请求 + 响应头列表） */
export function normalizeHistoryRecord(rec: HistoryRecord): NormResult<HistoryRecord> {
  const request = normalizeRequest(rec.request);
  let fixed = request.fixed;
  let response: ResponseSnapshot | undefined = rec.response;
  if (response) {
    const headers = asArray<[string, string]>(response.headers as unknown);
    const requestHeaders = asArray<[string, string]>(response.requestHeaders as unknown);
    if (!headers || !requestHeaders) {
      fixed = true;
      response = { ...response, headers: headers ?? [], requestHeaders: requestHeaders ?? [] };
    }
  }
  return { value: { ...rec, request: request.value, response }, fixed };
}
