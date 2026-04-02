const { app, BrowserWindow, shell, dialog, ipcMain, Notification, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const { execFile, spawn } = require('child_process');

let mainWindow;

// ══════════════════════════════════════════════════════════════════
// ── OTA Auto-Update via GitHub Releases ───────────────────────────
// ══════════════════════════════════════════════════════════════════
const GITHUB_OWNER  = 'LomKich';          // ← ваш GitHub username
const GITHUB_REPO   = 'ScheduleApp';      // ← репозиторий
const UPDATE_INTERVAL_MS = 60 * 60 * 1000; // проверять каждый час

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: url,
      method: 'GET',
      headers: {
        'User-Agent': `ScheduleApp-Desktop/${app.getVersion()}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function semverGt(a, b) {
  // returns true if version string a > b  (e.g. "1.2.3" > "1.2.0")
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false;
}

// Находим нужный asset для текущей платформы
function findAssetForPlatform(assets) {
  const plat = process.platform; // 'win32' | 'darwin' | 'linux'
  const arch  = process.arch;    // 'x64' | 'arm64'
  const exts = plat === 'win32' ? ['.exe', '.msi'] :
               plat === 'darwin' ? ['.dmg'] :
               ['.AppImage', '.deb', '.rpm'];
  for (const ext of exts) {
    const found = assets.find(a =>
      a.name.toLowerCase().endsWith(ext) &&
      (arch === 'arm64' ? a.name.includes('arm64') || a.name.includes('aarch64') : !a.name.includes('arm64'))
    );
    if (found) return found;
  }
  return assets[0] || null;
}

async function checkForUpdates(silent = false) {
  try {
    const release = await fetchJson(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
    if (!release || !release.tag_name) { if (!silent) showNoUpdate(); return; }

    const latestVer = release.tag_name.replace(/^v/, '');
    const currentVer = app.getVersion();

    if (!semverGt(latestVer, currentVer)) {
      if (!silent) showNoUpdate(currentVer);
      return;
    }

    // Нашли новую версию!
    const asset   = findAssetForPlatform(release.assets || []);
    const body    = (release.body || '').slice(0, 600);
    const btnLabel = asset ? 'Скачать и установить' : 'Открыть страницу релиза';

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '🔄 Доступно обновление',
      message: `Новая версия: v${latestVer}\nТекущая: v${currentVer}`,
      detail: body || 'Нажмите «Скачать и установить» чтобы обновиться.',
      buttons: [btnLabel, 'Позже'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 1) return;

    if (!asset) {
      shell.openExternal(release.html_url);
      return;
    }

    // Скачиваем установщик
    await downloadAndInstall(asset, release.html_url);

  } catch (err) {
    if (!silent) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Ошибка проверки обновлений',
        message: 'Не удалось подключиться к GitHub: ' + err.message,
        buttons: ['OK'],
      });
    }
  }
}

function showNoUpdate(ver) {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Обновлений нет',
    message: `У вас последняя версия${ver ? ` (v${ver})` : ''}.`,
    buttons: ['OK'],
  });
}

function downloadAndInstall(asset, fallbackUrl) {
  return new Promise(async (resolve) => {
    const tmpDir   = os.tmpdir();
    const destPath = path.join(tmpDir, asset.name);

    // Прогресс-диалог через уведомление
    if (Notification.isSupported()) {
      new Notification({ title: '⬇️ Загрузка обновления', body: asset.name }).show();
    }

    // Если файл уже скачан — не скачиваем снова
    if (fs.existsSync(destPath)) {
      launchInstaller(destPath, fallbackUrl);
      resolve();
      return;
    }

    try {
      await downloadFile(asset.browser_download_url, destPath);
      launchInstaller(destPath, fallbackUrl);
    } catch (err) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Ошибка загрузки',
        message: 'Не удалось скачать установщик. Открываем страницу для ручной загрузки.',
        buttons: ['OK'],
      });
      shell.openExternal(fallbackUrl);
    }
    resolve();
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    // Поддержка редиректов (GitHub CDN)
    function get(u, redirects = 0) {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      const lib = u.startsWith('https') ? https : http;
      lib.get(u, { headers: { 'User-Agent': `ScheduleApp-Desktop/${app.getVersion()}` } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          return get(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => out.close(resolve));
        out.on('error', reject);
      }).on('error', reject);
    }
    get(url);
  });
}

function launchInstaller(filePath, fallbackUrl) {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '✅ Загрузка завершена',
    message: 'Установщик скачан. Приложение закроется для установки обновления.',
    buttons: ['Установить сейчас'],
    defaultId: 0,
  }).then(() => {
    if (process.platform === 'win32') {
      spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      execFile('open', [filePath]);
    } else {
      execFile('chmod', ['+x', filePath], () => {
        spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
      });
    }
    app.quit();
  });
}

// ── Register custom protocol schemes before app is ready ─────────────────────
// We intercept https://sounds.local/* → assets/sounds/*
// and https://dice.local/*  → assets/dice/*
// This mirrors what Android does with shouldInterceptRequest.
protocol.registerSchemesAsPrivileged([
  { scheme: 'https', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 860,
    minWidth: 360,
    minHeight: 600,
    title: 'ScheduleApp',
    backgroundColor: '#0d0d0d',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,           // allow loading local assets + supabase
      allowRunningInsecureContent: true,
      // Allow media (camera/mic) for voice/video recording
      experimentalFeatures: true,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'assets', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Grant media permissions (camera, mic)
  mainWindow.webContents.session.setPermissionRequestHandler((wc, perm, cb) => {
    const allowed = ['media', 'camera', 'microphone', 'notifications', 'clipboard-read'];
    cb(allowed.includes(perm));
  });
}

app.whenReady().then(() => {
  // ── Intercept https://sounds.local/* and https://dice.local/* ──────────────
  const assetsDir = path.join(__dirname, 'assets');
  const { session } = require('electron');

  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['https://sounds.local/*', 'https://dice.local/*'] },
    (details, callback) => {
      const url = new URL(details.url);
      let localPath;
      if (url.hostname === 'sounds.local') {
        localPath = path.join(assetsDir, 'sounds', decodeURIComponent(url.pathname.slice(1)));
      } else if (url.hostname === 'dice.local') {
        localPath = path.join(assetsDir, 'dice', decodeURIComponent(url.pathname.slice(1)));
      }
      if (localPath && fs.existsSync(localPath)) {
        callback({ redirectURL: `file://${localPath.replace(/\\/g, '/')}` });
      } else {
        callback({});
      }
    }
  );

  createWindow();

  // ── Авто-проверка обновлений при старте (через 5 сек после запуска) ──
  setTimeout(() => checkForUpdates(true), 5000);
  // Повторная проверка каждый час
  setInterval(() => checkForUpdates(true), UPDATE_INTERVAL_MS);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC handlers (called from preload.js) ────────────────────────────────────

// Open URL in default browser
ipcMain.handle('open-url', async (_, url) => {
  shell.openExternal(url);
});

// Show OS notification
ipcMain.handle('show-notification', async (_, title, body) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

// File picker for background image
ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите изображение',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const data = fs.readFileSync(result.filePaths[0]);
  const ext = path.extname(result.filePaths[0]).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${data.toString('base64')}`;
});

// File picker for uploads (any file)
ipcMain.handle('pick-file', async (_, accept) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите файл',
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const data = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  return {
    name,
    base64: data.toString('base64'),
    size: data.length,
    path: filePath,
  };
});

// Save file to Downloads
ipcMain.handle('save-file', async (_, { name, base64, mime }) => {
  const downloads = app.getPath('downloads');
  const filePath = path.join(downloads, name);
  const buf = Buffer.from(base64, 'base64');
  fs.writeFileSync(filePath, buf);
  shell.showItemInFolder(filePath);
  return filePath;
});

// Native HTTP fetch (bypass CORS)
ipcMain.handle('native-fetch', async (_, url, options) => {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options?.method || 'GET',
      headers: options?.headers || {},
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    if (options?.body) req.write(options.body);
    req.end();
  });
});

// Get app version
ipcMain.handle('get-version', async () => {
  return app.getVersion();
});

// Manual update check (called from renderer via preload)
ipcMain.handle('check-updates', async () => {
  await checkForUpdates(false);
});

// Clear cache
ipcMain.handle('clear-cache', async () => {
  await mainWindow.webContents.session.clearCache();
});

// Reload webview to a URL
ipcMain.handle('load-url', async (_, url) => {
  mainWindow.webContents.loadURL(url);
});
