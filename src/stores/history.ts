import { defineStore } from 'pinia';
import type { HistoryRecord } from '@/types';
import { db, SKEYS } from '@/storage/db';
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
      this.records = await db.get<HistoryRecord[]>(SKEYS.history, []);
      this.loaded = true;
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
