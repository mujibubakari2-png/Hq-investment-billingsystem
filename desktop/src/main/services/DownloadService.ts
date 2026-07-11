import * as fs from 'fs';
import { app } from 'electron';
import { WinBoxService } from './WinBoxService';

export class DownloadService {
  static async download(arch: string, onProgress: (progress: number) => void): Promise<void> {
    // Dynamic import to support node-fetch in CJS
    const fetch = (await import('node-fetch')).default;
    
    // Default to 64-bit for modern systems
    const url = arch === '32' ? 'https://mt.lv/winbox' : 'https://mt.lv/winbox64';
    
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download WinBox: ${response.statusText}`);
    }

    const total = parseInt(response.headers.get('content-length') || '0', 10);
    let downloaded = 0;

    const destPath = WinBoxService.getWinBoxPath();
    const destStream = fs.createWriteStream(destPath);

    return new Promise((resolve, reject) => {
      response.body!.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (total > 0) {
          onProgress(Math.round((downloaded / total) * 100));
        }
      });

      response.body!.pipe(destStream);

      response.body!.on('error', (err: any) => {
        destStream.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });

      destStream.on('finish', () => {
        resolve();
      });
    });
  }
}
