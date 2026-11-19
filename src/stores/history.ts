import { defineStore } from 'pinia';
import type { HistoryRecord } from '@/types';
import { db, SKEYS, asArray } from '@/storage/db';
import { normalizeHistoryRecord } from '@/core/normalize';
import { useSettingsStore } from './settings';
import { debounce } from '@/core/util';

interface HistoryState {
  records: HistoryRecord[];
  loaded: boolean;
}

export const useHistoryStore = defineStore('history', {
  state: (): HistoryState => ({
    records: [],
    loaded: false,
  }),

  actions: {
    async load() {
      const raw = await db.get<unknown>(SKEYS.history, []);
      const records = asArray<HistoryRecord>(raw);
      let fixed = !Array.isArray(raw);
      this.records = (records ?? []).map((rec) => {
        const norm = normalizeHistoryRecord(rec);
        if (norm.fixed) fixed = true;
        return norm.value;
      });
      this.loaded = true;
      if (fixed) {
        console.warn('[penapi] 检测到坏形状存储数据，已自动修复', SKEYS.history);
        this.persist();
        queuePersist.flush();
      }
    },

    persist() {
      queuePersist(this.records);
    },

    add(record: HistoryRecord) {
      const limit = useSettingsStore().settings.historyLimit;
      this.records.unshift(record);
      if (this.records.length > limit) {
        this.records = this.records.slice(0, limit);
      }
      this.persist();
    },

    remove(id: string) {
      this.records = this.records.filter((r) => r.id !== id);
      this.persist();
    },

    clear() {
      this.records = [];
      this.persist();
    },

    importAll(records: HistoryRecord[]) {
      this.records = records;
      this.persist();
    },
  },
});

const queuePersist = debounce((records: HistoryRecord[]) => {
  db.set(SKEYS.history, records);
}, 400);
