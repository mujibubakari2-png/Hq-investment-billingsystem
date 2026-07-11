import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { WinBoxService } from './services/WinBoxService';
import { DiscoveryService } from './services/DiscoveryService';
import { DownloadService } from './services/DownloadService';
import { CredentialService } from './services/CredentialService';

export function setupIpcHandlers() {
  ipcMain.handle('mikrotik:checkWinBoxInstalled', async () => {
    return WinBoxService.isInstalled();
  });

  ipcMain.handle('mikrotik:launchWinBox', async (_event: IpcMainInvokeEvent, ip: string, user: string, password?: string) => {
    try {
      // Use password passed from UI first; fall back to OS keychain (may be empty on first run)
      const storedPass = password || await CredentialService.getPassword(ip, user) || '';
      // Persist password in keychain for future sessions (only if provided from UI)
      if (password) {
        try { await CredentialService.setPassword(ip, user, password); } catch { /* non-fatal */ }
      }
      await WinBoxService.launch(ip, user, storedPass);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('mikrotik:startDiscovery', (event: IpcMainInvokeEvent) => {
    DiscoveryService.start((router) => {
      event.sender.send('mikrotik:routerDiscovered', router);
    });
    return true;
  });

  ipcMain.handle('mikrotik:stopDiscovery', () => {
    DiscoveryService.stop();
    return true;
  });

  ipcMain.handle('mikrotik:downloadWinBox', async (event: IpcMainInvokeEvent, arch: string) => {
    try {
      await DownloadService.download(arch, (progress) => {
        event.sender.send('mikrotik:downloadProgress', progress);
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
