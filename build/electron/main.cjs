// Electron 主进程：把内置的 HTTP 服务起起来，然后开一个原生窗口指向它。
// 这样就不需要浏览器，也没有命令行窗口。
const { app, BrowserWindow, Menu, shell, dialog, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// 让 server.cjs 知道：别自动启动、别开浏览器、静态资源在当前目录
process.env.PF_NO_AUTOSTART = '1';
process.env.NO_OPEN = '1';
process.env.PF_ROOT = __dirname;

let mainWindow = null;
let saveTimer = null;
let savedMaximized = false;

function windowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
    const width = Math.max(960, Number(s.width) || 1360);
    const height = Math.max(620, Number(s.height) || 920);
    const out = { width, height, maximized: !!s.maximized };
    if (Number.isFinite(s.x) && Number.isFinite(s.y)) {
      // 保存的位置可能来自已拔掉的显示器，确认它还在某个屏幕里
      const visible = screen.getAllDisplays().some((d) => {
        const a = d.workArea;
        return s.x + 80 < a.x + a.width && s.x + width - 80 > a.x
          && s.y + 40 < a.y + a.height && s.y + height - 40 > a.y;
      });
      if (visible) {
        out.x = s.x;
        out.y = s.y;
      }
    }
    return out;
  } catch {
    return { width: 1360, height: 920, maximized: false };
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    const maximized = mainWindow.isMaximized();
    savedMaximized = maximized;
    const bounds = maximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    fs.mkdirSync(path.dirname(windowStatePath()), { recursive: true });
    fs.writeFileSync(windowStatePath(), JSON.stringify({
      ...bounds,
      maximized,
    }, null, 2), 'utf8');
  } catch {
    /* 窗口状态保存失败不影响使用 */
  }
}

function scheduleSaveWindowState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveWindowState, 350);
}

function createWindow(url) {
  const state = loadWindowState();
  savedMaximized = state.maximized;

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    ...(Number.isFinite(state.x) ? { x: state.x, y: state.y } : {}),
    minWidth: 960,
    minHeight: 620,
    title: 'Prompt Forge',
    backgroundColor: '#e3e5de',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // 窗口加载完成再显示，避免先闪一下白屏；上次最大化就恢复最大化
  mainWindow.once('ready-to-show', () => {
    if (savedMaximized) mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('resize', scheduleSaveWindowState);
  mainWindow.on('move', scheduleSaveWindowState);

  // 站内不打开新窗口；外链交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('http://127.0.0.1')) return { action: 'allow' };
    shell.openExternal(target);
    return { action: 'deny' };
  });

  mainWindow.on('close', saveWindowState);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(url);
}

async function boot() {
  const { startServer } = require('./server.cjs');
  const { url } = await startServer(43125, { quiet: true, noOpen: true });
  createWindow(url);
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

app.setName('Prompt Forge');
app.setAppUserModelId('app.promptforge.desktop');
Menu.setApplicationMenu(null);

// 单实例：第二次双击只聚焦已有窗口，不再起第二个服务和窗口
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => focusMainWindow());

  app.whenReady().then(boot).catch((err) => {
    dialog.showErrorBox('Prompt Forge 启动失败', String(err && err.message ? err.message : err));
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) boot().catch(() => app.quit());
  });

  app.on('before-quit', saveWindowState);

  app.on('window-all-closed', () => {
    app.quit();
  });
}
