const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('radarAPI', {
  getSources: () => ipcRenderer.invoke('sources:list'),
  getDocuments: filters => ipcRenderer.invoke('documents:list', filters),
  getFilters: () => ipcRenderer.invoke('filters:get'),
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  startSync: () => ipcRenderer.invoke('sync:start'),
  getLastSync: () => ipcRenderer.invoke('sync:last'),
  markSeen: scope => ipcRenderer.invoke('documents:mark-seen', scope),
  onSyncProgress: cb => ipcRenderer.on('sync:progress', (_,data) => cb(data))
});
