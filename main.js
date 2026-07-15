const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = 3333;
let mainWindow;
let serverProcess;

// ── Path resolution ──
function getNextDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'next-build');
  }
  // Development: standalone build in next-app subdir
  return path.join(__dirname, 'next-app', '.next', 'standalone');
}

function getDataDir() {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'data');
  }
  // Development: use next-app data dir
  return path.join(__dirname, 'next-app', 'data');
}

// ── Server health check ──
function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

// ── Splash / Loading Window ──
function createLoadingWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 340,
    resizable: false,
    frame: false,
    icon: path.join(__dirname, 'resources', 'icon.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
    show: false,
  });

  mainWindow.loadURL(`data:text/html;charset=utf-8,
    <!DOCTYPE html>
    <html>
    <head>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        height:100vh; font-family:system-ui,sans-serif;
        background:linear-gradient(135deg,#0f0f1a 0%,#1a1a2e 50%,#16213e 100%);
        color:#fff; user-select:none; -webkit-app-region:drag;
      }
      .logo {
        width:64px; height:64px; background:linear-gradient(135deg,#6366f1,#8b5cf6);
        border-radius:16px; display:flex; align-items:center; justify-content:center;
        font-size:28px; font-weight:800; color:#fff; margin-bottom:16px;
        box-shadow:0 8px 32px rgba(99,102,241,0.3);
      }
      h1 { font-size:18px; font-weight:600; margin-bottom:4px; }
      .sub { font-size:12px; color:#888; margin-bottom:24px; }
      .loader { width:32px; height:32px; border:3px solid rgba(255,255,255,0.1);
                border-top-color:#6366f1; border-radius:50%;
                animation:spin 0.8s linear infinite; }
      @keyframes spin { to { transform:rotate(360deg); } }
      #status { margin-top:12px; font-size:11px; color:#555; }
    </style>
    </head>
    <body>
      <div class="logo">M</div>
      <h1>Miroo NFT Tools</h1>
      <p class="sub">Starting server...</p>
      <div class="loader"></div>
      <p id="status">Initializing</p>
    </body>
    </html>`);

  mainWindow.once('ready-to-show', () => mainWindow.show());
  return mainWindow;
}

// ── Switch to main app ──
function switchToApp(url) {
  if (!mainWindow) return;
  const { screen } = require('electron');
  const displays = screen.getAllDisplays();
  const display = displays[0] || { workArea: { width: 1920, height: 1080 } };
  const wa = display.workArea;

  mainWindow.setResizable(true);
  mainWindow.setSize(Math.min(1400, wa.width), Math.min(900, wa.height));
  mainWindow.center();
  mainWindow.setTitle('Miroo NFT Tools');
  mainWindow.loadURL(url);
}

// ── Start Next.js standalone server ──
async function startServer() {
  const nextDir = getNextDir();
  const serverScript = path.join(nextDir, 'server.js');

  if (!fs.existsSync(serverScript)) {
    dialog.showErrorBox('Build Error',
      'Next.js standalone server tidak ditemukan.\n\n' +
      `Path: ${serverScript}\n\n` +
      'Jalankan npm run build di folder Bagus-Mau-Beraksi.\n' +
      'Pastikan output: "standalone" ada di next.config.mjs');
    app.quit();
    return false;
  }

  // Pastikan data directory exists
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return new Promise((resolve) => {
    serverProcess = spawn('node', ['server.js'], {
      cwd: nextDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(PORT),
        NFT_DATA_DIR: dataDir,
      },
    });

    serverProcess.stdout.on('data', (d) => process.stdout.write(`[next] ${d}`));
    serverProcess.stderr.on('data', (d) => process.stderr.write(`[next:err] ${d}`));
    serverProcess.on('exit', (code) => {
      serverProcess = null;
      console.log(`Next.js server exited with code ${code}`);
    });

    // Poll every 1s, max 60s
    let attempts = 0;
    const iv = setInterval(async () => {
      const ready = await checkServer();
      if (ready) {
        clearInterval(iv);
        resolve(true);
      } else if (++attempts >= 60) {
        clearInterval(iv);
        resolve(false);
      } else {
        try {
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.executeJavaScript(
              `document.getElementById('status').textContent = 'Starting... (${attempts}s)'`
            ).catch(() => {});
          }
        } catch(e) {}
      }
    }, 1000);
  });
}

// ── IPC Handlers ──
const { ipcMain } = require('electron');

// Get AppData path (so renderer can reference it if needed)
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

// Open file dialog for importing trait images
ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }],
    ...options,
  });
  return result;
});

// Open directory dialog
ipcMain.handle('open-directory-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    ...options,
  });
  return result;
});

// ── App Lifecycle ──
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

  app.whenReady().then(async () => {
    createLoadingWindow();
    const ready = await startServer();
    if (ready && mainWindow) {
      switchToApp(`http://localhost:${PORT}/`);
    } else if (mainWindow) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <!DOCTYPE html>
        <html>
        <head><style>
          body { margin:0; display:flex; flex-direction:column; align-items:center;
                 justify-content:center; height:100vh; font-family:system-ui,sans-serif;
                 background:#0f0f0f; color:#fff; text-align:center; padding:32px; }
          h1 { font-size:18px; color:#ef4444; margin-bottom:8px; }
          p { color:#888; font-size:13px; line-height:1.5; }
        </style></head>
        <body>
          <h1>Server Gagal Start</h1>
          <p>Next.js server tidak merespon dalam 60 detik.<br>Pastikan build sukses & coba lagi.</p>
        </body>
        </html>`);
    }
  });

  app.on('window-all-closed', () => {
    if (serverProcess) { serverProcess.kill('SIGTERM'); serverProcess = null; }
    app.quit();
  });

  app.on('before-quit', () => {
    if (serverProcess) { serverProcess.kill('SIGTERM'); serverProcess = null; }
  });

  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
  });
}
