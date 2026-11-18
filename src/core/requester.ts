import type { RequestConfig, ResponseSnapshot } from '@/types';
import { applyVars } from './vars';

const PERSIST_BODY_LIMIT = 1024 * 1024; // 1MB：超出则不持久化响应体
const PREVIEW_DATAURL_LIMIT = 2 * 1024 * 1024; // 2MB：图片预览上限

export interface SendOptions {
  vars: Record<string, string>;
  timeoutSec: number;
}

/** 构建实际请求（变量替换 + 拼接 query + 组装 body），返回 fetch 入参与实际发送头 */
export function buildRequest(req: RequestConfig, opts: SendOptions) {
  const { vars } = opts;
  const rawUrl = applyVars(req.url.trim(), vars);
  if (!rawUrl) throw new Error('请输入请求地址');

  let urlObj: URL;
  try {
    urlObj = new URL(rawUrl);
  } catch {
    throw new Error('URL 无效：需包含协议，如 https://api.example.com/path');
  }

  // query 参数（启用且非文件行）
  for (const p of req.params) {
    if (!p.enabled || !p.key.trim()) continue;
    urlObj.searchParams.append(applyVars(p.key, vars), applyVars(p.value, vars));
  }

  // 请求头
  const headers: [string, string][] = [];
  const seen = new Set<string>();
  for (const h of req.headers) {
    if (!h.enabled || !h.key.trim()) continue;
    const k = applyVars(h.key, vars);
    if (seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    const v = applyVars(h.value, vars);
    assertHeaderChars(k, v);
    headers.push([k, v]);
  }

  // 认证
  const { auth } = req;
  if (auth.type === 'bearer' && auth.token.trim()) {
    const k = 'Authorization';
    const v = `Bearer ${applyVars(auth.token.trim(), vars)}`;
    assertHeaderChars(k, v);
    replaceOrPush(headers, seen, k, v);
  } else if (auth.type === 'basic' && auth.username.trim()) {
    const k = 'Authorization';
    const v = `Basic ${b64utf8(`${applyVars(auth.username, vars)}:${applyVars(auth.password, vars)}`)}`;
    replaceOrPush(headers, seen, k, v);
  }

  // 请求体
  let body: BodyInit | null = null;
  const { body: bc } = req;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  if (hasBody && bc.type === 'urlencoded') {
    const usp = new URLSearchParams();
    for (const row of bc.form) {
      if (!row.enabled || !row.key.trim()) continue;
      usp.append(applyVars(row.key, vars), applyVars(row.value, vars));
    }
    body = usp.toString();
    if (!seen.has('content-type')) {
      headers.push(['Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8']);
      seen.add('content-type');
    }
  } else if (hasBody && bc.type === 'form-data') {
    const fd = new FormData();
    for (const row of bc.form) {
      if (!row.enabled || !row.key.trim()) continue;
      const key = applyVars(row.key, vars);
      if (row.type === 'file' && row.file) {
        fd.append(key, row.file, row.file.name);
      } else if (row.type === 'text') {
        fd.append(key, applyVars(row.value, vars));
      }
    }
    body = fd; // 浏览器自动设置 multipart boundary，不手动指定 Content-Type
  } else if (hasBody && bc.type === 'raw' && bc.raw.trim()) {
    body = applyVars(bc.raw, vars);
    if (!seen.has('content-type')) {
      const mime = RAW_MIME[bc.rawType] ?? 'text/plain';
      headers.push(['Content-Type', mime]);
      seen.add('content-type');
    }
  }

  return {
    url: urlObj.toString(),
    method: req.method,
    headers,
    body,
  };
}

const RAW_MIME: Record<string, string> = {
  json: 'application/json',
  text: 'text/plain',
  xml: 'application/xml',
  html: 'text/html',
  javascript: 'application/javascript',
};

function replaceOrPush(
  headers: [string, string][],
  seen: Set<string>,
  key: string,
  value: string,
) {
  const lower = key.toLowerCase();
  if (seen.has(lower)) {
    const idx = headers.findIndex(([k]) => k.toLowerCase() === lower);
    if (idx >= 0) headers[idx] = [key, value];
  } else {
    headers.push([key, value]);
    seen.add(lower);
  }
}

/**
 * UTF-8 安全的 base64 编码（btoa 仅支持 Latin-1，中文用户名/密码会抛 InvalidCharacterError）
 * Basic 认证按 RFC 7617 以 UTF-8 字节编码后再 base64
 */
function b64utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * 浏览器 fetch 的请求头仅支持 ISO-8859-1（Latin-1）字符：
 * 中文等字符会触发 "String contains non ISO-8859-1 code point"，此处提前拦截并给出中文指引
 */
function assertHeaderChars(name: string, value: string) {
  if (/[^\x00-\xFF]/.test(name)) {
    throw new Error(
      `请求头名称「${name}」包含中文等非 ASCII 字符，浏览器不允许发送；请改用英文请求头名`,
    );
  }
  if (/[^\x00-\xFF]/.test(value)) {
    throw new Error(
      `请求头「${name}」的值包含中文等非 ASCII 字符，浏览器不允许在请求头中发送（fetch 仅支持 ISO-8859-1）；请将中文字段改放请求体或查询参数，或先做 URL 编码（encodeURIComponent）`,
    );
  }
  if (/[\r\n]/.test(value)) {
    throw new Error(`请求头「${name}」的值包含换行符，浏览器不允许发送`);
  }
}

/** 发送请求，永不抛异常：错误以 error 响应快照返回 */
export async function sendRequest(req: RequestConfig, opts: SendOptions): Promise<ResponseSnapshot> {
  const built = buildRequest(req, opts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, opts.timeoutSec) * 1000);
  const t0 = performance.now();

  try {
    const res = await fetch(built.url, {
      method: built.method,
      headers: built.headers,
      body: built.body,
      credentials: 'include',
      signal: controller.signal,
      redirect: 'follow',
    });

    const time = performance.now() - t0;
    const contentType = res.headers.get('content-type') ?? '';
    const blob = await res.blob();
    const bodyText = await blobToText(blob);
    const truncated = blob.size > PERSIST_BODY_LIMIT;
    let dataUrl: string | undefined;
    if (contentType.startsWith('image/') && blob.size <= PREVIEW_DATAURL_LIMIT) {
      dataUrl = await blobToDataUrl(blob);
    }

    return {
      status: res.status,
      statusText: res.statusText || statusTextOf(res.status),
      headers: [...res.headers.entries()],
      requestHeaders: built.headers,
      body: truncated ? '' : bodyText,
      truncated,
      bodySize: blob.size,
      time,
      contentType,
      dataUrl,
      finalUrl: res.url || built.url,
      redirected: res.redirected,
      ts: Date.now(),
    };
  } catch (e) {
    const time = performance.now() - t0;
    const err = e as Error;
    let msg: string;
    if (err.name === 'AbortError') {
      msg = `请求超时（${opts.timeoutSec} 秒），可在设置中调整超时时间`;
    } else if (err.message === 'Failed to fetch') {
      msg =
        storageIsExtension()
          ? '请求失败：网络错误或被浏览器拦截（检查 URL 协议 / 证书 / 目标服务是否可达）'
          : '请求失败：网页开发模式下受 CORS 限制，跨域请求请加载扩展后在插件中发送';
      if (!/^https?:/i.test(built.url)) {
        msg = '请求失败：当前环境不允许该协议，请使用 http:// 或 https://';
      }
    } else {
      msg = err.message || '未知错误';
    }
    return {
      status: 0,
      statusText: '',
      headers: [],
      requestHeaders: built.headers,
      body: '',
      bodySize: 0,
      time,
      contentType: '',
      finalUrl: built.url,
      redirected: false,
      error: msg,
      ts: Date.now(),
    };
  }
}

function storageIsExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

async function blobToText(blob: Blob): Promise<string> {
  // Blob.text() 按响应编码解码
  try {
    return await blob.text();
  } catch {
    return '';
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function statusTextOf(status: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    413: 'Payload Too Large',
    415: 'Unsupported Media Type',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return map[status] ?? '';
}
