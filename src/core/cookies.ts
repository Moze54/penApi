// Cookie 管理：扩展环境使用 chrome.cookies API；网页模式降级为当前域 document.cookie
export interface CookieRow {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  session: boolean;
  expirationDate?: number;
}

export const cookiesSupported = typeof chrome !== 'undefined' && !!chrome.cookies;

export async function listCookies(domain: string): Promise<CookieRow[]> {
  const d = domain.trim();
  if (!d) return [];

  if (cookiesSupported) {
    const list = await chrome.cookies.getAll({ domain: d });
    return list
      .map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        session: c.session,
        expirationDate: c.expirationDate,
      }))
      .sort((a, b) => (a.domain === b.domain ? a.name.localeCompare(b.name) : a.domain.localeCompare(b.domain)));
  }

  // 网页模式：仅能读取当前页面同域的非 HttpOnly Cookie
  const host = location.hostname;
  if (!host) return [];
  const target = d.replace(/^\./, '');
  if (!(host === target || host.endsWith(`.${target}`))) return [];

  const rows: CookieRow[] = [];
  const raw = document.cookie;
  if (!raw) return rows;
  for (const pair of raw.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    rows.push({
      name: pair.slice(0, idx).trim(),
      value: unpack(pair.slice(idx + 1).trim()),
      domain: host,
      path: '/',
      secure: location.protocol === 'https:',
      httpOnly: false,
      session: true,
    });
  }
  return rows;
}

function unpack(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function urlOf(domain: string, path: string): string {
  const host = domain.replace(/^\./, '');
  return `https://${host}${path || '/'}`;
}

export interface SetCookieInput {
  domain: string;
  path: string;
  name: string;
  value: string;
  secure?: boolean;
  httpOnly?: boolean;
}

export async function saveCookie(input: SetCookieInput): Promise<void> {
  if (!cookiesSupported) {
    document.cookie = `${input.name}=${encodeURIComponent(input.value)}; path=${input.path || '/'}`;
    return;
  }
  const details: chrome.cookies.SetDetails = {
    url: urlOf(input.domain, input.path),
    name: input.name,
    value: input.value,
    path: input.path || '/',
  };
  if (input.secure !== undefined) details.secure = input.secure;
  if (input.httpOnly !== undefined) details.httpOnly = input.httpOnly;
  if (input.domain) details.domain = input.domain;
  const ok = await chrome.cookies.set(details);
  if (!ok) throw new Error('写入失败：域名 / 路径不合法或缺少权限');
}

export async function removeCookie(row: CookieRow): Promise<void> {
  if (!cookiesSupported) {
    document.cookie = `${row.name}=; path=${row.path}; max-age=0`;
    return;
  }
  await chrome.cookies.remove({ url: urlOf(row.domain, row.path), name: row.name });
}

export async function clearDomainCookies(domain: string): Promise<number> {
  const rows = await listCookies(domain);
  let n = 0;
  for (const row of rows) {
    await removeCookie(row);
    n++;
  }
  return n;
}
