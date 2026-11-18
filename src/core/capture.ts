// 页面请求抓包：扩展环境通过 background webRequest 监听；网页模式不可用
import type { HttpMethod, RawType, RequestConfig } from '@/types';
import { HTTP_METHODS } from '@/types';
import { uid } from './util';

export const captureSupported =
  typeof chrome !== 'undefined' &&
  !!chrome.webRequest &&
  !!chrome.runtime?.id &&
  !!chrome.storage?.local;

export interface CaptureRecord {
  id: string;
  method: string;
  url: string;
  headers: [string, string][];
  bodyText: string;
  bodyForm: { key: string; value: string }[] | null;
  status: number | null;
  statusText: string;
  time: number | null;
  error: string | null;
  ts: number;
}

const LIST_KEY = 'penapi.capture.records';
const ON_KEY = 'penapi.capture.on';

export async function getCaptureOn(): Promise<boolean> {
  if (!captureSupported) return false;
  const res = await chrome.storage.local.get(ON_KEY);
  return res[ON_KEY] === true;
}

export async function setCaptureOn(on: boolean): Promise<void> {
  if (!captureSupported) return;
  await chrome.runtime.sendMessage({ type: on ? 'penapi-capture-on' : 'penapi-capture-off' });
}

export async function listCaptured(): Promise<CaptureRecord[]> {
  if (!captureSupported) return [];
  const res = await chrome.storage.local.get(LIST_KEY);
  const list = res[LIST_KEY];
  return Array.isArray(list) ? (list as CaptureRecord[]) : [];
}

export async function clearCaptured(): Promise<void> {
  if (!captureSupported) return;
  await chrome.runtime.sendMessage({ type: 'penapi-capture-clear' });
}

/** 浏览器控制的受限请求头，导入时剔除 */
const BLOCKED_HEADERS = new Set([
  'host',
  'content-length',
  'connection',
  'accept-encoding',
  'accept-language',
  'origin',
  'referer',
  'user-agent',
  'cookie',
  'dnt',
  'upgrade-insecure-requests',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
]);

function inferRawType(contentType: string, body: string): RawType {
  const ct = contentType.toLowerCase();
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('html')) return 'html';
  if (ct.includes('javascript')) return 'javascript';
  if (ct.includes('json') || /^[[{]/.test(body.trim())) return 'json';
  return 'text';
}

/** 抓包记录 → 可导入的请求配置 */
export function toRequestConfig(rec: CaptureRecord): RequestConfig {
  const headers = rec.headers.filter(([k]) => {
    const lower = k.toLowerCase();
    return !BLOCKED_HEADERS.has(lower) && !k.startsWith(':');
  });
  const contentType = headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';
  const method: HttpMethod = (HTTP_METHODS as string[]).includes(rec.method)
    ? (rec.method as HttpMethod)
    : 'GET';

  const config: RequestConfig = {
    kind: 'http',
    method,
    url: rec.url,
    params: [],
    headers: headers.map(([k, v]) => ({
      id: uid(),
      key: k,
      value: v,
      enabled: true,
      type: 'text',
      file: null,
    })),
    body: { type: 'none', rawType: 'json', raw: '', form: [] },
    auth: { type: 'none', token: '', username: '', password: '' },
    tests: [],
    extracts: [],
  };

  const hasBody = method !== 'GET' && method !== 'HEAD';
  if (hasBody) {
    if (rec.bodyForm && rec.bodyForm.length) {
      config.body.type = 'form-data';
      config.body.form = rec.bodyForm.map((r) => ({
        id: uid(),
        key: r.key,
        value: r.value,
        enabled: true,
        type: 'text',
        file: null,
      }));
    } else if (rec.bodyText) {
      config.body.type = 'raw';
      config.body.raw = rec.bodyText;
      config.body.rawType = inferRawType(contentType, rec.bodyText);
    }
  }
  return config;
}
