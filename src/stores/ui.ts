import { defineStore } from 'pinia';
import { uid } from '@/core/util';

export type ModalType =
  | 'env'
  | 'settings'
  | 'save-request'
  | 'curl-import'
  | 'import-apis'
  | 'postman-import'
  | 'codegen'
  | 'cookies'
  | 'capture'
  | null;

export interface Toast {
  id: string;
  text: string;
  type: 'ok' | 'error' | 'info';
}

export interface ConfirmPayload {
  title: string;
  message: string;
  okText?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

export interface PromptPayload {
  title: string;
  label?: string;
  value: string;
  placeholder?: string;
  okText?: string;
  resolve: (value: string | null) => void;
}

export interface SaveRequestPayload {
  tabId: string;
}

export interface CodegenPayload {
  tabId: string;
}

interface UiState {
  toasts: Toast[];
  modal: ModalType;
  modalPayload: unknown;
  confirm: ConfirmPayload | null;
  prompt: PromptPayload | null;
  sidebarView: 'library' | 'history';
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    toasts: [],
    modal: null,
    modalPayload: null,
    confirm: null,
    prompt: null,
    sidebarView: 'library',
  }),

  actions: {
    toast(text: string, type: Toast['type'] = 'ok') {
      const id = uid();
      this.toasts.push({ id, text, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, 2600);
    },

    askConfirm(opts: Omit<ConfirmPayload, 'resolve'>): Promise<boolean> {
      return new Promise((resolve) => {
        this.confirm = { ...opts, resolve };
      });
    },

    resolveConfirm(ok: boolean) {
      this.confirm?.resolve(ok);
      this.confirm = null;
    },

    askPrompt(opts: Omit<PromptPayload, 'resolve'>): Promise<string | null> {
      return new Promise((resolve) => {
        this.prompt = { ...opts, resolve };
      });
    },

    resolvePrompt(value: string | null) {
      this.prompt?.resolve(value);
      this.prompt = null;
    },

    openModal(type: ModalType, payload?: unknown) {
      this.modal = type;
      this.modalPayload = payload ?? null;
    },

    closeModal() {
      this.modal = null;
      this.modalPayload = null;
    },
  },
});
