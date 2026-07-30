import * as fs from 'fs';
import { app } from 'electron';
import { WinBoxService } from './WinBoxService';
import { Readable } from 'stream';

export class DownloadService {
  static async download(arch: string, onProgress: (progress: number) => void): Promise<void> {
    // Default to 64-bit for modern systems
    const url = arch === '32' ? 'https://mt.lv/winbox' : 'https://mt.lv/winbox64';
    
    // Use native fetch (available in Node.js 18+ / Electron 33)
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download WinBox: ${response.statusText}`);
    }

    const total = parseInt(response.headers.get('content-length') || '0', 10);
    let downloaded = 0;

    const destPath = WinBoxService.getWinBoxPath();
    const destStream = fs.createWriteStream(destPath);

    return new Promise((resolve, reject) => {
      // Bridge the Web ReadableStream to a Node.js Readable stream
      const nodeStream = Readable.fromWeb(response.body as any);

      nodeStream.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (total > 0) {
          onProgress(Math.round((downloaded / total) * 100));
        }
      });

      nodeStream.pipe(destStream);

      nodeStream.on('error', (err: any) => {
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
