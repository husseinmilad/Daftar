const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, Notification, screen, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;
let widgetWindow = null;
let tray = null;
let isQuitting = false;
let serverInstance = null;
let serverPort = 3000;

// Clean SVG data URI icon for Tray & Window
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="14" fill="#0F172A"/>
  <rect x="14" y="14" width="36" height="36" rx="6" stroke="#38BDF8" stroke-width="3.5"/>
  <path d="M22 26H42M22 34H36M22 42H30" stroke="#F8FAFC" stroke-width="3" stroke-linecap="round"/>
  <circle cx="44" cy="40" r="6" fill="#2563EB"/>
</svg>`;

function createAppIcon() {
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(ICON_SVG).toString('base64')}`;
  return nativeImage.createFromDataURL(dataUrl);
}

async function startLocalBackend() {
  const userDataDir = app.getPath('userData');
  process.env.OFFICE_DESK_DB_PATH = path.join(userDataDir, 'office-desk.db');
  process.env.NODE_ENV = app.isPackaged ? 'production' : process.env.NODE_ENV || 'development';
  process.env.PORT = String(serverPort);

  // Dynamically import ESM server.ts / compiled server
  process.env.OFFICE_DESK_DIST_PATH = path.join(app.getAppPath(), 'dist');
  const serverModulePath = path.join(app.getAppPath(), 'dist-electron', 'server.mjs');
  if (!fs.existsSync(serverModulePath)) {
    throw new Error(`فایل سرور برنامه پیدا نشد: ${serverModulePath}`);
  }
  const mod = await import(pathToFileURL(serverModulePath).href);
  serverInstance = await mod.startServer();
  return serverInstance;
}

function getAppUrl(query = '') {
  return `http://127.0.0.1:${serverPort}/${query}`;
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'دستیار دفتر — Office Desk Assistant',
    icon: createAppIcon(),
    backgroundColor: '#F8FAFC',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(getAppUrl());
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Hide to System Tray when closed instead of terminating background reminders
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createWidgetWindow(settings) {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.show();
    return;
  }

  const bounds = settings?.widgetBounds || { x: 28, y: 120, width: 350, height: 470 };
  const display = screen.getPrimaryDisplay().workArea;
  const x = Math.min(Math.max(bounds.x ?? 28, display.x), display.x + display.width - 260);
  const y = Math.min(Math.max(bounds.y ?? 80, display.y), display.y + display.height - 200);

  widgetWindow = new BrowserWindow({
    width: bounds.width || 350,
    height: bounds.height || 470,
    minWidth: 280,
    minHeight: 220,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: settings?.widgetAlwaysOnTop ?? true,
    opacity: settings?.widgetOpacity ?? 0.96,
    icon: createAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  widgetWindow.loadURL(getAppUrl('?mode=widget'));

  const saveBounds = () => {
    if (!widgetWindow || widgetWindow.isDestroyed() || !serverInstance?.db) return;
    const b = widgetWindow.getBounds();
    serverInstance.db.updateSettings({
      widgetBounds: b,
      widgetPositionPreset: 'custom',
    });
  };

  widgetWindow.on('moved', saveBounds);
  widgetWindow.on('resized', saveBounds);
  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });
}

function toggleWidget() {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    const settings = serverInstance?.db?.getSettings();
    createWidgetWindow(settings);
    serverInstance?.db?.updateSettings({ widgetVisible: true });
    return;
  }
  if (widgetWindow.isVisible()) {
    widgetWindow.hide();
    serverInstance?.db?.updateSettings({ widgetVisible: false });
  } else {
    widgetWindow.show();
    serverInstance?.db?.updateSettings({ widgetVisible: true });
  }
}

function registerShortcuts(settings) {
  globalShortcut.unregisterAll();
  const s = settings?.shortcuts || {
    toggleWidget: 'CommandOrControl+Shift+Space',
    quickNote: 'CommandOrControl+N',
    urgentTask: 'CommandOrControl+Shift+N',
  };

  const toAccelerator = (combo) => combo.replace(/Ctrl/gi, 'CommandOrControl');

  try {
    globalShortcut.register(toAccelerator(s.toggleWidget || 'Ctrl+Shift+Space'), () => {
      toggleWidget();
    });
    globalShortcut.register(toAccelerator(s.quickNote || 'Ctrl+N'), () => {
      createMainWindow();
      mainWindow?.webContents.send('desktop-action', { type: 'focus-quick-note' });
    });
    globalShortcut.register(toAccelerator(s.urgentTask || 'Ctrl+Shift+N'), () => {
      createMainWindow();
      mainWindow?.webContents.send('desktop-action', { type: 'new-urgent-task' });
    });
  } catch (err) {
    console.warn('Global shortcut registration warning:', err.message);
  }
}

function setupTray() {
  tray = new Tray(createAppIcon());
  tray.setToolTip('دستیار دفتر — Office Desk Assistant');
  const menu = Menu.buildFromTemplate([
    {
      label: 'باز کردن پنجره اصلی',
      click: () => createMainWindow(),
    },
    {
      label: 'نمایش / مخفی کردن ویجت دسکتاپ',
      click: () => toggleWidget(),
    },
    {
      label: 'ثبت سریع یادداشت',
      click: () => {
        createMainWindow();
        mainWindow?.webContents.send('desktop-action', { type: 'focus-quick-note' });
      },
    },
    { type: 'separator' },
    {
      label: 'خروج کامل از برنامه',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => createMainWindow());
}

// Background reminder checker even when main window is hidden in System Tray
function startBackgroundReminderLoop() {
  const notifiedIds = new Set();
  setInterval(() => {
    if (!serverInstance?.db) return;
    const settings = serverInstance.db.getSettings();
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Respect quiet hours
    if (settings.quietHoursEnabled) {
      const start = settings.quietHoursStart;
      const end = settings.quietHoursEnd;
      const inQuiet = start <= end ? hhmm >= start && hhmm <= end : hhmm >= start || hhmm <= end;
      if (inQuiet) return;
    }

    const tasks = serverInstance.db.listTasks(false);
    for (const task of tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') continue;
      for (const rem of task.reminders || []) {
        if (rem.is_dismissed) continue;
        const targetStr = rem.snoozed_until || rem.remind_at;
        const target = new Date(targetStr);
        if (Number.isNaN(target.getTime())) continue;
        const diffMs = now.getTime() - target.getTime();
        const key = `${rem.id}:${targetStr}`;
        if (diffMs >= 0 && diffMs < 120000 && !notifiedIds.has(key)) {
          notifiedIds.add(key);
          if (settings.notificationDisplay !== 'in_app_only' && Notification.isSupported()) {
            const notif = new Notification({
              title: task.priority === 'critical' ? 'یادآوری فوری — دستیار دفتر' : 'یادآوری کار — دستیار دفتر',
              body: task.title,
              urgency: task.priority === 'critical' ? 'critical' : 'normal',
            });
            notif.on('click', () => createMainWindow());
            notif.show();
          }
        }
      }
    }
  }, 15000);
}

app.whenReady().then(async () => {
  try {
  await startLocalBackend();
  const settings = serverInstance.db.getSettings();

  app.setLoginItemSettings({
    openAtLogin: !!settings.autoLaunch,
    path: process.execPath,
  });

  setupTray();
  createMainWindow();
  if (settings.showWidgetOnStart && settings.widgetVisible) {
    createWidgetWindow(settings);
  }
  registerShortcuts(settings);
  startBackgroundReminderLoop();

  ipcMain.handle('widget:toggle', () => {
    toggleWidget();
    return true;
  });

  ipcMain.handle('widget:open-main', () => {
    createMainWindow();
    return true;
  });

  ipcMain.handle('widget:apply-settings', (_event, patch) => {
    const updated = serverInstance.db.updateSettings(patch);
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      if (typeof updated.widgetAlwaysOnTop === 'boolean') {
        widgetWindow.setAlwaysOnTop(updated.widgetAlwaysOnTop);
      }
      if (typeof updated.widgetOpacity === 'number') {
        widgetWindow.setOpacity(Math.min(1, Math.max(0.35, updated.widgetOpacity)));
      }
      if (patch.widgetBounds) {
        widgetWindow.setBounds(updated.widgetBounds);
      }
    }
    if (typeof patch.autoLaunch === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: patch.autoLaunch, path: process.execPath });
    }
    if (patch.shortcuts) {
      registerShortcuts(updated);
    }
    return updated;
  });
  } catch (error) {
    const details = error && error.stack ? error.stack : String(error);
    console.error('Office Desk Assistant startup failed:', details);
    dialog.showErrorBox('خطا در اجرای دستیار دفتر', `برنامه نتوانست راه‌اندازی شود.\n\n${details}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Keep running in System Tray on Windows
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (serverInstance?.server) {
    serverInstance.server.close();
  }
});
