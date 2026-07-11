import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { app } from 'electron';

export class WinBoxService {
  static getWinBoxPath(): string {
    const appData = app.getPath('userData');
    return path.join(appData, 'winbox64.exe');
  }

  static isInstalled(): boolean {
    return fs.existsSync(this.getWinBoxPath());
  }

  static async launch(ip: string, user: string, password?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const exePath = this.getWinBoxPath();
      if (!fs.existsSync(exePath)) {
        return reject(new Error('WinBox executable not found. Please download it first.'));
      }

      // WinBox CLI arguments: winbox64.exe <address> <user> <password>
      const args = [ip, user, password || ''];
      
      const child = execFile(exePath, args, (error) => {
        if (error) {
          console.error('[WinBoxService] Launch error:', error);
          // Don't reject here because execFile callback fires when process exits,
          // which is fine. We only reject if it fails to start.
        }
      });

      child.on('error', (err) => {
        reject(err);
      });

      // Give it a brief moment to catch immediate startup errors
      setTimeout(() => {
        resolve();
      }, 500);
    });
  }
}
