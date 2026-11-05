const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('mascotAPI', {
  loadConfig() {
    return ipcRenderer.invoke('mascot:load-editable-config');
  },
  recoverConfig(strategy) {
    return ipcRenderer.invoke('mascot:recover-config', strategy);
  },
  reportDirtyState(dirty) {
    ipcRenderer.send('mascot:settings-dirty', Boolean(dirty));
  },
  resolveAsset(relativePath) {
    return ipcRenderer.invoke('mascot:resolve-asset', relativePath);
  },
  getAssetMetadata(relativePath) {
    return ipcRenderer.invoke('mascot:get-asset-metadata', relativePath);
  },
  chooseImage(category) {
    return ipcRenderer.invoke('mascot:choose-image', category);
  },
  importImage(sourcePath, category) {
    return ipcRenderer.invoke('mascot:import-image', { sourcePath, category });
  },
  saveTransparentPng(arrayBuffer, category, originalName) {
    return ipcRenderer.invoke('mascot:save-transparent-png', {
      arrayBuffer,
      category,
      originalName,
    });
  },
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file);
    } catch (_error) {
      return '';
    }
  },
  getAppInfo() {
    return ipcRenderer.invoke('mascot:get-app-info');
  },
  prepareDistributionDefaults() {
    return ipcRenderer.invoke('mascot:prepare-distribution-defaults');
  },
  saveConfig(config, previewActionIndex = null) {
    return ipcRenderer.invoke('mascot:save-config', { config, previewActionIndex });
  },
});
