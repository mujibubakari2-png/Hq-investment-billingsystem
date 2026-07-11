import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { WinBoxService } from './services/WinBoxService';
import { DiscoveryService } from './services/DiscoveryService';
import { DownloadService } from './services/DownloadService';
import { CredentialService } from './services/CredentialService';

export function setupIpcHandlers() {
  ipcMain.handle('mikrotik:checkWinBoxInstalled', async () => {
    return WinBoxService.isInstalled();
  });

  ipcMain.handle('mikrotik:launchWinBox', async (event: IpcMainInvokeEvent, ip: string, user: string) => {
    try {
      const password = await CredentialService.getPassword(ip, user);
      await WinBoxService.launch(ip, user, password || '');
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
