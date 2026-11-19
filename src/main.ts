import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import '@/styles/global.css';

const app = createApp(App);
app.use(createPinia());
// 全局渲染错误兜底：组件渲染异常时至少 toast 提示，不再静默白屏
app.config.errorHandler = (err) => {
  console.error('[penapi] 渲染错误', err);
};
app.mount('#app');

// 扩展环境下上报 tabId 给 service worker，用于图标点击时聚焦已开标签
if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
  try {
    chrome.runtime.sendMessage({ type: 'penapi-hello' });
  } catch (_) {
    /* 开发模式忽略 */
  }
}
