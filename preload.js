const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose Electron API to renderer process
 * This replaces fetch() calls to /api/* routes
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Collections
  getCollections: () => ipcRenderer.invoke('api:collections:list'),
  createCollection: (data) => ipcRenderer.invoke('api:collections:create', data),
  getCollection: (id) => ipcRenderer.invoke('api:collections:get', id),
  updateCollection: (id, data) => ipcRenderer.invoke('api:collections:update', id, data),
  deleteCollection: (id) => ipcRenderer.invoke('api:collections:delete', id),

  // Layers
  getLayers: (collectionId) => ipcRenderer.invoke('api:layers:list', collectionId),
  createLayer: (collectionId, data) => ipcRenderer.invoke('api:layers:create', collectionId, data),
  updateLayer: (collectionId, layerId, data) => ipcRenderer.invoke('api:layers:update', collectionId, layerId, data),
  deleteLayer: (collectionId, layerId) => ipcRenderer.invoke('api:layers:delete', collectionId, layerId),

  // Traits
  getTraits: (collectionId, layerId) => ipcRenderer.invoke('api:traits:list', collectionId, layerId),
  createTrait: (collectionId, layerId, data) => ipcRenderer.invoke('api:traits:create', collectionId, layerId, data),
  updateTrait: (collectionId, layerId, traitId, data) => ipcRenderer.invoke('api:traits:update', collectionId, layerId, traitId, data),
  deleteTrait: (collectionId, layerId, traitId) => ipcRenderer.invoke('api:traits:delete', collectionId, layerId, traitId),
  getTraitImage: (collectionId, filename) => ipcRenderer.invoke('api:traits:image', collectionId, filename),

  // Upload
  uploadTraits: (collectionId, files) => ipcRenderer.invoke('api:upload:traits', collectionId, files),

  // Layout
  getLayout: (collectionId) => ipcRenderer.invoke('api:layout:get', collectionId),
  saveLayout: (collectionId, config) => ipcRenderer.invoke('api:layout:save', collectionId, config),

  // Preview
  generatePreview: (collectionId, traitIds) => ipcRenderer.invoke('api:preview:generate', collectionId, traitIds),

  // Validate
  validateCollection: (collectionId) => ipcRenderer.invoke('api:validate:collection', collectionId),

  // Generate
  generateNFTs: (collectionId, count) => ipcRenderer.invoke('api:generate:start', collectionId, count),

  // Generated
  getGeneratedNFTs: (collectionId) => ipcRenderer.invoke('api:generated:list', collectionId),
  getGeneratedNFT: (collectionId, tokenId) => ipcRenderer.invoke('api:generated:get', collectionId, tokenId),

  // Export
  exportCollection: (collectionId) => ipcRenderer.invoke('api:export:zip', collectionId),

  // IPFS Upload
  uploadToIPFS: (collectionId) => ipcRenderer.invoke('api:upload:ipfs', collectionId),

  // File dialogs
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openDirectoryDialog: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
  
  // Get app path
  getAppPath: () => ipcRenderer.invoke('app:getPath'),
});
