const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronDesk', {
  isElectron: true,
  toggleWidget: () => ipcRenderer.invoke('widget:toggle'),
  openMainWindow: () => ipcRenderer.invoke('widget:open-main'),
  applyDesktopSettings: (patch) => ipcRenderer.invoke('widget:apply-settings', patch),
  onDesktopAction: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop-action', listener);
    return () => ipcRenderer.removeListener('desktop-action', listener);
  },
});
