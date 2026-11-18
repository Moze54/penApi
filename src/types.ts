// ---- 基础数据模型 ----

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

export type BodyType = 'none' | 'form-data' | 'urlencoded' | 'raw';
export const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'form-data', label: 'form-data' },
  { value: 'urlencoded', label: 'x-www-form-urlencoded' },
  { value: 'raw', label: 'raw' },
];

export type RawType = 'json' | 'text' | 'xml' | 'html' | 'javascript';
export const RAW_TYPES: { value: RawType; label: string; mime: string }[] = [
  { value: 'json', label: 'JSON', mime: 'application/json' },
  { value: 'text', label: 'Text', mime: 'text/plain' },
  { value: 'xml', label: 'XML', mime: 'application/xml' },
  { value: 'html', label: 'HTML', mime: 'text/html' },
  { value: 'javascript', label: 'JavaScript', mime: 'application/javascript' },
];

export type AuthType = 'none' | 'bearer' | 'basic';
export type RequestKind = 'http' | 'ws';

/** 通用键值对行（参数 / 请求头 / 表单） */
export interface KV {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  /** 仅 form-data 使用：文本 或 文件 */
  type: 'text' | 'file';
  /** file 类型的文件名提示（持久化用，File 对象不持久化） */
  fileName?: string;
  /** 运行时持有的文件对象（内存） */
  file?: File | null;
}

export interface BodyConfig {
  type: BodyType;
  rawType: RawType;
  raw: string;
  form: KV[];
}

export interface AuthConfig {
  type: AuthType;
  token: string;
  username: string;
  password: string;
}

export interface RequestConfig {
  kind: RequestKind;
  method: HttpMethod;
  url: string;
  params: KV[];
  headers: KV[];
  body: BodyConfig;
  auth: AuthConfig;
  /** 断言规则（发送后自动校验响应） */
  tests?: AssertRule[];
  /** 后置变量提取规则（从响应写入环境变量） */
  extracts?: ExtractRule[];
}

// ---- 断言与变量提取 ----

export type AssertType = 'status' | 'time' | 'jsonpath' | 'header' | 'body';
export type AssertOp = 'eq' | 'neq' | 'contains' | 'exists' | 'gt' | 'lt';

export interface AssertRule {
  id: string;
  enabled: boolean;
  type: AssertType;
  /** jsonpath：JSON 路径；header：响应头名称；其余类型不使用 */
  target: string;
  op: AssertOp;
  /** 期望值（status 填状态码、time 填毫秒数） */
  value: string;
}

export interface ExtractRule {
  id: string;
  enabled: boolean;
  /** 响应体 JSON 路径，如 data.token / items[0].id */
  path: string;
  /** 写入环境变量的名称 */
  varName: string;
}

export interface AssertResult {
  ruleId: string;
  label: string;
  passed: boolean;
  message: string;
}

export interface ExtractResult {
  ruleId: string;
  varName: string;
  value: string;
  ok: boolean;
}

// ---- 项目分组树 ----

export interface Project {
  id: string;
  name: string;
  desc: string;
  order: number;
  createdAt: number;
  /** 折叠状态（undefined = 展开） */
  expanded?: boolean;
}

export type NodeType = 'folder' | 'request';

export interface ApiNode {
  id: string;
  projectId: string;
  parentId: string | null; // null = 项目根
  type: NodeType;
  name: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  expanded?: boolean; // 文件夹展开状态
  request?: RequestConfig; // type === 'request'
}

// ---- 环境变量 ----

export interface EnvVar {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  vars: EnvVar[];
}

// ---- 响应与历史 ----

export interface ResponseSnapshot {
  status: number;
  statusText: string;
  headers: [string, string][];
  requestHeaders: [string, string][];
  body: string;
  /** 内容超过持久化上限时置 true，body 为空 */
  truncated?: boolean;
  bodySize: number;
  time: number;
  contentType: string;
  /** 图片等二进制预览（<= 2MB 才存） */
  dataUrl?: string;
  finalUrl: string;
  redirected: boolean;
  error?: string;
  ts: number;
}

export interface HistoryRecord {
  id: string;
  kind: RequestKind;
  projectId: string | null;
  name: string;
  request: RequestConfig;
  response?: ResponseSnapshot;
  ts: number;
}

// ---- 设置 ----

export interface AppSettings {
  /** 请求超时（秒） */
  timeout: number;
  /** 历史保留条数 */
  historyLimit: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  timeout: 30,
  historyLimit: 500,
};

// ---- 工作区标签 ----

export interface WsMessage {
  id: string;
  direction: 'send' | 'recv' | 'sys';
  text: string;
  ts: number;
}

export interface WsSession {
  status: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  url: string;
  messages: WsMessage[];
}

export interface TabItem {
  id: string;
  kind: RequestKind;
  title: string;
  /** 关联的树节点 id（历史/新建标签为 null） */
  nodeId: string | null;
  /** 有未保存修改 */
  dirty: boolean;
  request: RequestConfig;
  response?: ResponseSnapshot;
  sending: boolean;
  ws?: WsSession;
  /** 最近一次发送的断言结果 */
  assertResults?: AssertResult[];
  /** 最近一次发送的变量提取结果 */
  extractResults?: ExtractResult[];
}
