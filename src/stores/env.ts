import { defineStore } from 'pinia';
import type { Environment, EnvVar } from '@/types';
import { db, SKEYS } from '@/storage/db';
import { uid } from '@/core/util';
import { envMap } from '@/core/vars';
import { debounce } from '@/core/util';

interface EnvState {
  envs: Environment[];
  activeEnvId: string;
  loaded: boolean;
}

export const useEnvStore = defineStore('env', {
  state: (): EnvState => ({
    envs: [],
    activeEnvId: '',
    loaded: false,
  }),

  getters: {
    active(state): Environment | null {
      return state.envs.find((e) => e.id === state.activeEnvId) ?? null;
    },
    /** 当前生效变量表 */
    vars(): Record<string, string> {
      return envMap(this.active);
    },
  },

  actions: {
    async load() {
      const [envs, activeEnvId] = await Promise.all([
        db.get<Environment[]>(SKEYS.envs, []),
        db.get<string>(SKEYS.activeEnv, ''),
      ]);
      this.envs = envs;
      this.activeEnvId = envs.some((e) => e.id === activeEnvId) ? activeEnvId : '';
      this.loaded = true;
    },

    persist() {
      queuePersist(this.envs, this.activeEnvId);
    },

    createEnv(name: string): Environment {
      const env: Environment = { id: uid(), name: name.trim() || '新环境', vars: [] };
      this.envs.push(env);
      this.persist();
      return env;
    },

    renameEnv(id: string, name: string) {
      const env = this.envs.find((e) => e.id === id);
      if (env && name.trim()) {
        env.name = name.trim();
        this.persist();
      }
    },

    deleteEnv(id: string) {
      this.envs = this.envs.filter((e) => e.id !== id);
      if (this.activeEnvId === id) this.activeEnvId = '';
      this.persist();
    },

    setActive(id: string) {
      this.activeEnvId = id;
      this.persist();
    },

    updateVars(envId: string, vars: EnvVar[]) {
      const env = this.envs.find((e) => e.id === envId);
      if (env) {
        env.vars = vars;
        this.persist();
      }
    },

    /** 批量写入变量（存在则更新，不存在则新增）；无激活环境返回 false */
    setVarValues(updates: Record<string, string>): boolean {
      const env = this.active;
      if (!env) return false;
      for (const [key, value] of Object.entries(updates)) {
        const row = env.vars.find((v) => v.key === key);
        if (row) row.value = value;
        else env.vars.push({ id: uid(), key, value, enabled: true });
      }
      this.persist();
      return true;
    },

    /** 备份导入 */
    importAll(envs: Environment[]) {
      this.envs = envs;
      if (!envs.some((e) => e.id === this.activeEnvId)) this.activeEnvId = '';
      this.persist();
    },
  },
});

const queuePersist = debounce((envs: Environment[], activeEnvId: string) => {
  db.set(SKEYS.envs, envs);
  db.set(SKEYS.activeEnv, activeEnvId);
}, 300);
