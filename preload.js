const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Get paths
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // File dialogs
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  openDirectoryDialog: (options) => ipcRenderer.invoke('open-directory-dialog', options),
});
