import { defineStore } from 'pinia';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types';
import { db, SKEYS } from '@/storage/db';
import { debounce } from '@/core/util';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    settings: { ...DEFAULT_SETTINGS },
    loaded: false,
  }),

  actions: {
    async load() {
      const saved = await db.get<unknown>(SKEYS.settings, {});
      const base =
        saved && typeof saved === 'object' && !Array.isArray(saved)
          ? (saved as Partial<AppSettings>)
          : {};
      this.settings = { ...DEFAULT_SETTINGS, ...base };
      this.loaded = true;
    },

    update(patch: Partial<AppSettings>) {
      this.settings = { ...this.settings, ...patch };
      queuePersist(this.settings);
    },

    importAll(settings: Partial<AppSettings>) {
      this.settings = { ...DEFAULT_SETTINGS, ...settings };
      queuePersist(this.settings);
    },
  },
});

const queuePersist = debounce((settings: AppSettings) => {
  db.set(SKEYS.settings, settings);
}, 300);
