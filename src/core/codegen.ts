// 代码生成：把当前请求转换为常用语言片段
import type { RequestConfig } from '@/types';
import { buildRequest } from './requester';
import { applyVars } from './vars';

export type CodegenLang = 'curl' | 'fetch' | 'axios' | 'python' | 'go';

export const CODEGEN_LANGS: { value: CodegenLang; label: string }[] = [
  { value: 'curl', label: 'cURL' },
  { value: 'fetch', label: 'fetch' },
  { value: 'axios', label: 'axios' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
];

interface Built {
  url: string;
  method: string;
  headers: [string, string][];
  /** raw / urlencoded 文本；form-data 时为空 */
  bodyText: string;
  formRows: { key: string; value: string; file: boolean }[];
  isFormData: boolean;
}

function build(req: RequestConfig, vars: Record<string, string>): Built {
  const resolved = buildRequest(req, { vars, timeoutSec: 30 });
  const bc = req.body;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const out: Built = {
    url: resolved.url,
    method: req.method,
    headers: [...resolved.headers],
    bodyText: '',
    formRows: [],
    isFormData: false,
  };
  if (!hasBody) return out;

  if (bc.type === 'raw') {
    out.bodyText = applyVars(bc.raw, vars);
  } else if (bc.type === 'urlencoded') {
    out.bodyText = bc.form
      .filter((r) => r.enabled && r.key.trim())
      .map(
        (r) =>
          `${encodeURIComponent(applyVars(r.key, vars))}=${encodeURIComponent(applyVars(r.value, vars))}`,
      )
      .join('&');
  } else if (bc.type === 'form-data') {
    out.isFormData = true;
    for (const r of bc.form) {
      if (!r.enabled || !r.key.trim()) continue;
      out.formRows.push({
        key: applyVars(r.key, vars),
        value: r.type === 'file' ? r.fileName || '/path/to/file' : applyVars(r.value, vars),
        file: r.type === 'file',
      });
    }
  }
  return out;
}

/** 是否为合法 JSON 对象/数组文本 */
function prettyJson(text: string): string | null {
  const t = text.trim();
  if (!t || !/^[[{]/.test(t)) return null;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return null;
  }
}

function jsStr(s: string): string {
  return JSON.stringify(s);
}

function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function pyStr(s: string): string {
  return JSON.stringify(s);
}

function headerBlockJs(headers: [string, string][], indent: string): string {
  if (!headers.length) return '{}';
  return `{\n${headers.map(([k, v]) => `${indent}  ${jsStr(k)}: ${jsStr(v)},`).join('\n')}\n${indent}}`;
}

// ---- curl ----

function genCurl(b: Built): string {
  const lines: string[] = [`curl -X ${b.method} ${shq(b.url)}`];
  for (const [k, v] of b.headers) lines.push(`  -H ${shq(`${k}: ${v}`)}`);
  if (b.isFormData) {
    for (const r of b.formRows) {
      lines.push(r.file ? `  -F ${shq(`${r.key}=@${r.value}`)}` : `  -F ${shq(`${r.key}=${r.value}`)}`);
    }
  } else if (b.bodyText) {
    lines.push(`  --data-raw ${shq(b.bodyText)}`);
  }
  return lines.join(' \\\n');
}

// ---- fetch ----

function genFetch(b: Built): string {
  const hb = headerBlockJs(b.headers, '  ');
  if (b.isFormData) {
    const appends = b.formRows
      .map((r) =>
        r.file
          ? `form.append(${jsStr(r.key)}, fileInput.files[0]);`
          : `form.append(${jsStr(r.key)}, ${jsStr(r.value)});`,
      )
      .join('\n');
    return [
      'const form = new FormData();',
      appends,
      '',
      `const res = await fetch(${jsStr(b.url)}, {`,
      `  method: ${jsStr(b.method)},`,
      `  headers: ${hb},`,
      '  body: form,',
      '});',
      '',
      'const data = await res.json();',
      'console.log(data);',
    ].join('\n');
  }
  const lines = [
    `const res = await fetch(${jsStr(b.url)}, {`,
    `  method: ${jsStr(b.method)},`,
    `  headers: ${hb},`,
  ];
  if (b.bodyText) lines.push(`  body: ${jsStr(b.bodyText)},`);
  lines.push('});', '', 'const data = await res.json();', 'console.log(data);');
  return lines.join('\n');
}

// ---- axios ----

function genAxios(b: Built): string {
  const hb = headerBlockJs(b.headers, '  ');
  const method = b.method.toLowerCase();
  const hasBody = method !== 'get' && method !== 'head';

  if (b.isFormData) {
    const appends = b.formRows
      .map((r) =>
        r.file
          ? `form.append(${jsStr(r.key)}, fileInput.files[0]);`
          : `form.append(${jsStr(r.key)}, ${jsStr(r.value)});`,
      )
      .join('\n');
    return [
      "import axios from 'axios';",
      '',
      'const form = new FormData();',
      appends,
      '',
      `const { data } = await axios.${method}(${jsStr(b.url)}, form, {`,
      `  headers: ${hb},`,
      '});',
      'console.log(data);',
    ].join('\n');
  }

  // raw JSON 优先转成对象字面量
  const json = b.bodyText ? prettyJson(b.bodyText) : null;
  const bodyExpr = !b.bodyText ? '' : json ?? jsStr(b.bodyText);

  return [
    "import axios from 'axios';",
    '',
    hasBody && bodyExpr
      ? `const { data } = await axios.${method}(${jsStr(b.url)}, ${bodyExpr}, {`
      : `const { data } = await axios.${method}(${jsStr(b.url)}, {`,
    `  headers: ${hb},`,
    '});',
    'console.log(data);',
  ].join('\n');
}

// ---- python requests ----

function genPython(b: Built): string {
  const lines: string[] = ['import requests', '', `url = ${pyStr(b.url)}`];

  lines.push('headers = {');
  for (const [k, v] of b.headers) lines.push(`    ${pyStr(k)}: ${pyStr(v)},`);
  lines.push('}', '');

  if (b.isFormData) {
    lines.push('files = {');
    for (const r of b.formRows) {
      lines.push(
        r.file
          ? `    ${pyStr(r.key)}: open(${pyStr(r.value)}, "rb"),`
          : `    ${pyStr(r.key)}: (None, ${pyStr(r.value)}),`,
      );
    }
    lines.push('}', '');
    lines.push(`resp = requests.${b.method.toLowerCase()}(url, headers=headers, files=files)`);
  } else if (b.bodyText) {
    const json = prettyJson(b.bodyText);
    if (json) {
      lines.push(`payload = '''${json}'''`, '');
      lines.push(`resp = requests.${b.method.toLowerCase()}(url, headers=headers, data=payload.encode())`);
    } else {
      lines.push(`payload = ${pyStr(b.bodyText)}`, '');
      lines.push(`resp = requests.${b.method.toLowerCase()}(url, headers=headers, data=payload.encode())`);
    }
  } else {
    lines.push(`resp = requests.${b.method.toLowerCase()}(url, headers=headers)`);
  }

  lines.push('', 'print(resp.status_code)', 'print(resp.text)');
  return lines.join('\n');
}

// ---- go ----

function goStr(s: string): string {
  return JSON.stringify(s);
}

function genGo(b: Built): string {
  const lines: string[] = [];
  lines.push('package main', '', 'import (', '\t"fmt"', '\t"io"', '\t"net/http"', '\t"strings"', ')', '');
  lines.push('func main() {');

  const hasBody = !b.isFormData && !!b.bodyText;
  if (b.isFormData) {
    // multipart 生成较冗长，给出注释提示
    lines.push('\t// form-data 请使用 mime/multipart 构造请求体');
  }
  if (hasBody) lines.push(`\tpayload := strings.NewReader(${goStr(b.bodyText)})`);
  const bodyExpr = hasBody ? 'payload' : 'nil';
  lines.push(`\treq, err := http.NewRequest(${goStr(b.method)}, ${goStr(b.url)}, ${bodyExpr})`);
  lines.push('\tif err != nil {', '\t\tpanic(err)', '\t}');
  for (const [k, v] of b.headers) lines.push(`\treq.Header.Set(${goStr(k)}, ${goStr(v)})`);
  lines.push(
    '',
    '\tres, err := http.DefaultClient.Do(req)',
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    '\tdefer res.Body.Close()',
    '',
    '\tbody, _ := io.ReadAll(res.Body)',
    '\tfmt.Println(res.Status)',
    '\tfmt.Println(string(body))',
    '}',
  );
  return lines.join('\n');
}

/** 生成指定语言的请求代码；出错时返回注释说明 */
export function generateCode(
  req: RequestConfig,
  vars: Record<string, string>,
  lang: CodegenLang,
): string {
  let built: Built;
  try {
    built = build(req, vars);
  } catch (e) {
    return `// 无法生成代码：${(e as Error).message}`;
  }
  switch (lang) {
    case 'curl':
      return genCurl(built);
    case 'fetch':
      return genFetch(built);
    case 'axios':
      return genAxios(built);
    case 'python':
      return genPython(built);
    case 'go':
      return genGo(built);
    default:
      return '';
  }
}
