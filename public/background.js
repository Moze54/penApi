// PenApi 后台 service worker：点击工具栏图标时打开 / 聚焦全屏调试页；页面请求抓包监听
const APP_PAGE = 'index.html';

async function openOrFocusAppTab() {
  const url = chrome.runtime.getURL(APP_PAGE);
  // 通过 storage.session 记住应用页所在标签，避免重复开标签（无需 tabs 权限）
  let savedTabId = null;
  try {
    const res = await chrome.storage.session.get('appTabId');
    savedTabId = res.appTabId ?? null;
  } catch (e) {
    savedTabId = null;
  }

  if (savedTabId != null) {
    try {
      await chrome.tabs.get(savedTabId);
      await chrome.tabs.update(savedTabId, { active: true });
      const tab = await chrome.tabs.get(savedTabId);
      if (tab.windowId != null) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return;
    } catch (e) {
      // 标签已不存在，走新建
      try {
        await chrome.storage.session.remove('appTabId');
      } catch (_) {}
    }
  }

  const tab = await chrome.tabs.create({ url });
  try {
    await chrome.storage.session.set({ appTabId: tab.id });
  } catch (_) {}
}

chrome.action.onClicked.addListener(() => {
  openOrFocusAppTab();
});

// 应用页每次打开时上报自己的 tabId
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'penapi-hello' && sender.tab && sender.tab.id != null) {
    chrome.storage.session.set({ appTabId: sender.tab.id });
  }
});

// ---- 页面请求抓包（webRequest 只读监听，需 UI 侧开启开关） ----
const CAP_ON_KEY = 'penapi.capture.on';
const CAP_LIST_KEY = 'penapi.capture.records';
const CAP_LIMIT = 300;
const CAP_BODY_LIMIT = 64 * 1024;

let captureOn = false;
let capSeq = 0;
let capRecords = [];
const capStarts = new Map();
let persistTimer = null;

chrome.storage.local
  .get(CAP_ON_KEY)
  .then((res) => {
    captureOn = res[CAP_ON_KEY] === true;
  })
  .catch(() => {});

function persistCapture() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    chrome.storage.local.set({ [CAP_LIST_KEY]: capRecords }).catch(() => {});
  }, 400);
}

function decodeBody(rb) {
  try {
    if (!rb) return { text: '', form: null };
    if (rb.formData) {
      const form = [];
      for (const k of Object.keys(rb.formData)) {
        for (const v of rb.formData[k]) form.push({ key: k, value: String(v) });
      }
      return { text: '', form };
    }
    const raw = rb.raw && rb.raw[0];
    if (raw && raw.bytes) {
      let text = new TextDecoder('utf-8').decode(new Uint8Array(raw.bytes));
      if (text.length > CAP_BODY_LIMIT) text = text.slice(0, CAP_BODY_LIMIT);
      return { text, form: null };
    }
  } catch (e) {}
  return { text: '', form: null };
}

const REQ_FILTER = { urls: ['http://*/*', 'https://*/*'], types: ['xmlhttprequest'] };

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!captureOn) return;
    if (details.method === 'OPTIONS') return;
    const body = decodeBody(details.requestBody);
    const rec = {
      id: 'cap_' + Date.now() + '_' + ++capSeq,
      requestId: details.requestId,
      method: details.method,
      url: details.url,
      headers: [],
      bodyText: body.text,
      bodyForm: body.form,
      status: null,
      statusText: '',
      time: null,
      error: null,
      ts: details.timeStamp,
    };
    capStarts.set(details.requestId, { ts: details.timeStamp, rec });
    capRecords.unshift(rec);
    if (capRecords.length > CAP_LIMIT) capRecords.length = CAP_LIMIT;
    persistCapture();
  },
  REQ_FILTER,
  ['requestBody'],
);

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!captureOn) return;
    const hit = capStarts.get(details.requestId);
    if (hit && details.requestHeaders) {
      hit.rec.headers = details.requestHeaders.map((h) => [h.name, h.value ?? '']);
    }
  },
  REQ_FILTER,
  ['requestHeaders', 'extraHeaders'],
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!captureOn) return;
    const hit = capStarts.get(details.requestId);
    if (hit) {
      hit.rec.status = details.statusCode;
      hit.rec.statusText = details.statusLine ?? '';
      hit.rec.time = Math.round(details.timeStamp - hit.ts);
      capStarts.delete(details.requestId);
      persistCapture();
    }
  },
  REQ_FILTER,
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (!captureOn) return;
    const hit = capStarts.get(details.requestId);
    if (hit) {
      hit.rec.error = details.error ?? 'error';
      hit.rec.time = Math.round(details.timeStamp - hit.ts);
      capStarts.delete(details.requestId);
      persistCapture();
    }
  },
  REQ_FILTER,
);

// 捕获开关 / 清空（来自应用页）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string' || msg.type.indexOf('penapi-capture-') !== 0) return;
  if (msg.type === 'penapi-capture-on') {
    captureOn = true;
    chrome.storage.local.set({ [CAP_ON_KEY]: true }).catch(() => {});
    sendResponse({ ok: true });
  } else if (msg.type === 'penapi-capture-off') {
    captureOn = false;
    chrome.storage.local.set({ [CAP_ON_KEY]: false }).catch(() => {});
    sendResponse({ ok: true });
  } else if (msg.type === 'penapi-capture-clear') {
    capRecords = [];
    capStarts.clear();
    chrome.storage.local.set({ [CAP_LIST_KEY]: [] }).catch(() => {});
    sendResponse({ ok: true });
  }
  return true;
});
