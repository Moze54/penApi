// 断言校验与后置变量提取引擎
import type {
  AssertOp,
  AssertResult,
  AssertRule,
  AssertType,
  ExtractResult,
  ExtractRule,
  RequestConfig,
  ResponseSnapshot,
} from '@/types';
import { uid } from './util';

export const ASSERT_TYPE_LABELS: Record<AssertType, string> = {
  status: '状态码',
  time: '响应耗时',
  jsonpath: 'JSON 字段',
  header: '响应头',
  body: '响应体',
};

export const ASSERT_OP_LABELS: Record<AssertOp, string> = {
  eq: '等于',
  neq: '不等于',
  contains: '包含',
  exists: '存在',
  gt: '大于',
  lt: '小于',
};

export function newAssertRule(): AssertRule {
  return { id: uid(), enabled: true, type: 'status', target: '', op: 'eq', value: '200' };
}

export function newExtractRule(): ExtractRule {
  return { id: uid(), enabled: true, path: '', varName: '' };
}

/** 旧数据补齐断言字段 */
export function ensureAssertFields(req: RequestConfig) {
  if (!req.tests) req.tests = [];
  if (!req.extracts) req.extracts = [];
}

/** 简化 JSON 路径取值：a.b[0].c、$.a.b、a["k"] */
export function getPathValue(data: unknown, path: string): { found: boolean; value: unknown } {
  const clean = path.trim().replace(/^\$/, '').replace(/^\./, '');
  if (!clean) return { found: true, value: data };

  const tokens: (string | number)[] = [];
  const re = /\[\s*(\d+)\s*\]|\[\s*["']([^"']*)["']\s*\]|([^.[\]]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    if (m[1] !== undefined) tokens.push(Number(m[1]));
    else if (m[2] !== undefined) tokens.push(m[2]);
    else if (m[3] !== undefined) {
      const name = m[3].trim();
      if (name) tokens.push(name);
    }
  }

  let cur: unknown = data;
  for (const t of tokens) {
    if (cur === null || cur === undefined) return { found: false, value: undefined };
    if (typeof t === 'number') {
      if (!Array.isArray(cur)) return { found: false, value: undefined };
      cur = cur[t];
    } else {
      if (typeof cur !== 'object' || Array.isArray(cur)) return { found: false, value: undefined };
      if (!(t in (cur as Record<string, unknown>))) return { found: false, value: undefined };
      cur = (cur as Record<string, unknown>)[t];
    }
  }
  return { found: true, value: cur };
}

function toStr(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function parseJsonBody(resp: ResponseSnapshot): { ok: boolean; data: unknown } {
  const t = resp.body?.trim();
  if (!t) return { ok: false, data: undefined };
  try {
    return { ok: true, data: JSON.parse(t) };
  } catch {
    return { ok: false, data: undefined };
  }
}

function headerValue(resp: ResponseSnapshot, name: string): { found: boolean; value: string } {
  const lower = name.trim().toLowerCase();
  const hit = resp.headers.filter(([k]) => k.toLowerCase() === lower).map(([, v]) => v);
  if (!hit.length) return { found: false, value: '' };
  return { found: true, value: hit.join(', ') };
}

function check(
  actual: { found: boolean; value: string },
  op: AssertOp,
  expect: string,
): { passed: boolean; detail: string } {
  const { found, value } = actual;
  switch (op) {
    case 'exists':
      return { passed: found, detail: found ? `实际 "${value}"` : '不存在' };
    case 'eq': {
      if (!found) return { passed: false, detail: '不存在' };
      const an = Number(value);
      const en = Number(expect);
      const numeric = expect.trim() !== '' && !Number.isNaN(an) && !Number.isNaN(en);
      const passed = numeric ? an === en : value === expect;
      return { passed, detail: `期望 "${expect}"，实际 "${value}"` };
    }
    case 'neq': {
      const eq = check(actual, 'eq', expect);
      return {
        passed: !eq.passed,
        detail: `期望不等于 "${expect}"，实际 "${found ? value : '(不存在)'}"`,
      };
    }
    case 'contains':
      if (!found) return { passed: false, detail: '不存在' };
      return { passed: value.includes(expect), detail: `期望包含 "${expect}"，实际 "${value}"` };
    case 'gt':
    case 'lt': {
      if (!found) return { passed: false, detail: '不存在' };
      const a = Number(value);
      const e = Number(expect);
      if (Number.isNaN(a) || Number.isNaN(e)) {
        return { passed: false, detail: `无法按数值比较："${value}" vs "${expect}"` };
      }
      const passed = op === 'gt' ? a > e : a < e;
      return { passed, detail: `期望${op === 'gt' ? '大于' : '小于'} ${expect}，实际 ${value}` };
    }
    default:
      return { passed: false, detail: '未知运算符' };
  }
}

/** 执行全部启用断言 */
export function runAssertions(rules: AssertRule[], resp: ResponseSnapshot): AssertResult[] {
  const results: AssertResult[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const typeLabel = ASSERT_TYPE_LABELS[rule.type];
    const opLabel = ASSERT_OP_LABELS[rule.op];
    let label = '';
    let r: { passed: boolean; detail: string };

    if (resp.error && rule.type !== 'status') {
      results.push({
        ruleId: rule.id,
        label: `${typeLabel} ${opLabel} ${rule.value}`.trim(),
        passed: false,
        message: '请求失败，无响应可校验',
      });
      continue;
    }

    switch (rule.type) {
      case 'status':
        label = `状态码 ${opLabel} ${rule.value}`;
        r = check({ found: true, value: String(resp.status) }, rule.op, rule.value);
        break;
      case 'time':
        label = `耗时 ${opLabel} ${rule.value}ms`;
        r = check({ found: true, value: String(Math.round(resp.time)) }, rule.op, rule.value);
        break;
      case 'jsonpath': {
        label = `JSON ${rule.target || '(未填路径)'} ${opLabel} ${rule.value}`;
        const jsonRes = parseJsonBody(resp);
        if (!jsonRes.ok) {
          r = { passed: false, detail: '响应体不是合法 JSON 或为空' };
        } else {
          const got = getPathValue(jsonRes.data, rule.target);
          r = check({ found: got.found, value: toStr(got.value) }, rule.op, rule.value);
        }
        break;
      }
      case 'header': {
        label = `响应头 ${rule.target || '(未填名称)'} ${opLabel} ${rule.value}`;
        const hv = headerValue(resp, rule.target);
        r = check({ found: hv.found, value: hv.value }, rule.op, rule.value);
        break;
      }
      case 'body':
        label = `响应体 ${opLabel} ${rule.value}`;
        r = check({ found: !!resp.body, value: resp.body }, rule.op, rule.value);
        break;
      default:
        r = { passed: false, detail: '未知断言类型' };
    }

    results.push({ ruleId: rule.id, label, passed: r.passed, message: r.detail });
  }

  return results;
}

/** 执行全部启用的提取规则 */
export function runExtracts(rules: ExtractRule[], resp: ResponseSnapshot): ExtractResult[] {
  const results: ExtractResult[] = [];
  const jsonRes = parseJsonBody(resp);

  for (const rule of rules) {
    if (!rule.enabled || !rule.varName.trim()) continue;
    const varName = rule.varName.trim();
    if (!rule.path.trim() || !jsonRes.ok) {
      results.push({ ruleId: rule.id, varName, value: '', ok: false });
      continue;
    }
    const got = getPathValue(jsonRes.data, rule.path);
    results.push({
      ruleId: rule.id,
      varName,
      value: got.found ? toStr(got.value) : '',
      ok: got.found,
    });
  }

  return results;
}
