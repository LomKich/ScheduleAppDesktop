/**
 * preload.js — Android bridge polyfill для ScheduleApp Desktop
 *
 * Каждый метод window.Android.* реализован через Electron IPC
 * или в виде разумной заглушки. Методы, связанные с Android-
 * специфичными фичами (VPN, DPI, смена иконки лаунчера), тихо
 * игнорируются.
 */

const { contextBridge, ipcRenderer } = require('electron');

// ── helpers ──────────────────────────────────────────────────────────────────

function noop() {}
function noopTrue() { return true; }
function noopFalse() { return false; }
function noopZero() { return '0'; }
function noopEmptyArr() { return '[]'; }

// Invoke a callback by name that the JS side registered on window
function invokeCallback(cbName, ...args) {
  try {
    if (cbName && typeof window[cbName] === 'function') {
      window[cbName](...args);
    }
  } catch (e) {
    console.warn('[Android bridge] callback error:', cbName, e);
  }
}

// ── Android bridge object ─────────────────────────────────────────────────────

const AndroidBridge = {

  // ── Logging ──────────────────────────────────────────────────────────────
  log: (msg) => console.log('[App]', msg),
  logMsg: (msg) => console.log('[App]', msg),

  // ── App info ─────────────────────────────────────────────────────────────
  getAppVersion: () => {
    // synchronous – return cached value, update async
    ipcRenderer.invoke('get-version').then(v => {
      window.__appVersion = v;
    });
    return window.__appVersion || '1.0.0';
  },

  // ── URL / navigation ──────────────────────────────────────────────────────
  openUrl: (url) => {
    ipcRenderer.invoke('open-url', url);
  },
  openInAppBrowser: (url) => {
    ipcRenderer.invoke('open-url', url);
  },
  loadUrlInWebView: (url) => {
    ipcRenderer.invoke('load-url', url);
  },

  // ── Cache ─────────────────────────────────────────────────────────────────
  clearWebViewCache: () => {
    ipcRenderer.invoke('clear-cache');
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  showNotification: (title, body) => {
    ipcRenderer.invoke('show-notification', title, body);
  },
  getNotificationPermission: noopTrue,
  requestNotificationPermission: noop,
  savePushConfig: noop,

  // ── Image / file picker ───────────────────────────────────────────────────
  pickImageForBackground: async (cbName) => {
    const dataUrl = await ipcRenderer.invoke('pick-image');
    if (dataUrl) invokeCallback(cbName, dataUrl);
  },
  saveImageToGallery: async (base64Data) => {
    // base64Data may be a data-URL or raw base64
    let raw = base64Data;
    let mime = 'image/png';
    if (base64Data.startsWith('data:')) {
      const m = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (m) { mime = m[1]; raw = m[2]; }
    }
    const ext = mime.split('/')[1] || 'png';
    const name = `image_${Date.now()}.${ext}`;
    await ipcRenderer.invoke('save-file', { name, base64: raw, mime });
  },

  // ── File upload ───────────────────────────────────────────────────────────
  nativeUploadFile: async (cbName, url, headers) => {
    const file = await ipcRenderer.invoke('pick-file');
    if (!file) { invokeCallback(cbName, null); return; }
    // Use browser fetch to upload
    try {
      const blob = await fetch(`data:application/octet-stream;base64,${file.base64}`).then(r => r.blob());
      const fd = new FormData();
      fd.append('file', blob, file.name);
      const parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : (headers || {});
      const res = await fetch(url, { method: 'POST', headers: parsedHeaders, body: fd });
      const text = await res.text();
      invokeCallback(cbName, text);
    } catch (e) {
      invokeCallback(cbName, null);
    }
  },
  nativeUploadFileAsync: async (url, headers, cbName) => {
    AndroidBridge.nativeUploadFile(cbName, url, headers);
  },

  // ── Native HTTP fetch (bypass CORS) ───────────────────────────────────────
  nativeFetch: async (url, optionsJson, cbName) => {
    try {
      const options = typeof optionsJson === 'string' ? JSON.parse(optionsJson) : (optionsJson || {});
      const result = await ipcRenderer.invoke('native-fetch', url, options);
      invokeCallback(cbName, JSON.stringify(result));
    } catch (e) {
      invokeCallback(cbName, JSON.stringify({ error: e.message }));
    }
  },

  // ── Download APK / base ───────────────────────────────────────────────────
  downloadAndInstallApk: (url) => {
    // On PC just open the URL in browser
    ipcRenderer.invoke('open-url', url);
  },
  nativeDownloadBase: async (url, filename, cbName) => {
    try {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      const mime = res.headers.get('content-type') || 'application/octet-stream';
      await ipcRenderer.invoke('save-file', { name: filename || 'download', base64, mime });
      if (cbName) invokeCallback(cbName, true);
    } catch (e) {
      if (cbName) invokeCallback(cbName, false);
    }
  },

  // ── Background service (not needed on PC — polling runs in renderer) ──────
  isBackgroundServiceEnabled: noopFalse,
  startBackgroundService: noop,
  stopBackgroundService: noop,

  // ── VPN (not applicable on PC) ────────────────────────────────────────────
  getVpnState: noopFalse,
  toggleVpn: noop,
  setDns: noop,

  // ── Emoji packs ───────────────────────────────────────────────────────────
  getEmojiFileList: noopEmptyArr,
  isEmojiPackReady: noopFalse,
  downloadEmojiPackZip: noop,

  // ── Media recording (camera/mic available via browser APIs) ───────────────
  requestCameraPermission: (cbName) => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(() => invokeCallback(cbName, true))
      .catch(() => invokeCallback(cbName, false));
  },
  startCircleRecord: noop,
  stopCircleRecord: noop,
  cancelCircleRecord: noop,
  startVoiceRecording: noop,
  stopVoiceRecording: noop,
  cancelVoiceRecording: noop,

  // ── Backup ────────────────────────────────────────────────────────────────
  getBackupInfo: () => null,
  restoreBackup: noop,

  // ── OTA Updates ───────────────────────────────────────────────────────────
  checkForUpdates: () => {
    ipcRenderer.invoke('check-updates');
  },

  // ── Misc settings ─────────────────────────────────────────────────────────
  setAppIcon: noop,
  setDpiStrategy: noop,
  switchToNativeUI: noop,
  saveUserGroups: noop,
  heartbeat: noop,

  // ── Messenger helpers ─────────────────────────────────────────────────────
  getJavaSbLastTs: noopZero,
  updateLastMsgTs: noop,
};

// ── Expose to renderer ────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('Android', AndroidBridge);

// Also expose as 'AndroidBridge' alias just in case
contextBridge.exposeInMainWorld('AndroidBridge', AndroidBridge);

// Patch safe-area env vars for desktop (no notch)
contextBridge.exposeInMainWorld('__desktopMode', true);

// ── DOM ready: inject desktop CSS tweaks ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    /* Remove mobile-only safe-area paddings */
    :root {
      --safe-top: 0px !important;
      --safe-bot: 0px !important;
      --safe-left: 0px !important;
      --safe-right: 0px !important;
    }
    /* Restore scrollbars on desktop */
    html, body { overflow: auto !important; }
    /* Desktop scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); }
    /* Cursor for interactive elements */
    button, [onclick], a, .chat-row, .nav-btn { cursor: pointer; }
    /* Selection color */
    ::selection { background: rgba(232,119,34,0.35); }
    /* Запрет выделения текста при перетаскивании мышью (имитация touch) */
    body.mouse-dragging, body.mouse-dragging * { user-select: none !important; -webkit-user-select: none !important; }
  `;
  document.head.appendChild(style);

  // ── Mouse → Touch эмулятор ──────────────────────────────────────────────
  // Конвертирует mousedown/mousemove/mouseup в touchstart/touchmove/touchend
  // чтобы все свайп-жесты работали мышью точно так же, как пальцем.
  // Правая кнопка и средняя — не эмулируем (0 = левая).
  (function() {
    let active = false;
    let startX = 0, startY = 0;
    let movedEnough = false; // трекаем — было ли движение

    function makeTouch(e) {
      // TouchEvent требует Touch-объектов; эмулируем через CustomEvent + координаты
      return {
        identifier: 1,
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
        screenX: e.screenX,
        screenY: e.screenY,
        target: e.target,
        radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1,
      };
    }

    function dispatch(el, type, e) {
      const touch = makeTouch(e);
      try {
        const evt = new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches:        type === 'touchend' ? [] : [touch],
          targetTouches:  type === 'touchend' ? [] : [touch],
          changedTouches: [touch],
        });
        el.dispatchEvent(evt);
      } catch (_) {
        // Fallback: браузер не поддерживает TouchEvent — ничего не делаем
      }
    }

    // Элементы, где НЕ надо эмулировать свайп (поля ввода, кнопки прокрутки)
    function isExcluded(el) {
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      // Канвасы игр — у них своя мышиная обработка, не трогаем
      if (tag === 'CANVAS') return true;
      return false;
    }

    // Проверяем: есть ли у элемента или его родителя onclick-обработчик (кнопка/ссылка)?
    // Для таких элементов свайп-жесты нас не интересуют, 
    // но touch-эмуляцию всё равно делаем — просто не блокируем нативный click.
    // Эта функция нужна для защиты от ghost-click: если пользователь просто нажал,
    // а не свайпнул — мы вообще не диспатчим touch, оставляем нативный click.
    function isSimpleClick(dx, dy) {
      return Math.abs(dx) < 8 && Math.abs(dy) < 8;
    }

    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // только левая кнопка
      if (isExcluded(e.target)) return;
      active = true;
      movedEnough = false;
      startX = e.clientX;
      startY = e.clientY;
      document.body.classList.add('mouse-dragging');
      dispatch(e.target, 'touchstart', e);
    }, { passive: false });

    document.addEventListener('mousemove', (e) => {
      if (!active) return;
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (!movedEnough && (dx > 6 || dy > 6)) {
        movedEnough = true;
        // Отменяем нативный drag браузера
        e.preventDefault();
      }
      if (movedEnough) {
        dispatch(e.target, 'touchmove', e);
      }
    }, { passive: false });

    function onUp(e) {
      if (!active) return;
      active = false;
      document.body.classList.remove('mouse-dragging');
      // Если движения почти не было — это простой клик.
      // Не диспатчим touchend чтобы браузер не синтезировал ghost click
      // поверх нативного click события (double-fire проблема).
      if (!movedEnough) {
        // Простой клик — touchstart тоже не нужен был, но мы его уже отправили.
        // Посылаем touchcancel вместо touchend чтобы отменить цепочку без click.
        try {
          const touch = makeTouch(e);
          const evt = new TouchEvent('touchcancel', {
            bubbles: true, cancelable: true,
            touches: [], targetTouches: [], changedTouches: [touch],
          });
          e.target.dispatchEvent(evt);
        } catch(_) {}
        return;
      }
      dispatch(e.target, 'touchend', e);
    }

    document.addEventListener('mouseup',    onUp, { passive: true });
    document.addEventListener('mouseleave', onUp, { passive: true });

    // Запрет контекстного меню при быстром отпускании после свайпа
    document.addEventListener('contextmenu', (e) => {
      if (movedEnough) e.preventDefault();
    });
  })();
});
