import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('mikrotikApi', {
  // Connection / WinBox — password is passed so WinBox can auto-login
  checkWinBoxInstalled: () => ipcRenderer.invoke('mikrotik:checkWinBoxInstalled'),
  launchWinBox: (ip: string, user: string, password?: string) =>
    ipcRenderer.invoke('mikrotik:launchWinBox', ip, user, password),

  // Discovery
  startDiscovery: () => ipcRenderer.invoke('mikrotik:startDiscovery'),
  stopDiscovery: () => ipcRenderer.invoke('mikrotik:stopDiscovery'),
  onRouterDiscovered: (callback: (router: any) => void) => {
    // Remove previous listeners to prevent accumulation across modal re-renders
    ipcRenderer.removeAllListeners('mikrotik:routerDiscovered');
    ipcRenderer.on('mikrotik:routerDiscovered', (_event: IpcRendererEvent, router: any) => callback(router));
  },

  // Downloads — remove old listener before adding a new one
  downloadWinBox: (arch: string) => ipcRenderer.invoke('mikrotik:downloadWinBox', arch),
  onDownloadProgress: (callback: (progress: number) => void) => {
    ipcRenderer.removeAllListeners('mikrotik:downloadProgress');
    ipcRenderer.on('mikrotik:downloadProgress', (_event: IpcRendererEvent, progress: any) => callback(progress));
  }
});
