import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('mikrotikApi', {
  // Connection / WinBox
  checkWinBoxInstalled: () => ipcRenderer.invoke('mikrotik:checkWinBoxInstalled'),
  launchWinBox: (ip: string, user: string) => ipcRenderer.invoke('mikrotik:launchWinBox', ip, user),
  
  // Discovery
  startDiscovery: () => ipcRenderer.invoke('mikrotik:startDiscovery'),
  stopDiscovery: () => ipcRenderer.invoke('mikrotik:stopDiscovery'),
  onRouterDiscovered: (callback: (router: any) => void) => {
    ipcRenderer.on('mikrotik:routerDiscovered', (_event: IpcRendererEvent, router: any) => callback(router));
  },
  
  // Downloads
  downloadWinBox: (arch: string) => ipcRenderer.invoke('mikrotik:downloadWinBox', arch),
  onDownloadProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('mikrotik:downloadProgress', (_event: IpcRendererEvent, progress: any) => callback(progress));
  }
});
