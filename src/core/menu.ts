// 右键菜单：模块级响应式状态，全局单实例渲染
import { reactive } from 'vue';

export interface MenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  action?: () => void;
}

interface CtxMenuState {
  show: boolean;
  x: number;
  y: number;
  items: MenuItem[];
}

export const ctxMenu = reactive<CtxMenuState>({
  show: false,
  x: 0,
  y: 0,
  items: [],
});

export function openCtxMenu(e: MouseEvent, items: MenuItem[]) {
  // 允许传入合成位置对象（如从按钮正下方弹出），故用可选调用
  e.preventDefault?.();
  e.stopPropagation?.();
  ctxMenu.items = items;
  ctxMenu.x = e.clientX;
  ctxMenu.y = e.clientY;
  ctxMenu.show = true;
}

export function closeCtxMenu() {
  ctxMenu.show = false;
  ctxMenu.items = [];
}
