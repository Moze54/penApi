import type { KV } from '@/types';
import { uid } from './util';

/** 新建键值对行 */
export function newKV(key = '', value = '', enabled = true): KV {
  return { id: uid(), key, value, enabled, type: 'text', file: null };
}
