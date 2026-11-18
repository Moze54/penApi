import type { Environment } from '@/types';

/** {{key}} 变量替换，未命中的保持原样 */
export function applyVars(input: string, vars: Record<string, string>): string {
  if (!input || !input.includes('{{')) return input;
  return input.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (raw, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : raw,
  );
}

/** 生效变量表（enabled 且 key 非空） */
export function envMap(env: Environment | null | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!env) return map;
  for (const v of env.vars) {
    if (v.enabled && v.key.trim()) map[v.key.trim()] = v.value;
  }
  return map;
}

/** 请求文本是否包含未解析的 {{var}} */
export function hasUnresolved(input: string, vars: Record<string, string>): boolean {
  if (!input || !input.includes('{{')) return false;
  const re = /\{\{\s*([\w.-]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    if (!Object.prototype.hasOwnProperty.call(vars, m[1])) return true;
  }
  return false;
}
