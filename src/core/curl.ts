import type { KV, RequestConfig } from '@/types';
import { newKV } from './kv';
import { uid } from './util';

/**
 * 解析 cURL 命令为请求配置。支持：
 * -X/--request、-H/--header、-d/--data/--data-raw/--data-binary/--data-urlencode、
 * -F/--form、-u/--user、-L/--compressed/-k/-s 等常见参数；支持引号与换行续行。
 */
export function parseCurl(cmd: string): { request: RequestConfig; error?: string } {
  const tokens = tokenize(cmd);
  if (!tokens.length) return { request: emptyRequest(), error: '内容为空' };
  if (tokens[0].toLowerCase() === 'curl') tokens.shift();

  const req = emptyRequest();
  const dataParts: string[] = [];
  let hasData = false;
  let hasForm = false;
  let forceGet = false;
  let urlFound = '';

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (!t) continue;

    // URL（http/https 开头 或 --url）
    if (t === '--url' && next) {
      urlFound = stripQuotes(next);
      i++;
      continue;
    }
    if (/^https?:\/\//i.test(t)) {
      urlFound = t;
      continue;
    }

    switch (t) {
      case '-X':
      case '--request':
        if (next) {
          req.method = next.toUpperCase() as RequestConfig['method'];
          i++;
        }
        break;
      case '-H':
      case '--header': {
        if (next) {
          const kv = splitHeader(stripQuotes(next));
          if (kv) req.headers.push(kv);
          i++;
        }
        break;
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-ascii':
      case '--data-binary':
      case '--data-urlencode':
        if (next) {
          hasData = true;
          dataParts.push(stripQuotes(next).replace(/^@/, ''));
          i++;
        }
        break;
      case '-F':
      case '--form':
        if (next) {
          hasForm = true;
          const kv = splitForm(stripQuotes(next));
          if (kv) req.body.form.push(kv);
          i++;
        }
        break;
      case '-u':
      case '--user':
        if (next) {
          const [user, pass = ''] = stripQuotes(next).split(':');
          req.auth.type = 'basic';
          req.auth.username = user ?? '';
          req.auth.password = pass;
          i++;
        }
        break;
      case '-G':
      case '--get':
        forceGet = true;
        break;
      case '-m':
      case '--max-time':
      case '-A':
      case '--user-agent':
      case '-e':
      case '--referer':
      case '-b':
      case '--cookie':
        // 带值但暂不支持的参数：跳过值
        if (next && !next.startsWith('-')) i++;
        break;
      default:
        // 无值开关（-L -k -s -v --compressed 等）：忽略
        break;
    }
  }

  if (urlFound) req.url = urlFound;
  if (forceGet) req.method = 'GET';
  if (hasData && req.method === 'GET' && !forceGet) req.method = 'POST';
  if (hasData) {
    req.body.type = 'raw';
    req.body.rawType = 'json';
    req.body.raw = dataParts.join('&');
    // 常见场景：a=1&b=2 的表单文本 → 自动识别为 urlencoded 更直观
    if (!/^[[{"]/.test(req.body.raw) && /=/.test(req.body.raw)) {
      req.body.type = 'urlencoded';
      req.body.form = parseUrlencodedText(req.body.raw);
      req.body.raw = '';
    }
  }
  if (hasForm) {
    req.body.type = 'form-data';
    if (!req.headers.some((h) => h.key.toLowerCase() === 'content-type')) {
      // form-data 不手动设置 Content-Type
    }
  }

  if (!req.url) return { request: req, error: '未识别到请求地址（需 http/https 开头）' };
  return { request: req };
}

function emptyRequest(): RequestConfig {
  return {
    kind: 'http',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { type: 'none', rawType: 'json', raw: '', form: [] },
    auth: { type: 'none', token: '', username: '', password: '' },
  };
}

/** 分词：处理单引号、双引号、$'...'、换行续行 */
function tokenize(cmd: string): string[] {
  const prepared = cmd.replace(/\\\r?\n/g, ' ');
  const tokens: string[] = [];
  let cur = '';
  let has = false;
  let i = 0;
  while (i < prepared.length) {
    const ch = prepared[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (has) {
        tokens.push(cur);
        cur = '';
        has = false;
      }
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < prepared.length && prepared[i] !== quote) {
        if (quote === '"' && prepared[i] === '\\' && i + 1 < prepared.length) {
          cur += prepared[i + 1];
          i += 2;
          continue;
        }
        cur += prepared[i];
        i++;
      }
      i++; // 跳过结束引号
      has = true;
      continue;
    }
    cur += ch;
    has = true;
    i++;
  }
  if (has) tokens.push(cur);
  return tokens;
}

function stripQuotes(s: string): string {
  // tokenize 已去引号，这里兜底去掉残留的 $'...' 形式
  if (s.startsWith("$'") && s.endsWith("'")) return s.slice(2, -1);
  return s;
}

function splitHeader(line: string): KV | null {
  const idx = line.indexOf(':');
  if (idx <= 0) return null;
  const key = line.slice(0, idx).trim();
  const value = line.slice(idx + 1).trim();
  if (!key) return null;
  return newKV(key, value);
}

function splitForm(line: string): KV | null {
  const idx = line.indexOf('=');
  if (idx <= 0) return null;
  const key = line.slice(0, idx).trim();
  let value = line.slice(idx + 1);
  if (value.startsWith('@')) {
    value = value.slice(1);
    return { ...newKV(key, value), type: 'file', fileName: value, file: null };
  }
  return newKV(key, value);
}

function parseUrlencodedText(text: string): KV[] {
  return text
    .split('&')
    .map((pair) => {
      const idx = pair.indexOf('=');
      if (idx < 0) return newKV(decodeSafe(pair), '');
      return newKV(decodeSafe(pair.slice(0, idx)), decodeSafe(pair.slice(idx + 1)));
    })
    .filter((kv) => kv.key !== '');
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

// ---- 序列化为 cURL ----

function shellQuote(s: string): string {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

export function toCurl(req: RequestConfig): string {
  const lines: string[] = [`curl -X ${req.method}`];
  if (req.url) lines.push(`  ${shellQuote(req.url)}`);

  for (const h of req.headers) {
    if (!h.enabled || !h.key.trim()) continue;
    if (req.body.type === 'form-data' && h.key.toLowerCase() === 'content-type') continue;
    lines.push(`  -H ${shellQuote(`${h.key}: ${h.value}`)}`);
  }

  const { auth } = req;
  if (auth.type === 'bearer' && auth.token.trim()) {
    lines.push(`  -H ${shellQuote(`Authorization: Bearer ${auth.token.trim()}`)}`);
  } else if (auth.type === 'basic' && auth.username.trim()) {
    lines.push(`  -u ${shellQuote(`${auth.username}:${auth.password}`)}`);
  }

  if (req.body.type === 'urlencoded') {
    const text = req.body.form
      .filter((r) => r.enabled && r.key.trim())
      .map((r) => `${enc(r.key)}=${enc(r.value)}`)
      .join('&');
    if (text) lines.push(`  --data-raw ${shellQuote(text)}`);
  } else if (req.body.type === 'form-data') {
    for (const r of req.body.form) {
      if (!r.enabled || !r.key.trim()) continue;
      if (r.type === 'file') {
        lines.push(`  -F ${shellQuote(`${r.key}=@${r.fileName || r.value || '文件'}`)}`);
      } else {
        lines.push(`  -F ${shellQuote(`${r.key}=${r.value}`)}`);
      }
    }
  } else if (req.body.type === 'raw' && req.body.raw.trim()) {
    lines.push(`  --data-raw ${shellQuote(req.body.raw)}`);
  }

  return lines.join(' \\\n');
}

function enc(s: string): string {
  try {
    return encodeURIComponent(s);
  } catch {
    return s;
  }
}

/** 请求是否可以导出为 cURL（http 请求均可） */
export function curlId(): string {
  return uid();
}
