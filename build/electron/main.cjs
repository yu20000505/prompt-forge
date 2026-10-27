// Electron 主进程：把内置的 HTTP 服务起起来，然后开一个原生窗口指向它。
// 这样就不需要浏览器，也没有命令行窗口。
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('node:path');

// 让 server.cjs 知道：别自动启动、别开浏览器、静态资源在当前目录
process.env.PF_NO_AUTOSTART = '1';
process.env.NO_OPEN = '1';
process.env.PF_ROOT = __dirname;

let mainWindow = null;

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 920,
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

  // 窗口加载完成再显示，避免先闪一下白屏
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 站内不打开新窗口；外链交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('http://127.0.0.1')) return { action: 'allow' };
    shell.openExternal(target);
    return { action: 'deny' };
  });

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

app.setName('Prompt Forge');
Menu.setApplicationMenu(null);

app.whenReady().then(boot).catch((err) => {
  dialog.showErrorBox('Prompt Forge 启动失败', String(err && err.message ? err.message : err));
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) boot().catch(() => app.quit());
});

app.on('window-all-closed', () => {
  app.quit();
});
