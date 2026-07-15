const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let dataDir = null;

// Set data directory BEFORE requiring any lib files
function getDataDir() {
  if (dataDir) return dataDir;
  
  if (app.isPackaged) {
    // Production: use AppData
    dataDir = path.join(app.getPath('appData'), 'Miroo NFT Tools', 'data');
  } else {
    // Development: use project directory
    dataDir = path.join(__dirname, '..', 'Miroo-NFT-App', 'data');
  }
  
  // Create data directory if not exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return dataDir;
}

// Set NFT_DATA_DIR env var BEFORE requiring lib modules
process.env.NFT_DATA_DIR = getDataDir();

const { registerHandlers } = require('./ipc-handlers');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'resources', 'icon.ico'),
  });

  // Register IPC handlers
  registerHandlers(getDataDir());

  // Register dialog handlers
  ipcMain.handle('dialog:openFile', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });

  ipcMain.handle('dialog:openDirectory', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      ...options,
      properties: ['openDirectory'],
    });
    return result;
  });

  ipcMain.handle('app:getPath', () => {
    return getDataDir();
  });

  // Load static HTML from Vite build
  if (app.isPackaged) {
    // Production: load from dist/ directory (bundled in app)
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  } else {
    // Development: load from Vite dist/ directory
    const indexPath = path.join(__dirname, '..', 'miroo-nft-vite', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
