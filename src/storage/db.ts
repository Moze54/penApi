// 本地存储适配层：扩展环境用 chrome.storage.local，开发模式降级 localStorage

const isExt = typeof chrome !== 'undefined' && !!chrome.storage?.local;

export const storageKind: 'extension' | 'web' = isExt ? 'extension' : 'web';

/**
 * Vue reactive 代理不能直接交给 chrome.storage：其序列化会把 Proxy 数组存成
 * {0:…,1:…} 形状的普通对象，重开读取时展开即抛 "not iterable"（表现为数据丢失）。
 * 所有写入先深拷贝成纯值，从根上消除代理。
 */
function toPlain(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/**
 * 读取校验与自愈：数组原样返回；形如 {0:…,1:…} 的数组状对象按数字键还原为数组
 * （修复历史版本写坏的数据）；其余形状返回 null 由调用方兜底。
 */
export function asArray<T>(v: unknown): T[] | null {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      return keys.sort((a, b) => Number(a) - Number(b)).map((k) => obj[k] as T);
    }
  }
  return null;
}

export const db = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      if (isExt) {
        const res = await chrome.storage.local.get(key);
        return (key in res ? (res[key] as T) : fallback);
      }
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch (e) {
      console.warn('[penapi] 读取存储失败', key, e);
      return fallback;
    }
  },

  async set(key: string, value: unknown): Promise<boolean> {
    try {
      if (isExt) {
        await chrome.storage.local.set({ [key]: toPlain(value) });
        return true;
      }
      localStorage.setItem(key, JSON.stringify(toPlain(value)));
      return true;
    } catch (e) {
      // 写失败绝不能静默：数据丢了用户毫无感知，必须立刻暴露
      console.error('[penapi] 数据写入失败', key, e);
      window.dispatchEvent(
        new CustomEvent('penapi-storage-error', {
          detail: { key, message: String((e as Error)?.message || e) },
        }),
      );
      return false;
    }
  },

  async remove(key: string): Promise<void> {
    try {
      if (isExt) {
        await chrome.storage.local.remove(key);
        return;
      }
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[penapi] 删除存储失败', key, e);
    }
  },

  async clear(): Promise<void> {
    try {
      if (isExt) {
        await chrome.storage.local.clear();
        return;
      }
      // web 模式只清自己的 key，避免误伤同域其他数据
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('penapi.'));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[penapi] 清空存储失败', e);
    }
  },
};

export const SKEYS = {
  projects: 'penapi.projects',
  nodes: 'penapi.nodes',
  envs: 'penapi.envs',
  activeEnv: 'penapi.activeEnv',
  history: 'penapi.history',
  settings: 'penapi.settings',
} as const;
