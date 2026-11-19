/** 生成短唯一 id */
export function uid(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8) +
    Math.floor(Math.random() * 1e6).toString(36)
  );
}

/** 深拷贝（结构化数据） */
export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * 防抖（带 flush 支持）
 * - wrapped.flush()：立即执行挂起的调用（导入/保存等关键操作后调用，防关窗丢写）
 * - 页面 pagehide / 隐藏时自动 flush 全部挂起写入
 */
const flushers: (() => void)[] = [];
if (typeof window !== 'undefined') {
  const runFlush = () => {
    for (const f of flushers) {
      try {
        f();
      } catch {
        /* 忽略单个 flush 异常 */
      }
    }
  };
  window.addEventListener('pagehide', runFlush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') runFlush();
  });
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = 300) {
  let t: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;
  const wrapped = (...args: A) => {
    lastArgs = args;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = undefined;
      fn(...(lastArgs as A));
    }, ms);
  };
  wrapped.flush = () => {
    if (t && lastArgs) {
      clearTimeout(t);
      t = undefined;
      fn(...lastArgs);
    }
  };
  flushers.push(() => wrapped.flush());
  return wrapped;
}

/** 字节数格式化 */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 时间格式化 */
export function formatTime(ms: number): string {
  if (!Number.isFinite(ms)) return '-';
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
