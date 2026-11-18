import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import '@/styles/global.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');

// 扩展环境下上报 tabId 给 service worker，用于图标点击时聚焦已开标签
if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
  try {
    chrome.runtime.sendMessage({ type: 'penapi-hello' });
  } catch (_) {
    /* 开发模式忽略 */
  }
}
